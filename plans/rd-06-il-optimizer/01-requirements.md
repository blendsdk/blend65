# Requirements: RD-06 IL & IL Optimizer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-il-optimizer.md) · frozen spec Ch 02–06, 08–09, 11–13, 14

## Feature Overview

Implement the Blend65 **Intermediate Language (IL)** — the target-independent, explicitly
typed, flat three-address-code (TAC) over basic-block control-flow graphs that sits between
the validated AST+`SemanticModel` (RD-04) + `AllocationPlan` (RD-05) and 6502 codegen
(RD-07). Deliver three artifacts:

1. **The complete IL data model** — types, operands, instructions, terminators, CFG records,
   `ILProgram` (built fully; low-churn substrate).
2. **The deterministic textual form** — `printIL` / `--emit-il`, the golden-snapshot surface.
3. **The optimizer pass pipeline** — `ILPass` + `optimizeIL`, **passthrough in v1**.

…plus **AST→IL lowering for the gate + slice-2 surface** behind an extensible typed visitor
seam (register D1/D5). All artifacts live in `@blend65/codegen`.

## Functional Requirements

### Must Have (this plan)

- [x] **IL type model** — `ILType { width: 8|16, signed }`; the Blend65→IL type mapping
      (byte/boolean/enum→`IL_BYTE`, sbyte→`IL_SBYTE`, word/struct-ptr/array-ptr→`IL_WORD`,
      sword→`IL_SWORD`) and the four convenience constants (R3, R5, R6, §4.1).
- [x] **IL operand union** — `Immediate` / `Temp` / `Location(symbol, offset?)` (R7–R11, §4.2).
- [x] **IL instruction set** — arithmetic (`add`/`sub`/`mul`/`div`/`mod`/`neg`), bitwise
      (`and`/`or`/`xor`/`not`/`shl`/`shr`), comparison (`eq`/`ne`/`lt`/`le`/`gt`/`ge`),
      conversion (`zext`/`sext`/`trunc`), memory (`load`/`store`/`load_indexed`/
      `store_indexed`/`load_indirect`/`store_indirect`), `copy`, `call`/`intrinsic`,
      `source_span` (R17–R28, §4.3). *Defined as data; only the gate/slice-2 subset is
      emitted by v1 lowering.*
- [x] **IL terminators** — `br` / `brcond` / `ret` / `unreachable` (R13, §4.3).
- [x] **CFG records** — `BasicBlock` (label + instructions + terminator), `ILFunction`
      (name, params, returnType, blocks[0]=entry, tempCount, isInterrupt), `ILProgram`
      (functions, initCode, constData, allocationPlan), `ConstDataEntry` (R12, R15, R16,
      R64–R67, §4.4–§4.5).
- [x] **Deterministic textual form** — `printIL`: one instruction per line, temps `%N`,
      types `i8u`/`i8s`/`i16u`/`i16s`, labels `_LN:`, locations by symbol; same input →
      identical output, character-for-character (R53–R55, §4.6).
- [x] **AST→IL lowering (gate/slice-2 surface)** — `lowerToIL(input, bag)`:
      - variable declaration with initializer → evaluate + `store` (R29);

      - variable declaration without initializer → no IL (R30);
      - assignment → evaluate RHS + `store` (R31);
      - numeric literal / `const` materialization → `Immediate` / `const` temp (R28, R45);
      - simple binary arithmetic on same-width operands → binary op (R18, R33);
      - `poke(addr, val)` → IL `store`; `peek(addr)` → IL `load` (R46, AR-49);
      - `return expr;` / `return;` → `ret(value?)` (R42).
- [x] **Extensible lowering visitor** — a typed dispatch over AST node kinds whose default
      arm raises an ICE (`IceCode.Unexpected`, E90001) for any node kind not yet supported
      (R69); each future slice adds one lowering case additively.
- [x] **Optimizer pipeline (passthrough)** — `ILPass { name, run(program, bag) }` and
      `optimizeIL(program, passes, bag)` applying `passes` in sequence; v1 ships with
      `passes = []` so the IL passes through unchanged (R56, R57, §4.11).
- [x] **Determinism** — every artifact (lowering output, textual form, optimizer output)
      is deterministic: same input → same output (R53, R61, H5).
- [x] **Error tolerance** — lowering skips functions with semantic-error/`ErrorType` nodes
      (R68); lowering never emits user diagnostics, only ICEs (R69); never throws.
- [x] **`ILProgram` carries the `AllocationPlan` reference** for downstream codegen (R66).
- [x] **Public API** — `lowerToIL(input: LowerInput, bag)` (D4) + `printIL(program)` +
      `optimizeIL(...)` exported from `@blend65/codegen` (R: §4.12, AC-01).

### Should Have

- [x] **Builder helpers** — a small CFG/temp builder (`il/builder.ts`) so lowering and
      tests construct blocks/temps/operands without hand-writing record literals (internal;
      keeps lowering readable and golden tests authorable).
