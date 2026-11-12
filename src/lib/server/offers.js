import {ObjectId} from 'mongodb';
import {HttpError} from './auth.js';
import {getDb, getMongoClient} from './mongo.js';
import {createNotification} from './notifications.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const MAX_AMOUNT = 1_000_000_000;
const SELLER_STATUSES = ['accepted', 'rejected'];
const BUYER_STATUSES = ['cancelled'];

function objectIdOr404(id, label) {
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) throw new HttpError(404, `${label} not found.`);
  return new ObjectId(id);
}

function offerAmount(value) {
  const valid =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_AMOUNT &&
    Math.abs(Math.round(value * 100) - value * 100) <= 1e-6;
  if (!valid) throw new HttpError(400, 'Amount must be a positive number with at most two decimal places.');
  return value;
}

function money(amount) {
  return `$${amount.toFixed(2).replace(/\.00$/, '')}`;
}

function displayName(user) {
  return user?.displayName || 'A buyer';
}

async function offersCollection() {
  const offers = (await getDb()).collection('offers');
  if (!globalThis.marketplaceOfferIndexes) {
    globalThis.marketplaceOfferIndexes = offers
      .createIndexes([
        {key: {listingId: 1, status: 1, createdAt: -1}},
        {key: {buyerId: 1, createdAt: -1}},
        {key: {listingId: 1, buyerId: 1}, unique: true, partialFilterExpression: {status: 'pending'}}
      ])
      .catch((error) => {
        globalThis.marketplaceOfferIndexes = null;
        throw error;
      });
  }
  await globalThis.marketplaceOfferIndexes;
  return offers;
}

export function publicOffer(offer, buyer = null) {
  return {
    _id: offer._id.toString(),
    listingId: offer.listingId.toString(),
    buyerId: offer.buyerId.toString(),
    amount: offer.amount,
    status: offer.status,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    ...(buyer !== null && {buyer})
  };
}

async function findListing(listingId) {
  const listing = await (await getDb()).collection('listings').findOne({_id: listingId, status: {$ne: 'removed'}});
  if (!listing) throw new HttpError(404, 'Listing not found.');
  return listing;
}

async function notify(input) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error(`Could not create ${input.type} notification:`, error);
  }
}

export async function makeOffer(id, body, user) {
  const listingId = objectIdOr404(id, 'Listing');
  const amount = offerAmount(body?.amount);
  const listing = await findListing(listingId);

  if (listing.saleType !== 'offer') throw new HttpError(400, 'This listing does not accept offers.');
  if (listing.status !== 'active') throw new HttpError(409, 'This listing is no longer available.');
  if (listing.sellerId.equals(user._id)) throw new HttpError(403, 'You cannot make an offer on your own listing.');

  const offers = await offersCollection();
  const now = new Date();
  const offer = {listingId, buyerId: user._id, amount, status: 'pending', createdAt: now, updatedAt: now};
  let insertedId;
  try {
    ({insertedId} = await offers.insertOne(offer));
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(409, 'You already have a pending offer on this listing. Cancel it to make a new one.');
    }
    throw error;
  }

  await notify({
    userId: listing.sellerId,
    type: 'offer_received',
    listingId,
    actorId: user._id,
    message: `${displayName(user)} offered ${money(amount)} on "${listing.title}"`
  });

  return publicOffer({...offer, _id: insertedId});
}

export async function listOffers(id, user) {
  const listingId = objectIdOr404(id, 'Listing');
  const listing = await findListing(listingId);
  const isSeller = listing.sellerId.equals(user._id);
  const offers = await offersCollection();
  const found = await offers
    .find(isSeller ? {listingId} : {listingId, buyerId: user._id})
    .sort({createdAt: -1, _id: -1})
    .toArray();

  if (!isSeller) return found.map((offer) => publicOffer(offer));

  const buyerIds = [...new Set(found.map((offer) => offer.buyerId.toString()))].map((buyerId) => new ObjectId(buyerId));
  const buyers = await (await getDb())
    .collection('users')
    .find({_id: {$in: buyerIds}}, {projection: {displayName: 1, photoUrl: 1}})
    .toArray();
  const byId = new Map(
    buyers.map((buyer) => [
      buyer._id.toString(),
      {_id: buyer._id.toString(), displayName: buyer.displayName ?? null, photoUrl: buyer.photoUrl ?? null}
    ])
  );
  return found.map((offer) => publicOffer(offer, byId.get(offer.buyerId.toString()) ?? null));
}

