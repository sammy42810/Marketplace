import { LISTINGS_INDEX, LISTINGS_MAPPING } from "./mapping.js";

// `docker compose up -d` returns before Elasticsearch can answer (up to a minute on a
// fresh start), so server.js waits here instead of crashing with a bare "fetch failed".
export async function waitForElasticsearch({ timeoutMs = 120_000 } = {}) {
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL?.replace(/\/$/, "");

  if (!elasticsearchUrl) {
    throw new Error("ELASTICSEARCH_URL is not configured. Copy .env.example to .env.local.");
  }

  const deadline = Date.now() + timeoutMs;
  let lastProblem = "no answer";
  let announced = false;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `${elasticsearchUrl}/_cluster/health?wait_for_status=yellow&timeout=5s`,
      );
      if (response.ok) return;
      lastProblem = `answered ${response.status}`;
    } catch (error) {
      lastProblem = error.cause?.code ?? error.message;
    }

    if (!announced) {
      console.log(`Waiting for Elasticsearch at ${elasticsearchUrl} ...`);
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Elasticsearch at ${elasticsearchUrl} is not ready (${lastProblem}). ` +
      "Check that Docker is running, then run: docker compose up -d --wait",
  );
}

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
