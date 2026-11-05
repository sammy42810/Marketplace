import {createServer} from 'node:http';
import next from 'next';
import nextEnv from '@next/env';
import {attachSockets} from './src/lib/server/sockets.js';

const dev = !process.argv.includes('--production');

// Same env loading as `next dev`; must run before anything reads process.env.
nextEnv.loadEnvConfig(process.cwd(), dev);

const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

const app = next({dev, hostname, port});
const handle = app.getRequestHandler();
await app.prepare();

// Socket.io can't live in Next.js API routes, so both share this server.
const httpServer = createServer((req, res) => handle(req, res));
globalThis.marketplaceIo = attachSockets(httpServer);

httpServer.listen(port, () => {
  console.log(`> Marketplace ready on http://${hostname}:${port} (${dev ? 'development' : 'production'})`);
});
