import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'src', 'public');
const snapshotPath = path.join(root, 'fixtures', 'demo-readonly', 'snapshot.json');
const pdfDir = path.join(root, 'fixtures', 'golden', 'pdfs');
const outputDir = path.join(root, 'dist', 'server');

const securityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function createWorkerSource({html, app, webmcp, styles, snapshot, pdfs}) {
  const textRoutes = {
    '/': {body: html, type: 'text/html; charset=utf-8'},
    '/index.html': {body: html, type: 'text/html; charset=utf-8'},
    '/app.js': {body: app, type: 'text/javascript; charset=utf-8'},
    '/webmcp.js': {body: webmcp, type: 'text/javascript; charset=utf-8'},
    '/styles.css': {body: styles, type: 'text/css; charset=utf-8'},
  };

  return `const SECURITY_HEADERS = ${JSON.stringify(securityHeaders)};
const TEXT_ROUTES = ${JSON.stringify(textRoutes)};
const SNAPSHOT = ${JSON.stringify(snapshot)};
const PDFS = ${JSON.stringify(pdfs)};

function withHeaders(extra = {}) {
  return {...SECURITY_HEADERS, ...extra};
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: withHeaders({'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}),
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && TEXT_ROUTES[url.pathname]) {
      const route = TEXT_ROUTES[url.pathname];
      return new Response(route.body, {
        headers: withHeaders({'content-type': route.type, 'cache-control': 'no-store'}),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({
        status: 'ok',
        mode: 'synthetic-readonly-presentation',
        read_only: true,
        precomputed: true,
        live_inference: false,
        uploads_enabled: false,
        vertex_access: false,
        storage_access: false,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/demo-result') {
      return json(SNAPSHOT);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/demo/documents/')) {
      const filename = decodeURIComponent(url.pathname.slice('/demo/documents/'.length));
      const encoded = PDFS[filename];
      if (!encoded || !SNAPSHOT.demo.input_files.includes(filename)) return json({error: 'NOT_FOUND'}, 404);
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      return new Response(bytes, {
        headers: withHeaders({
          'content-type': 'application/pdf',
          'content-disposition': "inline; filename*=UTF-8''" + encodeURIComponent(filename),
          'cache-control': 'public, max-age=3600, immutable',
        }),
      });
    }

    if (
      request.method === 'POST'
      && (url.pathname === '/api/process' || url.pathname === '/api/process-golden')
    ) {
      return json({
        error: 'DEMO_READ_ONLY',
        message: 'The public presentation accepts no files or inference requests.',
      }, 405);
    }

    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      return new Response(null, {status: 204, headers: withHeaders()});
    }

    return json({error: 'NOT_FOUND'}, 404);
  },
};
`;
}

export async function buildSitesDemo() {
  const [rawHtml, app, webmcp, styles, rawSnapshot] = await Promise.all([
    readFile(path.join(publicDir, 'index.html'), 'utf8'),
    readFile(path.join(publicDir, 'app.js'), 'utf8'),
    readFile(path.join(publicDir, 'webmcp.js'), 'utf8'),
    readFile(path.join(publicDir, 'styles.css'), 'utf8'),
    readFile(snapshotPath, 'utf8'),
  ]);
  const snapshot = JSON.parse(rawSnapshot);
  const html = rawHtml
    .replace('<body>', '<body data-demo-mode="readonly">')
    .replace(/<!-- PRIVATE_UPLOAD_START -->[\s\S]*?<!-- PRIVATE_UPLOAD_END -->/, '');

  const pdfs = {};
  for (const filename of snapshot.demo.input_files) {
    const bytes = await readFile(path.join(pdfDir, filename));
    pdfs[filename] = bytes.toString('base64');
  }

  await rm(path.join(root, 'dist'), {recursive: true, force: true});
  await mkdir(outputDir, {recursive: true});
  const workerSource = createWorkerSource({html, app, webmcp, styles, snapshot, pdfs});
  await writeFile(path.join(outputDir, 'index.js'), workerSource, 'utf8');
  return {
    output: path.join(outputDir, 'index.js'),
    pdf_count: Object.keys(pdfs).length,
    bytes: Buffer.byteLength(workerSource),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await buildSitesDemo()));
}
