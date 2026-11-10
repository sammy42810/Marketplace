import nextEnv from '@next/env';
import {getAdminAuth} from '../src/lib/server/firebaseAdmin.js';
import {getDb} from '../src/lib/server/mongo.js';
import {findOrCreateUser} from '../src/lib/server/users.js';

nextEnv.loadEnvConfig(process.cwd(), true);

const PASSWORD = 'marketplace-seed-554';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PEOPLE = [
  ['Priya Raman', 'priya'],
  ['Marcus Bell', 'marcus'],
  ['Elena Ortiz', 'elena'],
  ['Jonah Kim', 'jonah'],
  ['Amara Okafor', 'amara'],
  ['Theo Novak', 'theo']
];

const PLACES = [
  ['07030', -74.03, 40.74], // Hoboken
  ['07302', -74.05, 40.72], // Jersey City
  ['10001', -74.0, 40.75], // Manhattan
  ['11201', -73.99, 40.69], // Brooklyn
  ['07102', -74.17, 40.73], // Newark
  ['07601', -74.04, 40.89] // Hackensack
];

const FOR_OFFER = [
  ['MacBook Air M2, 13 inch', 'electronics', 'like-new', 780, '8GB/256GB, battery cycle count 41. Comes with the original charger and box.'],
  ['Sony WH-1000XM5 headphones', 'electronics', 'good', 210, 'Noise cancelling works perfectly. Small scuff on the left ear cup.'],
  ['Nintendo Switch OLED', 'electronics', 'good', 240, 'White model with dock and both Joy-Cons. No drift.'],
  ['Dell 27 inch 1440p monitor', 'electronics', 'good', 150, 'USB-C input, height-adjustable stand. No dead pixels.'],
  ['IKEA Malm queen bed frame', 'furniture', 'good', 120, 'Oak veneer, already disassembled. All hardware is bagged and labelled.'],
  ['Mid-century walnut desk', 'furniture', 'fair', 175, 'Solid walnut, 48 inches wide. Some ring marks on top, drawers slide well.'],
  ['Herman Miller Aeron, size B', 'furniture', 'good', 520, 'Fully adjustable arms and lumbar. Mesh has no tears.'],
  ['Calculus: Early Transcendentals, 9th ed.', 'textbooks', 'good', 45, 'Stewart. Light highlighting in chapters 1 to 4, no writing.'],
  ['Introduction to Algorithms, 4th ed.', 'textbooks', 'like-new', 60, 'CLRS hardcover. Used for one semester and barely opened.'],
  ['Campbell Biology, 12th ed.', 'textbooks', 'fair', 35, 'Cover is worn and the spine is creased. All pages are intact.'],
  ['Patagonia Better Sweater, men\'s M', 'clothing', 'like-new', 65, 'Navy fleece, worn a handful of times.'],
  ['Levi\'s trucker jacket, women\'s S', 'clothing', 'good', 40, 'Classic medium wash denim. No rips or stains.'],
  ['Two tickets: Knicks vs. Celtics', 'tickets', 'new', 260, 'Section 214, row 8, seats together. Transferred through the official app.'],
  ['Concert ticket at Terminal 5', 'tickets', 'new', 55, 'General admission. Can\'t make the date anymore.'],
  ['Trek FX 2 hybrid bike', 'sports', 'good', 340, 'Medium frame, new brake pads this spring. Rides great on city streets.'],
  ['Adjustable dumbbells, 5 to 52 lb', 'sports', 'good', 190, 'Bowflex-style pair with stands. Selector dials click cleanly.'],
  ['Dyson V8 cordless vacuum', 'home', 'fair', 130, 'Battery holds about 20 minutes. Includes the wall mount and two heads.'],
  ['Instant Pot Duo, 6 quart', 'home', 'like-new', 50, 'Used twice. Includes the steam rack and manual.']
];

const SOLD_OFFERS = [
  ['Kindle Paperwhite, 11th gen', 'electronics', 'good', 85, '8GB, no ads. Includes a fabric cover.'],
  ['Bookshelf, 5 tier', 'furniture', 'good', 45, 'Black metal frame with wood shelves.']
];

