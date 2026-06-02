# Current State: RD-03 Parser & AST

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists (as-built, verified 2026-06-02)

The parser builds directly on two frozen, green deliverables:

- **RD-11a diagnostics core** — `SourceSpan`, `SourceId`, `LineMap`, `Diagnostic`,
  `DiagnosticBag`, `DiagCode` registry. Frozen; extended only by addition (AR-Q2).
- **RD-02 lexer** — `lex(sourceId, text, bag): LexResult`, `Token`, `TokenKind` (79 members),
  `KEYWORD_MAP`. Frozen; consumed as-is.

`@blend65/frontend` currently exposes only the lexer; there is **no `parser/` directory** and
**no `ast/` module** in `@blend65/core`. This plan creates both.

### Relevant Files

| File                                                    | Purpose                                  | Changes Needed                                          |
| ------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `packages/core/src/index.ts`                            | core barrel                              | Add `export * from "./ast/index.js";`                   |
| `packages/core/src/tokens/token-kind.ts`                | `TokenKind` (79 members), incl. `KwType` | **Consume only** — no change                            |
| `packages/core/src/tokens/token.ts`                     | `Token { kind, span, value? }`           | **Consume only** — no change                            |
| `packages/core/src/diagnostics/source-span.ts`          | `SourceSpan`, `SourceId`, `makeSpan`     | **Consume only** — no change                            |
| `packages/core/src/diagnostics/diagnostic-bag.ts`       | `DiagnosticBag` (`addError`/`addWarning`)| **Consume only** — no change                            |
| `packages/core/src/diagnostics/diagnostic-codes.ts`     | `DiagCode` registry                      | **Add** E10072 + E10300–E10316 (addition-only, AR-6)    |
| `packages/core/src/ast/*`                               | (does not exist)                         | **Create** node-kind, nodes, visitor, walk, reserved-builtins, index |
| `packages/frontend/src/index.ts`                        | frontend barrel                          | Add `export * from "./parser/index.js";`                |
| `packages/frontend/src/lexer/*`                         | lexer                                    | **Consume only** — `lex()` feeds the parser             |
| `packages/frontend/src/parser/*`                        | (does not exist)                         | **Create** cursor, pratt, parser, index + tests         |
| `requirements/RD-03-parser-ast.md`                      | RD-03 requirements (NOT frozen)          | **Edit** — remove asm-block refs (AR-1)                 |

### Code Analysis — the contracts the parser consumes

**Token (`packages/core/src/tokens/token.ts`):**
```typescript
export interface Token {
  readonly kind: TokenKindValue;     // e.g. "KwModule", "Identifier", "Number"
  readonly span: SourceSpan;         // { sourceId, start, end }
  readonly value?: number | string;  // Number → number; String/Char → raw text
}
```

