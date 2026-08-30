# Final video rehearsal and privacy gate

**Date:** August 26, 2026  
**Scope:** one fresh authenticated private run plus public-material privacy review  
**Visual rehearsal run:** `09c7780c-b006-429b-a9a7-5d614926f801`  
**Current verdict:** **READY TO RECORD VIDEO**

## Fresh private execution

The synthetic golden dataset was submitted from the private browser UI through the authorized
official localhost proxy. Cloud Logging records 26.759 seconds of backend work; the first browser
checkpoint after completion showed the full dossier at 39.2 seconds, including polling and
browser-control overhead. No real document was used.

| Gate | Result |
|---|---:|
| Cloud Run response | PASS |
| `ExpedienteAgent` / Google ADK | PASS |
| Gemini 3.7 Flash through Vertex AI | PASS |
| Non-zero model usage | 2,949 prompt + 5,161 candidate = 8,110 total tokens |
| All seven report stages | PASS |
| Supported assertions without valid citation | 0 |
| Critical errors | 0 |
| Private persisted objects | 10 PDFs + `dossier.json` + `run_report.json` |

The private `run_report.json` records `status=COMPLETED`, `model=gemini-3.7-flash`,
`extractor_mode=vertex-adk`, `artifact_store=gcs-private-temporary` and all seven pipeline stages
as PASS. Cloud Logging has one matching `vertical_slice_completed` event on revision
`expediente-vivo-private-00003-7cl` with the same run ID, extractor mode, artifact mode and a
26.759-second backend duration.

The storage bucket is in the EU, uses uniform bucket-level access, enforces public-access
prevention, has no public IAM member and deletes temporary objects after one day. The redacted
proof excerpt is `docs/evidence/final-video-run-proof.json`.

## Privacy gate

The repository candidate, ignored evidence artifacts and every media fixture were checked before
preparing recording screens.

- Git history: zero commits; therefore no prior committed secret or personal-data history.
- Public candidate: zero personal-email, DNI/NIE, phone, local-user-path, credential, bearer-token,
  cookie, private-key or real-project-ID match after redaction.
- PDFs: 21 generated fixtures, 28 pages; zero personal email, DNI/NIE, phone, local path,
  credential or participant marker. Both manifests declare `synthetic=true`; generator source and
  PDF metadata identify them as synthetic fixtures.
- Image assets: one architecture PNG plus its SVG source; visually inspected, with no account,
  project, bucket, path or personal identifier.
- Ignored JSON evidence: 69 files checked. One historical named-invoker personal email and the
  corresponding cloud identifiers were found in `artifacts/cloud-run-private-evidence.json` and
  replaced with explicit redaction markers. A DNI/NIE regex hit was confirmed as a UUID prefix,
  not identity data.
- Public page: anonymous scan reports zero secret/PII matches and explicitly labels all data as a
  verified synthetic snapshot.

Raw private run reports necessarily contain bucket/object URIs. They remain Git-ignored and must
not be shown uncropped. The safe proof excerpt contains only the fields approved for the video.

## Exact recording screens

### A. Live interface

Use the authenticated private service only through `127.0.0.1:8081`. Hide the browser address bar.
Frame the line `ExpedienteAgent · gemini-3.7-flash · vertex-adk · gcs-private-temporary` and the
**Ejecutar dataset dorado** button. Start the take immediately before the click. Keep the visible
progress line continuous until the result appears. The PASS banner then shows all seven stages and
the complete new run ID.

### B. Result

Frame the five summary metrics and scroll vertically through the two matter cards. Show:

1. `MON-042/2026`: OPEN, €130 principal, €183 maturity amount and the safe next step;
2. the €565.20 orange `PARTY ALLEGATION` card;
3. deadline target `ADELANTO NORTE SL`, explicitly not the subject;
4. an allegation evidence card with document identifier, page, exact fragment, offsets and hash;
5. human-review uncertainty, then `JVB-118/2023` with €470 claimed versus €233 recognized.

These identifiers, names and amounts are generated synthetic fixture data.

### C. Cloud Logging

Filter on the fresh full run ID and the private service. Show only the single structured
application event payload. Crop the console header, project selector, account avatar, URL and
resource-label expansion. Keep visible only:

```text
event=vertical_slice_completed
run_id=<fresh-live-run-id>
status=COMPLETED
extractor_mode=vertex-adk
artifact_store=gcs-private-temporary
```

### D. Private `run_report.json`

Open the same run's private object but crop the bucket/object chrome and all unrelated fields.
Keep visible only:

```text
run_id=<fresh-live-run-id>
status=COMPLETED
model=gemini-3.7-flash
extractor_mode=vertex-adk
usage_metadata.promptTokenCount=<non-zero>
usage_metadata.candidatesTokenCount=<non-zero>
expediente_agent_extracts_candidates=PASS
deterministic_provenance_gate=PASS
```

Do not display an identity token, account email, project ID, bucket name, GCS URI or full Cloud
Console URL.

### E. Architecture

Show `docs/assets/architecture.png` full screen. The critical visual path is:

```text
ExpedienteAgent / Google ADK → Gemini 3.7 Flash / Vertex AI
→ deterministic safety gates → verified dossier → private temporary Cloud Storage
```

## Timed storyboard rehearsal

The live-run segment reserves 30 seconds against the measured 26.759-second backend duration. A
cold-start contingency can extend it to 40 seconds while remaining below the hard four-minute
cap. The rehearsed narration budget is 3:14.

| Time | Duration | Screen and purpose |
|---:|---:|---|
| 0:00–0:10 | 10 s | Private UI, runtime line and immediate synthetic-run click |
| 0:10–0:40 | 30 s | Continuous real ADK/Gemini execution and visible progress |
| 0:40–0:57 | 17 s | PASS banner, full run ID, two matters and zero critical errors |
| 0:57–1:21 | 24 s | First matter: state, timeline, amounts and next step |
| 1:21–1:43 | 22 s | Scroll to the party allegation and its cited fragment |
| 1:43–2:02 | 19 s | Deadline text remains addressed to the counterparty |
| 2:02–2:25 | 23 s | Document ID, page, exact fragment, offsets and hash |
| 2:25–2:42 | 17 s | Missing evidence, second matter, claimed versus recognized |
| 2:42–2:50 | 8 s | Same-run Cloud Logging proof |
| 2:50–3:02 | 12 s | Same-run private report and non-zero tokens |
| 3:02–3:14 | 12 s | Architecture and closing line |

The public judging page is checked before recording and then closed. Its banner says read-only,
precomputed, no live inference and no Cloud Storage access. It never appears during the live
progress sequence.

## Access and teardown gate

The official Cloud Run proxy was installed into the already-authorized local Google Cloud CLI and
bound only to `127.0.0.1:8081`. The browser never displayed the private Cloud Run URL. After the
visual run, the browser tab was closed and the exact `cloud-run-proxy` PID attached to that listener
was terminated. Final verification found zero listeners on port 8081 and zero proxy processes.
The identity token existed only inside the proxy process, zero token patterns exist in the repo,
private IAM remains one named `roles/run.invoker` binding with no public member, and an external
anonymous request still returns HTTP 403.

The visual rehearsal run ID above proves readiness, but the final continuous live take must generate a
fresh ID. Replace the logging filter and report crop atomically with that new ID; reusing the
rehearsal ID while claiming a fresh run would be misleading.
