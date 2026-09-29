# Execution Plan: RD-05 CIA Timer and Interrupt Slice

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-29 17:59
> **Progress**: 17/17 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only the approved cooperative CIA slice in [01-requirements.md](01-requirements.md), using [03-cia-operations.md](03-cia-operations.md) as the design owner and [07-testing-strategy.md](07-testing-strategy.md) as the independent oracle. AR-P1–AR-P9 and PF-001–PF-005 are resolved. DEF-7's NMI/CIA2 handoff and DEF-14's safe return to BASIC are later RD-05 work, not executable tasks here.

Update this document immediately after each task. Follow the project's reasoning-effort handoff before each new named task unless the user explicitly waives it for a named batch. No `spec/` or expert-skill edit is authorized.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Direct CIA API, ownership, lowering and qualification | 17 |

One coupled phase has three ordered sessions: specification tests → red verification → implementation → green verification → implementation tests and phase verification. The new CIA source check is focused; no generic hardware framework or runtime is added.

> **Execution rule:** Each numbered task appears once below. On implementation mark `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated verification passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`. Mark a blocked task `[!]` with `Blocked: <reason>`. Timestamps come from the host clock. Expected red tests do not authorize a broken commit. Use the git-commit skill at coherent green checkpoints; never push without the user's explicit request.

## Phase 1: Direct CIA API, Ownership and Qualification

