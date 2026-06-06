# AST→IL Lowering & Visitor Seam: RD-06 IL & IL Optimizer

> **Document**: 03-02-lowering.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-06 R29–R52 (gate/slice-2 subset), R68/R69, §4.7–§4.10, §4.12 · D1/D5

## Overview

`lowerToIL` walks the validated AST and emits an `ILProgram`. Per register **D1**, only the
**gate + slice-2 surface** is lowered now; every other AST node kind reaches the visitor's
**default arm**, which raises an ICE (R69) — never a silent gap. Per **D5**, the lowering is
real and **fixture-tested** today; only the live façade wiring (a *populated* `SemanticModel`)
is deferred.

The lowering is structured as an **extensible typed visitor** keyed on the AST `NodeKind`
discriminant, so each future slice adds exactly one case — additive, no reshape (the AR-38
extensible-visitor contract, mirrored from RD-03/RD-04).

## Architecture

### Files (`packages/codegen/src/il/`)

| File | Exports |
| ---- | ------- |
| `builder.ts` | `IlFunctionBuilder` — deterministic temp ids (`%0..`), block labels (`_entry`,`_L0..`), instruction/terminator append; produces a frozen `ILFunction` |
| `lower.ts` | `LowerInput`, `lowerToIL(input, bag)`, the node-kind visitor, the gate/slice-2 cases, the ICE default |
| `test-fixtures.ts` | hand-built AST + `SemanticModel` + `AllocationPlan` fixtures for the gate/slice-2 programs (NOT exported from the barrel) |

### Entry point (R: §4.12, D4)

```typescript
export interface LowerInput {
  readonly program: readonly ProgramNode[];   // RD-03 AST roots
  readonly model: SemanticModel;               // RD-04 (typed AST, symbols, const values)
  readonly plan: AllocationPlan;               // RD-05 (frame/zp/symbol addresses)
}

/**
 * Lower the validated AST + SemanticModel + AllocationPlan to IL.
 * Never throws (R69/R113-analog). User errors are already caught upstream; this emits only
 * `E9xxxx` ICEs for AST shapes it cannot handle. Functions carrying ErrorType/error nodes
 * are skipped (R68).
 */
export function lowerToIL(input: LowerInput, bag: DiagnosticBag): ILProgram;
```

## Implementation Details

### Top-level algorithm (R64/R66/R68)

```
lowerToIL(input, bag):
  functions: ILFunction[] = []
  for each ProgramNode in input.program:
    for each FunctionDecl / InterruptDecl in the module:
      if function has an ErrorType in its signature/body (per input.model): skip (R68)
      else: functions.push(lowerFunction(fn, input.model, input.plan, bag))
  return Object.freeze({
    functions,
    initCode: [],            // empty in v1 (AR-91 module-init arrives with its slice)
    constData: [],           // empty in v1
    allocationPlan: input.plan,   // carried for codegen (R66)
  })
```

> Under the current passthrough `input.program` is whatever the caller supplies. In live
> end-to-end use `analyze()` returns an empty model so the façade supplies an empty program
> → empty `ILProgram` (D5). Fixtures supply real programs to exercise every case below.

### `lowerFunction` → CFG (R12/R16/R42)

Builds one `ILFunction` via `IlFunctionBuilder`:
- create the `_entry` block (R16);
- lower the body statements in order into the current block;
- a `return` terminates the current block with `ret(value?)` (R42); a fall-through end of a
  `void` function emits `ret()` (R42);
- `params` are `Location` operands resolved from the `AllocationPlan` frame slots;
- `tempCount` is the builder's final temp counter.

For the gate/slice-2 surface every function is a **single basic block** (no control flow yet),
so the CFG is `[_entry]` with a `ret` terminator — matching RD-06 §4.7's example.

### Lowered node kinds (gate + slice-2 surface)

