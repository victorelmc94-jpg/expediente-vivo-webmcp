import {
  createReviewProposal,
  decideReviewProposal,
  findDossierAssertion,
  registerFocusEvidence,
  registerGetDossierSummary,
  registerInspectAssertion,
  registerProposeReviewStatus,
} from './webmcp.js';

const goldenButton = document.querySelector('#golden-button');
const uploadButton = document.querySelector('#upload-button');
const pdfInput = document.querySelector('#pdf-input');
const dropZone = document.querySelector('#drop-zone');
const fileList = document.querySelector('#file-list');
const runtimeStatus = document.querySelector('#runtime-status');
const progress = document.querySelector('#progress');
const stageList = document.querySelector('#stage-list');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const resultSubtitle = document.querySelector('#result-subtitle');
const runProof = document.querySelector('#run-proof');
const matterCount = document.querySelector('#matter-count');
const matterTabs = document.querySelector('#matter-tabs');
const matterDetail = document.querySelector('#matter-detail');
const evidenceDialog = document.querySelector('#evidence-dialog');
const evidenceContent = document.querySelector('#evidence-content');
const closeEvidence = document.querySelector('#close-evidence');
const webMcpStatus = document.querySelector('#webmcp-status');
const webMcpActivity = document.querySelector('#webmcp-activity');
const reviewWorkflow = document.querySelector('#review-workflow');
const reviewProposalList = document.querySelector('#review-proposals');
const isReadOnlyDemo = document.body.dataset.demoMode === 'readonly';

let language = 'en';
let selectedFiles = [];
let currentResult = null;
let selectedMatterId = null;
let currentDocumentNames = new Map();
let runtimeMode = 'checking';
let webMcpState = {availability: 'checking', lastActivity: null};
let reviewProposalRunId = null;
const reviewProposals = new Map();

