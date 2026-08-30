export const ASSERTION_KINDS = Object.freeze([
  'DOCUMENT_FACT',
  'PARTY_ALLEGATION',
  'AGENT_INFERENCE',
]);

export const VERIFICATION_STATUSES = Object.freeze([
  'SUPPORTED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
  'REJECTED',
]);

export const CONFIDENCE_LEVELS = Object.freeze(['HIGH', 'MEDIUM', 'LOW']);

export const ASSERTION_PREDICATES = Object.freeze([
  'document.date',
  'amount.principal',
  'amount.at_maturity',
  'amount.claimed',
  'amount.remuneratory_interest',
  'amount.default_interest_claimed',
  'amount.commission_excluded',
  'amount.default_interest_excluded',
  'amount.recognized',
  'obligation.claimed',
  'deadline.directive',
  'timeline.event',
  'procedure.decision',
  'evidence.missing',
  'procedure.status',
  'contract.maturity_date',
]);

export const MATTER_STATES = Object.freeze(['OPEN', 'CLOSED', 'UNCERTAIN']);

export const ACTION_STATUSES = Object.freeze([
  'PROPOSED',
  'BLOCKED_MISSING_EVIDENCE',
  'NO_ACTION',
  'COMPLETED_INTERNAL',
]);

export const TEXT_QUALITY = Object.freeze([
  'OK',
  'LOW',
  'TEXT_LAYER_MISSING',
  'MALFORMED',
]);

export const MAX_FILES = 12;
export const MAX_PAGES = 80;
export const MAX_BATCH_BYTES = 20 * 1024 * 1024;

export class ValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
}

export function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ValidationError(
      'INVALID_ENUM',
      `${field} must be one of ${allowed.join(', ')}`,
      {field, value},
    );
  }
}
