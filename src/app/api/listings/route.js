import {withErrors, withUser} from '@/lib/server/auth';
import {browseListings, createListing} from '@/lib/server/listings';
import {rateLimit} from '@/lib/server/rateLimit';

export const GET = withErrors(async (request) =>
  Response.json(await browseListings(request.nextUrl.searchParams))
);

export const POST = withUser(async (request, context, user) => {
  // New listings show up in everyone's feed, so one account can't flood it.
  rateLimit('create-listing', user._id, {
    limit: 10,
    windowMs: 10 * 60_000,
    message: 'You are creating listings too fast. Wait a few minutes and try again.'
  });
  const body = await request.json().catch(() => null);
  return Response.json({listing: await createListing(body, user)}, {status: 201});
});
