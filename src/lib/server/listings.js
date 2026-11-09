import {getDb} from './mongo.js';

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

async function listingsCollection() {
  const listings = (await getDb()).collection('listings');
  if (!globalThis.marketplaceListingIndexes) {
    globalThis.marketplaceListingIndexes = Promise.all([
      listings.createIndex({status: 1, createdAt: -1}),
      listings.createIndex({saleType: 1, status: 1, endsAt: 1}),
      listings.createIndex({status: 1, category: 1})
    ]).catch((error) => {
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
