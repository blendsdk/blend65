# Closeout: generated stock-chained NMI routes

> **Parent**: [Index](00-index.md)
> **Date**: 2026-10-06
> **Status**: Complete — 68/68 verified tasks
> **Boundary**: This bounded plan, not RD-05 or DEF-7 closeout
> **Qualification**: VICE-verified / hardware-unverified; correct unoptimized output
> **CodeOps Artifact Schema**: 1

## Delivered

Qualified stock-chained `setNMI`/`restoreNMI` now use the existing compiler's
ownership, context, SFA, machine, layout and evidence owners. Admission depends
on the complete selected route, live predecessor links and private-storage proof,
not a blanket ban on local declarations or ordinary helper calls. Source syntax,
platform APIs and profiles are unchanged. Exclusive CIA2 ownership is not added.

| Delivery                    | Verified boundary                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence                    | Generated finite stack components remain distinct from unproved external stack, source nesting and firmware completion. No-hook programs receive honest evidence without an invented source bound.                               |
| Publication and restoration | Stock-compatible matching-low entry, immutable page-safe saved links, complete live/protected readers and ordered high-byte publication through the existing owners. Placement-required adapters keep one source/debug identity. |
| Function storage and ABI    | Main/IRQ/initializer domains, nested calls and returned values close through SFA before emission. Selected helpers and scratch do not invent late storage. Ordinary calls and evaluation order are preserved.                    |
| Address proof               | Known and direct owned-place writes, complete word bytes and unsigned wrap are checked. Agreeing branches retain proof; borrowed, opaque, differing or unproved arithmetic remains conservative.                                 |
| Terminal output             | Approved callback selection, non-returning edges, empty loops and equivalent same-source terminal bodies meet their independent behavior and assembly expectations. No cross-source function merging or general optimizer.       |
| Host analysis               | Memoization excludes inactive vector history only when the complete live-reader closure proves it irrelevant. Operational word maps and physical captures remain intact.                                                         |

No runtime manager, dynamic frame, event suppression, new IR/schema, dependency,
test harness or game-policy library was introduced. Remaining general optimization
is not hidden inside platform lowering. The complete task authority is the
[execution plan](99-execution-plan.md); raw results and review lineage are in
[execution evidence](09-phase-review.md).

## Verification and independent review

Fresh `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck` and complete
local Linux `yarn test` pass. All four package test suites and the root suite run:
**4,127 PASS, two existing SKIP, zero FAIL**. The root contributes 2,283 cases;
compiler 1,755, CLI 62, language server 21 and VS Code six. Emulator cases run
sequentially. The two skips are pre-existing compiler cases, not new exceptions.

Independent correctness, SFA/ABI, semantics/DX, target-platform, emitted-code and
host-cost reviews cover the phase and its bounded fixes. Necessary SF-001–003,
SM-001 and PE-001 corrections are verified. Exact approved old-oracle exceptions
and seven newly frozen corrective oracles retain independent integrity checks.
An oracle that exposed a real compiler defect was not weakened to accommodate it.

Native qualification covers 32 four-profile scenario assertions: 116 genuine
RESTORE events, four CIA2 timer events and twelve variable-address source-flow
programs. Sixteen final public runtime rebuilds match the previously observed
source and PRG identities; the output reviewer independently checks all 128
actual artifact hashes. Additional initializer witnesses check actual first and
nested second argument values on all four profiles. These are separate cases,
not extra RESTORE events or a universal arrival/stack guarantee.

Pinned tools: ACME 0.97 r266, VICE 3.10 `x64sc`, KERNAL revision 03. Native
keyboard playback supplies RESTORE; tests do not patch CPU frames, vectors, ROM
or generated code to manufacture entry. Exact tool/ROM hashes, actual byte
accounts, RED/GREEN captures and final log hashes remain in the evidence record.
The full-AXY endpoint is selected-machine/ACME construction, not a public-source
full-AXY native runtime claim.

