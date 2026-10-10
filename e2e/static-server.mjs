// Serves apps/web/dist under a sub-folder exactly like GitHub Pages serves a project site
// (https://<user>.github.io/<repo>/), with no API or WebSocket backend at all.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env.STATIC_PORT ?? 4400);
const prefix = process.env.STATIC_PREFIX ?? '/Joyconhub/';
const root = resolve(process.argv[2] ?? 'apps/web/dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') return res.end('ok');
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(404, { 'content-type': 'text/html' });
    return res.end('<h1>404</h1>');
  }
  let file = normalize(join(root, decodeURIComponent(url.pathname.slice(prefix.length))));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/html' });
    return res.end('<h1>404</h1>');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`static (GitHub Pages-like) server on :${port}${prefix}`));
