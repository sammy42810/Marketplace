import {ObjectId} from 'mongodb';
import {HttpError} from './auth.js';
import {getDb} from './mongo.js';
import {createNotification} from './notifications.js';
import {userRoom} from './realtime.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const MAX_BODY = 2000;
const PAGE_SIZE = 50;
const INBOX_SIZE = 100;
const SEND_LIMIT = 10;
const SEND_WINDOW_MS = 10_000;
const sendTimes = (globalThis.marketplaceChatSends ??= new Map());

export function chatRoom(conversationId) {
  return `chat:${conversationId}`;
}

function toObjectId(value, label) {
  if (value instanceof ObjectId) return value;
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) throw new HttpError(404, `${label} not found.`);
  return new ObjectId(value);
}

async function chatCollections() {
  const db = await getDb();
  const conversations = db.collection('conversations');
  const messages = db.collection('messages');
  if (!globalThis.marketplaceChatIndexes) {
    globalThis.marketplaceChatIndexes = Promise.all([
      conversations.createIndexes([
        {key: {listingId: 1, buyerId: 1}, unique: true},
        {key: {buyerId: 1, updatedAt: -1}},
        {key: {sellerId: 1, updatedAt: -1}}
      ]),
      messages.createIndexes([{key: {conversationId: 1, _id: -1}}, {key: {conversationId: 1, recipientId: 1, readAt: 1}}])
    ]).catch((error) => {
      globalThis.marketplaceChatIndexes = null;
      throw error;
    });
  }
  await globalThis.marketplaceChatIndexes;
  return {db, conversations, messages};
}

function checkSendRate(userId) {
  const key = userId.toString();
  const now = Date.now();
  const recent = (sendTimes.get(key) ?? []).filter((time) => now - time < SEND_WINDOW_MS);
  if (recent.length >= SEND_LIMIT) throw new HttpError(429, 'You are sending messages too fast. Wait a few seconds.');
  recent.push(now);
  sendTimes.set(key, recent);
}

function messageBody(value) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'Write a message first.');
  const trimmed = value.trim();
  if (trimmed.length > MAX_BODY) throw new HttpError(400, `Messages must be ${MAX_BODY} characters or fewer.`);
  return trimmed;
}

function isParty(conversation, userId) {
  return conversation.buyerId.equals(userId) || conversation.sellerId.equals(userId);
}

function otherParty(conversation, userId) {
  return conversation.buyerId.equals(userId) ? conversation.sellerId : conversation.buyerId;
}

export function publicMessage(message) {
  return {
    _id: message._id.toString(),
    conversationId: message.conversationId,
    listingId: message.listingId?.toString() ?? null,
    senderId: message.senderId.toString(),
    recipientId: message.recipientId.toString(),
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString()
  };
}

function publicListing(listing) {
  if (!listing) return null;
  const photo = listing.photos?.[0];
  return {
    _id: listing._id.toString(),
    title: listing.title,
    price: listing.price,
    status: listing.status,
    saleType: listing.saleType,
    thumb: photo?.thumb ?? photo?.card ?? null
  };
}

function publicUser(user) {
  if (!user) return null;
  return {_id: user._id.toString(), displayName: user.displayName ?? null, photoUrl: user.photoUrl ?? null};
}

