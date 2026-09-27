# Ambiguity Register: RD-05 Handler-Side IRQ Updates

> **Status**: ✅ GATE PASSED — 5 resolved; 1 explicitly carried named deferral
> **Last Updated**: 2026-09-27 23:49
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The bounded RD-05 R5.16 handler-side IRQ slice carried by RD-04 AR-P17 / DEF-8: temporarily install another handler and safely restore the previous handler, with the relevant R5.15, R5.17 and R5.18 safety obligations. |
| Context artifacts | Frozen Specification 4 and expert 2.0.0; RD-05 requirements; completed Stage A and its NMI deferral; current interrupt ownership, context, SFA, lowering and tests; the RD-04 expressiveness ledger. Reading these does not authorize changing them. |
| Modification set | This new plan directory and the active feature roadmap only. No compiler/test implementation, requirement change, frozen-specification change, expert-baseline change or portfolio change. The user's subsequent “Push and proceed” separately authorizes pushing the saved checkpoint. Existing specification-test changes are limited to the exact AR-P3 and AR-P6 rulings during later execution. |

## Decisions

| ID | Category | Decision or question | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / effort | Plan this bounded IRQ slice at the previously confirmed Xhigh effort. Reuse existing compiler analysis and static storage; add no runtime manager, scheduler or language feature. This does not close RD-05. | User: “proceed” after the explicit handler-side IRQ scope confirmation. | ✅ Resolved |
| AR-P2 | Technical / concurrency (sensitive) | Use finite handler-root/local-slot contexts, separate installed predecessors, and the existing selected-instruction IRQ analysis before SFA interference. Preserve selection through binding; no second analysis framework or runtime mechanism. | Planner-owned technical selection under the user's AGENTS.md workflow directive 4, after code grounding and independent challenge; not a claim of a new user product ruling. | ✅ Resolved |
| AR-P3 | Test authority | Apply only the exact ledger-oracle correction below during later implementation. Preserve the invalid source and every unrelated expectation. | User: “I approve” after the exact correction was presented. | ✅ Resolved |
| AR-P4 | Carried NMI scope | Positive finite NMI-source/reentry and safe install/restore proof remains with RD-05 planning. Revisit before NMI-dependent executable work or complete RD-05 plan readiness. No NMI, takeover or banking implementation enters this slice. | Existing Stage A AR-P3 and user's confirmation of this IRQ-only planning scope. | ⏸ Deferred — named NMI contract; RD-05 planning owner; revisit before dependent work or full-plan readiness |
| AR-P5 | Verification / workflow | Use existing specification-first tests, public build service, direct storage/machine tests and sequential VICE 3.10. Keep behavior and assembly/cost expectations independent. Retain the established install/build/typecheck/test checkpoint and temporary root `--testTimeout 30000` allowance; no permanent timeout edit. Commit coherent green checkpoints without asking; never push automatically. | User-provided AGENTS.md and established verification ruling. | ✅ Resolved |
| AR-P6 | Test authority (discovered during final oracle inventory) | Move only the two balanced handler-side IRQ fixtures in `test/rd05/profile-interrupts.spec.test.ts` from the rejection table to positive check/build cases across its existing four profiles. Preserve complete source text, NMI rejection cases and the mainline test. | User: “Push and proceed” in response to the single pending AR-P6 recommendation. | ✅ Resolved |

## Initial Grounding

Status: **Verified partial**. Claim kind: **Fact** for the code inventory below; the selected
design is analysis, not implemented behavior, and no new runtime result is claimed.

| Evidence | Consequence for this slice |
|---|---|
| `packages/compiler/src/semantic/interrupt-ownership.ts:237` | A blanket guard rejects handler-reachable IRQ installs/restores before the existing ownership proof. Deleting that guard alone is unsafe. |
| `packages/compiler/src/semantic/interrupt-contexts.ts:37` | Context propagation currently follows installation depth and source calls, not every live chain and IRQ-mask boundary. |
| `packages/compiler/src/storage/inventory.ts:407` and `packages/compiler/src/machine/lower-platform.ts:91` | Saved predecessor words are addressed by sink/depth, with capacity derived primarily from mainline ownership. |
| `packages/compiler/src/storage/irq-stack.ts:142` | An existing compile-time walk already distinguishes source masks, installed handler chains, source saves, calls and instruction-recognition boundaries. Reuse its proven behavior rather than adding another runtime mechanism. |
| `packages/compiler/src/semantic/interrupt-domains.ts:10` and `packages/compiler/src/storage/interference.ts:130` | Invocation homes currently distinguish mainline/IRQ/NMI, not two simultaneously live IRQ activations. A finite nested IRQ case must not alias their private homes. |
| `test/rd04/expressiveness-ledger.spec.test.ts:105` | One restriction probe groups two balanced installs with a handler-only restore followed by another mainline restore. Marking every probe successful would discard a real ownership check. |

## AR-P2 — Selected Bounded Design

