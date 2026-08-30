import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  MAX_BATCH_BYTES,
  MAX_FILES,
  MAX_PAGES,
  ValidationError,
} from '../core/contracts.js';
import {sha256, stableId} from '../core/hash.js';
import {cleanDisplayName, normalizeWhitespace} from '../core/text.js';

function itemText(item) {
  return typeof item?.str === 'string' ? item.str : '';
}

function textFromContent(content) {
  const parts = [];
  let lastY = null;
  for (const item of content.items ?? []) {
    const text = itemText(item);
    if (!text) continue;
    const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) parts.push('\n');
    else if (parts.length && parts.at(-1) !== '\n') parts.push(' ');
    parts.push(text);
    if (item.hasEOL) parts.push('\n');
    lastY = y;
  }
  return parts.join('').replace(/ *\n+ */g, '\n').trim();
}

function qualityFor(normalizedText) {
  if (!normalizedText) return 'TEXT_LAYER_MISSING';
  if (normalizedText.length < 24) return 'LOW';
  return 'OK';
}

async function parsePdf(file, canonicalByHash) {
  const bytes = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
  const documentHash = sha256(bytes);
  const displayName = cleanDisplayName(file.name);
  const documentId = stableId('doc', documentHash);

  if (canonicalByHash.has(documentHash)) {
    return {
      document_id: documentId,
      sha256: documentHash,
      display_name: displayName,
      page_count: canonicalByHash.get(documentHash).page_count,
      duplicate_of: canonicalByHash.get(documentHash).document_id,
      text_quality: canonicalByHash.get(documentHash).text_quality,
      pages: [],
    };
  }

  let pdf;
  let loadingTask;
  try {
    loadingTask = getDocument({
      data: new Uint8Array(bytes),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0,
    });
    pdf = await loadingTask.promise;
  } catch (error) {
    throw new ValidationError('MALFORMED_PDF', `Cannot parse ${displayName}`, {
      cause: error.message,
    });
  }

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = textFromContent(content);
    const normalizedText = normalizeWhitespace(text);
    pages.push({
      document_id: documentId,
      page_number: pageNumber,
      text,
      normalized_text: normalizedText,
      normalized_text_sha256: sha256(normalizedText),
      text_quality: qualityFor(normalizedText),
    });
    page.cleanup();
  }
  await loadingTask.destroy();

  const qualities = pages.map((page) => page.text_quality);
  const record = {
    document_id: documentId,
    sha256: documentHash,
    display_name: displayName,
    page_count: pages.length,
    duplicate_of: null,
    text_quality: qualities.includes('TEXT_LAYER_MISSING')
      ? 'TEXT_LAYER_MISSING'
      : qualities.includes('LOW')
        ? 'LOW'
        : 'OK',
    pages,
  };
  canonicalByHash.set(documentHash, record);
  return record;
}

export async function inspectBatch(files) {
  if (!Array.isArray(files) || files.length < 1) {
    throw new ValidationError('EMPTY_BATCH', 'At least one PDF is required.');
  }
  if (files.length > MAX_FILES) {
    throw new ValidationError('TOO_MANY_FILES', `Maximum ${MAX_FILES} PDFs.`);
  }

  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.data), 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    throw new ValidationError('BATCH_TOO_LARGE', 'Batch exceeds 20 MB.');
  }

  for (const file of files) {
    if (!String(file.name ?? '').toLowerCase().endsWith('.pdf')) {
      throw new ValidationError('UNSUPPORTED_FILE', `${file.name} is not a PDF.`);
    }
    const header = Buffer.from(file.data).subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new ValidationError('INVALID_PDF_MAGIC', `${file.name} has invalid PDF bytes.`);
    }
  }

  const canonicalByHash = new Map();
  const documents = [];
  for (const file of files) {
    documents.push(await parsePdf(file, canonicalByHash));
  }

  const pageCount = documents
    .filter((document) => !document.duplicate_of)
    .reduce((sum, document) => sum + document.page_count, 0);
  if (pageCount > MAX_PAGES) {
    throw new ValidationError('TOO_MANY_PAGES', `Maximum ${MAX_PAGES} canonical pages.`);
  }

  return {
    batch_sha256: sha256(documents.map((document) => document.sha256).sort().join('|')),
    total_files: documents.length,
    canonical_files: documents.filter((document) => !document.duplicate_of).length,
    duplicate_files: documents.filter((document) => document.duplicate_of).length,
    canonical_pages: pageCount,
    documents,
  };
}