const AUCTIONS = [
  // [title, category, condition, start price, increment, description, startOffset, endOffset, number of bids]
  ['Vintage Fender Stratocaster, 1994', 'other', 'good', 600, 25, 'Made in Mexico, sunburst finish. Recently set up with new strings.', -2 * DAY, 45 * 60 * 1000, 5],
  ['Canon EOS R6 body', 'electronics', 'like-new', 900, 20, 'Shutter count under 6,000. Includes two batteries and the charger.', -DAY, 5 * HOUR, 3],
  ['Signed Derek Jeter baseball', 'other', 'good', 150, 10, 'Comes in a display case with a certificate of authenticity.', -DAY, DAY, 2],
  ['Eames-style lounge chair', 'furniture', 'fair', 300, 15, 'Reproduction with black leather. Some wear on the armrests.', -6 * HOUR, 2 * DAY, 0],
  ['Super Nintendo with 6 games', 'electronics', 'fair', 80, 5, 'Includes Super Mario World and two controllers. Tested and working.', -3 * HOUR, 3 * DAY, 0],
  ['Rolex Oysterdate, 1978', 'other', 'good', 1800, 50, 'Serviced last year. Original bracelet, no box or papers.', DAY, 4 * DAY, 0],
  ['Limited run Air Jordan 1s, size 10', 'clothing', 'new', 220, 10, 'Unworn and still in the original box with the receipt.', 3 * HOUR, 2 * DAY, 0],
  ['Antique oak writing desk', 'furniture', 'fair', 250, 10, 'Around 1920, with brass pulls. Top has been refinished.', -5 * DAY, -2 * DAY, 4],
  ['PlayStation 5 disc edition', 'electronics', 'good', 300, 10, 'Includes one controller and the HDMI cable.', -4 * DAY, -DAY, 3],
  ['Framed Hoboken skyline print', 'home', 'new', 40, 5, 'Limited print, 18 by 24 inches, in a black frame.', -3 * DAY, -6 * HOUR, 0]
];

async function ensureSeedUser([name, slug]) {
  const auth = getAdminAuth();
  const email = `${slug}.seed@example.com`;
  const fields = {displayName: name, password: PASSWORD, emailVerified: true};
  const account = await auth.getUserByEmail(email).then(
    (existing) => auth.updateUser(existing.uid, fields),
    (error) => {
      if (error.code !== 'auth/user-not-found') throw error;
      return auth.createUser({...fields, email});
    }
  );
  return findOrCreateUser({uid: account.uid, email, email_verified: true, name});
}

function baseListing([title, category, condition, price, description], index, users, now) {
  const [zip, longitude, latitude] = PLACES[index % PLACES.length];
  const createdAt = new Date(now - index * 5 * HOUR);
  return {
    sellerId: users[index % users.length]._id,
    title,
    description,
    category,
    condition,
    price,
    saleType: 'offer',
    photos: [],
    zip,
    location: {type: 'Point', coordinates: [longitude, latitude]},
    status: 'active',
    startsAt: null,
    endsAt: null,
    minIncrement: null,
    currentBid: null,
    currentBidder: null,
    createdAt,
    updatedAt: createdAt
  };
}

function buildAuction(row, index, users, now) {
  const [title, category, condition, price, minIncrement, description, startOffset, endOffset, bidCount] = row;
  const listing = {
    ...baseListing([title, category, condition, price, description], index, users, now),
    saleType: 'auction',
    startsAt: new Date(now + startOffset),
    endsAt: new Date(now + endOffset),
    minIncrement
  };

  const bidders = users.filter((user) => !user._id.equals(listing.sellerId));
  const biddingEnds = Math.min(now, now + endOffset) - HOUR;
  const bids = Array.from({length: bidCount}, (_, i) => ({
    bidderId: bidders[i % bidders.length]._id,
    amount: price + minIncrement * (i + 1),
    createdAt: new Date(biddingEnds - (bidCount - i) * HOUR)
  }));

  const last = bids.at(-1);
  if (last) {
    listing.currentBid = last.amount;
    listing.currentBidder = last.bidderId;
    if (endOffset < 0) listing.status = 'sold';
  }
  return {listing, bids};
}

async function seed() {
  const users = [];
  for (const person of PEOPLE) users.push(await ensureSeedUser(person));
  const userIds = users.map((user) => user._id);

  const db = await getDb();
  const listings = db.collection('listings');
  const bids = db.collection('bids');

  // Only seed accounts' data is replaced, so listings people made by hand survive a re-run.
  const old = await listings.find({sellerId: {$in: userIds}}, {projection: {_id: 1}}).toArray();
  await bids.deleteMany({listingId: {$in: old.map((listing) => listing._id)}});
  await listings.deleteMany({sellerId: {$in: userIds}});

  const now = Date.now();
  const offers = FOR_OFFER.map((row, index) => baseListing(row, index, users, now));
  const sold = SOLD_OFFERS.map((row, index) => ({
    ...baseListing(row, FOR_OFFER.length + index, users, now),
    status: 'sold'
  }));
  const auctions = AUCTIONS.map((row, index) => buildAuction(row, offers.length + sold.length + index, users, now));

  await listings.insertMany([...offers, ...sold]);
  for (const auction of auctions) {
    const {insertedId} = await listings.insertOne(auction.listing);
    if (auction.bids.length > 0) {
      await bids.insertMany(auction.bids.map((bid) => ({...bid, listingId: insertedId})));
    }
  }

  const bidTotal = auctions.reduce((sum, auction) => sum + auction.bids.length, 0);
  console.log(`Seeded ${users.length} users, ${offers.length + sold.length + auctions.length} listings, ${bidTotal} bids.`);
  console.log(`Log in as ${PEOPLE[0][1]}.seed@example.com with password ${PASSWORD}.`);
}

seed().then(
  () => process.exit(0),
  (error) => {
    console.error(`Seed failed: ${error.message}`);
    console.error('Check that Docker is running (docker compose up -d) and .env.local is filled in.');
    process.exit(1);
  }
);
