# Execution Plan: RD-05 CIA Timer and Interrupt Slice

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-29 13:01
> **Progress**: 0/17 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only the approved cooperative CIA slice in [01-requirements.md](01-requirements.md), using [03-cia-operations.md](03-cia-operations.md) as the design owner and [07-testing-strategy.md](07-testing-strategy.md) as the independent oracle. AR-P1–AR-P7 and PF-001–PF-005 are resolved. DEF-7's NMI/CIA2 handoff and DEF-14's safe return to BASIC are later RD-05 work, not executable tasks here.

Update this document immediately after each task. Follow the project's reasoning-effort handoff before each new named task unless the user explicitly waives it for a named batch. No `spec/` or expert-skill edit is authorized.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Direct CIA API, ownership, lowering and qualification | 17 |

One coupled phase has three ordered sessions: specification tests → red verification → implementation → green verification → implementation tests and phase verification. The new CIA source check is focused; no generic hardware framework or runtime is added.

> **Execution rule:** Each numbered task appears once below. On implementation mark `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated verification passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`. Mark a blocked task `[!]` with `Blocked: <reason>`. Timestamps come from the host clock. Expected red tests do not authorize a broken commit. Use the git-commit skill at coherent green checkpoints; never push without the user's explicit request.

## Phase 1: Direct CIA API, Ownership and Qualification

> **Phase baseline tree**: _(record from the committed, staged, unstaged and untracked tree at execution start)_
> **Expected modification set**: the new CIA spec/impl test files named below; the existing exact-inventory tests `packages/compiler/src/frontend/profile.spec.test.ts` and `packages/compiler/src/frontend/profile-constants.spec.test.ts`, plus the existing count/boundary test `packages/compiler/src/frontend/profile-constants.impl.test.ts`; `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/target/c64-kernal.ts`, `packages/compiler/src/semantic/cia-ownership.ts`, `packages/compiler/src/semantic/interrupt-ownership.ts`, `packages/compiler/src/machine/lower-c64-cia.ts`, `packages/compiler/src/machine/lower-c64.ts`; this plan, its new `08-closeout.md`, and the feature roadmap. No frozen specification, expert skill, general harness or new dependency. Scope mode: strict.
> **Lenses**: compiler/language semantics, IRQ/source concurrency, expert assembly/cost, simplicity

### Session 1.1: Independent Specification Tests

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-14; AR-P1–AR-P7. Specification authors use only the ST rows and planned public signatures, not implementation logic. Keep each file reviewable.

- [ ] 1.1.1 [spec-author] Write public-name, counter, latch and control specification cases — `test/rd05/cia-api.spec.test.ts`; ST-1–ST-7. Expand only the CIA names in the two existing exact-inventory frontend spec tests listed above, preserving every prior entry (PF-003).
- [ ] 1.1.2 [spec-author] Write exclusive-route, source-mask and nonreturning-takeover ownership specifications — `test/rd05/cia-ownership.spec.test.ts`; ST-8–ST-12. Include selected-handler/helper mutations and counter-only returning controls (PF-001–PF-002).
- [ ] 1.1.3 [spec-author] Write independent selected-instruction and cost specifications — `test/rd05/cia-output.spec.test.ts`; ST-2–ST-3, ST-5, ST-9–ST-11, ST-13. ST-3 checks low/high output order only, not a timed mid-decrement snapshot (PF-005).
- [ ] 1.1.4 [spec-author] Write four-profile runtime cases with existing sequential ACME/VICE helpers — `test/rd05/cia-vice.spec.test.ts`; ST-4, ST-9, ST-11, ST-14. Qualify the source-visible masked pending-IRQ handoff (PF-001).
- [ ] 1.1.5 Run the four directed specification files and record expected red results per new capability, distinguishing unchanged supporting passes — `99-execution-plan.md`; do not alter expectations to match current code.

**Verify:** Direct Vitest runs of each authored file; VICE files sequential. An absent capability is an expected red; a missing assembler/emulator or test-collection failure is not.

### Session 1.2: Implementation

**Reference:** [03-cia-operations.md](03-cia-operations.md), AR-P3–AR-P7. Preserve the current vector route and SFA contracts. Split a task before work if it exceeds one reviewable concern or three touched source files.

