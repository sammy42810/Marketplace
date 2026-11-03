import {FirebaseConfigError, getAdminAuth} from './firebaseAdmin.js';
import {findOrCreateUser} from './users.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Unverified emails get a 403 unless the route passes {verified: false}.
export async function requireUser(request, {verified = true} = {}) {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new HttpError(401, 'Sign in to do that.');

  // Outside the try: a missing Firebase config is our bug, not an expired session.
  const adminAuth = getAdminAuth();
  let token;
  try {
    token = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }

  if (verified && !token.email_verified) {
    throw new HttpError(403, 'Verify your email address first. Check your inbox for the link.');
  }
  return findOrCreateUser(token);
}

// export const POST = withUser(async (request, context, user) => { ... });
export function withUser(handler, options) {
  return async (request, context) => {
    try {
      const user = await requireUser(request, options);
      return await handler(request, context, user);
    } catch (error) {
      if (error instanceof HttpError) return Response.json({error: error.message}, {status: error.status});
      console.error(error);
      const message =
        error instanceof FirebaseConfigError ? 'Sign-in is not configured on the server.' : 'Something went wrong.';
      return Response.json({error: message}, {status: 500});
    }
  };
}
