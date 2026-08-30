import {normalizeWhitespace} from '../core/text.js';

const MONEY_LABELS = new Map([
  ['PRINCIPAL', 'amount.principal'],
  ['AMOUNT AT MATURITY', 'amount.at_maturity'],
  ['CLAIMED AMOUNT', 'amount.claimed'],
  ['REMUNERATORY INTEREST', 'amount.remuneratory_interest'],
  ['DEFAULT INTEREST CLAIMED', 'amount.default_interest_claimed'],
  ['COMMISSION DECLARED ABUSIVE', 'amount.commission_excluded'],
  ['DEFAULT INTEREST DECLARED ABUSIVE', 'amount.default_interest_excluded'],
  ['FINAL RECOGNIZED AMOUNT', 'amount.recognized'],
]);

function lineRecords(document) {
  const records = [];
  for (const page of document.pages ?? []) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = normalizeWhitespace(rawLine);
      if (line) records.push({line, page_number: page.page_number});
    }
  }
  return records;
}

function findValue(records, label) {
  const prefix = `${label}:`;
  const record = records.find(({line}) => line.startsWith(prefix));
  return record ? {...record, value: record.line.slice(prefix.length).trim()} : null;
}

function evidence(record) {
  return [{page_number: record.page_number, fragment: record.line, evidence_role: 'SUPPORTS'}];
}

function candidate(document, record, fields) {
  return {
    document_id: document.document_id,
    assertion_kind: 'DOCUMENT_FACT',
    verification_status: 'SUPPORTED',
    extraction_confidence: 'HIGH',
    producer: 'deterministic-dev-extractor@1',
    evidence_refs: evidence(record),
    review_reasons: [],
    ...fields,
  };
}

export class DeterministicDevExtractor {
  get mode() {
    return 'deterministic-dev';
  }

  async extract(manifest) {
    const analyses = [];
    const candidates = [];

    for (const document of manifest.documents.filter((item) => !item.duplicate_of)) {
      if (document.text_quality === 'TEXT_LAYER_MISSING') {
        analyses.push({
          document_id: document.document_id,
          document_type: 'UNKNOWN',
          document_date: null,
          references: [],
          parties: [],
          review_reasons: ['TEXT_LAYER_MISSING'],
        });
        continue;
      }

      const records = lineRecords(document);
      const type = findValue(records, 'DOCUMENT TYPE');
      const date = findValue(records, 'DOCUMENT DATE');
      const procedure = findValue(records, 'PROCEDURE');
      const contract = findValue(records, 'CONTRACT REF');
      const partyLabels = ['ISSUER', 'RECIPIENT', 'CLAIMANT', 'DEFENDANT'];
      const parties = partyLabels
        .map((label) => ({label, record: findValue(records, label)}))
        .filter(({record}) => record)
        .map(({label, record}) => ({role: label, name: record.value}));
      const references = [
        procedure && {kind: 'PROCEDURE', value: procedure.value},
        contract && {kind: 'CONTRACT', value: contract.value},
      ].filter(Boolean);

      analyses.push({
        document_id: document.document_id,
        document_type: type?.value ?? 'OTHER',
        document_date: date?.value ?? null,
        references,
        parties,
        review_reasons: date ? [] : ['DOCUMENT_DATE_UNKNOWN'],
      });

      if (date) {
        candidates.push(
          candidate(document, date, {
            predicate: 'document.date',
            subject: document.document_id,
            value: {type: 'DATE', iso: date.value},
            statement: `Document dated ${date.value}.`,
          }),
        );
      }

      for (const [label, predicate] of MONEY_LABELS) {
        const record = findValue(records, label);
        if (!record) continue;
        const match = record.value.match(/^(\d+(?:\.\d{2}))\s+([A-Z]{3})$/);
        const isClaim = predicate === 'amount.claimed' || predicate === 'amount.default_interest_claimed';
        const claimant = parties.find((party) => party.role === 'CLAIMANT')?.name ?? null;
        candidates.push(
          candidate(document, record, {
            assertion_kind: isClaim ? 'PARTY_ALLEGATION' : 'DOCUMENT_FACT',
            asserted_by: isClaim ? claimant : null,
            predicate,
            subject: procedure?.value ?? contract?.value ?? document.document_id,
            value: {
              type: 'MONEY',
              amount: match ? match[1] : record.value,
              currency: match ? match[2] : null,
            },
            statement: `${label}: ${record.value}.`,
          }),
        );
      }

      const allegation = findValue(records, 'CLAIMANT ALLEGES');
      if (allegation) {
        const claimant = parties.find((party) => party.role === 'CLAIMANT')?.name ?? null;
        candidates.push(
          candidate(document, allegation, {
            assertion_kind: 'PARTY_ALLEGATION',
            asserted_by: claimant,
            predicate: 'obligation.claimed',
            subject: parties.find((party) => party.role === 'DEFENDANT')?.name ?? null,
            value: {type: 'TEXT', text: allegation.value},
            statement: `${claimant ?? 'The claimant'} alleges: ${allegation.value}`,
          }),
        );
      }

      const directive = findValue(records, 'DIRECTIVE');
      if (directive) {
        const target = directive.value.match(/^(.+?)\s+must\s+/i)?.[1] ?? null;
        candidates.push(
          candidate(document, directive, {
            predicate: 'deadline.directive',
            subject: procedure?.value ?? document.document_id,
            target_party: target,
            value: {type: 'TEXT', text: directive.value},
            statement: directive.value,
          }),
        );
      }

      for (const label of ['EVENT', 'DECISION', 'MISSING ATTACHMENT', 'STATUS', 'MATURITY DATE']) {
        for (const record of records.filter(({line}) => line.startsWith(`${label}:`))) {
          const value = record.line.slice(label.length + 1).trim();
          const predicate = {
            EVENT: 'timeline.event',
            DECISION: 'procedure.decision',
            'MISSING ATTACHMENT': 'evidence.missing',
            STATUS: 'procedure.status',
            'MATURITY DATE': 'contract.maturity_date',
          }[label];
          candidates.push(
            candidate(document, record, {
              predicate,
              subject: procedure?.value ?? contract?.value ?? document.document_id,
              value: label === 'MATURITY DATE'
                ? {type: 'DATE', iso: value}
                : label === 'STATUS'
                  ? {type: 'STATUS', text: value}
                  : {type: 'TEXT', text: value},
              statement: `${label}: ${value}`,
              review_reasons: label === 'MISSING ATTACHMENT' ? ['MISSING_EVIDENCE'] : [],
              verification_status:
                label === 'MISSING ATTACHMENT' ? 'INSUFFICIENT_EVIDENCE' : 'SUPPORTED',
            }),
          );
        }
      }
    }

    return {analyses, candidates, model_events: []};
  }
}
