import { ObjectId } from "mongodb";
import { HttpError, withUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongo";

export const runtime = "nodejs";

export const POST = withUser(async (request, context, user) => {
  const { id } = await context.params;

  if (typeof id !== "string" || !/^[0-9a-f]{24}$/i.test(id)) {
    throw new HttpError(400, "Invalid listing ID.");
  }

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

  const db = await getDb();
  const listingId = new ObjectId(id);

  const listing = await db.collection("listings").findOne({
    _id: listingId,
    status: { $ne: "removed" },
  });

  if (!listing) throw new HttpError(404, "Listing not found.");

  if (listing.saleType !== "offer") {
    throw new HttpError(400, "This listing does not accept offers.");
  }

  if (listing.status !== "active") {
    throw new HttpError(409, "This listing is no longer available.");
  }

  if (String(listing.sellerId) === String(user._id)) {
    throw new HttpError(403, "You cannot make an offer on your own listing.");
  }

  const now = new Date();

  const offer = {
    listingId,
    buyerId: user._id,
    amount,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("offers").insertOne(offer);

  return Response.json(
    {
      offer: {
        _id: result.insertedId.toString(),
        listingId: listingId.toString(),
        buyerId: user._id.toString(),
        amount,
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
    { status: 201 },
  );
});