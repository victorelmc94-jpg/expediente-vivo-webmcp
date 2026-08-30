# Submission readiness checklist

Updated August 26, 2026 after controlled publication validation. `PASS` means the artifact or
evidence exists now. `PENDING` marks a deliberately withheld step that still requires human
authorization.

## Product and demo

- [x] **PASS** — English-first UI understandable without a technical explanation.
- [x] **PASS** — Input, high-level agent work and verified result form one coherent flow.
- [x] **PASS** — Two matters, state, timeline, amount roles, next action and uncertainty are visible.
- [x] **PASS** — Evidence opens to document, page, exact fragment, offsets and hashes.
- [x] **PASS** — FACT, PARTY ALLEGATION, INFERENCE, UNRESOLVED, PROPOSED ACTION and HUMAN REVIEW
  have distinct visual treatment.
- [x] **PASS** — Core live run plus cloud proof fits the 3:15 storyboard, below four minutes.
- [x] **PASS** — Gemini stack gate documents code instantiation, structured input/output, ADK
  orchestration, deterministic post-validation and correlated cloud token usage.
- [x] **PASS** — Storyboard distinguishes the real authenticated Gemini/Vertex run from any public
  read-only or precomputed synthetic view.
- [ ] **PENDING HUMAN ACTION** — Record the final take, review it and upload it publicly.

## Reproducibility and evidence

- [x] **PASS** — `package.json` and lockfile pin the runtime dependencies.
- [x] **PASS** — README contains local spin-up, private deployment and configuration instructions.
- [x] **PASS** — Architecture is documented in README, SVG, PNG and `docs/architecture.md`.
- [x] **PASS** — Both datasets are synthetic; the independent ground truth predates model output.
- [x] **PASS** — Local, direct Vertex, private Cloud Run and independent robustness results are
  documented.
- [x] **PASS** — Cloud Run logs/revisions can prove the real Google Cloud backend during recording.
- [x] **PASS** — Backend remains frozen; presentation work changed only UI and documentation.

## Safety, privacy and disclosure

- [x] **PASS** — Zero known critical product errors; supported assertions retain complete
  provenance in the evaluated runs.
- [x] **PASS** — Fresh `npm audit --omit=dev`: 21 moderate, 0 high, 0 critical; rerun
  immediately before release.
- [x] **PASS** — No real personal data is required or present in the documented demo.
- [x] **PASS** — Security boundaries, input limits, lifecycle and limitations are documented.
- [x] **PASS** — Project start date, third-party libraries, tooling and Codex assistance are
  disclosed.
- [x] **PASS** — No legal-advice or legal-truth claim appears in the product copy.
- [x] **PASS** — Credential and secret scan is part of the final automated dry run.

## Submission operations

- [x] **PASS** — Competitive Devpost text is drafted in English.
- [x] **PASS** — Official Taskmaster story and non-chatbot autonomy are explicit.
- [x] **PASS** — Temporary synthetic judging access selected; isolated service has no data roles.
- [x] **PASS** — The single authorized `allUsers` → `roles/run.invoker` binding is active only on
  `expediente-vivo-judging-demo`; anonymous desktop/mobile and EN/ES validation passed.
- [x] **PASS** — Hosted demo URL inserted and tested anonymously in the internal Devpost draft.
- [ ] **PENDING HUMAN ACTION** — Create/share the repository and verify its permissions.
- [ ] **PENDING HUMAN ACTION** — Insert and test repository and video URLs.
- [ ] **PENDING HUMAN ACTION** — Submit the Devpost form before August 31, 2026 at 5:00 PM PDT.

## Final pre-submit rehearsal

1. Fresh-install the repository with `npm ci`, run tests and start locally.
2. Run the selected judge-access path from an incognito browser.
3. Run the golden folder once on Cloud Run and match the UI run ID to the captured log.
4. Confirm the video is public, plays without login and is below four minutes.
5. Open every Devpost link and the architecture image from a logged-out browser.
6. Rerun production dependency audit and secret/PII scans.
7. Read every claim once for accuracy; keep synthetic-data and no-legal-advice limits visible.

## Dry-run verdict

**DEMO PÚBLICA VALIDADA; SUBMISSION AÚN NO AUTORIZADA.**

The isolated judging service is publicly readable at the authorized URL and passed its anonymous
route, browser, IAM, logging and isolation gates. The original processing service still rejects
anonymous requests. Final recording, repository sharing and Devpost submission remain separate
human-controlled actions.