**Selected direction:** extend the existing ownership/context, SFA and specialization records.
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

The four discovery obligations are closed at design level, not claimed as implemented:

| Obligation | Grounded resolution |
|---|---|
| Termination before lowering | Each handler starts its own local temporary depth at zero. Finite source roots, acyclic ordinary calls and ownership-balanced CFG backedges bound the slot universe. Entry variants name an installing slot, not an ever-growing vector history. Masked cycles revisit existing identities. |
| Phase ordering | `packages/compiler/src/services/services.ts:224` selects one symbolic program before `closeStorage`; the latter receives selected instruction sites. Run the existing IRQ walk before interference construction. `packages/compiler/src/services/shared-storage.ts:78` reuses that same symbolic program and binder for final RAM closure. No early instruction skeleton or outer re-lowering loop is needed. |
| Real entry addresses | A wrapper names its handler root, ABI and installation predecessor slot. Its root-private homes do not change with a later vector stack. Only proved concurrent roots need disjoint homes; an old saved address retains its meaning. |
| Complete live storage | Extend the existing IRQ walk with suspended roots and installation-live links. Feed resulting conflicts into SFA for every private home and link. Keep wrapper continuations/hardware frames live after body completion where required. Binding and layout must preserve the selected proof's recognition, ownership, stack and scratch facts. |

Repeated **suspended** handler identity is an unproved repeatable overlap cycle under the existing
conservative control model: entry is masked, every handler preserves its incoming ownership prefix,
its reachable choices and balanced local installs can recur above that prefix, and the external
IRQ source has no event-count bound. This is not a claim that every concrete run is infinite.
Sequential repeated chain entries remain legal. The technical specification owns the detailed
algorithm, completion boundaries and tests.

The independent challenger converged on this design and on the no-reselection binding contract.
Its review used the supplied code/specification packet, not independent repository inspection.
The discarded approaches were fixed source-site slots (unsafe for overlapping helpers), unbounded
total-depth specialization (fails to terminate on masked cycles), an early instruction skeleton,
and an outer re-lowering loop (both unnecessary given the actual service seam).

Confidence: moderately high at design level; implementation and runtime qualification remain
required. Hardening: independent challenge reconciled termination, concrete address selection,
body-versus-wrapper completion, installation lifetimes and final-emission consistency. The
strongest risk is omitting a live continuation or predecessor; planned qualification must give
those explicit negative and runtime cases. More analysis machinery would increase cost without meeting an
additional authorized requirement. This is a direct extension, not an approved complexity
escalation; any later larger support surface must stop at that gate.

The final phase invariant is stronger than unchanged opcode counts: binding must preserve IRQ
recognition opportunities, mask transitions, vector transactions, ownership state and call/return/
chain stack effects. Branch relaxation may insert neutral jumps at an already-emitting site only
with those facts unchanged. Exact duplicate helper sharing must retain both stack effects and
physical scratch assumptions. The existing shared-storage shape check remains; direct regression
checks establish the additional semantic invariant. A future transform that changes it must refresh
the proof before acceptance, not silently reuse stale interference.

Installation slots remain live while installed and while any pending chain continuation needs
them, including while their installing body is suspended. The existing IRQ walk can record
co-live slot pairs and slot-versus-active/suspended-root conflicts alongside private-root overlap.
These facts extend the existing interference construction; they do not create a new general
lifetime framework. No global is cloned, and a repeated sequential root does not imply a second
live private frame. Ordinary helpers inherit the caller's root and local depth, including net
temporary ownership transfer inside the enclosing handler.

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

## AR-P3 — Approved Exact Oracle Correction

The invalid example currently ends with `restoreIRQ()` both in the handler and in mainline after
the interrupt opportunity. It must not become a positive example merely because the blanket
handler-side rejection is removed. Chapter 6 §7.8 and Chapter 14's E10278 contract require exact
ownership agreement, including when mainline resumes after an interrupt.

| Approved later modification | Exact boundary |
|---|---|
| `test/rd04/expressiveness-ledger.spec.test.ts`, `v4-handler-irq-update` probe | Keep the two existing balanced `setIRQ` / `setIRQExclusive` fixtures unchanged as positive retirement probes. Move only the third, restore-only fixture out of that positive group into a dedicated negative case in the same file, preserving its complete source verbatim and requiring failure with E10278. |
| `test/rd04/expressiveness-ledger.json`, `v4-handler-irq-update` row | Mark the blanket restriction retired only after its positive probes, preserved negative case and new handler-side qualification pass. Update only that row's status/reason/decision evidence; do not claim that invalid or unbounded forms became supported. |
| `packages/compiler/src/semantic/interrupt-handler-updates.impl.test.ts` | Update the two obsolete balanced-update rejection expectations to success when the independent specification tests are green. Preserve their source fixtures and all raw-write checks. This is an implementation-test update, not additional immutable-oracle authority. |

