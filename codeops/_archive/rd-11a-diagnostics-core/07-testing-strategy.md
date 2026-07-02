# Testing Strategy: RD-11a Diagnostics Core

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Maps to**: RD-11 AC-01..AC-07, AC-10 · FR-1..FR-20

## Approach

Spec-tests-first. Because RD-11a is the first **logic** in the repo, it uses the
`*.impl.test.ts` tier (RD-01 reserved this suffix for logic; AR-P4). Tests live beside the
source in `packages/core/src/diagnostics/` and run under the existing per-package Vitest
config (after the `include` glob is widened to `src/**/*.{spec,impl}.test.ts`; see 02 Gap 2
and the 99 task). All tests are deterministic, node-env, no I/O.

Two tiers:

- **`*.impl.test.ts`** — unit tests of `LineMap`, `DiagnosticBag`, the span helpers, and
  the code namespace. The bulk of coverage.
- **`*.spec.test.ts`** — a thin behavioral spec asserting the RD-11 acceptance criteria
  hold end-to-end (one bag exercised through a realistic producer sequence).

## Test Files

| File                                                    | Tier | Covers                          |
| ------------------------------------------------------- | ---- | ------------------------------- |
| `src/diagnostics/line-map.impl.test.ts`                 | impl | FR-4..FR-8, FR-20 (03-01 cases) |
| `src/diagnostics/source-span.impl.test.ts`              | impl | FR-1..FR-3 (makeSpan clamping)  |
| `src/diagnostics/diagnostic-codes.impl.test.ts`         | impl | FR-17 (namespace, isIceCode)    |
| `src/diagnostics/diagnostic-bag.impl.test.ts`           | impl | FR-11..FR-16, FR-18 (03-02)     |
| `src/diagnostics/diagnostics.spec.test.ts`              | spec | AC-1..AC-8 end-to-end           |

## Spec Test Cases (ST-*)

### Span & LineMap (→ AC-2, AC-3)

- **ST-1** `makeSpan(0, 5, 3)` clamps `end` to `5` (no inverted span). *(FR-2)*
- **ST-2** `getLineCol(0)` on `"abc"` → `{ line: 1, column: 1 }`. *(FR-5)*
- **ST-3** `getLineCol` after a `\n` → line 2, column 1. *(FR-5, FR-8)*
- **ST-4** CRLF (`"a\r\nb"`): offset of `b` → line 2, column 1 (single break). *(FR-8)*
- **ST-5** Bare CR (`"a\rb"`): offset of `b` → line 2, column 1. *(FR-8)*
- **ST-6** Multi-byte: `"é=2bytes"` — byte column of char after `é` is 3, but its UTF-16
  column is 1. *(FR-5, FR-6)*
- **ST-7** Astral: `"😀x"` — `x` byte column 5, UTF-16 column 2 (surrogate pair). *(FR-6)*
- **ST-8** `getUtf16Column` returns **0-based** column (start of line → 0). *(FR-6, AR-Q4)*
- **ST-9** `getLineText` returns the line without its terminator (LF/CRLF/CR). *(FR-7)*
- **ST-10** `offset` past end clamps to last position; no throw. *(FR-5)*
- **ST-11** Leading BOM: `getLineCol(bomLen)` still line 1; no crash. *(FR-20)*
- **ST-12** Trailing `\n`: a final empty line is addressable. *(FR-4)*

### Diagnostic codes (→ AC-8)

- **ST-13** Every `DiagCode` value matches `/^[EW]10\d{3}$/` and equals its Ch 14 code. *(FR-17)*
- **ST-14** `isIceCode("E90001")` true; `isIceCode("E10001")` false; no `DiagCode` value is
  in the ICE band. *(FR-17, AC-8 no-overlap)*

### DiagnosticBag (→ AC-4, AC-5, AC-6, AC-7)

- **ST-15** Fresh bag: `hasErrors()` false, `count()` 0. *(FR-11)*
- **ST-16** `addError` once → `hasErrors()` true, `count()` 1, `getErrors().length` 1. *(FR-11)*
- **ST-17** `addWarning` only → `hasErrors()` false; appears in `getWarnings()`. *(FR-11)*
- **ST-18** Duplicate `(code, sourceId, start)` error → `count()` stays 1. *(FR-14, AC-6)*
- **ST-19** Same code, different `start` → both kept. *(FR-14)*
- **ST-20** Determinism: add out-of-order spans → `getAll()` sorted by sourceId, start,
  code; calling twice yields identical arrays. *(FR-13, AC-5)*
- **ST-21** null-span diagnostic sorts after spanned ones in the same conceptual file. *(FR-13)*
- **ST-22** `maxErrors=3`, add 5 distinct errors → 3 stored + 1 truncation diagnostic;
  `isErrorLimitReached()` true; truncation has null span + `E10000`. *(FR-15, AC-7)*
- **ST-23** After cap reached, `addWarning` still accepted. *(FR-15)*
- **ST-24** After cap reached, `addICE` still accepted (uncapped). *(FR-16)*
- **ST-25** Two identical span-less ICEs (same code) → second deduped. *(FR-14, FR-16)*
- **ST-26** Truncation diagnostic emitted exactly once even if many further errors arrive. *(FR-15)*
- **ST-27** `add*` never throws on null span / empty message / unknown code string. *(FR-18)*

### Export surface (→ AC-9)

- **ST-28** All symbols (`SourceSpan`, `LabeledSpan`, `LineMap`, `Diagnostic`,
  `DiagnosticOptions`, `DiagnosticBag`, `createDiagnosticBag`, `DiagCode`, `IceCode`,
  `isIceCode`, `makeSpan`) are importable from `@blend65/core`. *(FR-19)*

## Coverage Mapping

| AC (RD-11)            | ST cases                          |
| --------------------- | --------------------------------- |
| AC-01 Diagnostic shape| ST-16, ST-28                      |
| AC-02 span model      | ST-1, ST-2                        |
| AC-03 LineMap         | ST-2..ST-12                       |
| AC-04 bag accumulates | ST-15..ST-17, ST-27               |
| AC-05 determinism     | ST-20, ST-21                      |
| AC-06 dedup           | ST-18, ST-19, ST-25               |
| AC-07 max-errors      | ST-22, ST-23, ST-26               |
| AC-10 code bands      | ST-13, ST-14                      |

## Out of Scope (deferred with 11b)

- Renderer output (terminal/JSON) golden tests — arrive with RD-11b.
- Resource-report rendering — arrives with RD-05/RD-09 producers.
- Emulator/runtime tiers — not applicable to pure data structures (CI has no emulator tier,
  AR-27).

## Verify Command

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

All ST cases must pass; `spec/` must remain untouched (`git status --porcelain spec/` empty).
