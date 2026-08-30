import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strictSubmission = process.argv.includes('--submission');
const findings = [];
const warnings = [];

const secretPatterns = [
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Literal credential assignment', /\b(?:api[_-]?key|client[_-]?secret|password|passwd|access[_-]?token)\s*[:=]\s*['"][^'"\r\n]{12,}['"]/i],
];

const localPathPattern = /(?:\b[A-Za-z]:\\Users\\[^\s"']+|\/Users\/[^\s"']+|\/home\/[^\s"']+)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig;
const forbiddenTracked = [
  /(^|\/)\.env$/i,
  /\.(?:pem|p12|pfx|jks|keystore)$/i,
  /(^|\/)(?:credentials|service-account|id_rsa)(?:\.|$)/i,
];
const submissionPlaceholders = /<(?:PUBLIC_LIVE_URL|PUBLIC_REPOSITORY_URL|PUBLIC_YOUTUBE_URL)>/g;

function git(args, options = {}) {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options});
}

function isAllowedEmail(email) {
  const lower = email.toLowerCase();
  return lower.endsWith('.invalid')
    || lower.endsWith('@example.com')
    || lower.endsWith('@example.org')
    || lower.endsWith('@example.net');
}

function scanText(label, text, {scanEmails = true} = {}) {
  for (const [kind, pattern] of secretPatterns) {
    if (pattern.test(text)) findings.push({kind, location: label});
  }
  if (localPathPattern.test(text)) findings.push({kind: 'Local filesystem path', location: label});

  if (scanEmails) {
    for (const email of text.match(emailPattern) ?? []) {
      if (!isAllowedEmail(email)) findings.push({kind: 'Non-synthetic email address', location: label});
    }
  }

  const placeholderCount = (text.match(submissionPlaceholders) ?? []).length;
  if (placeholderCount > 0 && label !== 'Git history' && !strictSubmission) {
    warnings.push({kind: 'Unresolved submission URL placeholder', location: label});
  }
  if (strictSubmission && placeholderCount > 0 && label !== 'Git history') {
    findings.push({kind: 'Unresolved submission placeholder', location: label});
  }
}

async function extractPdfText(file) {
  const bytes = new Uint8Array(await readFile(path.join(root, file)));
  const document = await pdfjs.getDocument({data: bytes, disableWorker: true, verbosity: 0}).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

const repositoryFiles = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  .split('\0')
  .filter(Boolean);
for (const file of repositoryFiles) {
  const normalized = file.replaceAll('\\', '/');
  if (forbiddenTracked.some((pattern) => pattern.test(normalized))) {
    findings.push({kind: 'Forbidden tracked secret file', location: normalized});
  }

  if (normalized.toLowerCase().endsWith('.pdf')) {
    scanText(`${normalized} (extracted PDF text)`, await extractPdfText(normalized));
    continue;
  }

  const bytes = await readFile(path.join(root, normalized));
  if (bytes.includes(0)) continue;
  scanText(normalized, bytes.toString('utf8'));
}

const history = git(['log', '-p', '--all', '--no-ext-diff', '--format=fuller']);
// Binary PDF streams can appear in a historical patch and accidentally resemble an email.
// Current PDF contents are text-extracted above; history still receives credential and path scans.
scanText('Git history', history, {scanEmails: false});

const ignoredEnv = execFileSync('git', ['check-ignore', '--no-index', '.env'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (ignoredEnv !== '.env') findings.push({kind: '.env is not ignored', location: '.gitignore'});

const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
if (!license.startsWith('MIT License')) findings.push({kind: 'Detectable MIT license missing', location: 'LICENSE'});

const uniqueFindings = [...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values()];
const summary = {
  status: uniqueFindings.length === 0 ? 'PASS' : 'FAIL',
  repository_files_scanned: repositoryFiles.length,
  pdf_files_scanned: repositoryFiles.filter((file) => file.toLowerCase().endsWith('.pdf')).length,
  history_commits_scanned: Number(git(['rev-list', '--count', '--all']).trim()),
  strict_submission: strictSubmission,
  findings: uniqueFindings,
  warnings,
};

console.log(JSON.stringify(summary, null, 2));
if (uniqueFindings.length > 0) process.exitCode = 1;
