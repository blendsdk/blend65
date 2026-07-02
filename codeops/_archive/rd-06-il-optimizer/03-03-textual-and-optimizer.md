# Textual Form & Optimizer Pipeline: RD-06 IL & IL Optimizer

> **Document**: 03-03-textual-and-optimizer.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-06 R53–R63, §4.6, §4.11 · AR-51/AR-38

## Part A — IL Textual Form (`printIL`)

### Overview

`printIL(program: ILProgram): string` renders the IL to a **stable, deterministic,
human-readable** text — the surface for `--emit-il` (wired by RD-15) and for golden-snapshot
testing (R53–R55, AR-51). Same input → identical output, character-for-character (H5).

### File

`packages/codegen/src/il/print-il.ts` → `export function printIL(program: ILProgram): string;`

### Format rules (§4.6)

| Element | Format | Example |
| ------- | ------ | ------- |
| Function header | `function <name>(<params>): <ret> {` | `function Math.add(a: i8u, b: i8u): i8u {` |
| Block label | `<label>:` (column 0) | `_entry:` |
| Instruction (with dest) | `  <dest> = <op> <type> <operands>` | `  %0 = add i16u %1, %2` |
| Instruction (no dest) | `  <op> <operands>` | `  store %0, __var_Game_x` |
| Terminator | `  <kind> <args>` | `  brcond %3, _L1, _L2` |
| Type annotation | `i8u` / `i8s` / `i16u` / `i16s` | `i8u` = byte, `i16s` = sword |
| Temp | `%N` | `%0`, `%1` |
| Immediate | bare number (decimal; `$` hex only when the operand was authored hex — v1 prints decimal) | `42` |
| Location | symbol name (+ `+offset` when present) | `__frame_Game_update_dx`, `s+2` |
| Function close | `}` (column 0) + blank line between functions | |

> **Type-tag mapping:** `{width:8,signed:false}`→`i8u`, `{8,true}`→`i8s`,
> `{16,false}`→`i16u`, `{16,true}`→`i16s`. A single `ilTypeTag(t)` helper is the only place
> this mapping lives (no duplication).

> **Immediate radix (watch-item, not an AR):** RD-06 §4.6 shows both `42` and `$D020`. To
> keep `printIL` deterministic and source-independent, v1 prints **decimal** for every
> immediate (the IL operand carries only a `number`, not its source radix). The §4.7/§4.8
> golden examples use decimal; the `$D020` in §4.9 is illustrative. This does not alter
> behavior — it is a rendering convention, recorded for golden-snapshot stability.

### Determinism guarantees

- Blocks printed in `blocks[]` order (entry first, R16); instructions in array order.
- No map/set iteration; no platform-dependent formatting (`\n` line endings, no locale).
- Pure function of `ILProgram` — no clock/random/hash.

### Examples

The §4.7 `add` function and the gate/slice-2 programs in `03-02` are the canonical golden
fixtures. The printer is the assertion surface for all lowering spec tests (so a lowering
change that alters the text requires a golden update — intentional, R55).

---

## Part B — IL Optimizer Pipeline (`optimizeIL`)

### Overview

The optimizer is an **architectural seam** (AR-38): a pass pipeline that runs a configurable
sequence of `ILPass` transforms over an `ILProgram`. **v1 applies zero passes** — the IL
passes through unchanged (R57). This establishes the structure so the two real optimizers
(IL-general here, later; peephole in RD-08 at the `Instr` level) slot in without restructuring
the pipeline.

### Files (`packages/codegen/src/il/optimizer/`)

| File | Exports |
| ---- | ------- |
| `pass.ts` | `ILPass` interface |
| `optimize-il.ts` | `optimizeIL(program, passes, bag)` |
| `index.ts` | barrel |

### Interface (§4.11)

```typescript
export interface ILPass {
  readonly name: string;
  run(program: ILProgram, bag: DiagnosticBag): ILProgram;
}

/**
 * Run the IL optimizer pipeline. v1: callers pass `[]` (passthrough). Future:
 * [constFold, dce, strengthReduce]. Each pass receives the previous pass's output.
 * Determinism (R61): the result depends only on (program, passes) — no hidden ordering.
 * Correctness (R62): a pass must preserve observable semantics.
 * Barrier (R63): intrinsic-call instructions for CPU-control intrinsics must not be
 * reordered/removed/merged — a contract on FUTURE passes (no pass exists in v1 to violate it).
 */
export function optimizeIL(
  program: ILProgram,
  passes: readonly ILPass[],
  bag: DiagnosticBag,
): ILProgram;
```

### v1 behavior

```
optimizeIL(program, passes, bag):
  let current = program
  for (const pass of passes):     // empty in v1 → loop body never runs
    current = pass.run(current, bag)
  return current                  // === program when passes = []
```

- With `passes = []`, `optimizeIL` returns the **same** `ILProgram` reference unchanged
  (identity passthrough). `printIL(optimizeIL(p, [], bag)) === printIL(p)` (R57).
- The pipeline is generic over any `ILPass[]`, so a test can supply a trivial identity or
  tagging pass to prove the runner sequences passes correctly (AC-14) without shipping a real
  optimization.

### Planned (NOT implemented — D1) passes

| Pass | What it will do | Req |
| ---- | --------------- | --- |
| constant folding | evaluate ops on `Immediate` operands → `const` | R58 |
| dead-code elimination | remove unused instructions + unreachable blocks; contributes **W10130** (D2 — arrives with this pass) | R59/R70 |
| strength reduction | `mul`/`div` by power-of-2 → shift; interacts with Ch 04 §3.2 | R60 |

These are documented here so the return-for-optimization work has a precise starting point;
none ship in v1.

### Error Handling

| Error Case | Handling Strategy | Req |
| ---------- | ----------------- | --- |
| a pass throws | not guarded in v1 (no passes); future passes must be total (R62) — a future verifier/test harness owns this | R62 |
| empty `passes` | identity passthrough — return input unchanged | R57 |

## Testing Requirements

- **`printIL` spec tests (ST-P*):** golden snapshots for the §4.7 `add`, the gate program,
  and the slice-2 program; determinism (two calls equal); type-tag mapping for all four
  `ILType`s; a multi-block function prints blocks in order (constructed via builder).
- **`optimizeIL` spec tests (ST-O*):** `optimizeIL(p, [], bag)` returns `p` unchanged
  (text-identical); supplying `[identityPass, taggingPass]` runs them in order (AC-14);
  empty-program passes through.
- Impl tests: printer offset rendering (`sym+2`); `ilTypeTag` exhaustiveness.