async function acceptOffer(offer, listing) {
  const db = await getDb();
  const session = (await getMongoClient()).startSession();
  let declined = [];
  let accepted;

  try {
    await session.withTransaction(
      async () => {
        const now = new Date();
        const sold = await db.collection('listings').findOneAndUpdate(
          {_id: listing._id, saleType: 'offer', status: 'active'},
          {$set: {status: 'sold', buyerId: offer.buyerId, soldPrice: offer.amount, soldAt: now, updatedAt: now}},
          {session}
        );
        if (!sold) throw new HttpError(409, 'This listing is no longer available.');

        accepted = await db
          .collection('offers')
          .findOneAndUpdate(
            {_id: offer._id, status: 'pending'},
            {$set: {status: 'accepted', updatedAt: now}},
            {returnDocument: 'after', session}
          );
        if (!accepted) throw new HttpError(409, 'This offer is no longer pending.');

        const others = {listingId: listing._id, status: 'pending', _id: {$ne: offer._id}};
        declined = await db.collection('offers').find(others, {projection: {buyerId: 1}, session}).toArray();
        await db.collection('offers').updateMany(others, {$set: {status: 'rejected', updatedAt: now}}, {session});
      },
      {writeConcern: {w: 'majority'}}
    );
  } finally {
    await session.endSession();
  }

  await notify({
    userId: offer.buyerId,
    type: 'offer_accepted',
    listingId: listing._id,
    actorId: listing.sellerId,
    message: `Your ${money(offer.amount)} offer on "${listing.title}" was accepted`
  });
  await Promise.all(
    declined.map((other) =>
      notify({
        userId: other.buyerId,
        type: 'listing_sold',
        listingId: listing._id,
        actorId: null,
        message: `"${listing.title}" sold to another buyer`
      })
    )
  );

  return accepted;
}

async function closeOffer(offer, status) {
  const updated = await (await offersCollection()).findOneAndUpdate(
    {_id: offer._id, status: 'pending'},
    {$set: {status, updatedAt: new Date()}},
    {returnDocument: 'after'}
  );
  if (!updated) throw new HttpError(409, 'This offer is no longer pending.');
  return updated;
}

export async function updateOffer(id, body, user) {
  const offerId = objectIdOr404(id, 'Offer');
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Send a JSON object.');
  const unknown = Object.keys(body).find((field) => field !== 'status');
  if (unknown) throw new HttpError(400, `"${unknown}" cannot be changed.`);

  const offer = await (await offersCollection()).findOne({_id: offerId});
  if (!offer) throw new HttpError(404, 'Offer not found.');
  const listing = await findListing(offer.listingId);
  const isSeller = listing.sellerId.equals(user._id);
  const isBuyer = offer.buyerId.equals(user._id);
  if (!isSeller && !isBuyer) throw new HttpError(404, 'Offer not found.');

  const allowed = isSeller ? SELLER_STATUSES : BUYER_STATUSES;
  if (!allowed.includes(body.status)) throw new HttpError(400, `Status must be one of: ${allowed.join(', ')}.`);
  if (offer.status !== 'pending') throw new HttpError(409, 'This offer is no longer pending.');

  if (body.status === 'accepted') return publicOffer(await acceptOffer(offer, listing));

  const updated = await closeOffer(offer, body.status);
  if (body.status === 'rejected') {
    await notify({
      userId: offer.buyerId,
      type: 'offer_declined',
      listingId: listing._id,
      actorId: listing.sellerId,
      message: `Your ${money(offer.amount)} offer on "${listing.title}" was declined`
    });
  }
  return publicOffer(updated);
}
