# Unified Const/Type Engine: RD-18 Slice 7a

> **Document**: 03-03-const-engine.md
> **Parent**: [Index](00-index.md)

## Overview

Completes the const evaluator (ledger R88–R94) as ONE lazy, memoised, on-demand engine spanning
both mutually recursive domains — const values and type sizes (AR-6) — with exact path-carrying
cycle detection (AR-5/AR-23). This is the third instance of the shipped pattern
(`declaration-collection.ts` `inProgress` sizing; 5b declaration-order-independent const
completion).

## Architecture

### Current
`evalConst(expr, resolveRef?, typeOf?)` (`const-eval.ts:143`) folds scalars width-aware
(Slice 6) but knows nothing of enum members, `sizeof`/`offsetof`/`length`, or aggregates.
Struct sizing is a separate eager recursion in `declaration-collection.ts`. Module-const
completion (5b) resolves refs declaration-order-independently with const-const cycles → E10194.

### Proposed changes

1. **One evaluation context** with a memo table + an ordered in-progress stack whose keys span
   both domains: `const:<Module>.<name>`, `structLayout:<Module>.<Name>`,
   `enumValues:<Module>.<Name>`. Re-entry of an in-progress key = a cycle: emit ONE diagnostic
   carrying the full path (stack slice), poison every participant, continue.
   Cycle code split per AR-23: any `const:` node in the cycle → **E10194**; pure
   `structLayout:` cycles → **E10165**. Memoisation bounds total work at O(decls + fields) —
   the RD-18 bounded-evaluation security requirement, no depth constant (AR-5).
2. **`evalConst` grows the aggregate-aware arms** (existing scalar folds untouched — the
   Slice-6 spec tests are the immutable oracle):
   - `FieldAccessExpr` whose head resolves to an enum type → the member's byte value
     (`Direction.UP` → 0); unknown member → E10160 (AR-13 table)
   - `IntrinsicCallExpr` `sizeof`/`offsetof`/`length` → folded via the engine (below)
   - `CastExpr` to enum → value as-is unchecked (EN-10, AR-12); enum value into integer
     contexts → byte semantics
3. **Query-intrinsic folding** (R60, RD-06 R48):
   - `sizeof(T)` — primitive sizes; struct → `structLayout` request; enum → 1; `sizeof(byte[N])`
     → N × elemSize (type-arg arrays legal per Ch 02 TS-21)
   - `offsetof(S, f)` — layout request + field offset
   - `length(a)` — argument must name a fixed-size array symbol (module or local, incl.
     `Mod.arr`); its `ArrayType.size` (spec 08 §9 explicitly allows const/size positions;
     unsized params are 7b). Non-array argument → E10171 (existing validation pattern)
   - Result typing is value-dependent (AR-16) under the representability rule (AR-25, accepted
     spec drift per PF-005): folded value ≤255 → `byte`, ≥256 → `word` — for ALL three
     intrinsics. Ch 08 §9's literal "`byte` for arrays ≤256 elements" would make
     `length(byte[256])` = 256 unrepresentable; `byte[256]` is legal tier-1 input, so `length`
     on it types `word` and `let n: byte = length(buf256)` correctly demands a cast (E10154).
     The catalog's fixed return types become validation-only
4. **Array-size evaluation** (R89/R101): `ArrayType.size` expressions evaluate through the
   engine (so `const N: byte = 8; let a: byte[N*2];` and `byte[sizeof(Point)]` work);
   validation codes per 03-02 §4.
5. **Aggregate const IMAGES** (R64/R103): `ConstValue` gains an aggregate variant
   `{ kind: "bytes"; type: Type; bytes: Uint8Array }` alongside the scalar shape. Const arrays:
   every element (and the fill value) must fold — otherwise **E10193**; missing full coverage
   (count < size, no fill) → **E10113**. Const structs: every field folds; nested
   structs/array fields inline at their offsets. Words encode little-endian; element width via
   `toBits` (existing two's-complement helpers). The image feeds `constData` (03-05); const
   aggregates own a data label, NOT a `dataBase` allocation — the 5b "const owns no storage
   symbol" invariant gets exactly this aggregate exception (03-05 §3).
6. **Enum member values** (R69): auto-increment from 0 / previous+1; explicit values through
   the engine (E10230 non-const per AR-13); range per 03-02.

## Integration Points
- 03-02 Pass 2 drives the engine exhaustively (deterministic diagnostic order).
- 03-04 expression typing calls it for const indexes (E10115), intrinsic result typing (AR-16),
  and case-label folding (E10077 path).
- 03-05 lowering consumes `constValues` images for `constData` and scalar inlining unchanged.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `const N = sizeof(S)`, `struct S { a: byte[N] }` | ONE E10194, path `N → S.layout → N` | AR-23 |
| `struct A{b:B} / B{a:A}` | ONE E10165 (pure layout cycle) | AR-5, AR-23 |
| `const T: byte[3] = [1, x, 3];` (x runtime) | E10193 (non-const in const context) | AR-11 |
| `const T: byte[4] = [1, 2];` | E10113 | AR-13 |
| Const div-by-zero inside a size/element | E10082 (existing, R92) | AR-13 |
| Overflow in element vs element type | E10084 value-out-of-range (existing) | AR-13 |

## Testing Requirements
- Spec: ST-10, ST-11, ST-17..ST-26. Impl: memo idempotence, stack hygiene after poisoning,
  order independence (declaration order shuffled → identical results), Slice-6 scalar
  regression.
