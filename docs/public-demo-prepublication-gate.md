# Public judging demo — publication validation

**Date:** August 26, 2026  
**Scope:** isolated synthetic read-only judging surface  
**Public URL:** `https://expediente-vivo-judging-demo-t652hf57ja-ew.a.run.app/`  
**Anonymous IAM:** exactly `allUsers` → `roles/run.invoker`  
**Verdict:** **DEMO PÚBLICA VALIDADA / PUBLIC DEMO VALIDATED**

## Architecture and trust boundary

```text
Judge browser
  └─ GET-only Cloud Run judging service (`DEMO_MODE=true`)
       ├─ static bilingual UI
       ├─ packaged `snapshot.json`
       └─ ten allowlisted packaged synthetic PDFs

Authenticated private Cloud Run service (unchanged)
  └─ PDFs → ADK → Gemini 3.7 Flash / Vertex AI
       → deterministic gates → private Cloud Storage
```

The judging process exits the runtime factory before importing the ADK or Cloud Storage modules.
It constructs neither an extractor nor an artifact store. A Google Cloud project ID injected by
the platform cannot override this because `DEMO_MODE=true` has priority in configuration.

The public-facing copy says **verified synthetic snapshot**, **read-only presentation**, **no live
inference** and **no cloud storage access**. The final video must use the authenticated private
service and correlate its fresh run ID to Cloud Logging and the private run report.

## Allowlisted HTTP surface

| Method and route | Result |
|---|---|
| `GET /` | Presentation UI; upload markup removed server-side |
| `GET /app.js`, `GET /styles.css` | Static client assets |
| `GET /api/health` | Safe mode flags only; no project, bucket, model or identity metadata |
| `GET /api/demo-result` | Packaged verified synthetic snapshot |
| `GET /demo/documents/<allowlisted-name>.pdf` | One of the ten packaged synthetic inputs |
| `POST /api/process`, `POST /api/process-golden` | `405 DEMO_READ_ONLY` before body parsing |
| run lookup, admin, logs, arbitrary files, unknown paths and `OPTIONS` | `404` |

There is no CORS allowance, upload input, arbitrary text input, edit action, persistence route,
model route, bucket route, admin route or log route. Security headers include a same-origin CSP,
`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'none'`, `nosniff`, no-referrer and a
restricted Permissions Policy.

## Runtime identity and resources

Deployed candidate:

- service: `expediente-vivo-judging-demo`;
- region: `europe-west1`;
- revision: `expediente-vivo-judging-demo-00001-jd6`, 100% traffic;
- runtime identity: `expediente-vivo-demo@[redacted-project-id].iam.gserviceaccount.com`;
- runtime identity roles: **none** at project or bucket level;
- environment: `DEMO_MODE=true` only;
- min instances `0`, max instances `1`, concurrency `20`, 1 vCPU, 512 MiB, 60-second timeout;
- existing Artifact Registry repository and existing minimum-privilege build identity;
- no new bucket, database, secret, Vertex permission, Storage permission or API.

Build `4bbbd5d8-750d-4d5e-8587-fe5490eff45a` completed successfully in 50 seconds. The deployed
image digest is `sha256:c23107ad75b99123fe574ee9a88ea6e7e1f38bd48e1478db06b9b440360648bd`.
The validated public URL is
`https://expediente-vivo-judging-demo-t652hf57ja-ew.a.run.app/`. Only this isolated judging
service is public; the live processing service remains authenticated and unchanged.

The reproducible private deployment command is in
`scripts/deploy-readonly-demo-private.ps1`. It fails closed if the demo runtime identity has any
project role or if the initial Cloud Run IAM contains `allUsers` or `allAuthenticatedUsers`.
Publication is a separate, explicit IAM operation recorded below.

## Local verification

| Gate | Result |
|---|---:|
| Frozen product suite | 19/19 PASS |
| Read-only route/isolation tests | 6/6 PASS |
| Mandatory Gemini stack gate for the real product | 10/10 PASS |
| Desktop browser flow | PASS |
| English/Spanish switch | PASS |
| Mobile 390 × 844 | PASS; zero horizontal overflow |
| Supported claims with complete citation fields in snapshot | 100% |
| Snapshot critical errors / unsupported cited claims | 0 / 0 |

The browser test opened the dossier, switched matters, displayed allegation and deadline safety,
and opened an evidence trace containing filename, page, exact fragment, offsets and all hashes.
All ten synthetic source PDFs are visible through exact-name allowlisted links.

## Remote Cloud Run verification

| Check | Result |
|---|---:|
| Anonymous judging-service home / health | HTTP 200 / 200 |
| Anonymous original private-service health | HTTP 403 |
| Verified snapshot | HTTP 200; 2 matters, 0 critical errors, 0 unsupported citations |
| Allowlisted packaged PDF | HTTP 200 |
| Non-allowlisted PDF / admin / logs / runs routes | HTTP 404 |
| `POST /api/process` / `POST /api/process-golden` | HTTP 405 / 405 |
| CORS allow-origin | absent |
| Judging-service IAM | exactly `allUsers` → `roles/run.invoker`; no other binding |
| Original private service | revision `expediente-vivo-private-00003-7cl`; named invoker only |
| Demo runtime project/bucket/repository roles | none |

