# Width-Aware Const Evaluation: RD-18 Slice 6

> **Document**: 03-02-const-eval-widths.md
> **Parent**: [Index](00-index.md)

## Overview

`evalConst` grows the folds Slice 6's surface needs (bitwise, shifts, casts, ternary,
logical, comparisons) — several of which are width/signedness-sensitive. Per AR-7 the
evaluator gains an **optional per-node type lookup**; width-sensitive folds engage
only when the type is known, else `nonConst`. The evaluator stays pure and
diagnostic-free (structured results; callers emit).

## Architecture

### Current
`const-eval.ts` (151 lines): untyped full-precision JS-number folds — literals, unary
`+`/`-`, `+ - * / %`, `lo`/`hi`, refs via `ConstRefResolver`. Everything else
`nonConst`.

### Proposed changes

**1. Signature** (backwards-compatible — AR-7)

```ts
export type ConstTypeLookup = (expr: ExprNode) => Type | undefined;

export function evalConst(
  expr: ExprNode,
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,   // NEW — callers with a populated typeMap pass ctx.typeMap.get
): ConstEvalResult
```

Existing callers (range checks, for-bounds, case labels, module-const evaluation)
compile unchanged. Pass-3 call sites thread `(e) => ctx.typeMap.get(e)`.

**2. Two's-complement helpers** (module-local, the ONE definition both directions use)

```ts
function toBits(value: number, width: 8 | 16): number      // mask to width
function fromBits(bits: number, width: 8 | 16, signed: boolean): number  // reinterpret
```

**3. New folds**

| Node/op | Fold | Type-gated? |
|---------|------|-------------|
| `& \| ^` | via `toBits`/`fromBits` at the operand type's width | yes when either operand is negative; non-negative operands fold directly |
| `~` | `fromBits(~toBits(v,w) & mask, w, signed)` | **yes** (needs width+sign) |
| `<<` | `fromBits(toBits(v,w) << n, w, signed)`; `n` masked ≥ width → 0 | **yes** |
| `>>` | unsigned: logical; signed: arithmetic (sign-propagating on the width) | **yes** |
| `== != < <= > >=` | numeric/boolean compare → boolean value | no |
| `&& \|\| !` | boolean short-circuit fold (RHS not evaluated when short-circuits — matches runtime semantics for divByZero propagation) | no |
| `?:` | fold condition; fold ONLY the selected arm (Ch 04 §7.2 rule 4) | no |
| `CastExpr` | `fromBits(toBits(v, targetW), targetW, targetSigned)` | no (target carries its own width) |

Unfoldable-without-type cases return `nonConst` (the caller then treats the value as
runtime — always sound, never wrong).

**4. Semantics split — where full precision vs width-wrapping applies**

- **Const declarations (TS-18)**: unchanged — the 5b module-const evaluator keeps
  full-precision arithmetic then range-checks the final value (E10084). (`const
  HALF: byte = 256 / 2;` stays 128 — spec example.)
- **Runtime-position folding** (range checks, W10161 detection): arithmetic folds
  stay full-precision for the E10084 check (3b behavior, unchanged); the NEW
  width-sensitive ops (`~`, shifts, casts, negative-operand bitwise) fold with width
  semantics because that IS their runtime meaning. (For unary `~` the operand type
  is the 03-01 §3 no-context typing result, so the fold and the lowered runtime op
  use the same width by construction.) The W10161 trigger (03-01 §8)
  compares the full-precision fold against `toBits` at the value type's width —
  differ ⇒ wraps ⇒ W10161.
- **W10101** (03-01 §4): the typing layer folds the cast operand and the cast result;
  differ ⇒ truncation ⇒ warn with both values.

**5. `checkConstRange`** — threads `typeOf` through so cast/shift/bitwise-bearing
initializers fold correctly (e.g. `let b: byte = <byte>($1FF);` folds to 255+W10101,
no E10084). Div-by-zero propagation through the new folds uses the existing
`propagateFailure` pattern (`x / (1 - 1)` still E10082 wherever it folds).

## Integration Points

- 03-01 W10161/W10101 emission consumes the width folds.
- The 5b module-const evaluator (`evaluateModuleConsts`) passes `typeOf` so
  `const M: byte = ~$F0;`-style declarations evaluate (const decls type their
  initializers first — the lookup is populated).
- Lowering does NOT consume evalConst in this slice (translate folds nothing new);
  const-eval growth serves typing/warnings/const-decls only.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Division/modulo by folded zero in new positions (ternary arm, shift operand, …) | structured `divByZero` propagates; caller emits E10082 | AR-7 |
| Width-sensitive op without type info | `nonConst` (sound fallback) | AR-7 |
| Poisoned reference in new folds | `poisonedRef` propagates (silent) | AR-7 |

## Testing Requirements

ST-19…ST-22 (07-testing-strategy) pin the observable outcomes (const decls, W10101/
W10161 triggers). Impl tests: `toBits`/`fromBits` boundary sweep (±0, 0x7F/0x80,
0xFF/0x100, 0x7FFF/0x8000, 0xFFFF), signed `>>` arithmetic fill, `<<` overflow-out,
short-circuit fold laziness (divByZero in the unevaluated arm does NOT surface),
ternary selected-arm-only, cast round-trips for all 16 integer pairs.
