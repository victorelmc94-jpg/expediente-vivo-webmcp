import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {createRuntime, loadConfig} from './config.js';
import {runVerticalSlice} from './pipeline/run-vertical-slice.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'src', 'public');
const goldenDir = path.join(root, 'fixtures', 'golden', 'pdfs');
const demoSnapshotPath = path.join(root, 'fixtures', 'demo-readonly', 'snapshot.json');
const config = loadConfig();
const runtime = await createRuntime(config);
const recentRuns = new Map();
let demoSnapshot;

const securityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function sendStatic(response, filename, contentType) {
  let body = await readFile(path.join(publicDir, filename));
  if (filename === 'index.html' && config.demoMode) {
    const html = body.toString('utf8')
      .replace('<body>', '<body data-demo-mode="readonly">')
      .replace(/<!-- PRIVATE_UPLOAD_START -->[\s\S]*?<!-- PRIVATE_UPLOAD_END -->/, '');
    body = Buffer.from(html, 'utf8');
  }
  response.writeHead(200, {
    ...securityHeaders,
    'content-type': contentType,
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function sendPackagedPdf(response, filename) {
  const body = await readFile(path.join(goldenDir, filename));
  response.writeHead(200, {
    ...securityHeaders,
    'content-type': 'application/pdf',
    'content-length': body.length,
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'cache-control': 'public, max-age=3600, immutable',
  });
  response.end(body);
}

async function loadDemoSnapshot() {
  if (!demoSnapshot) demoSnapshot = JSON.parse(await readFile(demoSnapshotPath, 'utf8'));
  return demoSnapshot;
}

async function readJsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 28 * 1024 * 1024) throw new Error('Request body exceeds 28 MB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function decodeFiles(payload) {
  if (!Array.isArray(payload.files)) throw new Error('files must be an array.');
  return payload.files.map((file) => ({
    name: String(file.name),
    data: Buffer.from(String(file.base64), 'base64'),
  }));
}

async function goldenFiles() {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'fixtures', 'golden', 'manifest.json'), 'utf8'),
  );
  return Promise.all(
    manifest.files.map(async (name) => ({name, data: await readFile(path.join(goldenDir, name))})),
  );
}

async function processFiles(files, subjectParty = 'ALICIA DEMO') {
  if (config.demoMode) throw new Error('Live processing is disabled in public presentation mode.');
  const started = performance.now();
  const result = await runVerticalSlice({
    files,
    extractor: runtime.extractor,
    artifactStore: runtime.artifactStore,
    subjectParty,
  });
  recentRuns.set(result.run_id, result);
  if (recentRuns.size > 10) recentRuns.delete(recentRuns.keys().next().value);
  console.log(JSON.stringify({
    event: 'vertical_slice_completed',
    run_id: result.run_id,
    status: result.report.status,
    extractor_mode: result.report.extractor_mode,
    artifact_store: result.report.artifact_store,
    duration_ms: Math.round(performance.now() - started),
    metrics: result.report.metrics,
  }));
  return result;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/') {
      return await sendStatic(response, 'index.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/app.js') {
      return await sendStatic(response, 'app.js', 'text/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/webmcp.js') {
      return await sendStatic(response, 'webmcp.js', 'text/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/styles.css') {
      return await sendStatic(response, 'styles.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      if (config.demoMode) {
        return sendJson(response, 200, {
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
      return sendJson(response, 200, {
        status: 'ok',
        agent: 'ExpedienteAgent',
        adk: '@google/adk',
        model: config.model,
        extractor_mode: runtime.extractor.mode,
        storage: runtime.artifactStore.kind,
        vertex_configured: config.vertexConfigured,
        cloud_storage_configured: config.storageConfigured,
      });
    }
    if (config.demoMode && request.method === 'GET' && url.pathname === '/api/demo-result') {
      return sendJson(response, 200, await loadDemoSnapshot());
    }
    if (config.demoMode && request.method === 'GET' && url.pathname.startsWith('/demo/documents/')) {
      const filename = decodeURIComponent(url.pathname.slice('/demo/documents/'.length));
      const snapshot = await loadDemoSnapshot();
      if (!snapshot.demo.input_files.includes(filename)) {
        return sendJson(response, 404, {error: 'NOT_FOUND'});
      }
      return await sendPackagedPdf(response, filename);
    }
    if (
      config.demoMode
      && request.method === 'POST'
      && (url.pathname === '/api/process' || url.pathname === '/api/process-golden')
    ) {
      return sendJson(response, 405, {
        error: 'DEMO_READ_ONLY',
        message: 'The public presentation accepts no files or inference requests.',
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/process-golden') {
      const result = await processFiles(await goldenFiles(), 'ALICIA DEMO');
      return sendJson(response, 200, {dossier: result.dossier, report: result.report});
    }
    if (request.method === 'POST' && url.pathname === '/api/process') {
      const payload = await readJsonBody(request);
      const subjectParty = String(payload.subject_party ?? 'ALICIA DEMO').trim();
      if (!subjectParty || subjectParty.length > 160) {
        throw new Error('subject_party must contain between 1 and 160 characters.');
      }
      const result = await processFiles(decodeFiles(payload), subjectParty);
      return sendJson(response, 200, {dossier: result.dossier, report: result.report});
    }
    const runMatch = url.pathname.match(/^\/api\/runs\/([0-9a-f-]+)$/i);
    if (request.method === 'GET' && runMatch) {
      const result = recentRuns.get(runMatch[1]);
      return result
        ? sendJson(response, 200, {dossier: result.dossier, report: result.report})
        : sendJson(response, 404, {error: 'RUN_NOT_FOUND'});
    }
    return sendJson(response, 404, {error: 'NOT_FOUND'});
  } catch (error) {
    console.error(JSON.stringify({
      event: 'request_failed',
      method: request.method,
      path: request.url,
      error_code: error.code ?? error.name ?? 'ERROR',
      message: error.message,
    }));
    return sendJson(response, 400, {
      error: error.code ?? error.name ?? 'ERROR',
      message: error.message,
    });
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      event: 'server_started',
      bind: `0.0.0.0:${config.port}`,
      runtime_mode: runtime.mode,
      extractor_mode: runtime.extractor?.mode ?? 'disabled',
      storage: runtime.artifactStore?.kind ?? 'disabled',
    }),
  );
});
