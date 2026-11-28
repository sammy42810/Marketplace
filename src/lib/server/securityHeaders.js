// Imported by server.js, which runs unbundled: relative imports only, no "@/".
import { randomBytes } from "node:crypto";

// Scripts only run if they carry this request's nonce, or were loaded by a script that did
// ('strict-dynamic'). That covers Next.js chunks and the script Firebase loads for Google sign-in,
// so injected <script> tags and inline event handlers are blocked.
function contentSecurityPolicy(nonce, dev) {
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const directives = {
    "default-src": ["'self'"],
    // React needs eval in development only, to rebuild error stacks.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    // CSS modules are files, but React style={...} props and dev hot reload need inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Google account photos for users who signed in with Google; blob: for photo previews.
    "img-src": ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
    "font-src": ["'self'"],
    // 'self' also covers the Socket.io WebSocket. Firebase Auth calls identitytoolkit and securetoken.
    "connect-src": ["'self'", "https://*.googleapis.com"],
    // Google sign-in runs a hidden iframe from the Firebase auth domain.
    "frame-src": authDomain ? [`https://${authDomain}`] : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function applySecurityHeaders(req, res, { dev }) {
  const policy = contentSecurityPolicy(randomBytes(16).toString("base64"), dev);

  // Next.js reads the nonce from the request's CSP header and adds it to every script it
  // renders. Overwrite whatever the client sent, so only our nonce is ever used.
  req.headers["content-security-policy"] = policy;
  delete req.headers["content-security-policy-report-only"];

  res.setHeader("Content-Security-Policy", policy);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // The Google sign-in popup has to report back to this window.
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
}
