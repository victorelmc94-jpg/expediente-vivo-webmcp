import {ValidationError} from '../core/contracts.js';
import {stableId} from '../core/hash.js';
import {normalizePartyName} from '../core/text.js';
import {assertCompleteProvenance} from '../provenance/validate.js';

function documentDates(analyses) {
  return new Map(analyses.map((analysis) => [analysis.document_id, analysis.document_date]));
}

function firstDocumentId(assertion) {
  return assertion.evidence_refs[0]?.document_id ?? null;
}

function dateFor(assertion, dates) {
  return dates.get(firstDocumentId(assertion)) ?? null;
}

const CONFLICT_SENSITIVE_PREDICATES = new Set([
  'procedure.status',
  'amount.principal',
  'amount.at_maturity',
  'amount.recognized',
  'contract.maturity_date',
]);

function conflictsFor(matterId, assertions) {
  const byPredicate = new Map();
  for (const assertion of assertions) {
    if (
      assertion.verification_status !== 'SUPPORTED' ||
      !CONFLICT_SENSITIVE_PREDICATES.has(assertion.predicate)
    ) continue;
    if (!byPredicate.has(assertion.predicate)) byPredicate.set(assertion.predicate, []);
    byPredicate.get(assertion.predicate).push(assertion);
  }

  const conflicts = [];
  for (const [predicate, candidates] of byPredicate) {
    const distinctValues = new Set(candidates.map((assertion) => JSON.stringify(assertion.value)));
    if (distinctValues.size < 2) continue;
    const assertionIds = candidates.map((assertion) => assertion.assertion_id).sort();
    conflicts.push({
      conflict_id: stableId('conflict', matterId, predicate, ...assertionIds),
      predicate,
      status: 'UNRESOLVED',
      requires_human_review: true,
      assertion_ids: assertionIds,
      alternatives: candidates.map((assertion) => ({
        assertion_id: assertion.assertion_id,
        value: assertion.value,
        document_id: firstDocumentId(assertion),
      })),
    });
  }
  return conflicts;
}

function makeAction(matter, assertions, subjectParty) {
  if (matter.matter_state === 'CLOSED') {
    return {
      action_id: stableId('action', matter.matter_id, 'NO_ACTION'),
      matter_id: matter.matter_id,
      action_type: 'NO_ACTION',
      description: 'No pending action is derived from the supplied documents.',
      target_party: subjectParty,
      basis_assertion_ids: matter.state_basis_assertion_ids,
      deadline: null,
      prerequisites: [],
      status: 'NO_ACTION',
      requires_human_approval: false,
    };
  }

  const directives = assertions.filter((assertion) => assertion.predicate === 'deadline.directive');
  const userDirective = directives.find(
    (assertion) => normalizePartyName(assertion.target_party) === normalizePartyName(subjectParty),
  );
  if (userDirective) {
    return {
      action_id: stableId('action', matter.matter_id, userDirective.assertion_id),
      matter_id: matter.matter_id,
      action_type: 'REVIEW_DIRECTIVE',
      description: 'Review the documented directive before any external action.',
      target_party: subjectParty,
      basis_assertion_ids: [userDirective.assertion_id],
      deadline: null,
      prerequisites: ['HUMAN_REVIEW'],
      status: 'PROPOSED',
      requires_human_approval: true,
    };
  }

  return {
    action_id: stableId('action', matter.matter_id, 'MONITOR_NEW_NOTICE'),
    matter_id: matter.matter_id,
    action_type: 'MONITOR_NEW_NOTICE',
    description: 'Monitor for a new document; no current deadline is assigned to the subject party.',
    target_party: subjectParty,
    basis_assertion_ids: directives.map((assertion) => assertion.assertion_id),
    deadline: null,
    prerequisites: [],
    status: 'PROPOSED',
    requires_human_approval: false,
  };
}

function guardNoMixedProcedures(matter) {
  const procedures = new Set(
    matter.anchor_keys.filter((anchor) => anchor.kind === 'PROCEDURE').map((anchor) => anchor.value),
  );
  if (procedures.size > 1) {
    throw new ValidationError('CRITICAL_MATTER_MIX', 'A matter contains incompatible procedures.', {
      matter_id: matter.matter_id,
      procedures: [...procedures],
    });
  }
}

function guardDeadlineAttribution(actions, assertions, subjectParty) {
  const byId = new Map(assertions.map((assertion) => [assertion.assertion_id, assertion]));
  for (const action of actions) {
    for (const basisId of action.basis_assertion_ids) {
      const assertion = byId.get(basisId);
      if (
        assertion?.predicate === 'deadline.directive' &&
        normalizePartyName(assertion.target_party) !== normalizePartyName(subjectParty) &&
        action.deadline
      ) {
        throw new ValidationError(
          'CRITICAL_WRONG_DEADLINE_TARGET',
          'A counterparty deadline was assigned to the subject party.',
        );
      }
    }
  }
}

