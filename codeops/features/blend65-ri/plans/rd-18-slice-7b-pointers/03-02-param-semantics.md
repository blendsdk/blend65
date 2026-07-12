# Param semantics: by-ref types, const rules, tiers, advisories

> **Document**: 03-02-param-semantics.md
> **Parent**: [Index](00-index.md)

## Overview

The frontend surface: aggregate/unsized param types become real (retiring both 7a E90001
rejections), the const-param rules (CP-1..5) enforce, the tier index rules branch on real
sizes (E10117 stays, E10118 becomes emittable), and the three advisories mint. All decisions
AR-5/AR-6/AR-8/AR-9/AR-10/AR-11.

## Architecture

### Type model (`@blend65/core`)

```ts
// core/src/semantics/type.ts
export interface ArrayType {
  readonly kind: "array";
  readonly element: Type;
  /** Element count; null = unsized (parameter types only — AR-5). */
  readonly size: number | null;       // was: number
}
```

Ripples (all loud, found by exhaustiveness/typecheck):
- `byteSize(arrayType)` — unsized has no byte size; callers must branch. Sites that can
  legally meet unsized (tier classification, W-advisories) treat it per this doc; any other
  site reaching an unsized size is a defect → ICE, never a silent 0.
- `type-utils.ts isAssignableTo`: new arm — `T[N] → T[]` when elements mutually assignable
  (any N, all element types, AR-5). `T[] → T[N]` is NOT assignable; `T[]` never widens into
  `commonType` (an unsized value cannot be created — only bound).
- `typeName` renders `byte[]`.

### Symbols & collection

`function-collection.ts` (`:155-181`) drops the scalars-only restriction:
- Param symbol type: provisional from the annotation (aggregates resolve in Pass 2 exactly
  like variables — the 7a `annotation-resolution.ts` finalizer already patches param symbols
  in place; the `primitiveFromTypeNode` shortcut is removed).
- `byRef: annotationIsAggregate` (array or struct annotation — the FN-3 rule; scalars stay
  by-value per FN-2).
- `mutable: !param.isConst` (AR-6).

`annotation-resolution.ts checkFunctionBoundary` (`:121-131`): the aggregate-param ICE is
DELETED; E10120/E10093 return checks stay verbatim. Unsized annotations are legal only on
params — an unsized annotation on a `let`/module var WITHOUT initializer keeps the 7a
behavior (size inference / its existing error path); `resolveTypeNode` gains a
`paramContext` flag so `size: null` survives only there (elsewhere: 7a semantics unchanged).

`type-check/type-resolution.ts:72-81`: the >256-byte gate is DELETED. Tier-2 array types
construct normally. On DECLARED array types (variables + const aggregates, not params — AR-5):
- total > 256 → **W10142** Tier2Overhead
- total ≥ 25% of the platform RAM region → **W10143** LargeArrayOnPlatform (AR-11; the
  profile's RAM span is the denominator)

### Call typing (`expression-typing.ts`)

`signatureOf` (`:1244-1261`) resolves param types in FULL mode (ctx threaded) so signatures
carry real aggregate/unsized types incl. `Mod.Type` annotations and const-expr sizes.

The arg loop (`:1209-1223`) extends per-param:
1. **Assignability** — unchanged `isAssignableTo` + E10171 (sized mismatch rejects naturally;
   `T[N] → T[]` passes via the new arm; struct params nominal — AR-9).
2. **E10122 ConstToMutableParam** (by-ref params only, AR-6): the argument's ROOT symbol
   (reusing `assignmentRootSymbol`'s chain walk on the arg expression) is `kind === "constant"`
   OR a const param (`kind === "parameter" && !mutable`) while the target param is by-ref and
   mutable → E10122 with the CP-2 remedy wording. Load-bearing: const-aggregate images live in
   the read-only `__data_*` stream.
3. **W10112 PossibleAliasing** (AR-8): the same root symbol feeds ≥2 by-ref arguments of THIS
   call → one warning naming both params (Ch 07 §4.7 wording).

No arity/recursion/argument-window changes — 5a machinery untouched.

### Write protection (CP-5, AR-6)

`typeAssign`'s root check (`:652-659`) becomes a two-way predicate on `assignmentRootSymbol`:
- root `kind === "constant"` → **E10191** (unchanged 7a behavior)
- root `kind === "parameter" && !mutable` → **E10123** ModifyConstParam (direct writes,
  nested chains `p.pos.x`, indexed elements `t[0]`, and compound assignment — all flow
  through the same root walk)

Scalar const params reject writes by the same predicate (AR-6 — zero bespoke machinery).

### Index typing (`typeIndexExpr`, `:900-947`)

The 7a unconditional E10117 branch becomes size-aware. **Load-bearing detail:** the index's
CONTEXTUAL type hint (today hardcoded `primitive("byte")` at `:902`) follows the tier —
`word` for known >256-byte arrays, `byte` otherwise (incl. unsized) — so integer literals
adapt (`big[4]` types its index as word on a tier-2 array; no cast needed). Explicitly-typed
index expressions then hit the table:

| Array form | byte index | word index | Source |
| ---------- | ---------- | ---------- | ------ |
| sized, total ≤ 256 (incl. sized params) | ✅ | **E10117** (7a wording kept) | Ch 08 AR-3 |
| sized, total > 256 (incl. sized params) | **E10118** (word remedy wording) | ✅ | Ch 08 AR-3, AR-9 |
| unsized param | ✅ | ✅ | AR-5 |

Signed/boolean indexes stay E10114; static bounds E10115 folds only when the size is known
(sized forms; unsized params have no static bound).

### Intrinsic queries

- `length(sizedParam)` folds to the declared count (Ch 08 §9 table) through the existing
  engine folder — the symbol's type carries the size.
- `length(unsizedParam)` → **E10080** with the explicit-length remedy (AR-10).
- `sizeof(T[])` (unsized type argument) → E10080 same family (no size exists).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| const arg → mutable by-ref param | E10122 (registered new, Ch 08 number) | AR-6/AR-9 |
| write through const param (any chain, compound incl.) | E10123 (registered new) | AR-6 |
| word index on ≤256 B array/param | E10117 (unchanged wording) | AR-9 |
| byte index on >256 B array/param | E10118 (wired; word-cast remedy) | AR-9 |
| `length()` on unsized param / `sizeof` unsized | E10080 reuse, bespoke message | AR-10 |
| sized-param size/type mismatch | E10171 (natural assignability failure) | AR-9 |
| unsized annotation outside params | 7a behavior unchanged (inference or its error) | AR-5 |
| same root symbol twice in one call's by-ref args | W10112 warning | AR-8 |
| declared array > 256 B | W10142; ≥25% platform RAM also W10143 | AR-9/AR-11 |

## Integration Points

- Pass order unchanged (7a): collect → declarations → module vars → imports → shadowing →
  resolveTypes (engine + finalize + boundary) → bodies → typeCheck. Param finalization rides
  the existing Pass-2 finalizer.
- SFA consumes `byRef`/aggregate param types ([03-03](03-03-sfa-pointers.md)); lowering
  consumes const-ness not at all (CP-4 — constness is compile-time only).

## Testing Requirements

- Spec tests: the full CP-2 matrix, CP-5 chains, tier table above, unsized both-widths,
  length/sizeof rules, W10112/W10142/W10143 emission + non-emission (ST-6..ST-24b).
- Impl tests: `assignmentRootSymbol` through pair-rooted chains; signature resolution with
  `Mod.Type` + const-expr-sized param annotations; unsized never escaping param symbols.
