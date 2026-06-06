# Testing Strategy: RD-06 IL & IL Optimizer

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- **Unit tests** — every IL model record (construction + guards), the type mapping, the
  lowering of each supported node kind, the ICE default, `printIL` determinism, and the
  `optimizeIL` passthrough/sequencing.
- **Golden-snapshot tests** (AR-22 tier 2) — `printIL` output for the §4.7 `add`, the gate
  program, and the slice-2 program.
- No emulator tier (RD-06 is pre-codegen; emulator/golden-binary tiers arrive with RD-12).

### Test file conventions

Per project rules: spec tests `*.spec.test.ts` (written first, from the ST-cases below);
implementation tests `*.impl.test.ts` (edge cases, written after). All under
`packages/codegen/src/il/` and `packages/codegen/src/il/optimizer/`.

## 🚨 Specification Test Cases (MANDATORY)

> Derived exclusively from `01-requirements.md`, the component specs (`03-01`/`03-02`/`03-03`),
> RD-06, and the Ambiguity Register. The implementation must match these — not vice versa
> (immutable-oracle rule).

### IL Data Model (`03-01`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-M1 | `ilTypeOfType(PrimitiveType "byte")` | `IL_BYTE` (`{8,false}`) | R3/§4.1 |
| ST-M2 | `ilTypeOfType(PrimitiveType "sbyte")` | `IL_SBYTE` (`{8,true}`) | §4.1 |
| ST-M3 | `ilTypeOfType(PrimitiveType "word")` | `IL_WORD` (`{16,false}`) | §4.1 |
| ST-M4 | `ilTypeOfType(PrimitiveType "sword")` | `IL_SWORD` (`{16,true}`) | §4.1 |
| ST-M5 | `ilTypeOfType(PrimitiveType "boolean")` | `IL_BYTE` (boolean erased) | R5/§4.1 |
| ST-M6 | `ilTypeOfType(EnumType ...)` | `IL_BYTE` (enum identity erased) | R6/§4.1 |
| ST-M7 | `ilTypeOfType(StructType / ArrayType)` (by-ref) | `IL_WORD` (16-bit base address) | §4.1 |
| ST-M8 | `imm(42, IL_BYTE)` / `temp(0, IL_WORD)` / `loc("__var_x", IL_WORD)` | correct discriminated operands; guards classify each | R7–R11 |
| ST-M9 | construct one of each `ILInstruction` family + each `ILTerminator` | well-typed records; `op`/`kind` discriminants present | R17–R28 |
| ST-M10 | build an `ILProgram` carrying an `AllocationPlan` | `program.allocationPlan` is the passed plan | R66 |
| ST-M11 | `ilTypeEquals(IL_BYTE, IL_BYTE)` vs `(IL_BYTE, IL_WORD)` | `true` / `false` | R3 |

### AST→IL Lowering (`03-02`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-L1 | gate fixture (`poke(0xD020, 5)`) → `lowerToIL` → `printIL` | matches the gate golden (`store 5, $D020` + `ret`) | R46/AC-11 |
| ST-L2 | slice-2 fixture (`let c: byte = 5; poke(0xD020, c)`) | matches the slice-2 golden (`const`/`store`/`load`/`store`/`ret`) | R29/R46 |
| ST-L3 | §4.7 fixture (`add(a,b){ return a+b; }`) | matches the §4.7 golden (`load`/`load`/`add`/`ret %2`) | R18/R33/R42/§4.7 |
| ST-L4 | `LetDecl` without initializer | no IL instruction emitted for it | R30 |
| ST-L5 | function whose body contains an unsupported node (e.g. `IfStmt`) | exactly one `E90001` ICE recorded; never throws | R69/D6 |
| ST-L6 | function carrying an `ErrorType` (per fixture model) | function skipped — absent from `ILProgram.functions` | R68 |
| ST-L7 | empty `program` (live-passthrough analog) | `ILProgram` with `functions: []`, `initCode: []`, `constData: []` | D5 |
| ST-L8 | `BinaryExpr` left/right are calls-with-side-effect fixtures | left lowered before right (instruction order) | R33/FN-10 |
| ST-L9 | lower the same fixture twice | identical `printIL` text (determinism) | R53/R61 |
| ST-L10 | `lowerToIL` return type / signature | accepts `LowerInput {program,model,plan}`, returns `ILProgram` | AC-01/D4 |

