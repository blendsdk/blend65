# RD-02 Lexer — Current State

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Purpose**: Snapshot of the repository as the lexer plan begins — what already exists,
> what the lexer consumes, and the gaps this plan must close.

## 1. `@blend65/frontend` — empty but wired

The lexer's owning package is a v1 "empty but wired" scaffold (RD-01):

```
packages/frontend/
  package.json        # name @blend65/frontend; deps: { "@blend65/core": "0.1.0" }
  tsconfig.json
  vitest.config.ts    # include: ["src/**/*.spec.test.ts"]   ← spec tier only
  src/
    index.ts          # export const VERSION = "0.1.0";
    index.spec.test.ts
```

- **`src/index.ts`** exports only `VERSION`. No lexer code exists.
- **Dependency edge** `@blend65/frontend → @blend65/core` already exists in
  `package.json` — exactly the edge the lexer needs (no new dependency required).
- **No edge to `@blend65/codegen`** — and this plan must not introduce one (R15/AR-20,
  FR-39).

### Gap 1 — vitest include glob (impl tier)

`packages/frontend/vitest.config.ts` currently includes only `src/**/*.spec.test.ts`. The
lexer's unit tests use the `*.impl.test.ts` tier (logic tests), exactly as RD-11a did for
`@blend65/core`. **Action (Phase 1):** widen the glob to
`src/**/*.{spec,impl}.test.ts` — a per-package config change (AR-P8), identical to the
RD-11a precedent (its plan task 1.2).

## 2. `@blend65/core` — diagnostics core present, token vocabulary absent

RD-11a is implemented and frozen. The lexer consumes it directly.

### Available now (consumed by the lexer)

`packages/core/src/index.ts`:

```typescript
export const VERSION = "0.1.0";
export * from "./diagnostics/index.js";
```

The diagnostics barrel exports everything the lexer needs:

| Symbol | Shape | Lexer use |
|--------|-------|-----------|
| `type SourceId = number` | — | `lex(sourceId, …)` parameter |
| `interface SourceSpan` | `{ sourceId, start, end }` | embedded in every `Token` (AR-L3) |
| `makeSpan(sourceId, start, end)` | clamps `end ≥ start` | build token spans |
| `class LineMap` | `new LineMap(sourceId, text)`; `getLineCol`, `getUtf16Column`, `getLineText` | built once, returned in `LexResult` (AR-L1/L2) |
| `interface Diagnostic`, `Severity` | — | produced via the bag |
| `DiagnosticBag` + `createDiagnosticBag` | `addError/addWarning/addICE/…` | lexer appends here (FR-32) |
| `DiagCode`, `DiagCodeValue`, `isIceCode` | string-valued `const … as const` | code registry (extended by AR-L5) |

The `DiagnosticBag.addError/addWarning` signatures the lexer calls:

```typescript
addError(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
addWarning(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
```

A lexer call site is therefore simply `bag.addError(DiagCode.UnterminatedString, token.span, "…")`.

### Gap 2 — token vocabulary missing

`@blend65/core` has **no** `TokenKind` or `Token`. Per AR-L4/L6/L3 this plan adds a new
`packages/core/src/tokens/` module:

- `token-kind.ts` — `TokenKind` (string-valued `const`, 77 members) + `TokenKindValue`.
- `token.ts` — `interface Token { kind; span: SourceSpan; value? }`.
- `index.ts` — barrel, re-exported from `packages/core/src/index.ts`.

### Gap 3 — lexer diagnostic codes missing

`diagnostic-codes.ts` (the frozen RD-11a registry) does **not** yet contain the Ch 01
lexer codes. Its docstring already anticipates this: *"When a future requirement (e.g.
RD-02's lexer) needs a code, it is added here — the one registry."* **Action (Phase 1):**
add E10210, E10211, E10213–E10224 (errors) and W10210 (warning) as named `DiagCode`
members — **addition only**, the existing RD-11a entries untouched (AR-L5). `E10212` is
**not** added (RD-04 owns it).

## 3. Frozen baselines (must not change)

| Baseline | Constraint |
|----------|------------|
| `spec/01-lexical-structure.md` | Frozen spec-v3.0 (D3). The authority for every lexer rule. Read-only. |
| `spec/14-diagnostics.md` | Frozen code registry. Lexer codes are transcribed from Ch 01 §14 / Ch 14. |
| RD-11a code (`source-span.ts`, `line-map.ts`, `diagnostic.ts`, `diagnostic-bag.ts`) | Extended-not-refactored (AR-Q2). `diagnostic-codes.ts` is the one file edited, by addition only. |
| `test/boundary.spec.test.ts` (R15 tier) | Must stay green; no new `frontend → codegen` edge. |

## 4. Tooling expectations

- **Test framework:** Vitest; per-package `vitest run`, plus the root R15 boundary tier.
- **Verify command:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
- **CI:** no emulator tier (AR-27); the lexer is verified at the unit/spec/golden tiers
  only. Emulator/golden-binary tiers arrive with RD-12.
- **Module system:** ESM, NodeNext; relative imports use `.js`.

## 5. Summary of gaps this plan closes

1. **Gap 1** — widen `frontend` vitest glob to include `*.impl.test.ts`.
2. **Gap 2** — add `TokenKind`/`Token` vocabulary to `@blend65/core` (`tokens/` module).
3. **Gap 3** — add lexer diagnostic codes to the core registry (addition-only).
4. **Core deliverable** — implement `lex()` + scanners + `KEYWORD_MAP` in `@blend65/frontend`.
5. **Export** — wire `lex`/`LexResult` (frontend) and `TokenKind`/`Token` (core) into public entries.
