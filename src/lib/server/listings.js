import {ObjectId} from 'mongodb';
import {HttpError} from './auth.js';
import {getDb} from './mongo.js';

const CATEGORIES = ['electronics', 'furniture', 'textbooks', 'clothing', 'tickets', 'sports', 'home', 'other'];
const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

const SALE_TYPES = ['offer', 'auction'];
const SORTS = {
  newest: {createdAt: -1, _id: -1},
  price_asc: {price: 1, _id: -1},
  price_desc: {price: -1, _id: -1}
};
const MAX_PRICE = 1_000_000_000;
const MAX_PHOTOS = 8;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 24;
const MIN_AUCTION_MS = 60_000;
const MAX_AUCTION_MS = 30 * 24 * 60 * 60 * 1000;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const CARD_FIELDS = {
  title: 1,
  price: 1,
  condition: 1,
  category: 1,
  zip: 1,
  saleType: 1,
  status: 1,
  startsAt: 1,
  endsAt: 1,
  currentBid: 1,
  createdAt: 1,
  photos: {$slice: 1}
};

const invalid = (message) => new HttpError(400, message);

function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim()) throw invalid(`${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

function money(value, label) {
  const inRange = typeof value === 'number' && value > 0 && value <= MAX_PRICE;
  if (!inRange || Math.abs(Math.round(value * 100) - value * 100) > 1e-6) {
    throw invalid(`${label} must be a positive amount with at most two decimal places.`);
  }
  return value;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw invalid(`${label} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function zipCode(value) {
  if (typeof value !== 'string' || !/^\d{5}$/.test(value)) throw invalid('ZIP code must be 5 digits.');
  return value;
}

function photoPath(value) {
  // Our upload endpoint serves same-site paths; anything else could point at another site.
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.length > 500) {
    throw invalid('Each photo must be a path on this site.');
  }
  return value;
}

function photos(value) {
  if (!Array.isArray(value) || value.length > MAX_PHOTOS) throw invalid(`Photos must be a list of at most ${MAX_PHOTOS}.`);
  return value.map((photo) => ({
    thumb: photoPath(photo?.thumb),
    card: photoPath(photo?.card),
    full: photoPath(photo?.full)
  }));
}

function location(value) {
  if (value === null) return null;
  const [longitude, latitude, extra] = Array.isArray(value?.coordinates) ? value.coordinates : [];
  const valid =
    value?.type === 'Point' &&
    extra === undefined &&
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90;
  if (!valid) throw invalid('Location must be a GeoJSON Point of [longitude, latitude].');
  return {type: 'Point', coordinates: [longitude, latitude]};
}

function date(value, label) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) throw invalid(`${label} must be a date.`);
  return parsed;
}

const EDITABLE = {
  title: (value) => text(value, 'Title', 100),
  description: (value) => text(value, 'Description', 5000),
  category: (value) => oneOf(value, CATEGORIES, 'Category'),
  condition: (value) => oneOf(value, CONDITIONS, 'Condition'),
  price: (value) => money(value, 'Price'),
  photos,
  zip: zipCode,
  location
};
const AUCTION_FIELDS = ['startsAt', 'endsAt', 'minIncrement'];
const REQUIRED = ['title', 'description', 'category', 'condition', 'price', 'saleType', 'zip'];

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid('Send a JSON object.');
}

function validateEditable(body) {
  return Object.fromEntries(
    Object.keys(EDITABLE)
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, EDITABLE[field](body[field])])
  );
}

function auctionTerms(body, now) {
  const startsAt = body.startsAt === undefined ? now : date(body.startsAt, 'Start time');
  const endsAt = date(body.endsAt, 'End time');
  if (body.startsAt !== undefined && startsAt.getTime() < now.getTime() - MIN_AUCTION_MS) {
    throw invalid('Start time cannot be in the past.');
  }
  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration < MIN_AUCTION_MS || duration > MAX_AUCTION_MS) {
    throw invalid('Auctions must run between 1 minute and 30 days.');
  }
  return {startsAt, endsAt, minIncrement: money(body.minIncrement, 'Minimum increment')};
}

function serialize(listing) {
  return {
    ...listing,
    _id: listing._id.toString(),
    sellerId: listing.sellerId.toString(),
    currentBidder: listing.currentBidder?.toString() ?? null,
    ...(listing.buyerId && {buyerId: listing.buyerId.toString()})
  };
}

