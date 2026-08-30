import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {test, before} from 'node:test';
import {buildSitesDemo} from '../../scripts/build-sites-demo.js';

let worker;

before(async () => {
  const build = await buildSitesDemo();
  const moduleUrl = `${pathToFileURL(path.resolve(build.output)).href}?test=${Date.now()}`;
  worker = (await import(moduleUrl)).default;
});

async function request(pathname, options = {}) {
  return worker.fetch(new Request(`https://challenge.example${pathname}`, options));
}

test('Sites worker serves the read-only challenge shell', async () => {
  const response = await request('/');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-demo-mode="readonly"/);
  assert.doesNotMatch(html, /id="pdf-input"/);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
});

test('Sites worker exposes only the synthetic health contract', async () => {
  const response = await request('/api/health');
  assert.deepEqual(await response.json(), {
    status: 'ok',
    mode: 'synthetic-readonly-presentation',
    read_only: true,
    precomputed: true,
    live_inference: false,
    uploads_enabled: false,
    vertex_access: false,
    storage_access: false,
  });
});

test('Sites worker serves the real packaged dossier snapshot', async () => {
  const response = await request('/api/demo-result');
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.dossier.run_id, 'golden-v1-verified-readonly');
  assert.equal(result.dossier.matters.length, 2);
  assert.ok(result.dossier.matters.some((matter) =>
    matter.assertions.some((assertion) => assertion.assertion_id === 'assertion_ca8c96fc55040690')));
});

test('Sites worker serves only allowlisted synthetic PDFs', async () => {
  const allowed = await request('/demo/documents/A01_contract.pdf');
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('content-type'), 'application/pdf');
  assert.deepEqual([...new Uint8Array(await allowed.arrayBuffer()).slice(0, 5)], [37, 80, 68, 70, 45]);

  const blocked = await request('/demo/documents/secret.pdf');
  assert.equal(blocked.status, 404);
});

test('Sites worker blocks upload and inference routes', async () => {
  for (const pathname of ['/api/process', '/api/process-golden']) {
    const response = await request(pathname, {method: 'POST'});
    assert.equal(response.status, 405);
    assert.equal((await response.json()).error, 'DEMO_READ_ONLY');
  }
});
