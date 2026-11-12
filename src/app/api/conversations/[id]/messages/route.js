import {withUser} from '@/lib/server/auth';
import {listMessages} from '@/lib/server/chat';

export const runtime = 'nodejs';

export const GET = withUser(async (request, context, user) => {
  const {id} = await context.params;
  const before = request.nextUrl.searchParams.get('before');
  return Response.json(await listMessages(id, user._id, before));
});
