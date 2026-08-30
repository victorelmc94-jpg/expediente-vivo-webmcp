# Demo script — 2:40 target

Language: English

Format: one browser window, voice narration, no music

Target duration: 2:40; hard maximum for the uploaded file: 2:55

## Recording setup

- Use the final public WebMCP Challenge URL in ChatGPT's in-app browser.
- Start with a fresh browser session and the app already loaded at the top.
- Keep the site-tool status, evidence dialog and proposal card readable at 1080p or above.
- Hide bookmarks, personal tabs, notifications, account details, local paths and terminal windows.
- Do not show the prior Cloud Run URL or the older hackathon video.
- Do not use copyrighted music, third-party logos as decoration or real documents.

## Exact storyboard and narration

| Time | On screen | Narration |
|---:|---|---|
| 0:00–0:13 | App title, synthetic-demo banner and **Open verified dossier**. Click once. | “Evidence review is hard because a fluent summary can merge matters or turn an allegation into a fact. Expediente Vivo keeps every claim tied to its source.” |
| 0:13–0:27 | Dossier opens. Pause on the two matters and source-trace interface; keep **4 evidence-review tools are ready** visible. | “For this challenge, I added four WebMCP site tools to the existing dossier interface. They expose its real structure and bounded review actions to an agent.” |
| 0:27–0:39 | In the agent panel, send the exact prompt below. | “I will ask the agent to inspect the open dossier, bring the evidence into view and propose—not make—the next review decision.” |
| 0:39–0:58 | Show the agent discover and call `get_dossier_summary`. Keep the returned matter and assertion IDs visible briefly. | “First, the agent reads typed dossier state. It receives real matter and assertion identifiers, counts and attention flags—not scraped text.” |
| 0:58–1:17 | Show `inspect_assertion` on `assertion_ca8c96fc55040690`; briefly highlight status, review reason and provenance fields. | “It selects an item with insufficient evidence and inspects the existing classification, review flags, document, page, exact fragment, offsets and hashes. No model is rerun and no field is invented.” |
| 1:17–1:36 | Show `focus_evidence`; move attention to the evidence dialog that visibly opened on the assertion. | “Then the site tool changes the application view itself. The exact evidence is now in front of the person, using the same structured ID the agent inspected.” |
| 1:36–1:58 | Close the dialog if needed. Show `propose_review_status` with `READY_FOR_HUMAN_REVIEW` and its rationale. | “The agent creates a reasoned review proposal. It is a separate pending object—never a silent change to the canonical dossier.” |
| 1:58–2:19 | Hold on **AGENT PROPOSAL · Pending human review**. Click `ACCEPT` yourself. Show **Accepted by human**. | “The agent must stop here. Accept and reject are deliberately not tools. I make the decision with an explicit click, and the UI records it separately as a human action.” |
| 2:19–2:33 | Return to the assertion card and evidence trace; keep the canonical `INSUFFICIENT_EVIDENCE` state visible if practical. | “Notice that acceptance does not promote the assertion or rewrite its provenance. The documentary record remains unchanged.” |
| 2:33–2:40 | Show the architecture image or return to the full review desk. | “WebMCP turns a static dossier into a safe collaboration surface: the agent reads, focuses and proposes; the human decides.” |

## Exact agent prompt

> Use this site's tools to review the open dossier. First call `get_dossier_summary`. Choose a real
> assertion that needs review, call `inspect_assertion`, then `focus_evidence`, and finally create a
> `READY_FOR_HUMAN_REVIEW` proposal with a short evidence-grounded rationale. Stop and let me accept
> or reject it.

## Must be visible

- Synthetic-data/read-only notice.
- **4 evidence-review tools are ready**.
- Each tool name at least once.
- A real `matter_id` and `assertion_id`.
- Exact evidence dialog opened by `focus_evidence`.
- **AGENT PROPOSAL · Pending human review**.
- The presenter's real click on `ACCEPT` or `REJECT`.
- A separately labeled human decision.

## Must not be visible

- Credentials, account email, private project/bucket IDs, tokens, terminal history or local paths.
- Real personal/client documents.
- The prior public deployment or prior hackathon submission.
- A claim that the existing documentary engine is new challenge work.
- Any suggestion that accepting a proposal changes legal or documentary truth.
- DevTools or a technical console unless needed for a one-second recovery check; cut it from the
  final video.

## Plan B

If a tool call stalls, stop the take. Reload once, select **Open verified dossier**, confirm the
four-tool status and restart from 0:00. If the agent chooses a different item, explicitly provide
`assertion_ca8c96fc55040690`; it is a real fixture ID, not demo-only hardcoded output. If the
evidence dialog covers the proposal, close it after the `focus_evidence` shot. If the complete flow
cannot run in a fresh compatible session, do not record around the failure; fix the deployment or
mark the candidature blocked.

