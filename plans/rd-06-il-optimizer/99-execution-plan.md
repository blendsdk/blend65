# Execution Plan: RD-06 IL & IL Optimizer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-05
> **Progress**: 18/18 tasks (100%) — ✅ COMPLETE



> **CodeOps Version**: (unstamped — consistent with RD-01..RD-05/RD-11a)
> **Commit mode**: `--no-commit` (D7) — agent makes NO git operations; user handles all commits.

## Overview

Implements RD-06 using the **walking-skeleton slice scope** (D1): the **full IL data model**,
the **deterministic textual printer**, and the **passthrough optimizer pipeline** are built
completely; **AST→IL lowering** is built for the **gate + slice-2 surface** behind an
extensible visitor seam whose default raises an ICE (D6). All artifacts live in
`@blend65/codegen` (`il/` + `il/optimizer/`, D3). Lowering is fixture-tested today; only the
live compiler-façade wiring is deferred (D5).

Each feature follows **spec-tests-first** ordering (write spec tests → verify red → implement
→ verify green → impl tests). All decisions trace to `00-ambiguity-register.md` (D1–D7).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                   | Sessions | Est. Time |
| ----- | --------------------------------------- | -------- | --------- |
| 1     | IL data model + textual printer          | 1–2      | 2–3 h     |
| 2     | Lowering (gate/slice-2) + builder + optimizer | 2    | 3–4 h     |
| 3     | Barrel wiring, goldens & closeout        | 1        | 60 min    |

**Total: ~4 sessions, ~6–7 hours**

---

## Phase 1: IL data model + textual printer

### Session 1.1: IL model (`il-type` / `operand` / `instruction` / `cfg`)

**Reference**: `03-01-il-data-model.md`
**Objective**: Ship the complete, typed IL vocabulary the optimizer + RD-07 consume.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1.1.1 | Spec tests ST-M1..M11 (type mapping, operands, instr/term, `ILProgram` carries plan, equality) | `packages/codegen/src/il/il-model.spec.test.ts` |
| 1.1.2 | Verify spec tests FAIL (red — via typecheck; types absent)                    | —                                                     |
| 1.1.3 | `ILType` + constants + `ilTypeEquals` + `ilTypeOfType` (R3/R5/R6)             | `packages/codegen/src/il/il-type.ts`                  |
| 1.1.4 | `ILOperand` union + `imm`/`temp`/`loc` + guards (R7–R11)                       | `packages/codegen/src/il/operand.ts`                  |
| 1.1.5 | `ILInstruction` + `ILTerminator` unions + opcode tuples + minimal `IntrinsicDescriptor` placeholder (R17–R28) | `packages/codegen/src/il/instruction.ts`, `il/intrinsic-descriptor.ts` |
| 1.1.6 | `BasicBlock`/`ILFunction`/`ILProgram`/`ConstDataEntry` (R12/R16/R64–R67)       | `packages/codegen/src/il/cfg.ts`                      |
| 1.1.7 | Verify spec tests PASS (green); impl tests (`ilTypeOfType` per variant incl. `ErrorType`) | `il/il-model.impl.test.ts`                  |

**Deliverables**: complete IL model; verification passing.
**Verify**: `yarn turbo run build typecheck lint test && yarn test`

### Session 1.2: Textual printer (`print-il`)

**Reference**: `03-03-textual-and-optimizer.md` Part A

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1.2.1 | Spec tests ST-P1..P5 (golden §4.7, determinism, type tags, offset, block order) | `packages/codegen/src/il/print-il.spec.test.ts` |
| 1.2.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 1.2.3 | `printIL` + `ilTypeTag` (R53–R55/§4.6)                                         | `packages/codegen/src/il/print-il.ts`                 |
| 1.2.4 | Verify spec tests PASS (green); impl tests (offset render, tag exhaustiveness, no-dest form) | `il/print-il.impl.test.ts`             |

