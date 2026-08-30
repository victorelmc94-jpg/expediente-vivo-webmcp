import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  FOCUS_EVIDENCE_TOOL,
  GET_DOSSIER_SUMMARY_TOOL,
  INSPECT_ASSERTION_TOOL,
  PROPOSE_REVIEW_STATUS_TOOL,
  REVIEW_PROPOSAL_STATUSES,
  createAssertionInspection,
  createDossierSummary,
  createReviewProposal,
  decideReviewProposal,
  findDossierAssertion,
  registerFocusEvidence,
  registerGetDossierSummary,
  registerInspectAssertion,
  registerProposeReviewStatus,
} from '../../src/public/webmcp.js';

const snapshot = JSON.parse(
  await readFile(new URL('../../fixtures/demo-readonly/snapshot.json', import.meta.url), 'utf8'),
);

test('summary is derived from the open dossier and preserves real identifiers', () => {
  const selectedMatterId = snapshot.dossier.matters[1].matter_id;
  const summary = createDossierSummary(snapshot, selectedMatterId);

  assert.equal(summary.run_id, snapshot.dossier.run_id);
  assert.equal(summary.selected_matter_id, selectedMatterId);
  assert.deepEqual(
    summary.matters.map((matter) => matter.matter_id),
    snapshot.dossier.matters.map((matter) => matter.matter_id),
  );
  assert.equal(summary.source_batch.batch_sha256, snapshot.dossier.source_batch.batch_sha256);
  assert.equal(summary.metrics.accepted_assertions, snapshot.report.metrics.accepted_assertions);

  const expectedAttentionIds = snapshot.dossier.matters
    .flatMap((matter) => matter.assertions)
    .filter((assertion) => assertion.needs_human_review || assertion.verification_status !== 'SUPPORTED')
    .map((assertion) => assertion.assertion_id);
  assert.deepEqual(
    summary.matters.flatMap((matter) => matter.attention_items).map((item) => item.assertion_id),
    expectedAttentionIds,
  );
});

test('registers and executes get_dossier_summary through the WebMCP contract', async () => {
  let registeredTool;
  const activity = [];
  const modelContext = {
    async registerTool(tool) { registeredTool = tool; },
  };

  const registration = await registerGetDossierSummary({
    modelContext,
    getCurrentResult: () => snapshot,
    getSelectedMatterId: () => snapshot.dossier.matters[0].matter_id,
    onActivity: (event) => activity.push(event),
  });

  assert.deepEqual(registration, {status: 'registered', tool_name: GET_DOSSIER_SUMMARY_TOOL});
  assert.equal(registeredTool.name, GET_DOSSIER_SUMMARY_TOOL);
  assert.equal(registeredTool.annotations.readOnlyHint, true);
  assert.deepEqual(registeredTool.inputSchema.required, []);
  assert.equal(registeredTool.inputSchema.additionalProperties, false);

  const result = await registeredTool.execute({});
  assert.equal(result.run_id, snapshot.dossier.run_id);
  assert.equal(result.matters[0].matter_id, snapshot.dossier.matters[0].matter_id);
  assert.deepEqual(activity, [{
    tool_name: GET_DOSSIER_SUMMARY_TOOL,
    status: 'success',
    run_id: snapshot.dossier.run_id,
    matter_count: snapshot.dossier.matters.length,
  }]);
});

test('reports unsupported browsers and refuses execution without an open dossier', async () => {
  assert.deepEqual(
    await registerGetDossierSummary({modelContext: {}, getCurrentResult: () => null}),
    {status: 'unavailable', tool_name: GET_DOSSIER_SUMMARY_TOOL},
  );

  let registeredTool;
  const activity = [];
  await registerGetDossierSummary({
    modelContext: {async registerTool(tool) { registeredTool = tool; }},
    getCurrentResult: () => null,
    getSelectedMatterId: () => null,
    onActivity: (event) => activity.push(event),
  });
  await assert.rejects(registeredTool.execute({}), /No dossier is open/);
  assert.equal(activity[0].status, 'error');
});

test('finds real dossier assertions and rejects identifiers outside the open dossier', () => {
  const expectedMatter = snapshot.dossier.matters[0];
  const expectedAssertion = expectedMatter.assertions[0];
  const found = findDossierAssertion(snapshot, expectedAssertion.assertion_id);
  assert.equal(found.matter, expectedMatter);
  assert.equal(found.assertion, expectedAssertion);
  assert.throws(
    () => findDossierAssertion(snapshot, 'assertion_not_in_this_dossier'),
    /does not exist in the open dossier/,
  );
});

