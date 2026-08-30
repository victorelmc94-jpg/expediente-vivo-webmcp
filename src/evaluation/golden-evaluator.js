import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertCompleteProvenance, validateAssertionCandidates} from '../provenance/validate.js';

function runCheck(id, name, critical, operation) {
  try {
    operation();
    return {id, name, critical, status: 'PASS'};
  } catch (error) {
    return {
      id,
      name,
      critical,
      status: 'FAIL',
      error: error.message,
    };
  }
}

function assertions(result) {
  return result.dossier.matters.flatMap((matter) => matter.assertions);
}

function matterByLabel(result, label) {
  return result.dossier.matters.find((matter) => matter.label === label);
}

function actionFor(result, matter) {
  return result.dossier.actions.find((action) => action.matter_id === matter?.matter_id);
}

export function evaluateGoldenResult({result, fixtureManifest}) {
  const checks = [
    runCheck('T00', 'single ADK agent uses Gemini 3.7 Flash on Vertex AI', true, () => {
      assert.equal(result.report.extractor_mode, 'vertex-adk');
      assert.equal(result.report.model, 'gemini-3.7-flash');
      assert.ok(result.report.model_events.length >= 1);
      assert.ok(result.report.model_events.every((event) => event.author === 'ExpedienteAgent'));
    }),
    runCheck('T01/T02', 'two procedures remain in separate matters', true, () => {
      assert.equal(result.dossier.matters.length, fixtureManifest.expected.matters);
      for (const matter of result.dossier.matters) {
        assert.equal(matter.anchor_keys.filter((key) => key.kind === 'PROCEDURE').length, 1);
      }
      assert.deepEqual(
        new Set(result.dossier.matters.map((matter) => matter.label)),
        new Set(['MON-042/2026', 'JVB-118/2023']),
      );
    }),
    runCheck('T03', 'contradictory amounts retain distinct semantic roles', true, () => {
      const matter = matterByLabel(result, 'MON-042/2026');
      const maturity = matter.amount_ledger.find((entry) => entry.role === 'at_maturity');
      const claimed = matter.amount_ledger.find((entry) => entry.role === 'claimed');
      assert.equal(maturity.amount, '183.00');
      assert.equal(claimed.amount, '565.20');
      assert.equal(claimed.assertion_kind, 'PARTY_ALLEGATION');
    }),
    runCheck('T04', 'claims are never promoted to recognized debt', true, () => {
      const claimed = assertions(result).filter((assertion) =>
        ['amount.claimed', 'amount.default_interest_claimed', 'obligation.claimed'].includes(
          assertion.predicate,
        ),
      );
      assert.ok(claimed.length >= 3);
      assert.ok(claimed.every((assertion) => assertion.assertion_kind === 'PARTY_ALLEGATION'));
      assert.ok(claimed.every((assertion) => assertion.asserted_by));
    }),
    runCheck('T05', 'counterparty deadline is not assigned to the subject', true, () => {
      const matter = matterByLabel(result, 'MON-042/2026');
      const directive = matter.assertions.find(
        (assertion) => assertion.predicate === 'deadline.directive',
      );
      const action = actionFor(result, matter);
      assert.equal(directive.target_party, fixtureManifest.expected.counterparty_deadline_target);
      assert.notEqual(directive.target_party, fixtureManifest.subject_party);
      assert.equal(action.deadline, null);
      assert.equal(action.action_type, 'MONITOR_NEW_NOTICE');
    }),
    runCheck('T06', 'exact duplicate is excluded and linked', false, () => {
      assert.equal(result.manifest.duplicate_files, fixtureManifest.expected.duplicates);
      assert.equal(result.dossier.duplicate_assignments.length, 1);
      assert.ok(result.dossier.duplicate_assignments[0].duplicate_of);
    }),
    runCheck('T07', 'undated evidence remains explicitly undated', false, () => {
      const undated = result.extraction.analyses.find(
        (analysis) =>
          analysis.review_reasons.includes('DOCUMENT_DATE_UNKNOWN') &&
          analysis.references.some((reference) => reference.value === 'MON-042/2026'),
      );
      assert.ok(undated);
      assert.equal(undated.document_date, null);
      assert.ok(matterByLabel(result, 'MON-042/2026').undated_timeline.length >= 1);
    }),
    runCheck('T08', 'recognized amount cites the exact page and fragment', true, () => {
      const recognized = assertions(result).find(
        (assertion) => assertion.predicate === 'amount.recognized',
      );
      const source = recognized.evidence_refs[0];
      assert.equal(source.page_number, fixtureManifest.expected.page_specific_fact.page);
      assert.equal(source.fragment, fixtureManifest.expected.page_specific_fact.fragment);
      assert.ok(source.normalized_start >= 0);
      assert.ok(source.normalized_end > source.normalized_start);
      assert.match(source.fragment_sha256, /^[0-9a-f]{64}$/);
    }),
    runCheck('T09', 'forged or non-canonical evidence degrades safely', true, () => {
      const tampered = structuredClone(result.extraction.candidates[0]);
      tampered.evidence_refs[0].fragment = 'THIS TEXT DOES NOT EXIST ON THE PAGE';
      const tamperedValidation = validateAssertionCandidates(result.manifest, [tampered]);
      assert.equal(tamperedValidation.accepted.length, 0);
      assert.equal(tamperedValidation.rejected[0].code, 'SOURCE_FRAGMENT_MISMATCH');
      const nonCanonical = structuredClone(result.extraction.candidates[0]);
      nonCanonical.predicate = 'STATUS';
      const vocabularyValidation = validateAssertionCandidates(result.manifest, [nonCanonical]);
      assert.equal(vocabularyValidation.accepted.length, 0);
      assert.equal(vocabularyValidation.rejected[0].code, 'INVALID_ENUM');
      assert.ok(result.dossier.matters.flatMap((matter) => matter.missing_evidence).length >= 1);
    }),
    runCheck('T10', 'safe next action is reconstructed for both matters', true, () => {
      assert.equal(actionFor(result, matterByLabel(result, 'MON-042/2026')).action_type, 'MONITOR_NEW_NOTICE');
      assert.equal(actionFor(result, matterByLabel(result, 'JVB-118/2023')).action_type, 'NO_ACTION');
    }),
    runCheck('T12', 'page without text produces review, not assertions', false, () => {
      const scanned = result.manifest.documents.find(
        (document) => document.display_name === 'C00_scan_without_text.pdf',
      );
      assert.equal(scanned.text_quality, 'TEXT_LAYER_MISSING');
      assert.ok(result.dossier.unclassified_document_ids.includes(scanned.document_id));
      assert.ok(
        assertions(result).every(
          (assertion) => assertion.evidence_refs[0]?.document_id !== scanned.document_id,
        ),
      );
    }),
    runCheck('T13', 'all supported assertions have complete immutable provenance', true, () => {
      assert.deepEqual(assertCompleteProvenance(result.validation.accepted), {
        pass: true,
        assertions_checked: result.validation.accepted.length,
      });
      assert.equal(result.validation.rejected.length, 0);
      assert.equal(result.report.metrics.supported_without_valid_citation, 0);
      assert.equal(result.report.metrics.critical_errors, 0);
      for (const assertion of assertions(result)) {
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
    }),
    runCheck('E2E', 'all stages pass and private GCS artifacts exist', true, () => {
      assert.ok(result.report.stages.every((stage) => stage.status === 'PASS'));
      assert.equal(result.report.status, 'COMPLETED');
      assert.equal(result.report.metrics.critical_errors, 0);
      assert.match(result.report.artifacts.dossier_uri, /^gs:\/\/.*\/dossier\.json$/);
      assert.match(result.report.artifacts.report_uri, /^gs:\/\/.*\/run_report\.json$/);
    }),
  ];

  return {
    tests: checks,
    pass_count: checks.filter((check) => check.status === 'PASS').length,
    fail_count: checks.filter((check) => check.status === 'FAIL').length,
    critical_failures: checks.filter(
      (check) => check.critical && check.status === 'FAIL',
    ).length,
    all_pass: checks.every((check) => check.status === 'PASS'),
  };
}

export function contractSignature(result) {
  const contract = result.dossier.matters
    .map((matter) => ({
      label: matter.label,
      state: matter.matter_state,
      document_ids: [...matter.document_ids].sort(),
      action: actionFor(result, matter)?.action_type ?? null,
      assertions: matter.assertions
        .map((assertion) => ({
          predicate: assertion.predicate,
          assertion_kind: assertion.assertion_kind,
          value: assertion.value,
          asserted_by: assertion.asserted_by,
          target_party: assertion.target_party,
          verification_status: assertion.verification_status,
          evidence: assertion.evidence_refs.map((source) => ({
            document_id: source.document_id,
            page_number: source.page_number,
            fragment: source.fragment,
          })),
        }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}
