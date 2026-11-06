// Dependency-free dev server (ES modules need an HTTP origin); port 4173 unless PORT is set

import { createServer }   from 'node:http';
import { readFile }       from 'node:fs/promises';

import { extname }        from 'node:path';
import { join }           from 'node:path';
import { normalize }      from 'node:path';
import { dirname }        from 'node:path';
import { sep }            from 'node:path';

import { fileURLToPath }  from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
  '.svg':   'image/svg+xml; charset=utf-8',
  '.md':    'text/markdown; charset=utf-8',
  '.txt':   'text/plain; charset=utf-8',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.mp4':   'video/mp4',
  '.webm':  'video/webm',
  '.mp3':   'audio/mpeg',
  '.ogg':   'audio/ogg',
  '.wav':   'audio/wav',
  '.wasm':  'application/wasm',
};

function resolvePath (url) {
  let path = decodeURIComponent(url.split('?')[0]);

  // Mirrors the layout build-site.mjs deploys, straight from the source tree
  if (path === '/') {
    return join(ROOT, 'docs', 'showcase', 'index.html');
  }

  if (path === '/api' || path === '/api/') {
    return join(ROOT, 'docs', 'api', 'index.html');
  }

  if (path === '/migration' || path === '/migration/') {
    return join(ROOT, 'docs', 'migration', 'index.html');
  }

  if (path === '/docs/lottie/lottie_light.min.js') {
    return join(ROOT, 'node_modules', 'lottie-web', 'build', 'player', 'lottie_light.min.js');
  }

  if (path.endsWith('/')) {
    path += 'index.html';
  }

  const filePath = normalize(join(ROOT, path));

  // The separator stops a sibling like ROOT + "-backup" passing the prefix test
  return filePath === ROOT || filePath.startsWith(ROOT + sep) ? filePath : null;
}

createServer(async (request, response) => {
  const filePath = resolvePath(request.url);

  if (!filePath) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);

    response.writeHead(200, {
      'Content-Type':  TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });

    response.end(data);
  } catch (error) {
    const status = error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500;

    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? `Not found: ${request.url}` : 'Server error');
  }
}).listen(PORT, () => {
  console.log(`Droplet UI dev server -> http://localhost:${PORT}/`);
  console.log(`Showcase on /, API reference on /api, migration guide on /migration - Ctrl+C to stop`);
});