**Verify**: canonical verify command.

---

## Phase 2: Lowering (gate/slice-2) + builder + optimizer

### Session 2.1: Builder + `lowerToIL` (gate/slice-2 surface)

**Reference**: `03-02-lowering.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.1.1 | `il/test-fixtures.ts` (gate, slice-2, §4.7, unsupported-node, error-carrying fixtures) | `packages/codegen/src/il/test-fixtures.ts`   |
| 2.1.2 | Spec tests ST-L1..L10 (lowering per node kind, ICE default, error-skip, empty-program, determinism, signature) | `il/lower.spec.test.ts` |
| 2.1.3 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.1.4 | `IlFunctionBuilder` (deterministic temps/labels; frozen output) (R15/R16)     | `packages/codegen/src/il/builder.ts`                  |
| 2.1.5 | `LowerInput` + `lowerToIL` + visitor + gate/slice-2 cases + ICE default (R29/R31/R42/R46/R68/R69) | `packages/codegen/src/il/lower.ts`     |
| 2.1.6 | Verify spec tests PASS (green); impl tests (nested Block, bare return, builder sequencing) | `il/lower.impl.test.ts`, `il/builder.impl.test.ts` |

**Verify**: canonical verify command.

### Session 2.2: Optimizer pipeline (passthrough)

**Reference**: `03-03-textual-and-optimizer.md` Part B

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.2.1 | Spec tests ST-O1..O5 (passthrough identity, pass sequencing, empty program, no diagnostics) | `il/optimizer/optimize-il.spec.test.ts` |
| 2.2.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.2.3 | `ILPass` interface (R56)                                                       | `packages/codegen/src/il/optimizer/pass.ts`           |
| 2.2.4 | `optimizeIL` pipeline runner — passthrough when `passes=[]` (R57/R61)          | `packages/codegen/src/il/optimizer/optimize-il.ts`    |
| 2.2.5 | Verify spec tests PASS (green)                                                | —                                                     |

**Verify**: canonical verify command.

---

## Phase 3: Barrel wiring, goldens & closeout

### Session 3.1: Wiring, golden snapshots, requirements annotation, closeout

**Reference**: `00-index.md`, `07-testing-strategy.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3.1.1 | `il/index.ts` + `il/optimizer/index.ts` barrels; wire into `packages/codegen/src/index.ts` | `il/index.ts`, `il/optimizer/index.ts`, `codegen/src/index.ts` |
| 3.1.2 | Golden snapshots for §4.7 / gate / slice-2 (`printIL`) (AC-18)                 | `il/print-il.golden.spec.test.ts` + `__snapshots__/`  |
| 3.1.3 | Confirm R15 boundary tier still green (codegen→frontend legal; frontend↛codegen) | `test/boundary.spec.test.ts`                       |
| 3.1.4 | Annotate `requirements/RD-06-il-optimizer.md` (slice-scope + live-wiring deferral note; "51"→50 node-kind note) | `requirements/RD-06-il-optimizer.md` |
| 3.1.5 | Tick AC-*/FR-* in `01-requirements.md`; set Index status to Implemented        | plan docs                                             |
| 3.1.6 | Final full verify; confirm `spec/` clean (`git status --porcelain spec/`)      | —                                                     |

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
> Commit mode is `--no-commit` (D7): never run git operations; the user commits.

