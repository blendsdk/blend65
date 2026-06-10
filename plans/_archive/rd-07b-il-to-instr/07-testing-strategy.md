# Testing Strategy: RD-07b IL→Instr Translation, Register Binding & `generateInstr`

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

RD-07b is a **deterministic translation** layer: real IL (RD-06 model) → validated `Instr`
streams (RD-07a model) → ACME text (RD-07a `printInstr`). There is no external/user input, so
the testing focus is **specification conformance** (each live IL op produces the spec'd 6502
sequence), **register-binding correctness** (temps land in the right registers/ZP, redundant
loads suppressed, deterministic spills), and **determinism** (golden snapshots). All tests run
under Vitest in `@blend65/codegen`.

### Coverage Goals

- Core translation/binding/program logic: 90%+ (code.md §2).
- Every **live** IL op (`load`/`store`/`const`, arithmetic/bitwise/shift/comparison binary,
  `ret`) exercised at the relevant widths.
- Every **deferred** op's ICE default arm exercised (proving the boundary is total).
- Golden ACME-text snapshots from real RD-06 lowering fixtures (AR-22 tier 2 / RD-07 AC-18).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived **exclusively** from `requirements/RD-07-codegen-instr.md` (R17–R45, R50–R61), the
> component specs (03-01..03-03), and the Ambiguity Register (D1–D8). These are **immutable
> oracles** — if the implementation disagrees, the implementation is wrong (testing.md Rule
> 10). Expected ACME text is derived from RD-07 §4 + ACME syntax, **not** from running the
> translator.

### Component 1 — IL→Instr translation (`instr/translate.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-T1 | `load t0,[sym]` (byte) | `LDA sym` | R27 / FR-9 |
| ST-T2 | `store v,[sym]` (byte, v in A) | `STA sym` | R28 / FR-10 |
| ST-T3 | `load t0,[sym]` (word) | `LDA sym` + `LDX sym+1` | R27 / FR-9 / D5 |
| ST-T4 | `store v,[sym]` (word) | `STA sym` + `STX sym+1` | R28 / FR-10 / D5 |
| ST-T5 | `const t0, imm(0x42:byte)` | `LDA #$42` | R28 / FR-11 |
| ST-T6 | `const t0, imm(0x0801:word)` | `LDA #<...` + `LDX #>...` (lo/hi byte-select) | R28 / FR-11 / D5 |
| ST-T7 | `add t2,t0,t1` (byte) | `LDA t0; CLC; ADC t1; STA t2`-shape (operands resolved) | R18 / FR-2 |
| ST-T8 | `sub t2,t0,t1` (byte) | `LDA …; SEC; SBC …; STA …` | R20 / FR-2 |
| ST-T9 | `add t2,t0,t1` (word) | lo `CLC/ADC` then hi `ADC` (no second CLC) | R19 / FR-3 |
| ST-T10 | `and/or/xor t2,t0,t1` (byte) | `LDA …; AND/ORA/EOR …; STA …` | R19 / FR-4 |
| ST-T11 | `shl t1,t0,imm(2)` (const count) | two `ASL` | R19 / FR-5 |
| ST-T12 | `shl t1,t0,temp` (non-const count) | `E90001` ICE (deferred to RD-07c) | FR-5 / D3 |
| ST-T13 | `eq t2,t0,t1` | `CMP`-based 0/1 materialization into `t2` (BEQ form) | R23 / FR-6 |
| ST-T14 | `lt t2,t0,t1` (unsigned) | `CMP`-based, `BCC` form | R23 / FR-6 |
| ST-T15 | `mul t2,imm(3),imm(4)` (both const) | folded to `const` `LDA #$0C`-shape; no `JSR`; no warning | R21 / FR-7 |
| ST-T16 | `mul t2,t0,imm(8)` (pow2) | three `ASL`; **W10172** emitted | R21 / FR-7 |
| ST-T17 | `mul t2,t0,t1` (runtime) | `JSR __rt_mul8`; **W10170** emitted | R21 / FR-7 |
| ST-T18 | `div t2,t0,t1` | `JSR __rt_div8`; **W10171** emitted | R22 / FR-8 |
| ST-T19 | `mod t2,t0,t1` | `JSR __rt_div8` (remainder return); **W10171** | R22 / FR-8 |
| ST-T20 | `ret` (void) | `RTS` | R32 / FR-12 |
| ST-T21 | `ret v` (byte) | `LDA v` + `RTS` | R32 / FR-12 |
| ST-T22 | `ret v` (word) | `LDA v_lo` + `LDX v_hi` + `RTS` | R32 / FR-12 / D5 |
| ST-T23 | `ret v` in an `isInterrupt` function | terminator is `RTI`, not `RTS` | R33 / FR-12 |
| ST-T24 | each deferred op (`neg`,`not`,`copy`,`call`,`intrinsic`,`load_indexed`,`load_indirect`,…) | `E90001` ICE; no entries emitted | D3 / FR-1 |
| ST-T25 | a translated IL instruction carrying a `SourceSpan` | the lead `Instr` has that `sourceSpan`; following instrs omit it | R50/R51 / FR-24 |

