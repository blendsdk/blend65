# Source Rendering and Independent Round Trip

> **Document**: 03-04-rendering-roundtrip.md
> **Parent**: [Index](00-index.md)

## Overview

The renderer emits deterministic Blend65 source from the independent IR. A separately authored
tokenizer and Pratt parser produce a projection tree for structural comparison (AR-P7).

## Renderer

- fixed LF newlines and two-space indentation;
- deterministic module/declaration order from IR;
- canonical decimal literals except explicit spelling-variant cases;
- parentheses derived from a renderer-owned precedence table;
- no comments, timestamps, host paths or nondeterministic object iteration;
- UTF-8 source byte limit checked before return.

### Closed renderer input and output

`renderSourceModule(module, options)` first revalidates the independent `GenModule`. `options` is
an exact own-data object:

```ts
type LiteralSpellingClass = "decimal" | "hex-dollar" | "hex-prefix" | "binary-prefix";

interface LiteralSpellingSelection {
  readonly expressionPath: string; // canonical RFC 6901 pointer to one literal node
  readonly spelling: LiteralSpellingClass;
}

interface SourceRenderOptions {
  readonly maxSourceBytes: number; // positive safe integer, at most 1 MiB
  readonly literalSpellings: readonly LiteralSpellingSelection[]; // unique, at most 1,024
}

type SourceRenderResult =
  | {
      readonly ok: true;
      readonly source: string;
      readonly sourceBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly RoundTripDiagnostic[] };
```

The default spelling is decimal. A selection must resolve to exactly one literal expression;
unknown, duplicate, non-literal or non-canonical paths fail before rendering. Hexadecimal uses
uppercase digits; `$` and `0x` are distinct selected classes; binary uses `0b` without redundant
leading zeroes. Negative values retain a unary `-` outside the unsigned magnitude spelling.
Returned bytes are an isolated UTF-8 copy and exist only on success.

The emitted subset is:

- `module <path joined by ".">;`;
- ordered `const <name>: <type> = <expression>;` declarations;
- ordered `function <name>(<name>: <type>, ...): <returnType> { ... }` declarations;
- two-space-indented `let`, assignment, `poke`/`pokew`, and `return` statements;
- literal, name, unary, binary and `peek`/`peekw` expressions.

Input array order is authoritative. The renderer never sorts declarations.

### Renderer precedence

The renderer owns this closed table for the IR subset; the inverse independently owns an
equivalent table:

| Class | Operators/forms | Binding power | Associativity |
|---|---|---:|---|
| primary | literal, name, `peek(...)`, `peekw(...)`, grouping | 14 | left |
| unary | `!`, `~`, unary `-` | 13 | right |
| multiplicative | `*`, `/`, `%` | 11 | left |
| additive | `+`, `-` | 10 | left |
| shift | `<<`, `>>` | 9 | left |
| relational | `<`, `<=`, `>`, `>=` | 8 | left |
| equality | `==`, `!=` | 7 | left |
| bitwise-and | `&` | 6 | left |
| bitwise-xor | `^` | 5 | left |
| bitwise-or | `|` | 4 | left |

Parentheses are emitted exactly when a child binds less tightly than its parent, or when an
equal-precedence child appears on the right of a left-associative binary operator and preserving
the IR tree requires grouping. Unary children at lower binding power are parenthesized. An
explicit unary operator over a literal is also grouped (`-(1)`), distinguishing it from the
signed-literal surface (`-1`).

## Independent inverse

The inverse accepts only the emitted subset. It owns its own tokenizer and precedence table and
does not import renderer helpers. Its output is `RoundTripModule`, a structure-only tree that
preserves module boundaries, declaration order, identifiers, declaration types, literal values,
selected spelling class and operator grouping. Recursive expression types are excluded because
Blend65 source does not encode them; semantic IR validation remains a separate gate.

`projectForRoundTrip(ir)` is compared deeply with `parseRenderedSource(source)`. Normalization may
ignore whitespace, numeric-base surface spelling where the case does not select that spelling, and
redundant parentheses. It may not reorder, fold, rename or infer semantics. Boolean bigint values
render and parse only as `false` and `true`; numeric spelling selections for them are rejected.

`projectForRoundTrip(module, options)` returns the same closed success/failure envelope as the
renderer, with `projection` instead of source fields. `RoundTripModule` mirrors only structural
IR facts: module path, ordered consts/functions/parameters/statements, declaration scalar types and
recursive expression grouping. Integer and boolean literals are distinct projection variants:
integers retain normalized bigint value plus selected `LiteralSpellingClass`; booleans retain a
boolean value and therefore cannot compare equal to numeric `0` or `1`.

`parseRenderedSource(sourceBytes, maxSourceBytes)` accepts an intrinsic `Uint8Array`, rejects a
non-positive/unsafe/greater-than-1-MiB limit, checks byte length before copying, decodes with fatal
UTF-8, tokenizes the emitted subset and returns:

