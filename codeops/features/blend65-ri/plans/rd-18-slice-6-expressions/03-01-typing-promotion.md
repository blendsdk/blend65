# Typing & Promotion (frontend + core): RD-18 Slice 6

> **Document**: 03-01-typing-promotion.md
> **Parent**: [Index](00-index.md)

## Overview

Grows Pass 3 from the arithmetic-same-type engine to the full spec Ch 02/04
expression system: the complete binary matrix (Ch 02 §5.1/§5.2), TS-4 mixed-width
promotion, unary operators, FR-40 casts, the ternary, TS-17 compound assignment, and
the four new warnings. Everything emits diagnostics + poison — never throws (AR-15
standing from RD-04).

## Architecture

### Current
See 02-current-state §Gaps. One dispatch (`computeType`), same-type-only policy in
`@blend65/core`.

### Proposed changes

**1. Core type policy** (`packages/core/src/semantics/type-utils.ts`)

- `commonType(a, b)`: same-type unchanged; NEW — same-signedness different-width
  integer pair returns the wider type (TS-4). Mixed-sign, boolean-involved, and
  non-primitive pairs still return `null` (caller picks the diagnostic).
- `isAssignableTo(source, target)`: same-type/poison unchanged; NEW — same-sign
  widening (`byte`→`word`, `sbyte`→`sword`) returns `true` (spec §5.3). Narrowing and
  cross-sign stay `false`. **Decision per AR-3** — this single predicate now governs
  assignments, initializers, arguments, and returns; no second rule exists.
