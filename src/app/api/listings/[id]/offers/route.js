import {withUser} from '@/lib/server/auth';
import {listOffers, makeOffer} from '@/lib/server/offers';

export const runtime = 'nodejs';

export const POST = withUser(async (request, context, user) => {
  const {id} = await context.params;
  const body = await request.json().catch(() => null);
  return Response.json({offer: await makeOffer(id, body, user)}, {status: 201});
});

export const GET = withUser(async (request, context, user) => {
  const {id} = await context.params;
  return Response.json({offers: await listOffers(id, user)});
});
