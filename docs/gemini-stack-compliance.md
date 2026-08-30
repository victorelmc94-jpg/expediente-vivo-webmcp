# Mandatory Gemini / Google stack compliance gate

**Audit date:** August 26, 2026  
**Official requirement:** Gemini 3.5 or newer through Gemini API or Vertex AI, at least one Google
Agent Framework, and at least one Google Cloud infrastructure service. See the official
[hackathon rules](https://allthingsagentichackathon.devpost.com/rules).

## Result

| Mandatory element | Expediente Vivo implementation | Gate |
|---|---|---:|
| Gemini 3.5+ | Gemini 3.7 Flash | PASS |
| Gemini API or Vertex AI | Vertex AI, location `eu` | PASS |
| Google Agent Framework | Google ADK 2.0.0, one `LlmAgent` named `ExpedienteAgent` | PASS |
| Google Cloud infrastructure | One authenticated Cloud Run service and private Cloud Storage | PASS |
| Real, central model use | Page packets enter Gemini; typed analyses and candidates feed every downstream dossier stage | PASS |
| Cloud proof | Correlated Cloud Run run IDs, ADK token usage and GCS run reports from repeated real calls | PASS |

Reproduce the repository consistency gate with `npm run gate:stack`. It checks ten invariants
covering the ADK/Vertex implementation, stage order, cloud evidence, UI, README, diagram,
submission and video script. Latest result: **10/10 PASS**.

## Ten-point evidence audit

### 1. Where Gemini 3.7 Flash is instantiated and configured

`src/agent/expediente-agent.js:221–240` constructs the ADK `Gemini` model with:

```js
new Gemini({model, vertexai: true, project, location})
```

That concrete model instance is assigned to one ADK `LlmAgent`. The default and deployed model is
`gemini-3.7-flash`; `src/config.js:8–32` reads `EXPEDIENTE_MODEL`, selects the `vertex` extractor
and refuses Vertex mode without a Google Cloud project and private storage configuration.

### 2. What Gemini receives

`src/agent/expediente-agent.js:146–161` creates a packet for every canonical, non-duplicate
document. Each packet contains:

- stable document ID and display name;
- page number;
- text-quality classification;
- exact normalized page text.

At `src/agent/expediente-agent.js:264–273`, ADK receives one user message with task
`extract_document_candidates` and those page packets as JSON. Missing/low-quality text is labelled
explicitly; Gemini does not receive hidden OCR or external case data.

### 3. What Gemini does that deterministic rules do not

Gemini performs the semantic work: it interprets prose and varied formatting, recognizes document
types, dates, parties, procedure/contract references and documentary relationships, maps meaning
to a closed predicate vocabulary, and proposes typed facts, party allegations and conservative
inferences with source fragments.

Deterministic code does not attempt to understand prose or invent candidate assertions. It checks
whether Gemini's proposed structure is permitted and actually supported by the supplied pages.

### 4. What structured output Gemini returns

The ADK `outputSchema` at `src/agent/expediente-agent.js:13–82` requires an object with:

- `analyses[]`: document ID/type/date, cross-document references, parties and review reasons;
- `candidates[]`: document ID, assertion kind, closed predicate, subject, typed value, statement,
  speaker/target where applicable, confidence, exact page fragments and review reasons.

The accepted assertion classes are `DOCUMENT_FACT`, `PARTY_ALLEGATION` and `AGENT_INFERENCE`.
`normalizeModelResult` converts this schema to the frozen internal contract; it does not certify
the candidates as true.

### 5. How deterministic validation follows the model

The enforced order is visible at `src/pipeline/run-vertical-slice.js:32–53`:

```text
PDF inspection
→ ExpedienteAgent candidate extraction
→ deterministic provenance gate
→ complete-provenance gate
→ deterministic matter grouping
→ deterministic dossier reconstruction and semantic guards
→ private artifact persistence
```

`src/provenance/validate.js` verifies the cited document and page, exact fragment membership,
character offsets, document SHA-256, fragment SHA-256 and page-text SHA-256. It also rejects an
allegation without a speaker, a deadline without a target and values outside the closed enums.

`src/matters/reconstruct.js:107–151` then blocks mixed procedures, wrong-party deadlines and
promotion of claimed amounts/obligations into documentary facts. Conflicts become `UNRESOLVED`;
missing or degraded evidence becomes review. Gemini cannot bypass these gates.

### 6. How Google ADK orchestrates the execution

`src/agent/expediente-agent.js` imports `Gemini`, `LlmAgent` and `InMemoryRunner` from
`@google/adk`. `createRootAgent` binds the instruction, structured output schema and Gemini model
to the single `ExpedienteAgent`. `VertexAdkExtractor.extract` creates the ADK runner and calls
`runEphemeral`; ADK emits the model events from which the final structured JSON and usage metadata
are captured.

This is a real ADK execution path, not a direct SDK call relabelled as an agent.

### 7. How Vertex AI is present in the deployed path

The model adapter is configured with `vertexai: true`, Google Cloud project and `eu` location.
Cloud Run sets `EXPEDIENTE_EXTRACTOR=vertex`, so `src/config.js` instantiates
`VertexAdkExtractor`, not the deterministic local extractor. The runtime service account holds
`roles/aiplatform.user`. `/api/health` reports `model=gemini-3.7-flash`,
`extractor_mode=vertex-adk`, `vertex_configured=true` and private GCS storage; remote test T00
asserts those exact values.

The deterministic extractor exists only for local contract testing and is never acceptable as
the proof run in the final video.

### 8. Logs and telemetry proving real Gemini calls

The three final Cloud Run runs have correlated IDs in Cloud Logging, their persisted GCS
`run_report.json` files and the remote evaluator. Each ADK event captured real Vertex usage:

| Run ID | Input tokens | Output tokens | Total | Cloud Run event | Result |
|---|---:|---:|---:|---|---:|
| `477b564f-…` | 2,741 | 4,905 | 7,646 | `vertical_slice_completed` | 13/13 PASS |
| `8f9691b8-…` | 2,741 | 4,905 | 7,646 | `vertical_slice_completed` | 13/13 PASS |
| `e0981499-…` | 2,741 | 4,905 | 7,646 | `vertical_slice_completed` | 13/13 PASS |

The run report records `model=gemini-3.7-flash`, `extractor_mode=vertex-adk`, stage
`expediente_agent_extracts_candidates=PASS`, and `model_events[].usage_metadata`. The Cloud Run
log records the same run ID, extractor mode, private GCS mode, duration and result metrics. The
GCS paths use that same run ID for `dossier.json` and `run_report.json`.

The redacted, repository-safe extract is
[`docs/evidence/gemini-cloud-proof.json`](evidence/gemini-cloud-proof.json). Raw captures remain
local and Git-ignored because they contain cloud identifiers; their SHA-256 hashes are included in
the redacted extract.

### 9. Repository files proving the integration

| File | What it proves |
|---|---|
| `src/agent/expediente-agent.js` | Actual Gemini/Vertex instantiation, ADK agent/runner, page-packet input, schema and token metadata |
| `src/config.js` | Deployed Vertex selection and fail-closed cloud configuration |
| `src/pipeline/run-vertical-slice.js` | Model stage precedes deterministic gates and dossier assembly |
| `src/provenance/validate.js` | Source/page/fragment/offset/hash enforcement |
| `src/matters/group.js` | Deterministic grouping from model-proposed document analyses |
| `src/matters/reconstruct.js` | Allegation, deadline, matter-mixing and uncertainty guards |
| `src/server.js` | Cloud Run API, health proof and correlated completion log |
| `src/evaluation/remote-evaluator.js` | Remote T00 asserts ADK, Gemini, Vertex mode and private GCS |
| `scripts/run-cloud-validation.js` | Direct Vertex/GCS repeated-run evaluator with ADK usage capture |
| `scripts/run-cloud-run-validation.js` | Authenticated Cloud Run E2E evaluator and run correlation |
| `test/critical/vertical-slice.test.js` | Root ADK agent/model invariant and critical semantic gates |
| `package.json` / lockfile | Locked ADK, Gen AI SDK and Cloud Storage dependencies |

### 10. Exact final-video proof

The proof run must be a fresh authenticated Cloud Run execution, not the local deterministic mode
and not the public read-only/precomputed result:

1. **0:00–0:48:** show the live Cloud runtime badge, click the synthetic folder once and keep the
   execution continuous until the dossier appears. Retain the new run ID on screen.
2. **2:47–2:54:** in Cloud Logging, filter the same run ID and show
   `vertical_slice_completed`, `extractor_mode=vertex-adk` and the GCS artifact mode.
3. **2:54–3:04:** open that run's private GCS `run_report.json` and show the same run ID,
   `model=gemini-3.7-flash`, `expediente_agent_extracts_candidates: PASS`, and non-zero
   `model_events[].usage_metadata` input/output tokens.
4. **3:04–3:10:** show the architecture diagram with the ADK → Vertex AI model call and the
   subsequent deterministic gates.

If Vertex AI request metrics for that minute are immediately available, add a brief view as
supporting evidence; metrics can lag, so they must not replace the same-run log and run report.
Project IDs, account identities, bucket names and tokens must remain cropped.

## Interpretation risks and controls

| Risk | Control |
|---|---|
| A judge sees a public precomputed synthetic result and assumes Gemini is ornamental | State that the public page is read-only; the final video opens with a separate live authenticated Cloud Run run |
| Local deterministic mode is mistaken for the deployed model path | Never record a runtime badge that says local; README labels local mode as contract testing only |
| A Cloud Run log proves hosting but not a Gemini call | Correlate the log to the GCS run report containing model name, ADK stage and non-zero usage metadata |
| Model use looks like one generic summary call | Show the structured input/output contract and explain that every dossier stage consumes Gemini's typed analyses/candidates |
| Vertex metrics lag during recording | Use the persisted ADK usage metadata as primary evidence; metrics are supplementary |

## Verdict

**GEMINI REQUIREMENT CLEARLY SATISFIED.**
