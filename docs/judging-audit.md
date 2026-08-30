# Judging audit

Audited against the official [rules](https://allthingsagentichackathon.devpost.com/rules),
[resources](https://allthingsagentichackathon.devpost.com/resources) and
[FAQ](https://allthingsagentichackathon.devpost.com/details/faqs) on August 26, 2026.

## Stage-one eligibility

| Requirement | Evidence | Status / remaining action |
|---|---|---|
| Gemini 3.5+ through Gemini API or Vertex AI | Gemini 3.7 Flash through Vertex AI; ADK events captured non-zero model usage for correlated Cloud Run run IDs | PASS |
| Google Agent Framework | One `ExpedienteAgent` implemented with Google ADK 2.0.0 | PASS |
| Google Cloud infrastructure | Private Cloud Run, private Cloud Storage, Cloud Build, Artifact Registry | PASS |
| English support | English is the default UI and all submission drafts are in English; Spanish is optional | PASS |
| Architecture diagram | Editable SVG and PNG export in `docs/assets/` | PASS |
| Public demo video, four minutes maximum | Script targets 3:15; recording and public upload intentionally pending | PENDING HUMAN ACTION |
| Working repository and setup instructions | Locked dependencies, README spin-up/deploy instructions, tests and reports | PASS; final repository URL/access pending |
| Hosted URL encouraged, not mandatory | Access recommendation documented separately | DECISION PENDING |

## Weighted criteria

| Criterion | Existing evidence | Must be explicit in demo/submission | Weakness | Minimum improvement |
|---|---|---|---|---|
| **Innovation & Operational Utility — 40%** | A messy multi-matter batch becomes distinct dossiers with timeline, amount roles, state, uncertainty and safe next action. Assertions remain typed and inspectable. | Start with the folder and one click. Show two matters, allegation ≠ recognized debt, correct deadline target, human review and final actionable state. | Synthetic-only validation limits claims about production utility. | Frame the problem as a recurring document-operations burden and describe the MVP evidence honestly; do not imply production legal reliability. |
| **Architectural Discipline & Tech Stack — 30%** | One ADK agent, Gemini 3.7 Flash on Vertex AI, one Cloud Run service, private temporary GCS. Deterministic provenance and semantic gates sit after model proposals. | Use the architecture diagram and state “Gemini proposes; rules validate.” Correlate the UI run ID with Cloud Logging and its GCS run report showing model name, ADK stage and non-zero token usage. | A viewer could mistake the public read-only UI for a static case viewer unless the separate live execution is explicit. | Record one continuous authenticated cloud run and the same-run proof; never present the precomputed public view as live. |
| **Demo & Production Readiness — 30%** | Reproducible container, locked dependencies, private deployment, two independent datasets, 19 local tests, repeated cloud runs, zero critical errors and full provenance. | Keep the live core run unedited. Show exact evidence trace, Cloud proof, limits and reproducible README/diagram. | Public judge access and final video do not yet exist; moderate advisories remain before anonymous exposure. | Make the human access decision, apply its security gate, record the scripted 3:15 take and verify all URLs in an incognito session. |

## Proof that this is not a chatbot

The user does not hold a conversation or direct each step. One batch submission triggers this
autonomous workflow:

```text
PDF batch
  → validate and inventory
  → extract page-preserving text
  → hash and deduplicate
  → propose typed assertions with Gemini through ADK
  → separate matters
  → validate provenance and critical semantics
  → reconstruct timeline, amounts, state and uncertainty
  → persist dossier and run report
  → render selectable evidence and a safe proposed action
```

Its durable output is `dossier.json`, not a chat response. Deterministic gates can reject model
output, and external actions are never performed. The demo must show both the autonomous breadth
and the system's ability to refuse certainty.

## Competitive assessment

- **Strongest evidence:** operational usefulness, source-level traceability and conservative
  behavior on adversarial cases.
- **Most important narrative:** the innovation is not PDF summarization; it is reconstructing a
  mixed case folder into a typed, verifiable state that supports a safe next step.
- **Largest remaining risk:** access/recording execution, not backend correctness.
- **Avoid:** adding features, hiding the real cloud latency, claiming legal truth or spending demo
  time on the Google Cloud console.
