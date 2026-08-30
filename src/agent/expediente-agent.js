import {Gemini, InMemoryRunner, LlmAgent} from '@google/adk';
import {Type} from '@google/genai';
import {ASSERTION_PREDICATES} from '../core/contracts.js';

const evidenceSchema = {
  type: Type.OBJECT,
  properties: {
    page_number: {type: Type.INTEGER},
    fragment: {type: Type.STRING},
  },
  required: ['page_number', 'fragment'],
};

const candidateSchema = {
  type: Type.OBJECT,
  properties: {
    document_id: {type: Type.STRING},
    assertion_kind: {
      type: Type.STRING,
      enum: ['DOCUMENT_FACT', 'PARTY_ALLEGATION', 'AGENT_INFERENCE'],
    },
    predicate: {type: Type.STRING, enum: ASSERTION_PREDICATES},
    subject: {type: Type.STRING},
    value_type: {
      type: Type.STRING,
      enum: ['TEXT', 'DATE', 'MONEY', 'STATUS', 'PARTY', 'DURATION'],
    },
    value_text: {type: Type.STRING},
    statement: {type: Type.STRING},
    asserted_by: {type: Type.STRING},
    target_party: {type: Type.STRING},
    extraction_confidence: {type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW']},
    evidence_refs: {type: Type.ARRAY, items: evidenceSchema},
    review_reasons: {type: Type.ARRAY, items: {type: Type.STRING}},
  },
  required: [
    'document_id',
    'assertion_kind',
    'predicate',
    'subject',
    'value_type',
    'value_text',
    'statement',
    'extraction_confidence',
    'evidence_refs',
    'review_reasons',
  ],
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    analyses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          document_id: {type: Type.STRING},
          document_type: {type: Type.STRING},
          document_date: {type: Type.STRING},
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: {type: Type.STRING, enum: ['PROCEDURE', 'CONTRACT', 'OTHER']},
                value: {type: Type.STRING},
              },
              required: ['kind', 'value'],
            },
          },
          parties: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: {type: Type.STRING},
                name: {type: Type.STRING},
              },
              required: ['role', 'name'],
            },
          },
          review_reasons: {type: Type.ARRAY, items: {type: Type.STRING}},
        },
        required: [
          'document_id',
          'document_type',
          'document_date',
          'references',
          'parties',
          'review_reasons',
        ],
      },
    },
    candidates: {type: Type.ARRAY, items: candidateSchema},
  },
  required: ['analyses', 'candidates'],
};

const instruction = `
You are ExpedienteAgent, the single extraction agent for Expediente Vivo.
Analyze only the supplied synthetic PDF page packets and return one analysis for every
canonical document, including documents with no usable text. Return structured candidates;
never invent missing data and never silently rename predicates.

Map meaning, not formatting or literal labels, to this closed vocabulary:
- the document's own date -> document.date;
- agreed principal -> amount.principal;
- amount contractually due at maturity -> amount.at_maturity;
- an amount demanded by a party -> amount.claimed;
- remuneratory interest -> amount.remuneratory_interest;
- default interest demanded by a party -> amount.default_interest_claimed;
- commission expressly excluded as abusive -> amount.commission_excluded;
- default interest expressly excluded as abusive -> amount.default_interest_excluded;
- an amount expressly recognized by an authoritative decision -> amount.recognized;
- a party's assertion that an obligation or debt exists -> obligation.claimed;
- a documented requirement addressed to a named party -> deadline.directive;
- a documented procedural occurrence -> timeline.event;
- the operative decision of an authority -> procedure.decision;
- a referenced but unavailable attachment or source -> evidence.missing;
- a clearly documented open/closed procedural state -> procedure.status;
- the contractual maturity date -> contract.maturity_date.

Headings such as DOCUMENT DATE, CLAIMED AMOUNT or STATUS are possible examples, not required
triggers. Spanish prose, varied date formats and varied monetary formats must be interpreted
conservatively. Normalize document_date and DATE value_text to YYYY-MM-DD. Normalize monetary
value_text to an ungrouped decimal with two digits plus ISO currency, for example 1145.50 EUR,
while copying the source evidence fragment verbatim. For procedure.status use value_text exactly
OPEN or CLOSED. Extract procedure and contract references even when embedded in prose.

Every DOCUMENT_FACT and PARTY_ALLEGATION must cite the exact page and an exact fragment
copied verbatim from exact_normalized_text. A CLAIMED line or claimant statement is always
PARTY_ALLEGATION and must name the claimant in asserted_by; it is never an accepted debt.
A DIRECTIVE must name the party before "must" as target_party. A missing attachment is not
invented: cite only the sentence proving the attachment is unavailable, use evidence.missing,
add MISSING_EVIDENCE and INSUFFICIENT_EVIDENCE to review_reasons, and leave unavailable facts
absent. If no reliable document date is present, use an empty document_date and add
DOCUMENT_DATE_UNKNOWN to the analysis review_reasons. For a TEXT_LAYER_MISSING or LOW page,
emit no candidates sourced from that page and add its text-quality reason to the analysis.
Do not infer content from filenames, headers added by the synthetic generator, page numbers or
unreadable remnants. Use empty strings for unknown optional strings. Do not merge matters and
do not provide legal advice; deterministic code performs provenance validation, grouping,
conflict detection and state reduction.
`;

