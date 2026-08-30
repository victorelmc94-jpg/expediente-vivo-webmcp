# Judge access decision

Option A was explicitly authorized and validated on August 26, 2026. The isolated synthetic
read-only judging service is public; the evaluated live processing service remains private and
unchanged.

| | A. Temporary public synthetic demo | B. Protected access for judges |
|---|---|---|
| Judge friction | Lowest: click a URL and run the sample | Higher: account permission or a short-lived identity token is required |
| Reliability | Highest if opened in an incognito browser before submission | IAM membership is reliable; copied identity tokens expire and are fragile |
| Security | Larger attack surface while anonymous; upload API must not accept arbitrary content | Current authenticated boundary remains intact |
| Submission fit | Best discoverability; hosted URL is encouraged, although judges are not required to run it | Valid submission path, particularly because the video is the primary judged experience |
| Required work | Explicit authorization, public-exposure security gate, rate/cost guard, and a minimal demo-only restriction to the bundled synthetic dataset | Add named judge identities as Cloud Run invokers, document sign-in steps and test those identities |
| Current compatibility | **Validated:** separate `DEMO_MODE=true` service, packaged synthetic snapshot, no upload/inference/storage route, no data roles, focused advisory review complete | Compatible with the frozen private backend and least-privilege architecture |
| Failure mode | Unexpected traffic or arbitrary uploads can create cost and security risk | A judge may abandon setup or be unable to authenticate |

## Decision and retained fallback

Use **Option A for the final judging window only**. Both prerequisite gates passed:

1. the demo-only configuration rejects arbitrary uploads and exposes only the bundled synthetic
   run; and
2. the two moderate production advisories, currently propagated across 21 dependency findings,
   were reviewed for reachability, while scale remains bounded at zero-to-one instances.

The public binding is limited to `allUsers` → `roles/run.invoker` on
`expediente-vivo-judging-demo`. Option B remains the fallback if the public binding must be rolled
back. Exact publication evidence and rollback are recorded in
`docs/public-demo-prepublication-gate.md`.

Do not use copied bearer tokens as the final judge mechanism. If B is selected, named IAM
identities are more dependable. If the repository is private, separately grant the official
testing identities listed in the hackathon rules without copying them into public materials.