const translations = {
  en: {
    eyebrow: 'HUMAN–AGENT EVIDENCE REVIEW',
    headline: 'Let the agent inspect. Keep the decision human.',
    lede: 'WebMCP gives the agent structured access to the open dossier, brings exact evidence into view and hands a bounded proposal back to the reviewer.',
    trustEvidence: 'Every claim cited', trustUncertainty: 'Uncertainty stays visible', trustHuman: 'Human review when evidence is weak',
    runtimeTitle: 'Agent runtime', runtimeChecking: 'Checking environment…', runtimeTitleDemo: 'Public presentation mode',
    demoNoticeTitle: 'Public judging demo · verified synthetic snapshot', demoNoticeBody: 'Synthetic-only presentation: four WebMCP tools inspect, focus and propose while the final decision stays human.',
    stepInput: '01 · INPUT', inputTitle: 'Add the documents. Order does not matter.', inputDescription: 'Upload up to 12 synthetic PDFs. They may be duplicated, incomplete or belong to different matters.', syntheticOnly: 'Synthetic data only',
    recommendedDemo: 'RECOMMENDED DEMO', safeDataset: '100% synthetic', demoTitle: 'Mixed case folder', demoDescription: 'A contract, two claims, court orders, a duplicate, an undated note and a page without usable text.', pdfs: 'PDFs', mixedMatters: 'mixed matters', duplicate: 'duplicate', runDemo: 'Reconstruct this case',
    demoInputTitle: 'Explore the verified synthetic case.', demoInputDescription: 'Open the precomputed dossier and inspect every matter, timeline, safeguard and exact source citation.', verifiedDemo: 'VERIFIED SYNTHETIC DEMO', runDemoReadonly: 'Open verified dossier',
    uploadTitle: 'Use another synthetic folder', uploadDescription: 'Drop multiple PDFs here or choose them from your computer.', choosePdfs: 'Choose PDFs', processSelection: 'Reconstruct selection',
    stepProcessing: '02 · AGENT WORKFLOW', processingTitle: 'Reconstructing the folder', processingDescription: 'Operational stages only — no hidden reasoning is displayed.',
    demoStepProcessing: '02 · VERIFIED SNAPSHOT', demoProcessingTitle: 'Loading the verified dossier', demoProcessingDescription: 'No upload or inference occurs in this public presentation.',
    stepResult: '03 · VERIFIED DOSSIER', resultsTitle: 'Folder reconstructed', identifiedMatters: 'Identified matters', legend: 'Evidence language',
    footerDisclaimer: 'Expediente Vivo reconstructs supplied evidence. It does not provide legal advice or decide legal truth.', sourceTrace: 'SOURCE TRACE', evidenceTitle: 'Claim evidence',
    matters: 'Matters', canonicalDocs: 'Canonical PDFs', duplicates: 'Duplicates', verifiedCitations: 'Verified citations', criticalErrors: 'Critical errors',
    caseSubject: 'Subject', documents: 'documents', attention: 'needs attention', noAlerts: 'no critical alerts', timeline: 'Timeline', timelineHint: 'Events reconstructed from dated and undated evidence.', amounts: 'Relevant amounts', amountsHint: 'Documented amounts remain separate from party allegations.', nextAction: 'Safe next step', safeguards: 'Safeguards & uncertainty', evidenceTrail: 'Evidence trail', evidenceHint: 'Select a claim to inspect its exact source.',
    noTimeline: 'No timeline events were supported.', noAmounts: 'No supported monetary amounts.', noAlertsText: 'No contradiction or missing evidence detected for this matter.',
    deadlineSafe: 'Deadline attributed correctly', deadlineFor: 'This deadline is addressed to', notSubject: '— not to the case subject.',
    humanReview: 'Human review required', unresolved: 'Unresolved contradiction',
    proposed: 'Proposed, not executed', target: 'Target', approval: 'Human approval required', noApproval: 'No external action executed',
    sources: 'source', sourcesPlural: 'sources', assertedBy: 'Asserted by', addressedTo: 'Addressed to', document: 'Document', page: 'Page', exactFragment: 'Exact fragment', offsets: 'Offsets', fragmentHash: 'Fragment hash', pageHash: 'Page hash',
    completed: 'Complete', run: 'Run', claimsCited: 'All supported claims cited', fileSelected: 'PDF selected', filesSelected: 'PDFs selected',
    verifiedSnapshot: 'Verified snapshot', runtimeDemo: 'Synthetic read-only snapshot · no live inference or cloud storage access', runtimeCloud: 'Google Cloud runtime · live agent and private artifact storage', runtimeLocal: 'Local validation mode · same deterministic safeguards', runtimeUnavailable: 'Runtime status unavailable',
    runtimeStackSnapshot: 'Verified JSON snapshot', runtimeStackSynthetic: 'Synthetic only', runtimeStackNoInference: 'No live inference', footerStack: 'Google ADK · Vertex AI · Cloud Run · Cloud Storage', footerStackDemo: 'OpenAI WebMCP · 4 site tools · synthetic dossier · human review',
    inputDocuments: 'Packaged synthetic input documents', webMcpTitle: 'Site tools', webMcpChecking: 'Checking WebMCP support…', webMcpUnavailable: 'WebMCP is unavailable in this browser.', webMcpReady: '4 evidence-review tools are ready.', webMcpIdle: 'No WebMCP calls yet.', webMcpLastCall: 'Last WebMCP call', webMcpSucceeded: 'completed', webMcpFailed: 'failed',
    reviewDesk: 'HUMAN–AGENT REVIEW', reviewDeskTitle: 'Review proposals', reviewDeskHint: 'Agent proposals stay separate from the canonical dossier until a person explicitly accepts or rejects them.', agentProposal: 'AGENT PROPOSAL', pendingHumanReview: 'Pending human review', proposedReviewStatus: 'Proposed review status', rationale: 'Rationale', canonicalUnchanged: 'Canonical dossier unchanged', accept: 'ACCEPT', reject: 'REJECT', humanDecision: 'HUMAN DECISION', acceptedByHuman: 'Accepted by human', rejectedByHuman: 'Rejected by human', proposalActor: 'Actor', proposalCreated: 'Created',
    stages: ['Inventory PDFs', 'Extract text by page', 'Detect exact duplicates', 'Gemini structures evidence', 'Separate matters', 'Validate provenance', 'Assemble dossier'],
    demoStages: ['Load embedded synthetic snapshot', 'Verify snapshot contract', 'Render read-only dossier'],
    roles: {principal: 'Principal', at_maturity: 'Amount at maturity', claimed: 'Claimed amount', remuneratory_interest: 'Remuneratory interest', default_interest_claimed: 'Claimed default interest', commission_excluded: 'Excluded commission', default_interest_excluded: 'Excluded default interest', recognized: 'Recognized amount'},
    actions: {MONITOR_NEW_NOTICE: 'Monitor for a new notice', NO_ACTION: 'No action derived', REVIEW_DIRECTIVE: 'Review documented directive'},
  },
  es: {
    eyebrow: 'REVISIÓN DE EVIDENCIA HUMANO–AGENTE',
    headline: 'El agente inspecciona. La decisión sigue siendo humana.',
    lede: 'WebMCP da al agente acceso estructurado al dossier abierto, muestra la evidencia exacta y devuelve una propuesta acotada a la persona revisora.',
    trustEvidence: 'Cada afirmación citada', trustUncertainty: 'La incertidumbre sigue visible', trustHuman: 'Revisión humana si falta evidencia',
    runtimeTitle: 'Entorno del agente', runtimeChecking: 'Comprobando el entorno…', runtimeTitleDemo: 'Modo de presentación pública',
    demoNoticeTitle: 'Demo pública para jueces · snapshot sintético verificado', demoNoticeBody: 'Presentación solo sintética: cuatro tools WebMCP inspeccionan, enfocan y proponen; la decisión final sigue siendo humana.',
    stepInput: '01 · ENTRADA', inputTitle: 'Añade los documentos. El orden no importa.', inputDescription: 'Sube hasta 12 PDFs sintéticos. Pueden estar duplicados, incompletos o pertenecer a asuntos distintos.', syntheticOnly: 'Solo datos sintéticos',
    recommendedDemo: 'DEMO RECOMENDADA', safeDataset: '100 % sintético', demoTitle: 'Carpeta de asuntos mezclados', demoDescription: 'Un contrato, dos reclamaciones, autos, un duplicado, una nota sin fecha y una página sin texto útil.', pdfs: 'PDFs', mixedMatters: 'asuntos mezclados', duplicate: 'duplicado', runDemo: 'Reconstruir este expediente',
    demoInputTitle: 'Explora el expediente sintético verificado.', demoInputDescription: 'Abre el dossier precomputado e inspecciona cada asunto, cronología, salvaguarda y cita exacta a la fuente.', verifiedDemo: 'DEMO SINTÉTICA VERIFICADA', runDemoReadonly: 'Abrir dossier verificado',
    uploadTitle: 'Usar otra carpeta sintética', uploadDescription: 'Arrastra varios PDFs o selecciónalos desde tu equipo.', choosePdfs: 'Elegir PDFs', processSelection: 'Reconstruir selección',
    stepProcessing: '02 · FLUJO DEL AGENTE', processingTitle: 'Reconstruyendo la carpeta', processingDescription: 'Solo etapas operativas; no se muestra razonamiento interno.',
    demoStepProcessing: '02 · SNAPSHOT VERIFICADO', demoProcessingTitle: 'Cargando el dossier verificado', demoProcessingDescription: 'Esta presentación pública no sube archivos ni ejecuta inferencia.',
    stepResult: '03 · DOSSIER VERIFICADO', resultsTitle: 'Carpeta reconstruida', identifiedMatters: 'Asuntos identificados', legend: 'Lenguaje de evidencia',
    footerDisclaimer: 'Expediente Vivo reconstruye la evidencia aportada. No ofrece asesoramiento jurídico ni decide la verdad jurídica.', sourceTrace: 'TRAZA DE FUENTE', evidenceTitle: 'Evidencia de la afirmación',
    matters: 'Asuntos', canonicalDocs: 'PDFs canónicos', duplicates: 'Duplicados', verifiedCitations: 'Citas verificadas', criticalErrors: 'Errores críticos',
    caseSubject: 'Persona del expediente', documents: 'documentos', attention: 'requiere atención', noAlerts: 'sin alertas críticas', timeline: 'Cronología', timelineHint: 'Hechos reconstruidos desde evidencia con y sin fecha.', amounts: 'Cantidades relevantes', amountsHint: 'Los importes documentales se mantienen separados de las alegaciones.', nextAction: 'Siguiente paso seguro', safeguards: 'Salvaguardas e incertidumbre', evidenceTrail: 'Trazabilidad', evidenceHint: 'Selecciona una afirmación para inspeccionar su fuente exacta.',
    noTimeline: 'No hay eventos cronológicos soportados.', noAmounts: 'No hay cantidades monetarias soportadas.', noAlertsText: 'No se detectó contradicción ni evidencia ausente en este asunto.',
    deadlineSafe: 'Plazo atribuido correctamente', deadlineFor: 'Este plazo se dirige a', notSubject: '— no a la persona del expediente.',
    humanReview: 'Revisión humana necesaria', unresolved: 'Contradicción sin resolver',
    proposed: 'Propuesta, no ejecutada', target: 'Destinatario', approval: 'Requiere aprobación humana', noApproval: 'No se ejecutó ninguna acción externa',
    sources: 'fuente', sourcesPlural: 'fuentes', assertedBy: 'Alegado por', addressedTo: 'Dirigido a', document: 'Documento', page: 'Página', exactFragment: 'Fragmento exacto', offsets: 'Offsets', fragmentHash: 'Hash de fragmento', pageHash: 'Hash de página',
    completed: 'Completado', run: 'Ejecución', claimsCited: 'Todas las afirmaciones soportadas tienen cita', fileSelected: 'PDF seleccionado', filesSelected: 'PDFs seleccionados',
    verifiedSnapshot: 'Snapshot verificado', runtimeDemo: 'Snapshot sintético de solo lectura · sin inferencia en vivo ni acceso a Cloud Storage', runtimeCloud: 'Entorno Google Cloud · agente real y almacenamiento privado', runtimeLocal: 'Modo de validación local · mismas salvaguardas deterministas', runtimeUnavailable: 'Estado del entorno no disponible',
    runtimeStackSnapshot: 'Snapshot JSON verificado', runtimeStackSynthetic: 'Solo sintético', runtimeStackNoInference: 'Sin inferencia en vivo', footerStack: 'Google ADK · Vertex AI · Cloud Run · Cloud Storage', footerStackDemo: 'OpenAI WebMCP · 4 tools del sitio · dossier sintético · revisión humana',
    inputDocuments: 'Documentos de entrada sintéticos incluidos', webMcpTitle: 'Tools del sitio', webMcpChecking: 'Comprobando compatibilidad WebMCP…', webMcpUnavailable: 'WebMCP no está disponible en este navegador.', webMcpReady: 'Hay 4 tools de revisión disponibles.', webMcpIdle: 'Aún no hay llamadas WebMCP.', webMcpLastCall: 'Última llamada WebMCP', webMcpSucceeded: 'completada', webMcpFailed: 'fallida',
    reviewDesk: 'REVISIÓN HUMANO–AGENTE', reviewDeskTitle: 'Propuestas de revisión', reviewDeskHint: 'Las propuestas del agente permanecen separadas del dossier canónico hasta que una persona las acepta o rechaza expresamente.', agentProposal: 'PROPUESTA DEL AGENTE', pendingHumanReview: 'Pendiente de revisión humana', proposedReviewStatus: 'Estado de revisión propuesto', rationale: 'Justificación', canonicalUnchanged: 'Dossier canónico sin cambios', accept: 'ACEPTAR', reject: 'RECHAZAR', humanDecision: 'DECISIÓN HUMANA', acceptedByHuman: 'Aceptada por una persona', rejectedByHuman: 'Rechazada por una persona', proposalActor: 'Actor', proposalCreated: 'Creada',
    stages: ['Inventariar PDFs', 'Extraer texto por página', 'Detectar duplicados exactos', 'Gemini estructura la evidencia', 'Separar asuntos', 'Validar trazabilidad', 'Construir dossier'],
    demoStages: ['Cargar snapshot sintético incluido', 'Verificar contrato del snapshot', 'Mostrar dossier de solo lectura'],
    roles: {principal: 'Principal', at_maturity: 'Importe al vencimiento', claimed: 'Importe reclamado', remuneratory_interest: 'Interés remuneratorio', default_interest_claimed: 'Interés de demora reclamado', commission_excluded: 'Comisión excluida', default_interest_excluded: 'Interés de demora excluido', recognized: 'Importe reconocido'},
    actions: {MONITOR_NEW_NOTICE: 'Esperar una nueva notificación', NO_ACTION: 'No se deriva ninguna acción', REVIEW_DIRECTIVE: 'Revisar el requerimiento documentado'},
  },
};

