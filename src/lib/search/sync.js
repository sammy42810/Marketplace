import {LISTINGS_INDEX} from './mapping.js';
import {ensureListingsIndex} from './client.js';

function indexUrl() {
  const url = process.env.ELASTICSEARCH_URL;

  if (!url) {
    throw new Error('ELASTICSEARCH_URL is not configured.');
  }

  return `${url.replace(/\/$/, '')}/${LISTINGS_INDEX}`;
}

export function listingDocument(listing) {
  return {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition,
    saleType: listing.saleType,
    status: listing.status,
    price: listing.price,
    location: listing.location?.coordinates ?? null,
    createdAt: listing.createdAt
  };
}

export async function indexListing(listing) {
  await ensureListingsIndex();

  const response = await fetch(
    `${indexUrl()}/_doc/${listing._id}?refresh=wait_for`,
    {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(listingDocument(listing))
    }
  );

  if (!response.ok) {
    throw new Error(`Indexing failed: ${await response.text()}`);
  }
}

export async function removeListingFromIndex(id) {
  const response = await fetch(
    `${indexUrl()}/_doc/${id}?refresh=wait_for`,
    {method: 'DELETE'}
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Index removal failed: ${await response.text()}`);
  }
}

export async function syncListing(listing) {
  try {
    if (listing.status === 'removed') {
      await removeListingFromIndex(listing._id);
    } else {
      await indexListing(listing);
    }
  } catch (error) {
    console.error('Listing sync failed:', error.message);
  }
}
