import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DeterministicDevExtractor} from '../src/agent/deterministic-dev-extractor.js';
import {runVerticalSlice} from '../src/pipeline/run-vertical-slice.js';
import {LocalArtifactStore} from '../src/storage/local-artifact-store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'fixtures', 'golden');
const fixtureManifest = JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const files = await Promise.all(
  fixtureManifest.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);

const result = await runVerticalSlice({
  files,
  extractor: new DeterministicDevExtractor(),
  artifactStore: new LocalArtifactStore({rootDirectory: path.join(root, 'artifacts')}),
  subjectParty: fixtureManifest.subject_party,
});

console.log(
  JSON.stringify(
    {
      run_id: result.run_id,
      status: result.report.status,
      extractor_mode: result.report.extractor_mode,
      stages: result.report.stages,
      metrics: result.report.metrics,
      matters: result.dossier.matters.map((matter) => ({
        matter_id: matter.matter_id,
        label: matter.label,
        state: matter.matter_state,
        documents: matter.document_ids.length,
        assertions: matter.assertions.length,
        action: result.dossier.actions.find((action) => action.matter_id === matter.matter_id)?.action_type,
      })),
      artifacts: result.report.artifacts,
    },
    null,
    2,
  ),
);

