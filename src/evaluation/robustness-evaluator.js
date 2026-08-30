import assert from 'node:assert/strict';
import {sha256} from '../core/hash.js';
import {normalizePartyName} from '../core/text.js';

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

function canonicalDocumentsByName(manifest) {
  return new Map(
    manifest.documents
      .filter((document) => !document.duplicate_of)
      .map((document) => [document.display_name, document]),
  );
}

function sourceDocumentIndex(manifest) {
  return new Map(
    manifest.documents
      .filter((document) => !document.duplicate_of)
      .map((document) => [document.document_id, document]),
  );
}

function sourceFile(assertion, documentsById) {
  return documentsById.get(assertion.evidence_refs[0]?.document_id)?.display_name ?? null;
}

function assertionsFrom(assertions, documentsById, filename) {
  return assertions.filter((assertion) => sourceFile(assertion, documentsById) === filename);
}

function valueMatches(actual, expected) {
  if (!actual || actual.type !== expected.type) return false;
  if (expected.type === 'MONEY') {
    return actual.amount === expected.amount && actual.currency === expected.currency;
  }
  if (expected.type === 'DATE') return actual.iso === expected.iso;
  return actual.text === expected.text;
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : 100;
}

function assertProvenance(source, manifestIndex) {
  const document = manifestIndex.get(source.document_id);
  assert.ok(document, 'cited document must exist in the submitted batch');
  const page = document.pages.find((candidate) => candidate.page_number === source.page_number);
  assert.ok(page, 'cited page must exist in the cited document');
  assert.equal(source.document_sha256, document.sha256);
  assert.equal(source.page_text_sha256, page.normalized_text_sha256);
  assert.ok(Number.isInteger(source.normalized_start));
  assert.ok(Number.isInteger(source.normalized_end));
  assert.equal(
    page.normalized_text.slice(source.normalized_start, source.normalized_end),
    source.fragment,
  );
  assert.equal(source.fragment_sha256, sha256(source.fragment));
}

function factMatches(assertion, expected, documentsById) {
  return sourceFile(assertion, documentsById) === expected.file &&
    assertion.predicate === expected.predicate &&
    assertion.assertion_kind === expected.assertion_kind &&
    valueMatches(assertion.value, expected.value) &&
    assertion.evidence_refs.some((source) =>
      source.page_number === expected.page && source.fragment === expected.fragment);
}

function allegationMatches(assertion, expected, documentsById) {
  if (
    sourceFile(assertion, documentsById) !== expected.file ||
    assertion.predicate !== expected.predicate ||
    assertion.assertion_kind !== 'PARTY_ALLEGATION' ||
    normalizePartyName(assertion.asserted_by) !== normalizePartyName(expected.asserted_by)
  ) return false;
  return expected.amount === undefined || assertion.value?.amount === expected.amount;
}

