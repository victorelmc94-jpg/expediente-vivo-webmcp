import assert from 'node:assert/strict';

const baseUrl = process.env.DEMO_URL;
if (!baseUrl) throw new Error('DEMO_URL is required.');

async function call(path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') ?? '';
  let body;
  if (contentType.includes('json')) body = await response.json();
  else if (contentType.includes('text') || contentType.includes('javascript')) {
    body = await response.text();
  } else {
    body = Buffer.from(await response.arrayBuffer());
  }
  return {
    status: response.status,
    contentType,
    body,
    durationMs: Math.round(performance.now() - started),
    headers: response.headers,
  };
}

const root = await call('/');
assert.equal(root.status, 200);
assert.doesNotMatch(
  root.body,
  /type="file"|<textarea|id="drop-zone"|id="upload-button"/i,
);
assert.match(root.body, /data-demo-mode="readonly"/);

const health = await call('/api/health');
assert.equal(health.status, 200);
assert.deepEqual(health.body, {
  status: 'ok',
  mode: 'synthetic-readonly-presentation',
  read_only: true,
  precomputed: true,
  live_inference: false,
  uploads_enabled: false,
  vertex_access: false,
  storage_access: false,
});

const result = await call('/api/demo-result');
assert.equal(result.status, 200);
assert.equal(result.body.dossier.matters.length, 2);
assert.equal(result.body.report.metrics.critical_errors, 0);
assert.equal(result.body.report.metrics.supported_without_valid_citation, 0);
assert.equal(result.body.report.model, null);
assert.deepEqual(result.body.report.model_events, []);

const pdf = await call('/demo/documents/A01_contract.pdf');
assert.equal(pdf.status, 200);
assert.equal(pdf.contentType, 'application/pdf');

const blockedInternalRoutes = [
  '/demo/documents/not-allowlisted.pdf',
  '/admin',
  '/logs',
  '/api/admin',
  '/api/logs',
  '/api/runs/00000000-0000-0000-0000-000000000000',
];
for (const route of blockedInternalRoutes) {
  assert.equal((await call(route)).status, 404, route);
}

for (const route of ['/api/process', '/api/process-golden']) {
  const blocked = await call(route, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{ intentionally invalid and never parsed',
  });
  assert.equal(blocked.status, 405, route);
  assert.equal(blocked.body.error, 'DEMO_READ_ONLY');
}

assert.equal((await call('/api/demo-result', {method: 'OPTIONS'})).status, 404);
assert.equal(health.headers.get('access-control-allow-origin'), null);

const exposed = root.body + JSON.stringify(health.body) + JSON.stringify(result.body);
assert.doesNotMatch(
  exposed,
  /AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]+|BEGIN (?:RSA |EC )?PRIVATE KEY|\.iam\.gserviceaccount\.com|gs:\/\/|project-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|expediente-vivo-temp-/i,
);
assert.doesNotMatch(exposed, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

console.log(JSON.stringify({
  status: 'PASS',
  url: baseUrl,
  root_http: root.status,
  root_ms: root.durationMs,
  health_http: health.status,
  snapshot_http: result.status,
  matters: result.body.dossier.matters.length,
  critical_errors: result.body.report.metrics.critical_errors,
  model_events: result.body.report.model_events.length,
  upload_controls: 0,
  blocked_posts: 2,
  blocked_internal_routes: blockedInternalRoutes.length,
  allowlisted_pdf: pdf.status,
  cors: null,
  secret_pii_scan: '0 matches',
}, null, 2));
