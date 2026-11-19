// Vice Cover Studio — tiny static server for local testing.
//
// Serves the app/ directory over plain HTTP so the page can be tried in a
// desktop browser exactly as the hosted static files behave. No build step,
// no network calls, no logging of anything but the request line.
//
//   node serve.ts            # http://localhost:8123
//   PORT=8080 node serve.ts  # pick another port

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, 'app');
const PORT = Number(process.env.PORT ?? 8123);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const joined = normalize(join(ROOT, clean === '/' ? 'index.html' : clean));
  if (!joined.startsWith(ROOT)) return null;
  return joined;
}

const server = createServer((req, res) => {
  const file = safePath(req.url ?? '/');
  if (file === null || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Vice Cover Studio at http://localhost:${PORT}`);
});
