# Source and Syntax: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P3, AR-P4, AR-P5, AR-P6

## Ownership and Internal Interfaces

| File under `packages/compiler/src/frontend/` | Responsibility |
|---|---|
| `tokens.ts` | Token kind constants/types and literal payloads |
| `lexer.ts` | Source scanning and lexical recovery |
| `syntax.ts` | Discriminated syntax nodes and stage result types |
| `parser.ts` | Declaration/type parsing and cursor/recovery |
| `expressions.ts` | Single Pratt expression parser |
| `statements.ts` | Blocks and admitted statements |
| `diagnostics.ts` | Direct diagnostic construction/order helpers; no new policy framework |

These are focused feature modules, not mandatory classes or pre-created shells.
Small helpers may stay with their consumer. Split only when an actual module
approaches the project's size limit. Public/exported TypeScript symbols receive
JSDoc even though the service is currently internal (AR-P2, AR-P4).

Planned implementation-blind test entry signatures:

```typescript
lexSource(source: SourceRecord): LexResult;
parseSource(source: SourceRecord): ParseResult;
readModuleHeader(source: SourceRecord): HeaderResult;
```

`SourceRecord`, `SourceSpan` and `ProjectDiagnostic` are imported from the existing
project types, with type-only imports. No filesystem, target/backend module,
compiler-root barrel or external tool is imported into `frontend/`.

## Tokens and Source Coordinates

Chapter 01 §12 owns the 83 token kinds and spellings; use its names as a closed
constant/type union, not an extensible registry. Each token has `kind`, exact
`span`, one-based byte `line`/`column` and its decoded payload when applicable.
Recover raw spelling by slicing original text through trusted byte boundaries;
do not put a radix prefix in the normalized numeric value. EOF spans
`[byteLength, byteLength)`.

`LexResult` contains readonly tokens including EOF, readonly diagnostics and a
`complete` boolean. Lexical completion means scanning obligations finished, not
source validity or semantic acceptance. Invalid token regions carry explicit
poison/recovery state, never a fabricated number, identifier or literal value.

Leading BOM is skipped as syntax but still occupies bytes 0–2. Original CRLF and
bare CR remain raw input. Unicode comments are discarded, not AST declarations.
Literal payloads preserve Unicode scalars, exact-byte `\xNN` items and symbolic
escapes; target conversion waits for its qualified semantic consumer. Chapter 01
§§2–8, §11 and master grammar §9 own scanning, closed escapes and maximal munch.
Apply published lexical diagnostics, including E10210 for §11.2's fallback,
E10211 and E10213–E10223. `type` is recognized, then receives E10224 at its use.
Reserved built-in declarations receive E10212, not lexer renaming.

## Parsing and Syntax

Use recursive descent for declarations/types/statements and exactly one Pratt
parser for expressions. Master grammar §§2–8 and Chapter 04 §2 are joint owners.
Do not create symbol-dependent parsing, backtracking, a grammar generator,
operator plugin table or second parser for loop clauses.

`ParseResult` contains an optional partial `unit`, diagnostics, `complete` and
readonly unchecked-region spans. Every node is a discriminated union with a raw
span and source association. A unit contains module header, imports and ordered
declarations. Expressions distinguish number/Boolean/literal/name, unary, binary,
conditional, cast, assignment, call, index, member and aggregate literal forms.
Statements distinguish block/declaration/expression/if/while/for/jump forms.
Parameters, type syntax and struct fields retain their individual spans.
Poison or unchecked regions are explicitly marked and cannot satisfy analysis.

Parse the admitted slice defined in the semantic component. Within it, retain
every Chapter 04 operator and postfix chain. Recognize call-shaped built-ins by
reserved spelling, without consulting a symbol table. Preserve syntactically
invalid but specifically diagnosable forms long enough for their normative root
code: missing module/type/return annotations, empty struct, const without value,
and forbidden module statements. Do not replace those with the generic syntax
code. This is diagnostic recovery, not acceptance of a second language grammar.

Other known Specification 4 starts/types are unchecked regions. Consume only a
balanced bounded region with safe declaration/statement synchronization; retain
the exact source span and mark parsing incomplete. A malformed unsupported region
need not be validated here; never label it valid or issue a made-up language
restriction. If a boundary cannot be found safely, leave the remainder unchecked.
Headers required for module discovery still use the shared scanner (AR-P5).

### For Clauses and Disambiguation

The statement parser owns the two `;` delimiters and closing `)`. All three
clauses are independently optional; use the ordinary expression parser for each
present expression. Header commas delimit initializer/update lists only, never a
general comma operator. Lists preserve source order. Declaration scope and exit
meaning are semantic checks, not lexer or parser state. Import `as`, former range
identifiers, prefix/infix `&`, block versus struct literal and primitive cast
versus named call follow master grammar §11.2 (AR-P5).

## Approved Syntax Diagnostic and Recovery

AR-P3 approves exactly one project-owned class, only where no normative entry
exists. AR-P6 owns these direct mechanics:

| Field | Contract |
|---|---|
| `code`, `severity` | `PARSE_SYNTAX_ERROR`, `error` |
| `message` | `Expected <expected>, found <found>` |
| Placeholders | Quoted fixed token spellings, or fixed categories `an expression`, `an identifier`, `a type`, `a declaration`, `a statement`; found is quoted punctuation/keyword spelling, quoted fixed token kind for identifiers/literals, or `end of file`. Never include raw literal or identifier content. |
| Primary span | Unexpected token's exact half-open span; zero-width EOF for a missing token at EOF |
| `related` | Ordered unmatched opening delimiter span with `Delimiter opened here`, when applicable; otherwise empty |
| `help`, `pointer` | `null`, `null`; no fabricated JSON pointer or speculative repair |

Do not interpolate whole source, absolute paths or unescaped control characters
into found-token text. Syntax code is not a published `E` number and is not
claimed as frozen-spec diagnostic conformance.

After one root error, recover at the current region's semicolon, matching closing
delimiter, or next safe declaration/statement start. Consume at least one token
unless returning control to the delimiter owner; the owner must then advance or
finish. Preserve valid following siblings and their independent errors; never
insert a valid-looking semantic operand. An exhausted/unbalanced recovery leaves
the region poisoned or unchecked. Nested input uses explicit traversal/cursor
state where host recursion would overflow; any unfinished host-limited traversal
is incomplete, not a new language limit (AR-P4, AR-P6).

Published diagnostics use Chapter 14 §2's smallest proving source span, ordered
related locations, canonical template, optional known-action help and poison
rules. Collect deterministically by sourceId's UTF-8 byte order, primary start,
end, code, then stable production order. Null spans sort after located diagnostics.
Count error-severity reports across stages; retain at most the default 20 errors
and warnings reached before stopping. Hitting a ceiling before finishing required
checks adds an internal unchecked obligation; never produce a complete typed
program. No new public max-errors/suppression/promotion options are added here.

## Testing

The owning expectations are ST-1–ST-14 and ST-45 in the testing strategy. Direct
recovery-progress and deep-input checks belong to implementation tests after the
independent specification tier. No target character table or source normalization
is allowed in these tests.
