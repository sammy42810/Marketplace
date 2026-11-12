import {withUser} from '@/lib/server/auth';
import {updateOffer} from '@/lib/server/offers';

export const runtime = 'nodejs';

export const PATCH = withUser(async (request, context, user) => {
  const {id} = await context.params;
  const body = await request.json().catch(() => null);
  return Response.json({offer: await updateOffer(id, body, user)});
});
