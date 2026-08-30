# Challenge delta — prior Expediente Vivo versus WebMCP work

This document is the timestamped prior/new-work disclosure for the OpenAI WebMCP Challenge.

## Baseline: existing before the WebMCP extension

Tag: `pre-webmcp-baseline`  
Commit: `518420a363e71eb0f1f550ce434cee4b89ddd2f5`  
Imported snapshot timestamp: August 30, 2026 at 13:44 CEST

The tag records the unmodified challenge-copy baseline. It is an import boundary, not a claim that
the underlying work was first authored at that time.

Existing components include:

- PDF intake and page-preserving text extraction;
- document hashing and exact deduplication;
- the model-assisted structured extraction path;
- deterministic provenance and semantic validation;
- matter grouping, timeline, amount and state reconstruction;
- the dossier schema and synthetic datasets;
- local/private storage adapters and the Node HTTP server;
- the original dossier interface, evidence cards and read-only demo mode;
- pre-WebMCP tests and earlier technical evaluation documents.

Judges should not score those components as new WebMCP Challenge work.

## Phase 1: WebMCP is real

Commit: `c174846e21f7152c20a0d8d3edfc05acdff9342b`  
Timestamp: August 30, 2026 at 14:03 CEST

Added:

- `src/public/webmcp.js` with tool registration and structured dossier adapters;
- `get_dossier_summary` using the real open synthetic dossier;
- `focus_evidence` with a visible matter selection and evidence-dialog change;
- browser capability detection and registration through `document.modelContext`;
- restrained site-tool status and last-call observability;
- WebMCP contract tests and the `test:webmcp` script.

## Phase 2: human–agent review

Commit: `3dc877f29420b6eae607ef58b6edd9dd391f9de2`  
Timestamp: August 30, 2026 at 14:16 CEST

Added:

- `inspect_assertion`, returning existing typed assertion and provenance fields only;
- `propose_review_status`, creating a separate pending proposal with rationale and timestamp;
- the **AGENT PROPOSAL · Pending human review** interface;
- human-only `ACCEPT` and `REJECT` controls;
- proposal state isolated from the canonical dossier;
- tests for invalid IDs, provenance integrity, non-promotion of allegations, explicit human
  decisions and regressions in both Phase 1 tools.

Diff from the baseline through Phase 2: seven files changed; 929 lines added and two removed. The
changes are concentrated in the browser integration and its tests, not the documentary engine.

## Phase 3: candidature hardening

Phase 3 adds no product capability. Its scope is:

- MIT license and judge-oriented English documentation;
- official eligibility checklist and prior/new disclosure;
- reproducible judge instructions, sub-three-minute demo script and Devpost draft;
- repository secret/PII audit tooling;
- a separate synthetic-only hosting adapter and its tests;
- release and clean-session validation evidence.

## Why the delta is meaningful

Before WebMCP, a person could browse a traceable dossier. An external agent had no stable,
application-defined way to understand its domain IDs, inspect provenance, navigate to exact
evidence or hand off a bounded proposal for human decision.

After the extension, the agent can operate through four typed capabilities while the application
preserves its trust contract. This is more than DOM automation: the tool results expose the same
structured semantics the app uses internally, and tool actions have explicit safety boundaries.

