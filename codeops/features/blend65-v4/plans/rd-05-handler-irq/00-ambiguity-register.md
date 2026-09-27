# Ambiguity Register: RD-05 Handler-Side IRQ Updates

> **Status**: ❌ GATE BLOCKED — technical discovery and test-authority ruling pending
> **Last Updated**: 2026-09-27 22:23
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The bounded RD-05 R5.16 handler-side IRQ slice carried by RD-04 AR-P17 / DEF-8: temporarily install another handler and safely restore the previous handler, with the relevant R5.15, R5.17 and R5.18 safety obligations. |
| Context artifacts | Frozen Specification 4 and expert 2.0.0; RD-05 requirements; completed Stage A and its NMI deferral; current interrupt ownership, context, SFA, lowering and tests; the RD-04 expressiveness ledger. Reading these does not authorize changing them. |
| Modification set | This new plan directory and the active feature roadmap only. No compiler/test implementation, requirement change, frozen-specification change, expert-baseline change, portfolio change or push. Any proposed edit to an existing specification test requires a separate exact ruling before it enters executable work. |

## Decisions

| ID | Category | Decision or question | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / effort | Plan this bounded IRQ slice at the previously confirmed Xhigh effort. Reuse existing compiler analysis and static storage; add no runtime manager, scheduler or language feature. This does not close RD-05. | User: “proceed” after the explicit handler-side IRQ scope confirmation. | ✅ Resolved |
| AR-P2 | Technical / concurrency (sensitive) | Close the distinction between the active vector stack, the handler currently executing/chaining, and simultaneously live invocation storage. Select the smallest direct extension that supports the confirmed source forms without overwriting live links, inventing an IRQ recursion bound or preventing later optimization. | Discovery in progress; project workflow directive 4 owns technical selection after grounding and independent challenge. | ❌ Open |
| AR-P3 | Test authority | Apply only the exact ledger-oracle correction below during later implementation. Preserve the invalid source and every unrelated expectation. | Recommended correction presented to the user; explicit ruling pending. | ❌ Open |
| AR-P4 | Carried NMI scope | Positive finite NMI-source/reentry and safe install/restore proof remains with RD-05 planning. Revisit before NMI-dependent executable work or complete RD-05 plan readiness. No NMI, takeover or banking implementation enters this slice. | Existing Stage A AR-P3 and user's confirmation of this IRQ-only planning scope. | ⏸ Deferred — named NMI contract; RD-05 planning owner; revisit before dependent work or full-plan readiness |
| AR-P5 | Verification / workflow | Use existing specification-first tests, public build service, direct storage/machine tests and sequential VICE 3.10. Keep behavior and assembly/cost expectations independent. Retain the established install/build/typecheck/test checkpoint and temporary root `--testTimeout 30000` allowance; no permanent timeout edit. Commit coherent green checkpoints without asking; never push automatically. | User-provided AGENTS.md and established verification ruling. | ✅ Resolved |

## Initial Grounding

Status: **Verified partial**. Claim kind: **Fact** for the code inventory below; the replacement
design is not yet settled and no new runtime result is claimed.

| Evidence | Consequence for this slice |
|---|---|
| `packages/compiler/src/semantic/interrupt-ownership.ts:237` | A blanket guard rejects handler-reachable IRQ installs/restores before the existing ownership proof. Deleting that guard alone is unsafe. |
| `packages/compiler/src/semantic/interrupt-contexts.ts:37` | Context propagation currently follows installation depth and source calls, not every live chain and IRQ-mask boundary. |
| `packages/compiler/src/storage/inventory.ts:407` and `packages/compiler/src/machine/lower-platform.ts:91` | Saved predecessor words are addressed by sink/depth, with capacity derived primarily from mainline ownership. |
| `packages/compiler/src/storage/irq-stack.ts:142` | An existing compile-time walk already distinguishes source masks, installed handler chains, source saves, calls and instruction-recognition boundaries. Reuse its proven behavior rather than adding another runtime mechanism. |
| `packages/compiler/src/semantic/interrupt-domains.ts:10` and `packages/compiler/src/storage/interference.ts:130` | Invocation homes currently distinguish mainline/IRQ/NMI, not two simultaneously live IRQ activations. A finite nested IRQ case must not alias their private homes. |
| `test/rd04/expressiveness-ledger.spec.test.ts:105` | One restriction probe groups two balanced installs with a handler-only restore followed by another mainline restore. Marking every probe successful would discard a real ownership check. |

