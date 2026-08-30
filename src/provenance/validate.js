import {
  ASSERTION_KINDS,
  ASSERTION_PREDICATES,
  CONFIDENCE_LEVELS,
  ValidationError,
  VERIFICATION_STATUSES,
  assertEnum,
} from '../core/contracts.js';
import {sha256, stableId} from '../core/hash.js';
import {normalizeWhitespace} from '../core/text.js';

function pageIndex(manifest) {
  const index = new Map();
  for (const document of manifest.documents) {
    for (const page of document.pages ?? []) {
      index.set(`${document.document_id}:${page.page_number}`, {document, page});
    }
  }
  return index;
}

function validateEvidenceRef(candidate, evidence, index) {
  const key = `${candidate.document_id}:${evidence.page_number}`;
  const source = index.get(key);
  if (!source) {
    throw new ValidationError('SOURCE_PAGE_NOT_FOUND', `Missing source page ${key}.`, {key});
  }

  const fragment = normalizeWhitespace(evidence.fragment);
  if (!fragment) {
    throw new ValidationError('EMPTY_SOURCE_FRAGMENT', 'Evidence fragment is empty.');
  }
  const start = source.page.normalized_text.indexOf(fragment);
  if (start < 0) {
    throw new ValidationError('SOURCE_FRAGMENT_MISMATCH', 'Fragment is not on the cited page.', {
      document_id: candidate.document_id,
      page_number: evidence.page_number,
      fragment,
    });
  }

  return {
    document_id: candidate.document_id,
    document_sha256: source.document.sha256,
    page_number: evidence.page_number,
    fragment,
    normalized_start: start,
    normalized_end: start + fragment.length,
    fragment_sha256: sha256(fragment),
    page_text_sha256: source.page.normalized_text_sha256,
    evidence_role: evidence.evidence_role ?? 'SUPPORTS',
  };
}

function validateCandidate(candidate, index) {
  assertEnum(candidate.assertion_kind, ASSERTION_KINDS, 'assertion_kind');
  assertEnum(candidate.predicate, ASSERTION_PREDICATES, 'predicate');
  assertEnum(candidate.verification_status ?? 'SUPPORTED', VERIFICATION_STATUSES, 'verification_status');
  assertEnum(candidate.extraction_confidence ?? 'MEDIUM', CONFIDENCE_LEVELS, 'extraction_confidence');

  if (candidate.assertion_kind === 'PARTY_ALLEGATION' && !candidate.asserted_by) {
    throw new ValidationError(
      'ALLEGATION_WITHOUT_SPEAKER',
      'A party allegation must identify who asserted it.',
    );
  }
  if (candidate.predicate?.startsWith('deadline.') && !candidate.target_party) {
    throw new ValidationError(
      'DEADLINE_WITHOUT_TARGET',
      'A deadline or directive must identify its target party.',
    );
  }
  if (
    candidate.predicate === 'procedure.status' &&
    !['OPEN', 'CLOSED'].includes(candidate.value?.text)
  ) {
    throw new ValidationError(
      'INVALID_PROCEDURE_STATUS',
      'A procedure status must be exactly OPEN or CLOSED.',
    );
  }

  const refs = (candidate.evidence_refs ?? []).map((evidence) =>
    validateEvidenceRef(candidate, evidence, index),
  );
  const status = candidate.verification_status ?? 'SUPPORTED';
  if (
    status === 'SUPPORTED' &&
    candidate.assertion_kind !== 'AGENT_INFERENCE' &&
    refs.length === 0
  ) {
    throw new ValidationError(
      'SUPPORTED_WITHOUT_EVIDENCE',
      'A supported documentary assertion requires evidence.',
    );
  }
  if (
    candidate.assertion_kind === 'AGENT_INFERENCE' &&
    !(candidate.derived_from_assertion_ids ?? []).length
  ) {
    throw new ValidationError(
      'INFERENCE_WITHOUT_LINEAGE',
      'An inference requires derived_from_assertion_ids.',
    );
  }

  const assertionId = stableId(
    'assertion',
    candidate.document_id,
    candidate.assertion_kind,
    candidate.predicate,
    JSON.stringify(candidate.value),
    refs.map((ref) => ref.fragment_sha256).join('|'),
  );

  return {
    assertion_id: assertionId,
    matter_id: null,
    assertion_kind: candidate.assertion_kind,
    subject: candidate.subject ?? null,
    predicate: candidate.predicate,
    value: candidate.value,
    statement: candidate.statement,
    asserted_by: candidate.asserted_by ?? null,
    target_party: candidate.target_party ?? null,
    verification_status: status,
    evidence_refs: refs,
    derived_from_assertion_ids: candidate.derived_from_assertion_ids ?? [],
    extraction_confidence: candidate.extraction_confidence ?? 'MEDIUM',
    review_reasons: candidate.review_reasons ?? [],
    needs_human_review:
      status !== 'SUPPORTED' ||
      (candidate.extraction_confidence ?? 'MEDIUM') === 'LOW' ||
      (candidate.review_reasons ?? []).length > 0,
    producer: candidate.producer,
  };
}

export function validateAssertionCandidates(manifest, candidates) {
  const index = pageIndex(manifest);
  const accepted = [];
  const rejected = [];
  for (const candidate of candidates) {
    try {
      accepted.push(validateCandidate(candidate, index));
    } catch (error) {
      rejected.push({
        candidate,
        code: error.code ?? 'VALIDATION_ERROR',
        message: error.message,
        details: error.details ?? {},
      });
    }
  }
  return {accepted, rejected};
}

export function assertCompleteProvenance(assertions) {
  const failures = [];
  for (const assertion of assertions) {
    if (
      assertion.verification_status === 'SUPPORTED' &&
      assertion.assertion_kind !== 'AGENT_INFERENCE' &&
      assertion.evidence_refs.length < 1
    ) {
      failures.push({assertion_id: assertion.assertion_id, code: 'MISSING_EVIDENCE'});
    }
    for (const ref of assertion.evidence_refs) {
      if (
        !ref.document_id ||
        !Number.isInteger(ref.page_number) ||
        !ref.fragment ||
        !Number.isInteger(ref.normalized_start) ||
        !Number.isInteger(ref.normalized_end) ||
        !ref.fragment_sha256 ||
        !ref.document_sha256
      ) {
        failures.push({assertion_id: assertion.assertion_id, code: 'INCOMPLETE_PROVENANCE'});
      }
    }
  }
  if (failures.length) {
    throw new ValidationError('PROVENANCE_GATE_FAILED', 'Provenance coverage is incomplete.', {
      failures,
    });
  }
  return {pass: true, assertions_checked: assertions.length};
}
