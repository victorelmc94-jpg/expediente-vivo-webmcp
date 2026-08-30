export const GET_DOSSIER_SUMMARY_TOOL = 'get_dossier_summary';
export const FOCUS_EVIDENCE_TOOL = 'focus_evidence';
export const INSPECT_ASSERTION_TOOL = 'inspect_assertion';
export const PROPOSE_REVIEW_STATUS_TOOL = 'propose_review_status';
export const REVIEW_PROPOSAL_STATUSES = Object.freeze([
  'NEEDS_MORE_EVIDENCE',
  'KEEP_CURRENT_CLASSIFICATION',
  'READY_FOR_HUMAN_REVIEW',
]);

function requireOpenDossier(result) {
  if (!result?.dossier || !result?.report) {
    throw new Error('No dossier is open. Open a dossier in Expediente Vivo and try again.');
  }
  return result;
}

export function createDossierSummary(result, selectedMatterId = null) {
  const {dossier, report} = requireOpenDossier(result);
  const matters = dossier.matters.map((matter) => {
    const attentionItems = matter.assertions
      .filter((assertion) => assertion.needs_human_review || assertion.verification_status !== 'SUPPORTED')
      .map((assertion) => ({
        assertion_id: assertion.assertion_id,
        statement: assertion.statement,
        verification_status: assertion.verification_status,
        needs_human_review: Boolean(assertion.needs_human_review),
        evidence_count: assertion.evidence_refs.length,
      }));

    return {
      matter_id: matter.matter_id,
      label: matter.label,
      state: matter.matter_state,
      document_count: matter.document_ids.length,
      assertion_count: matter.assertions.length,
      supported_assertion_count: matter.assertions.filter(
        (assertion) => assertion.verification_status === 'SUPPORTED',
      ).length,
      conflict_count: matter.conflicts?.length ?? 0,
      missing_evidence_count: matter.missing_evidence?.length ?? 0,
      attention_items: attentionItems,
    };
  });

  return {
    run_id: dossier.run_id ?? report.run_id,
    schema_version: dossier.schema_version,
    report_status: report.status,
    synthetic_data_only: dossier.synthetic_data_only,
    subject_party: dossier.subject_party,
    selected_matter_id: selectedMatterId,
    source_batch: {
      batch_sha256: dossier.source_batch.batch_sha256,
      total_files: dossier.source_batch.total_files,
      canonical_files: dossier.source_batch.canonical_files,
      duplicate_files: dossier.source_batch.duplicate_files,
      canonical_pages: dossier.source_batch.canonical_pages,
    },
    matters,
    unclassified_document_ids: [...dossier.unclassified_document_ids],
    metrics: {
      accepted_assertions: report.metrics.accepted_assertions,
      rejected_assertions: report.metrics.rejected_assertions,
      supported_without_valid_citation: report.metrics.supported_without_valid_citation,
      critical_errors: report.metrics.critical_errors,
    },
  };
}

export async function registerGetDossierSummary({
  modelContext,
  getCurrentResult,
  getSelectedMatterId,
  onActivity = () => {},
}) {
  if (typeof modelContext?.registerTool !== 'function') {
    return {status: 'unavailable', tool_name: GET_DOSSIER_SUMMARY_TOOL};
  }

  await modelContext.registerTool({
    name: GET_DOSSIER_SUMMARY_TOOL,
    description: 'Return the structured status of the dossier currently open in Expediente Vivo, including real matter and attention-item identifiers.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
    execute: async () => {
      try {
        const summary = createDossierSummary(getCurrentResult(), getSelectedMatterId());
        onActivity({
          tool_name: GET_DOSSIER_SUMMARY_TOOL,
          status: 'success',
          run_id: summary.run_id,
          matter_count: summary.matters.length,
        });
        return summary;
      } catch (error) {
        onActivity({
          tool_name: GET_DOSSIER_SUMMARY_TOOL,
          status: 'error',
          message: error.message,
        });
        throw error;
      }
    },
  });

  return {status: 'registered', tool_name: GET_DOSSIER_SUMMARY_TOOL};
}