| AST node kind | Lowering | Req |
| ------------- | -------- | --- |
| `LetDecl` with initializer | eval init expr → temp; `store(temp → loc(slot))` | R29 |
| `LetDecl` without initializer | no IL emitted (slot exists; W10190 is RD-04b's job) | R30 |
| `AssignExpr` (simple `=`) | eval RHS → temp; `store(temp → loc(target))` | R31 |
| `NumericLitExpr` | `const(imm(value,type) → temp)` (or fold to `Immediate` operand) | R28/R45 |
| `BoolLitExpr` | `const(imm(0|1, IL_BYTE) → temp)` | R5 |
| `BinaryExpr` (same-width arithmetic `+ - * / %`, bitwise) | eval left → t1, eval right → t2, `op(t1,t2 → t3)` (left-first, R33/FN-10) | R18/R19/R33 |
| `IdentExpr` (variable read) | `load(loc(slot) → temp)` | R22 |
| `ReturnStmt` | eval expr → temp; terminate block with `ret(temp)`; bare → `ret()` | R42 |
| `ExpressionStmt` wrapping `poke(addr,val)` | eval val→v; `store(v → loc(addr))` — the **address lowers to a symbolic `location`** (D9), the value stays an immediate/temp | R46 |
| `IntrinsicCallExpr` `peek(addr)` | `load(loc(addr) → temp)` — the **address lowers to a symbolic `location`** (D9) | R46 |
| `Block` | lower child statements in order into the current block | R: §4.4 |
| `Program`/`ModuleDecl`/`FunctionDecl`/`InterruptDecl` | structural — drive `lowerFunction` | R17 |


> **Promotion note (R4):** the gate/slice-2 surface uses **same-width** operands only, so no
> `zext`/`sext`/`trunc` is emitted yet. The conversion instructions exist in the model
> (03-01); their *insertion* is deferred with the wider type matrix (needs the RD-04b typed
> model — AC-04, D1).

### The extensible visitor & ICE default (R17/R69, D6)

```typescript
type LowerResult = ILOperand | undefined;   // expression visitors yield an operand; statements yield undefined

function lowerExpr(node: AstNode, ctx: LowerCtx): ILOperand {
  switch (node.kind) {
    case "NumericLitExpr": ...
    case "BinaryExpr": ...
    case "IdentExpr": ...
    case "IntrinsicCallExpr": ...   // peek
    // ...gate/slice-2 cases...
    default:
      // R69 — an AST shape semantic analysis should have produced but lowering does not
      // yet handle. NEVER silent. Emits an ICE; returns a poison IL_BYTE immediate so the
      // walk continues deterministically (never throws).
      ctx.bag.addICE(IceCode.Unexpected, spanOf(node),
        `IL lowering: unsupported expression node '${node.kind}'`);
      return imm(0, IL_BYTE);
  }
}
```

- The same default pattern guards `lowerStmt`. Unsupported statements emit the ICE and are
  skipped (no instructions appended), keeping the block well-formed.
- This makes the **slice boundary explicit and testable**: a test feeds an `if` statement and
  asserts exactly one `E90001` ICE (until the control-flow slice lands).

### Determinism (R53/R61, H5)

- Temp ids and block labels are assigned by the builder in **walk order** — deterministic for
  a given AST.
- No map iteration drives output order; functions are emitted in `program` order.
- No `Date`/random/hash — the printed IL (03-03) is byte-identical across runs.

## Code Examples

### Gate program (`poke(0xD020, 5)`) — AC-11

```
function Main.main(): void {
_entry:
  store 5, $D020          ; poke(addr, val) → store(val → location(addr))
  ret
}
```

*(The `0xD020` is a fixture immediate, not a core constant — P3 upheld.)*

### Slice-2 program (`let c: byte = 5; poke(0xD020, c);`)

```
function Main.main(): void {
_entry:
  %0 = const i8u 5
  store %0, __frame_Main_main_c
  %1 = load i8u __frame_Main_main_c
  store %1, $D020
  ret
}
```

### RD-06 §4.7 simple function (`add(a,b)`) — golden

```
function Math.add(__frame_Math_add_a: i8u, __frame_Math_add_b: i8u): i8u {
_entry:
  %0 = load i8u __frame_Math_add_a
  %1 = load i8u __frame_Math_add_b
  %2 = add i8u %0, %1
  ret %2
}
```

> **D8 (runtime):** header params render **verbatim** from their `AllocationPlan`-backed
> `Location` symbols (`__frame_Math_add_a`), identical to the body's `load` operands — one
> DRY location-rendering path, maximally deterministic, truthful to the SFA model. (The
> earlier short-name form `a: i8u` would have required the printer to know the source name,
> which is not on the `Location` operand.) See register D8.

## Error Handling

| Error Case | Handling Strategy | Req |
| ---------- | ----------------- | --- |
| Unsupported AST node kind | `bag.addICE(IceCode.Unexpected, span, msg)`; return poison operand / skip stmt; never throw | R69/D6 |
| Function carries `ErrorType`/error node | skip the function entirely (no IL) | R68 |
| Empty `program` (passthrough live path) | return empty `ILProgram` (no functions) | D5 |

## Testing Requirements

- Spec tests (ST-L*): each lowered node kind → expected IL (asserted via `printIL`); the ICE
  default fires exactly once for an unsupported kind; error-carrying function is skipped;
  empty program → empty `ILProgram`; determinism (two runs, identical text).
- Impl tests: builder temp/label sequencing; left-first evaluation order; nested `Block`.