const demoDocuments = new Map([
  ['doc_849b93a2c7508788', ['A01_contract.pdf']],
  ['doc_033aef841abffe6e', ['A02_claim.pdf']],
  ['doc_d6d299437cf47695', ['A03_admission.pdf']],
  ['doc_a44e4b50db8f6366', ['A04_remedy_order.pdf', 'A04_remedy_order_DUPLICATE.pdf']],
  ['doc_52f949d3a05df939', ['A05_undated_note.pdf']],
  ['doc_11b5bc2a6653dd1e', ['B01_claim.pdf']],
  ['doc_d32ebd0ef6ed3898', ['B02_abusive_terms_order.pdf']],
  ['doc_344f425f8a74c30a', ['B03_judgment.pdf']],
  ['doc_9c2776c13a61d7d1', ['C00_scan_without_text.pdf']],
]);

const demoTranslationKeys = {
  runtimeTitle: 'runtimeTitleDemo',
  inputTitle: 'demoInputTitle',
  inputDescription: 'demoInputDescription',
  recommendedDemo: 'verifiedDemo',
  runDemo: 'runDemoReadonly',
  stepProcessing: 'demoStepProcessing',
  processingTitle: 'demoProcessingTitle',
  processingDescription: 'demoProcessingDescription',
  stages: 'demoStages',
  footerStack: 'footerStackDemo',
};

