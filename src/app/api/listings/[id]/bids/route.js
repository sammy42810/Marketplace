import { ObjectId } from "mongodb";
import { HttpError, withUser } from "@/lib/server/auth";
import { getDb, getMongoClient } from "@/lib/server/mongo";

export const runtime = "nodejs";

const LIMIT = 5;
const WINDOW_MS = 10000;
const bidAttempts = (globalThis.marketplaceBidAttempts ??= new Map());

// limit each user to 5 bid attempts every 10s
function checkRateLimit(userId) {
  const now = Date.now();
  const attempts = (bidAttempts.get(userId) ?? []).filter(
    (time) => now - time < WINDOW_MS,
  );

  if (attempts.length >= LIMIT) {
    throw new HttpError(
      429,
      "Too many bids. Please try again in a few seconds.",
    );
  }

  attempts.push(now);
  bidAttempts.set(userId, attempts);
}

function minimumBid(listing) {
  const current = listing.currentBid ?? listing.price;
  return Math.round((current + listing.minIncrement) * 100) / 100;
}

// check why a bid was rejected and return the reason
async function notifyRejectedBid(listings, listingId, userId, amount, now) {
  const listing = await listings.findOne({ _id: listingId });

  if (!listing) throw new HttpError(404, "Listing not found.");

  if (listing.saleType !== "auction" || listing.status !== "active") {
    throw new HttpError(409, "This auction is not live.");
  }

  if (listing.startsAt && listing.startsAt > now) {
    throw new HttpError(409, "This auction has not started yet.");
  }

  if (!(listing.endsAt instanceof Date) || listing.endsAt <= now) {
    throw new HttpError(409, "This auction has ended.");
  }

  if (String(listing.sellerId) === String(userId)) {
    throw new HttpError(403, "You cannot bid on your own listing.");
  }

  if (
    !Number.isFinite(listing.price) ||
    !Number.isFinite(listing.minIncrement) ||
    listing.minIncrement <= 0
  ) {
    throw new HttpError(409, "This auction is not configured for bidding yet.");
  }

  if (amount < minimumBid(listing)) {
    throw new HttpError(
      409,
      `Bid must be at least $${minimumBid(listing).toFixed(2)}.`,
    );
  }

  throw new HttpError(409, "Bid could not be accepted. Please try again.");
}

export const POST = withUser(async (request, context, user) => {
  const { id } = await context.params;

  if (typeof id !== "string" || !/^[0-9a-f]{24}$/i.test(id)) {
    throw new HttpError(400, "Invalid listing ID.");
  }

  checkRateLimit(user._id.toString());

  const body = await request.json().catch(() => null);
  const amount = body?.amount;

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000 ||
    Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6
  ) {
    throw new HttpError(
      400,
      "Amount must be a positive number with at most two decimal places.",
    );
  }

  const listingId = new ObjectId(id);
  const db = await getDb();
  const client = await getMongoClient();
  const listings = db.collection("listings");
  const now = new Date();

  const session = client.startSession();
  let transactionResult;

  try {
    // update the highest bid and save the bid together in a transaction
    transactionResult = await session.withTransaction(
      async () => {
        const previousListing = await listings.findOneAndUpdate(
          {
            _id: listingId,
            saleType: "auction",
            status: "active",
            endsAt: { $gt: now },
            $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
            sellerId: { $ne: user._id },
            price: { $type: "number" },
            minIncrement: { $type: "number", $gt: 0 },
            $expr: {
              $gte: [
                amount,
                {
                  $round: [
                    {
                      $add: [
                        { $ifNull: ["$currentBid", "$price"] },
                        "$minIncrement",
                      ],
                    },
                    2,
                  ],
                },
              ],
            },
          },
          {
            $set: {
              currentBid: amount,
              currentBidder: user._id,
              updatedAt: now,
            },
          },
          { returnDocument: "before", session },
        );

        if (!previousListing) return null;

        // save the accepted bid in the same transaction
        const bid = {
          listingId,
          bidderId: user._id,
          amount,
          createdAt: now,
        };

        const res = await db.collection("bids").insertOne(bid, { session });

        return { previousListing, res };
      },
      { writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }

  if (!transactionResult) {
    await notifyRejectedBid(listings, listingId, user._id, amount, now);
  }

  const { previousListing, res } = transactionResult;

  const io = globalThis.marketplaceIo;

  if (io) {
    const listingIdString = listingId.toString();

    // notify everyone viewing this auction
    io.to(`auction:${listingIdString}`).emit("auction:bid", {
      listingId: listingIdString,
      amount,
      bidderId: user._id.toString(),
    });

    // notify the previous highest bidder of new bid
    const previousBidderId = previousListing.currentBidder;

    if (previousBidderId && String(previousBidderId) !== String(user._id)) {
      try {
        const previousBidder = await db
          .collection("users")
          .findOne(
            { _id: previousBidderId },
            { projection: { firebaseUid: 1 } },
          );

        if (previousBidder?.firebaseUid) {
          io.to(`user:${previousBidder.firebaseUid}`).emit("outbid", {
            listingId: listingIdString,
            amount,
          });
        }
      } catch (error) {
        console.error("Could not send outbid notification:", error);
      }
    }
  }

  return Response.json(
    {
      bid: {
        _id: res.insertedId.toString(),
        listingId: listingId.toString(),
        bidderId: user._id.toString(),
        amount,
        createdAt: now.toISOString(),
      },
      currentBid: amount,
    },
    { status: 201 },
  );
});
