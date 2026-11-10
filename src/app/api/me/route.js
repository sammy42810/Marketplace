import {withUser} from '@/lib/server/auth';
import {updateProfile} from '@/lib/server/profiles';
import {publicUser} from '@/lib/server/users';

// The signed-in user's own record. Unverified users may read it, so the UI can
// tell them to verify their email.
export const GET = withUser(async (request, context, user) => Response.json({user: publicUser(user)}), {
  verified: false
});

export const PATCH = withUser(async (request, context, user) => {
  const body = await request.json().catch(() => null);
  return Response.json({user: await updateProfile(user, body)});
});
