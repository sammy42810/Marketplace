// Firebase projects have email-enumeration protection on by default, so a wrong email
// and a wrong password both come back as auth/invalid-credential.
const messages = {
  'auth/email-already-in-use': 'An account with that email already exists. Log in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in the Firebase console.',
  'auth/unauthorized-domain': 'This domain is not on the Firebase authorized domains list.'
};

export function authErrorMessage(error) {
  // The user closed the Google window themselves.
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return null;
  return messages[error?.code] ?? 'Something went wrong. Try again.';
}

// Only same-site paths, so ?next= can't send someone to another site after login.
export function safeNextPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