- [x] **Golden IL snapshots** — for the RD-06 §4.7 simple-function example (and the gate
      `poke` program), asserting the `printIL` text (AC-13, AC-18, AR-22 tier 2).


### Won't Have (Out of Scope — deferred)

- Lowering for control flow (`if`/`else`/`while`/`do`/`for`/`switch`), short-circuit
  `&&`/`||`, `?:`, struct/array access, function calls, struct literals, the wider
  intrinsic set, full type-promotion materialization (R32–R52) — **added per future slice
  alongside RD-07 codegen** (D1).
- Optimizer **passes**: constant folding, DCE, strength reduction (R58–R60) — architected,
  not implemented (D1; v1 passthrough).
- **W10130** unreachable-code analysis (R59/R70) — deferred with the DCE pass (D2).
- **Live façade wiring** of a populated `SemanticModel` into `lowerToIL` — deferred until
  RD-04b (D5). Under today's passthrough an end-to-end call yields an empty `ILProgram`.
- 6502 instruction selection / register binding (IL→`Instr`) — RD-07.
- `--emit-il` CLI **flag wiring** — RD-15 (the `printIL` function exists here; the CLI flag
  is plumbed by the CLI RD). This plan delivers and tests `printIL` directly.

## Technical Requirements

### Performance

- Lowering and printing are linear in IL size; no superlinear passes. C64-scale programs
  lower in milliseconds (consistent with AR-41).

### Compatibility

- ESM/NodeNext, TS strict, Node 22; consumes `@blend65/core` (`Diagnostic`/`DiagnosticBag`,
  `Type`, `SemanticModel`, `AllocationPlan`) and `@blend65/frontend` AST types per existing
  package edges. **Honors R15/AR-20**: `@blend65/codegen` may depend on core+frontend, but
  frontend/language-server must never import codegen (already enforced by
  `test/boundary.spec.test.ts`).

### Security

- N/A — compiler-internal passes; no external/user input beyond already-validated AST.

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Build strategy | full lowering / walking-skeleton slice / pure passthrough | walking-skeleton slice | optimizer needs IL model not lowering breadth; lowering couples to absent RD-04b/RD-07 | D1 |
| W10130 timing | emit now / defer | defer | detection == the DCE pass's own walk; ownership shared with RD-04b Pass-4 | D2 |
| Module layout | `il/`+`il/optimizer/` / flat / split dirs | `il/` + `il/optimizer/` | domain-named, mirrors RD-05 `sfa/` | D3 |
| Entry signature | `LowerInput` object / positional | `LowerInput` object | matches `parse`/`analyze`/`planAllocation` convention | D4 |
| Deferred seam | fixture-tested / defer all | fixture-tested; defer only live wiring | lowering is testable against fixtures today | D5 |
| Diagnostic codes | reuse ICE / add new | reuse `IceCode.Unexpected` | v1 emits no user codes; ICE suffices for visitor default | D6 |
| Commit mode | ask / no-commit / auto | no-commit | consistent with prior RDs | D7 |

> **Traceability:** Every scope decision references the Ambiguity Register (`00-ambiguity-register.md`).

## Acceptance Criteria

Mapped from RD-06 §6. **In-scope** criteria are satisfied by this plan; **deferred** ones
are satisfied by the IL model existing + the gate/slice-2 lowering + the architected seam,
with the wider surface added per slice.

1. [x] **AC-01** — `lowerToIL` accepts input (a `LowerInput` carrying `SemanticModel` +
   `AllocationPlan` + `ProgramNode[]`, D4) and returns an `ILProgram`.
2. [x] **AC-03** — all IL instructions carry explicit `ILType` annotations (model-level).
3. [x] **AC-11** (gate subset) — `poke`/`peek` lower to IL `store`/`load`.
4. [x] **AC-13** — `printIL` produces deterministic textual output (same input → same text).
5. [x] **AC-14** — `optimizeIL` accepts passes and runs them in sequence (v1 = passthrough).
6. [x] **AC-15** — functions with semantic errors are skipped during lowering (R68).
7. [x] **AC-16** — the `ILProgram` carries the `AllocationPlan` reference (R66).
8. [x] **AC-17** (gate/slice-2 subset) — unit tests cover lowering for the supported
   constructs (var decl/assign, literal, simple arithmetic, poke/peek, return).
9. [x] **AC-18** — golden-snapshot tests assert `printIL` output for representative programs.
10. [x] **AC-19** — all decisions trace to an `AR-NN`/`D-N` or a frozen spec section.
11. [x] **Deferred AC ledger** — AC-02/04/05/06/07/08/09/10/12 (full lowering surface)
   recorded as deferred-per-slice with their owning requirement, in `02-current-state.md`.
12. [x] All verification passing; R15 boundary tier green; `spec/` porcelain clean.

