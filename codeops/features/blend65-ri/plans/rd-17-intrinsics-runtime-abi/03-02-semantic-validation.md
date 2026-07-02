# Semantic Validation: RD-17

> **Document**: 03-02-semantic-validation.md
> **Parent**: [Index](00-index.md)

## Overview

The first *real* semantic checking in the compiler: the intrinsic-validation rules
RD-04 deferred to this RD (R95–R100, R19, R59 — PF-001), implemented inside the
existing passthrough seams. This is deliberately NOT the full RD-04b checker: scope is
intrinsic calls, reserved-name declarations, the T4 import boundary, and the minimal
declaration collection folding needs (AR-P6, AR-P13).

## Architecture

### Current
`analyze()` returns an empty model; `passes.ts:32-76` seams are no-ops.

### Proposed

```
frontend/src/semantics/
├── analyze.ts                # AnalyzeInput += optional `registry` (AR-P3)
├── passes.ts                 # collectDeclarations + checkBodies gain real work
├── declaration-collection.ts # NEW — minimal type table (AR-P13)
└── intrinsic-validation.ts   # NEW — the checks below
```

`AnalyzeInput.registry?: IntrinsicRegistry` — when absent, `createIntrinsicRegistry()`
(core-only) is constructed internally, so existing callers/tests are unaffected
(non-breaking, per `analyze.ts` F1-Extensible design).

## Implementation Details

### Declaration collection (AR-P13 — minimal)
Walk top-level declarations only, producing:
- struct/enum names → `StructType`/`EnumType` (via existing `type-utils`; fields with
  offsets + `byteSize`),
- variable/array declarations → declared `Type` (for literal-arg checks and `length`),
- imports per module → the set of imported names + source module identifier.
No expression inference, no control-flow analysis, no scope tree beyond module-level.

### Intrinsic-validation checks (per call site / declaration)

| # | Check | Diagnostic | Source |
|---|-------|-----------|--------|
| V1 | Args passed to a parameterless intrinsic | E10040 | RD-04 R59 |
| V2 | Wrong arg count | E10041 | RD-04 R59 |
| V3 | Literal arg kind/range vs signature (byte 0–255, word 0–65535, …) | E10171 (existing `ArgTypeMismatch`) | RD-04 R59, AR-P6 |
| V4 | `availability(profile) === false` | E10043, AR-P11 message | R22, AC-04 |
| V5 | User declaration shadowing a reserved name (`registry.isReserved`) | E10101 | R20/R21, AC-03 |
| V6a | T4 intrinsic called without `import { name } from <platformId>;` (platform matches target) | **E10046 `IntrinsicNotImported`** | R19, AC-05, AR-P14 |
| V6b | T4 intrinsic whose contributing platform ≠ active target | **E10043** (availability — R25 keys the predicate on `platformId`) | R25, AC-06, AR-P14 |
| V7 | `sizeof`/`offsetof` type arg resolves; `offsetof` field exists | E10171 | Ch 12 §3.3 |
| V8 | `asm_sed` without matching `asm_cld` in the same function | W10120 | R40, AR-P12 |

> **Decision per AR-P14 (user chose Option A):** the two failure modes get distinct,
> actionable codes. Wrong-platform T4 → **E10043** (it *is* availability; R25).
> Unimported-but-right-platform T4 → **E10046 `IntrinsicNotImported`**, message
> `"'<name>' requires 'import { <name> } from <platform>;'"`. Spec tests distinguish
> AC-05 from AC-06 by code, not message text. Non-intrinsic unknown calls keep today's
> behavior (general resolution deferred — RD-04b).

Non-literal args (variables, expressions): V3 passes them through (AR-P6) — the
checks that need no types (V1/V2/V4/V5/V6/V8) still apply fully.

### Wiring
- `collectDeclarations` seam → declaration collection; `checkBodies` seam → an AST walk
  (existing `core/ast/walk` helpers) invoking V1–V8 on `IntrinsicCallExprNode` and
  declaration nodes. Never throws; diagnostics via the bag (RD-04 AC-01 preserved).
- The pass runs identically for core and platform intrinsics (AC-17 — no name
  special-casing; everything dispatches on the descriptor).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Unknown intrinsic-looking call (in `RESERVED_BUILTINS` but somehow not in registry) | ICE `E90001` — catalog/reserved-set drift is a compiler bug | AC-01 |
| Registry absent in `AnalyzeInput` | Construct core-only registry internally | AR-P3 |
| `offsetof` on a non-struct type / missing field | E10171 with field/type named | Ch 12 §3.3, AR-P11 style |

## Testing Requirements
- Spec: one ST per V-check (07-testing-strategy.md ST-10..ST-22), both fire-and-clean cases.
- Impl: multi-module import visibility, enum/struct table edge cases, walker recursion depth, no-throw fuzz reuse (parser's ST-P34 pattern).
