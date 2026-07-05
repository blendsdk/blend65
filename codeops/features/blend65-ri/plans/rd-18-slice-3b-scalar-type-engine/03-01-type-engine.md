# Component: The Scalar Type Engine (Pass 3 + Pass 4 + minimal const-eval)

> **Document**: 03-01-type-engine.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-1, FR-2, FR-3, FR-5, FR-6; AR-3, AR-5, AR-7, AR-10

## Overview

The bulk of Slice 3b: build real **Pass 3** (expression/literal typing + same-type/signedness
enforcement + name resolution + poison) and **Pass 4** (`main()` validity), and a **minimal const
evaluator** (`lo`/`hi` + literal range). `typeMap`/`symbolMap` become real; `isAssignableTo`/
`commonType` stubs are replaced. Every check **emits a diagnostic, never throws** (FR-9).

## Module layout (AR-10 — split by concern, ≤500 lines each)

| File (new unless noted) | Responsibility |
|-------------------------|----------------|
| `packages/core/src/semantics/type-utils.ts` (**edit**) | Replace `isAssignableTo`/`commonType` stubs with real same-type rules (below). |
| `packages/frontend/src/semantics/type-check/expression-typing.ts` (new) | Walk a function body, assign each `ExprNode` a `Type`, emit E10081/E10080/E10084/E10100, populate `typeMap`/`symbolMap`. |
| `packages/frontend/src/semantics/type-check/name-resolution.ts` (new) | Innermost-first scope lookup (function body → module → global); E10100 on miss. |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` (new) | Type `let`/assignment/`return`/expression statements; assignment compat (E10152/E10154/E10153/E10150). |
| `packages/frontend/src/semantics/const-eval.ts` (new) | Minimal evaluator: literal fold, `lo`/`hi`, range check (E10084), const div-by-zero (E10082). |
| `packages/frontend/src/semantics/post-check.ts` (new) | Pass 4 `main()` validity (E10020/E10021 + signature). Wired into `passes.ts postCheck`. |
| `packages/frontend/src/semantics/analyze.ts` (**edit**) | Invoke the new Pass-3 typer + Pass-4 post-check; assemble real `typeMap`/`symbolMap`/`typeOf`/`symbolOf` into the model. |

> `mutableTypeMap: Map<ExprNode,Type>` and `mutableSymbolMap: Map<AstNode,Symbol>` are built during
> Pass 3 and frozen into the model; `typeOf`/`symbolOf` read them (with `ERROR_TYPE`/`null` fallbacks).

## `isAssignableTo` / `commonType` — the real same-type rules (AR-3)

```ts
/** Slice 3b: same-type only. Widening/cross-sign are Slice 6 (need zext/sext). ErrorType poisons true. */
export function isAssignableTo(source: Type, target: Type): boolean {
  if (isError(source) || isError(target)) return true;         // R114 poison suppression
  return typeName(source) === typeName(target);                // strict same-type (3b)
}