function t(key) {
  const effectiveKey = isReadOnlyDemo ? demoTranslationKeys[key] ?? key : key;
  return translations[language][effectiveKey] ?? translations.en[effectiveKey] ?? effectiveKey;
}

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(className, text) {
  const element = el('button', className, text);
  element.type = 'button';
  return element;
}

function translateStatic() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('.language-button').forEach((element) => {
    const active = element.dataset.language === language;
    element.classList.toggle('active', active);
    element.setAttribute('aria-pressed', String(active));
  });
}

function renderRuntimeStatus() {
  const key = runtimeMode === 'demo'
    ? 'runtimeDemo'
    : runtimeMode === 'cloud'
    ? 'runtimeCloud'
    : runtimeMode === 'local'
      ? 'runtimeLocal'
      : runtimeMode === 'unavailable'
        ? 'runtimeUnavailable'
        : 'runtimeChecking';
  runtimeStatus.textContent = t(key);
}

function renderWebMcpStatus() {
  webMcpStatus.textContent = webMcpState.availability === 'registered'
    ? t('webMcpReady')
    : webMcpState.availability === 'unavailable'
      ? t('webMcpUnavailable')
      : t('webMcpChecking');
  if (!webMcpState.lastActivity) {
    webMcpActivity.textContent = t('webMcpIdle');
    return;
  }
  const {tool_name: toolName, status, timestamp} = webMcpState.lastActivity;
  const outcome = status === 'success' ? t('webMcpSucceeded') : t('webMcpFailed');
  webMcpActivity.textContent = `${t('webMcpLastCall')}: ${toolName} · ${outcome} · ${timestamp}`;
}

function recordWebMcpActivity(activity) {
  webMcpState.lastActivity = {
    ...activity,
    timestamp: new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date()),
  };
  renderWebMcpStatus();
}

function metric(label, value, good = false) {
  const box = el('div', `metric${good ? ' good' : ''}`);
  box.append(el('strong', '', String(value)), el('span', '', label));
  return box;
}

function kindName(assertion) {
  if (assertion.needs_human_review || assertion.verification_status === 'INSUFFICIENT_EVIDENCE') return 'NEEDS_HUMAN_REVIEW';
  return {DOCUMENT_FACT: 'FACT', PARTY_ALLEGATION: 'PARTY_ALLEGATION', AGENT_INFERENCE: 'INFERENCE'}[assertion.assertion_kind] ?? assertion.assertion_kind;
}

function kindBadge(kind) {
  return el('span', `kind-badge ${kind}`, kind.replaceAll('_', ' '));
}

function documentName(documentId) {
  const names = currentDocumentNames.get(documentId);
  if (!names?.length) return documentId;
  return names.length > 1 ? `${names[0]} (+${names.length - 1})` : names[0];
}

function formatDate(value) {
  if (!value) return language === 'es' ? 'Sin fecha' : 'Undated';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(parsed);
}

