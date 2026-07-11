# Current State: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Recon performed 2026-07-11 against `v3` @ `36c71fb` (post-5b; working tree clean).

## Existing Implementation

### What Exists

The four middle stages cover the 3a–5b surface. For expressions specifically:

- **Typing** (`expression-typing.ts`): arithmetic `+ - * / %` same-type only
  (`ARITHMETIC_OPS`, line 53); `typeBinary` **silently poisons** every non-arithmetic
  operator (line 145: `if (!ARITHMETIC_OPS.has(expr.op)) return ERROR_TYPE`).
  Unary/cast/ternary hit the default arm (lines 101–104) — silent poison, no
  diagnostic. `typeAssign` runs for ALL `AssignOp`s but applies no TS-17 expansion
  rule; compound ops type like `=` then ICE at lowering. Literal adaptation (TS-2)
  exists for arithmetic operands only (lines 149–155).
- **Type policy** (`core/src/semantics/type-utils.ts`): `isAssignableTo` (line 164)
  and `commonType` (line 188) are **same-type only** — widening returns
  `null`/mismatch by design ("widening/casts are not implemented yet — they need
  `zext`/`sext`/`trunc` IL ops", line 153).
- **Const-eval** (`const-eval.ts`, 151 lines): untyped JS-number folds — literals,
  unary `+`/`-`, the five arithmetic ops, `lo`/`hi`, name refs via `ConstRefResolver`.
  Bitwise/shift/comparison/cast/ternary are `nonConst` (line 134).
- **Lowering** (`lower.ts`): `BINARY_OP_TO_IL` maps all binary ops EXCEPT `&&`/`||`
  (line 85 — those ICE as unknown binary ops); comparisons stamp `type: IL_BYTE`
  (result type — line 902), losing the operand width. No
  `UnaryExpr`/`CastExpr`/`ConditionalExpr` cases (default ICE, line 667).
  `lowerAssign` rejects `op !== "="` (line 915). `emitLo`/`emitHi` are const-only
  (ICE on non-const arg). Multi-block CFG machinery (4a keystone) is available.
- **Translate** (`translate.ts`): implements const/load/store, add/sub (8+16),
  and/or/xor (8 + 16-via-store-fold), shl/shr (**8-bit const-count only**, line 588),
  eq/ne/lt/le/gt/ge (**8-bit unsigned CMP only**, line 742), mul/div/mod via unsigned
  `__rt_*`, intrinsics, call, all four terminators. `neg`/`not`/`zext`/`sext`/`trunc`
  hit the deferred-op ICE. `translateDivMod` ignores `type.signed` (line 842).
  Cross-block temp reads are guarded (`producedThisBlock`).
- **IL vocabulary** (`il/instruction.ts`): complete — `neg`, `not`, `shl`, `shr`,
  `zext`, `sext`, `trunc` all exist as opcodes with shapes; only lowering/translation
  are missing.
- **Parser**: complete for the surface — `AssignExprNode` carries all 11 `AssignOp`s,
  `ConditionalExprNode`, `UnaryExprNode` (`- ! ~ &`), `CastExprNode` via FR-40
  `<type>(expr)` (`pratt.ts:236`). No parser work is needed (AR-14).
- **Diagnostics registry**: E10080/E10081/E10082/E10084, E10152/E10153/E10154,
  E10134, E10191 wired; **E10083** (`ShiftAmountOutOfRange`) and **E10155**
  (`InvalidCast`) registered but never emitted; E10086/E10087/E10088, W10101,
  W10160/W10161, W10174 unregistered in the registry — E10086 and the four
  W-codes deliberately adopt the numbers `spec/` already assigns (AR-10);
  E10087/E10088 are free everywhere (registry AND `spec/` verified).
- **Warnings live**: W10170/W10171 emitted at mul/div call sites (`translate.ts:833,857`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/semantics/type-utils.ts` | type policy | TS-4 widening in `commonType` + `isAssignableTo` |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | registry | mint E10086/87/88 + W10101/160/161/174; rename E10083 key |
| `packages/frontend/src/semantics/type-check/expression-typing.ts` | Pass-3 typing | full operator matrix, unary, cast, ternary, compound assign, W-emissions |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` | stmt typing | W10160/W10161 at init/assign sites (via shared helper) |
| `packages/frontend/src/semantics/const-eval.ts` | const folds | type-lookup param; bitwise/shift/cast/ternary/logical folds |
| `packages/frontend/src/sfa/model-adapter.ts` | model→SFA | synthetic `0sc<N>` slot collection (+ `__init` pseudo-frame) |
| `packages/codegen/src/il/lower.ts` | AST→IL | coerce (zext/sext), unary/cast/ternary/short-circuit/compound arms, comparison operand type, signed div ICE, non-const lo/hi |
| `packages/codegen/src/instr/translate.ts` | IL→6502 | neg/not/zext/sext/trunc, 4 comparison framings, word+variable shifts |
| `packages/test-harness/*` | acceptance | slice6 fixture builder, golden, VICE suite, negatives |
| `examples/slice6/main.blend` | fixture | NEW |

## Gaps Identified

### Gap 1: Silent-poison comparisons (DEF-1 candidate)
**Current Behavior:** comparisons type as poison (no diagnostic) yet LOWER anyway;
the compare instruction carries `IL_BYTE`, so translate compares low bytes only. A
`word` for-loop counter bound compiles **silently wrong** today.
**Required Behavior:** comparisons typed per TS-7 (boolean result, promotion rules);
the IL compare carries the operand type (AR-9); translate frames byte/word ×
signed/unsigned (AR-1).
**Fix Required:** 03-01 typing + 03-03 lowering (ALL THREE compare-emission sites:
`lowerBinary`, the for-loop predicate `compareCounter`, the switch dispatch chain) +
03-04 translate; DEF-1 regression witness per AR-5.

### Gap 2: Signed `/`/`%` miscompile
**Current Behavior:** `translateDivMod` always calls unsigned `__rt_div8/16` — wrong
values for signed operands, no diagnostic.
**Required Behavior:** loud lowering ICE per AR-2 until the signed slice.
**Fix Required:** 03-03 §signed-guard.

### Gap 3: No value can cross a basic block
**Current Behavior:** translate resets per-block state; a ternary/short-circuit
result would trip the cross-block ICE guard.
**Required Behavior:** results flow through synthetic SFA frame slots (AR-6) with
explicit `store`/`load` at the arm/join boundaries.
**Fix Required:** 03-03 §slots (model-adapter + lowering contract).

### Gap 4: Everything else in scope is a clean absence
Unary/cast/ternary/compound/short-circuit/widening simply do not exist at any stage —
additive work, no behavioral collisions. The one supersession: 5a's strict same-type
argument pin (E10171 for widening args) is deliberately relaxed (AR-3).

## Dependencies

### Internal
- 4a multi-block CFG keystone (blocks/labels/brcond) — shipped, consumed as-is.
- 5b `__init` stream — initializer expressions may contain ternary/short-circuit;
  slots must exist for the `__init` frame too (AR-6).
- SFA frame planner — consumes `FunctionInfo.locals`; synthetic slots ride the
  existing mechanism (no allocator changes expected).
- `__rt_mul8/16`, `__rt_div8/16` (RD-17) — unchanged; signed div/mod ICEs before
  reaching them.

### External
- ACME + VICE 3.10 locally for the acceptance tier (CI runs assemble-clean + goldens
  only, AR-27 standing).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Slot-index drift between model-adapter and lowering (both count `0sc` sites) | Med | High (wrong addresses) | Identical preorder walk defined ONCE (03-03 §slots); lowering ICEs when a computed slot name is absent from the frame OR its size mismatches the site — neither count nor order drift can miscompile |
| Prior goldens perturbed by comparison-shape/widening changes | Low | Med | Plan-local AC-1: all six goldens byte-exact, asserted before the slice golden is minted |
| Signed compare framing subtly wrong (N⊕V) | Med | High | ST cases with boundary operands (−128/127, −1/0) VICE-verified; DEF-1-style regression tests at translate impl tier |
| W10160 too noisy (fires on every narrow-arith-into-wide) | Med | Low | Spec-scoped trigger (arith ops only, not provably-in-range consts — W10161 handles those); warnings never fail builds |
| Const-eval width semantics diverge from runtime semantics | Low | High | One shared two's-complement helper pair (03-02); impl tests cross-check folds against VICE-verified runtime results in the fixture |