**SourceSpan / SourceId (`source-span.ts`):**
```typescript
export type SourceId = number;
export interface SourceSpan {
  readonly sourceId: SourceId;
  readonly start: number;  // inclusive UTF-8 byte offset
  readonly end: number;    // exclusive UTF-8 byte offset
}
export function makeSpan(sourceId: SourceId, start: number, end: number): SourceSpan;
```
> **AR-4:** AST nodes embed this exact `SourceSpan` as `node.span`. `makeSpan` is reused to
> build a node's span from its first and last token (`makeSpan(sourceId, first.span.start,
> last.span.end)`).

**DiagnosticBag (`diagnostic-bag.ts`):**
```typescript
addError(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
addWarning(code: string, span: SourceSpan | null, message: string, options?: DiagnosticOptions): void;
getAll(): Diagnostic[];   // deterministically sorted by (sourceId, start, code)
hasErrors(): boolean;
```
> A node's span drops straight into `bag.addError(DiagCode.X, node.span, msg)` with no
> re-wrapping (AR-4). The bag already dedups on `(code, sourceId, start)` and sorts
> deterministically — this directly supports cascade suppression (FR-7) and determinism (AC-16).

**Lexer output (`packages/frontend/src/lexer/lexer.ts`):**
```typescript
export interface LexResult {
  readonly tokens: readonly Token[];  // always non-empty; ends with one Eof
  readonly lineMap: LineMap;
}
export function lex(sourceId: SourceId, text: string, bag: DiagnosticBag): LexResult;
```
> The parser consumes `LexResult.tokens`. Tests drive `parse(lex(...).tokens, sourceId, bag)`.

**Diagnostic registry (`diagnostic-codes.ts`) — what already exists vs. what is added:**
- **Already present (reuse):** `MissingModuleDecl: "E10001"`, `ModuleDeclNotFirst: "E10002"`,
  `ReservedKeyword: "E10224"`. Also semantic-band codes the parser does **not** own (E10072 is
  *not* yet present despite the control-flow group — verified absent).
- **Absent (add by addition, AR-6):** `E10072` (missing `default`) and the parser band
  `E10300`–`E10316` (17 codes).

**TokenKind facts relevant to parsing:**
- `KwType` exists (the lexer emits it). `keyword-map.ts` states the **parser** raises E10224
  for it (AR-2).
- `to`, `downto`, `step`, `until` are **not** in `KEYWORD_MAP` — they lex as `Identifier`;
  the parser matches them positionally by `token.value`/text (FR-29).
- `asm_*` names lex as `Identifier` — they are intrinsics (AR-3), not keywords. There is **no**
  `asm` keyword and **no** `ASM_BODY` token (AR-1).

## Gaps Identified

### Gap 1: No AST module in `@blend65/core`
**Current:** core exposes `tokens/` and `diagnostics/` only.
**Required:** a new `ast/` module with 50 node interfaces, `NodeKind` union, `AstVisitor<R>`,
`walkNode`/`walkChildren`, and `RESERVED_BUILTINS`.
**Fix:** create `packages/core/src/ast/*` and wire the barrel (Phase 1).

### Gap 2: No parser in `@blend65/frontend`
**Current:** frontend exposes the lexer only.
**Required:** `parse()`, a token cursor, the Pratt engine, and all parse functions.
**Fix:** create `packages/frontend/src/parser/*` and wire the barrel (Phases 2–5).

### Gap 3: Parser diagnostic codes missing from the registry
**Current:** E10072 and E10300–E10316 are absent.
**Required:** present so call sites reference them by name (`DiagCode.UnexpectedToken`, …).
**Fix:** add them by addition in Phase 1; extend `diagnostic-codes.impl.test.ts`.

### Gap 4: RD-03 requirements contradict the frozen spec (asm blocks)
**Current:** `requirements/RD-03-parser-ast.md` defines `AsmBlockNode` / `ASM_BODY`.
**Required:** removed to match spec Ch 12 §1 (AR-1).
**Fix:** edit the requirements doc in Phase 1 (it is not frozen; only `spec/` is, D3).

### Gap 5: Vitest globs already discover both tiers
**Current:** `packages/frontend/vitest.config.ts` and `packages/core/vitest.config.ts` both use
`src/**/*.{spec,impl}.test.ts`; the root `vitest.config.ts` discovers `*.spec.test.ts`.
**Required:** no change — new `parser.spec.test.ts` / `*.impl.test.ts` are auto-discovered.
**Fix:** none (noted so the plan does not re-touch configs).

## Dependencies

### Internal Dependencies
- `@blend65/core` (RD-11a diagnostics + RD-02 tokens) — frozen, consumed and extended-by-addition.
- `@blend65/frontend` (RD-02 lexer) — frozen, consumed.

### External Dependencies
- None beyond the existing toolchain (TypeScript, Vitest, Turborepo, ESLint).

## Risks and Concerns

| Risk                                                            | Likelihood | Impact | Mitigation                                                                 |
| --------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Parser file exceeds 500-line architecture limit (code.md)       | High       | Med    | Split by concern: `cursor.ts`, `pratt.ts`, `parser.ts` (decls/stmts/exprs split further if needed) |
| Struct-literal vs block ambiguity mis-parsed                    | Med        | High   | Parse-context flag (FR-45); dedicated ST cases (AC-10) before impl        |
| Cast `<T>(e)` vs less-than `<` ambiguity                        | Med        | Med    | Prefix-position dispatch in Pratt (FR-40); ST cases for both              |
| Accidentally importing `@blend65/codegen` from frontend         | Low        | High   | R15 boundary tier (ST-R15a/b/c) runs every phase                          |
| Touching frozen `spec/` or refactoring frozen core              | Low        | High   | `git status --porcelain spec/` gate each phase; codes added by addition   |
| Intrinsic name set drift vs spec Ch 12                          | Low        | Med    | `RESERVED_BUILTINS` derived verbatim from Ch 12 §2–§3; ST case enumerates all 22 |
