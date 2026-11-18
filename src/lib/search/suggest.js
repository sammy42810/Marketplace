import {HttpError} from '../server/auth.js';
import {LISTINGS_INDEX} from './mapping.js';

const MIN_QUERY = 2;
const MAX_QUERY = 100;
const MAX_SUGGESTIONS = 6;

// Titles only: a match in the description would suggest a title that doesn't contain what was typed.
const TITLE_FIELDS = ['title.autocomplete', 'title.autocomplete._2gram', 'title.autocomplete._3gram'];

// GET /api/search/suggest?q= returns active listings whose title starts with, or has a word
// starting with, the typed text. The Elasticsearch document _id is the listing's MongoDB _id.
export async function suggestListings(value) {
  const query = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (query.length < MIN_QUERY) return [];
  if (query.length > MAX_QUERY) throw new HttpError(400, `Search text must be ${MAX_QUERY} characters or fewer.`);

  const url = `${process.env.ELASTICSEARCH_URL?.replace(/\/$/, '')}/${LISTINGS_INDEX}/_search`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        size: MAX_SUGGESTIONS,
        _source: ['title'],
        query: {
          bool: {
            must: {multi_match: {query, type: 'bool_prefix', fields: TITLE_FIELDS}},
            filter: {term: {status: 'active'}}
          }
        }
      })
    });
  } catch (error) {
    console.error('Elasticsearch is unreachable:', error.message);
    throw new HttpError(503, 'Suggestions are unavailable right now.');
  }
  if (!response.ok) {
    console.error(`Elasticsearch suggest failed: ${response.status} ${await response.text()}`);
    throw new HttpError(503, 'Suggestions are unavailable right now.');
  }

  const {hits} = await response.json();
  return hits.hits.map((hit) => ({_id: hit._id, title: hit._source.title}));
}