export function evaluateRobustnessResult({
  health,
  dossier,
  report,
  manifest,
  groundTruth,
}) {
  const expected = groundTruth.expected;
  const assertions = allAssertions(dossier);
  const documentsByName = canonicalDocumentsByName(manifest);
  const documentsById = sourceDocumentIndex(manifest);
  const assertionsById = new Map(assertions.map((assertion) => [assertion.assertion_id, assertion]));

  const matchedFacts = expected.core_facts.filter((fact) =>
    assertions.some((assertion) => factMatches(assertion, fact, documentsById)));
  const scopedFactPredicates = new Set(expected.core_facts.map((fact) => fact.predicate));
  const actualScopedFacts = assertions.filter((assertion) =>
    assertion.assertion_kind === 'DOCUMENT_FACT' && scopedFactPredicates.has(assertion.predicate));
  const unexpectedScopedFacts = actualScopedFacts.filter((assertion) =>
    !expected.core_facts.some((fact) => factMatches(assertion, fact, documentsById)));

  const matchedAllegations = expected.allegations.filter((allegation) =>
    assertions.some((assertion) => allegationMatches(assertion, allegation, documentsById)));
  const claimPredicates = new Set([
    'amount.claimed',
    'amount.default_interest_claimed',
    'obligation.claimed',
  ]);
  const actualClaims = assertions.filter((assertion) => claimPredicates.has(assertion.predicate));
  const unexpectedClaims = actualClaims.filter((assertion) =>
    !expected.allegations.some((allegation) =>
      allegationMatches(assertion, allegation, documentsById)));

  const expectedDatedEntries = Object.entries(expected.document_dates);
  const correctDates = expectedDatedEntries.filter(([filename, iso]) => {
    const dateAssertions = assertionsFrom(assertions, documentsById, filename)
      .filter((assertion) => assertion.predicate === 'document.date');
    return iso === null
      ? dateAssertions.length === 0
      : dateAssertions.some((assertion) => assertion.value?.iso === iso);
  });

  const amountExpectations = [
    ...expected.core_facts
      .filter((fact) => fact.value.type === 'MONEY')
      .map((fact) => ({file: fact.file, predicate: fact.predicate, amount: fact.value.amount})),
    ...expected.allegations
      .filter((allegation) => allegation.amount)
      .map((allegation) => ({
        file: allegation.file,
        predicate: allegation.predicate,
        amount: allegation.amount,
      })),
  ];
  const correctAmounts = amountExpectations.filter((item) =>
    assertionsFrom(assertions, documentsById, item.file).some((assertion) =>
      assertion.predicate === item.predicate && assertion.value?.amount === item.amount));

  const supported = assertions.filter((assertion) => assertion.verification_status === 'SUPPORTED');
  const provenanceRefs = supported.flatMap((assertion) => assertion.evidence_refs);
  let validProvenanceRefs = 0;
  for (const source of provenanceRefs) {
    try {
      assertProvenance(source, documentsById);
      validProvenanceRefs += 1;
    } catch {
      // Counted by the provenance check below.
    }
  }

  const metrics = {
    fact_accuracy_pct: percentage(matchedFacts.length, expected.core_facts.length),
    fact_precision_pct: percentage(
      actualScopedFacts.length - unexpectedScopedFacts.length,
      actualScopedFacts.length,
    ),
    allegation_accuracy_pct: percentage(matchedAllegations.length, expected.allegations.length),
    chronology_date_accuracy_pct: percentage(correctDates.length, expectedDatedEntries.length),
    amount_accuracy_pct: percentage(correctAmounts.length, amountExpectations.length),
    provenance_coverage_pct: percentage(validProvenanceRefs, provenanceRefs.length),
    supported_assertions: supported.length,
    provenance_refs_checked: provenanceRefs.length,
    unexpected_scoped_facts: unexpectedScopedFacts.length,
    unexpected_claims: unexpectedClaims.length,
  };

  const checks = [
    check('R00', 'frozen private Cloud Run stack is active', true, () => {
      assert.equal(health.agent, 'ExpedienteAgent');
      assert.equal(health.adk, '@google/adk');
      assert.equal(health.model, 'gemini-3.7-flash');
      assert.equal(health.extractor_mode, 'vertex-adk');
      assert.equal(health.storage, 'gcs-private-temporary');
    }),
    check('R01', 'independent dataset composition is preserved', false, () => {
      assert.equal(manifest.total_files, 11);
      assert.equal(manifest.canonical_files, 10);
      assert.equal(manifest.duplicate_files, 1);
      assert.equal(manifest.canonical_pages, 14);
      assert.equal(groundTruth.authored_before_model_execution, true);
    }),
    check('R02', 'the two independent matters remain separated', true, () => {
      assert.deepEqual(
        new Set(dossier.matters.map((matter) => matter.label)),
        new Set(expected.matters.map((matter) => matter.label)),
      );
      for (const matter of dossier.matters) {
        assert.equal(matter.anchor_keys.filter((key) => key.kind === 'PROCEDURE').length, 1);
      }
      const assigned = dossier.matters.flatMap((matter) => matter.document_ids);
      assert.equal(new Set(assigned).size, assigned.length);
    }),
    check('R03', 'core documentary facts match ground truth exactly', true, () => {
      assert.equal(matchedFacts.length, expected.core_facts.length);
      assert.equal(unexpectedScopedFacts.length, 0);
      assert.equal(metrics.fact_accuracy_pct, 100);
      assert.equal(metrics.fact_precision_pct, 100);
    }),
    check('R04', 'party allegations remain allegations with the right speaker', true, () => {
      assert.equal(matchedAllegations.length, expected.allegations.length);
      assert.equal(unexpectedClaims.length, 0);
      assert.ok(actualClaims.every((assertion) => assertion.assertion_kind === 'PARTY_ALLEGATION'));
      assert.equal(metrics.allegation_accuracy_pct, 100);
    }),
    check('R05', 'varied dates and chronology are normalized safely', true, () => {
      assert.equal(correctDates.length, expectedDatedEntries.length);
      assert.equal(metrics.chronology_date_accuracy_pct, 100);
      for (const matter of dossier.matters) {
        const dates = matter.timeline.map((event) => event.date);
        assert.deepEqual(dates, [...dates].sort());
        for (const event of matter.timeline) {
          const assertion = assertionsById.get(event.assertion_ids[0]);
          const filename = sourceFile(assertion, documentsById);
          assert.equal(event.date, expected.document_dates[filename]);
        }
      }
      assert.equal(
        assertionsFrom(assertions, documentsById, expected.undated.file)
          .filter((assertion) => assertion.predicate === 'document.date').length,
        0,
      );
    }),
    check('R06', 'all expected monetary forms normalize to exact amounts', true, () => {
      assert.equal(correctAmounts.length, amountExpectations.length);
      assert.equal(metrics.amount_accuracy_pct, 100);
    }),
    check('R07', 'states and next actions follow the frozen contract', true, () => {
      for (const matterExpectation of expected.matters) {
        const matter = matterByLabel(dossier, matterExpectation.label);
        assert.equal(matter.matter_state, matterExpectation.state);
        assert.equal(actionFor(dossier, matter).action_type, matterExpectation.action);
      }
    }),
    check('R08', 'counterparty deadline is not assigned to the subject', true, () => {
      const directive = assertionsFrom(assertions, documentsById, expected.deadline.file)
        .find((assertion) => assertion.predicate === 'deadline.directive');
      assert.ok(directive);
      assert.equal(normalizePartyName(directive.target_party), expected.deadline.target_party);
      assert.notEqual(normalizePartyName(directive.target_party), expected.deadline.not_target_party);
      assert.ok(directive.evidence_refs.some((source) =>
        source.page_number === expected.deadline.page &&
        source.fragment === expected.deadline.fragment));
      const matter = matterByLabel(dossier, expected.contradiction.matter);
      assert.equal(actionFor(dossier, matter).deadline, null);
    }),
    check('R09', 'renamed exact duplicate is linked and excluded', false, () => {
      const duplicate = manifest.documents.find((document) =>
        document.display_name === expected.duplicates[0].file);
      const original = documentsByName.get(expected.duplicates[0].duplicate_of);
      assert.ok(duplicate.duplicate_of);
      assert.equal(duplicate.sha256, original.sha256);
      assert.equal(dossier.duplicate_assignments.length, 1);
    }),
    check('R10', 'documentary contradiction remains unresolved and makes state uncertain', true, () => {
      const matter = matterByLabel(dossier, expected.contradiction.matter);
      const conflict = matter.conflicts.find((item) =>
        item.predicate === expected.contradiction.predicate);
      assert.ok(conflict);
      assert.equal(conflict.status, expected.contradiction.expected_resolution);
      assert.equal(conflict.requires_human_review, true);
      assert.deepEqual(
        new Set(conflict.alternatives.map((alternative) => alternative.value.text)),
        new Set(expected.contradiction.values),
      );
      assert.equal(matter.matter_state, 'UNCERTAIN');
    }),
    check('R11', 'insufficient evidence degrades to review without invented results', true, () => {
      for (const item of expected.insufficient_evidence) {
        const fromFile = assertionsFrom(assertions, documentsById, item.file);
        assert.ok(fromFile.some((assertion) =>
          assertion.predicate === 'evidence.missing' &&
          assertion.needs_human_review &&
          assertion.review_reasons.some((reason) =>
            ['MISSING_EVIDENCE', 'INSUFFICIENT_EVIDENCE'].includes(reason))));
        assert.ok(!fromFile.some((assertion) => assertion.predicate === item.forbidden_predicate));
        assert.ok(!fromFile.some((assertion) => assertion.predicate.startsWith('amount.')));
      }
    }),
    check('R12', 'degraded text page produces review and no assertions', true, () => {
      const document = documentsByName.get(expected.degraded_page.file);
      const page = document.pages.find((candidate) =>
        candidate.page_number === expected.degraded_page.page);
      assert.equal(page.text_quality, expected.degraded_page.text_quality);
      assert.equal(assertionsFrom(assertions, documentsById, expected.degraded_page.file).length, 0);
      assert.ok(dossier.unclassified_document_ids.includes(document.document_id));
    }),
    check('R13', 'all supported assertions have complete immutable provenance', true, () => {
      assert.equal(report.metrics.supported_without_valid_citation, 0);
      assert.equal(report.metrics.critical_errors, 0);
      assert.equal(validProvenanceRefs, provenanceRefs.length);
      assert.equal(metrics.provenance_coverage_pct, 100);
      for (const assertion of supported) {
        if (assertion.assertion_kind !== 'AGENT_INFERENCE') {
          assert.ok(assertion.evidence_refs.length >= 1);
        }
        for (const source of assertion.evidence_refs) assertProvenance(source, documentsById);
      }
      assert.equal(assertions.filter((assertion) => assertion.assertion_kind === 'AGENT_INFERENCE').length, 0);
    }),
    check('R14', 'end-to-end result is complete and persisted in private GCS', true, () => {
      assert.ok(['COMPLETED', 'COMPLETED_WITH_REVIEW'].includes(report.status));
      assert.ok(report.stages.every((stage) => stage.status === 'PASS'));
      assert.equal(report.metrics.rejected_assertions, 0);
      assert.equal(report.metrics.critical_errors, 0);
      assert.match(report.artifacts.dossier_uri, /^gs:\/\/.*\/dossier\.json$/);
      assert.match(report.artifacts.report_uri, /^gs:\/\/.*\/run_report\.json$/);
    }),
  ];

  return {
    checks,
    metrics,
    pass_count: checks.filter((item) => item.status === 'PASS').length,
    fail_count: checks.filter((item) => item.status === 'FAIL').length,
    critical_failures: checks.filter((item) => item.critical && item.status === 'FAIL').length,
    all_pass: checks.every((item) => item.status === 'PASS'),
  };
}
