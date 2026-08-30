import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DeterministicDevExtractor} from '../src/agent/deterministic-dev-extractor.js';
import {contractSignature} from '../src/evaluation/golden-evaluator.js';
import {runVerticalSlice} from '../src/pipeline/run-vertical-slice.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'fixtures', 'golden');
const fixtureManifest = JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const files = await Promise.all(
  fixtureManifest.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);

const memoryStore = {
  kind: 'memory-build-only',
  async saveRun() {
    return {dossier_uri: 'memory://dossier.json', report_uri: 'memory://run_report.json'};
  },
  async saveJson() {
    return 'memory://run_report.json';
  },
};

const result = await runVerticalSlice({
  files,
  extractor: new DeterministicDevExtractor(),
  artifactStore: memoryStore,
  subjectParty: fixtureManifest.subject_party,
});

if (result.report.metrics.critical_errors !== 0 || result.validation.rejected.length !== 0) {
  throw new Error('The synthetic demo snapshot failed the zero-critical-error gate.');
}

const snapshotId = 'golden-v1-verified-readonly';
const snapshot = {
  demo: {
    mode: 'synthetic-readonly-presentation',
    snapshot_id: snapshotId,
    read_only: true,
    precomputed: true,
    synthetic_data_only: true,
    live_inference: false,
    uploads_enabled: false,
    storage_access: false,
    source_dataset: fixtureManifest.dataset_id,
    input_files: fixtureManifest.files,
    verified_by: ['19-test local product suite', 'snapshot generation zero-critical gate'],
    real_pipeline_note:
      'The real private pipeline uses Google ADK and Gemini 3.7 Flash on Vertex AI. This public presentation loads a previously verified synthetic snapshot and performs no inference.',
  },
  dossier: {
    ...result.dossier,
    run_id: snapshotId,
    generated_at: '2026-08-26T00:00:00.000Z',
    extractor_mode: 'precomputed-readonly',
  },
  report: {
    run_id: snapshotId,
    status: 'VERIFIED_SNAPSHOT',
    completed_at: '2026-08-26T00:00:00.000Z',
    extractor_mode: 'precomputed-readonly',
    artifact_store: 'image-embedded-json',
    model: null,
    stages: [{name: 'load_verified_snapshot', status: 'PASS', duration_ms: 0}],
    metrics: result.report.metrics,
    rejected_candidates: [],
    model_events: [],
    source_contract_signature: contractSignature(result),
  },
};

const outputDirectory = path.join(root, 'fixtures', 'demo-readonly');
const outputPath = path.join(outputDirectory, 'snapshot.json');
await mkdir(outputDirectory, {recursive: true});
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  snapshot_id: snapshotId,
  matters: snapshot.dossier.matters.length,
  assertions: snapshot.report.metrics.accepted_assertions,
  critical_errors: snapshot.report.metrics.critical_errors,
  contract_signature: snapshot.report.source_contract_signature,
}, null, 2));