- Doc comments updated to describe the implemented policy (drop the "not implemented
  yet" caveats).

**2. Binary typing** (`expression-typing.ts` — `typeBinary` rewrite)

Dispatch by operator class; operands always walked first (map coverage). Literal
adaptation (TS-2, existing lines 149–155) extends to ALL integer-operand classes.

| Class | Ops | Operand rule | Result | Failures |
|-------|-----|-------------|--------|----------|
| arithmetic | `+ - * / %` | integers; `commonType` w/ promotion | common type | boolean → E10080; mixed-sign → E10081 |
| bitwise | `& \| ^` | integers (TS-3; TS-6 excludes boolean) | common type | boolean → E10080; mixed-sign → E10081 |
| shift | `<< >>` | left integer; **right unsigned integer** (Ch 04 §4) | **left type** | boolean left → E10080; signed right → E10083; const right ≥ width → W10174 (result still typed) |
| comparison | `== != < <= > >=` | integers w/ promotion; `boolean == boolean` / `!=` allowed | `boolean` (TS-7) | mixed-sign → E10081; boolean vs integer → E10080; ordered boolean → E10080 (AR-10e) |
| logical | `&& \|\|` | both `boolean` (Ch 04 §6) | `boolean` | non-boolean operand → E10080 |

Shift notes: the right operand's literal adaptation context is `byte`; W10174 fires
via `evalConst` on the amount when it folds to `>= bitWidth(leftType)` (message per
spec Ch 04 §4). The result is still the left type — a warning, not poison.

**3. Unary typing** (NEW `typeUnary`)

| Op | Operand rule | Result | Failure |
|----|-------------|--------|---------|
| `-` | signed integer (TS-8) | operand type | unsigned → **E10087**; boolean → E10080 |
| `!` | `boolean` | `boolean` | non-boolean → E10080 |
| `~` | integer (TS-3; TS-6 excludes boolean) | operand type | boolean → E10080 |
| `&` | — out of surface (Slice 8, AR-11) | silent poison (lowering ICEs loudly) | — |

Negative literals: `-42` is `UnaryExpr(-, NumericLit)`; the literal adapts to the
signed context type first (existing TS-2 path), so `let x: sbyte = -42;` types
naturally and `checkConstRange` folds the whole unary for E10084.

Context propagation: `-` adapts a directly-nested numeric literal to the context
type as above (the TS-2 negative-literal shape). `~` types its operand with **no**
context (TS-9 — the operand's own width governs; a bare literal takes its by-value
default), so `let x: word = ~1;` computes `~1` at byte width (254) and then widens
— const-eval folds with the same operand type (03-02), so fold and runtime agree.
`!` passes no context (boolean operand).

**4. Cast typing** (NEW `typeCast`, FR-40 surface — AR-14)

Target = `resolveTypeNode(expr.targetType)`; operand typed with **no** context type
(TS-9: the operand's own width governs; a bare literal takes its by-value default).

| Case | Result |
|------|--------|
| integer → integer (any of the 16 pairs) | target type (TS-12) |
| `boolean` either side ↔ integer | **E10086** + poison (TS-13) |
| `void`/struct/array either side | **E10155** + poison (TS-13) |
| unknown named type target | poison (resolveTypeNode already poisons; enum casts are Slice 7 — a named-type cast target stays silent-poison until then, AR-11) |
| operand poison | poison, no diagnostic (cascade suppression) |
| const operand that truncates | **W10101** (value + truncated result in message) — via the 03-02 width-fold |

**5. Ternary typing** (NEW `typeConditional`)

1. Condition typed; non-boolean, non-poison → **E10134** (AR-10f — Ch 04 §7.2's
   stale "E10100" is the canonical UndeclaredIdentifier; E10134 is the established
   condition code).
2. Both arms typed **with the incoming `contextType`** (so `let speed: byte =
   isRunning ? 4 : 2;` adapts both literals — TS-2).
3. Result = `commonType(armT, armF)` (§7.3 table = the TS-4 rules). `null` →
   **E10088** naming both types + poison. Poison arm → poison, no diagnostic.
4. `checkConstRange` on each arm against the result type happens at the consuming
   site exactly as for any expression (no special-casing).

**6. Compound assignment** (`typeAssign` growth — TS-17)

For `op !== "="`, semantics are the expanded form `x = x OP e`:

- Target/l-value rules unchanged (E10191 const target — both Ident and qualified
  arms; the existing symbolMap-based qualified check).
- The value types with `contextType = targetType` (literal adaptation: `vel += 1`).
- The **binary rule for the op class** applies to `(targetType, valueType)` — shift
  compounds check the unsigned-amount rule (E10083), arithmetic/bitwise compounds
  check E10080/E10081, producing the expansion's result type via `commonType`.
- The result type must be assignable **back** to the target: `b += w`
  (byte += word → word result) fails narrowing → E10154 with the compound span.
  `score += bonus` (word += byte) promotes and passes (spec TS-17 example).
- `checkConstRange(value, targetType)` as today (catches `b += 300` → E10084;
  `x /= 0` const → E10082).
- Expression result type = target type (as `=`).

**7. Intrinsic argument typing for `lo`/`hi`** (`typeIntrinsicCall` touch-up)

`lo`/`hi` args now type in a `word` context (signature `lo(value: word): byte`,
Ch 04 §9.2; `sword` accepted — same-width signed). A `byte`/`sbyte` argument widens
implicitly under AR-3 (spec: 8-bit `lo` = identity, `hi` = 0/sign — 03-03 §9
handles the 8-bit shapes directly). A `boolean` argument → E10171 (the
argument-mismatch family — the same code every other argument check uses). Other
intrinsics unchanged (out of scope, 01-requirements §Deferred).

**8. Warnings W10160/W10161** (TS-9 — shared helper, called from the four sites)

`checkIntermediateOverflow(valueExpr, valueType, targetType, ctx)` — called at
init/assignment/argument/return checks, AFTER assignability passes:

- Trigger: `valueExpr` is an arithmetic `BinaryExpr` (`+ - *` only — spec excludes
  bitwise/comparison), `valueType` is 8-bit integer, `targetType` 16-bit integer.
- If the expression const-folds (03-02 width semantics): wraps at 8 bits → **W10161**
  (with the wrapped value); provably in range → silent.
- Otherwise → **W10160** (suggests `<word>(a) + <word>(b)` — FR-40 spelling).

### Diagnostic codes (registry-only, additive — AR-10, AR-115 precedent)

| Code | Key | New/Reuse | Message shape |
|------|-----|-----------|---------------|
| E10086 | `BooleanIntegerCast` | mint (spec-Ch-02-numbered) | Cannot cast `<from>` to `<to>` — boolean is not convertible to/from integer types |
| E10087 | `NegateUnsigned` | mint | Cannot negate unsigned type `<type>` — use `sbyte`/`sword` for signed arithmetic |
| E10088 | `TernaryArmMismatch` | mint | Conditional operator arms have incompatible types `<a>` and `<b>` |
| E10083 | `ShiftAmountNotUnsigned` | reuse, key renamed (never emitted) | Shift amount must be unsigned (`byte` or `word`) — found `<type>` |
| E10155 | `InvalidCast` | reuse (never emitted) | Cannot cast `<from>` to `<to>` — only integer types support casts |
| W10101 | `NarrowingCastTruncates` | mint | Narrowing cast from `<from>` to `<to>` truncates value `<v>` to `<r>` |
| W10160 | `IntermediateOverflow` | mint | `<narrow>` arithmetic may overflow before widening to `<wide>` — use `<wide>(a) <op> <wide>(b)` |
| W10161 | `ConstOverflowBeforeWidening` | mint | Constant expression overflow — wraps to `<value>` at `<type>` width before widening |
| W10174 | `ShiftCountExceedsWidth` | mint | Shift amount `<N>` >= type width (`<W>` bits) — result is always 0 |

E10080 (boolean operand / ordered-boolean-comparison), E10081, E10084, E10082,
E10134, E10152/E10153/E10154, E10191 are reused as already wired.

## Integration Points

- `statement-typing.ts`: `typeCondition` needs NO change — logical/comparison
  expressions now genuinely type `boolean` (the E10134 non-boolean path keeps
  working; previously-silent poisons become real types).
- `typeCall`/`checkReturnAssignable`: no structural change — the AR-3 widening rides
  the shared `isAssignableTo`. The E10171/E10154-family message wording gains the
  FR-40 cast suggestion.
- 5a/3b pinned spec tests that assert strict same-type rejections for
  **same-sign widening** shapes are superseded by AR-3 (documented per-test at the
  execution task — 5b ST-6 precedent; the immutable-oracle rule binds tests to the
  SPEC, and the spec says widening is legal). The load-bearing pins live in
  `packages/core/src/semantics/type-utils.spec.test.ts` (`isAssignableTo(byte,word)
  → false` at :89; `commonType(byte,word) → null` at :107) — value-shaped
  assertions with no E-code; the frontend suites pin only narrowing/cross-sign
  shapes, which all stay valid.
- Lowering reads promotion decisions from `typeMap` (03-03 §coerce) — no new model
  fields.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Mixed-sign operands (any class) | E10081 + poison | AR-10 |
| Boolean operand in numeric/ordered position | E10080 + poison | AR-10 |
| Signed shift amount | E10083 + poison | AR-10 |
| Unary `-` on unsigned | E10087 + poison | AR-10 |
| Boolean↔integer cast | E10086 + poison | AR-10 |
| void/struct/array cast | E10155 + poison | AR-10 |
| Ternary arm mismatch | E10088 + poison | AR-10 |
| Ternary non-boolean condition | E10134 + typed-as-common-arms (condition poison stays silent) | AR-10 |
| Compound-assign expansion fails | binary-class code, then assignability family on the write-back | AR-10 |
| All of the above | diagnostic + `ERROR_TYPE`, never throw; cascade suppression via poison | — |

## Testing Requirements

Spec expectations in 07-testing-strategy ST-1…ST-18 (typing tier). Impl tests: the
full §5.1/§5.2 matrix sweep (25 pairs × representative op per class), literal
adaptation per class, compound-assign class dispatch internals, W-emission triggers
and non-triggers.