### Textual Form (`03-03` Part A)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-P1 | `printIL` of the §4.7 program | byte-exact golden snapshot | R53–R55/§4.7 |
| ST-P2 | `printIL` twice on same program | identical strings | R53/H5 |
| ST-P3 | type tags for the four `ILType`s | `i8u`/`i8s`/`i16u`/`i16s` | §4.6 |
| ST-P4 | `Location` with `offset` (e.g. `s`,2) | renders `s+2` | §4.2/§4.6 |
| ST-P5 | multi-block function (builder-constructed) | blocks printed entry-first, in order | R16/§4.6 |

### Optimizer Pipeline (`03-03` Part B)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-O1 | `optimizeIL(p, [], bag)` | returns `p` unchanged; `printIL` identical | R57/AC-14 |
| ST-O2 | `optimizeIL(p, [identityPass], bag)` | returns text-identical program; pass `run` was invoked | R56/AC-14 |
| ST-O3 | `optimizeIL(p, [tagA, tagB], bag)` | passes run in array order (tagA before tagB) | R56/§4.11 |
| ST-O4 | `optimizeIL(emptyProgram, [], bag)` | empty program passes through | R57 |
| ST-O5 | passthrough emits no diagnostics | `bag` unchanged (no W10130 in v1) | D2/R57 |

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `il/il-model.spec.test.ts` | ST-M1..M11 | IL data model |
| `il/lower.spec.test.ts` | ST-L1..L10 | AST→IL lowering |
| `il/print-il.spec.test.ts` | ST-P1..P5 | textual form |
| `il/print-il.golden.spec.test.ts` | ST-L1/L2/L3, ST-P1 (+ `__snapshots__/`) | golden IL |
| `il/optimizer/optimize-il.spec.test.ts` | ST-O1..O5 | optimizer pipeline |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `il/il-model.impl.test.ts` | `ilTypeEquals`/`ilTypeOfType` per-variant incl. `ErrorType` default | High |
| `il/builder.impl.test.ts` | temp id + label sequencing; frozen output; `tempCount` | High |
| `il/lower.impl.test.ts` | nested `Block`; bare `return` → `ret()`; ICE default for an unsupported statement | High |
| `il/print-il.impl.test.ts` | `sym+offset` rendering; `ilTypeTag` exhaustiveness; no-dest instruction form | Med |

### Integration / Boundary Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `test/boundary.spec.test.ts` (existing) | frontend/codegen | Confirm R15 still green — codegen MAY import frontend; frontend MUST NOT import codegen. RD-06 adds codegen→core/frontend imports only |

## Test Data

### Fixtures Needed (`il/test-fixtures.ts`, not barrel-exported)

- Gate program AST + minimal `SemanticModel` + `AllocationPlan` (no frame slots).
- Slice-2 program AST + model (one local `byte c`) + plan (one frame slot
  `__frame_Main_main_c`).
- §4.7 `add(a,b)` AST + model (two params) + plan (`__frame_Math_add_a/_b`).
- An "unsupported-node" fixture (a function whose body has an `IfStmt`).
- An "error-carrying" fixture (a function flagged with `ErrorType` in the model).

### Mock Requirements

None — real records throughout (hand-built fixtures, real `DiagnosticBag`).

## Verification Checklist

- [ ] All ST-cases (ST-M/L/P/O) defined with concrete input/expected pairs
- [ ] Every ST case traces to a requirement / spec section / AR-or-D entry
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red) first
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests written for edge cases and internals
- [ ] Golden snapshots committed (`__snapshots__/`)
- [ ] R15 boundary tier (`test/boundary.spec.test.ts`) green
- [ ] No regressions; full verify passing; `git status --porcelain spec/` empty
