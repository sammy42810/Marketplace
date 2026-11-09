import {withErrors, withUser} from '@/lib/server/auth';
import {browseListings, createListing} from '@/lib/server/listings';

export const GET = withErrors(async (request) =>
  Response.json(await browseListings(request.nextUrl.searchParams))
);

export const POST = withUser(async (request, context, user) => {
  const body = await request.json().catch(() => null);
  return Response.json({listing: await createListing(body, user)}, {status: 201});
});