export function findDossierAssertion(result, assertionId) {
  const {dossier} = requireOpenDossier(result);
  for (const matter of dossier.matters) {
    const assertion = matter.assertions.find((item) => item.assertion_id === assertionId);
    if (assertion) return {matter, assertion};
  }
  throw new Error(`Assertion ${assertionId} does not exist in the open dossier.`);
}

export function createAssertionInspection(result, assertionId) {
  const {matter, assertion} = findDossierAssertion(result, assertionId);
  return {
    assertion_id: assertion.assertion_id,
    matter_id: assertion.matter_id,
    matter_label: matter.label,
    assertion_kind: assertion.assertion_kind,
    subject: assertion.subject,
    predicate: assertion.predicate,
    value: structuredClone(assertion.value),
    statement: assertion.statement,
    asserted_by: assertion.asserted_by,
    target_party: assertion.target_party,
    verification_status: assertion.verification_status,
    extraction_confidence: assertion.extraction_confidence,
    evidence_refs: assertion.evidence_refs.map((reference) => structuredClone(reference)),
    derived_from_assertion_ids: [...assertion.derived_from_assertion_ids],
    producer: assertion.producer,
    review_reasons: [...assertion.review_reasons],
    needs_human_review: Boolean(assertion.needs_human_review),
    related_missing_evidence: matter.missing_evidence
      .filter((item) => item.assertion_id === assertion.assertion_id)
      .map((item) => structuredClone(item)),
    related_conflicts: matter.conflicts
      .filter((conflict) => conflict.assertion_ids?.includes(assertion.assertion_id))
      .map((conflict) => structuredClone(conflict)),
  };
}

