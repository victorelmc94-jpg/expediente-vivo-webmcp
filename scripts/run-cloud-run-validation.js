import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {contractSignature} from '../src/evaluation/golden-evaluator.js';
import {evaluateRemoteGolden} from '../src/evaluation/remote-evaluator.js';
import {inspectBatch} from '../src/pdf/ingest.js';

const serviceUrl = process.env.CLOUD_RUN_URL;
const identityToken = process.env.CLOUD_RUN_ID_TOKEN;
const requestedRuns = Number(process.env.EXPEDIENTE_REMOTE_RUNS ?? 3);
if (!serviceUrl) {
  throw new Error('CLOUD_RUN_URL is required.');
}
if (!Number.isInteger(requestedRuns) || requestedRuns < 1 || requestedRuns > 3) {
  throw new Error('EXPEDIENTE_REMOTE_RUNS must be an integer from 1 to 3.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'fixtures', 'golden');
const fixtureManifest = JSON.parse(
  await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8'),
);
const files = await Promise.all(
  fixtureManifest.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);
const manifest = await inspectBatch(files);

async function requestJson(pathname, init = {}) {
  const target = new URL(pathname, serviceUrl);
  const makeRequest = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const {statusCode, body} = await new Promise((resolve, reject) => {
    const request = makeRequest(target, {
      method: init.method ?? 'GET',
      agent: false,
      headers: {
        connection: 'close',
        ...(identityToken ? {authorization: `Bearer ${identityToken}`} : {}),
        ...(init.headers ?? {}),
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.setTimeout(300_000, () => request.destroy(new Error('Remote request timed out.')));
    request.on('error', reject);
    request.end();
  });
  const parsed = JSON.parse(body);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`${pathname} returned HTTP ${statusCode}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

const healthStarted = performance.now();
const health = await requestJson('/api/health');
const healthLatencyMs = Math.round(performance.now() - healthStarted);
const runs = [];

for (let iteration = 1; iteration <= requestedRuns; iteration += 1) {
  const started = performance.now();
  const response = await requestJson('/api/process-golden', {method: 'POST'});
  const latencyMs = Math.round(performance.now() - started);
  const evaluation = evaluateRemoteGolden({
    health,
    dossier: response.dossier,
    report: response.report,
    manifest,
    fixtureManifest,
  });
  const usageMetadata = response.report.model_events
    .map((event) => event.usage_metadata)
    .filter(Boolean)
    .at(-1) ?? null;
  const summary = {
    iteration,
    run_id: response.report.run_id,
    latency_ms: latencyMs,
    metrics: response.report.metrics,
    pass_count: evaluation.pass_count,
    fail_count: evaluation.fail_count,
    critical_failures: evaluation.critical_failures,
    tests: evaluation.tests,
    usage_metadata: usageMetadata,
    contract_signature: contractSignature({dossier: response.dossier}),
    artifacts: response.report.artifacts,
  };
  runs.push(summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!evaluation.all_pass) {
    throw new Error(`Remote run ${iteration} failed ${evaluation.fail_count} checks.`);
  }
}

const finalReport = {
  generated_at: new Date().toISOString(),
  health_latency_ms: healthLatencyMs,
  requested_runs: requestedRuns,
  runs,
  all_runs_13_of_13: runs.every((run) => run.pass_count === 13),
  stable_contract: new Set(runs.map((run) => run.contract_signature)).size === 1,
  total_critical_failures: runs.reduce((sum, run) => sum + run.critical_failures, 0),
};
const outputPath = path.join(root, 'artifacts', `cloud-run-validation-${requestedRuns}-runs.json`);
await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(finalReport, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({summary_path: outputPath, ...finalReport}, null, 2));
