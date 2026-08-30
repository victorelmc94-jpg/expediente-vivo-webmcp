import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {rootAgent} from '../../src/agent/expediente-agent.js';
import {DeterministicDevExtractor} from '../../src/agent/deterministic-dev-extractor.js';
import {inspectBatch} from '../../src/pdf/ingest.js';
import {runVerticalSlice} from '../../src/pipeline/run-vertical-slice.js';
import {
  assertCompleteProvenance,
  validateAssertionCandidates,
} from '../../src/provenance/validate.js';
import {LocalArtifactStore} from '../../src/storage/local-artifact-store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = path.join(root, 'fixtures', 'golden');
const fixtureManifest = JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const files = await Promise.all(
  fixtureManifest.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);

const extractor = new DeterministicDevExtractor();
const manifest = await inspectBatch(files);
const extraction = await extractor.extract(manifest);
const validation = validateAssertionCandidates(manifest, extraction.candidates);
const result = await runVerticalSlice({
  files,
  extractor,
  artifactStore: new LocalArtifactStore({rootDirectory: path.join(root, 'artifacts', 'tests')}),
  subjectParty: fixtureManifest.subject_party,
});

test('ADK root agent is present and fixed to Gemini 3.7 Flash', () => {
  assert.equal(rootAgent.name, 'ExpedienteAgent');
  assert.equal(rootAgent.canonicalModel.model, 'gemini-3.7-flash');
});

test('T01/T02 keeps the two procedures in separate matters', () => {
  assert.equal(result.dossier.matters.length, fixtureManifest.expected.matters);
  for (const matter of result.dossier.matters) {
    const procedures = matter.anchor_keys.filter((key) => key.kind === 'PROCEDURE');
    assert.equal(procedures.length, 1);
  }
  assert.deepEqual(
    new Set(result.dossier.matters.map((matter) => matter.label)),
    new Set(['MON-042/2026', 'JVB-118/2023']),
  );
});

test('T03 keeps contradictory amounts separated by semantic role', () => {
  const matter = result.dossier.matters.find((item) => item.label === 'MON-042/2026');
  const maturity = matter.amount_ledger.find((entry) => entry.role === 'at_maturity');
  const claimed = matter.amount_ledger.find((entry) => entry.role === 'claimed');
  assert.equal(maturity.amount, '183.00');
  assert.equal(claimed.amount, '565.20');
  assert.equal(claimed.assertion_kind, 'PARTY_ALLEGATION');
});

test('T04 never promotes a claimed debt to documentary fact', () => {
  const claimed = result.dossier.matters
    .flatMap((matter) => matter.assertions)
    .filter((assertion) =>
      ['amount.claimed', 'amount.default_interest_claimed', 'obligation.claimed'].includes(
        assertion.predicate,
      ),
    );
  assert.ok(claimed.length >= 3);
  assert.ok(claimed.every((assertion) => assertion.assertion_kind === 'PARTY_ALLEGATION'));
  assert.ok(claimed.every((assertion) => assertion.asserted_by));
});

test('T05 does not assign the counterparty five-day deadline to the subject', () => {
  const matter = result.dossier.matters.find((item) => item.label === 'MON-042/2026');
  const directive = matter.assertions.find((assertion) => assertion.predicate === 'deadline.directive');
  const action = result.dossier.actions.find((item) => item.matter_id === matter.matter_id);
  assert.equal(directive.target_party, fixtureManifest.expected.counterparty_deadline_target);
  assert.notEqual(directive.target_party, fixtureManifest.subject_party);
  assert.equal(action.deadline, null);
  assert.equal(action.action_type, 'MONITOR_NEW_NOTICE');
});

test('T06 excludes the exact duplicate from analysis and event counts', () => {
  assert.equal(manifest.duplicate_files, fixtureManifest.expected.duplicates);
  assert.equal(result.dossier.duplicate_assignments.length, 1);
  assert.ok(result.dossier.duplicate_assignments[0].duplicate_of);
});

test('T07 preserves the undated document as undated', () => {
  const undated = extraction.analyses.find((analysis) =>
    analysis.review_reasons.includes('DOCUMENT_DATE_UNKNOWN') &&
    analysis.references.some((reference) => reference.value === 'MON-042/2026'),
  );
  assert.ok(undated);
  assert.equal(undated.document_date, null);
  const matter = result.dossier.matters.find((item) => item.label === 'MON-042/2026');
  assert.ok(matter.undated_timeline.length >= 1);
});

