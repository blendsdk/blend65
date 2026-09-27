# Execution Plan: Handler-Side IRQ Updates

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-27 23:49
> **Progress**: 0/30 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only the bounded IRQ slice from [01-requirements.md](01-requirements.md). The
[register](00-ambiguity-register.md) has no open material decision; AR-P4's NMI deferral has no
executable work here. Preflight remains the next gate before execution.

**Update this document immediately after each implemented and verified task.** It is the only
task-progress authority. The current plan-creation task does not authorize starting these tasks.
Follow the project's effort handoff before a new task or explicitly confirmed execution batch.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Safe handler-owned IRQ contexts and qualification | 30 |

One coupled phase, three ordered sessions: independent specifications → implementation →
internal hardening/full verification. The guard cannot be safely removed as a separate shipped
feature before its context, SFA and machine consumers agree. Small numbered tasks keep that
coupled change reviewable; they are not new subsystems or separate release gates.

> **Execution rule:** Each numbered task appears once below. Mark implemented work `[~]` with
> `(implemented: YYYY-MM-DD HH:MM)` immediately; after its stated verification passes mark `[x]`
> with `(completed: YYYY-MM-DD HH:MM)`. Only `[x]` counts in the Progress header. Update that
> header and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`.
> Mark a blocked task `[!]` with `Blocked: <reason>`. Read timestamps from the host clock.
> Expected red specifications are evidence, not permission to commit a broken checkpoint.
> Commit coherent green units through the git-commit skill; never push automatically.

## Phase 1: Safe Handler-Owned IRQ Contexts

> **Phase baseline tree**: Record at execution start through exec-plan's temporary-index snapshot.
> **Lenses**: Compiler/language semantics, concurrency, expert assembly/cost, simplicity

### Session 1.1: Independent Specification Tests

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), including shared setup and
independent-authoring boundaries; AR-P1/P2/P5. Dispatch specification authors through the existing
quality profile. Do not expose implementation bodies or implementation tests to them. All paths
in this section are new files; old tests remain untouched until the exact later tasks.

- [ ] 1.1.1 [spec-author] Write ownership and finite-construction specifications — `test/rd05/handler-irq-ownership.spec.test.ts`; ST-1–ST-10.
- [ ] 1.1.2 [spec-author] Write nesting, shared-private/shared-global and rejected-route specifications — `test/rd05/handler-irq-nesting.spec.test.ts`; ST-11–ST-17, ST-20, ST-29.
- [ ] 1.1.3 [spec-author] Write direct storage/link/capacity/rebinding specifications — `packages/compiler/src/storage/handler-irq.spec.test.ts`; ST-18, ST-22–ST-23.
- [ ] 1.1.4 [spec-author] Write selected-entry, identity and independent assembly/cost specifications — `test/rd05/handler-irq-output.spec.test.ts`; ST-19, ST-21, ST-30.
- [ ] 1.1.5 [spec-author] Write chain/predecessor and four-profile runtime specifications using existing monitor helpers — `test/rd05/handler-irq-vice.spec.test.ts`; ST-24, ST-26, ST-28.
- [ ] 1.1.6 [spec-author] Write nested-private-state and complete-status runtime specifications — `test/rd05/handler-irq-nesting-vice.spec.test.ts`; ST-25, ST-27.
- [ ] 1.1.7 Run the directed specification commands and record red per new capability; explain supporting pre-existing passes — `99-execution-plan.md`, temporary logs; no expectation edits.

**Verify:** Run each authored file with its [directed command](07-testing-strategy.md#verification).
For runtime cases, a source rejection is valid initial red; missing ACME/VICE is not. Keep emulator
runs sequential. If a task would exceed one reviewable test-file change, split its case group into
adjacent tasks in this checklist before implementation; retain specification-first order.

### Session 1.2: Implementation

**Reference:** [03-handler-irq.md](03-handler-irq.md); AR-P2. Work in order unless the dependency
paragraph below permits parallel work. New helper files are allowed only where explicitly named
here for direct file-size containment. Do not broaden the solution during implementation.

- [ ] 1.2.1 Prepare exact handler-prefix/exit ownership checks, preserving existing diagnostics; retain the blanket guard until activation in 1.2.12 — `packages/compiler/src/semantic/interrupt-ownership.ts`; design §2/§7, ST-1–ST-10.
- [ ] 1.2.2 Add finite root/local-slot contexts and stable wrapper bindings — `packages/compiler/src/semantic/interrupt-contexts.ts`, `whole-program.ts`; design §2–§3, ST-6–ST-7, ST-15.
- [ ] 1.2.3 Extend private request/result metadata and finite link inventory; retain root identity in the existing inventory hash — `packages/compiler/src/storage/storage-types.ts`, `inventory.ts`, `closure.ts`; design §5, ST-16–ST-18.
- [ ] 1.2.4 Extend the existing IRQ walker with suspended roots, continuation boundaries and live-link overlap facts — `packages/compiler/src/storage/irq-stack.ts`; design §4, ST-11–ST-17, ST-22.
- [ ] 1.2.5 Consume those facts before allocation and close every candidate through existing interference/certificates — `packages/compiler/src/storage/interference.ts`, `closure.ts`; design §5, ST-18, ST-22–ST-23.
- [ ] 1.2.6 Extend fixed private-home/ordinary-call specialization and exact bound-body sharing — `packages/compiler/src/machine/interrupt-specialize.ts`, `lower-indirect.ts`, `bind.ts`; design §3/§6/§8, ST-16–ST-19, ST-23.
- [ ] 1.2.7 Extract existing IRQ entry/vector transaction functions from the oversized C64 module without changing behavior — `packages/compiler/src/machine/lower-c64.ts`, new `lower-c64-interrupt.ts`; design §6, existing interrupt regression tests.
- [ ] 1.2.8 Bind install, restore and entry-tail operands to exact root-owned slots — `packages/compiler/src/machine/lower-platform.ts`, `lower-c64-interrupt.ts`; design §2/§6, ST-5, ST-15, ST-17, ST-21.
- [ ] 1.2.9 Wire the finite contexts and context-specific helper demands through selection — `packages/compiler/src/machine/lower.ts`, `lower-function.ts`, `lower-state.ts`; design §3/§5/§6, ST-16, ST-19, ST-23.
- [ ] 1.2.10 Integrate post-selection proof/warnings and retain source-to-machine evidence mappings — `packages/compiler/src/services/services.ts`, `memory-evidence-records.ts`, `evidence-records.ts`; design §5/§7, ST-20, ST-22–ST-23.
- [ ] 1.2.11 Extend existing shared-state diagnostics to proved overlapping IRQ roots — `packages/compiler/src/semantic/interrupt-domains.ts`; design §7, ST-20; no new diagnostics or global copies.
- [ ] 1.2.12 Remove the obsolete blanket guard after all consumers are wired; verify every new specification green, including sequential VICE, and record evidence — `packages/compiler/src/semantic/interrupt-ownership.ts`, `99-execution-plan.md`; all ST cases.
- [ ] 1.2.13 Apply only the approved ledger split/retirement and two old implementation expectations — `test/rd04/expressiveness-ledger.spec.test.ts`, `expressiveness-ledger.json`, `packages/compiler/src/semantic/interrupt-handler-updates.impl.test.ts`; AR-P3 verbatim boundary.
- [ ] 1.2.14 Apply only the approved two profile-oracle corrections — `test/rd05/profile-interrupts.spec.test.ts`; AR-P6 verbatim boundary; retain all NMI/mainline cases.

**Verify:** After each code task, run package typechecking and the affected directed files from
[the strategy](07-testing-strategy.md#verification); record exactly which cases are still expected
red while the coupled feature is incomplete. Tasks 1.2.13–1.2.14 additionally run the complete
affected old files and review their exact diffs against AR-P3/P6. Do not commit a known failing
feature state. Failure after green is an implementation defect, not permission to change oracles.

### Session 1.3: Implementation Tests and Hardening

**Reference:** design §3–§8 and the [internal hardening scope](07-testing-strategy.md#files-and-independent-authoring).
These tests may inspect implementation. Keep individual edits focused; split any growth beyond
the project's file-size limit rather than adding another abstraction.

- [ ] 1.3.1 Harden finite context closure and equivalent-state memoization — new `packages/compiler/src/semantic/interrupt-contexts.impl.test.ts`, existing `packages/compiler/src/storage/irq-stack.impl.test.ts`; ST-6–ST-7, ST-12–ST-15.
- [ ] 1.3.2 Harden all private storage classes, installation lifetimes and deterministic certificates — new `packages/compiler/src/storage/handler-irq.impl.test.ts`; ST-16–ST-18, ST-22–ST-23.
- [ ] 1.3.3 Harden actual entry operands, final binding/helper sharing and shared-RAM phase invariants — new `packages/compiler/src/machine/handler-irq.impl.test.ts`, existing `packages/compiler/src/services/shared-storage.impl.test.ts`; ST-19, ST-21, ST-23.
- [ ] 1.3.4 Run the entire impact-based phase verification and frozen/oracle diff checks — `99-execution-plan.md`, temporary logs; all ST cases and complete owned tests.
- [ ] 1.3.5 Record expert comparison and complete route/cost evidence; file any required measured parity gap under existing authority — new `08-closeout.md`; design §8, ST-21, ST-24–ST-30.
- [ ] 1.3.6 Perform independent post-phase review through exec-plan's configured reviewer, with semantics/concurrency/output-quality lenses; resolve and re-verify findings — `99-execution-plan.md` and directly affected implementation files only.
- [ ] 1.3.7 Complete the bounded deferral-expiry and final-source review; reconcile any due owner without claiming NMI or whole-RD completion — `08-closeout.md`; AR-P4 and AGENTS.md deferral-expiry rule.
- [ ] 1.3.8 Re-run final verification after review fixes, finalize closeout and update DEF-8/RD-05 roadmap status — `99-execution-plan.md`, `08-closeout.md`, `../../00-roadmap.md`; use the roadmap skill, no portfolio write on this feature branch.
- [ ] 1.3.9 Make the coherent green phase checkpoint through the git-commit skill and report completion, evidence and remaining owner — `99-execution-plan.md`; do not push without a new explicit request.

**Verify:** Full commands and sequential emulator rules are in
[07 §Verification](07-testing-strategy.md#verification). A review fix reruns its directed tests plus
the final full checkpoint. The evidence document validates links, profile IDs, actual artifact
hashes, arithmetic and lineage; it is not a new executable reporting framework.

## Dependencies and Limits

Session 1.1 fully precedes implementation. Ownership/context/inventory precede the exact IRQ walk;
its facts precede final interference. Entry selection and fixed-call specialization must use the
same identities before public green. Shared-state diagnostics consume proved overlap, not merely
the presence of multiple IRQ roots. All implementation precedes Session 1.3 hardening. Independent
specification authors may work on disjoint files; implementation is coupled and should remain
serial unless exec-plan establishes non-overlapping ownership. Runtime suites are always serial.

The named file groups bound each change to at most three owners. Aim for a reviewable 50–150-line
increment; split an overlarge change in this same progress checklist before executing it. A direct
extract may exceed that size as a behavior-preserving move; do not mix it with new behavior. If
`irq-stack.ts` or another touched owner would exceed the file limit, one cohesive internal helper
extract is allowed, but a new analysis layer or support framework requires the complexity gate.

## Completion Boundary

The slice completes only after every task verifies, independent review is clear, expert-output
obligations are recorded, and the exact ledger/profile corrections pass. Compiler/test fixtures
remain spec-first and frozen authorities remain untouched. The closeout explicitly answers whether
these deliverables expire any deferral rationale; DEF-8 is due here, NMI has a separate owner.
RD-05 is not marked Done by this plan. Post-completion project analysis follows exec-plan without
rewriting frozen guidance or broadening this task.
