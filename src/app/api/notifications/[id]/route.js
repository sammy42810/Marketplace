import {withUser} from '@/lib/server/auth';
import {markNotificationRead} from '@/lib/server/notifications';

export const runtime = 'nodejs';

export const PATCH = withUser(async (request, context, user) => {
  const {id} = await context.params;
  const body = await request.json().catch(() => null);
  return Response.json({notification: await markNotificationRead(id, body, user._id)});
});