async function listingsCollection() {
  const listings = (await getDb()).collection('listings');
  if (!globalThis.marketplaceListingIndexes) {
    globalThis.marketplaceListingIndexes = listings
      .createIndexes([
        {key: {status: 1, createdAt: -1, _id: -1}},
        {key: {status: 1, category: 1, createdAt: -1, _id: -1}},
        {key: {status: 1, price: 1, _id: -1}},
        {key: {saleType: 1, status: 1, endsAt: 1}},
        {key: {sellerId: 1, status: 1, createdAt: -1}},
        {key: {location: '2dsphere'}}
      ])
      .catch((error) => {
        globalThis.marketplaceListingIndexes = null;
        throw error;
      });
  }
  await globalThis.marketplaceListingIndexes;
  return listings;
}

function forSale(now) {
  return {status: 'active', $or: [{saleType: {$ne: 'auction'}}, {endsAt: {$gt: now}}]};
}

async function findVisibleListing(listings, id) {
  const listing = await listings.findOne({_id: objectIdOr404(id), status: {$ne: 'removed'}});
  if (!listing) throw new HttpError(404, 'Listing not found.');
  return listing;
}

function objectIdOr404(id) {
  if (!OBJECT_ID.test(id)) throw new HttpError(404, 'Listing not found.');
  return new ObjectId(id);
}

export async function createListing(body, user) {
  assertObject(body);
  const allowed = [...Object.keys(EDITABLE), 'saleType', ...AUCTION_FIELDS];
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw invalid(`"${unknown}" cannot be set.`);
  const missing = REQUIRED.find((field) => body[field] === undefined);
  if (missing) throw invalid(`${missing} is required.`);

  const saleType = oneOf(body.saleType, SALE_TYPES, 'Sale type');
  if (saleType === 'offer' && AUCTION_FIELDS.some((field) => body[field] !== undefined)) {
    throw invalid('Auction settings only apply to auction listings.');
  }

  const now = new Date();
  const listing = {
    photos: [],
    location: null,
    ...validateEditable(body),
    saleType,
    sellerId: user._id,
    status: 'active',
    ...(saleType === 'auction' ? auctionTerms(body, now) : {startsAt: null, endsAt: null, minIncrement: null}),
    currentBid: null,
    currentBidder: null,
    createdAt: now,
    updatedAt: now
  };

  const listings = await listingsCollection();
  const {insertedId} = await listings.insertOne(listing);
  return serialize({...listing, _id: insertedId});
}

export async function getListing(id) {
  const listing = await findVisibleListing(await listingsCollection(), id);
  const db = await getDb();
  const seller = await db.collection('users').findOne({_id: listing.sellerId}, {projection: {displayName: 1, photoUrl: 1}});
  return {
    ...serialize(listing),
    seller: seller && {_id: seller._id.toString(), displayName: seller.displayName, photoUrl: seller.photoUrl}
  };
}

export async function getSellerRating(sellerId) {
  if (!OBJECT_ID.test(sellerId ?? '')) return {average: null, count: 0};
  const db = await getDb();
  const [summary] = await db
    .collection('reviews')
    .aggregate([
      {$match: {revieweeId: new ObjectId(sellerId)}},
      {$group: {_id: null, average: {$avg: '$rating'}, count: {$sum: 1}}}
    ])
    .toArray();
  if (!summary) return {average: null, count: 0};
  return {average: Math.round(summary.average * 10) / 10, count: summary.count};
}

function positiveInt(value, fallback, label) {
  if (value === null) return fallback;
  if (!/^[1-9]\d{0,8}$/.test(value)) throw invalid(`${label} must be a whole number of 1 or more.`);
  return Number(value);
}

function priceFilter(value, label) {
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed < 0) throw invalid(`${label} must be 0 or more.`);
  return parsed;
}

