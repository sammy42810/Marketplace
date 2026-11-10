import { MongoClient } from "mongodb";

// Cached on globalThis so dev hot reloads and server.js reuse one connection pool.
const cache = globalThis;

// expose the mongo client so the bidding endpoint can use transactions
// now the listing update and bid insertion will succeed or fail together before there 
// was a consistency issue
export async function getMongoClient() {
  if (!cache.marketplaceMongo) {
    const url = process.env.MONGO_URL;

    if (!url)
      throw new Error("MONGO_URL is not set. Copy .env.example to .env.local.");

    cache.marketplaceMongo = new MongoClient(url).connect().catch((error) => {
      // Let the next request try again instead of reusing a failed connection.
      cache.marketplaceMongo = null;
      throw error;
    });
  }

  return cache.marketplaceMongo;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGO_DB_NAME || "marketplace");
}