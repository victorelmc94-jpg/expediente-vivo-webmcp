import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'fixtures', 'golden', 'pdfs');

const documents = [
  {
    name: 'A01_contract.pdf',
    pages: [
      [
        'DOCUMENT TYPE: CONTRACT',
        'DOCUMENT DATE: 2026-04-24',
        'CONTRACT REF: CTR-A-2026',
        'ISSUER: ADELANTO NORTE SL',
        'RECIPIENT: ALICIA DEMO',
        'PRINCIPAL: 130.00 EUR',
      ],
      [
        'DOCUMENT TYPE: CONTRACT',
        'CONTRACT REF: CTR-A-2026',
        'AMOUNT AT MATURITY: 183.00 EUR',
        'MATURITY DATE: 2026-05-27',
        'EVENT: Contract terms record repayment at maturity.',
      ],
    ],
  },
  {
    name: 'A02_claim.pdf',
    pages: [
      [
        'DOCUMENT TYPE: CLAIM',
        'DOCUMENT DATE: 2026-08-20',
        'PROCEDURE: MON-042/2026',
        'CONTRACT REF: CTR-A-2026',
        'CLAIMANT: ADELANTO NORTE SL',
        'DEFENDANT: ALICIA DEMO',
        'CLAIMANT ALLEGES: ALICIA DEMO owes 565.20 EUR.',
      ],
      [
        'DOCUMENT TYPE: CLAIM',
        'PROCEDURE: MON-042/2026',
        'CLAIMED AMOUNT: 565.20 EUR',
        'EVENT: The claimant requests payment of the claimed amount.',
      ],
    ],
  },
  {
    name: 'A03_admission.pdf',
    pages: [[
      'DOCUMENT TYPE: COURT ORDER',
      'DOCUMENT DATE: 2026-08-20',
      'PROCEDURE: MON-042/2026',
      'ISSUER: DEMO COURT 1',
      'RECIPIENT: ALICIA DEMO',
      'STATUS: OPEN',
      'EVENT: The court begins prior review before any payment demand.',
    ]],
  },
  {
    name: 'A04_remedy_order.pdf',
    pages: [[
      'DOCUMENT TYPE: COURT ORDER',
      'DOCUMENT DATE: 2026-08-20',
      'PROCEDURE: MON-042/2026',
      'ISSUER: DEMO COURT 1',
      'RECIPIENT: ADELANTO NORTE SL',
      'DIRECTIVE: ADELANTO NORTE SL must remedy deficient copies within 5 days.',
      'EVENT: A five day remedy period is addressed to the claimant.',
    ]],
  },
  {
    name: 'A05_undated_note.pdf',
    pages: [[
      'DOCUMENT TYPE: NOTE',
      'PROCEDURE: MON-042/2026',
      'ISSUER: DEMO COURT 1',
      'EVENT: A document is referenced without a clear document date.',
      'MISSING ATTACHMENT: Legible copy mentioned but not included.',
    ]],
  },
  {
    name: 'B01_claim.pdf',
    pages: [[
      'DOCUMENT TYPE: CLAIM',
      'DOCUMENT DATE: 2023-02-01',
      'PROCEDURE: JVB-118/2023',
      'CONTRACT REF: CTR-B-2023',
      'CLAIMANT: FINANZA AZUL SL',
      'DEFENDANT: ALICIA DEMO',
      'PRINCIPAL: 200.00 EUR',
      'REMUNERATORY INTEREST: 33.00 EUR',
      'DEFAULT INTEREST CLAIMED: 237.00 EUR',
      'CLAIMED AMOUNT: 470.00 EUR',
    ]],
  },
  {
    name: 'B02_abusive_terms_order.pdf',
    pages: [[
      'DOCUMENT TYPE: COURT ORDER',
      'DOCUMENT DATE: 2023-06-15',
      'PROCEDURE: JVB-118/2023',
      'ISSUER: DEMO COURT 2',
      'COMMISSION DECLARED ABUSIVE: 30.00 EUR',
      'DEFAULT INTEREST DECLARED ABUSIVE: 237.00 EUR',
      'EVENT: The court excludes the commission and default interest.',
    ]],
  },
  {
    name: 'B03_judgment.pdf',
    pages: [
      [
        'DOCUMENT TYPE: JUDGMENT',
        'DOCUMENT DATE: 2023-10-25',
        'PROCEDURE: JVB-118/2023',
        'ISSUER: DEMO COURT 2',
        'DECISION: The judgment partially upholds the claim.',
      ],
      [
        'DOCUMENT TYPE: JUDGMENT',
        'PROCEDURE: JVB-118/2023',
        'FINAL RECOGNIZED AMOUNT: 233.00 EUR',
        'STATUS: CLOSED',
        'EVENT: Final disposition recorded for the synthetic demo matter.',
      ],
    ],
  },
  {
    name: 'C00_scan_without_text.pdf',
    pages: [[]],
  },
];

function escapePdfText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function contentFor(lines) {
  if (!lines.length) return '';
  const commands = ['BT', '/F1 10 Tf'];
  let y = 790;
  for (const line of lines) {
    commands.push(`1 0 0 1 48 ${y} Tm (${escapePdfText(line)}) Tj`);
    y -= 18;
  }
  commands.push('ET');
  return `${commands.join('\n')}\n`;
}

function createPdf(pages) {
  const pageCount = pages.length;
  const fontObject = 3 + pageCount * 2;
  const objects = new Array(fontObject + 1);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageRefs = pages.map((_, index) => `${3 + index} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`;

  pages.forEach((lines, index) => {
    const pageObject = 3 + index;
    const contentObject = 3 + pageCount + index;
    const content = contentFor(lines);
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}endstream`;
  });
  objects[fontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let body = '%PDF-1.4\n%EV01\n';
  const offsets = new Array(objects.length).fill(0);
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(body, 'ascii');
    body += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length}\n`;
  body += '0000000000 65535 f \n';
  for (let index = 1; index < objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

await mkdir(outputDir, {recursive: true});
for (const document of documents) {
  await writeFile(path.join(outputDir, document.name), createPdf(document.pages));
}

const duplicateSource = documents.find((document) => document.name === 'A04_remedy_order.pdf');
await writeFile(
  path.join(outputDir, 'A04_remedy_order_DUPLICATE.pdf'),
  createPdf(duplicateSource.pages),
);

const manifest = {
  dataset_id: 'golden-v1',
  synthetic: true,
  subject_party: 'ALICIA DEMO',
  expected: {
    matters: 2,
    duplicates: 1,
    unclassified_documents: 1,
    claimed_amount_not_recognized_debt: '565.20 EUR',
    counterparty_deadline_target: 'ADELANTO NORTE SL',
    page_specific_fact: {
      file: 'B03_judgment.pdf',
      page: 2,
      fragment: 'FINAL RECOGNIZED AMOUNT: 233.00 EUR',
    },
  },
  files: [...documents.map((document) => document.name), 'A04_remedy_order_DUPLICATE.pdf'],
};
await writeFile(
  path.join(root, 'fixtures', 'golden', 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${manifest.files.length} synthetic PDFs in ${outputDir}`);

