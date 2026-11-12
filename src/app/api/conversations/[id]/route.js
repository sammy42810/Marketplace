import {withUser} from '@/lib/server/auth';
import {getConversation} from '@/lib/server/chat';

export const runtime = 'nodejs';

export const GET = withUser(async (request, context, user) => {
  const {id} = await context.params;
  return Response.json({conversation: await getConversation(id, user._id)});
});
