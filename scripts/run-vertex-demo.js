import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuntime, loadConfig} from '../src/config.js';
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
const config = {...loadConfig(), extractorMode: 'vertex'};
const runtime = await createRuntime(config);
const result = await runVerticalSlice({
  files,
  extractor: runtime.extractor,
  artifactStore: runtime.artifactStore,
  subjectParty: fixtureManifest.subject_party,
});
console.log(JSON.stringify({run_id: result.run_id, report: result.report}, null, 2));
