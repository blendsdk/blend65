# Parser & AST: const params + unsized array params

> **Document**: 03-01-parser-params.md
> **Parent**: [Index](00-index.md)

## Overview

The smallest component: parameter declarations gain the optional `const` qualifier
(`param = identifier , ":" , [ "const" ] , type`) and the AST carries it. Unsized `T[]`
already parses (`parse-type.ts:82-101` leaves `ArrayTypeNode.size: null` when `[` is followed
by `]`); no parser work for unsized — its legality-by-context is semantic ([03-02](03-02-param-semantics.md)).

The EBNF appendix (`grammar.ebnf.md:89-90` `param`, `:118-126` `type`) supports neither form;
the normative chapters (Ch 08 §7 CP-1, §8.2) require both. Grammar-appendix drift is recorded
per the 7a AR-3 precedent (AR-6 here).

## Architecture

### Current
`parseParameter` (`parse-decl.ts:53-73`): identifier, `:`, `parseType` — no modifier handling.
A `const` token after the colon lands in `parseType`'s else-branch → E10303 without consuming.

### Proposed
After consuming the colon, `parseParameter` checks for `TokenKind.KwConst`; if present,
consumes it and sets the flag. `const` is valid ONLY in this position — everywhere else
`parseType` behaves as today (a `const` in a non-param type annotation still E10303s).

## Implementation Details

### AST change (no new node kind — the AST stays 51 kinds, AR-6)

```ts
// core/src/ast/nodes.ts
export interface ParameterNode {
  readonly kind: "Parameter";
  readonly name: string;
  readonly nameSpan: Span;
  /** CP-1: read-only parameter — writes through it reject at typing. */
  readonly isConst: boolean;          // NEW
  readonly paramType: TypeNode;
  readonly span: Span;
}
```

All construction sites in `parse-decl.ts` set it; the visitor/walk/printer need no structural
change (no child nodes added). The AST printer includes `const ` in the param rendering so
`--emit-*` textual dumps round-trip the qualifier.

### Parser change

```ts
// parse-decl.ts parseParameter — after the colon:
const isConst = cursor.check(TokenKind.KwConst);
if (isConst) cursor.advance();
const paramType = parseType(state);
```

No new diagnostics: a malformed type after `const` falls into the existing `parseType`
recovery (E10303 at the offending token).

## Integration Points

- `function-collection.ts` reads `param.isConst` → `Symbol.mutable = !isConst` ([03-02 §Symbols](03-02-param-semantics.md)).
- The AST corpus test (node-kind exhaustiveness) gains a `const`-param + unsized-param sample;
  the 51-kind count is unchanged (spec-tested).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `const` outside param position (e.g. `let x: const byte`) | unchanged — `parseType` E10303 (not a 7b surface) | AR-6 |
| `function f(p: const): void` (missing type) | existing `parseType` E10303 recovery | AR-6 |
| unsized `[]` anywhere | parses (`size: null`); context legality is semantic | AR-5 |

## Testing Requirements

- Spec tests: `const` param parses with the flag set; scalar + aggregate + unsized combinations;
  `const` outside params still rejects; printer round-trip (ST-1..ST-5, [07](07-testing-strategy.md)).
- Impl tests: recovery inside param lists; trailing-comma/EOF edges around `const`.