## AR-P2 — Smallest Design Direction, Not Yet a Complete Plan

**Recommended direction:** extend the existing ownership/context, SFA and specialization records.
Distinguish an installed predecessor, the chain member executing now, and any simultaneously live
IRQ invocation. Keep the existing mask/recognition semantics shared with stack analysis. No new
general graph engine, runtime flag, dispatcher, manager, dependency or broad IR replacement is
proposed. Private homes may still share storage when overlap is disproved; globals stay shared.

One fixed link per source location is insufficient: the same helper can install a handler in two
different live invocations. Conversely, blindly following every installation as a new activation
can grow forever when mutually installing handlers remain masked. Repeated handler identity alone
is not a rejection rule: [Chapter 6 §7.8](../../../../../spec/06-functions.md#78-install-and-restore-ownership)
expressly permits finite balanced repeated installation.

Refine this direction by separating stable installation predecessors from invocation-owned
temporary links. A running handler's balanced temporary installs use its own local ownership
depth, not the total depth of the currently installed vector stack; helpers inherit that context.
For example, B can chain into previously installed A while B remains the active vector. A's
temporary installer saves/restores that actual B vector, while A's own eventual chain retains A's
original predecessor. This avoids reinterpreting an old entry using a later installation depth.

The independent challenger converged on these distinctions and rejected a simple site-slot fix
as insufficient. Its review used the supplied code/specification packet, not a separate repository
inspection. It did **not** certify a complete algorithm. Four bounded design obligations remain:

1. Specify terminating context closure before code-variant expansion, distinguishing masked
   installation cycles from actual unbounded re-entry. Do not introduce an arbitrary depth cap or
   turn a compiler limit into a source rule.
2. Resolve the ordering between exact IRQ-recognition boundaries, provisional instruction
   selection, context-specific homes and final SFA closure. Reuse the existing machine-binding
   path; do not assume a new instruction-skeleton facility exists. A final check cannot rescue an
   earlier non-terminating expansion.
3. Prove concrete entry-address consistency: an actual vector or saved predecessor must select the
   correct specialized body and private homes. Two abstract invocation identities are insufficient
   if both still enter one machine label with the same storage. Do not assume earlier saved
   addresses can be rewritten or add a runtime dispatcher to choose between bodies.
4. Close every simultaneously live predecessor, parameter, local, temporary and helper scratch
   through SFA before emission. Sequential chain execution is not another hardware interrupt
   frame; actual preemption is. Keep these two lifetime cases distinct.

These are planner-owned technical questions, not questions for the user to solve. AR-P2 remains
open until the exact seam is grounded. A larger subsystem would require the separate complexity
approval gate, not authorization inferred from this planning scope.

Confidence: high that the distinctions are necessary; medium that their final implementation seam
can remain small. Hardening: challenger converged and made termination/phase ordering explicit
readiness conditions. The strongest counterargument is uncontrolled growth of exact context
histories; the plan must answer it before claiming readiness. With more budget a general analysis
framework is possible, but no current evidence justifies that larger surface.

The eventual route contract must retain callback-only source identity and emit only selected
entry variants. Default CINV chaining preserves entry status across a binary-mode body before its
prior-handler jump; exclusive CINV establishes binary mode and reaches the pinned restore tail,
whose `RTI` restores the complete interrupted status, including D. Reusable helpers stay ordinary
`JSR`/`RTS` functions. A saved indirect pair beginning at `$xxFE` is valid; `$xxFF` must relocate or
reject. Source acknowledgement, bank visibility, stack peak and SFA conflicts need explicit owners.
Charge generated body/wrapper/installer/link bytes, all path cycles, RAM/ZP and stack separately
from existing ROM: the 16-byte PULS-to-CINV path and applicable 6-byte `$EA81` tail add no output
bytes. The new slice's exact costs are **Unknown** until its fixtures and final lowering are
defined; no parity claim or extra runtime cost is accepted by this design direction.

## AR-P3 — Exact Proposed Oracle Correction

The invalid example currently ends with `restoreIRQ()` both in the handler and in mainline after
the interrupt opportunity. It must not become a positive example merely because the blanket
handler-side rejection is removed. Chapter 6 §7.8 and Chapter 14's E10278 contract require exact
ownership agreement, including when mainline resumes after an interrupt.

| Proposed later modification | Exact boundary |
|---|---|
| `test/rd04/expressiveness-ledger.spec.test.ts`, `v4-handler-irq-update` probe | Keep the two existing balanced `setIRQ` / `setIRQExclusive` fixtures unchanged as positive retirement probes. Move only the third, restore-only fixture out of that positive group into a dedicated negative case in the same file, preserving its complete source verbatim and requiring failure with E10278. |
| `test/rd04/expressiveness-ledger.json`, `v4-handler-irq-update` row | Mark the blanket restriction retired only after its positive probes, preserved negative case and new handler-side qualification pass. Update only that row's status/reason/decision evidence; do not claim that invalid or unbounded forms became supported. |
| `packages/compiler/src/semantic/interrupt-handler-updates.impl.test.ts` | Update the two obsolete balanced-update rejection expectations to success when the independent specification tests are green. Preserve their source fixtures and all raw-write checks. This is an implementation-test update, not additional immutable-oracle authority. |

All other ledger rows, exact probe-inventory checks, mutation tests and NMI expectations remain
unchanged. Add no ledger schema, test runner or new validation subsystem. Independent new
specification tests must still fail before implementation; the old expectation changes are not a
substitute for red evidence. No test edit is authorized or applied by this recommendation alone.

The challenger independently recommended this split. The alternative of accepting all three
fixtures was rejected because it would erase the unmatched-restore safety check; simply deleting
that fixture would lose the same coverage.

## Discovery Checkpoint

The current baseline was rechecked without changing compiler or test files:

- `yarn workspace @blend65/compiler test src/semantic/interrupt-handler-updates.impl.test.ts src/storage/irq-stack.impl.test.ts`: **10/10 pass**.
- `yarn vitest run test/rd04/expressiveness-ledger.spec.test.ts test/rd04/interrupts.spec.test.ts --testTimeout 30000`: **15/15 pass**.

These results reproduce the current rejection and existing ownership guarantees; they do not
qualify the proposed feature. Logs: `/tmp/blend65-handler-irq-plan-ARwxMd/`.
The existing ledger specification oracle remains SHA-256
`7b9ee288ba0f4e087a717dfc3fa5d2768ab27d2d9549e75797f571621a62dd5f`.
Targeted Prettier, all 34 local links/anchors, cited source paths/lines, expert source keys and
frozen-authority checks pass. This documentation-only checkpoint does not rerun or replace the
previous full compiler qualification.

The category scan found open technical/state/edge-case closure in AR-P2 and test-authority scope in
AR-P3. Feature scope, naming, public interfaces, diagnostics, verification, output quality and
stakeholder/product boundaries use the confirmed slice and existing contracts. No new network,
authentication, persistence, host-process or input-format surface is proposed. Security cases are
compiler input rejection and resource-bound failures, not a new web/security framework. This is a
discovery checkpoint only; the full gate scan must be completed after AR-P2 and AR-P3 resolve.

## Authority and Completion Boundary

The active baseline is `skillVersion=2.0.0`, content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, frozen Specification 4 identity
`BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`.
The applicable expert routes are `references/sfa-and-abi.md#interrupt-route-completion-gate`,
`references/c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts` and
`references/c64-hardware.md#interrupt-control`. Governing keys include `MOS-PGM-1976`,
`CBM-C64-KERNAL-03` and `MOS-6526-1981`.

The compiler/language and concurrency lenses apply. There is no new public API, artifact format,
host service, dependency or migration. Existing profile identities and evidence schemas remain
unchanged. All twelve ambiguity categories still require their final scan before gate closure.
No implementation or complete-cost/parity claim follows from this planning checkpoint.
