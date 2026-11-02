import {MongoClient} from 'mongodb';

// Cached on globalThis so dev hot reloads and server.js reuse one connection pool.
const cache = globalThis;

export async function getDb() {
  if (!cache.marketplaceMongo) {
    const url = process.env.MONGO_URL;
    if (!url) throw new Error('MONGO_URL is not set. Copy .env.example to .env.local.');
    cache.marketplaceMongo = new MongoClient(url).connect().catch((error) => {
      // Let the next request try again instead of reusing a failed connection.
      cache.marketplaceMongo = null;
      throw error;
    });
  }
  const client = await cache.marketplaceMongo;
  return client.db(process.env.MONGO_DB_NAME || 'marketplace');
}