function publicConversation(conversation, userId, {listing, other, unread = 0} = {}) {
  return {
    _id: conversation._id.toString(),
    listingId: conversation.listingId.toString(),
    buyerId: conversation.buyerId.toString(),
    sellerId: conversation.sellerId.toString(),
    role: conversation.buyerId.equals(userId) ? 'buyer' : 'seller',
    lastMessage: conversation.lastMessage
      ? {
          body: conversation.lastMessage.body,
          senderId: conversation.lastMessage.senderId.toString(),
          createdAt: conversation.lastMessage.createdAt.toISOString()
        }
      : null,
    unread,
    ...(listing !== undefined && {listing: publicListing(listing)}),
    ...(other !== undefined && {otherUser: publicUser(other)}),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

export async function findConversation(id, userId) {
  const {conversations} = await chatCollections();
  const conversation = await conversations.findOne({_id: toObjectId(id, 'Conversation')});
  if (!conversation || !isParty(conversation, userId)) throw new HttpError(404, 'Conversation not found.');
  return conversation;
}

export async function startConversation(listingIdValue, userId) {
  const listingId = toObjectId(listingIdValue, 'Listing');
  const {db, conversations} = await chatCollections();
  const listing = await db.collection('listings').findOne({_id: listingId, status: {$ne: 'removed'}});
  if (!listing) throw new HttpError(404, 'Listing not found.');
  if (listing.sellerId.equals(userId)) throw new HttpError(403, 'You cannot message yourself about your own listing.');

  const now = new Date();
  const upsert = () =>
    conversations.findOneAndUpdate(
      {listingId, buyerId: userId},
      {$setOnInsert: {listingId, buyerId: userId, sellerId: listing.sellerId, lastMessage: null, createdAt: now, updatedAt: now}},
      {upsert: true, returnDocument: 'after'}
    );

  let conversation;
  try {
    conversation = await upsert();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await upsert();
  }
  return publicConversation(conversation, userId);
}

async function unreadCounts(messages, conversationIds, userId) {
  if (conversationIds.length === 0) return new Map();
  const groups = await messages
    .aggregate([
      {$match: {conversationId: {$in: conversationIds}, recipientId: userId, readAt: null}},
      {$group: {_id: '$conversationId', count: {$sum: 1}}}
    ])
    .toArray();
  return new Map(groups.map((group) => [group._id, group.count]));
}

export async function getConversation(id, userId) {
  const conversation = await findConversation(id, userId);
  const {db, messages} = await chatCollections();
  const [listing, other, unread] = await Promise.all([
    db.collection('listings').findOne({_id: conversation.listingId}, {projection: {title: 1, price: 1, status: 1, saleType: 1, photos: {$slice: 1}}}),
    db.collection('users').findOne({_id: otherParty(conversation, userId)}, {projection: {displayName: 1, photoUrl: 1}}),
    unreadCounts(messages, [conversation._id.toString()], userId)
  ]);
  return publicConversation(conversation, userId, {
    listing,
    other,
    unread: unread.get(conversation._id.toString()) ?? 0
  });
}

export async function listConversations(userId) {
  const {db, conversations, messages} = await chatCollections();
  const found = await conversations
    .find({
      $or: [
        {buyerId: userId, lastMessage: {$ne: null}},
        {sellerId: userId, lastMessage: {$ne: null}}
      ]
    })
    .sort({updatedAt: -1, _id: -1})
    .limit(INBOX_SIZE)
    .toArray();

  const listingIds = found.map((conversation) => conversation.listingId);
  const otherIds = found.map((conversation) => otherParty(conversation, userId));
  const [listings, others, unread] = await Promise.all([
    db
      .collection('listings')
      .find({_id: {$in: listingIds}}, {projection: {title: 1, price: 1, status: 1, saleType: 1, photos: {$slice: 1}}})
      .toArray(),
    db.collection('users').find({_id: {$in: otherIds}}, {projection: {displayName: 1, photoUrl: 1}}).toArray(),
    unreadCounts(
      messages,
      found.map((conversation) => conversation._id.toString()),
      userId
    )
  ]);
  const listingById = new Map(listings.map((listing) => [listing._id.toString(), listing]));
  const userById = new Map(others.map((other) => [other._id.toString(), other]));

  return found.map((conversation) =>
    publicConversation(conversation, userId, {
      listing: listingById.get(conversation.listingId.toString()) ?? null,
      other: userById.get(otherParty(conversation, userId).toString()) ?? null,
      unread: unread.get(conversation._id.toString()) ?? 0
    })
  );
}

export async function listMessages(id, userId, before = null) {
  const conversation = await findConversation(id, userId);
  const {messages} = await chatCollections();
  const filter = {conversationId: conversation._id.toString()};
  if (before !== null) {
    if (!OBJECT_ID.test(before)) throw new HttpError(400, 'before must be a message ID.');
    filter._id = {$lt: new ObjectId(before)};
  }
  const page = await messages
    .find(filter)
    .sort({_id: -1})
    .limit(PAGE_SIZE + 1)
    .toArray();
  return {
    messages: page.slice(0, PAGE_SIZE).reverse().map(publicMessage),
    hasMore: page.length > PAGE_SIZE
  };
}

export async function sendMessage(conversationIdValue, bodyValue, userId) {
  checkSendRate(userId);
  const body = messageBody(bodyValue);
  const conversation = await findConversation(conversationIdValue, userId);
  const {db, conversations, messages} = await chatCollections();
  const conversationId = conversation._id.toString();
  const recipientId = otherParty(conversation, userId);
  const now = new Date();

  const message = {
    conversationId,
    listingId: conversation.listingId,
    senderId: userId,
    recipientId,
    body,
    readAt: null,
    createdAt: now
  };
  const {insertedId} = await messages.insertOne(message);
  const sent = publicMessage({...message, _id: insertedId});

  await conversations.updateOne(
    {_id: conversation._id},
    {$set: {lastMessage: {body, senderId: userId, createdAt: now}, updatedAt: now}}
  );

  globalThis.marketplaceIo
    ?.to(chatRoom(conversationId))
    .to(userRoom(userId.toString()))
    .to(userRoom(recipientId.toString()))
    .emit('message:new', {message: sent});

  const sender = await db.collection('users').findOne({_id: userId}, {projection: {displayName: 1}});
  try {
    await createNotification({
      userId: recipientId,
      type: 'new_message',
      listingId: conversation.listingId,
      actorId: userId,
      message: `${sender?.displayName || 'Someone'}: ${body}`
    });
  } catch (error) {
    console.error('Could not create new_message notification:', error);
  }

  return sent;
}
