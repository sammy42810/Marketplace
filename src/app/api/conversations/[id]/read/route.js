import {withUser} from '@/lib/server/auth';
import {markRead} from '@/lib/server/chat';

export const runtime = 'nodejs';

export const POST = withUser(async (request, context, user) => {
  const {id} = await context.params;
  return Response.json(await markRead(id, user._id));
});