function formatMoney(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency ?? ''}`.trim();
  return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', {style: 'currency', currency: currency ?? 'EUR'}).format(value);
}

function friendlyAction(actionType) { return t('actions')[actionType] ?? actionType.replaceAll('_', ' '); }
function friendlyRole(role) { return t('roles')[role] ?? role.replaceAll('_', ' '); }

function openEvidence(assertion) {
  const meta = el('div', 'claim-meta');
  meta.append(kindBadge(kindName(assertion)), el('span', 'verification-badge', assertion.verification_status));
  evidenceContent.replaceChildren(meta, el('p', 'claim-statement', assertion.statement));

  if (assertion.asserted_by || assertion.target_party) {
    const parties = el('div', 'claim-parties');
    if (assertion.asserted_by) {
      const item = el('div'); item.append(el('small', '', t('assertedBy')), el('strong', '', assertion.asserted_by)); parties.append(item);
    }
    if (assertion.target_party) {
      const item = el('div'); item.append(el('small', '', t('addressedTo')), el('strong', '', assertion.target_party)); parties.append(item);
    }
    evidenceContent.append(parties);
  }

  for (const source of assertion.evidence_refs) {
    const card = el('article', 'source-card');
    const route = el('div', 'source-route');
    route.append(el('span', '', `${t('document')}: ${documentName(source.document_id)}`), el('span', '', `${t('page')} ${source.page_number}`), el('span', '', t('exactFragment')));
    const hashes = el('div', 'hash-grid');
    hashes.append(
      el('code', '', `${t('offsets')}: ${source.normalized_start}–${source.normalized_end}`),
      el('code', '', `${t('fragmentHash')}: ${source.fragment_sha256}`),
      el('code', '', `Document SHA-256: ${source.document_sha256}`),
      el('code', '', `${t('pageHash')}: ${source.page_text_sha256}`),
    );
    card.append(route, el('blockquote', '', source.fragment), hashes);
    evidenceContent.append(card);
  }
  if (evidenceDialog.open) evidenceDialog.close();
  evidenceDialog.showModal();
}

function focusEvidenceById(assertionId) {
  const {matter, assertion} = findDossierAssertion(currentResult, assertionId);
  selectedMatterId = matter.matter_id;
  renderSelectedMatter();
  openEvidence(assertion);
  return {
    focused: true,
    matter_id: matter.matter_id,
    matter_label: matter.label,
    assertion_id: assertion.assertion_id,
    statement: assertion.statement,
    verification_status: assertion.verification_status,
    evidence_refs: assertion.evidence_refs.map((reference) => ({
      document_id: reference.document_id,
      page_number: reference.page_number,
    })),
  };
}

function proposalStateLabel(proposal) {
  if (proposal.proposal_status === 'accepted') return t('acceptedByHuman');
  if (proposal.proposal_status === 'rejected') return t('rejectedByHuman');
  return t('pendingHumanReview');
}

function formatProposalTimestamp(value) {
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function renderReviewProposals() {
  const proposals = [...reviewProposals.values()];
  reviewWorkflow.classList.toggle('hidden', proposals.length === 0);
  reviewProposalList.replaceChildren(...proposals.map((proposal) => {
    const card = el('article', `review-proposal ${proposal.proposal_status}`);
    card.dataset.proposalId = proposal.proposal_id;

    const head = el('div', 'proposal-head');
    const badges = el('div', 'proposal-badges');
    badges.append(
      el('span', 'proposal-origin', t('agentProposal')),
      el('span', 'proposal-state', proposalStateLabel(proposal)),
    );
    head.append(badges, el('code', 'proposal-id', proposal.proposal_id));

    const copy = el('div', 'proposal-copy');
    const proposed = el('div');
    proposed.append(
      el('small', '', t('proposedReviewStatus')),
      el('strong', '', proposal.proposed_status.replaceAll('_', ' ')),
    );
    const rationale = el('div');
    rationale.append(el('small', '', t('rationale')), el('p', '', proposal.rationale));
    copy.append(proposed, rationale);

    const canonical = el(
      'div',
      'canonical-snapshot',
      `${t('canonicalUnchanged')} · ${proposal.canonical_assertion.assertion_kind} · ${proposal.canonical_assertion.verification_status}`,
    );
    const meta = el('div', 'proposal-meta');
    meta.append(
      el('span', '', `${t('proposalActor')}: ${proposal.actor}`),
      el('span', '', `${t('proposalCreated')}: ${formatProposalTimestamp(proposal.timestamp)}`),
      el('span', '', proposal.assertion_id),
    );
    card.append(head, copy, canonical, meta);

    if (proposal.proposal_status === 'pending') {
      const actions = el('div', 'proposal-actions');
      const reject = button('proposal-button reject', t('reject'));
      const accept = button('proposal-button accept', t('accept'));
      reject.addEventListener('click', () => recordHumanDecision(proposal.proposal_id, 'rejected'));
      accept.addEventListener('click', () => recordHumanDecision(proposal.proposal_id, 'accepted'));
      actions.append(reject, accept);
      card.append(actions);
    } else {
      const decision = el('div', 'human-decision');
      decision.append(
        el('strong', '', `${t('humanDecision')}: `),
        el('span', '', proposalStateLabel(proposal)),
        el('span', '', ` · ${formatProposalTimestamp(proposal.human_decision.timestamp)}`),
      );
      card.append(decision);
    }
    return card;
  }));
}

function recordHumanDecision(proposalId, decision) {
  const proposal = reviewProposals.get(proposalId);
  if (!proposal) throw new Error(`Review proposal ${proposalId} does not exist.`);
  reviewProposals.set(
    proposalId,
    decideReviewProposal(proposal, decision, {actor: 'human'}),
  );
  renderReviewProposals();
}

function createPendingReviewProposal(input) {
  const proposal = createReviewProposal(currentResult, input);
  reviewProposals.set(proposal.proposal_id, proposal);
  if (evidenceDialog.open) evidenceDialog.close();
  renderReviewProposals();
  reviewWorkflow.scrollIntoView({behavior: 'smooth', block: 'center'});
  return proposal;
}

function renderTimeline(matter) {
  const panel = el('section', 'panel');
  panel.append(el('h4', '', t('timeline')), el('p', 'panel-subtitle', t('timelineHint')));
  const events = [
    ...matter.timeline.filter((event) => !/^Document dated/i.test(event.description)),
    ...matter.undated_timeline.map((event) => ({...event, undated: true})),
  ];
  if (!events.length) { panel.append(el('div', 'empty-state', t('noTimeline'))); return panel; }
  const timeline = el('div', 'timeline');
  for (const event of events) {
    const row = el('div', `timeline-event${event.undated ? ' undated' : ''}`);
    row.append(el('time', 'timeline-date', formatDate(event.date)), el('div', 'timeline-copy', event.description.replace(/^EVENT:\s*/i, '')));
    timeline.append(row);
  }
  panel.append(timeline);
  return panel;
}

function renderAmounts(matter) {
  const panel = el('section', 'panel');
  panel.append(el('h4', '', t('amounts')), el('p', 'panel-subtitle', t('amountsHint')));
  if (!matter.amount_ledger.length) { panel.append(el('div', 'empty-state', t('noAmounts'))); return panel; }
  const list = el('div', 'amount-list');
  for (const entry of matter.amount_ledger) {
    const allegation = entry.assertion_kind === 'PARTY_ALLEGATION';
    const row = el('div', `amount-row${allegation ? ' allegation' : ''}`);
    const top = el('div', 'amount-top');
    top.append(el('span', 'amount-role', friendlyRole(entry.role)), el('strong', 'amount-value', formatMoney(entry.amount, entry.currency)));
    row.append(top, kindBadge(allegation ? 'PARTY_ALLEGATION' : 'FACT'));
    if (entry.asserted_by) row.append(el('small', '', `${t('assertedBy')}: ${entry.asserted_by}`));
    list.append(row);
  }
  panel.append(list);
  return panel;
}

function renderActionAndAlerts(matter, action) {
  const panel = el('section', 'panel');
  panel.append(el('h4', '', t('nextAction')), el('p', 'panel-subtitle', t('safeguards')));
  if (action) {
    const card = el('div', 'action-card');
    card.append(kindBadge('PROPOSED_ACTION'), el('h5', '', friendlyAction(action.action_type)), el('p', '', action.description));
    const meta = el('div', 'action-meta');
    meta.append(el('span', '', t('proposed')), el('span', '', `${t('target')}: ${action.target_party}`), el('span', '', action.requires_human_approval ? t('approval') : t('noApproval')));
    card.append(meta); panel.append(card);
  }

  const alerts = el('div', 'alerts');
  for (const conflict of matter.conflicts ?? []) {
    const alert = el('div', 'alert conflict');
    alert.append(kindBadge('UNRESOLVED'), el('strong', '', t('unresolved')), el('span', '', `${conflict.predicate}: ${conflict.alternatives.map((item) => item.value.text ?? item.value.amount ?? item.value.iso).join(' ↔ ')}`));
    alerts.append(alert);
  }
  for (const missing of matter.missing_evidence ?? []) {
    const alert = el('div', 'alert'); alert.append(kindBadge('NEEDS_HUMAN_REVIEW'), el('strong', '', t('humanReview')), el('span', '', missing.description)); alerts.append(alert);
  }
  const directives = matter.assertions.filter((assertion) => assertion.predicate === 'deadline.directive');
  for (const directive of directives) {
    const alert = el('div', 'alert deadline');
    alert.append(el('strong', '', t('deadlineSafe')), el('span', '', `${t('deadlineFor')} ${directive.target_party} ${t('notSubject')}`)); alerts.append(alert);
  }
  if (!alerts.children.length) alerts.append(el('div', 'empty-state', t('noAlertsText')));
  panel.append(alerts);
  return panel;
}

function renderEvidenceList(matter) {
  const panel = el('section', 'panel full');
  panel.append(el('h4', '', t('evidenceTrail')), el('p', 'panel-subtitle', t('evidenceHint')));
  const list = el('div', 'evidence-list');
  const ranked = [...matter.assertions].sort((a, b) => {
    const score = (item) => item.needs_human_review ? 0 : item.assertion_kind === 'PARTY_ALLEGATION' ? 1 : item.predicate === 'deadline.directive' ? 2 : 3;
    return score(a) - score(b);
  });
  for (const assertion of ranked) {
    const row = button('assertion-row');
    row.append(kindBadge(kindName(assertion)), el('span', 'assertion-statement', assertion.statement));
    const count = assertion.evidence_refs.length;
    row.append(el('span', 'source-count', `${count} ${count === 1 ? t('sources') : t('sourcesPlural')} →`));
    row.addEventListener('click', () => openEvidence(assertion));
    list.append(row);
  }
  panel.append(list);
  return panel;
}

function matterAlertCount(matter) { return (matter.conflicts?.length ?? 0) + (matter.missing_evidence?.length ?? 0); }

function renderSelectedMatter() {
  const {dossier} = currentResult;
  const matter = dossier.matters.find((item) => item.matter_id === selectedMatterId) ?? dossier.matters[0];
  selectedMatterId = matter.matter_id;
  matterTabs.querySelectorAll('.matter-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.matterId === matter.matter_id));

  const head = el('div', 'matter-heading');
  const title = el('div');
  title.append(el('h3', '', matter.label), el('p', '', `${dossier.subject_party} · ${matter.document_ids.length} ${t('documents')}`));
  head.append(title, el('span', `state ${matter.matter_state}`, matter.matter_state));
  const grid = el('div', 'detail-grid');
  const action = dossier.actions.find((item) => item.matter_id === matter.matter_id);
  grid.append(renderTimeline(matter), renderAmounts(matter), renderActionAndAlerts(matter, action), renderEvidenceList(matter));
  matterDetail.replaceChildren(head, grid);
}

function renderResult(result) {
  currentResult = result;
  const {dossier, report} = result;
  const incomingRunId = dossier.run_id ?? report.run_id;
  if (reviewProposalRunId && reviewProposalRunId !== incomingRunId) reviewProposals.clear();
  reviewProposalRunId = incomingRunId;
  const supported = dossier.matters.flatMap((matter) => matter.assertions).filter((assertion) => assertion.verification_status === 'SUPPORTED' && assertion.evidence_refs.length).length;
  const reviewCount = dossier.matters.reduce((sum, matter) => sum + matterAlertCount(matter), 0) + dossier.unclassified_document_ids.length;
  summary.replaceChildren(
    metric(t('matters'), dossier.matters.length),
    metric(t('canonicalDocs'), dossier.source_batch.canonical_files),
    metric(t('duplicates'), dossier.source_batch.duplicate_files),
    metric(t('verifiedCitations'), supported, true),
    metric(t('criticalErrors'), report.metrics.critical_errors, report.metrics.critical_errors === 0),
  );
  resultSubtitle.textContent = `${dossier.source_batch.total_files} PDFs → ${dossier.matters.length} ${t('matters').toLowerCase()} · ${reviewCount ? `${reviewCount} ${t('attention')}` : t('noAlerts')}`;
  runProof.textContent = isReadOnlyDemo
    ? `${t('verifiedSnapshot')} · ${report.run_id} · ${t('claimsCited')}`
    : `${t('completed')} · ${t('run')} ${report.run_id.slice(0, 8)} · ${t('claimsCited')}`;
  matterCount.textContent = dossier.matters.length;

  matterTabs.replaceChildren();
  for (const matter of dossier.matters) {
    const tab = button('matter-tab'); tab.dataset.matterId = matter.matter_id;
    const top = el('div', 'matter-tab-top'); top.append(el('strong', '', matter.label), el('span', `state ${matter.matter_state}`, matter.matter_state));
    const alerts = matterAlertCount(matter);
    tab.append(top, el('small', alerts ? 'matter-tab-alert' : '', alerts ? `${alerts} ${t('attention')}` : `${matter.document_ids.length} ${t('documents')}`));
    tab.addEventListener('click', () => { selectedMatterId = matter.matter_id; renderSelectedMatter(); });
    matterTabs.append(tab);
  }
  selectedMatterId = dossier.matters[0]?.matter_id;
  renderSelectedMatter();
  renderReviewProposals();
  results.classList.remove('hidden');
  results.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function startProgress() {
  progress.classList.remove('hidden'); results.classList.add('hidden');
  const stages = t('stages'); let index = 0;
  const draw = () => {
    stageList.replaceChildren(...stages.map((stage, stageIndex) => {
      const item = el('li', `stage-item ${stageIndex < index ? 'complete' : stageIndex === index ? 'active' : ''}`);
      item.append(el('span', 'stage-icon', stageIndex < index ? '✓' : String(stageIndex + 1)), el('span', '', stage)); return item;
    }));
  };
  draw();
  const timer = setInterval(() => { if (index < stages.length - 1) { index += 1; draw(); } }, 900);
  return {
    complete() { clearInterval(timer); stageList.replaceChildren(...stages.map((stage) => { const item = el('li', 'stage-item complete'); item.append(el('span', 'stage-icon', '✓'), el('span', '', stage)); return item; })); },
    fail(message) { clearInterval(timer); stageList.replaceChildren(el('li', 'stage-item active', `Unable to complete: ${message}`)); },
  };
}

function renderCompletedStages() {
  stageList.replaceChildren(...t('stages').map((stage) => {
    const item = el('li', 'stage-item complete');
    item.append(el('span', 'stage-icon', '✓'), el('span', '', stage));
    return item;
  }));
}

async function run(url, body, documentNames, method = 'POST') {
  goldenButton.disabled = true;
  if (uploadButton) uploadButton.disabled = true;
  currentDocumentNames = documentNames;
  const status = startProgress();
  const minimumDisplay = new Promise((resolve) => setTimeout(resolve, 1200));
  try {
    const request = fetch(url, {method, headers: body ? {'content-type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    const [response] = await Promise.all([request, minimumDisplay]);
    const result = await response.json();
    if (!response.ok) throw new Error(`${result.error}: ${result.message}`);
    status.complete();
    await new Promise((resolve) => setTimeout(resolve, 320));
    renderResult(result);
  } catch (error) {
    status.fail(error.message);
  } finally {
    goldenButton.disabled = false;
    if (uploadButton) uploadButton.disabled = selectedFiles.length === 0;
  }
}

async function base64File(file) {
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return btoa(binary);
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function namesForFiles(files) {
  const names = new Map();
  for (const file of files) {
    const fileHash = await sha256Hex(await file.arrayBuffer());
    const id = `doc_${(await sha256Hex(fileHash)).slice(0, 16)}`;
    names.set(id, [...(names.get(id) ?? []), file.name]);
  }
  return names;
}

function updateSelectedFiles(files) {
  if (!uploadButton || !fileList) return;
  selectedFiles = [...files].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  uploadButton.disabled = selectedFiles.length === 0;
  fileList.replaceChildren(...selectedFiles.map((file) => {
    const row = el('div', 'selected-file'); row.append(el('span', '', file.name), el('span', '', `${(file.size / 1024).toFixed(1)} KB`)); return row;
  }));
  if (selectedFiles.length) fileList.prepend(el('strong', 'selected-file', `${selectedFiles.length} ${selectedFiles.length === 1 ? t('fileSelected') : t('filesSelected')}`));
}

goldenButton.addEventListener('click', () => run(
  isReadOnlyDemo ? '/api/demo-result' : '/api/process-golden',
  null,
  new Map(demoDocuments),
  isReadOnlyDemo ? 'GET' : 'POST',
));
pdfInput?.addEventListener('change', () => updateSelectedFiles(pdfInput.files));
uploadButton?.addEventListener('click', async () => {
  const names = await namesForFiles(selectedFiles);
  const files = await Promise.all(selectedFiles.map(async (file) => ({name: file.name, base64: await base64File(file)})));
  await run('/api/process', {files}, names);
});
for (const eventName of ['dragenter', 'dragover']) dropZone?.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) dropZone?.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone?.addEventListener('drop', (event) => updateSelectedFiles(event.dataTransfer.files));

closeEvidence.addEventListener('click', () => evidenceDialog.close());
evidenceDialog.addEventListener('click', (event) => { if (event.target === evidenceDialog) evidenceDialog.close(); });
document.querySelectorAll('.language-button').forEach((element) => element.addEventListener('click', () => {
  language = element.dataset.language; translateStatic();
  renderRuntimeStatus();
  renderWebMcpStatus();
  if (currentResult) {
    renderCompletedStages();
    renderResult(currentResult);
  } else updateSelectedFiles(selectedFiles);
}));

translateStatic();
const webMcpRegistration = await registerGetDossierSummary({
  modelContext: document.modelContext,
  getCurrentResult: () => currentResult,
  getSelectedMatterId: () => selectedMatterId,
  onActivity: recordWebMcpActivity,
}).catch((error) => {
  console.error('Unable to register WebMCP tool.', error);
  return {status: 'unavailable'};
});
const focusEvidenceRegistration = await registerFocusEvidence({
  modelContext: document.modelContext,
  focusEvidence: focusEvidenceById,
  onActivity: recordWebMcpActivity,
}).catch((error) => {
  console.error('Unable to register WebMCP tool.', error);
  return {status: 'unavailable'};
});
const inspectAssertionRegistration = await registerInspectAssertion({
  modelContext: document.modelContext,
  getCurrentResult: () => currentResult,
  onActivity: recordWebMcpActivity,
}).catch((error) => {
  console.error('Unable to register WebMCP tool.', error);
  return {status: 'unavailable'};
});
const proposeReviewRegistration = await registerProposeReviewStatus({
  modelContext: document.modelContext,
  createProposal: createPendingReviewProposal,
  onActivity: recordWebMcpActivity,
}).catch((error) => {
  console.error('Unable to register WebMCP tool.', error);
  return {status: 'unavailable'};
});
webMcpState = {
  ...webMcpState,
  availability: [
    webMcpRegistration,
    focusEvidenceRegistration,
    inspectAssertionRegistration,
    proposeReviewRegistration,
  ].every((registration) => registration.status === 'registered')
    ? 'registered'
    : 'unavailable',
};
renderWebMcpStatus();
if (isReadOnlyDemo) {
  const stack = document.querySelector('.runtime-stack');
  const stackItems = [
    ['runtimeStackSnapshot', t('runtimeStackSnapshot')],
    ['runtimeStackSynthetic', t('runtimeStackSynthetic')],
    ['runtimeStackNoInference', t('runtimeStackNoInference')],
  ].map(([key, label]) => {
    const item = el('span', '', label);
    item.dataset.i18n = key;
    return item;
  });
  stack?.replaceChildren(...stackItems);
  const documentList = document.querySelector('.file-stack');
  const filenames = [...demoDocuments.values()].flat();
  documentList?.classList.add('demo-document-list');
  documentList?.removeAttribute('aria-hidden');
  documentList?.setAttribute('aria-label', t('inputDocuments'));
  documentList?.replaceChildren(...filenames.map((filename) => {
    const link = el('a', '', filename);
    link.href = `/demo/documents/${encodeURIComponent(filename)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }));
}
try {
  const health = await fetch('/api/health').then((response) => {
    if (!response.ok) throw new Error('health'); return response.json();
  });
  const cloud = health.extractor_mode === 'vertex-adk' && health.storage === 'gcs-private-temporary';
  runtimeMode = health.mode === 'synthetic-readonly-presentation' ? 'demo' : cloud ? 'cloud' : 'local';
  renderRuntimeStatus();
} catch {
  runtimeMode = 'unavailable';
  renderRuntimeStatus();
}