### Phase 1: IL data model + textual printer
- [x] 1.1.1 Spec tests ST-M1..M11 ✅ (completed: 2026-06-05 11:07)
- [x] 1.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-05 11:08)
- [x] 1.1.3 `ILType` + constants + `ilTypeEquals` + `ilTypeOfType` ✅ (completed: 2026-06-05 11:08)
- [x] 1.1.4 `ILOperand` union + constructors + guards ✅ (completed: 2026-06-05 11:09)
- [x] 1.1.5 `ILInstruction`/`ILTerminator` unions + opcode tuples + `IntrinsicDescriptor` placeholder ✅ (completed: 2026-06-05 11:10)
- [x] 1.1.6 `BasicBlock`/`ILFunction`/`ILProgram`/`ConstDataEntry` ✅ (completed: 2026-06-05 11:10)
- [x] 1.1.7 Verify green; IL-model impl tests ✅ (completed: 2026-06-05 11:11)
- [x] 1.2.1 Spec tests ST-P1..P5 ✅ (completed: 2026-06-05 11:32)
- [x] 1.2.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-05 11:32)
- [x] 1.2.3 `printIL` + `ilTypeTag` ✅ (completed: 2026-06-05 11:33)
- [x] 1.2.4 Verify green; printer impl tests ✅ (completed: 2026-06-05 11:34)

### Phase 2: Lowering + builder + optimizer
- [x] 2.1.1 `il/test-fixtures.ts` ✅ (completed: 2026-06-05 14:37)
- [x] 2.1.2 Spec tests ST-L1..L10 ✅ (completed: 2026-06-05 14:38)
- [x] 2.1.3 Verify spec tests FAIL (red) ✅ (completed: 2026-06-05 14:38)
- [x] 2.1.4 `IlFunctionBuilder` ✅ (completed: 2026-06-05 14:39)
- [x] 2.1.5 `LowerInput` + `lowerToIL` + visitor + gate/slice-2 cases + ICE default ✅ (completed: 2026-06-05 14:42)
- [x] 2.1.6 Verify green; lowering + builder impl tests ✅ (completed: 2026-06-05 14:43)

- [x] 2.2.1 Spec tests ST-O1..O5 ✅ (completed: 2026-06-05 14:44)
- [x] 2.2.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-05 14:44)
- [x] 2.2.3 `ILPass` interface ✅ (completed: 2026-06-05 14:45)
- [x] 2.2.4 `optimizeIL` passthrough runner ✅ (completed: 2026-06-05 14:45)
- [x] 2.2.5 Verify green ✅ (completed: 2026-06-05 14:45)


### Phase 3: Wiring, goldens & closeout
- [x] 3.1.1 Barrels + wire `codegen/src/index.ts` ✅ (completed: 2026-06-05 14:46)
- [x] 3.1.2 Golden snapshots (§4.7 / gate / slice-2) ✅ (completed: 2026-06-05 14:47)
- [x] 3.1.3 Confirm R15 boundary tier green ✅ (completed: 2026-06-05 14:47)
- [x] 3.1.4 Annotate `requirements/RD-06-il-optimizer.md` ✅ (completed: 2026-06-05 14:48)
- [x] 3.1.5 Tick AC-*/FR-*; Index status → Implemented ✅ (completed: 2026-06-05 14:50)
- [x] 3.1.6 Final verify; `spec/` clean ✅ (completed: 2026-06-05 14:50)


---

## Session Protocol

### Starting a Session
1. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh start`
2. "Implement Phase X, Session X.X per `plans/rd-06-il-optimizer/99-execution-plan.md`"

### Ending a Session
1. Run the canonical verify command.
2. **No commit** (D7) — leave changes for the user.
3. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh finished`
4. `/compact`.

---

## Dependencies

```
Phase 1 (IL model → printer)
    ↓
Phase 2 (builder + lowering → optimizer)
    ↓
Phase 3 (wiring, goldens, closeout)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (canonical verify command)
3. ✅ No warnings/errors; R15 boundary tier green; `spec/` clean
4. ✅ No dead code — the full IL instruction set is intentional model surface (consumed by
   RD-07 + future passes); document any model member not yet emitted by v1 lowering as
   "model-complete, lowering-deferred" rather than removing it
5. ✅ Security N/A (compiler-internal passes; no external input)
6. ✅ All ST-* pass; golden snapshots committed; AC-*/FR-* ticked
7. ✅ **Post-completion:** ask the user to re-analyze the project and update `.clinerules/project.md`