All other ledger rows, exact probe-inventory checks, mutation tests and NMI expectations remain
unchanged. Add no ledger schema, test runner or new validation subsystem. Independent new
specification tests must still fail before implementation; the old expectation changes are not a
substitute for red evidence. The user approved this exact correction on 2026-09-27. It enters the
future execution plan; no compiler or test implementation is performed during planning.

The challenger independently recommended this split. The alternative of accepting all three
fixtures was rejected because it would erase the unmatched-restore safety check; simply deleting
that fixture would lose the same coverage.

## AR-P6 — Approved Exact Profile Oracle Correction

The final repository-wide specification-test scan found a second owner of the old blanket
restriction: `test/rd05/profile-interrupts.spec.test.ts:49–62`. Its two balanced IRQ fixtures are
the newly supported behavior, not unsafe NMI or actual unbounded re-entry. They currently run
inside the same rejection table as two NMI fixtures, on all four cooperative profile IDs.

**Approved:** move only `handler-side chained IRQ installation` and
`handler-side exclusive IRQ installation` into positive cases in that same file. Preserve each
complete Blend65 source verbatim, the four-profile parameterization and both public `checkProject`
and `buildProject` calls. Require success with no error diagnostics; verify the selected profile
and emitted artifacts through the existing fixture helpers. Keep both NMI fixtures, their E10245
and no-output assertions, and the existing balanced-mainline test unchanged. Only the moved IRQ
cases lose the obsolete E10245/no-output expectation. Apply this during implementation after the
new independent specifications are green, not during planning.

This additional immutable-oracle permission was approved separately from AR-P3's exact file boundary
by the user's “Push and proceed” on 2026-09-27.
No compiler scope, language rule, profile, runtime or harness is added. Retaining these old
rejections would contradict the approved feature; deleting their fixtures would lose profile
coverage. Current file SHA-256:
`f2423ac0810bc0ddcbb65ce4a54bd9e74b9941e8cc5ad560cb663bb7a37b522c`.

Other scan matches remain valid negative coverage: unbalanced self-installation in
`test/rd04/diagnostics-resource-boundaries.spec.test.ts`, unbounded IRQ enable/re-entry and final
CLI cases, and unsafe NMI. None is authorized to change. This is the first post-design-closure
ambiguity batch; no plan document beyond this register was created before the gate reopened.

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

After AR-P3 approval and design closure, the unchanged additional oracle baseline was checked:
`yarn vitest run test/rd05/profile-interrupts.spec.test.ts test/rd04/diagnostics-resource-boundaries.spec.test.ts --testTimeout 30000`:
**27/27 pass**. Logs: `/tmp/blend65-handler-irq-design-m86V1G/`. The two touched documents pass
targeted formatting and all 34 local links/anchors. Cited source paths, the three recorded test
hashes and the three governing source keys pass. Compiler, test, frozen specification and expert
skill files remain unchanged. These are baseline results, not qualification of the new capability.

The final twelve-category scan covers feature, behavior, scope, technical design, edge cases,
integration, data/state, security, non-functional quality, presentation, stakeholders and naming.
AR-P1/P4 bound scope; AR-P2 closes technical/state/integration/edge behavior; AR-P3 owns the approved
oracle exception; AR-P5 owns verification. AR-P6 closes the additional test-authority
boundary identified by the final oracle inventory. Existing diagnostic
identities and public interfaces are retained. No new network, authentication, persistence,
host-process or input-format surface is proposed. Security cases are compiler input rejection and
resource-bound failures, not a new web/security framework.

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
unchanged. Technical selection uses the project's explicit delegation of compiler/plan-owned
decisions; it does not delegate immutable-oracle changes. Both exact oracle corrections are now
user-approved, and the gate passes for this bounded plan.
NMI remains the named deferral, absent from executable work. No implementation or complete-cost/
parity claim follows from design closure.

## Plan Authoring Verification

The seven required plan documents now exist. The read-only CodeOps parser finds the single
feature-qualified RD-05 mapping, 30 unique unstarted tasks, specification-first ordering and no
artifact problems. The planning quality scan covers all required categories; each decision traces
to this register, and every case/task traces to the bounded requirements/design. One technical
document owns the implementation contract; no separate readiness record or graph is created.

Targeted Prettier and whitespace checks pass. All 65 local links/anchors and 26 source-line
citations resolve; ST-1 through ST-30 are unique and all cited IDs exist. The three checked old-test
hashes are unchanged. Compiler/test files, frozen specification, expert baseline and portfolio are
untouched. The roadmap counter check reports only the known portfolio roll-up drift; integration
branch policy intentionally defers that write. Verification logs are under
`/tmp/blend65-handler-irq-plan-final-DySTCE/`.

This is **Planning Complete**, not preflight passed or implementation qualified. The next distinct
task is whole-plan preflight, including simplicity and expert-output checks, after the required
effort handoff. The six saved predecessor commits through `497e4a47` were pushed on the user's
explicit request before this authoring resumed; new checkpoints are not automatically pushed.
