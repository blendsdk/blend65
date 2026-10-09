# Source-library prerequisite closeout

> **Date**: 2026-10-09
> **Status**: Complete — 10/10 verified; RD-05 and keyboard qualification remain open
> **Boundary**: This prerequisite, not RD-05 or keyboard qualification
> **Qualification**: VICE-verified / hardware-unverified
> **CodeOps Artifact Schema**: 1

## Delivered boundary

Source exports remain visibility declarations, not implicit execution entries. Main,
explicit initializers, ordinary address-taken dependencies and selected interrupt routes
remain roots. Existing target facts preserve assignments made by ordinary callers.
Private uninitialized, unconstrained, non-escaped globals may be omitted only when all
reached observers are proved disjoint. Unknown CPU, indexed-place or hardware observation
retains data. The same selected program reaches ownership, reservation, SFA, lowering,
layout and public evidence. No library-name special case, new API, runtime, dependency,
general optimizer or compiler stage is added.

AR-8's exact approved corrections select cheaper fixed-byte addressing independently for
each wrapped word byte and classify complete physical ZP intervals accurately. Source data
does not become function storage. Review fixes preserve indirect VIC RAM observers and
remove the global-root membership cross-product. No old specification test changed.

## Verification

Raw evidence lives in Git-private
`source-reachability-planning.X4uAlv/`, under this worktree's Git directory.

| Evidence                     | Result / exact endpoint                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original independent RED     | 324 cases: 168 intended failures / 156 preservation prepasses, before production edits                                                                                    |
| New independent hardware RED | 132 cases: 116 retention failures / 16 disjoint prepasses; runtime fails retention before VICE                                                                            |
| Final combined specs         | 456/456 in eight files, no skips; 229.89 seconds, started 2026-10-09 13:10:09 CEST                                                                                        |
| Final directed internals     | 57/57 in seven files; 3.57 seconds                                                                                                                                        |
| Four new collision witnesses | Transparent numeric-selected block, two frame waits, exact source collision-read/result-store observations, arrival at restore; not execution of the complete return path |
| Fresh full Linux checkpoint  | Install/build/typecheck/test PASS; 5,690 passes, two existing package skips; root 3,754/174 files, 1,150.32 seconds from 13:16:19 CEST                                    |
| Independent reviews          | Six initial roles; PE-001/TP-001 corrected. Six fix-only roles report no surviving finding; one re-review round, no third round                                           |

The valid scaling witness fails before the correction with 171,360 root-prefix checks
against an 11,520 ceiling. The aggregate-field preservation case prepasses. Membership
now requires one delimiter search and exact Set test per assigned fact. No wall-clock
deadline or whole-solver linearity claim is introduced. Selected machine facts are
resolved once; hardware writes inspect at most two bytes without a globals cross-product.

The new blind author confirms unchanged content after hardware RED; formatting preceded
the run. No pre-RED byte hash was captured, so historical hash binding is not claimed.
Exact authority, fixture corrections, disclosure and review limits are in
[phase review](09-phase-review.md) and [execution evidence](99-execution-plan.md).

## Actual output and costs

Fresh public builds use optimization `none`, ACME 0.97, NMOS 6510 and the selected
cooperative C64 profile. Final generations are retained beside the logs:

| Control             | Generation                             | Payload / container | Resident RAM | ZP / SFA / scratch | Reported stack component |
| ------------------- | -------------------------------------- | ------------------: | -----------: | ------------------ | -----------------------: |
| Constant-only       | `aed147be-9d8d-4374-9894-813c97c8e990` |         629 / 631 B |        678 B | 0 / 0 / 0          |                      1 B |
| Cold source library | `6db937c3-7161-47e4-81d3-de0f0156188b` |         629 / 631 B |        678 B | 0 / 0 / 0          |                      1 B |
| Fixed-word probe    | `fc31b886-faa3-44c1-bd0e-1cc367a77c0a` |         647 / 649 B |        696 B | 0 / 0 / 0          |                      1 B |