test('registers focus_evidence and returns the visible-focus verification payload', async () => {
  const expectedMatter = snapshot.dossier.matters[0];
  const expectedAssertion = expectedMatter.assertions.find((assertion) => assertion.needs_human_review);
  let registeredTool;
  const activity = [];
  const focusResult = {
    focused: true,
    matter_id: expectedMatter.matter_id,
    assertion_id: expectedAssertion.assertion_id,
    evidence_refs: expectedAssertion.evidence_refs.map(({document_id, page_number}) => ({document_id, page_number})),
  };

  const registration = await registerFocusEvidence({
    modelContext: {async registerTool(tool) { registeredTool = tool; }},
    focusEvidence: (assertionId) => {
      assert.equal(assertionId, expectedAssertion.assertion_id);
      return focusResult;
    },
    onActivity: (event) => activity.push(event),
  });

  assert.deepEqual(registration, {status: 'registered', tool_name: FOCUS_EVIDENCE_TOOL});
  assert.equal(registeredTool.name, FOCUS_EVIDENCE_TOOL);
  assert.deepEqual(registeredTool.inputSchema.required, ['assertion_id']);
  assert.equal(registeredTool.inputSchema.additionalProperties, false);
  assert.deepEqual(
    await registeredTool.execute({assertion_id: expectedAssertion.assertion_id}),
    focusResult,
  );
  assert.deepEqual(activity, [{
    tool_name: FOCUS_EVIDENCE_TOOL,
    status: 'success',
    assertion_id: expectedAssertion.assertion_id,
    matter_id: expectedMatter.matter_id,
  }]);
});

test('inspect_assertion returns existing evidence and provenance without transformation', () => {
  const matter = snapshot.dossier.matters[0];
  const assertion = matter.assertions.find((item) => item.needs_human_review);
  const inspection = createAssertionInspection(snapshot, assertion.assertion_id);

  assert.equal(inspection.assertion_id, assertion.assertion_id);
  assert.equal(inspection.matter_id, matter.matter_id);
  assert.equal(inspection.assertion_kind, assertion.assertion_kind);
  assert.equal(inspection.verification_status, assertion.verification_status);
  assert.equal(inspection.extraction_confidence, assertion.extraction_confidence);
  assert.deepEqual(inspection.evidence_refs, assertion.evidence_refs);
  assert.deepEqual(inspection.review_reasons, assertion.review_reasons);
  assert.deepEqual(
    inspection.related_missing_evidence,
    matter.missing_evidence.filter((item) => item.assertion_id === assertion.assertion_id),
  );
  assert.throws(
    () => createAssertionInspection(snapshot, 'assertion_invalid'),
    /does not exist in the open dossier/,
  );
});

test('registers inspect_assertion and fails cleanly for an invalid id', async () => {
  const tools = new Map();
  const activity = [];
  const modelContext = {async registerTool(tool) { tools.set(tool.name, tool); }};
  const registration = await registerInspectAssertion({
    modelContext,
    getCurrentResult: () => snapshot,
    onActivity: (event) => activity.push(event),
  });
  const tool = tools.get(INSPECT_ASSERTION_TOOL);
  const assertion = snapshot.dossier.matters[0].assertions[0];

  assert.deepEqual(registration, {status: 'registered', tool_name: INSPECT_ASSERTION_TOOL});
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.deepEqual(tool.inputSchema.required, ['assertion_id']);
  assert.equal((await tool.execute({assertion_id: assertion.assertion_id})).statement, assertion.statement);
  await assert.rejects(tool.execute({assertion_id: 'assertion_invalid'}), /does not exist in the open dossier/);
  assert.deepEqual(activity.map((event) => event.status), ['success', 'error']);
});

test('agent proposals stay pending and separate from the canonical assertion', () => {
  const assertion = snapshot.dossier.matters[0].assertions.find((item) => item.needs_human_review);
  const canonicalBefore = structuredClone(assertion);
  const proposal = createReviewProposal(snapshot, {
    assertion_id: assertion.assertion_id,
    proposed_status: 'NEEDS_MORE_EVIDENCE',
    rationale: 'The referenced legible attachment is absent from the supplied dossier.',
  }, {
    proposalId: 'proposal_test_pending',
    timestamp: '2026-08-30T12:00:00.000Z',
  });

  assert.equal(proposal.proposal_id, 'proposal_test_pending');
  assert.equal(proposal.actor, 'agent');
  assert.equal(proposal.proposal_status, 'pending');
  assert.equal(proposal.human_decision, null);
  assert.equal(proposal.canonical_assertion.verification_status, assertion.verification_status);
  assert.deepEqual(assertion, canonicalBefore);
});

