// The notification format agreed in CONTRACTS.md section 4. Every feature that notifies a user
// goes through createNotification, so the stored document and the socket payload always match.
import {ObjectId} from 'mongodb';
import {HttpError} from './auth.js';
import {getDb} from './mongo.js';
import {emitToUser} from './realtime.js';

export const NOTIFICATION_TYPES = [
  'offer_received',
  'offer_accepted',
  'offer_declined',
  'outbid',
  'auction_won',
  'auction_ended',
  'price_drop',
  'listing_sold',
  'new_message'
];

export const MAX_NOTIFICATION_MESSAGE = 280;
const PAGE_SIZE = 30;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

async function notificationsCollection() {
  const notifications = (await getDb()).collection('notifications');
  if (!globalThis.marketplaceNotificationIndexes) {
    globalThis.marketplaceNotificationIndexes = notifications
      .createIndex({userId: 1, createdAt: -1, _id: -1})
      .catch((error) => {
        globalThis.marketplaceNotificationIndexes = null;
        throw error;
      });
  }
  await globalThis.marketplaceNotificationIndexes;
  return notifications;
}

// Callers pass ids from our own documents, so a bad one is a bug, not a 400.
function objectId(value, label) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value) && value.length === 24) return new ObjectId(value);
  throw new TypeError(`createNotification: ${label} must be an ObjectId.`);
}

function messageText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('createNotification: message is required.');
  const trimmed = value.trim().replace(/\s+/g, ' ');
  // new_message previews come from user text, so shorten rather than reject.
  return trimmed.length > MAX_NOTIFICATION_MESSAGE ? `${trimmed.slice(0, MAX_NOTIFICATION_MESSAGE - 1)}…` : trimmed;
}

// The JSON shape sent by GET /api/notifications and the `notification:new` socket event.
export function publicNotification(doc) {
  return {
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type,
    listingId: doc.listingId?.toString() ?? null,
    actorId: doc.actorId?.toString() ?? null,
    message: doc.message,
    read: doc.read,
    createdAt: doc.createdAt
  };
}

/**
 * Saves a notification, then pushes it to the recipient's open tabs.
 * Returns the public notification, or null when the recipient is the actor (nobody is told about
 * their own action). If the insert fails it throws and nothing is emitted.
 *
 * @param {object} input
 * @param {ObjectId|string} input.userId     recipient (users._id)
 * @param {string} input.type                one of NOTIFICATION_TYPES
 * @param {ObjectId|string|null} [input.listingId]
 * @param {ObjectId|string|null} [input.actorId]  user who caused it; null for system events
 * @param {string} input.message             plain text shown to the recipient
 */
export async function createNotification({userId, type, listingId = null, actorId = null, message}) {
  if (!NOTIFICATION_TYPES.includes(type)) throw new TypeError(`createNotification: unknown type "${type}".`);
  const doc = {
    userId: objectId(userId, 'userId'),
    type,
    listingId: listingId === null ? null : objectId(listingId, 'listingId'),
    actorId: actorId === null ? null : objectId(actorId, 'actorId'),
    message: messageText(message),
    read: false,
    createdAt: new Date()
  };
  if (doc.actorId?.equals(doc.userId)) return null;

  const {insertedId} = await (await notificationsCollection()).insertOne(doc);
  const notification = publicNotification({...doc, _id: insertedId});
  emitToUser(doc.userId, 'notification:new', {notification});
  return notification;
}

// GET /api/notifications. Pass the last notification's _id as `before` to load the next page.
export async function listNotifications(userId, before = null) {
  const notifications = await notificationsCollection();
  const filter = {userId};
  if (before !== null) {
    const last = OBJECT_ID.test(before) && (await notifications.findOne({_id: new ObjectId(before), userId}));
    if (!last) throw new HttpError(400, 'before must be one of your notification IDs.');
    filter.$or = [{createdAt: {$lt: last.createdAt}}, {createdAt: last.createdAt, _id: {$lt: last._id}}];
  }
  const [page, unread] = await Promise.all([
    notifications.find(filter).sort({createdAt: -1, _id: -1}).limit(PAGE_SIZE + 1).toArray(),
    notifications.countDocuments({userId, read: false})
  ]);
  return {
    notifications: page.slice(0, PAGE_SIZE).map(publicNotification),
    hasMore: page.length > PAGE_SIZE,
    unread
  };
}

// PATCH /api/notifications/:id. Someone else's notification is a 404, the same as a missing one.
export async function markNotificationRead(id, body, userId) {
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) throw new HttpError(404, 'Notification not found.');
  const keys = body && typeof body === 'object' ? Object.keys(body) : [];
  if (keys.length !== 1 || body.read !== true) throw new HttpError(400, 'Send {"read": true}. Nothing else can be changed.');

  const notifications = await notificationsCollection();
  const doc = await notifications.findOneAndUpdate(
    {_id: new ObjectId(id), userId},
    {$set: {read: true}},
    {returnDocument: 'after'}
  );
  if (!doc) throw new HttpError(404, 'Notification not found.');
  return publicNotification(doc);
}

// POST /api/notifications/read-all
export async function markAllNotificationsRead(userId) {
  const {modifiedCount} = await (await notificationsCollection()).updateMany(
    {userId, read: false},
    {$set: {read: true}}
  );
  return {updated: modifiedCount};
}
