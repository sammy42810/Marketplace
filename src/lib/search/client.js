import { LISTINGS_INDEX, LISTINGS_MAPPING } from "./mapping.js";

export async function ensureListingsIndex() {
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL;

  if (!elasticsearchUrl) {
    throw new Error("ELASTICSEARCH_URL is not configured.");
  }

  const url = `${elasticsearchUrl.replace(/\/$/, "")}/${LISTINGS_INDEX}`;

  // check if the index already exists
  let response = await fetch(url, { method: "HEAD" });

  if (response.ok) return;

  if (response.status !== 404) {
    throw new Error(`Could not check Elasticsearch index: ${response.status}`);
  }

  // create the index with the listing mapping
  response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LISTINGS_MAPPING),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Elasticsearch index: ${response.status} ${await response.text()}`,
    );
  }

  console.log("Elasticsearch listings index created.");
}
