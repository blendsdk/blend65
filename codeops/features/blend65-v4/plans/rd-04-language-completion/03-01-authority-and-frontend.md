# Authority and Frontend: RD-04 Language Completion

> **Document**: 03-01-authority-and-frontend.md
> **Parent**: [Index](00-index.md)

## Overview

This component proves which Specification 4 obligations exist, then completes lexing, parsing,
modules, scopes and public diagnostics. It owns syntax and source facts only. It does not select
target encodings, machine instructions or artifact layout.

## Architecture

### Current Architecture

`lexSource()` produces exact UTF-8 byte spans. `parseSource()` uses one parser context and a Pratt
expression parser. Module indexing/resolution and body analysis already share stable source-based
binding identities. Poisoned syntax blocks later successful compilation, but `UncheckedSyntax`
currently represents several valid forms whose implementation is pending.

### Proposed Changes

1. Add one checked static completion crosswalk under `test/rd04/` (AR-P6).
2. Complete the token and diagnostic inventory without target character conversion.
3. Extract type/declaration parsing from the oversized parser when that file is touched, while
   keeping one parser state and one Pratt expression owner (AR-P8).
4. Replace each pending syntax region with an exact syntax node or authoritative poison.
5. Complete deterministic module, scope, initialization and diagnostic ordering.
6. Extend the existing overlay analysis to use the same bounded asset resolution as project
   analysis, after applying source overlays so edited asset paths are resolved from the effective
   snapshot. The LSP awaits that frontend result. Keep CLI and LSP on one frontend semantic path
   and retain the frontend/editor backend-import boundary.

## Implementation Details

### Completion Crosswalk

`test/rd04/normative-coverage.json` is the only completion ledger. Its direct validator extracts
the frozen source-key sets and requires exact set equality (AR-P6).

```ts
type CoverageKind = "grammar" | "semantic-rule" | "diagnostic" | "conformance";
type CoverageDisposition =
  | "planned"
  | "implemented"
  | "rd-05"
  | "rd-06"
  | "rd-07"
  | "spec-rejected";

interface CoverageEntry {
  readonly key: string;
  readonly kind: CoverageKind;
  readonly source: string;
  readonly owner: string;
  readonly proof: readonly string[];
  readonly disposition: CoverageDisposition;
}
```

The JSON contains references, not copied semantics. During execution, `planned` rows name a phase
owner and expected proof path; the ordinary validator checks exact source-key coverage and row
shape without requiring future test files to exist. A closeout assertion rejects every `planned`
row and requires existing decisive proof for each terminal disposition. Duplicate, missing,
unknown or malformed keys, paths outside the repository, and a wrong Specification 4 identity
always fail. No production code reads this artifact.

### Lexer Boundary

- `tokens.ts` owns the closed token enumeration.
- `lexer.ts` owns UTF-8 decoding, maximal munch, exact byte spans, literal scalar identity and
  lexical diagnostics.
- Encoding plus character-map selection remains semantic/profile work.
- Invalid bytes, unterminated forms and excessive nesting are bounded and poisoned; they never
  become usable tokens.

### Parser Boundary

- `parser.ts` retains token movement, error budget, span construction and orchestration.
- A focused declaration/type module owns declarations and type syntax extracted from `parser.ts`.
- `statements.ts` owns statement delimiters, synchronization and three-clause `for` structure.
- The existing Pratt parser remains the sole expression-precedence implementation.
- Recovery nodes carry exact poison and synchronization bounds; they do not imitate valid nodes.

This is a responsibility split inside the existing frontend, not a parser framework (AR-P8).

### Modules, Symbols and Diagnostics

- Module identity comes from source declarations, never filenames.
- Stable binding identity continues to use source identity, not spelling.
- Function parameters and the outer function body share one duplicate domain.
- `for` headers and bodies receive the distinct scopes specified by RD-04.
- Initializer dependencies and independent ordering are deterministic.
- `diagnostics.ts` remains the producer boundary. A compact registry data module may be extracted
  only if required to keep the touched implementation below the file-size limit (AR-P8).
- Public fields are copied exactly from Specification 4 Chapter 14. Implementation-only service
  failures remain internal and cannot masquerade as language diagnostics.
- Phase 1 proves registry completeness and diagnostics owned by its frontend forms. Later phases
  prove their own diagnostic producers; the full Chapter-14 sweep runs in Phase 8.

## Integration Points

| Producer | Consumer | Contract | AR Ref |
|---|---|---|---|
| Lexer | Parser | Exact token kind, payload and UTF-8 byte span | AR-P1 |
| Parser | Module/semantic analysis | Complete node or explicit poison; no pending valid form | AR-P1 |
| Module graph | Semantic analysis | Stable binding and deterministic reachable graph | AR-P8 |
| Frontend service | CLI/LSP | Identical canonical diagnostic records for the same snapshot, including embedded sources, before adapter rendering; no backend import from frontend/LSP | AR-P7 |
| Crosswalk | Tests only | Static completeness proof; no product dependency | AR-P6 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Frozen source key missing from crosswalk | Fail the direct crosswalk test | AR-P6 |
| Malformed UTF-8 or literal | Emit its canonical lexical diagnostic and poison exact bytes | AR-P1 |
| Syntax error | Recover only at grammar-owned boundaries; retain exact primary/related spans | AR-P1 |
| Duplicate/reserved name | Emit the canonical code once with ordered related location | AR-P1 |
| Any frontend error | Return analysis failure and suppress build/run publication | AR-P3 |

## Testing Requirements

- Exact token, payload, span, maximal-munch and lexical-diagnostic matrices.
- Complete grammar, precedence, associativity, recovery and removed-syntax matrices.
- Multi-file module, scope, initializer-order and diagnostic-order tests.
- Crosswalk exact-set, duplicate, unknown, missing-proof and frozen-identity tests.
- CLI/LSP canonical diagnostic-record identity, including embedded sources, and frontend/LSP
  forbidden-import boundary tests. Text and LSP renderings may differ.
