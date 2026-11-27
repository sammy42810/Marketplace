import nextEnv from '@next/env';
import {getDb} from '../src/lib/server/mongo.js';
import {LISTINGS_INDEX} from '../src/lib/search/mapping.js';
import {ensureListingsIndex} from '../src/lib/search/client.js';
import {indexListing} from '../src/lib/search/sync.js';

nextEnv.loadEnvConfig(process.cwd(), true);

async function reindex() {
  const url = process.env.ELASTICSEARCH_URL;

  if (!url) {
    throw new Error('ELASTICSEARCH_URL is not configured.');
  }

  const response = await fetch(
    `${url.replace(/\/$/, '')}/${LISTINGS_INDEX}`,
    {method: 'DELETE'}
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete index: ${await response.text()}`);
  }

  await ensureListingsIndex();

  const db = await getDb();
  const listings = db.collection('listings').find({
    status: {$ne: 'removed'}
  });

  let count = 0;

  for await (const listing of listings) {
    await indexListing(listing);
    count++;
  }

  console.log(`Successfully reindexed ${count} listings.`);
}

reindex()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reindex failed:', error);
    process.exit(1);
  });