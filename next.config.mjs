/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep these as normal Node packages instead of bundling them, so Next.js route
  // handlers and server.js share one copy (one Firebase Admin app, one MongoDB client).
  serverExternalPackages: ['firebase-admin', 'mongodb']
};

export default nextConfig;
