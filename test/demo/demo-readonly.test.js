import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createRuntime, loadConfig} from '../../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const snapshot = JSON.parse(
  await readFile(path.join(root, 'fixtures', 'demo-readonly', 'snapshot.json'), 'utf8'),
);
let child;
let baseUrl;

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const {port} = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Read-only demo server did not start.');
}

before(async () => {
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: root,
    env: {...process.env, PORT: String(port), DEMO_MODE: 'true'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(baseUrl);
});

after(() => {
  if (child && !child.killed) child.kill();
});

test('DEMO_MODE constructs no extractor or artifact store', async () => {
  const config = loadConfig({
    DEMO_MODE: 'true',
    GOOGLE_CLOUD_PROJECT: 'must-not-be-used',
    EXPEDIENTE_STORAGE_BUCKET: 'must-not-be-used',
  });
  const runtime = await createRuntime(config);
  assert.equal(config.extractorMode, 'demo-readonly');
  assert.equal(runtime.mode, 'demo-readonly-precomputed');
  assert.equal(runtime.extractor, null);
  assert.equal(runtime.artifactStore, null);
});

test('snapshot is synthetic, precomputed, zero-critical and contains complete citations', () => {
  assert.equal(snapshot.demo.synthetic_data_only, true);
  assert.equal(snapshot.demo.precomputed, true);
  assert.equal(snapshot.demo.live_inference, false);
  assert.equal(snapshot.demo.uploads_enabled, false);
  assert.equal(snapshot.demo.storage_access, false);
  assert.equal(snapshot.report.model, null);
  assert.deepEqual(snapshot.report.model_events, []);
  assert.equal(snapshot.report.metrics.critical_errors, 0);
  assert.equal(snapshot.report.metrics.supported_without_valid_citation, 0);
  assert.equal(snapshot.dossier.matters.length, 2);

  const supported = snapshot.dossier.matters
    .flatMap((matter) => matter.assertions)
    .filter((assertion) => assertion.verification_status === 'SUPPORTED');
  assert.ok(supported.length > 0);
  for (const assertion of supported) {
    assert.ok(assertion.evidence_refs.length > 0);
    for (const source of assertion.evidence_refs) {
      assert.ok(source.document_id);
      assert.match(source.document_sha256, /^[0-9a-f]{64}$/);
      assert.ok(source.page_number >= 1);
      assert.ok(source.fragment.length > 0);
      assert.ok(source.normalized_start >= 0);
      assert.ok(source.normalized_end > source.normalized_start);
      assert.match(source.fragment_sha256, /^[0-9a-f]{64}$/);
      assert.match(source.page_text_sha256, /^[0-9a-f]{64}$/);
    }
  }
});

test('public HTML exposes presentation mode and removes every upload control', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-demo-mode="readonly"/);
  assert.match(html, /Public judging demo/);
  assert.doesNotMatch(html, /type="file"/);
  assert.doesNotMatch(html, /id="drop-zone"/);
  assert.doesNotMatch(html, /id="upload-button"/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
});

test('only allowlisted packaged synthetic PDFs can be viewed', async () => {
  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appScript = await appResponse.text();
  assert.match(appScript, /\/demo\/documents\//);

  const allowed = await fetch(`${baseUrl}/demo/documents/A01_contract.pdf`);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('content-type'), 'application/pdf');
  assert.equal((await allowed.arrayBuffer()).byteLength > 100, true);

  for (const route of [
    '/demo/documents/not-allowlisted.pdf',
    '/demo/documents/%2e%2e%2fmanifest.json',
  ]) {
    const blocked = await fetch(`${baseUrl}${route}`);
    assert.equal(blocked.status, 404);
  }
});

test('only the embedded demo result is exposed and live processing is blocked before body parsing', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  const health = await healthResponse.json();
  assert.deepEqual(health, {
    status: 'ok',
    mode: 'synthetic-readonly-presentation',
    read_only: true,
    precomputed: true,
    live_inference: false,
    uploads_enabled: false,
    vertex_access: false,
    storage_access: false,
  });

  const demoResponse = await fetch(`${baseUrl}/api/demo-result`);
  const demo = await demoResponse.json();
  assert.equal(demoResponse.status, 200);
  assert.equal(demo.demo.snapshot_id, 'golden-v1-verified-readonly');
  assert.equal(demo.report.extractor_mode, 'precomputed-readonly');

  for (const route of ['/api/process', '/api/process-golden']) {
    const blocked = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{ this deliberately never needs to parse',
    });
    assert.equal(blocked.status, 405);
    assert.equal((await blocked.json()).error, 'DEMO_READ_ONLY');
  }
});

test('admin, run lookup and unexpected routes remain unavailable', async () => {
  for (const route of ['/api/runs/00000000-0000-0000-0000-000000000000', '/admin', '/logs', '/index.html']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 404);
  }
  const options = await fetch(`${baseUrl}/api/demo-result`, {method: 'OPTIONS'});
  assert.equal(options.status, 404);
  assert.equal(options.headers.get('access-control-allow-origin'), null);
});
