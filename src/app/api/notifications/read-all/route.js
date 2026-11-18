import {withUser} from '@/lib/server/auth';
import {markAllNotificationsRead} from '@/lib/server/notifications';

export const runtime = 'nodejs';

export const POST = withUser(async (request, context, user) =>
  Response.json(await markAllNotificationsRead(user._id))
);