/** Slice 3b: same-type binary result. null ⇒ operands not combinable (caller emits the error). */
export function commonType(a: Type, b: Type): Type | null {
  if (isError(a) || isError(b)) return ERROR_TYPE;             // poison
  // `isPrimitive` does NOT exist in core (PF-006). Both operands are primitive here because 3b
  // only types the scalar grammar; a same-name check on the primitive kinds suffices:
  if (a.kind === "primitive" && b.kind === "primitive" && typeName(a) === typeName(b)) return a; // T OP T → T
  return null;                                                  // widening/mixed handled by caller
}
```

> **Note (PF-006):** `isPrimitive` is not a core helper — use the `Type.kind === "primitive"` guard +
> `typeName` (both exist in `type-utils.ts`). Confirm the `PrimitiveType.kind` discriminant during
> implementation and reuse it consistently in `isAssignableTo`.

The **caller** (`expression-typing.ts`) distinguishes *why* `commonType` returned `null` to pick the
code: different signedness → **E10081**; a `boolean` operand → **E10080** (InvalidOperandType, ledger
R34 — *not* E10151, which the registry defines as `UnknownType`; see [AR-11](00-ambiguity-register.md));
different width same sign (widening) → deferred (Slice 6) — in 3b, treated as E10081-adjacent *only* if
the fixture surface requires it (it does not; the fixture is same-type). See the decision table below.

## Expression typing (`expression-typing.ts`)

`typeOfExpr(expr, scope, ctx): Type` — recursive, memoizing into `typeMap`:

| Node | Rule | Diagnostic |
|------|------|-----------|
| `NumericLitExpr` | default type by value (TS-2); adapt to context type if provided & fits; else out-of-range | **E10084** |
| `BoolLitExpr` | `boolean` | — |
| `IdentExpr` | `resolve(name, scope)`; type = symbol type; record into `symbolMap` | **E10100** + poison on miss |
| `BinaryExpr` (`+ - * / %`) | `lt = type(left)`, `rt = type(right)`; `commonType(lt,rt)`; result = that or poison | **E10081** (mixed sign), **E10080** (boolean operand — ledger R34, AR-11) |
| `IntrinsicCallExpr` `lo`/`hi` | `byte` (const arg; const-eval) | ICE-free; non-const already handled downstream |
| `IntrinsicCallExpr` `peek` | `byte`; `peekw` → `word` (descriptor) | via existing validator |
| other (member/index/call/cast/unary/logical/comparison/shift) | **not typed in 3b** — out of surface | (owned by later slices) |

**Binary decision table (3b same-type):**

| left ⧵ right | byte | sbyte | word | sword | boolean |
|--------------|------|-------|------|-------|---------|
| **byte**     | byte | E10081 | *Slice 6* | E10081 | E10080 |
| **sbyte**    | E10081 | sbyte | E10081 | *Slice 6* | E10080 |
| **word**     | *Slice 6* | E10081 | word | E10081 | E10080 |
| **sword**    | E10081 | *Slice 6* | E10081 | sword | E10080 |
| **boolean**  | E10080 | E10080 | E10080 | E10080 | E10080 |

> *Boolean-operand cells emit **E10080** (InvalidOperandType — "Operator cannot be applied to type"),
> per ledger R34 + Ch 14. The plan's earlier E10151 was wrong (registry E10151 = `UnknownType`). AR-11.*

*Slice 6* cells (same-sign different width = widening) are **not exercised by 3b's fixture**; if such
an expression is written in 3b it is out-of-surface (no guarantee). The fixture stays on the diagonal.

**Signed `*`/`/`/`%` (AR-5):** typing permits `sbyte * sbyte → sbyte` (same-type), but *correctness*
of signed multiply/divide is out-of-surface (routes to unsigned `__rt_*`). 3b does not special-reject
it (no code; no new codes till Slice 4). The fixture is unsigned; a note is recorded in the closeout.

**Poison (FR-3/R114):** any operand that is `ERROR_TYPE` yields `ERROR_TYPE` with **no** new
diagnostic — the root-cause diagnostic was already emitted where the poison originated.

## Statement typing (`statement-typing.ts`)

- **`let name: T = init;`** — require `T` present (**E10150** if `declaredType` is null); type `init`;
  `isAssignableTo(type(init), T)` else the assignment-compat code (same-type ✅; **narrowing** word→byte
  **E10154**; **cross-sign** byte↔sbyte **E10153**; boolean↔integer **E10152**). *(Codes per AR-11 /
  Ch 14 — the stale spec §5.3 numbers E10082/E10080 collide with div-by-zero/operand-type.)*
  Initializer-less `let name: T;` is valid (spec VAR-2) — no init check.
- **`AssignExpr` (`=`)** — target must be an assignable l-value (a `variable` symbol, not `constant`
  → **E10191**); `isAssignableTo(type(rhs), type(target))` else the compat code.
- **`ReturnStmt`** — in `main(): void`, `return;` OK (R81); `return expr;` in a void fn → **E10173**
  (kept minimal; full all-paths-return R80 is Slice 4).

## Pass 4 — `main()` validity (`post-check.ts`, AR-7)

Wired into `passes.ts postCheck(input, model)` (currently a no-op). Over `model.callGraph.functions`:
- Count `FunctionDecl` named `main`: **0 → E10020**, **≥2 → E10021** (R66).
- The one `main` must be `(): void` with **no parameters** — else **E10022** (spec Ch 06 /
  `00-feature-index:82` / `F004:30`; spec-designated but unregistered → registered additively per
  [AR-11](00-ambiguity-register.md)). `mainFunction` is already first-wins from Slice 3a.
- **E10023** (calling main) deferred — no call sites exist until Slice 5.

## Minimal const-eval (`const-eval.ts`, FR-6)

`evalConst(expr): ConstValue | null` supporting: numeric/bool literals; `lo(c)`/`hi(c)` on a const;
integer `+ - * / %` on constants (full-precision, spec TS-18) for range-checking; **div-by-zero →
E10082**. Result feeds the literal-range check (**E10084**) and `lo`/`hi` folding (already const-only
in lowering). No array/aggregate sizing (Slice 7).

## `analyze()` wiring (edit)

After `collectFunctions` and before assembling the model, run the Pass-3 typer over each function
body (and module-var declarations), collecting `typeMap`/`symbolMap` and emitting diagnostics into
`bag`; then run `postCheck`. Assemble the model with real `typeMap`/`symbolMap` and
`typeOf`/`symbolOf` closures. `hasErrors` already tracks the bag delta (Slice 3a pattern). `passes.ts`
`resolveTypes` (Pass 2) stays a no-op for 3b (no struct/enum sizing needed for scalars).

## Security / robustness

- **Never throws** on user input (FR-9): unresolved names, type errors, out-of-range literals all
  produce diagnostics + poison, not exceptions. No `E9xxxx` ICE for user programs.
- **Bounded** const-eval: the minimal evaluator is non-recursive over a bounded scalar grammar (no
  attacker-unbounded recursion). Div-by-zero is caught (E10082), not a JS throw.
- **Determinism**: `typeMap`/`symbolMap` iteration is not serialized to output; diagnostics are
  ordered by source span via the existing bag/severity policy.
