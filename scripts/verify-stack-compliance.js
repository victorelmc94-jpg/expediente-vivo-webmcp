import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rootAgent} from '../src/agent/expediente-agent.js';

const files = Object.fromEntries(
  await Promise.all(
    [
      'src/agent/expediente-agent.js',
      'src/pipeline/run-vertical-slice.js',
      'src/public/app.js',
      'README.md',
      'docs/assets/architecture.svg',
      'docs/demo-script.md',
      'docs/devpost-submission-draft.md',
      'docs/gemini-stack-compliance.md',
    ].map(async (path) => [path, await readFile(path, 'utf8')]),
  ),
);
const evidence = JSON.parse(await readFile('docs/evidence/gemini-cloud-proof.json', 'utf8'));
const checks = [];

function check(id, name, operation) {
  operation();
  checks.push({id, name, status: 'PASS'});
}

check('G01', 'ADK root agent is Gemini 3.7 Flash', () => {
  assert.equal(rootAgent.name, 'ExpedienteAgent');
  assert.equal(rootAgent.canonicalModel.model, 'gemini-3.7-flash');
});

check('G02', 'Gemini adapter is explicitly configured for Vertex AI', () => {
  assert.match(files['src/agent/expediente-agent.js'], /new Gemini\(\{/);
  assert.match(files['src/agent/expediente-agent.js'], /vertexai:\s*true/);
});

check('G03', 'ADK receives page packets and enforces structured output', () => {
  const source = files['src/agent/expediente-agent.js'];
  assert.match(source, /function pagePackets/);
  assert.match(source, /exact_normalized_text/);
  assert.match(source, /outputSchema:\s*analysisSchema/);
});

check('G04', 'ADK runner performs the model execution and captures usage', () => {
  const source = files['src/agent/expediente-agent.js'];
  assert.match(source, /new InMemoryRunner/);
  assert.match(source, /runner\.runEphemeral/);
  assert.match(source, /usage_metadata:\s*event\.usageMetadata/);
});

check('G05', 'Model stage precedes deterministic provenance validation', () => {
  const source = files['src/pipeline/run-vertical-slice.js'];
  const modelStage = source.indexOf('expediente_agent_extracts_candidates');
  const provenanceStage = source.indexOf('deterministic_provenance_gate');
  assert.ok(modelStage >= 0 && provenanceStage > modelStage);
});

check('G06', 'Redacted cloud evidence identifies the deployed mandatory stack', () => {
  assert.equal(evidence.deployment.agent_framework, '@google/adk 2.0.0');
  assert.equal(evidence.deployment.model, 'gemini-3.7-flash');
  assert.equal(evidence.deployment.model_backend, 'Vertex AI');
  assert.equal(evidence.deployment.compute, 'Cloud Run');
});

check('G07', 'Cloud evidence contains repeated non-zero model usage', () => {
  assert.ok(evidence.cloud_run_runs.length >= 3);
  for (const run of evidence.cloud_run_runs) {
    assert.ok(run.model_usage.prompt_tokens > 0);
    assert.ok(run.model_usage.candidate_tokens > 0);
    assert.equal(run.critical_errors, 0);
  }
});

check('G08', 'README and disclosure state the real Gemini boundary', () => {
  const readme = files['README.md'];
  assert.match(readme, /Gemini is a required runtime stage/);
  assert.match(readme, /Model versus deterministic code/);
  assert.match(readme, /local deterministic extractor[\s\S]*test-only/i);
});

check('G09', 'Architecture and submission show ADK to Vertex before gates', () => {
  const diagram = files['docs/assets/architecture.svg'];
  const submission = files['docs/devpost-submission-draft.md'];
  const ui = files['src/public/app.js'];
  assert.match(diagram, /ADK → VERTEX AI MODEL CALL/);
  assert.match(diagram, /VERTEX AI · REAL CALL/);
  assert.match(submission, /Mandatory Google stack proof/);
  assert.match(submission, /non-zero ADK input\/output usage/);
  assert.match(ui, /Gemini structures evidence/);
});

check('G10', 'Demo requires a fresh live run and same-run Gemini proof', () => {
  const demo = files['docs/demo-script.md'];
  assert.match(demo, /not the proof run/);
  assert.match(demo, /model_events\[\]\.usage_metadata/);
  assert.match(demo, /same run ID/i);
});

console.log(JSON.stringify({
  gate: 'mandatory-google-stack',
  status: 'PASS',
  pass_count: checks.length,
  fail_count: 0,
  checks,
}, null, 2));