function pagePackets(manifest) {
  return manifest.documents
    .filter((document) => !document.duplicate_of && document.pages.length)
    .map((document) => ({
      document_id: document.document_id,
      display_name: document.display_name,
      pages: document.pages.map((page) => ({
        page_number: page.page_number,
        text_quality: page.text_quality,
        exact_normalized_text: page.normalized_text,
      })),
    }));
}

export function parseMoney(valueText) {
  const text = String(valueText ?? '').trim();
  const currency = text.match(/\b(EUR|USD|GBP)\b/i)?.[1]?.toUpperCase() ??
    (/€/.test(text) || /\beuros?\b/i.test(text) ? 'EUR' : 'EUR');
  const match = text.match(/\d[\d.,\s]*\d|\d/);
  if (!match) return {type: 'TEXT', text: valueText};

  let numeric = match[0].replace(/\s/g, '');
  const lastComma = numeric.lastIndexOf(',');
  const lastDot = numeric.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';
  const decimalIndex = Math.max(lastComma, lastDot);
  if (decimalIndex >= 0 && numeric.length - decimalIndex - 1 === 2) {
    const integer = numeric.slice(0, decimalIndex).replace(/[.,]/g, '') || '0';
    const decimal = numeric.slice(decimalIndex + 1);
    numeric = `${integer}.${decimal}`;
  } else {
    numeric = numeric.replace(/[.,]/g, '');
  }
  if (!/^\d+(?:\.\d{2})?$/.test(numeric)) return {type: 'TEXT', text: valueText};
  if (!numeric.includes('.')) numeric = `${numeric}.00`;
  return {type: 'MONEY', amount: numeric, currency};
}

function typedValue(candidate) {
  if (candidate.value_type === 'MONEY') return parseMoney(candidate.value_text);
  if (candidate.value_type === 'DATE') return {type: 'DATE', iso: candidate.value_text};
  return {type: candidate.value_type, text: candidate.value_text};
}

function normalizeModelResult(raw) {
  return {
    analyses: raw.analyses.map((analysis) => ({
      ...analysis,
      document_date: analysis.document_date || null,
    })),
    candidates: raw.candidates.map((candidate) => ({
      document_id: candidate.document_id,
      assertion_kind: candidate.assertion_kind,
      predicate: candidate.predicate,
      subject: candidate.subject || null,
      value: typedValue(candidate),
      statement: candidate.statement,
      asserted_by: candidate.asserted_by || null,
      target_party: candidate.target_party || null,
      verification_status:
        candidate.review_reasons?.some((reason) =>
          ['INSUFFICIENT_EVIDENCE', 'MISSING_EVIDENCE'].includes(reason))
          ? 'INSUFFICIENT_EVIDENCE'
          : 'SUPPORTED',
      extraction_confidence: candidate.extraction_confidence,
      evidence_refs: candidate.evidence_refs.map((ref) => ({
        ...ref,
        evidence_role: 'SUPPORTS',
      })),
      review_reasons: candidate.review_reasons,
      producer: 'ExpedienteAgent/gemini-3.7-flash@1',
    })),
  };
}

export function createRootAgent({project, location = 'eu', model = 'gemini-3.7-flash'} = {}) {
  const gemini = new Gemini({
    model,
    vertexai: true,
    project: project ?? 'vertex-project-required',
    location,
  });
  return new LlmAgent({
    name: 'ExpedienteAgent',
    description: 'Reconstructs document matters with conservative, cited assertions.',
    model: gemini,
    instruction,
    includeContents: 'none',
    outputSchema: analysisSchema,
    generateContentConfig: {
      maxOutputTokens: 16384,
      temperature: 0,
      seed: 42,
      thinkingConfig: {thinkingLevel: 'LOW'},
    },
  });
}

export const rootAgent = createRootAgent({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'eu',
  model: process.env.EXPEDIENTE_MODEL ?? 'gemini-3.7-flash',
});

export class VertexAdkExtractor {
  constructor({project, location = 'eu', model = 'gemini-3.7-flash'}) {
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required for Vertex AI.');
    this.model = model;
    this.rootAgent = createRootAgent({project, location, model});
  }

  get mode() {
    return 'vertex-adk';
  }

  async extract(manifest) {
    const runner = new InMemoryRunner({agent: this.rootAgent, appName: 'expediente-vivo'});
    const events = [];
    let finalText = '';
    const message = {
      role: 'user',
      parts: [{text: JSON.stringify({task: 'extract_document_candidates', documents: pagePackets(manifest)})}],
    };
    for await (const event of runner.runEphemeral({
      userId: 'expediente-vivo-system',
      newMessage: message,
    })) {
      events.push({
        author: event.author,
        partial: event.partial ?? false,
        usage_metadata: event.usageMetadata ?? null,
      });
      const text = event.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();
      if (text) finalText = text;
    }
    if (!finalText) throw new Error('ExpedienteAgent returned no structured output.');
    const parsed = JSON.parse(finalText);
    return {...normalizeModelResult(parsed), model_events: events};
  }
}
