import {withUser} from '@/lib/server/auth';
import {listNotifications} from '@/lib/server/notifications';

export const runtime = 'nodejs';

export const GET = withUser(async (request, context, user) => {
  const before = request.nextUrl.searchParams.get('before');
  return Response.json(await listNotifications(user._id, before));
});
