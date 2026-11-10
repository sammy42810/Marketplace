import {withErrors} from '@/lib/server/auth';
import {getProfile} from '@/lib/server/profiles';

export const GET = withErrors(async (request, context) => {
  const {id} = await context.params;
  return Response.json({user: await getProfile(id)});
});