test('T08 cites the exact page and fragment for the recognized amount', () => {
  const assertion = result.dossier.matters
    .flatMap((matter) => matter.assertions)
    .find((item) => item.predicate === 'amount.recognized');
  assert.equal(assertion.evidence_refs[0].page_number, 2);
  assert.equal(
    assertion.evidence_refs[0].fragment,
    fixtureManifest.expected.page_specific_fact.fragment,
  );
  assert.ok(assertion.evidence_refs[0].normalized_start >= 0);
  assert.ok(assertion.evidence_refs[0].normalized_end > assertion.evidence_refs[0].normalized_start);
  assert.match(assertion.evidence_refs[0].fragment_sha256, /^[0-9a-f]{64}$/);
});

test('T09 rejects a forged fragment and records insufficient evidence safely', () => {
  const tampered = structuredClone(extraction.candidates[0]);
  tampered.evidence_refs[0].fragment = 'THIS TEXT DOES NOT EXIST ON THE PAGE';
  const tamperedValidation = validateAssertionCandidates(manifest, [tampered]);
  assert.equal(tamperedValidation.accepted.length, 0);
  assert.equal(tamperedValidation.rejected[0].code, 'SOURCE_FRAGMENT_MISMATCH');
  const nonCanonical = structuredClone(extraction.candidates[0]);
  nonCanonical.predicate = 'STATUS';
  const vocabularyValidation = validateAssertionCandidates(manifest, [nonCanonical]);
  assert.equal(vocabularyValidation.accepted.length, 0);
  assert.equal(vocabularyValidation.rejected[0].code, 'INVALID_ENUM');
  const missing = result.dossier.matters.flatMap((matter) => matter.missing_evidence);
  assert.ok(missing.length >= 1);
});

test('T10 reconstructs the safe next step for both matters', () => {
  const byLabel = new Map(
    result.dossier.matters.map((matter) => [
      matter.label,
      result.dossier.actions.find((action) => action.matter_id === matter.matter_id),
    ]),
  );
  assert.equal(byLabel.get('MON-042/2026').action_type, 'MONITOR_NEW_NOTICE');
  assert.equal(byLabel.get('JVB-118/2023').action_type, 'NO_ACTION');
});

test('T12 flags the page without text instead of accepting assertions from it', () => {
  const scanned = manifest.documents.find((document) =>
    document.display_name === 'C00_scan_without_text.pdf',
  );
  assert.equal(scanned.text_quality, 'TEXT_LAYER_MISSING');
  assert.ok(
    result.dossier.unclassified_document_ids.includes(scanned.document_id),
  );
  const assertions = result.dossier.matters.flatMap((matter) => matter.assertions);
  assert.ok(assertions.every((assertion) => assertion.evidence_refs[0]?.document_id !== scanned.document_id));
});

test('T13 enforces 100% document + page + fragment + offsets + hashes', () => {
  assert.deepEqual(assertCompleteProvenance(validation.accepted), {
    pass: true,
    assertions_checked: validation.accepted.length,
  });
  assert.equal(validation.rejected.length, 0);
  assert.equal(result.report.metrics.supported_without_valid_citation, 0);
  assert.equal(result.report.metrics.critical_errors, 0);
  for (const assertion of result.dossier.matters.flatMap((matter) => matter.assertions)) {
    if (assertion.verification_status !== 'SUPPORTED') continue;
    for (const source of assertion.evidence_refs) {
      assert.ok(source.document_id);
      assert.ok(source.document_sha256);
      assert.ok(source.page_number >= 1);
      assert.ok(source.fragment);
      assert.ok(source.normalized_start >= 0);
      assert.ok(source.normalized_end > source.normalized_start);
      assert.match(source.fragment_sha256, /^[0-9a-f]{64}$/);
      assert.match(source.page_text_sha256, /^[0-9a-f]{64}$/);
    }
  }
});

test('all vertical-slice stages pass and artifacts are persisted', async () => {
  assert.ok(result.report.stages.every((stage) => stage.status === 'PASS'));
  assert.equal(result.report.status, 'COMPLETED');
  assert.equal(result.report.metrics.critical_errors, 0);
  assert.ok(result.report.artifacts.dossier_uri.endsWith('dossier.json'));
  const dossier = JSON.parse(await readFile(result.report.artifacts.dossier_uri, 'utf8'));
  assert.equal(dossier.run_id, result.run_id);
});
