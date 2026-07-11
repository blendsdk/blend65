# Aggregate Expression Typing: RD-18 Slice 7a

> **Document**: 03-04-aggregate-typing.md
> **Parent**: [Index](00-index.md)

## Overview

Replaces every silent-poison arm in the Slice-6 expression engine with real aggregate typing:
indexing, member access, literals, enum semantics, assignability/cast/comparison policy, the
switch-on-enum surface, and the aggregate param/return rejections.

## Implementation Details

### 1. Head resolution (one namespace, AR-24)
`typeFieldAccess`'s ladder (extending 5b's value-first `resolveQualified`) classifies the head:
value symbol → struct field access; enum type → member access; module → 5b qualified surface
(now including types and const arrays). Chains compose left-to-right at postfix precedence:
`a[i].f`, `s.f[i]`, `Mod.Enum.Member`, `Mod.arr[i]`, `player.pos.x`.

### 2. IndexExpr (R57, R101–R105)
- object: `ArrayType` required; anything else → E10080 (AR-22)
- index: unsigned integer; signed/boolean/non-integer → E10114; **word index on a tier-1
  (≤256 B) array → E10117** (AR-14; explicit `<byte>(i)` remedy in the message); E10118 stays
  registered for 7b (tier-2 arrays reject at declaration in 7a, 03-02 §4)
- const index: fold via the engine; out of `0..size-1` → E10115
- result: element type; l-value legal (grammar §5.3)

### 3. FieldAccessExpr (R56, R18)
- struct object → field lookup in `StructType.fields`; unknown → E10160; result = field type;
  l-value legal; nested chains recurse
- enum-type head → member lookup; unknown → E10160 (AR-13 table); result = that `EnumType`,
  value const-folded (03-03 §2)
- non-struct/non-enum/non-module head → E10080 (AR-22)

### 4. Literals
- **StructLitExpr** (R62): resolve `typeName` (03-02 §4 rules incl. `Mod.Type`); every field
  present → else E10161; no extras → E10162; declaration order → else **E10097** (AR-9 as
  amended at preflight — Ch 07's own published code); field
  values assignable to field types → else E10152 (array-typed fields take array literals —
  AR-11 compositionality; nested struct literals recurse). Result: the `StructType`.
- **ArrayLitExpr**: contextual typing — the expected type comes from the annotation / struct
  field / assignment target (there is no free-standing array literal type; a literal with no
  expected array type → E10080 AR-22). Elements + fill assignable to the element type
  (E10152); count > size → E10152 array wording (AR-22); count < size without fill: `let` →
  W10140, `const` → E10113 (03-03 §5); fill with unsized annotation → **E10126** (AR-21);
  size inference for `byte[]` = element count.
- Empty `[]`: inferred size 0 → E10111.
- **Statement-position literals** (AR-18/AR-26, PF-007): an `ExpressionStmt` whose expression
  is a struct/array literal → **E10157** ExpressionStatementNotACall (grammar §5.4: only calls
  are valid expression statements; the general rule for other expressions stays a deferred
  ledger row — 7a wires the aggregate-literal instance so the new literals can never fall
  through to lowering).
- **String array-initialisers** (AR-2/AR-26, PF-007): a `StringLitExpr` initialising an array
  → loud unsupported-until-Slice-8 rejection (the aggregate-param mechanism), never silent
  poison — the form is legal per frozen Ch 08 and lands with the Slice-8 string/encoding
  surface.

### 5. Assignability & operators (extends `isAssignableTo` beyond primitives)
- arrays: never assignable as wholes — `a = b` → **E10119**; `==`/`!=` → **E10121**; ordered →
  E10080 (AR-13)
- structs: same nominal struct → assignable (whole-struct COPY, R37); different → E10152;
  any comparison → E10080 (R38)
- enums (EN-8/9): same enum → OK; enum → byte implicit (the ONLY implicit); byte/other-enum →
  enum → E10152; enum → word/sword NOT implicit; `==`/`!=`/ordered vs same enum or byte → OK
  (byte comparisons via the widening); cross-enum comparison → E10080 (R50); arithmetic/bitwise
  on enums → operate as byte, result byte (09 §8)
- casts (FR-40 surface, AR-12): `<byte>(enumVal)`, `<word>(enumVal)`, `<EnumName>(intExpr)` all
  legal single-step, zero-cost, value unchecked (EN-10); `<EnumA>(enumB)` → E10155; casts
  to/from struct/array stay E10155 (Slice 6 wiring, now with named-type targets resolved)
- `typeAssign` gains IndexExpr/FieldAccessExpr target arms (const propagation: assignment
  through a `const` aggregate → E10191 family unchanged)

### 6. Functions (7a boundary, AR-1)
- return type `ArrayType` → **E10120**; `StructType` → **E10093** (permanent rules, at
  function-collection); enum returns legal (byte-sized)
- parameter of array/struct type → loud 7a-unsupported rejection (belt at function-collection,
  braces at lowering — 5a two-guard precedent); enum params legal
- aggregate argument to a call → follows from param rejection; enum args widen per EN-9

### 7. Switch on enum (R75/R76 remainder, 4b deferral)
- enum discriminant legal (E10075's message already anticipates it); case values must be
  members of THAT enum (or explicit casts to it) → else **E10077** (first live emission);
  integer discriminant with an enum-member case value: legal via EN-9 widening; duplicate
  values → E10132 on folded bytes; NO exhaustiveness check (AR-4); `default` optional
- `typeCondition`/`typeFor` etc. unchanged (enums are not boolean/integer — loop counters and
  conditions reject enums via existing E10065/E10134)

### 8. Warnings
- W10140 (partial `let` array init), W10141 (uninitialised `let` array) — minted + emitted at
  declaration typing (AR-17)

## Error Handling
Owned codes cited inline above; full assignments in AR-13/21/22/26 (register). No new codes
beyond those rows.

## Testing Requirements
- Spec: ST-27..ST-48 (incl. ST-44a/ST-44b). Impl: chain-typing torture (mixed `[i]`/`.f` nesting), poison
  propagation, `typeMap` completeness for aggregate nodes (ledger AC-14).
