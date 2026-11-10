# CS 554 - Final Project: Marketplace

A local marketplace for buying, selling, trading and auctioning used items.
Next.js and Socket.io run together on one Node server (`server.js`); MongoDB,
Elasticsearch and ImageMagick run in Docker.

## Setup

Needs Node.js 20.9+ and Docker Desktop with at least 4 GB of memory.

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase values (ask the group)
docker compose up -d         # first run downloads about 1 GB
npm run seed
npm run dev
```

`npm run seed` creates six accounts and 30 listings, including auctions that are upcoming, live
and closed. Log in with `priya.seed@example.com` (or marcus, elena, jonah, amara, theo) and the
password `marketplace-seed-554`. Run it again to reset that data and refresh the auction times;
anything created by other accounts is left alone.

Open http://localhost:3000/status, sign up, and check that every row says OK.

MongoDB is on port **27018** so it doesn't clash with a MongoDB already installed on 27017.
Elasticsearch is on 9200. Both only listen on localhost. `docker compose down` stops them
and keeps their data.

If Elasticsearch keeps exiting on Windows, run
`wsl -d docker-desktop sysctl -w vm.max_map_count=262144` and start it again.

For production: `npm run build`, then `npm start`.

## Shared code

- **Protected API routes:** wrap the handler in `withUser` from `@/lib/server/auth`. It
  checks the Firebase token and hands you the MongoDB user. Users need a verified email
  unless you pass `{verified: false}`.

  ```js
  export const POST = withUser(async (request, context, user) => {
    // validate the body, then save with sellerId: user._id
    return Response.json({ok: true}, {status: 201});
  });
  ```

- **Calling them:** `authFetch(url, options)` from `@/lib/authFetch` adds the token and throws
  with the server's error message.
- **Current user in a component:** `const {user, loading, signOut} = useAuth()` from
  `@/context/AuthContext`.
- **Sockets:** `getSocket()` from `@/lib/socketClient`; call `connect()` once signed in. Server
  handlers go in `src/lib/server/sockets.js`. Each user joins the room `user:<firebaseUid>`.
  For countdowns, use `serverNow()` from `@/lib/socketClient` instead of `Date.now()`. It
  corrects for the browser's clock being off from the server's.
- **MongoDB:** `getDb()` from `@/lib/server/mongo`.
- **ImageMagick:** `runMagick(args)` from `@/lib/server/imagemagick`, with paths relative to
  `storage/`. Only GIF, JPEG, PNG and WebP are allowed (see `docker/imagemagick/policy.xml`).

`server.js` runs without the bundler, so it and anything it imports (`sockets.js`,
`firebaseAdmin.js`) must use relative imports, not `@/`.
