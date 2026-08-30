import assert from 'node:assert/strict';
import {sha256} from '../core/hash.js';

function check(id, name, critical, operation) {
  try {
    operation();
    return {id, name, critical, status: 'PASS'};
  } catch (error) {
    return {id, name, critical, status: 'FAIL', error: error.message};
  }
}

function allAssertions(dossier) {
  return dossier.matters.flatMap((matter) => matter.assertions);
}

function matterByLabel(dossier, label) {
  return dossier.matters.find((matter) => matter.label === label);
}

function actionFor(dossier, matter) {
  return dossier.actions.find((action) => action.matter_id === matter?.matter_id);
}

function sourceIndex(manifest) {
  const index = new Map();
  for (const document of manifest.documents) {
    for (const page of document.pages ?? []) {
      index.set(`${document.document_id}:${page.page_number}`, {document, page});
    }
  }
  return index;
}

function assertRemoteSource(source, index) {
  const original = index.get(`${source.document_id}:${source.page_number}`);
  assert.ok(original, 'cited document and page must exist in the golden batch');
  assert.equal(source.document_sha256, original.document.sha256);
  assert.equal(source.page_text_sha256, original.page.normalized_text_sha256);
  assert.equal(
    original.page.normalized_text.slice(source.normalized_start, source.normalized_end),
    source.fragment,
  );
  assert.equal(source.fragment_sha256, sha256(source.fragment));
}

