# Judge architecture — WebMCP evidence review

![Expediente Vivo WebMCP architecture](assets/webmcp-architecture.svg)

## One visible human–agent loop

```text
Human reviewer
  │ asks for evidence review                     ▲ ACCEPT / REJECT
  ▼                                               │ explicit click only
ChatGPT / WebMCP-compatible agent                 │
  │ discovers and invokes                        │
  ▼                                               │
WebMCP site tools ───────────────────────► Expediente Vivo UI
  │ read          │ focus       │ propose          │
  ▼               ▼             ▼                  │
Packaged synthetic dossier   Evidence dialog   Pending proposal queue
          └──────────── canonical record remains unchanged ──────────┘
```

## Responsibilities

| Boundary | Can do | Cannot do |
|---|---|---|
| Human | Ask for review; accept or reject a pending proposal | Change provenance through the review card |
| Agent | Read structured state; inspect; focus; propose with rationale | Accept/reject; promote an allegation; alter canonical evidence |
| Site tools | Expose domain IDs and typed data; perform bounded page actions | Rerun Gemini; invent fields; call external systems |
| Browser UI | Render the dossier, exact evidence and separate decision state | Persist multi-user state or issue legal decisions |
| Synthetic dossier | Supply the exact data already rendered by the app | Contain real client or personal data |

## The four tools

- `get_dossier_summary` reads the open run, matter state, counts and real attention-item IDs.
- `inspect_assertion` returns existing classification, state, review flags and complete provenance.
- `focus_evidence` selects the containing matter and opens the source-evidence dialog.
- `propose_review_status` creates a new tab-local object with `actor=agent`, timestamp and
  `proposal_status=pending`.

The user-facing `ACCEPT` and `REJECT` controls call the human decision function directly from a
click handler. They are not registered as agent tools.

## Canonical-data boundary

The dossier snapshot is loaded once and rendered by the existing interface. Tool results are
derived from that same in-memory object. Agent proposals live in a separate `Map` keyed by
`proposal_id`; a human decision replaces only the proposal object. Tests hash the canonical
assertion before and after proposal and decision operations to prove it is unchanged.

There is no proposal backend, database or invented review service. Reloading the page clears the
review queue by design for this minimal challenge slice.

## Existing engine versus public challenge runtime

The repository includes the pre-existing Expediente Vivo document engine: page-preserving PDF
ingestion, model-assisted extraction, deterministic provenance gates, matter reconstruction and
private artifact storage. The public WebMCP challenge deployment uses only its verified synthetic
snapshot and allowlisted synthetic PDFs. In that mode there is no upload endpoint, live model call,
private storage access, authentication flow or administrative route.

This separation keeps the public demo stable and judge-accessible without claiming a backend that
the WebMCP slice does not use.
