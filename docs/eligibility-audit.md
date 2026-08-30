# OpenAI WebMCP Challenge — eligibility and release audit

Audited August 30, 2026 against the official
[OpenAI challenge page](https://openai.com/webmcp-challenge/),
[Devpost rules](https://webmcp.devpost.com/rules), and
[OpenAI supported countries list](https://developers.openai.com/api/docs/supported-countries).

Official deadline: **September 3, 2026 at 1:00 PM PDT**, which is
**September 3, 2026 at 22:00 CEST in Madrid**.

`PASS` means evidence is present now. `PENDING` means it cannot honestly be asserted yet. A pending
mandatory delivery item becomes a submission blocker at the deadline.

| Requirement | Status | Evidence | Action needed |
|---|---|---|---|
| Resident of a supported country | PASS | Spain appears in OpenAI's supported-country list and is not excluded by the rules | None for geography |
| Individual eligibility | PENDING ATTESTATION | The repository cannot verify age of majority, employment/affiliation exclusions or sanctions status | Entrant must attest before submission |
| WebMCP-powered human–agent app | PASS | Four real page tools plus human-only accept/reject; Phase 1 and 2 commits and tests | Preserve current scope |
| Functional project as shown | PASS PUBLIC | Clean public-browser flow completed summary, inspection, focus, proposal, ACCEPT and REJECT while preserving canonical state | Keep the deployed version stable |
| Working judge-accessible live URL | PASS | [Public synthetic-only challenge app](https://expediente-vivo-evidence-review.victorelmc94.chatgpt.site) returns the final Sites deployment | Keep public through judging |
| Compatible-browser operation | PASS PUBLIC | ChatGPT's in-app browser discovered and executed all four WebMCP tools on the public URL; Chrome 149+ path is documented | None |
| Public source repository | PASS | [Public GitHub repository](https://github.com/victorelmc94-jpg/expediente-vivo-webmcp) is anonymously accessible | Keep public through judging |
| All required source/assets/instructions | PASS PUBLIC | All 102 tracked blobs match the audited local Git tree byte-for-byte | None |
| Detectable open-source license | PASS PUBLIC | GitHub detects the root license as SPDX `MIT` | None |
| Meaningful extension of existing work | PASS | Baseline tag plus timestamped Phase 1/2 commits and `challenge-delta.md` | Link disclosure in Devpost |
| Clear prior versus new work | PASS | Exact existing components, files, commits and new behavior are documented | Do not claim the prior engine as new |
| English project description | PASS | Public README and Devpost draft are English | Paste final draft without translation gaps |
| English testing instructions | PASS | `judge-testing.md` and public README are English and contain the final URLs | None |
| Demo video under 3 minutes | PENDING BY INSTRUCTION | Script target is 2:40; no video recorded | Record and verify final duration |
| Demo clearly shows a functioning project | PENDING BY INSTRUCTION | Exact continuous WebMCP flow is scripted | Record from the final public URL |
| Demo audio explains build and WebMCP use | PENDING BY INSTRUCTION | Full English narration is scripted | Record intelligible audio |
| Publicly visible YouTube URL | PENDING BY INSTRUCTION | No video has been uploaded | Upload publicly before submission |
| No unlicensed marks/music/material in video | PASS PLAN | Script uses product UI and voice only; no music planned | Keep third-party browser chrome minimal |
| Free, unrestricted judging access through Sep 21, 5 PM PT | PASS CURRENT / PENDING UPTIME | Sites access mode is public with no login or payment | Keep final URL online and free through judging |
| Third-party software/data rights | PASS TECHNICAL / PENDING ATTESTATION | Dependencies are locked OSS; fixtures declare synthetic origin | Entrant confirms sole rights to code/assets and license compliance |
| AI/tool assistance disclosure | PASS | README and draft disclose Codex assistance; rules permit third-party technical assistance if entrant owns the result | Entrant confirms ownership |
| No sponsor/administrator financial or preferential support | PENDING ATTESTATION | Cannot be inferred from code or account state | Entrant must confirm before submission |
| No private data, credentials or harmful code | PASS PUBLIC | Strict release audit scanned 102 files, 21 PDFs and seven local commits with zero findings; the deployed dataset is synthetic | Keep the final tree unchanged |
| Submission received before deadline | PENDING BY INSTRUCTION | Devpost submission is expressly out of scope for this phase | Submit before Sep 3, 22:00 CEST |

## Invalidating conditions to keep visible

- Missing or inaccessible live URL, public repository, detectable license or public YouTube video.
- Video duration of three minutes or more, missing functional demo, or missing explanatory audio.
- Materials without English or an English translation.
- Claiming the pre-existing documentary engine as new challenge work.
- Inability to show a meaningful, working WebMCP implementation in a compatible browser.
- Unauthorized third-party IP, trademarks, music, data or code; noncompliant OSS use.
- Failure of entrant eligibility, ownership, or the no-financial/preferential-support condition.
- Restricted or paid judge access before the judging period ends.
- A late, incomplete, corrupted or unreceived Devpost submission.

The rules also say judges may rely only on the text, images and video. The recording must therefore
make the full human–agent loop understandable without assuming a judge will test the live app.
