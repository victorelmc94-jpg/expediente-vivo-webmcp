# Devpost submission draft — OpenAI WebMCP Challenge

Status: draft only; do not submit until every placeholder and entrant attestation is resolved.

## Project name

**Expediente Vivo — Evidence Review Desk**

## Tagline

**The agent reads and proposes; the human sees the evidence and decides.**

## Links

- Live app: <https://expediente-vivo-evidence-review.victorelmc94.chatgpt.site>
- Public source repository: <https://github.com/victorelmc94-jpg/expediente-vivo-webmcp>
- Public YouTube demo: pending — not uploaded by instruction

## Inspiration

Evidence-heavy work rarely starts with a clean record. Contracts, claims, orders, duplicates and
missing attachments arrive mixed together. Even when software reconstructs that folder, review is
still laborious: a person has to find an uncertain assertion, inspect its source and decide what
deserves attention.

A normal chatbot can summarize the page, but it does not know the application's canonical IDs,
evidence types or safety boundaries. DOM automation can click what happens to be visible, but it is
brittle and has no principled distinction between an allegation, a supported fact and a pending
proposal. We wanted the web app itself to define that collaboration contract.

## What it does

Expediente Vivo opens a verified synthetic dossier containing two matters and fully traceable
assertions. A WebMCP-capable agent discovers four site tools. It can:

1. read a structured dossier summary and real attention-item IDs;
2. inspect one assertion's existing classification, uncertainty and exact provenance;
3. focus the corresponding evidence visibly in the web interface; and
4. create a reasoned review-status proposal.

That proposal appears as **AGENT PROPOSAL · Pending human review**. The person must explicitly
accept or reject it. The human decision is displayed separately, and neither action rewrites the
canonical assertion or promotes an allegation into a fact.

## How we built it

The browser app registers four tools through WebMCP's `document.modelContext.registerTool`
capability. Tool adapters derive their output from the same in-memory dossier rendered by the
interface:

- `get_dossier_summary`
- `inspect_assertion`
- `focus_evidence`
- `propose_review_status`

The first two are structured reads. `focus_evidence` performs a bounded, visible page-state change.
The proposal tool writes only to a separate tab-local review queue. `ACCEPT` and `REJECT` remain
ordinary human UI controls and are intentionally not exposed as agent tools.

The public challenge deployment packages only a verified synthetic dossier and allowlisted
synthetic PDFs. It has no uploads, authentication, database, live model call, private storage or
external action. The repository includes automated tests for tool discovery contracts, invalid
IDs, provenance integrity, non-promotion of allegations, proposal separation and explicit human
decision.

## Why WebMCP

WebMCP is not decorative here. The agent needs a stable application-defined vocabulary for
`matter_id`, `assertion_id`, evidence status and provenance, plus a safe action that changes what
the person sees. A traditional backend API could expose data but would not by itself connect the
agent to the live browser state or bring the selected evidence into the shared interface. A
chatbot or DOM scraper would have to infer meaning from presentation and would be fragile when the
UI changes.

With WebMCP, the site declares exactly what the agent may read and do. The result is a visible
handoff: structured inspection → exact evidence → bounded proposal → human decision.

## Challenges we ran into

The hardest design question was not tool registration; it was deciding what must never become a
tool. Exposing accept/reject would make the demo look more autonomous while weakening its trust
model. We instead treated the proposal as a separate object and enforced human decision in both
the interface and tests.

The second challenge was making tool output useful without duplicating or inventing data. Every
field returned by `inspect_assertion` comes from the existing dossier, including document/page
references, exact fragments, offsets and hashes. Invalid IDs fail cleanly.

Finally, the public demo needed to be stable and safe. We separated it from the existing private
document-processing runtime and limited it to a checked-in synthetic snapshot.

## Accomplishments that we are proud of

- Four discoverable, non-trivial WebMCP tools that operate on real application state.
- A tool-triggered visible evidence focus, not just JSON returned to the agent.
- A complete human–agent loop in which autonomy stops at a deliberate boundary.
- Canonical assertion and provenance hashes remain unchanged through propose, accept and reject.
- A reproducible synthetic demo with no credentials or private data.
- Clear timestamped separation between the existing product and challenge work.

## What we learned

The best site tools are not a second API pasted onto a page. They expose the domain semantics and
bounded actions the interface already understands. WebMCP is most valuable when the person and
agent share state visibly: the agent can navigate to the evidence it used, and the person can
verify the handoff before deciding.

We also learned that “human in the loop” must be an enforced capability boundary, not a sentence
in the description. If a tool can finalize the decision, the product has not actually preserved
human control.

## What's next

After the challenge, a production version could persist proposal history, add authenticated
reviewer identities and support organization-specific review policies. Those features are
deliberately excluded from this submission. The challenge slice focuses on one reliable,
inspectable collaboration loop.

## Prior work and challenge delta

Expediente Vivo's documentary engine, dossier schema, provenance rules, synthetic fixtures and
original case interface existed before the WebMCP extension. The tagged commit
`pre-webmcp-baseline` records that imported state. The challenge work is limited to the four
WebMCP tools, visible focus and observability, separate proposal state, human decision UI, safety
tests, release documentation and deployment packaging. Exact commits and files are listed in
`docs/challenge-delta.md`.

OpenAI Codex assisted implementation, testing and documentation. The entrant remains responsible
for the ideas, source, rights and submission. Third-party runtime packages are declared and locked
in the repository and retain their own licenses.

## Testing instructions

Open <https://expediente-vivo-evidence-review.victorelmc94.chatgpt.site> in ChatGPT's in-app browser
or Chrome 149+ with WebMCP testing enabled.
Select **Open verified dossier** and send:

> Use this site's tools to review the open dossier. First call `get_dossier_summary`. Choose a real
> assertion that needs review, call `inspect_assertion`, then `focus_evidence`, and finally create a
> `READY_FOR_HUMAN_REVIEW` proposal with a short evidence-grounded rationale. Stop and let me accept
> or reject it.

Confirm all four tools run, the evidence dialog opens, the pending proposal appears, and a human
click changes only the proposal's decision state. Full instructions and a fallback fixture ID are
in `docs/judge-testing.md`.

## Limitations and disclaimer

This hackathon MVP uses synthetic data only. It has no OCR, multi-user persistence, uploads,
external actions or automated legal decisions. Review state is tab-local. A compatible WebMCP
browser is required.

Expediente Vivo reconstructs supplied evidence. It does not provide legal advice or decide legal
truth.
