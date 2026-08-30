import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import AdmZip from 'adm-zip';
import {loadSkillFromZipBuffer} from '@google/adk';
import {parseMoney} from '../../src/agent/expediente-agent.js';
import {groupDocuments} from '../../src/matters/group.js';
import {reconstructDossier} from '../../src/matters/reconstruct.js';
import {inspectBatch} from '../../src/pdf/ingest.js';
import {validateAssertionCandidates} from '../../src/provenance/validate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = path.join(root, 'fixtures', 'robustness-v2');
const groundTruth = JSON.parse(
  await readFile(path.join(fixtureRoot, 'ground-truth.json'), 'utf8'),
);
const files = await Promise.all(
  groundTruth.files.map(async (name) => ({
    name,
    data: await readFile(path.join(fixtureRoot, 'pdfs', name)),
  })),
);
const manifest = await inspectBatch(files);
const byName = new Map(manifest.documents.map((document) => [document.display_name, document]));

function statusCandidate(filename, value, fragment) {
  const document = byName.get(filename);
  return {
    document_id: document.document_id,
    assertion_kind: 'DOCUMENT_FACT',
    predicate: 'procedure.status',
    subject: 'PZA-731/2025',
    value: {type: 'STATUS', text: value},
    statement: fragment,
    verification_status: 'SUPPORTED',
    extraction_confidence: 'HIGH',
    evidence_refs: [{page_number: 1, fragment}],
    review_reasons: [],
    producer: 'robustness-test',
  };
}

test('robustness-v2 ground truth predates model execution and has the required independent shape', () => {
  assert.equal(groundTruth.authored_before_model_execution, true);
  assert.equal(manifest.total_files, 11);
  assert.equal(manifest.canonical_files, 10);
  assert.equal(manifest.duplicate_files, 1);
  assert.equal(manifest.canonical_pages, 14);
  assert.ok(!JSON.stringify(groundTruth).includes('ALICIA DEMO'));
  assert.ok(!JSON.stringify(groundTruth).includes('MON-042/2026'));
  assert.ok(!JSON.stringify(groundTruth).includes('JVB-118/2023'));
});

test('renamed duplicate has identical bytes and degraded page is LOW', () => {
  const duplicate = byName.get('otro_nombre.pdf');
  const original = byName.get('anexo-copia.pdf');
  assert.equal(duplicate.sha256, original.sha256);
  assert.equal(duplicate.duplicate_of, original.document_id);
  const degraded = byName.get('folio_borroso.pdf');
  assert.equal(degraded.pages[0].text_quality, 'LOW');
  assert.ok(degraded.pages[0].normalized_text.length < 24);
});

test('all ground-truth evidence fragments exist on the declared PDF page before Gemini runs', () => {
  const fragments = [
    ...groundTruth.expected.core_facts,
    groundTruth.expected.deadline,
    groundTruth.expected.recognized_amount_source,
  ];
  for (const expected of fragments) {
    const page = byName.get(expected.file).pages.find((item) => item.page_number === expected.page);
    assert.ok(page.normalized_text.includes(expected.fragment), `${expected.file}: ${expected.fragment}`);
  }
});

test('varied European and international monetary forms normalize deterministically', () => {
  assert.deepEqual(parseMoney('1.145,50 EUR'), {
    type: 'MONEY', amount: '1145.50', currency: 'EUR',
  });
  assert.deepEqual(parseMoney('EUR 2,720.00'), {
    type: 'MONEY', amount: '2720.00', currency: 'EUR',
  });
  assert.deepEqual(parseMoney('420,00 euros'), {
    type: 'MONEY', amount: '420.00', currency: 'EUR',
  });
});

test('contradictory supported statuses make the matter uncertain with an unresolved conflict', () => {
  const analyses = [
    {
      document_id: byName.get('resumen_09.pdf').document_id,
      document_type: 'CERTIFICATION',
      document_date: '2025-04-18',
      references: [{kind: 'PROCEDURE', value: 'PZA-731/2025'}],
      parties: [],
      review_reasons: [],
    },
    {
      document_id: byName.get('doc-final2.pdf').document_id,
      document_type: 'COURT_ORDER',
      document_date: '2025-04-18',
      references: [{kind: 'PROCEDURE', value: 'PZA-731/2025'}],
      parties: [],
      review_reasons: [],
    },
  ];
  const candidates = [
    statusCandidate(
      'resumen_09.pdf',
      'CLOSED',
      groundTruth.expected.core_facts.find((item) =>
        item.file === 'resumen_09.pdf' && item.predicate === 'procedure.status').fragment,
    ),
    statusCandidate(
      'doc-final2.pdf',
      'OPEN',
      groundTruth.expected.core_facts.find((item) =>
        item.file === 'doc-final2.pdf' && item.predicate === 'procedure.status').fragment,
    ),
  ];
  const validation = validateAssertionCandidates(manifest, candidates);
  assert.equal(validation.rejected.length, 0);
  const grouping = groupDocuments(manifest, analyses);
  const dossier = reconstructDossier({
    manifest,
    analyses,
    assertions: validation.accepted,
    grouping,
    subjectParty: groundTruth.subject_party,
  });
  const matter = dossier.matters.find((item) => item.label === 'PZA-731/2025');
  assert.equal(matter.matter_state, 'UNCERTAIN');
  assert.equal(matter.conflicts.length, 1);
  assert.equal(matter.conflicts[0].predicate, 'procedure.status');
  assert.equal(matter.conflicts[0].status, 'UNRESOLVED');
});

test('adm-zip security override remains API-compatible with the ADK skill loader', () => {
  const zip = new AdmZip();
  zip.addFile(
    'SKILL.md',
    Buffer.from('---\nname: compatibility-check\ndescription: synthetic\n---\nSafe test skill.\n'),
  );
  const skill = loadSkillFromZipBuffer(zip.toBuffer());
  assert.equal(skill.frontmatter.name, 'compatibility-check');
  assert.match(skill.instructions, /Safe test skill/);
});
