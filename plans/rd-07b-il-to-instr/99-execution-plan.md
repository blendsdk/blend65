# Execution Plan: RD-07b IL→Instr Translation, Register Binding & `generateInstr`

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-08
> **Progress**: 12/21 tasks (57%) — 🟢 Phases 1–2 complete



> **CodeOps Version**: (unstamped — consistent with RD-01..RD-07a)

> **Commit mode**: `--no-commit` (D8) — agent makes NO git operations; user handles all commits.

## Overview

Implements **RD-07b** — the consumer-coupled half of the 6502 code generator, scoped as a
**slice matching RD-06's live lowering** (D1): IL→`Instr` translation for the ops the lowering
emits today (D3), register binding (R40–R45), and the `InstrProgram` + `generateInstr` entry
point taking a `cpuVariant` primitive (D2). Ops no live lowering emits, and the RD-10
platform-hook seam, are deferred to **RD-07c**. All artifacts extend
`@blend65/codegen/src/instr/` (consuming RD-07a's model + the `il/` model read-only, D6).

Each feature follows **spec-tests-first** ordering (write spec tests → verify red → implement
→ verify green → impl tests). All decisions trace to `00-ambiguity-register.md` (D1–D8).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                       | Sessions | Est. Time |
| ----- | ------------------------------------------- | -------- | --------- |
| 1     | Register binder (temp→A/X/Y+ZP, tracking)   | 1        | 2–2.5 h   |
| 2     | IL→Instr translator (live op set)           | 1–2      | 3–4 h     |
| 3     | `InstrProgram` + `generateInstr` + validation| 1        | 1.5–2 h   |
| 4     | End-to-end goldens & closeout               | 1        | 1 h       |

**Total: ~4–5 sessions, ~7.5–9.5 hours**

> **Order rationale:** the binder (Phase 1) has the cleanest, most isolated seam and the
> translator (Phase 2) depends on it, so it is built and tested first. The program/entry point
> (Phase 3) composes both. Goldens (Phase 4) prove the whole pipeline on real IL.

---

## Phase 1: Register binder

### Session 1.1: `register-binding.ts`

**Reference**: `03-02-register-binding.md`
**Objective**: The linear-scan temp→A/X/Y+ZP binder with register-state tracking, redundant-load suppression, deterministic spills, and block-boundary reset.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1.1.1 | Spec tests ST-R1..R8 (suppression, A/X roles, spill+LRU, over-budget ICE, reset) | `packages/codegen/src/instr/register-binding.spec.test.ts` |
| 1.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 1.1.3 | `RegisterBinder` (`RegisterState`, `ensureInA`/`locationOf`/`bindResultToA`/`bindResultToX`/`reset`, ZP-temp spills from the plan) (R40–R45) | `instr/register-binding.ts` |
| 1.1.4 | Verify spec tests PASS (green); binder impl tests (high-pressure spills, LRU totality, reset idempotence) | `instr/register-binding.impl.test.ts` |

**Verify**: canonical verify command.

---

## Phase 2: IL→Instr translator

### Session 2.1: `translate.ts` — memory + arithmetic + ret

**Reference**: `03-01-il-to-instr-translation.md`
**Objective**: Translate `load`/`store`/`const`, arithmetic/bitwise/shift binary ops, and the `ret` terminator (both widths), with the deferred-op ICE default arm and span propagation.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.1.1 | Spec tests ST-T1..T12, T20..T25 (load/store/const, add/sub/bitwise/shift, ret, RTI, deferred-op ICE, span) | `packages/codegen/src/instr/translate.spec.test.ts` |
| 2.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.1.3 | `translateFunction`/`translateInstruction`/`translateTerminator`; operand lowering; memory + arithmetic + bitwise + shift + ret emitters; ICE default arm (R17–R20, R27/R28, R32, R50/R51, D3/D5/D7) | `instr/translate.ts` |
| 2.1.4 | Verify spec tests PASS (green)                                                | —                                                     |

**Deliverables**: the live memory/arithmetic/ret translation; verification passing.

### Session 2.2: `translate.ts` — comparison + mul/div/mod

**Reference**: `03-01-il-to-instr-translation.md` (§comparison, §mul, §div/mod)
**Objective**: Comparison 0/1 materialization and the mul/div/mod call-site strategy with cost warnings.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.2.1 | Spec tests ST-T13..T19 (eq/ne/lt/le/gt/ge; mul fold/pow2/runtime; div/mod; W10170/71/72) | `instr/translate.spec.test.ts` (append) |
| 2.2.2 | Verify new spec tests FAIL (red)                                              | —                                                     |
| 2.2.3 | Comparison emitter (flag→0/1, per-op branch); `mul` (fold/shift/`JSR __rt_mul*`); `div`/`mod` (`JSR __rt_div*`); cost warnings (R21–R23, R60, D4) | `instr/translate.ts` |
| 2.2.4 | Verify spec tests PASS (green); translator impl tests (16-bit carry chain, swapped gt/le, span reset) | `instr/translate.impl.test.ts` |

**Verify**: canonical verify command.

---

## Phase 3: `InstrProgram` + `generateInstr`

### Session 3.1: `instr-program.ts`

**Reference**: `03-03-instr-program-and-generate.md`
**Objective**: The program container, the entry point driving per-function translation + per-stream validation, IL-less-function skipping, `programByteSize`, and the barrel export.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3.1.1 | Spec tests ST-P1..P7 (program shape, skip empty fn, validation ICE, determinism, order, byte size, clean program) | `packages/codegen/src/instr/instr-program.spec.test.ts` |
| 3.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 3.1.3 | `InstrProgram`, `generateInstr` (plan-from-IL, per-fn translate + `validateStream`, R59 skip, frozen output), `programByteSize` (R55–R61, D2) | `instr/instr-program.ts` |
| 3.1.4 | Export `InstrProgram`/`generateInstr`/`programByteSize` from `instr/index.ts` | `instr/index.ts`                                      |
| 3.1.5 | Verify spec tests PASS (green); program impl tests (empty program, multi-fn order, mixed byte sizing) | `instr/instr-program.impl.test.ts` |

**Verify**: canonical verify command.

---

## Phase 4: End-to-end goldens & closeout

### Session 4.1: Goldens, requirements annotation, closeout

**Reference**: `00-index.md`, `07-testing-strategy.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 4.1.1 | Golden snapshots ST-G1..G3 (`generateInstr`→`printInstr` of real RD-06 lowering fixtures) (AC-10) | `instr/generate.golden.spec.test.ts` + `__snapshots__/` |
| 4.1.2 | Confirm R15 boundary tier still green (frontend/language-server ↛ codegen)     | `test/boundary.spec.test.ts`                          |
| 4.1.3 | Annotate `requirements/RD-07-codegen-instr.md` (07b slice done; RD-07c carries the deferred remainder) | `requirements/RD-07-codegen-instr.md`     |
| 4.1.4 | Tick AC-*/FR-* in `01-requirements.md`; set Index status to Implemented; final full verify; `spec/` clean | plan docs |

**Verify**: canonical verify command; `git status --porcelain spec/` empty.

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g.
>    `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`.
> 2. **After completing each phase:** confirm every task in that phase is `[x]`.
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) after every update.
> 4. **This checklist MUST exist** — reconstruct from phase tables if missing before executing.
> 5. **Never batch updates** — update immediately after each task.
>
> Commit mode is `--no-commit` (D8): never run git operations; the user commits.

### Phase 1: Register binder
- [x] 1.1.1 Spec tests ST-R1..R8 ✅ (completed: 2026-06-07 21:43)
- [x] 1.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-07 21:43)
- [x] 1.1.3 `register-binding.ts` (binder + state tracking + spills + reset) ✅ (completed: 2026-06-07 21:44)
- [x] 1.1.4 Verify green; binder impl tests ✅ (completed: 2026-06-07 21:47)


### Phase 2: IL→Instr translator
- [x] 2.1.1 Spec tests ST-T1..T12, T20..T25 (memory/arith/ret/deferred/span) ✅ (completed: 2026-06-08 00:17)
- [x] 2.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-08 00:18)
- [x] 2.1.3 `translate.ts` — operand lowering + memory/arith/bitwise/shift/ret + ICE default ✅ (completed: 2026-06-08 00:24)
- [x] 2.1.4 Verify spec tests PASS (green) ✅ (completed: 2026-06-08 00:24)
- [x] 2.2.1 Spec tests ST-T13..T19 (comparison + mul/div/mod + cost warnings) ✅ (completed: 2026-06-08 00:27)
- [x] 2.2.2 Verify new spec tests FAIL (red) ✅ (completed: 2026-06-08 00:27)
- [x] 2.2.3 `translate.ts` — comparison + mul/div/mod call-site + W10170/71/72 ✅ (completed: 2026-06-08 00:28)
- [x] 2.2.4 Verify green; translator impl tests ✅ (completed: 2026-06-08 00:31)


### Phase 3: `InstrProgram` + `generateInstr`
- [ ] 3.1.1 Spec tests ST-P1..P7
- [ ] 3.1.2 Verify spec tests FAIL (red)
- [ ] 3.1.3 `instr-program.ts` (`InstrProgram` + `generateInstr` + `programByteSize`)
- [ ] 3.1.4 Export from `instr/index.ts`
- [ ] 3.1.5 Verify green; program impl tests

### Phase 4: Goldens & closeout
- [ ] 4.1.1 Golden snapshots ST-G1..G3 (real-IL end-to-end)
- [ ] 4.1.2 Confirm R15 boundary tier green
- [ ] 4.1.3 Annotate `requirements/RD-07-codegen-instr.md` (07b done; RD-07c remainder)
- [ ] 4.1.4 Tick AC-*/FR-*; Index → Implemented; final verify; `spec/` clean

---

## Session Protocol

### Starting a Session
1. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh start`
2. "Implement Phase X, Session X.X per `plans/rd-07b-il-to-instr/99-execution-plan.md`"

### Ending a Session
1. Run the canonical verify command.
2. **No commit** (D8) — leave changes for the user.
3. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh finished`
4. `/compact`.

---

## Dependencies

```
Phase 1 (register binder)
    ↓
Phase 2 (translator — uses the binder)
    ↓
Phase 3 (InstrProgram + generateInstr — composes translator + RD-07a validateStream)
    ↓
Phase 4 (real-IL goldens, boundary re-confirm, closeout)
```

External (consumed, not built): RD-07a `instr/` model + `validateStream`/`printInstr`/
`instrByteSize`; RD-06 `il/` model + lowering fixtures; RD-05 `AllocationPlan` (via
`ilProgram.allocationPlan`); core `DiagnosticBag`/`IceCode`/`SourceSpan`.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (canonical verify command)
3. ✅ No warnings/errors; R15 boundary tier green; `spec/` clean
4. ✅ No dead code — deferred IL-op arms are documented as "RD-07c" (intentional ICE boundary),
   not removed; every in-scope op has a real, tested translation
5. ✅ Security N/A (compiler-internal translation over validated IL; no external input)
6. ✅ All ST-* pass; golden snapshots committed; AC-*/FR-* ticked
7. ✅ **Post-completion:** ask the user to re-analyze the project and update
   `.clinerules/project.md`; then, when RD-06 lowering widens and/or RD-10 lands, author the
   **RD-07c** plan (deferred IL ops, multi-block CFG, platform-hook seam, `InstrProgram`
   preamble).