- [ ] 1.2.1 Add the selected-profile source calls/constants and CIA address facts — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/target/c64-kernal.ts`; ST-1–ST-2.
- [ ] 1.2.2 Implement the focused CIA1 route/mask/source ownership proof, tracking timer/ICR-mask mutation across calls, joins, loops and selected IRQ-handler/helper closures; nested vector restoration must not clean device state. Recognize statically identified raw CIA1 writes without claiming alias proof for legal runtime-address `poke()` or adding a generalized register framework. Do not treat handler return as BASIC return — `packages/compiler/src/semantic/cia-ownership.ts`; ST-7–ST-12.
- [ ] 1.2.3 Connect that proof to the existing interrupt-ownership entry; reject invalid calls, reverse handoff and normal return after CIA1 timer/mask mutation with source-linked E10278 before emission — `packages/compiler/src/semantic/interrupt-ownership.ts`; ST-6–ST-12.
- [ ] 1.2.4 Lower counter reads and low-then-high latch writes through a focused CIA module, then dispatch it from the existing C64 lowering path — `packages/compiler/src/machine/lower-c64-cia.ts`, `packages/compiler/src/machine/lower-c64.ts`; ST-2–ST-4, ST-13.
- [ ] 1.2.5 Lower safe CRA/CRB read/modify/write and LOAD-strobe behavior with pre-closure scratch only when dynamic flags need it — `packages/compiler/src/machine/lower-c64-cia.ts`; ST-5–ST-6, ST-13.
- [ ] 1.2.6 Lower direct ICR set/clear writes and one consuming read, preserving volatile order and all returned bits — `packages/compiler/src/machine/lower-c64-cia.ts`; ST-10–ST-13.
- [ ] 1.2.7 Update only the stale total/boundary numbers in `packages/compiler/src/frontend/profile-constants.impl.test.ts`, retaining its other assertions; then run every directed specification file and existing IRQ/profile regressions to green, including sequential VICE. Fix implementation failures without weakening ST expectations — affected compiler files only (PF-003).

**Verify:** Affected package typecheck and directed spec/regression tests after each source task; at 1.2.7 all four CIA spec files and existing IRQ/profile regressions pass. No additional function storage appears after SFA closure.

### Session 1.3: Hardening and Phase Checkpoint

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-14; [03-cia-operations.md](03-cia-operations.md#lowering-and-cost); AR-P2.

- [ ] 1.3.1 Add internal ownership join/loop/known-raw-address tests after the specification cases are green — `packages/compiler/src/semantic/cia-ownership.impl.test.ts`.
- [ ] 1.3.2 Add direct machine/volatile/scratch and constant-folding implementation tests — `packages/compiler/src/machine/cia-operations.impl.test.ts`.
- [ ] 1.3.3 Run the full approved phase checkpoint and frozen/source-key/format/output-cost checks — `99-execution-plan.md`, temporary logs; `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`, with VICE sequential.
- [ ] 1.3.4 Perform the configured independent post-phase correctness and performance review; resolve material findings and rerun impacted verification — affected implementation files and `99-execution-plan.md` only.
- [ ] 1.3.5 Record complete CIA1 route and expert-cost evidence, bounded VICE status, the temporary nonreturning limitation and its safe-return-to-BASIC owner DEF-14, remaining CIA2/DEF-7 obligation, and deferral-expiry answer — new `08-closeout.md`; do not mark RD-05 Done.

**Verify:** All 17 tasks complete, impact-based full phase commands green, no frozen-file diff, independent findings resolved, exact MMIO sequences and costs checked, and no new material support surface.

## Dependencies and Success Criteria

Session 1.1 precedes 1.2; 1.2 precedes 1.3. Within 1.2, declarations and target facts precede semantic and machine consumption. A compiler output defect is fixed in implementation, never by relaxing a specification expectation. The phase is complete only when every checkbox is `[x]`, review and verification are green, the [slice acceptance](01-requirements.md#slice-acceptance) is evidenced, and the roadmap still shows RD-05 Executing with DEF-7 and DEF-14 owned. Documentation-only plan completion does not execute this checklist.