### Component 2 — Register binding (`instr/register-binding.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-R1 | `ensureInA(t)` when A already holds `t` | no `LDA` emitted (redundant-load suppression) | R44 / FR-16 |
| ST-R2 | `ensureInA(t)` when A holds another temp | `LDA <loc of t>` emitted; `state.a = t` | R44 |
| ST-R3 | `bindResultToA(t)` | `state.a = t.id`; `locationOf(t)` ⇒ A | R41 |
| ST-R4 | word value: lo→A, hi→X | `locationOf` hi ⇒ X; `LDX`/`STX` used | R42 / FR-14 |
| ST-R5 | spill under pressure | `STA __zp_tmp_0`; temp's location becomes that zpSlot | R43 / FR-15 |
| ST-R6 | spill picks LRU with deterministic tie-break (lowest id) | same fixture → same spill choice | R43 / determinism |
| ST-R7 | spill demand exceeds plan's `temp` ZP runs | `E90001` ICE (contract violation), no silent corruption | D7 / H5 |
| ST-R8 | `reset()` | all of A/X/Y become null; next `ensureInA` reloads | R45 / FR-17 |

### Component 3 — `InstrProgram` & `generateInstr` (`instr/instr-program.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-P1 | `generateInstr(ilProgram, "nmos6502", bag)` over a 1-function IL | `InstrProgram` with one `InstrStream`; `preamble === []`; `allocationPlan === ilProgram.allocationPlan` | R55/R57 / FR-18/FR-20 |
| ST-P2 | IL with a function that has no blocks/instructions | that function yields **no** stream; others still translated | R59 / FR-21 |
| ST-P3 | translation that (synthetically) emits an illegal opcode+mode | `generateInstr` raises `E90001` via `validateStream` | R61 / FR-22 |
| ST-P4 | `generateInstr` called twice on the same IL | byte-identical `printInstr` of every stream (determinism) | R17 / AC-06 |
| ST-P5 | `streams` order | matches `ilProgram.functions` order | R17 |
| ST-P6 | `programByteSize(program)` | Σ `instrByteSize` over all stream entries | R58 / Ch 11 §6 |
| ST-P7 | a clean live program | `bag.hasErrors() === false` (no spurious ICEs/warnings) | R59/R61 |

### Golden snapshots (AR-22 tier 2)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|-----------------|---------------------------|--------|
| ST-G1 | `generateInstr` → `printInstr` of an 8-bit add function (RD-06 lowering fixture for `r = a + b`) | snapshot: `M.f:` + `LDA a / CLC / ADC b / STA r / RTS` | AC-18 / 03-01 example |
| ST-G2 | a `let`/assign function (`let x = 5; poke($D020, x)`) | snapshot: `LDA #$05 / STA … / LDA … / STA $D020 / RTS` | AC-18 / FR-10/FR-11 |
| ST-G3 | a comparison-returning function (`return a == b`) | snapshot: `CMP`-based 0/1 materialization + `RTS` | AC-18 / FR-6 |

> **⚠️ AUTHORING RULE:** ST-T*/ST-R*/ST-P*/ST-G* expected text is derived from RD-07 §4 + the
> component specs + ACME syntax, NOT from running the translator. If an expectation cannot be
> determined from the spec, it is an ambiguity → add to the register (surface-during-authoring
> rule). In particular, the exact `__rt_*` arg-marshalling shape (ST-T17/18/19) must be pinned
> from RD-17 AR-33; if under-specified at execution time, STOP and register a runtime D-N.

## Test Categories

### Specification Tests (from ST-cases above)

> Written BEFORE implementation. `describe('Specification: …')`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `instr/translate.spec.test.ts` | ST-T1..T25 | Translator |
| `instr/register-binding.spec.test.ts` | ST-R1..R8 | Binder |
| `instr/instr-program.spec.test.ts` | ST-P1..P7 | Program / entry point |
| `instr/generate.golden.spec.test.ts` | ST-G1..G3 | End-to-end goldens |

### Implementation Tests (edge cases, internals)

> Written AFTER implementation. `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `instr/translate.impl.test.ts` | operand-lowering edge cases; 16-bit carry-chain correctness; `gt`/`le` swapped-operand forms; lead-span threading reset | High |
| `instr/register-binding.impl.test.ts` | high-pressure spill sequences; LRU tie-break totality; reset idempotence | High |
| `instr/instr-program.impl.test.ts` | empty IL program → empty `streams`; multi-function ordering; `programByteSize` over mixed entries | Med |

### Integration / E2E

- **E2E for 07b** (the slice anchor): drive a **real RD-06 lowering fixture** through
  `generateInstr` → `printInstr` and assert exact ACME text (ST-G1..G3). This is the
  "IL → translate → bind → validate → serialize" pipeline that proves the slice runs, not just
  compiles.

## Test Data

### Fixtures Needed

- **Reuse RD-06's lowering fixtures** for ST-G1..G3 (real IL built by `lowerToIL` over a
  fixture AST/model/plan — see RD-06 `il/test-fixtures.ts`), so the golden inputs are genuine
  IL, not hand-faked. Hand-built `ILFunction`/`BasicBlock` literals are used for the focused
  per-op translator ST-T cases (smaller, targeted).
- A small synthesized `AllocationPlan` with a couple of `category: "temp"` ZP runs for the
  spill ST-R cases.

### Mock Requirements

- None — uses the **real** `createDiagnosticBag()` (code.md §29: prefer real objects) and the
  **real** RD-07a `validateStream`/`printInstr`. The IL model and `AllocationPlan` are real
  in-package records, not mocks.

## Verification Checklist

- [ ] All ST-* defined with concrete input/output pairs (above)
- [ ] Every ST case traces to an R/AC/AR source (column filled)
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases and internals
- [ ] Golden snapshots committed (ST-G1..G3)
- [ ] No regressions; R15 boundary tier green; `spec/` clean
- [ ] Coverage meets goals; deferred-op arms documented (not dead code)
