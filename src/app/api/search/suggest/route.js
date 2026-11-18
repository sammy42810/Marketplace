import {withErrors} from '@/lib/server/auth';
import {suggestListings} from '@/lib/search/suggest';

export const runtime = 'nodejs';

export const GET = withErrors(async (request) =>
  Response.json({suggestions: await suggestListings(request.nextUrl.searchParams.get('q'))})
);
