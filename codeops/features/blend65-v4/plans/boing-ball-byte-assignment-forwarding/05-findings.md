# Byte assignment forwarding — execution review

> **Status**: Done — all reviews clear, actual complete checkpoint GREEN; local commit `9bbc9ead` and owned cleanup complete
> **Baseline**: `ec8a696e`; phase tree `d9fb65a8ddf111f5f1cb2e8c01179e35c6d04e8e`
> **Scope**: strict; one selector arm/caller and exact approved AR-P1/AR-P2 exceptions

Sections are chronological; final sections own current qualification. The first six reviews
cover the compiler delta. The approved NMI observer amendment has its own later reviews.

Production delta is limited to the optional selector arm and caller opt-in; the old implementation
cost pin changes1,193→1,151. New specification/implementation files are whole-file additions.
The existing local fixture is consumed but unchanged. AR-P1 grants only the exact expected
code+startup expression, preserving every bound, actual-byte extraction and raster assertion.

| Role | Independent session | Result |
| --- | --- | --- |
| Correctness / standards / oracle integrity | `ses_e1010b376ffeH057EfFItg3b3I` | No findings. Current exception matches the recorded exact user approval; schema producers support it. Hash reconstruction remains primary-owned, not independently recomputed. |
| Semantics / modern-source DX | `ses_e101060b8ffebXagnbDW6bgPrY` | No findings separately in semantic preservation and source usability. Current producer/consumer/proof interfaces inspected; prior challenge summaries excluded. This is static code review, not answer-blind behavioral validation. |
| SFA / ABI / final closure | `ses_e101003e2ffe0xQ4uVg58RhfvQ` | No findings from selection through final inventory/binding/emission. Confirmed against supplied router/SFA excerpts; reviewer corrects its hash transcription. Metadata authentication remains primary-owned; no full-router loading attestation. |
| Emitted code / equivalent costs | `ses_e100ed426ffe1ozEdgUuyRPMwW` | No findings. Independently decodes seven primary-recorded hex cores; equivalent constant/runtime idioms9B/12cy and10B/14cy. No direct raw-PRG/hash/test execution; complete accounting and709-byte residual retained. |
| Platform / MMIO / firmware | `ses_e100cdbc2ffeHN7YXKPVc0zirG` | No findings. Preserved arithmetic state, named/device operations, unchanged whole-window proof and startup/banking/delivery traced. Recorded bytes/runtime assessed without rerunning or rehashing; external/physical/timing Unknowns retained. |
| Host performance | `ses_e100bb5beffeGZHmdO5T74m334` | No findings against exact production diff and all additions. Constant added work per producer and existing O(C) set/union entries; one inherited certificate query, no new I/O/cache. No globally linear proof or measured host latency/RSS claim. |

No finding is waived or fixed on reviewer authority. Read-only reviewers run no commands;
the primary owns executed tests, exact input identities and final qualification. Directed GREEN
and review agreement never replace the actual complete checkpoint. Whole-frame timing,
unrestricted external interrupt/firmware bounds and physical behavior remain Unknown.

All six assigned lenses now return no findings. No fix, waiver or broader scope/oracle exception
is needed. AR-P1 remains the sole exact user-approved frozen-oracle edit. Source and current
frozen expectations have not changed after directed GREEN. Full checkpoint remains mandatory.

## Complete-gate diagnosis — TP-001, major

The later actual full invocation fails two unchanged NMI main-range assertions. Independent
platform session `ses_e0fae6294ffe2HBRLUg8OMS5f9` identifies a missing IRQ-exclusion premise:
enabled stock IRQ service may be the context immediately interrupted by NMI.
This is separate from the six implementation-delta reviews above and is not waived by them.

Fresh baseline/current NMI PRGs are identical. Forty-five bounded observations show correct
main-context restoration but do not capture the original firmware-interruption mechanism.
See [diagnosis](09-full-gate-diagnosis.md). TP-001 remains open under AR-P2; no NMI oracle
edit, source/IRQ change, retry or commit is approved.

Follow-up retains TP-001 and recommends an exact user-owned two-file observer amendment plus a
separately authorized deterministic overlap/negative-case witness. Native external-directory
denial blocks its direct raw-record reads; the follow-up uses the supplied summary only and
does not bypass that denial. No new finding arises; no further passive sampling is planned.
Original failure mechanism and nested-route qualification remain Unknown.

## Approved amendment reviews

| Review | Finding / ruling | Qualification |
| --- | --- | --- |
| Correctness `ses_e0f546a25ffeSWt5dZ9cLcb74l` | No static findings after exact diff-by-reference packet and complete current-file inspection | Runtime/negative results pending; no closeout clearance |
| Platform `ses_e0f546a08ffeVmvFS41DUQAXXs` | Major fixed-ROM branch transcription error (`$EA4B→$EA5E` instead of `$EA49→$EA5C`) | Same issue caught by setup and corrected by author; normal 3/3 subsequently pass; follow-up required |
| SFA/ABI `ses_e0f5469deffe6B1SML2eoTQiRu` | SF-001 major: an already-observed first IRQ PHA may still be pending when NMI saves `$FF48`; retain the same activation at capture and return | Necessary bookkeeping correction within existing exact AR-P2 approval, not a new exception or scope fork; author fixes both branches; dedicated validation and one re-review pending |

The new platform branch finding is distinct from the earlier main-premise finding despite the
reviewer's reused TP-001 identifier. Neither is waived. The author retains the original
120-second timeouts and all 20-second waits. Files after the activation fix are 663/699 lines.

Temporary controlled-wrapper boot-stop exhaustion is a qualification-adapter failure, not an
oracle counterexample. The primary now arms private timing stops after the source timer is
armed. No repository source or shared helper changes for that adapter correction.

### Fix re-review — clear

All three assigned amendment reviewers return no remaining findings after the exact repair and
directed qualification. The platform branch transcription and SF-001 are fixed, not waived.
Scope remains the same user-approved two observer files. Runtime measurements and input identity
are primary-owned; the reviewers independently inspect source and do not claim execution.

| Boundary | Executed result |
| --- | --- |
| Current normal cases |3/3 pass;10.900s |
| Current exact observer copies, real VICE controlled overlap |12/12 pass: call, dispatch, partial save, partial restore |
| Deliberate frame/link/route/inner-return/outer-return/register faults |18/18 expected rejections; every fault marker observed, no timeout or unhandled-error substitute |
| SF-001 protocol replay | Before repair: one intended failure/five controls pass; after repair:6/6 pass |
| Root strict / targeted formatting | Pass |

The common observer blocks are byte-identical. Reversing only the approved delta exactly
reconstructs both original files. Current qualified file hashes are recorded in the diagnosis.
Unobserved pre-PHA timing reachability, original failed-run frames, `$F69D` reproduction,
external aggregate guarantees and physical behavior remain Unknown. These limits do not reopen
the fixed observer-logic finding. The actual complete gate remains a separate mandatory step.

### Actual complete checkpoint — GREEN

That mandatory step completes 2026-11-19: `yarn test:full` exits0 in4,428.818s, with fresh
host5,230 and serialized VICE2,403 passes/four existing skips. All44 guarded inputs match.
Workspace results replay the prior verified cache; no new fresh-workspace claim is made.
No source or oracle changes follow review/qualification. TP-001 and SF-001 are closed as
fixed; no waived finding, new source restriction or wider IRQ/firmware/hardware claim.
