export function normalizeWhitespace(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDisplayName(value) {
  return String(value ?? 'document.pdf')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .slice(0, 160);
}

export function normalizeReference(value) {
  return normalizeWhitespace(value).toUpperCase().replace(/\s+/g, '');
}

export function normalizePartyName(value) {
  return normalizeWhitespace(value).toUpperCase();
}

