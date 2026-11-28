# CS 554 - Final Project: Marketplace

A local marketplace for buying, selling, trading and auctioning used items.
Next.js and Socket.io run together on one Node server (`server.js`); MongoDB,
Elasticsearch and ImageMagick run in Docker.

## Setup

Needs Node.js 20.9+, Git, and Docker (Docker Desktop on Windows and macOS) with at least
4 GB of memory for containers. See [OS-specific notes](#os-specific-notes) before your first run.

```bash
git clone https://github.com/sammy42810/Marketplace.git
cd Marketplace
npm install
cp .env.example .env.local   # then fill in the Firebase values (ask the group)
docker compose up -d --wait  # first run downloads about 1 GB; --wait returns once all services are healthy
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
and keeps their data (`docker compose down -v` deletes it too).

MongoDB runs as a single node replica set to support transactions for auction bidding. This allows the highest bid and bid history to be saved together.

The `mongo-init` service automatically initializes the replica set when running `docker compose up -d`, so no manual setup is needed.
It exits once that's done, so it shows as `Exited (0)` in `docker compose ps -a`. That's expected.

`npm run dev` waits up to two minutes for Elasticsearch to start (you'll see
`Waiting for Elasticsearch ...`), so it's fine to run it right after `docker compose up -d`.

For production: `npm run build`, then `npm start`.

## First-run check

Every member does this once, on a fresh clone, before building features on top of the platform:

1. Run the steps in [Setup](#setup) in order.
2. http://localhost:3000/status shows **OK** for MongoDB, Elasticsearch and ImageMagick.
3. Log in as `priya.seed@example.com`. On `/status`, Firebase sign-in, Email verified,
   Server token check and Socket.io connection all say **OK**.
4. Sign up with your own email, open the verification link, click **I have verified it** on `/status`,
   and check that the same rows say OK.
5. If something needed a fix that isn't written down here, add it to the notes below.

## OS-specific notes

### Windows

- Use Docker Desktop with the WSL 2 backend. The commands above work in PowerShell
  (`cp` is an alias of `Copy-Item`). In Command Prompt, use `copy .env.example .env.local`.
- With the WSL 2 backend, container memory is set by WSL, not the Docker Desktop slider.
  The default (half of your RAM) is enough on 8 GB machines and up. To change it, set
  `memory=` under `[wsl2]` in `%UserProfile%\.wslconfig`, then run `wsl --shutdown`.
- If Elasticsearch keeps exiting, run
  `wsl -d docker-desktop sysctl -w vm.max_map_count=262144` and start it again. The setting
  resets when WSL restarts.
- If Docker Desktop shows "backend crashed" on startup and its log
  (`%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`) says
  `remove ...\dockerInference: The file cannot be accessed by the system` (or the same for
  another `.sock` file), stale socket files from an earlier crash are in the way. They can't be
  deleted, but the folder holding them can be renamed. Quit Docker Desktop and run this in PowerShell:

  ```powershell
  Rename-Item "$env:LOCALAPPDATA\Docker\run" "run.old"
  ```

  If the error names `docker-secrets-engine\engine.sock`, rename
  `$env:LOCALAPPDATA\docker-secrets-engine` the same way. Start Docker Desktop again. You can
  delete the `.old` folders after a reboot.

### macOS

- Give Docker Desktop at least 4 GB in Settings > Resources > Memory.
- Apple Silicon works natively: every image used here has an arm64 build.

### Linux

- Install Docker Engine with the Compose plugin (`docker compose`, not the old `docker-compose`).
- Add yourself to the `docker` group (`sudo usermod -aG docker $USER`, then log out and back in).
  `npm run dev` runs `docker compose exec` for ImageMagick, and that fails without sudo otherwise.
- If Elasticsearch keeps exiting, run `sudo sysctl -w vm.max_map_count=262144`. To keep it after
  a reboot, put `vm.max_map_count=262144` in `/etc/sysctl.d/99-elasticsearch.conf`.
- The ImageMagick container writes to `storage/uploads/` as user ID 1000. If `id -u` prints
  something else, run `mkdir -p storage/uploads && chmod a+rwx storage/uploads` once, or photo
  uploads fail with "permission denied".

### Troubleshooting

- **Login page says "Sign-in is not set up yet":** `.env.local` is missing or has empty Firebase
  values. Fill it in and restart `npm run dev`. The `NEXT_PUBLIC_` values are read at startup.
- **`getaddrinfo ENOTFOUND mongo`:** your `.env.local` is from before MongoDB became a replica set.
  Set `MONGO_URL=mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true`, as in
  `.env.example`.
- **`connect ECONNREFUSED 127.0.0.1:27018`:** the containers aren't running. Run
  `docker compose up -d --wait`, then try again.
- **`Elasticsearch ... is not ready`:** Docker isn't running or the containers are stopped. Run
  `docker compose up -d --wait`, then `npm run dev` again.
- **Port already in use:** change `PORT` in `.env.local` for the app. Ports 27018 and 9200 belong to
  this project's containers, so stop whatever else is using them.
- **Google sign-in fails with `auth/unauthorized-domain`:** open the app at `localhost`, not
  `127.0.0.1`. Firebase only authorizes `localhost` by default.

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
  handlers go in `src/lib/server/sockets.js`. Each user joins the room `user:<users._id>`
  (`userRoom(userId)` from `src/lib/server/realtime.js`).
  For countdowns, use `serverNow()` from `@/lib/socketClient` instead of `Date.now()`. It
  corrects for the browser's clock being off from the server's.
- **MongoDB:** `getDb()` from `@/lib/server/mongo`.
- **ImageMagick:** `runMagick(args)` from `@/lib/server/imagemagick`, with paths relative to
  `storage/`. Only GIF, JPEG, PNG and WebP are allowed (see `docker/imagemagick/policy.xml`).

`server.js` runs without the bundler, so it and anything it imports (`sockets.js`,
`firebaseAdmin.js`) must use relative imports, not `@/`.
