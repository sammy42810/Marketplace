import { getDb, getMongoClient } from "./mongo.js";
import { createNotification, emitSavedNotification } from "./notifications.js";

export async function runAuctionJob() {
  const db = await getDb();
  const client = await getMongoClient();
  const listings = db.collection("listings");
  const now = new Date();

  // start auctions that have reached their start time
  await listings.updateMany(
    {
      saleType: "auction",
      status: "scheduled",
      startsAt: { $lte: now },
    },
    {
      $set: { status: "active", updatedAt: now },
    },
  );

  // find auctions that have ended
  const expired = await listings
    .find({
      saleType: "auction",
      status: "active",
      endsAt: { $lte: now },
    })
    .sort({ endsAt: 1 })
    .limit(50)
    .toArray();

  for (const auction of expired) {
    const session = client.startSession();

    try {
      const notifications = await session.withTransaction(
        async () => {
          const listing = await listings.findOne(
            {
              _id: auction._id,
              saleType: "auction",
              status: "active",
              endsAt: { $lte: new Date() },
            },
            { session },
          );

          if (!listing) return null;

          const winner = listing.currentBidder;
          const finishedAt = new Date();

          const changes = {
            status: winner ? "sold" : "ended",
            updatedAt: finishedAt,
          };

          if (winner) {
            changes.buyerId = winner;
            changes.soldPrice = listing.currentBid;
            changes.soldAt = finishedAt;
          }

          const result = await listings.updateOne(
            { _id: listing._id, status: "active" },
            { $set: changes },
            { session },
          );

          if (result.modifiedCount === 0) return null;

          const saved = [];

          const notify = async (userId, type, message) => {
            const notification = await createNotification({
              userId,
              type,
              listingId: listing._id,
              actorId: null,
              message,
              session,
            });

            if (notification) saved.push(notification);
          };

          if (winner) {
            await notify(
              winner,
              "auction_won",
              `You won "${listing.title}" for $${listing.currentBid.toFixed(2)}.`,
            );
          }

          await notify(
            listing.sellerId,
            "auction_ended",
            winner
              ? `"${listing.title}" sold for $${listing.currentBid.toFixed(2)}.`
              : `"${listing.title}" ended without any bids.`,
          );

          const bidders = await db
            .collection("bids")
            .distinct("bidderId", { listingId: listing._id }, { session });

          for (const bidderId of bidders) {
            if (winner && bidderId.equals(winner)) continue;

            await notify(
              bidderId,
              "auction_ended",
              `"${listing.title}" has ended. You did not win the auction.`,
            );
          }

          return saved;
        },
        { writeConcern: { w: "majority" } },
      );

      // send live notifications only after the transaction commits
      for (const notification of notifications ?? []) {
        emitSavedNotification(notification);
      }
    } finally {
      await session.endSession();
    }
  }
}
