# Judge testing instructions

## Requirements

- ChatGPT desktop with the in-app browser, or Google Chrome 149+ with WebMCP testing enabled at
  `chrome://flags/#enable-webmcp-testing`.
- No account, credentials, payment or upload is required.
- The demo uses synthetic data only.

## Live URL

<https://expediente-vivo-evidence-review.victorelmc94.chatgpt.site>

## Complete test — approximately two minutes

1. Open the live URL in the compatible browser.
2. Select **Open verified dossier**.
3. Confirm the site-tool panel says **4 evidence-review tools are ready**.
4. Ask the agent:

   > Use this site's tools to review the open dossier. First call `get_dossier_summary`. Choose a
   > real assertion that needs review, call `inspect_assertion`, then `focus_evidence`, and finally
   > create a `READY_FOR_HUMAN_REVIEW` proposal with a short evidence-grounded rationale. Stop and
   > let me accept or reject it.

5. Confirm the agent reports the real assertion ID and that an evidence dialog opens in the app.
6. Close the evidence dialog if it covers the review queue.
7. Confirm an **AGENT PROPOSAL** card says **Pending human review**.
8. Select either `ACCEPT` or `REJECT` yourself.
9. Confirm the card shows the human decision separately from the agent proposal.

## Expected tool sequence

1. `get_dossier_summary`
2. `inspect_assertion`
3. `focus_evidence`
4. `propose_review_status`

Expected fallback target if an agent asks for a specific ID:

- matter: `matter_9c601b3f7ccd6112`
- assertion: `assertion_ca8c96fc55040690`
- current canonical status: `INSUFFICIENT_EVIDENCE`
- reason: a legible attachment is mentioned but absent

## What success proves

- Tool discovery is supplied by the site, not by the prompt.
- Tool output uses structured data and real IDs from the same dossier the app renders.
- `focus_evidence` causes a real, visible page-state change.
- The proposal is created by the agent but remains pending.
- The final decision requires a human click.
- The dossier's canonical classification and provenance remain unchanged.

## Recovery

If the browser loses its WebMCP connection, reload the page once, reopen the verified dossier and
confirm the four-tool status before retrying the exact prompt. If tool selection varies, name the
four tools in the requested order. Do not use DOM automation as a substitute.
