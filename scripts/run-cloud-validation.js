import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DeterministicDevExtractor} from '../src/agent/deterministic-dev-extractor.js';
import {createRuntime, loadConfig} from '../src/config.js';
import {contractSignature, evaluateGoldenResult} from '../src/evaluation/golden-evaluator.js';
import {runVerticalSlice} from '../src/pipeline/run-vertical-slice.js';
import {LocalArtifactStore} from '../src/storage/local-artifact-store.js';

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

const requestedRuns = Number(process.env.EXPEDIENTE_CLOUD_RUNS ?? 5);
if (!Number.isInteger(requestedRuns) || requestedRuns < 1 || requestedRuns > 5) {
  throw new Error('EXPEDIENTE_CLOUD_RUNS must be an integer from 1 to 5.');
}

const baseline = await runVerticalSlice({
  files,
  extractor: new DeterministicDevExtractor(),
  artifactStore: new LocalArtifactStore({rootDirectory: path.join(root, 'artifacts', 'cloud-baseline')}),
  subjectParty: fixtureManifest.subject_party,
});

const config = {...loadConfig(), extractorMode: 'vertex'};
const runtime = await createRuntime(config);
const cloudRuns = [];

for (let iteration = 1; iteration <= requestedRuns; iteration += 1) {
  const result = await runVerticalSlice({
    files,
    extractor: runtime.extractor,
    artifactStore: runtime.artifactStore,
    subjectParty: fixtureManifest.subject_party,
  });
  const evaluation = evaluateGoldenResult({result, fixtureManifest});
  const usageMetadata = result.extraction.model_events
    .map((event) => event.usage_metadata)
    .filter(Boolean)
    .at(-1) ?? null;
  const summary = {
    iteration,
    run_id: result.run_id,
    status: result.report.status,
    metrics: result.report.metrics,
    matters: result.dossier.matters.map((matter) => ({
      label: matter.label,
      state: matter.matter_state,
      documents: matter.document_ids.length,
      assertions: matter.assertions.length,
      action: result.dossier.actions.find((action) => action.matter_id === matter.matter_id)?.action_type,
    })),
    tests: evaluation.tests,
    pass_count: evaluation.pass_count,
    fail_count: evaluation.fail_count,
    critical_failures: evaluation.critical_failures,
    usage_metadata: usageMetadata,
    contract_signature: contractSignature(result),
    artifacts: result.report.artifacts,
  };
  cloudRuns.push(summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!evaluation.all_pass) {
    throw new Error(`Cloud run ${iteration} failed ${evaluation.fail_count} golden checks.`);
  }
}

const cloudSignatures = new Set(cloudRuns.map((run) => run.contract_signature));
const finalReport = {
  generated_at: new Date().toISOString(),
  requested_runs: requestedRuns,
  baseline: {
    run_id: baseline.run_id,
    metrics: baseline.report.metrics,
    contract_signature: contractSignature(baseline),
  },
  cloud_runs: cloudRuns,
  stable_across_cloud_runs: cloudSignatures.size === 1,
  strict_match_with_deterministic_baseline:
    cloudSignatures.size === 1 && cloudRuns[0].contract_signature === contractSignature(baseline),
  all_runs_13_of_13:
    cloudRuns.length === requestedRuns && cloudRuns.every((run) => run.pass_count === 13),
  total_critical_failures: cloudRuns.reduce((sum, run) => sum + run.critical_failures, 0),
};

const outputPath = path.join(root, 'artifacts', `cloud-validation-${requestedRuns}-runs.json`);
await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(finalReport, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({summary_path: outputPath, ...finalReport}, null, 2));