function guardAllegationsStayAllegations(assertions) {
  const allegationPredicates = new Set([
    'amount.claimed',
    'amount.default_interest_claimed',
    'obligation.claimed',
  ]);
  const promoted = assertions.filter(
    (assertion) =>
      allegationPredicates.has(assertion.predicate) &&
      assertion.assertion_kind !== 'PARTY_ALLEGATION',
  );
  if (promoted.length) {
    throw new ValidationError(
      'CRITICAL_ALLEGATION_PROMOTED',
      'A claimed amount or obligation was promoted to documentary fact.',
      {assertion_ids: promoted.map((assertion) => assertion.assertion_id)},
    );
  }
}

export function reconstructDossier({manifest, analyses, assertions, grouping, subjectParty}) {
  assertCompleteProvenance(assertions);
  guardAllegationsStayAllegations(assertions);
  const dates = documentDates(analyses);
  const matters = [];
  const allActions = [];

  for (const baseMatter of grouping.matters) {
    guardNoMixedProcedures(baseMatter);
    const matterAssertions = assertions
      .filter((assertion) => grouping.matterByDocument.get(firstDocumentId(assertion)) === baseMatter.matter_id)
      .map((assertion) => ({...assertion, matter_id: baseMatter.matter_id}));

    const timeline = matterAssertions
      .filter((assertion) => ['document.date', 'timeline.event', 'procedure.decision'].includes(assertion.predicate))
      .map((assertion) => ({
        event_id: stableId('event', assertion.assertion_id),
        date: dateFor(assertion, dates),
        description: assertion.statement,
        assertion_ids: [assertion.assertion_id],
      }));
    const datedTimeline = timeline
      .filter((event) => event.date)
      .sort((left, right) => left.date.localeCompare(right.date));
    const undatedTimeline = timeline.filter((event) => !event.date);

    const amountLedger = matterAssertions
      .filter((assertion) => assertion.predicate.startsWith('amount.'))
      .map((assertion) => ({
        amount_entry_id: stableId('amount', assertion.assertion_id),
        role: assertion.predicate.slice('amount.'.length),
        amount: assertion.value.amount,
        currency: assertion.value.currency,
        assertion_kind: assertion.assertion_kind,
        asserted_by: assertion.asserted_by,
        assertion_ids: [assertion.assertion_id],
      }));

    const statusAssertions = matterAssertions
      .filter(
        (assertion) =>
          assertion.predicate === 'procedure.status' && assertion.verification_status === 'SUPPORTED',
      )
      .sort((left, right) => (dateFor(left, dates) ?? '').localeCompare(dateFor(right, dates) ?? ''));
    const latestStatus = statusAssertions.at(-1);
    const conflicts = conflictsFor(baseMatter.matter_id, matterAssertions);
    const statusConflict = conflicts.find((conflict) => conflict.predicate === 'procedure.status');
    const state = statusConflict
      ? 'UNCERTAIN'
      : latestStatus?.value?.text === 'CLOSED'
      ? 'CLOSED'
      : latestStatus?.value?.text === 'OPEN'
        ? 'OPEN'
        : 'UNCERTAIN';

    const matter = {
      ...baseMatter,
      assertions: matterAssertions,
      timeline: datedTimeline,
      undated_timeline: undatedTimeline,
      amount_ledger: amountLedger,
      matter_state: state,
      state_basis_assertion_ids: statusConflict
        ? statusConflict.assertion_ids
        : latestStatus ? [latestStatus.assertion_id] : [],
      conflicts,
      missing_evidence: matterAssertions
        .filter(
          (assertion) =>
            assertion.predicate === 'evidence.missing' ||
            assertion.verification_status === 'INSUFFICIENT_EVIDENCE',
        )
        .map((assertion) => ({
          assertion_id: assertion.assertion_id,
          description: assertion.statement,
        })),
    };
    const action = makeAction(matter, matterAssertions, subjectParty);
    matter.proposed_action_ids = [action.action_id];
    matters.push(matter);
    allActions.push(action);
  }

  guardDeadlineAttribution(allActions, assertions, subjectParty);

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    synthetic_data_only: true,
    subject_party: subjectParty,
    source_batch: {
      batch_sha256: manifest.batch_sha256,
      total_files: manifest.total_files,
      canonical_files: manifest.canonical_files,
      duplicate_files: manifest.duplicate_files,
      canonical_pages: manifest.canonical_pages,
    },
    matters,
    actions: allActions,
    unclassified_document_ids: grouping.unclassified,
    duplicate_assignments: grouping.duplicateAssignments,
    review_links: grouping.reviewLinks,
  };
}
