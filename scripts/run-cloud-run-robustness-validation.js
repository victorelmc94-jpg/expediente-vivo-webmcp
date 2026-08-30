import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {contractSignature} from '../src/evaluation/golden-evaluator.js';
import {evaluateRobustnessResult} from '../src/evaluation/robustness-evaluator.js';
import {inspectBatch} from '../src/pdf/ingest.js';

const serviceUrl = process.env.CLOUD_RUN_URL;
const identityToken = process.env.CLOUD_RUN_ID_TOKEN;
const requestedRuns = Number(process.env.EXPEDIENTE_REMOTE_RUNS ?? 3);
if (!serviceUrl || !identityToken) {
  throw new Error('CLOUD_RUN_URL and CLOUD_RUN_ID_TOKEN are required.');
}
if (!Number.isInteger(requestedRuns) || requestedRuns < 1 || requestedRuns > 3) {
  throw new Error('EXPEDIENTE_REMOTE_RUNS must be an integer from 1 to 3.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'fixtures', 'robustness-v2');
const groundTruth = JSON.parse(
  await readFile(path.join(fixtureRoot, 'ground-truth.json'), 'utf8'),
);
const files = await Promise.all(
  groundTruth.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);
const manifest = await inspectBatch(files);
const requestBody = JSON.stringify({
  subject_party: groundTruth.subject_party,
  files: files.map((file) => ({name: file.name, base64: file.data.toString('base64')})),
});

async function requestRaw(pathname, {method = 'GET', token = null, body = null} = {}) {
  const target = new URL(pathname, serviceUrl);
  const makeRequest = target.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = makeRequest(target, {
      method,
      agent: false,
      headers: {
        connection: 'close',
        accept: 'application/json',
        ...(token ? {authorization: `Bearer ${token}`} : {}),
        ...(body ? {
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(body),
        } : {}),
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
    if (body) request.write(body);
    request.end();
  });
}

async function requestJson(pathname, options = {}) {
  const result = await requestRaw(pathname, {...options, token: identityToken});
  let parsed;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    throw new Error(`${pathname} returned non-JSON HTTP ${result.statusCode}.`);
  }
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`${pathname} returned HTTP ${result.statusCode}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

const anonymous = await requestRaw('/api/health');
if (anonymous.statusCode !== 403) {
  throw new Error(`Anonymous Cloud Run request returned ${anonymous.statusCode}, expected 403.`);
}
const healthStarted = performance.now();
const health = await requestJson('/api/health');
const healthLatencyMs = Math.round(performance.now() - healthStarted);
const runs = [];

for (let iteration = 1; iteration <= requestedRuns; iteration += 1) {
  const started = performance.now();
  const response = await requestJson('/api/process', {
    method: 'POST',
    body: requestBody,
  });
  const latencyMs = Math.round(performance.now() - started);
  const evaluation = evaluateRobustnessResult({
    health,
    dossier: response.dossier,
    report: response.report,
    manifest,
    groundTruth,
  });
  const usageMetadata = response.report.model_events
    .map((event) => event.usage_metadata)
    .filter(Boolean)
    .at(-1) ?? null;
  const summary = {
    iteration,
    run_id: response.report.run_id,
    latency_ms: latencyMs,
    report_metrics: response.report.metrics,
    evaluation_metrics: evaluation.metrics,
    pass_count: evaluation.pass_count,
    fail_count: evaluation.fail_count,
    critical_failures: evaluation.critical_failures,
    checks: evaluation.checks,
    usage_metadata: usageMetadata,
    contract_signature: contractSignature({dossier: response.dossier}),
    artifacts: response.report.artifacts,
  };
  runs.push(summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!evaluation.all_pass || evaluation.critical_failures > 0) {
    throw new Error(
      `Robustness run ${iteration} failed ${evaluation.fail_count} checks ` +
      `(${evaluation.critical_failures} critical).`,
    );
  }
}

const finalReport = {
  generated_at: new Date().toISOString(),
  dataset_id: groundTruth.dataset_id,
  anonymous_status: anonymous.statusCode,
  health_latency_ms: healthLatencyMs,
  requested_runs: requestedRuns,
  runs,
  all_runs_clean: runs.every((run) => run.fail_count === 0 && run.critical_failures === 0),
  all_runs_provenance_100: runs.every((run) =>
    run.evaluation_metrics.provenance_coverage_pct === 100),
  stable_contract: new Set(runs.map((run) => run.contract_signature)).size === 1,
  total_critical_failures: runs.reduce((sum, run) => sum + run.critical_failures, 0),
};
const outputPath = path.join(root, 'artifacts', `cloud-run-robustness-${requestedRuns}-runs.json`);
await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(finalReport, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({summary_path: outputPath, ...finalReport}, null, 2));