```ts
type RoundTripParseResult =
  | {
      readonly ok: true;
      readonly projection: RoundTripModule;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly RoundTripDiagnostic[] };
```

`validateRoundTrip(module, options)` renders, independently parses, projects the input and compares
the two projections. Success returns the isolated source bytes, source string and actual
projection. Failure returns diagnostics only; partial projections and partial source are never
returned.

Diagnostics are data, never exceptions:

```ts
type RoundTripDiagnosticCode =
  | "render.input.invalid"
  | "render.spelling.invalid"
  | "render.budget.source-bytes"
  | "roundtrip.input.invalid"
  | "roundtrip.input.invalid-utf8"
  | "roundtrip.input.source-bytes"
  | "roundtrip-unsupported"
  | "roundtrip-mismatch"
  | "roundtrip.boundary";

interface RoundTripDiagnostic {
  readonly code: RoundTripDiagnosticCode;
  readonly path: string; // canonical RFC 6901 pointer, at most 256 UTF-8 bytes
  readonly message: string; // at most 512 UTF-8 bytes
}
```

At most 32 diagnostics are returned. Unsupported-token paths point to `/source/<byteOffset>`;
structural mismatches point into `/module`, `/constants`, `/functions`, `/parameters`, `/body` or
recursive expression fields. The first deterministic mismatch is sufficient.

A static module-graph gate forbids tokenizer/parser/normalizer production files from importing
renderer modules, renderer tables or formatting helpers. Only neutral IR types and token-kind
discriminators may cross the boundary. Frozen, spec-derived vectors cover every emitted token,
literal spelling, normalization rule, precedence level and associativity class.

The authoritative inverse set is every production file matching
`roundtrip-tokenizer*.ts`, `roundtrip-parser*.ts` or `roundtrip-normalizer*.ts`. The boundary test
discovers the complete set from the directory, rejects unclassified new files, and permits imports
only from the standard library, `generator-ir.ts`, `roundtrip-model.ts`, and inverse peers. It
rejects static or dynamic imports from `source-renderer`, `expression-renderer`, renderer policy
or formatting helpers. The gate walks the TypeScript AST and rejects non-literal dynamic import
targets rather than silently omitting them. The composition validator may import both sides;
neither side may import it.

Renderer composition validates and snapshots caller-owned module/options data once. Rendering,
projection and validation consume only that immutable snapshot and never re-read proxies,
accessors or mutable arrays. The inverse parses syntax only: name resolution, assignment validity
and return-type compatibility remain generator/compiler semantic-validation responsibilities.
`peek`/`peekw` and `poke`/`pokew` are recognized contextually only when followed by `(`.

The inverse token-vector suite intentionally accepts keyword-shaped qualified module segments to
exercise tokenizer coverage. This is a conformance-parser superset, not an emittable-source claim:
the production renderer rejects language keywords wherever Blend65 requires an identifier.

The immutable specification suite owns literal arrays for the expected emitted tokens, four
spelling classes, the two explicit normalization permissions, all ten subset precedence rows and
both associativity classes. It does not read an exported production catalog. Each vector is used
to construct or parse a discriminating case, so deleting or mutating a vector expectation makes a
real assertion fail rather than merely changing a digest constant beside the data.

## Mutation contract

`roundtrip-conformance-v1.ts` is an internal, non-package-exported seam. It exports passive test
types and:

```ts
type RendererPolicyMutation =
  | { readonly kind: "precedence"; readonly operator: BinaryOperator; readonly bindingPower: number }
  | {
      readonly kind: "associativity";
      readonly operator: BinaryOperator;
      readonly associativity: "left" | "right";
    }
  | { readonly kind: "omit-required-parentheses"; readonly expressionPath: string };

createSourceRendererForTest(mutation: RendererPolicyMutation): SourceRenderer;
validateRoundTripModuleGraph(files: readonly ModuleGraphFile[]): ModuleGraphValidationResult;
```

The factory alters the actual renderer decision path, not a parallel test implementation. Mutation
proof covers the eight binary precedence rows, binary associativity and required-parenthesis
decisions exposed by this seam. Primary and unary parsing remain frozen acceptance vectors, not
mutation claims. Rendering through the mutated factory and parsing through the untouched inverse
must produce a different projection for at least one eligible case. Mutation inputs are closed,
bounded and validated.

This split keeps compatibility-sensitive production APIs small while preserving a versioned
conformance seam. The seam is not exported by `@blend65/readiness`; a future incompatible grammar
adds a new version rather than silently changing the old test contract.

## Real parser boundary

The production frontend is not imported. RD-04 later renders the source to the real compiler.
RD-02 may use a child process only for its own fresh-process replay proof, not compiler execution.

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Unsupported source token/construct | `roundtrip-unsupported` | AR-P7 |
| Structural mismatch | `roundtrip-mismatch` with bounded path | AR-P7 |
| Invalid UTF-8/oversize source | Input/budget diagnostic | AR-P11, AR-P12 |