export async function browseListings(params) {
  const page = positiveInt(params.get('page'), 1, 'Page');
  const limit = positiveInt(params.get('limit'), DEFAULT_PAGE_SIZE, 'Limit');
  if (limit > MAX_PAGE_SIZE) throw invalid(`Limit must be ${MAX_PAGE_SIZE} or fewer.`);

  const filter = forSale(new Date());
  if (params.has('category')) filter.category = oneOf(params.get('category'), CATEGORIES, 'Category');
  if (params.has('condition')) filter.condition = oneOf(params.get('condition'), CONDITIONS, 'Condition');
  if (params.has('saleType')) filter.saleType = oneOf(params.get('saleType'), SALE_TYPES, 'Sale type');
  if (params.has('seller')) {
    if (!OBJECT_ID.test(params.get('seller'))) throw invalid('Seller must be a user ID.');
    filter.sellerId = new ObjectId(params.get('seller'));
  }
  if (params.has('minPrice') || params.has('maxPrice')) {
    filter.price = {};
    if (params.has('minPrice')) filter.price.$gte = priceFilter(params.get('minPrice'), 'Minimum price');
    if (params.has('maxPrice')) filter.price.$lte = priceFilter(params.get('maxPrice'), 'Maximum price');
  }

  const sort = oneOf(params.get('sort') ?? 'newest', Object.keys(SORTS), 'Sort');

  const listings = await listingsCollection();
  const [found, total] = await Promise.all([
    listings.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).toArray(),
    listings.countDocuments(filter)
  ]);
  return {listings: found.map(serialize), page, limit, total};
}

async function findOwnedListing(listings, id, user) {
  const listing = await findVisibleListing(listings, id);
  if (!listing.sellerId.equals(user._id)) throw new HttpError(403, 'Only the seller can change this listing.');
  return listing;
}

// Part of the update filter so a bid landing mid-request still blocks the change.
const stillChangeable = (listing) => ({_id: listing._id, status: 'active', currentBid: null});
const LOCKED = 'This listing can no longer be changed because it has sold or has bids.';

export async function updateListing(id, body, user) {
  assertObject(body);
  const unknown = Object.keys(body).find((field) => !(field in EDITABLE));
  if (unknown) throw invalid(`"${unknown}" cannot be changed.`);
  const changes = validateEditable(body);
  if (Object.keys(changes).length === 0) throw invalid('Send at least one field to change.');

  const listings = await listingsCollection();
  const listing = await findOwnedListing(listings, id, user);
  const updated = await listings.findOneAndUpdate(
    stillChangeable(listing),
    {$set: {...changes, updatedAt: new Date()}},
    {returnDocument: 'after'}
  );
  if (!updated) throw new HttpError(409, LOCKED);
  return serialize(updated);
}

export async function removeListing(id, user) {
  const listings = await listingsCollection();
  const listing = await findOwnedListing(listings, id, user);
  const {matchedCount} = await listings.updateOne(stillChangeable(listing), {
    $set: {status: 'removed', updatedAt: new Date()}
  });
  if (matchedCount === 0) throw new HttpError(409, LOCKED);
}

export function cardListing(listing) {
  const photo = listing.photos?.[0] ?? null;
  return {
    id: listing._id.toString(),
    title: listing.title,
    price: listing.price,
    condition: listing.condition ?? null,
    category: listing.category ?? null,
    zip: listing.zip ?? null,
    saleType: listing.saleType,
    startsAt: listing.startsAt ?? null,
    endsAt: listing.endsAt ?? null,
    currentBid: listing.currentBid ?? null,
    photo: photo ? {thumb: photo.thumb ?? null, card: photo.card ?? null} : null
  };
}

export async function getNewestListings(limit = 24) {
  const listings = await listingsCollection();
  const docs = await listings
    .find(forSale(new Date()))
    .project(CARD_FIELDS)
    .sort({createdAt: -1, _id: -1})
    .limit(limit)
    .toArray();
  return docs.map(cardListing);
}

export async function getAuctionsEndingSoon(limit = 4) {
  const listings = await listingsCollection();
  const now = new Date();
  const docs = await listings
    .find({
      saleType: 'auction',
      status: 'active',
      endsAt: {$gt: now},
      $or: [{startsAt: null}, {startsAt: {$lte: now}}]
    })
    .project(CARD_FIELDS)
    .sort({endsAt: 1, _id: 1})
    .limit(limit)
    .toArray();
  return docs.map(cardListing);
}

export async function getActiveCategories(limit = 12) {
  const listings = await listingsCollection();
  const groups = await listings
    .aggregate([
      {$match: {...forSale(new Date()), category: {$type: 'string', $ne: ''}}},
      {$group: {_id: '$category', count: {$sum: 1}}},
      {$sort: {count: -1, _id: 1}},
      {$limit: limit}
    ])
    .toArray();
  return groups.map((group) => ({category: group._id, count: group.count}));
}