> **Phase baseline tree**: `e380ed261e1cfa1e832b179651d8c12f01832f6d`
> **Expected modification set**: the new CIA spec/impl test files named below, including the AR-P8 entry-point-only correction in `test/rd05/cia-api.spec.test.ts`; the existing exact-inventory tests `packages/compiler/src/frontend/profile.spec.test.ts` and `packages/compiler/src/frontend/profile-constants.spec.test.ts`, plus the existing count/boundary test `packages/compiler/src/frontend/profile-constants.impl.test.ts`; the AR-P9-approved timeout-only correction in `test/rd05/runtime-switch-vice.spec.test.ts`; `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/target/c64-kernal.ts`, `packages/compiler/src/semantic/cia-ownership.ts` and its focused pure-facts split `packages/compiler/src/semantic/cia-ownership-facts.ts` (required to keep the review fix below the project's large-file limit), `packages/compiler/src/semantic/interrupt-ownership.ts`, `packages/compiler/src/machine/lower-c64-cia.ts`, `packages/compiler/src/machine/lower-c64.ts`; this plan, its new `08-closeout.md`, and the feature roadmap. No frozen specification, expert skill, general harness or new dependency. Scope mode: strict.
> **Lenses**: compiler/language semantics, IRQ/source concurrency, expert assembly/cost, simplicity

### Session 1.1: Independent Specification Tests

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-14; AR-P1–AR-P7. Specification authors use only the ST rows and planned public signatures, not implementation logic. Keep each file reviewable.

- [x] 1.1.1 [spec-author] Write public-name, counter, latch and control specification cases — `test/rd05/cia-api.spec.test.ts`; ST-1–ST-7. Expand only the CIA names in the two existing exact-inventory frontend spec tests listed above, preserving every prior entry (PF-003). (implemented: 2026-09-29 13:38) (completed: 2026-09-29 13:40; expected red: 20 new CIA cases and 9 exact inventories; 46 unchanged inventory cases, 50 existing profile cases and typecheck pass)
- [x] 1.1.2 [spec-author] Write exclusive-route, source-mask and nonreturning-takeover ownership specifications — `test/rd05/cia-ownership.spec.test.ts`; ST-8–ST-12. Include selected-handler/helper mutations and counter-only returning controls (PF-001–PF-002). (implemented: 2026-09-29 13:52) (completed: 2026-09-29 13:55; expected red: 61 CIA ownership cases; existing IRQ ownership control and typecheck pass)
- [x] 1.1.3 [spec-author] Write independent selected-instruction and cost specifications — `test/rd05/cia-output.spec.test.ts`; ST-2–ST-3, ST-5, ST-9–ST-11, ST-13. ST-3 checks low/high output order only, not a timed mid-decrement snapshot (PF-005). (implemented: 2026-09-29 14:23) (completed: 2026-09-29 14:25; 9 expected-red cases for missing CIA names; typecheck and formatting pass)
- [x] 1.1.4 [spec-author] Write four-profile runtime cases with existing sequential ACME/VICE helpers — `test/rd05/cia-vice.spec.test.ts`; ST-4, ST-9, ST-11, ST-14. Qualify the source-visible masked pending-IRQ handoff (PF-001). (implemented: 2026-09-29 14:45) (completed: 2026-09-29 14:45; 4 expected-red profile cases for missing CIA names; typecheck and formatting pass)
- [x] 1.1.5 Run the four directed specification files and record expected red results per new capability, distinguishing unchanged supporting passes — `99-execution-plan.md`; do not alter expectations to match current code. (implemented: 2026-09-29 14:46) (completed: 2026-09-29 14:47; expected red: API 20, ownership 61, output 9, VICE 4, all E10239 for absent CIA names; exact inventories 9 expected red and 46 unchanged cases pass; VICE execution has not begun)

**Verify:** Direct Vitest runs of each authored file; VICE files sequential. An absent capability is an expected red; a missing assembler/emulator or test-collection failure is not.

### Session 1.2: Implementation

**Reference:** [03-cia-operations.md](03-cia-operations.md), AR-P3–AR-P7. Preserve the current vector route and SFA contracts. Split a task before work if it exceeds one reviewable concern or three touched source files.

- [x] 1.2.1 Add the selected-profile source calls/constants and CIA address facts — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/target/c64-kernal.ts`; ST-1–ST-2. (implemented: 2026-09-29 14:50) (completed: 2026-09-29 14:51; exact inventories 55/55 and directed source acceptance 8/8 pass; typecheck and targeted formatting pass; ownership/lowering remains planned red)
- [x] 1.2.2 Implement the focused CIA1 route/mask/source ownership proof, tracking timer/ICR-mask mutation across calls, joins, loops and selected IRQ-handler/helper closures; nested vector restoration must not clean device state. Recognize statically identified raw CIA1 writes without claiming alias proof for legal runtime-address `poke()` or adding a generalized register framework. Do not treat handler return as BASIC return — `packages/compiler/src/semantic/cia-ownership.ts`; ST-7–ST-12. (implemented: 2026-09-29 14:56) (completed: 2026-09-29 14:57; focused proof module typechecks and formats; existing IRQ ownership control 22/22 passes; CIA diagnostics remain planned red until task 1.2.3 connects the check)
- [x] 1.2.3 Connect that proof to the existing interrupt-ownership entry; reject invalid calls, reverse handoff and normal return after CIA1 timer/mask mutation with source-linked E10278 before emission — `packages/compiler/src/semantic/interrupt-ownership.ts`; ST-6–ST-12. (implemented: 2026-09-29 14:58) (completed: 2026-09-29 15:16; AR-P8 independent test-entry correction preserved all ten negative expectations; CIA API 20/20, ownership rejection 42/42 and existing IRQ regressions 34/34 pass; typecheck, formatting and frozen-spec check pass; 19 ownership acceptance cases await planned machine lowering)
- [x] 1.2.4 Lower counter reads and low-then-high latch writes through a focused CIA module, then dispatch it from the existing C64 lowering path — `packages/compiler/src/machine/lower-c64-cia.ts`, `packages/compiler/src/machine/lower-c64.ts`; ST-2–ST-4, ST-13. (implemented: 2026-09-29 15:19) (completed: 2026-09-29 15:22; counter output 4/4, existing IRQ output 10/10, direct latch sequence and volatile order, typecheck, formatting and frozen-spec check pass; full CIA output remains planned red for control/ICR tasks)
- [x] 1.2.5 Lower safe CRA/CRB read/modify/write and LOAD-strobe behavior with pre-closure scratch only when dynamic flags need it — `packages/compiler/src/machine/lower-c64-cia.ts`; ST-5–ST-6, ST-13. (implemented: 2026-09-29 15:23) (completed: 2026-09-29 15:24; direct constant/dynamic machine sequences show one volatile read and write with accepted/preserved masks; API 20/20 and IRQ output 10/10 pass; typecheck and formatting pass; integrated CIA output remains planned red for task 1.2.6's ICR path)
- [x] 1.2.6 Lower direct ICR set/clear writes and one consuming read, preserving volatile order and all returned bits — `packages/compiler/src/machine/lower-c64-cia.ts`; ST-10–ST-13. (implemented: 2026-09-29 15:25) (completed: 2026-09-29 15:26; selected output 9/9, CIA ownership 61/61, typecheck, formatting and frozen-spec check pass)
- [x] 1.2.7 Update only the stale total/boundary numbers in `packages/compiler/src/frontend/profile-constants.impl.test.ts`, retaining its other assertions; then run every directed specification file and existing IRQ/profile regressions to green, including sequential VICE. Fix implementation failures without weakening ST expectations — affected compiler files only (PF-003). (implemented: 2026-09-29 15:27) (completed: 2026-09-29 15:28; CIA/IRQ directed 134/134, profile spec 55/55, profile internals 19/19, sequential four-profile VICE 4/4, formatting and frozen-spec check pass)

**Verify:** Affected package typecheck and directed spec/regression tests after each source task; at 1.2.7 all four CIA spec files and existing IRQ/profile regressions pass. No additional function storage appears after SFA closure.

### Session 1.3: Hardening and Phase Checkpoint

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-14; [03-cia-operations.md](03-cia-operations.md#lowering-and-cost); AR-P2.

- [x] 1.3.1 Add internal ownership join/loop/known-raw-address tests after the specification cases are green — `packages/compiler/src/semantic/cia-ownership.impl.test.ts`. (implemented: 2026-09-29 15:30) (completed: 2026-09-29 15:30; four directed cases and typecheck pass; targeted formatting applied)
- [x] 1.3.2 Add direct machine/volatile/scratch and constant-folding implementation tests — `packages/compiler/src/machine/cia-operations.impl.test.ts`. (implemented: 2026-09-29 15:32) (completed: 2026-09-29 15:32; five direct machine/SFA cases and typecheck pass; targeted formatting applied)
- [x] 1.3.3 Run the full approved phase checkpoint and frozen/source-key/format/output-cost checks — `99-execution-plan.md`, temporary logs; `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`, with VICE sequential. (resumed: 2026-09-29 16:05; AR-P9 approved) (completed: 2026-09-29 16:15; default install/build/typecheck/test green: compiler 1,556, root 1,001, CLI 62, language server 14, VS Code 6; targeted formatting, frozen specification/skill, source-key and output-cost checks pass)
- [x] 1.3.4 Perform the configured independent post-phase correctness and performance review; resolve material findings and rerun impacted verification — focused ownership implementation, independently authored CIA specification cases, implementation regressions, and `99-execution-plan.md`. (implemented: 2026-09-29 16:17) (completed: 2026-09-29 17:53; seven independent source cases red before correction and green after; scoped semantics and correctness re-reviews clear; performance re-review found PE-001's nonreturning null-cache omission, fixed within the approved finding with 24-layer returning/nonreturning regressions at 9/9; final install/build/typecheck/test green: compiler 1,561, root 1,008, CLI 62, language server 14, VS Code 6; sequential VICE cases pass)
- [x] 1.3.5 Record complete CIA1 route and expert-cost evidence, bounded VICE status, the temporary nonreturning limitation and its safe-return-to-BASIC owner DEF-14, remaining CIA2/DEF-7 obligation, and deferral-expiry answer — new `08-closeout.md`; do not mark RD-05 Done. (implemented: 2026-09-29 17:56) (completed: 2026-09-29 17:59; closeout records route, exact emitted costs, four-profile VICE status, independent review, DEF-7/DEF-14 owners, and a negative deferral-expiry answer; local links, source keys, formatting and plan progress checked; RD-05 remains Executing)

**Verify:** All 17 tasks complete, impact-based full phase commands green, no frozen-file diff, independent findings resolved, exact MMIO sequences and costs checked, and no new material support surface.

### Independent review findings — resolved

| Finding | Severity | Evidence and smallest correction |
|---|---|---|
| RV-001 | Critical, procedural | The phase diff includes the independently authored specification tests required by tasks 1.1.1–1.1.4 and the user-approved AR-P8/P9 corrections. The reviewer contract flags any `*.spec.test.ts` edit, although review found no weakened expectation. Treat these approved oracle changes as the specification baseline for implementation re-review; do not alter them to accommodate code. |
| RV-002 | Major | `cia-ownership.ts` can admit a nested chained IRQ route with unknown enabled CIA1 sources and can miss a known raw CIA1 write while that route is active. Reject unproved source transfer and track known device writes throughout the exclusive epoch. |
| SM-001 | Major | Literal `$DC10–$DCFF` mirror addresses alias CIA1's 16 registers but are not recognized as known timer/ICR writes. Normalize the known address to its register nibble before effect classification. |
| SM-002 | Major | Selected handlers start with an unknown mask even when source-visible setup proves a mask, falsely rejecting timer-source changes inside a handler. Carry only proved applicable mask facts into handler entry, conservatively joining possible entry states. |
| SM-003 | Moderate | `byte(...)` conversions are treated as 16-bit literals by constant-flag validation, falsely rejecting legal truncation. Apply the actual conversion width/sign to exact constant facts. |
| PE-001 | Major | The CIA ownership walk rechecks every acyclic call path; a 22-layer helper diamond took 10.2 seconds in a read-only benchmark. Memoize successful callable/input-state results while retaining source-linked diagnostics. |

The independent reviewers reported the emitted CIA byte/cycle sequences match the planned expert budgets. **Ruling, 2026-09-29:** the user approved the single recommended batch: correct the focused CIA ownership proof, add directed regression tests, preserve the independently authored and previously approved specification oracle, rerun verification, and perform one scoped re-review. RV-001 is an approved-oracle baseline distinction, not permission to weaken a test. The remaining findings were corrected in the focused ownership module and directed tests, with no generic hardware framework or runtime manager. The one scoped re-review cleared semantics and correctness; performance identified that PE-001 also required caching clean nonreturning results. That omission was fixed under the same approved finding and covered by a 24-layer nonreturning diamond test. No second re-review cycle was started.

## Dependencies and Success Criteria

Session 1.1 precedes 1.2; 1.2 precedes 1.3. Within 1.2, declarations and target facts precede semantic and machine consumption. A compiler output defect is fixed in implementation, never by relaxing a specification expectation. The phase is complete only when every checkbox is `[x]`, review and verification are green, the [slice acceptance](01-requirements.md#slice-acceptance) is evidenced, and the roadmap still shows RD-05 Executing with DEF-7 and DEF-14 owned. Documentation-only plan completion does not execute this checklist.