export function evaluateRemoteGolden({health, dossier, report, manifest, fixtureManifest}) {
  const index = sourceIndex(manifest);
  const assertions = allAssertions(dossier);
  const tests = [
    check('T00', 'private service reports the frozen ADK/Vertex stack', true, () => {
      assert.equal(health.agent, 'ExpedienteAgent');
      assert.equal(health.adk, '@google/adk');
      assert.equal(health.model, 'gemini-3.7-flash');
      assert.equal(health.extractor_mode, 'vertex-adk');
      assert.equal(health.storage, 'gcs-private-temporary');
      assert.equal(health.vertex_configured, true);
      assert.equal(health.cloud_storage_configured, true);
    }),
    check('T01/T02', 'the two procedures remain separated', true, () => {
      assert.equal(dossier.matters.length, fixtureManifest.expected.matters);
      assert.deepEqual(
        new Set(dossier.matters.map((matter) => matter.label)),
        new Set(['MON-042/2026', 'JVB-118/2023']),
      );
      assert.ok(
        dossier.matters.every(
          (matter) => matter.anchor_keys.filter((key) => key.kind === 'PROCEDURE').length === 1,
        ),
      );
    }),
    check('T03', 'contradictory amounts retain semantic roles', true, () => {
      const matter = matterByLabel(dossier, 'MON-042/2026');
      const maturity = matter.amount_ledger.find((entry) => entry.role === 'at_maturity');
      const claimed = matter.amount_ledger.find((entry) => entry.role === 'claimed');
      assert.equal(maturity.amount, '183.00');
      assert.equal(claimed.amount, '565.20');
      assert.equal(claimed.assertion_kind, 'PARTY_ALLEGATION');
    }),
    check('T04', 'claims are never promoted to recognized facts', true, () => {
      const claims = assertions.filter((assertion) =>
        ['amount.claimed', 'amount.default_interest_claimed', 'obligation.claimed'].includes(
          assertion.predicate,
        ),
      );
      assert.ok(claims.length >= 3);
      assert.ok(claims.every((assertion) => assertion.assertion_kind === 'PARTY_ALLEGATION'));
      assert.ok(claims.every((assertion) => assertion.asserted_by));
    }),
    check('T05', 'counterparty deadline is not assigned to the subject', true, () => {
      const matter = matterByLabel(dossier, 'MON-042/2026');
      const directive = matter.assertions.find(
        (assertion) => assertion.predicate === 'deadline.directive',
      );
      const action = actionFor(dossier, matter);
      assert.equal(directive.target_party, fixtureManifest.expected.counterparty_deadline_target);
      assert.notEqual(directive.target_party, fixtureManifest.subject_party);
      assert.equal(action.deadline, null);
      assert.equal(action.action_type, 'MONITOR_NEW_NOTICE');
    }),
    check('T06', 'the exact duplicate is linked and excluded', false, () => {
      assert.equal(dossier.duplicate_assignments.length, fixtureManifest.expected.duplicates);
      assert.ok(dossier.duplicate_assignments[0].duplicate_of);
      assert.equal(report.metrics.duplicate_files, fixtureManifest.expected.duplicates);
    }),
    check('T07', 'the undated event remains undated', false, () => {
      const undated = matterByLabel(dossier, 'MON-042/2026').undated_timeline;
      assert.ok(undated.length >= 1);
      assert.ok(undated.every((event) => !event.date));
    }),
    check('T08', 'recognized amount cites the exact page and fragment', true, () => {
      const recognized = assertions.find((assertion) => assertion.predicate === 'amount.recognized');
      const source = recognized.evidence_refs[0];
      assert.equal(source.page_number, fixtureManifest.expected.page_specific_fact.page);
      assert.equal(source.fragment, fixtureManifest.expected.page_specific_fact.fragment);
      assertRemoteSource(source, index);
    }),
    check('T09', 'tampered provenance fails and missing evidence requires review', true, () => {
      const tampered = structuredClone(assertions[0].evidence_refs[0]);
      tampered.fragment = 'THIS TEXT DOES NOT EXIST ON THE PAGE';
      assert.throws(() => assertRemoteSource(tampered, index));
      const missing = assertions.find((assertion) => assertion.predicate === 'evidence.missing');
      assert.ok(missing.needs_human_review);
      assert.ok(missing.review_reasons.includes('MISSING_EVIDENCE'));
    }),
    check('T10', 'safe actions are reconstructed for both matters', true, () => {
      assert.equal(
        actionFor(dossier, matterByLabel(dossier, 'MON-042/2026')).action_type,
        'MONITOR_NEW_NOTICE',
      );
      assert.equal(
        actionFor(dossier, matterByLabel(dossier, 'JVB-118/2023')).action_type,
        'NO_ACTION',
      );
    }),
    check('T12', 'the page without text creates no assertions', false, () => {
      const scanned = manifest.documents.find(
        (document) => document.display_name === 'C00_scan_without_text.pdf',
      );
      assert.equal(scanned.text_quality, 'TEXT_LAYER_MISSING');
      assert.ok(dossier.unclassified_document_ids.includes(scanned.document_id));
      assert.ok(
        assertions.every(
          (assertion) => assertion.evidence_refs[0]?.document_id !== scanned.document_id,
        ),
      );
    }),
    check('T13', 'all supported assertions have complete immutable provenance', true, () => {
      assert.equal(report.metrics.supported_without_valid_citation, 0);
      assert.equal(report.metrics.critical_errors, 0);
      for (const assertion of assertions) {
        if (assertion.verification_status !== 'SUPPORTED') continue;
        assert.ok(assertion.evidence_refs.length >= 1);
        for (const source of assertion.evidence_refs) assertRemoteSource(source, index);
      }
    }),
    check('E2E', 'Cloud Run persisted the complete result in private GCS', true, () => {
      assert.equal(report.status, 'COMPLETED');
      assert.ok(report.stages.every((stage) => stage.status === 'PASS'));
      assert.equal(report.metrics.accepted_assertions, 31);
      assert.equal(report.metrics.rejected_assertions, 0);
      assert.equal(report.metrics.matters, 2);
      assert.match(report.artifacts.dossier_uri, /^gs:\/\/.*\/dossier\.json$/);
      assert.match(report.artifacts.report_uri, /^gs:\/\/.*\/run_report\.json$/);
    }),
  ];

  return {
    tests,
    pass_count: tests.filter((test) => test.status === 'PASS').length,
    fail_count: tests.filter((test) => test.status === 'FAIL').length,
    critical_failures: tests.filter((test) => test.critical && test.status === 'FAIL').length,
    all_pass: tests.every((test) => test.status === 'PASS'),
  };
}