export async function registerInspectAssertion({
  modelContext,
  getCurrentResult,
  onActivity = () => {},
}) {
  if (typeof modelContext?.registerTool !== 'function') {
    return {status: 'unavailable', tool_name: INSPECT_ASSERTION_TOOL};
  }

  await modelContext.registerTool({
    name: INSPECT_ASSERTION_TOOL,
    description: 'Inspect one assertion from the open dossier and return its existing classification, review flags, and exact evidence provenance without rerunning a model or changing the dossier.',
    inputSchema: {
      type: 'object',
      properties: {
        assertion_id: {
          type: 'string',
          minLength: 1,
          description: 'A real assertion_id returned by get_dossier_summary.',
        },
      },
      required: ['assertion_id'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
    execute: async ({assertion_id: assertionId}) => {
      try {
        const inspection = createAssertionInspection(getCurrentResult(), assertionId);
        onActivity({
          tool_name: INSPECT_ASSERTION_TOOL,
          status: 'success',
          assertion_id: inspection.assertion_id,
          matter_id: inspection.matter_id,
        });
        return inspection;
      } catch (error) {
        onActivity({
          tool_name: INSPECT_ASSERTION_TOOL,
          status: 'error',
          assertion_id: assertionId,
          message: error.message,
        });
        throw error;
      }
    },
  });

  return {status: 'registered', tool_name: INSPECT_ASSERTION_TOOL};
}

export function createReviewProposal(result, input, {
  proposalId = `proposal_${crypto.randomUUID()}`,
  timestamp = new Date().toISOString(),
} = {}) {
  const assertionId = String(input?.assertion_id ?? '').trim();
  const proposedStatus = String(input?.proposed_status ?? '').trim();
  const rationale = String(input?.rationale ?? '').trim();
  const {matter, assertion} = findDossierAssertion(result, assertionId);

  if (!REVIEW_PROPOSAL_STATUSES.includes(proposedStatus)) {
    throw new Error(`Unsupported review proposal status: ${proposedStatus || '(empty)'}.`);
  }
  if (rationale.length < 10 || rationale.length > 500) {
    throw new Error('Proposal rationale must contain between 10 and 500 characters.');
  }

  return {
    proposal_id: proposalId,
    assertion_id: assertion.assertion_id,
    matter_id: matter.matter_id,
    proposed_status: proposedStatus,
    rationale,
    actor: 'agent',
    timestamp,
    proposal_status: 'pending',
    canonical_assertion: {
      assertion_kind: assertion.assertion_kind,
      verification_status: assertion.verification_status,
      needs_human_review: Boolean(assertion.needs_human_review),
      statement: assertion.statement,
    },
    human_decision: null,
  };
}

export function decideReviewProposal(proposal, decision, {
  actor,
  timestamp = new Date().toISOString(),
} = {}) {
  if (actor !== 'human') throw new Error('Only an explicit human action can decide a review proposal.');
  if (proposal.proposal_status !== 'pending') throw new Error('This review proposal has already been decided.');
  if (!['accepted', 'rejected'].includes(decision)) throw new Error(`Unsupported human decision: ${decision}.`);
  return {
    ...proposal,
    proposal_status: decision,
    human_decision: {decision, actor: 'human', timestamp},
  };
}

export async function registerProposeReviewStatus({
  modelContext,
  createProposal,
  onActivity = () => {},
}) {
  if (typeof modelContext?.registerTool !== 'function') {
    return {status: 'unavailable', tool_name: PROPOSE_REVIEW_STATUS_TOOL};
  }

  await modelContext.registerTool({
    name: PROPOSE_REVIEW_STATUS_TOOL,
    description: 'Create a separate pending agent proposal for human review of an assertion. This changes only the page review queue; it never changes the canonical assertion, and a person must explicitly accept or reject it.',
    inputSchema: {
      type: 'object',
      properties: {
        assertion_id: {
          type: 'string',
          minLength: 1,
          description: 'A real assertion_id from the open dossier.',
        },
        proposed_status: {
          type: 'string',
          enum: REVIEW_PROPOSAL_STATUSES,
          description: 'A review-workflow status, not a canonical evidence or legal classification.',
        },
        rationale: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Brief evidence-grounded reason for the proposal.',
        },
      },
      required: ['assertion_id', 'proposed_status', 'rationale'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: false},
    execute: async (input) => {
      try {
        const proposal = createProposal(input);
        onActivity({
          tool_name: PROPOSE_REVIEW_STATUS_TOOL,
          status: 'success',
          assertion_id: proposal.assertion_id,
          matter_id: proposal.matter_id,
          proposal_id: proposal.proposal_id,
        });
        return proposal;
      } catch (error) {
        onActivity({
          tool_name: PROPOSE_REVIEW_STATUS_TOOL,
          status: 'error',
          assertion_id: input?.assertion_id,
          message: error.message,
        });
        throw error;
      }
    },
  });

  return {status: 'registered', tool_name: PROPOSE_REVIEW_STATUS_TOOL};
}

export async function registerFocusEvidence({
  modelContext,
  focusEvidence,
  onActivity = () => {},
}) {
  if (typeof modelContext?.registerTool !== 'function') {
    return {status: 'unavailable', tool_name: FOCUS_EVIDENCE_TOOL};
  }

  await modelContext.registerTool({
    name: FOCUS_EVIDENCE_TOOL,
    description: 'Select the matter containing an assertion and open its source-evidence dialog in the Expediente Vivo interface. This only changes the current page view.',
    inputSchema: {
      type: 'object',
      properties: {
        assertion_id: {
          type: 'string',
          minLength: 1,
          description: 'A real assertion_id returned by get_dossier_summary.',
        },
      },
      required: ['assertion_id'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
    execute: async ({assertion_id: assertionId}) => {
      try {
        const result = focusEvidence(assertionId);
        onActivity({
          tool_name: FOCUS_EVIDENCE_TOOL,
          status: 'success',
          assertion_id: result.assertion_id,
          matter_id: result.matter_id,
        });
        return result;
      } catch (error) {
        onActivity({
          tool_name: FOCUS_EVIDENCE_TOOL,
          status: 'error',
          assertion_id: assertionId,
          message: error.message,
        });
        throw error;
      }
    },
  });

  return {status: 'registered', tool_name: FOCUS_EVIDENCE_TOOL};
}
