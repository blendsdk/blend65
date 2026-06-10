# Execution Plan: RD-07a Instr Model, CPU Table & Canonical Serializer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-06 22:40
> **Progress**: 16/16 tasks (100%) — ✅ COMPLETE

> **CodeOps Version**: (unstamped — consistent with RD-01..RD-06/RD-11a)
> **Commit mode**: `--no-commit` (D7) — agent makes NO git operations; user handles all commits.

## Overview

Implements **RD-07a** — the stable, zero-throwaway third of RD-07 (D1): the `Instr` model
(R1–R13), the full NMOS-6502 CPU validation table + validator (R14–R16), and the canonical
ACME serializer (R52–R54). Takes only a `cpuVariant` primitive (D2) — no fabricated
`PlatformProfile`. All artifacts live in `@blend65/codegen/src/instr/` (a sibling to `il/`,
D5). The consumer-coupled remainder (translation, register binding, hooks, `generateInstr`)
is **RD-07b**.

Each feature follows **spec-tests-first** ordering (write spec tests → verify red →
implement → verify green → impl tests). All decisions trace to `00-ambiguity-register.md`
(D1–D9).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                   | Sessions | Est. Time |
| ----- | --------------------------------------- | -------- | --------- |
| 1     | Instr model (opcode/mode/operand/stream) | 1        | 1.5–2 h   |
| 2     | CPU table + validator                    | 1        | 1.5–2 h   |
| 3     | Canonical serializer + byte sizing       | 1        | 1.5–2 h   |
| 4     | Barrel wiring, goldens & closeout        | 1        | 45 min    |

**Total: ~4 sessions, ~5–6 hours**

---

## Phase 1: Instr model

### Session 1.1: `opcode` / `addressing-mode` / `operand` / `stream`

**Reference**: `03-01-instr-model.md`
**Objective**: Ship the complete typed 6502 instruction model the validator + serializer + RD-07b consume.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1.1.1 | Spec tests ST-M1..M12 (opcode/mode tuples, operand constructors/guards, stream entries) | `packages/codegen/src/instr/instr-model.spec.test.ts` |
| 1.1.2 | Verify spec tests FAIL (red — via typecheck; symbols absent)                  | —                                                     |
| 1.1.3 | `OPCODES`/`NMOS_OPCODES`/`W65C02_OPCODES` + `Opcode` (R3); `ADDRESSING_MODES` + `AddressingMode` (R4) | `instr/opcode.ts`, `instr/addressing-mode.ts` |
| 1.1.4 | `InstrOperand` union + `none`/`imm8`/`symbolRef`/`labelRef`/`zpSlot` + guards (R8–R13) | `instr/operand.ts`                            |
| 1.1.5 | `CpuVariant`, `AcmeDirective`, `StreamEntry`, `InstrStream` + `instr`/`label`/`directive` + guards (R2/R5–R7) | `instr/stream.ts`            |
| 1.1.6 | Verify spec tests PASS (green); impl tests (offset/sourceSpan omission, guard totality, tuple uniqueness) | `instr/instr-model.impl.test.ts` |

**Deliverables**: complete Instr model; verification passing.
**Verify**: canonical verify command.

---

## Phase 2: CPU table + validator

### Session 2.1: `cpu-table` + `validate`

**Reference**: `03-02-cpu-table-and-validation.md`
**Objective**: Full NMOS-6502 legality table (65C02 gated) + the ICE-raising validator.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.1.1 | Spec tests ST-V1..V10 (legal/illegal pairs, variant gating incl. 65C02 `(zp)`, ICE code/message, span, `isLegalMode`) | `packages/codegen/src/instr/validate.spec.test.ts` |
| 2.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.1.3 | `CpuTable`, `NMOS_6502_TABLE` (full 56-opcode table), `W65C02_TABLE` (gated superset), `cpuTableFor` (R3/R14/R16) | `instr/cpu-table.ts`        |
| 2.1.4 | `isLegalMode` + `validateStream` (ICE via `IceCode.Unexpected`, R15/R61, D6)  | `instr/validate.ts`                                   |
| 2.1.5 | Verify spec tests PASS (green); impl tests (non-empty mode sets, full-grid totality, 65C02 ⊇ NMOS) | `instr/validate.impl.test.ts`        |

**Verify**: canonical verify command.

---

## Phase 3: Canonical serializer + byte sizing

### Session 3.1: `print-instr`

**Reference**: `03-03-serializer.md`
**Objective**: The single deterministic ACME serializer (reused by RD-09) + `instrByteSize`.

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3.1.1 | Spec tests ST-S1..S23 (incl. ST-S12b/S22b; every mode/operand/directive render, determinism, byte sizes) | `packages/codegen/src/instr/print-instr.spec.test.ts` |
| 3.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 3.1.3 | `printInstr` (operand-text + entry rendering, ACME syntax, exhaustive `never`) + `instrByteSize` (R52–R54/R58) | `instr/print-instr.ts`       |
| 3.1.4 | Verify spec tests PASS (green); impl tests (empty stream, labels/directives-only, exhaustiveness) | `instr/print-instr.impl.test.ts`  |

**Verify**: canonical verify command.

---

## Phase 4: Barrel wiring, goldens & closeout

### Session 4.1: Wiring, golden snapshots, requirements annotation, closeout