The reusable anonymous gate in `scripts/verify-public-demo.js` returned PASS: root, health,
snapshot and the allowlisted PDF were HTTP 200; both process routes were 405; six internal or
non-allowlisted routes were 404; there were two matters, zero critical errors, zero unsupported
citations, zero upload controls and zero secret/PII scan matches. Three further anonymous
presentation traversals returned page, client asset and snapshot with HTTP 200 in 420 ms, 259 ms
and 272 ms.

The public browser pass covered desktop and a 390 × 844 mobile viewport, English and Spanish,
both matters, their timelines, amounts, states, next actions and uncertainty. It opened an
allegation's evidence and displayed document, page, exact fragment, offsets, fragment hash,
document SHA-256 and page hash. Mobile had zero horizontal overflow and no upload control.

Cloud Logging contains 71 judging-service request records: 44 HTTP 200, 20 expected HTTP 404,
six expected HTTP 405 and one pre-publication HTTP 403. Logged request latency was 11.3 ms on
average and 539.4 ms maximum; browser end-to-end timings above include network and asset loading.
Two server starts are recorded, including an autoscaling cold start, both with
`runtime_mode=demo-readonly-precomputed`, `extractor_mode=disabled` and `storage=disabled`.
There are zero `vertical_slice_completed` events, zero Vertex AI audit events and zero Cloud
Storage audit events for the demo runtime identity. This corroborates the executable isolation:
the process creates no clients and its identity has no project, bucket or repository role.

## Production dependency audit and reachability

Fresh `npm audit --omit=dev` result: **21 moderate, 0 high, 0 critical** across 237 production
dependencies. No forced fix or major dependency change was made.

The underlying advisories are:

1. `GHSA-8988-4f7v-96qf` in `@opentelemetry/core <2.8.0`: unbounded W3C baggage parsing. It is
   inherited through ADK telemetry/exporter packages. The demo process does not import ADK, does
   not initialize OpenTelemetry and does not accept or propagate baggage headers in application
   code.
2. `GHSA-w5hq-g745-h8pq` in `uuid <11.1.1`: missing bounds checks only when callers supply a
   buffer to UUID v3/v5/v6. The affected copies are below `gaxios` and `teeny-request` in the
   Cloud Storage branch. The demo process does not import Cloud Storage, performs no outbound
   Google request and never invokes any UUID API.

The 21-finding count reflects dependency propagation from the two advisories above, not 21
separately reachable defects.
Affected packages remain installed in the shared image, which is a residual supply-chain risk,
but neither vulnerable operation is reachable from the allowlisted demo routes. Dynamic imports
in `src/config.js` make this boundary executable rather than narrative only.

## Deployment issue and correction

The first build submission selected Cloud Build's default staging bucket. The restricted build
identity correctly lacked read access, so no build or service deployment occurred. The deployment
script was corrected to reuse the pre-existing EU staging bucket already authorized for that
identity. The unused failed-submit tarball was then removed by its exact object name. No permission
was broadened and no additional bucket was retained.

During the public validation, the first inline verification command contained a local PowerShell
quoting error. The fail-safe immediately removed the anonymous binding before any test proceeded.
IAM was confirmed empty, the verifier was moved into `scripts/verify-public-demo.js`, and only the
same authorized binding was restored. The reusable verifier then passed. This was a local test
harness error, not an exposed service route or security failure.

## Additional consumption and cost

- Gemini/Vertex calls: **0**;
- Cloud Storage runtime reads/writes: **0**;
- Cloud Build: one successful 50-second build; list-price ceiling about **USD 0.005** before the
  monthly build-minute allowance;
- Cloud Run: one 1-vCPU/512-MiB instance started and served only short validation requests; cost
  is below one cent and expected to fall within normal free usage;
- Artifact Registry: repository size increased from 256.079 MB to 343.460 MB and remains below
  the 0.5-GiB-month free storage tier;
- ongoing idle compute: **0**, because minimum instances is zero.

The publication step itself created no build, image, bucket or API. It added one IAM binding and
generated only the short anonymous validation traffic summarized above. Additional cost is below
USD 0.01 and expected to be effectively zero under normal Cloud Run free usage. Gemini and Cloud
Storage runtime cost for this public demo remains exactly zero by design.

Pricing references: [Cloud Build](https://cloud.google.com/build/pricing),
[Cloud Run](https://cloud.google.com/run/pricing) and
[Artifact Registry](https://cloud.google.com/artifact-registry/pricing).

## Exact IAM change and rollback

Executed after explicit authorization:

```powershell
$projectId = '<verified-project-id>'
$region = 'europe-west1'
$service = 'expediente-vivo-judging-demo'
& gcloud run services add-iam-policy-binding $service `
  --project $projectId --region $region `
  --member 'allUsers' --role 'roles/run.invoker'
```

Immediate rollback:

```powershell
& gcloud run services remove-iam-policy-binding $service `
  --project $projectId --region $region `
  --member 'allUsers' --role 'roles/run.invoker'
```

Full cleanup after judging:

```powershell
& gcloud run services delete $service --project $projectId --region $region
& gcloud iam service-accounts delete "expediente-vivo-demo@$projectId.iam.gserviceaccount.com" `
  --project $projectId
```

The rollback command has been checked against the exact project, region, service, member and role.
It was exercised successfully by the fail-safe before the final clean publication, then the
authorized binding was reapplied and revalidated. Full cleanup remains a separate human-controlled
action. The repository, video and Devpost submission remain unpublished.
