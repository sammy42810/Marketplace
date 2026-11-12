import {withUser} from '@/lib/server/auth';
import {listConversations, startConversation} from '@/lib/server/chat';

export const runtime = 'nodejs';

export const GET = withUser(async (request, context, user) =>
  Response.json({conversations: await listConversations(user._id)})
);

export const POST = withUser(async (request, context, user) => {
  const body = await request.json().catch(() => null);
  return Response.json({conversation: await startConversation(body?.listingId, user._id)});
});