Frozen authority stays unchanged: Specification 4.0 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`;
expert 2.0.3 content `22cc5f00f381c82d347cf342be4fcff16bc291c6`.
No fresh expert-baseline qualification or specification amendment is claimed.

## Output costs and optimization ownership

| Endpoint                 | Actual account and retained limitation                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terminal callback repair | CPU code 849→756 bytes; SFA 9→4; RAM 931→926. Padding 11→104 absorbs the 93-byte code reduction: payload 872 and PRG 874 remain unchanged. Local 11-byte selector and 3-byte/3-cycle leaves meet the expert; whole-program win paths stay tracked in #96/#97. |
| Retained raw entry       | Nine-byte/21-cycle register-save/binary-entry prefix and distinct three-byte/five-cycle firmware-reference tail. Raw retention is not invocation; the raw ten-byte and generated bounded three-byte stack endpoints are different.                            |
| Full-AXY construction    | Body six bytes/six cycles plus wrapper 16 bytes/43 cycles = 22 bytes/49 cycles. Generated stack component seven bytes. Including the pinned stock ROM transfer gives 63 nominal CPU cycles, not a silicon/deadline proof.                                     |
| Initializer correctness  | Domain-only payload/RAM 704/758 become 722/778 after correct return retention: +18 code bytes and two private bytes. The smaller incorrect output is not an equivalent expert baseline. ZP/scratch zero and generated stack component four remain unchanged.  |

Three inherited ordinary-output findings remain **Incorrect parity**, not approved
floor waivers. RD-08 owns measured repair targets through existing optimization
seams. They must be fixed before optimized or production game-grade closeout.

| Finding         | Exact target and existing owner                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-005          | Constant-copy address store 26 B/36 cycles versus expert 5 B/6; mutable-global-plus-one 45 B/62 versus 21 B/30. Combined gap: 45 code bytes, 62 cycles, six private RAM bytes, unchanged two-byte ZP. Matching-low padding absorbs the loaded-code saving at this witness. [#70](https://github.com/blendsdk/blend65/issues/70), RD-08 local propagation/address destination.                                        |
| MC-006          | Returning finite callback 89 bytes versus expert 29; complete paths 175/186 cycles versus 126/128. Preserve callback identity, captured links, ordinary frames and continuation. The smaller page/PRG endpoint is analytical and unassembled. [#83](https://github.com/blendsdk/blend65/issues/83), RD-08 function-home/coalescing and returning-choice extension.                                                   |
| MC-007          | Initializer forwarding/copy gap: 24 code bytes, 32 cycles, two private RAM bytes. Actual payload/PRG/RAM 722/724/778; equivalent analytical expectation 698/700/752, with zero padding and unchanged ordinary calls/four-byte stack. [#70](https://github.com/blendsdk/blend65/issues/70), RD-08 immediate store/return forwarding and certified-home self-copy elimination. Keep safe materialization until proved. |
| PE-002 / PE-003 | Report-only host costs: repeated operation scans and dead address-fact map copying. RD-08 owns focused reuse of existing call targets and no-write/use-aware proof handling; no new analysis framework is approved.                                                                                                                                                                                                  |

Local meet paths are tracked, not silently accepted as the final goal:
[NMI entry/layout #96](https://github.com/blendsdk/blend65/issues/96) and
[terminal callback #97](https://github.com/blendsdk/blend65/issues/97).
Existing issue bodies were checked before reusing #70/#83; no duplicate issue,
existing-issue mutation or closure is made. All measured witnesses and equivalent
expectations are durably recorded here and in the execution evidence.

Minor size observations stay visible: `lower-c64.ts` is 703 lines versus inherited
701, `services.ts` 724 versus 706, and the existing machine lowering entry owner
715 versus 516. These near-threshold entry owners should be split by their focused
responsibilities before further growth. This closeout adds no late restructuring
or new abstraction to the independently verified code.

## Deferral-expiry check

**Did this RD's deliverables expire any deferral's stated rationale?** Yes, for
the qualified stock-chained generated route only. The blanket cooperative-NMI
admission prerequisite no longer holds for that proved route. Only its chained
expressiveness-ledger row is retired after native qualification. The exclusive
row remains deferred. This bounded plan does not close the rollout RD.

The decision registers, RD-05 Won't Have entries and frozen future-consideration
criteria were checked by reason, not date. Remaining obligations have live owners:

| Item                                                            | Reason/status after this slice                                                                                                                                                                                                           | Owner                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| DEF-7                                                           | Stock-chained compiler route delivered. Exclusive CIA2 handoff, source/read ownership, keyboard coexistence and other route obligations remain unproved. The deferral stays open with a narrower reason, not the obsolete blanket guard. | RD-05                                                           |
| Keyboard AR-P2/AR-P3                                            | A generated entry does not settle the public keyboard scan/certainty contract or combined-input ownership.                                                                                                                               | Existing RD-05 keyboard register and next bounded planning gate |
| Exclusive CIA2 ICR reads                                        | No guessed mask/prior-device snapshot, consuming read or source handoff is enabled by this slice.                                                                                                                                        | RD-05 R5.20 and exclusive ledger row                            |
| Raw/takeover routes and complete platform qualification         | Cooperative stock-entry proof does not certify raw takeover, arbitrary prior firmware, complete source nesting or all platform requirements.                                                                                             | RD-05 R5.15–R5.18 / remaining acceptance criteria               |
| Native assets, loadable assets and delivery                     | NMI work supplies no native producer/import, D64 or delivery qualification.                                                                                                                                                              | RD-06 / RD-07                                                   |
| Optimization and debug/tooling completion                       | Correct unoptimized output does not satisfy production expert parity or complete tooling qualification.                                                                                                                                  | RD-08 / RD-09                                                   |
| Windows/macOS user hosts, silicon-sensitive QA and C64U handoff | Linux compiler qualification and VICE are not release-host or physical-hardware proof.                                                                                                                                                   | RD-10; C64U's separate feature owner                            |
| T-07 specification-copy maintenance                             | Generated routes do not resolve the already-owned retained-copy/stability-description discrepancies. Frozen files remain unchanged.                                                                                                      | Existing T-07 bounded maintenance gate                          |

FUT-006/007 label/range conveniences, FUT-011 external assembly ABI, FUT-012
array-copy convenience, FUT-015 image conversion, FUT-016 stack-free calls and
FUT-017 reordering criteria remain unmet. Unknown external NMI stack is not a
measured stack overflow or evidence for abandoning ordinary `JSR`/`RTS`.
FUT-018's volatile-access rule also remains: knowing a RAM address for ownership
does not prove the profiling benefit or access semantics needed for a new qualifier.
Already resolved future entries are not reopened by this work. No deferral points
to a future slice of a closed RD; RD-05 stays Executing and DEF-7 stays open.

## Next bounded work

**Best next direction:** finish the remaining RD-05 CIA2 consuming-read/source
handoff and keyboard/coexistence contract, starting with its exact ownership
boundary. Reuse the existing decisions and platform operations; do not add a
scheduler, interrupt manager or game framework. A material public contract choice
still needs its own decision before implementation. RD-05 is not done merely
because this generated-route plan is complete.

Current feature progress stays **4/10 RDs**. Portfolio numerical synchronization
remains an integration-branch action under the existing branch policy; this
feature-branch closeout does not silently alter the integration roll-up.

The user explicitly authorized GREEN verification followed by commit and push.
All owned phase work belongs to that checkpoint. Required raw native artifacts
and logs are retained for optimization/release audit. Three unused primary-owned
temporary Git index directories were moved to Trash; unrelated `/tmp` contents
were left untouched and the removed indexes remain recoverable.
