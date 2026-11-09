import {withErrors, withUser} from '@/lib/server/auth';
import {getListing, removeListing, updateListing} from '@/lib/server/listings';

export const GET = withErrors(async (request, context) => {
  const {id} = await context.params;
  return Response.json({listing: await getListing(id)});
});

export const PATCH = withUser(async (request, context, user) => {
  const {id} = await context.params;
  const body = await request.json().catch(() => null);
  return Response.json({listing: await updateListing(id, body, user)});
});

export const DELETE = withUser(async (request, context, user) => {
  const {id} = await context.params;
  await removeListing(id, user);
  return Response.json({ok: true});
});