**Reference**: `00-index.md`, `07-testing-strategy.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 4.1.1 | `instr/test-fixtures.ts` (add8 / ptrSetup / palette / illegalJsr / stz streams; NOT barrel-exported) | `instr/test-fixtures.ts`         |
| 4.1.2 | `instr/index.ts` barrel; wire into `packages/codegen/src/index.ts`            | `instr/index.ts`, `codegen/src/index.ts`              |
| 4.1.3 | Golden snapshots ST-G1..G3 (`printInstr` of the three canonical streams) (AC-18) | `instr/print-instr.golden.spec.test.ts` + `__snapshots__/` |
| 4.1.4 | Confirm R15 boundary tier still green (frontend/language-server ↛ codegen)     | `test/boundary.spec.test.ts`                          |
| 4.1.5 | Annotate `requirements/RD-07-codegen-instr.md` (07a/07b split banner — D1)     | `requirements/RD-07-codegen-instr.md`                 |
| 4.1.6 | Tick AC-*/FR-* in `01-requirements.md`; set Index status to Implemented; final full verify; `spec/` clean | plan docs |

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

### Phase 1: Instr model
- [x] 1.1.1 Spec tests ST-M1..M12 ✅ (completed: 2026-06-06 22:02)
- [x] 1.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-06 22:03)
- [x] 1.1.3 `opcode.ts` + `addressing-mode.ts` (tuples + types) ✅ (completed: 2026-06-06 22:03)
- [x] 1.1.4 `operand.ts` (union + constructors + guards) ✅ (completed: 2026-06-06 22:04)
- [x] 1.1.5 `stream.ts` (`CpuVariant`/`AcmeDirective`/`StreamEntry`/`InstrStream` + constructors + guards) ✅ (completed: 2026-06-06 22:05)
- [x] 1.1.6 Verify green; model impl tests ✅ (completed: 2026-06-06 22:07)

### Phase 2: CPU table + validator
- [x] 2.1.1 Spec tests ST-V1..V10 ✅ (completed: 2026-06-06 22:08)
- [x] 2.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-06 22:08)
- [x] 2.1.3 `cpu-table.ts` (NMOS table + gated 65C02 superset + `cpuTableFor`) ✅ (completed: 2026-06-06 22:09)
- [x] 2.1.4 `validate.ts` (`isLegalMode` + `validateStream` ICE) ✅ (completed: 2026-06-06 22:09)
- [x] 2.1.5 Verify green; validator impl tests ✅ (completed: 2026-06-06 22:11)

### Phase 3: Canonical serializer + byte sizing
- [x] 3.1.1 Spec tests ST-S1..S23 (incl. ST-S12b/S22b) ✅ (completed: 2026-06-06 22:12)
- [x] 3.1.2 Verify spec tests FAIL (red) ✅ (completed: 2026-06-06 22:13)
- [x] 3.1.3 `print-instr.ts` (`printInstr` + `instrByteSize`) ✅ (completed: 2026-06-06 22:14)
- [x] 3.1.4 Verify green; serializer impl tests ✅ (completed: 2026-06-06 22:14)

### Phase 4: Wiring, goldens & closeout
- [x] 4.1.1 `instr/test-fixtures.ts` ✅ (completed: 2026-06-06 22:15)
- [x] 4.1.2 `instr/index.ts` barrel + wire `codegen/src/index.ts` ✅ (completed: 2026-06-06 22:16)
- [x] 4.1.3 Golden snapshots ST-G1..G3 ✅ (completed: 2026-06-06 22:17)
- [x] 4.1.4 Confirm R15 boundary tier green ✅ (completed: 2026-06-06 22:18)
- [x] 4.1.5 Annotate `requirements/RD-07-codegen-instr.md` (07a/07b split) ✅ (completed: 2026-06-06 22:18)
- [x] 4.1.6 Tick AC-*/FR-*; Index → Implemented; final verify; `spec/` clean ✅ (completed: 2026-06-06 22:39)

---

## Session Protocol

### Starting a Session
1. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh start`
2. "Implement Phase X, Session X.X per `plans/rd-07a-instr-model/99-execution-plan.md`"

### Ending a Session
1. Run the canonical verify command.
2. **No commit** (D7) — leave changes for the user.
3. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh finished`
4. `/compact`.

---

## Dependencies

```
Phase 1 (model: opcode/mode/operand/stream)
    ↓
Phase 2 (cpu-table + validator)        Phase 3 (serializer) — both depend on Phase 1 only;
    ↓                                   may run in either order (independent of each other)
Phase 4 (fixtures, barrel, goldens, closeout — depends on 1+2+3)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (canonical verify command)
3. ✅ No warnings/errors; R15 boundary tier green; `spec/` clean
4. ✅ No dead code — the full Instr model + CPU table is intentional model surface
   (consumed by RD-07b/RD-08/RD-09); document any member not yet exercised by 07a as
   "model-complete, consumer in RD-07b" rather than removing it
5. ✅ Security N/A (compiler-internal data model + pure functions; no external input)
6. ✅ All ST-* pass; golden snapshots committed; AC-*/FR-* ticked
7. ✅ **Post-completion:** ask the user to re-analyze the project and update
   `.clinerules/project.md`, then proceed to author the **RD-07b** plan
