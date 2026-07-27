# Component Specification: Reference Evaluator

> **Document**: 03-02-reference-evaluator.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P5–AR-P10, AR-P18–AR-P20, AR-P29, AR-P32, AR-P41

## Responsibility

Evaluate the approved generator-IR subset from frozen language semantics using bounded immutable
state. The evaluator is an absolute expected-result oracle for composition behavior but claims
inventory coverage only for the nine modeled RD-02 rules.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/oracle-budget.ts` | Closed budget validation and monotonic tracker |
| `packages/readiness/src/oracle-values.ts` | Typed scalar normalization and operations |
| `packages/readiness/src/oracle-memory.ts` | Versioned fixture, reads/writes and ordered effects |
| `packages/readiness/src/oracle-state.ts` | Immutable frame and evaluation state |
| `packages/readiness/src/oracle-evaluator.ts` | Declaration/statement/expression orchestration |
| `packages/readiness/src/oracle-operations.ts` | Closed operation dispatch and spec citations |
| `packages/readiness/src/oracle-semantic-closure.ts` | Evaluator prerequisite and constant-purity validator |
| `packages/readiness/src/oracle-boundary.spec.test.ts` | Immutable package-independence fixtures |
| `packages/readiness/src/oracle-evaluator.impl.test.ts` | Algorithm, error and boundary tests |

No production file may import `@blend65/*` or leave `packages/readiness` through a relative path.
Public types are documented and exported from the package index; conformance seams remain private.

## Value Model

```ts
type OracleValue =
  | { readonly kind: "integer"; readonly type: "byte" | "sbyte" | "word" | "sword"; readonly value: bigint }
  | { readonly kind: "boolean"; readonly type: "boolean"; readonly value: boolean };
```

Integer operations use `bigint` exclusively. The operation result is normalized immediately to
the expression's declared type:

| Type | Bits | Canonical range | Normalization |
|---|---:|---:|---|
| `byte` | 8 | 0…255 | modulo 256 |
| `sbyte` | 8 | -128…127 | modulo 256 then two's-complement signed projection |
| `word` | 16 | 0…65535 | modulo 65536 |
| `sword` | 16 | -32768…32767 | modulo 65536 then two's-complement signed projection |

Both operands are evaluated left-to-right before dispatch. Same-signed mixed-width arithmetic,
bitwise and comparison operands are widened to the wider declared type before the operation:
`byte→word` uses zero extension and `sbyte→sword` uses sign extension. Both operand orders and all
8/16-bit same-signed pairs are valid. Arithmetic/bitwise results have that widened type;
comparisons produce boolean. Any narrowing result annotation or signed/unsigned mixture is rejected
by semantic closure. Right shift is logical for unsigned and sign-extending for signed types; left
shift wraps at the promoted result width. Boolean supports `!`, `==` and `!=` only.

Non-zero division and remainder truncate toward zero and normalize to result width. Any zero
divisor returns `oracle-unmodeled` with reason `blocked-errata-division-by-zero`; the evaluator
does not distinguish constant-shaped and runtime-shaped zero because both frozen authorities are
in conflict.

## Entry Frame and Declaration Order

The request names exactly one function. Evaluation:

1. resolves module constants through a deterministic dependency graph;
2. rejects cycles and unresolved names as invalid authority/input;
3. creates one frame from the function parameters and exact `parameterBindings`;
4. executes body statements sequentially;
5. creates each local only after its initializer succeeds;
6. updates only an existing writable local/parameter on assignment;
7. stops at the first return and validates its value against `returnType`;
8. rejects fallthrough from a non-void function.

Before this sequence, `validateOracleSemanticClosure` runs after structural IR validation. It
requires every constant initializer to be a closed compile-time-constant expression: literals,
previous pure constants, and recursively pure supported unary/binary expressions only. Memory
reads, parameters, locals and any runtime-only form reject at the constant path. The validator also
checks entry resolvability, frame compatibility, operation/result typing, mixed-width promotion and
every other evaluator prerequisite. This plan-local semantic closure does not silently redefine the
RD-02 structural validator; its broader admission gap is recorded as separately owned corrective
debt.

The entry frame is the only frame. Any future call expression or second frame is
`unsupported-construct` and `oracle-unmodeled`.

## Memory Model

```ts
interface MemoryFixtureV1 {
  readonly schemaVersion: 1;
  readonly cells: readonly {
    readonly address: bigint;
    readonly value: bigint;
  }[];
}

type MemoryEffectV1 =
  | { readonly ordinal: bigint; readonly kind: "read"; readonly width: 1 | 2; readonly address: bigint; readonly value: bigint }
  | { readonly ordinal: bigint; readonly kind: "write"; readonly width: 1 | 2; readonly address: bigint; readonly value: bigint };
```

Cells are unique, sorted by address, bounded, and contain byte values. There is no implicit
zero-filled memory:

- reading an absent cell returns `oracle-unmodeled`;
- byte access requires address `$0000..$ffff`;
- word access requires both bytes, so `$ffff` is unmodeled;
- word reads combine low then high byte;
- word writes update low then high byte;
- one logical read/write effect is recorded after its full access succeeds;
- later overlapping operations observe all prior writes.

The final state projection contains all initialized cells, including unchanged cells, sorted by
address. This prevents a comparator from hiding an omitted write or accidental unrelated change.

## Budget

```ts
interface OracleBudgetV1 {
  readonly inputNodes: bigint;
  readonly expressionDepth: bigint;
  readonly evaluationSteps: bigint;
  readonly frames: bigint;
  readonly memoryCells: bigint;
  readonly effects: bigint;
  readonly transformedNodes: bigint;
}
```

All fields are positive canonical integers within fixed hard maxima. Input nodes/depth and memory
cells are checked before execution. The tracker charges before:

- resolving each constant;
- executing each statement;
- evaluating each expression node;
- creating the entry frame;
- performing each byte cell read or write;
- appending each logical effect;
- visiting or creating each transform node.

Exactly-at-limit succeeds. A charge that would exceed the limit returns `oracle-budget`, publishes
no modeled observation and cannot count toward readiness. Checked `bigint` arithmetic prevents
host overflow and oversized allocations.

## Evaluation API

```ts
function evaluateSourceOracleCase(
  suite: OracleSuite,
  request: unknown,
): OracleResultV1;
```

This raw function is a source-authoring/test capability, not publication evidence. The
resolver-owned published API wraps it after selection and creates the complete evidence envelope.
The operation is output-pure: repeated and concurrent calls over equal canonical inputs produce
equal results and do not share mutable state. It never throws for rejected external input.

Valid cases produce:

```ts
interface ValueStateObservationV1 {
  readonly kind: "value-state";
  readonly returnValue: OracleValue | null;
  readonly effects: readonly MemoryEffectV1[];
  readonly finalMemory: readonly { readonly address: bigint; readonly value: bigint }[];
}
```

Invalid generated cases do not execute malformed IR. An `invalid-source-transform` returns the
exact diagnostic-manifest record for `(ruleId, neighborId)`. An `invalid-parameter-binding` uses
the separate binding-rejection contract and never pretends that compiler-valid source emitted a
compiler diagnostic.

## Independence Gate

An implementation-blind `oracle-boundary.spec.test.ts` is authored before any evaluator production
work. It discovers the target module set and uses seeded positive/negative fixture modules to prove
that the scanner accepts contained Node/readiness imports and rejects:

- every package import beginning `@blend65/`;
- a resolved relative path outside `packages/readiness`;
- non-literal dynamic imports;
- imports of compiler lexer/parser/analyzer/IL/codegen modules by any route.

The same invariant is added to `readiness:source-check` as defense in depth. Implementation tests
may cover AST edge cases but are not the sole acceptance oracle.

Volatile order is proven by public memory effects and return values, not by inspecting evaluator
traversal internals.
