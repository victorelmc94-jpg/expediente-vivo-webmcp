# Demo script — 3:14 visually rehearsed target

The narration is in English because the official submission materials must support English. The
recommended cut is approximately 3 minutes 14 seconds and remains below the four-minute limit.

## Recording plan

Record five clean clips at 1440p or 1080p:

1. **Real product run:** the authenticated Cloud Run UI already open through localhost, with the
   line `ExpedienteAgent · gemini-3.7-flash · vertex-adk · gcs-private-temporary`. Record from the
   click on **Ejecutar dataset dorado** until the PASS banner and dossier appear. Keep this operation
   continuous and unedited; display a small elapsed-time counter and retain the resulting run ID.
2. **Result exploration:** vertical scroll through the first matter, allegation, correctly targeted
   deadline and its evidence card.
3. **Safety exploration:** missing evidence / human-review alert and the second matter's claimed
   versus recognized amounts.
4. **Correlated Gemini cloud proof:** Cloud Logging filtered to the same run ID, then that run's
   private GCS `run_report.json`. Show `extractor_mode=vertex-adk`,
   `model=gemini-3.7-flash`, the successful ADK extraction stage and non-zero input/output token
   usage. Crop project IDs, account details, bucket names and bearer tokens. Do not turn this into
   a console tour.
5. **Architecture:** the supplied architecture diagram, full screen.

Use hard cuts only between these clips. Do not cut or speed-ramp the product execution itself.
Capture a fresh Cloud Run log whose run ID can also be seen in the product result.

The public read-only synthetic URL is not the proof run. Do not record a precomputed dossier and
describe it as live. The opening take must call the authenticated Cloud Run → ADK → Gemini/Vertex
pipeline and produce a new run ID.

Before recording, open the judging URL once only to verify its banner says **verified synthetic
snapshot** and **no live inference**. Then close it. Record the authenticated private service for
the whole pipeline sequence below; never splice the public snapshot into the live progress stage.

## Storyboard and exact narration

| Time | Screen | Narration / overlay |
|---:|---|---|
| 0:00–0:10 | Authenticated private UI already open. Keep the runtime line visible and immediately click **Ejecutar dataset dorado**. | **Narration:** “This folder mixes contracts, claims, court documents, a duplicate and an unreadable page. This is a live Cloud Run execution.” **Overlay:** `LIVE · Cloud Run · synthetic PDFs` |
| 0:10–0:40 | One continuous take. Keep the real progress line visible until the PASS banner and a fresh full run ID appear. | “Google ADK sends page-preserving packets to Gemini 3.7 Flash on Vertex AI. Gemini proposes typed analyses and assertions; deterministic rules then validate every source, role, deadline and matter boundary.” **Overlay:** `Gemini interprets · deterministic rules verify` |
| 0:40–0:57 | Pause on PASS, full run ID and the five metrics: two matters, nine canonical PDFs, one duplicate, zero critical errors and zero invalid citations. | “In one run, ten PDFs become two separate matters. The duplicate is removed, every supported claim is cited, and no critical error survives.” |
| 0:57–1:21 | First matter: show OPEN, timeline, amount ledger and the `MONITOR_NEW_NOTICE` safe next step. | “The first matter remains open. Its timeline, amounts and next safe step are reconstructed without flattening different kinds of evidence into one summary.” |
| 1:21–1:43 | Scroll to the €565.20 `PARTY_ALLEGATION` evidence card. | “This 565-euro claim stays a party allegation. It is not silently promoted into a recognized debt.” **Overlay:** `Allegation ≠ fact` |
| 1:43–2:02 | Continue to the directive naming `ADELANTO NORTE SL` and the event stating that the remedy period is addressed to the claimant. | “And this deadline is addressed to the other party, Adelanto Norte—not to the subject. The target survives the complete data flow.” |
| 2:02–2:25 | Hold on one evidence card. Highlight document identifier, page, exact fragment, character offsets and hash. | “Every supported claim is inspectable through its document identifier, page, exact fragment, offsets and cryptographic hash. Without that trace it cannot become supported.” **Overlay:** `Document → page → fragment → hash` |
| 2:25–2:42 | Show the missing-attachment text, safe next action, then scroll to JVB-118/2023 and show €470 claimed versus €233 recognized. | “When evidence is missing, the agent requests review instead of inventing it. In the second matter, the claimed amount remains distinct from the amount recognized.” |
| 2:42–2:50 | Cloud Logging filtered to the new run ID. Show `vertical_slice_completed`, `extractor_mode=vertex-adk` and private GCS mode. | “This Cloud Run log is the same run you just saw—not a precomputed result.” **Overlay:** `Same run ID` |
| 2:50–3:02 | Open the same run's private GCS `run_report.json`. Highlight `model=gemini-3.7-flash`, `expediente_agent_extracts_candidates: PASS` and non-zero prompt/candidate token counts. | “Its persisted report proves the ADK stage called Gemini 3.7 Flash on Vertex AI and received a real model response before validation.” **Overlay:** `ADK model event · real token usage` |
| 3:02–3:14 | Architecture diagram, then return to the product result. | “Gemini interprets and proposes. Deterministic gates decide what is safe to present. Together they turn mixed PDFs into a dossier you can verify.” **Final overlay:** `Gemini proposes · rules validate` |

## Editing notes

- No logo animation or title card before the first click.
- Keep zoom at a readable level; avoid showing the browser address bar where it adds no evidence.
- Use no more than the six overlays above. They support the story without duplicating the UI.
- Keep the pointer still while the viewer reads an evidence fragment.
- Use the synthetic golden folder only. Never show personal documents, local credentials, project
  IDs, terminal history or authentication tokens.
- If the live cloud run takes longer than 45 seconds, keep the take continuous and shorten result
  narration. Do not hide the real latency with a fake progress sequence.
- Before recording, verify the run ID and selected evidence filename match the Cloud log clip.
- Also verify the GCS run report uses that exact run ID and contains non-zero
  `model_events[].usage_metadata`; a model name shown only in configuration is not sufficient.
- Vertex AI request metrics may lag. If available, add a one-second supporting insert, but keep the
  same-run Cloud Logging + GCS run-report correlation as the primary proof.

## One-line opening and close

**Opening:** “This messy folder contains two different cases. Watch Expediente Vivo reconstruct it.”

**Close:** “From mixed PDFs to a living case file—every supported claim traced to its source.”
