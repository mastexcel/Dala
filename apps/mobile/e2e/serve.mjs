// Serveur statique minimal avec repli SPA pour l'export web (tests E2E).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist-web');
const port = Number(process.argv[3] ?? 8090);
const types = { '.js': 'application/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css', '.ico': 'image/x-icon' };

createServer((req, res) => {
  let p = join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) p = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(port, () => console.log(`E2E : http://localhost:${port}`));
