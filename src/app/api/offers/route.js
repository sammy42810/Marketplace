import {withUser} from '@/lib/server/auth';
import {listOffers} from '@/lib/server/offers';

export const runtime = 'nodejs';

export const GET = withUser(async (request, context, user) =>
  Response.json({offers: await listOffers(request.nextUrl.searchParams.get('listingId'), user)})
);