Constant and cold PRGs are byte-identical, SHA-256
`80c1fd09a7e45ae005f61c8793cb3d02f48e0dc447148872bb3557d600b10439`.
Actual assembly, labels, bytes and public reports match the corresponding original
artifacts. Their startup is 328 bytes, restore 281, BASIC stub 12 and state BSS 49.
The fixed-word probe is artifact evidence, not safe execution of arbitrary hardware writes.

Existing adjacent-restore JMP debt remains owned by
[#51](https://github.com/blendsdk/blend65/issues/51), confirmed open on 2026-10-09.
Equivalent fallthrough saves three bytes / three nominal cycles: control main 8 B/9
cycles versus expert 5 B/6; fixed-word main 26/41 versus 23/38. This is not a waiver
or a whole-program win. Entry-to-return timings and external peak stack remain Unknown.
Hardware-observer retention charges the retained RAM; it adds no executable instruction,
MMIO read/write, helper, copy or invocation-private home.

## Deferral-expiry and remaining ownership

**Did this slice's deliverables expire any deferral's stated rationale?** Yes, the
export-root/cold-data obstacle in keyboard AR-P7 expires for the proved cases. The
keyboard register must name this completed prerequisite, not retain it as unfinished.
That does not establish the whole keyboard library's zero-cold-cost contract.

Walked the prerequisite register, keyboard AR-P2/3/6/7, carried platform/IRQ/CIA/NMI
deferral records, RD-05's Won't Have boundary, requirements AR-026 and frozen future
reconsideration criteria. No new native-asset, delivery, general optimizer, incremental
compiler, external-assembly, engine or release-host obligation is activated by this
correction. In particular, disjointness proof does not relax volatile PEEK/POKE semantics
or satisfy FUT-018's separate need for changed source contracts and measured benefit.
RD-05/DEF-7 remain open; no deferral is left owned by this closed prerequisite.

| Remaining item                                                                  | Owner / next gate                                                                                                                                                                |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved rows indexed by `column & 7` still retain one cold byte                   | Keyboard technical closure; decide the smallest sound ordinal-proof scope, without claiming this literal-only prerequisite proved it                                             |
| Returning helper assigns a global callback, later caller invokes it: E10277     | RD-05 closed-program callable-proof follow-up; baseline expressiveness defect, not a language/SFA law. Protected live-ledger/spec-probe amendment needs its exact authority gate |
| Keyboard acquisition, electrical certainty, NMI coordination and complete costs | Existing R5.25/AC-20 planning owner; positive implementation gate remains closed                                                                                                 |
| Other RD-05 platform/workload deliverables                                      | Existing RD-05 owner; this prerequisite does not close the rollout                                                                                                               |
| Optimization debts / user-host and physical qualification                       | Existing RD-08 / RD-10 owners, without broader claims or waivers                                                                                                                 |

The public callback diagnostic is retained in
`keyboard-technical-closure.PHqrhM/capture-final.log`; no runtime or fix is claimed.
The saved-row diagnostic builds both controls successfully, with payload 826 B,
ZP 8 B, stack component 2 B and scratch zero. Resident RAM is 911 versus 912 B.
That one-byte difference is a separate technical-closure limit, not a failed contract
of the intentionally conservative literal-only proof.

## Authority and handoff

Expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, specification
`BLEND65-SPEC-4-038b70e9`. Frozen spec/expert bytes remain unchanged. Source, assembly,
artifact and bounded runtime endpoints stay separate. VICE 3.10 x64sc is the regression
oracle; physical silicon, native release hosts, universal timing and unrestricted
external firmware/stack guarantees remain unqualified.

No architecture-docs product is opted in; no documentation framework or unrelated
AGENTS refresh is introduced. Portfolio integration remains at its declared branch
boundary. Green checkpoints are local only; no push is authorized by this closeout.

Final documentation checks: targeted formatting, 116 local file-link targets
(anchors not checked), task helper 10/10, whitespace/frozen worktree guards and
12/12 foundation cases pass. The `/tmp` inventory still contains twelve older
Blend65 directories with unknown or retained evidence ownership; none was deleted.
This task's new diagnostics/logs live outside `/tmp`, and runtime fixtures clean
their own temporary builds. Unrelated files were not touched.