test('an agent cannot promote an allegation to a fact or target an invalid id', () => {
  const allegation = snapshot.dossier.matters
    .flatMap((matter) => matter.assertions)
    .find((assertion) => assertion.assertion_kind === 'PARTY_ALLEGATION');
  const canonicalBefore = structuredClone(allegation);

  assert.throws(() => createReviewProposal(snapshot, {
    assertion_id: allegation.assertion_id,
    proposed_status: 'DOCUMENT_FACT',
    rationale: 'Promote this allegation directly to a canonical fact.',
  }), /Unsupported review proposal status/);
  assert.throws(() => createReviewProposal(snapshot, {
    assertion_id: 'assertion_invalid',
    proposed_status: 'KEEP_CURRENT_CLASSIFICATION',
    rationale: 'Keep the current classification for human review.',
  }), /does not exist in the open dossier/);
  assert.deepEqual(allegation, canonicalBefore);
});

test('ACCEPT and REJECT require an explicit human actor and do not mutate the pending proposal', () => {
  const assertion = snapshot.dossier.matters[0].assertions[0];
  const proposal = createReviewProposal(snapshot, {
    assertion_id: assertion.assertion_id,
    proposed_status: 'READY_FOR_HUMAN_REVIEW',
    rationale: 'The existing provenance is complete enough for a person to review.',
  }, {
    proposalId: 'proposal_test_decision',
    timestamp: '2026-08-30T12:00:00.000Z',
  });

  assert.throws(
    () => decideReviewProposal(proposal, 'accepted', {actor: 'agent'}),
    /Only an explicit human action/,
  );
  const accepted = decideReviewProposal(proposal, 'accepted', {
    actor: 'human',
    timestamp: '2026-08-30T12:05:00.000Z',
  });
  const rejected = decideReviewProposal(proposal, 'rejected', {
    actor: 'human',
    timestamp: '2026-08-30T12:06:00.000Z',
  });

  assert.equal(proposal.proposal_status, 'pending');
  assert.equal(accepted.proposal_status, 'accepted');
  assert.deepEqual(accepted.human_decision, {
    decision: 'accepted',
    actor: 'human',
    timestamp: '2026-08-30T12:05:00.000Z',
  });
  assert.equal(rejected.proposal_status, 'rejected');
  assert.equal(rejected.human_decision.actor, 'human');
});

test('proposal and human decision leave evidence provenance byte-for-byte intact', () => {
  const assertion = snapshot.dossier.matters[0].assertions.find((item) => item.needs_human_review);
  const provenanceBefore = structuredClone(assertion.evidence_refs);
  const proposal = createReviewProposal(snapshot, {
    assertion_id: assertion.assertion_id,
    proposed_status: 'NEEDS_MORE_EVIDENCE',
    rationale: 'The missing attachment must be supplied before canonical review can continue.',
  }, {proposalId: 'proposal_test_provenance'});
  decideReviewProposal(proposal, 'accepted', {actor: 'human'});
  const inspectionAfter = createAssertionInspection(snapshot, assertion.assertion_id);

  assert.deepEqual(assertion.evidence_refs, provenanceBefore);
  assert.deepEqual(inspectionAfter.evidence_refs, provenanceBefore);
});

test('registers propose_review_status with narrow review-only inputs', async () => {
  let registeredTool;
  const activity = [];
  const assertion = snapshot.dossier.matters[0].assertions.find((item) => item.needs_human_review);
  const registration = await registerProposeReviewStatus({
    modelContext: {async registerTool(tool) { registeredTool = tool; }},
    createProposal: (input) => createReviewProposal(snapshot, input, {
      proposalId: 'proposal_test_registered',
      timestamp: '2026-08-30T12:00:00.000Z',
    }),
    onActivity: (event) => activity.push(event),
  });

  assert.deepEqual(registration, {status: 'registered', tool_name: PROPOSE_REVIEW_STATUS_TOOL});
  assert.equal(registeredTool.annotations.readOnlyHint, false);
  assert.deepEqual(registeredTool.inputSchema.properties.proposed_status.enum, REVIEW_PROPOSAL_STATUSES);
  assert.deepEqual(
    registeredTool.inputSchema.required,
    ['assertion_id', 'proposed_status', 'rationale'],
  );
  const proposal = await registeredTool.execute({
    assertion_id: assertion.assertion_id,
    proposed_status: 'NEEDS_MORE_EVIDENCE',
    rationale: 'The referenced legible attachment is absent from the supplied dossier.',
  });
  assert.equal(proposal.proposal_status, 'pending');
  assert.equal(activity[0].proposal_id, proposal.proposal_id);
});
