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
| `packages/readiness/src/readiness-boundary-scanner.ts` | Bounded TypeScript module-graph scanner and fixed repository adapter |
| `packages/readiness/src/oracle-boundary.spec.test.ts` | Immutable package-independence fixtures |
| `packages/readiness/src/oracle-evaluator.impl.test.ts` | Algorithm, error and boundary tests |

No production file may import `@blend65/*` or leave `packages/readiness` through a relative path.
Public types are documented and exported from the package index; conformance seams remain private.
The private boundary scanner is tooling rather than semantic authority and may use the repository's
existing root `typescript` dev toolchain to parse syntax trees. This introduces no package,
lockfile, runtime-library or service dependency. No evaluator, transform or published package API
may import `typescript`.

## Immutable Specification-Author Contract Packet

This section, together with the exact `OracleRequestV1`, `OracleResultV1`, `OracleDiagnostic`,
`OracleSuite`, memory and budget shapes in 03-01, is the complete implementation-blind authoring
packet for ST-08–ST-18. The author may use the opaque Phase 1
`createOracleContractsSpecFixture()` test helper without opening its implementation. No production
source or implementation test is an authority for these specifications.

### Closed generator IR

Identifiers are non-empty validated source identifiers. Tests submit plain unknown records through
the conformance entry; successful validation supplies the compile-time brand. Objects have exactly
the fields shown:

```ts
type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";
type UnaryOperator = "-" | "~" | "!";
type BinaryOperator =
  | "+" | "-" | "*" | "/" | "%"
  | "&" | "|" | "^" | "<<" | ">>"
  | "==" | "!=" | "<" | "<=" | ">" | ">=";

type GenExpression =
  | {
      readonly kind: "literal";
      readonly type: ScalarType;
      readonly value: bigint;
    }
  | {
      readonly kind: "name";
      readonly type: ScalarType;
      readonly name: string;
    }
  | {
      readonly kind: "unary";
      readonly type: ScalarType;
      readonly operator: UnaryOperator;
      readonly operand: GenExpression;
    }
  | {
      readonly kind: "binary";
      readonly type: ScalarType;
      readonly operator: BinaryOperator;
      readonly left: GenExpression;
      readonly right: GenExpression;
    }
  | {
      readonly kind: "memory-read";
      readonly type: "byte" | "word";
      readonly width: 1 | 2;
      readonly address: GenExpression;
    };

type GenStatement =
  | {
      readonly kind: "local";
      readonly name: string;
      readonly type: ScalarType;
      readonly initializer: GenExpression;
    }
  | {
      readonly kind: "assign";
      readonly target: string;
      readonly value: GenExpression;
    }
  | {
      readonly kind: "memory-write";
      readonly width: 1 | 2;
      readonly address: GenExpression;
      readonly value: GenExpression;
    }
  | {
      readonly kind: "return";
      readonly value?: GenExpression;
    };

interface GenConst {
  readonly kind: "const";
  readonly name: string;
  readonly type: ScalarType;
  readonly value: GenExpression;
}

interface GenParameter {
  readonly name: string;
  readonly type: ScalarType;
}

interface GenFunction {
  readonly kind: "function";
  readonly name: string;
  readonly parameters: readonly GenParameter[];
  readonly returnType: ScalarType | "void";
  readonly body: readonly GenStatement[];
}

interface GenModule {
  readonly kind: "module";
  readonly path: readonly string[];
  readonly constants: readonly GenConst[];
  readonly functions: readonly GenFunction[];
}
```

Boolean literals use `0n` and `1n`; evaluator observations convert them to `false` and `true`.
Memory-read width/type pairs are exactly `(1, "byte")` and `(2, "word")`. Memory-write width 1
requires a byte value; width 2 requires a word value; every memory address has word type.

### Real evaluator conformance entry

The replay-authenticated wrapper cannot manufacture every operator, frame, memory and budget vector
required by ST-08–ST-17. The evaluator module therefore exposes one module-private conformance entry
that is imported by the immutable specification through its relative module path but is not
re-exported from the package index:

```ts
interface OracleProgramInputV1 {
  readonly schemaVersion: 1;
  readonly module: GenModule;
  readonly entryFunction: string;
  readonly parameterBindings: readonly {
    readonly kind: "parameter-value";
    readonly parameterPath: string;
    readonly value: bigint | boolean;
  }[];
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
}

function evaluateOracleProgram(input: unknown): OracleResultV1;
```

`evaluateOracleProgram` performs hostile-input closure, structural IR validation, semantic closure,
budget/memory validation and execution in that order. `evaluateSourceOracleCase` remains the only
suite/replay entry and must call this exact function after successful provenance regeneration; it
must not contain a second evaluator. The conformance entry is source-authoring-only, carries no
suite, review, identity or publication evidence, and is absent from `index.ts`.

Parameter paths are canonical RFC 6901 pointers
`/functions/<function-index>/parameters/<parameter-index>`. Bindings are in parameter order,
contain every and only entry parameter, and their values match the declared scalar type. A
structurally valid but evaluator-unsupported program returns `oracle-unmodeled` with
`unsupported-semantics`; malformed fields or an invalid frame return `oracle.input.invalid`.
Constant cycles, unresolved constant names and impure constant initializers reject before frame
creation or memory effects and return `oracle-unmodeled` with `unsupported-semantics`.

### Budget conformance entry

The evaluator and later relation engine share one private monotonic meter. The specification calls
this probe, which instantiates and charges that same meter rather than duplicating its accounting:

```ts
interface OracleBudgetProbeInputV1 {
  readonly schemaVersion: 1;
  readonly budget: OracleBudgetV1;
  readonly charges: readonly {
    readonly dimension: keyof OracleBudgetV1;
    readonly amount: bigint;
  }[];
}

type OracleBudgetProbeResultV1 =
  | {
      readonly ok: true;
      readonly usage: OracleBudgetV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly usage: OracleBudgetV1;
      readonly rejectedChargeIndex: number;
      readonly diagnostics: readonly [{
        readonly code: "oracle.budget";
        readonly path: string;
        readonly message: string;
      }];
    };

function probeOracleBudgetCharges(input: unknown): OracleBudgetProbeResultV1;
```

The meter starts all usage at zero and uses checked `bigint` addition. Every charge is validated
and compared before committing its new usage. Exactly-at-limit succeeds; the next charge fails at
`/charges/<index>/amount`, reports the rejected index, and returns usage exactly as it stood before
that charge. The evaluator initializes `inputNodes`, `expressionDepth` and `memoryCells` through
the same meter; constant resolution, statement execution, expression evaluation and each byte-cell
read or write charge `evaluationSteps`; entry creation charges `frames`; appending a completed
logical effect charges `effects`; transform visits/creations charge `transformedNodes`. This lets
ST-16 cover all seven dimensions before relation implementation while exercising production
accounting.

### Boundary scanner contract

The scanner core is a bounded, deterministic in-memory graph operation. Its fixed filesystem
adapter is the only repository-I/O layer, and `readiness:source-check` calls that adapter:

```ts
interface ReadinessBoundaryModuleV1 {
  readonly path: string;
  readonly source: Uint8Array;
}

interface ReadinessBoundaryScanInputV1 {
  readonly schemaVersion: 1;
  readonly packageRoot: "packages/readiness";
  readonly entryPaths: readonly string[];
  readonly modules: readonly ReadinessBoundaryModuleV1[];
}

type ReadinessBoundaryDiagnosticCodeV1 =
  | "readiness.boundary.input.invalid"
  | "readiness.boundary.input.limit"
  | "readiness.boundary.module.missing"
  | "readiness.boundary.import.package"
  | "readiness.boundary.import.escape"
  | "readiness.boundary.import.dynamic";

interface ReadinessBoundaryDiagnosticV1 {
  readonly code: ReadinessBoundaryDiagnosticCodeV1;
  readonly path: string;
  readonly message: string;
}

type ReadinessBoundaryScanResultV1 =
  | {
      readonly ok: true;
      readonly modulePaths: readonly string[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReadinessBoundaryDiagnosticV1[];
    };

function scanReadinessOracleBoundary(
  input: unknown,
): ReadinessBoundaryScanResultV1;

function checkReadinessOracleBoundary(
  repositoryRoot: string,
): Promise<ReadinessBoundaryScanResultV1>;
```

All paths are canonical POSIX repository-relative paths below `packages/readiness`; duplicates,
backslashes, empty/dot/parent segments, accessors, exotic objects, cycles and unknown fields are
invalid. The core accepts at most 4,096 modules, 64 entries, 1 MiB per source, 8 MiB aggregate
source bytes, 1,024 UTF-8 bytes per path, 65,536 imports and 1,024 graph depth. It rejects invalid
UTF-8 before parsing. It parses TypeScript syntax trees, follows static
imports, exports and literal dynamic imports from the exact entry set, resolves `.js` specifiers
to `.ts` source files, and returns the reachable module paths in lexical order.

Every `@blend65/*` package specifier returns `readiness.boundary.import.package`; every resolved
relative path outside the package returns `readiness.boundary.import.escape`; every non-literal
dynamic import returns `readiness.boundary.import.dynamic`; and a missing contained dependency
returns `readiness.boundary.module.missing`. Node built-ins and non-Blend65 tool/library imports do
not grant access to compiler packages and are permitted. Diagnostics are sorted by
`(module path, source offset, code)` and carry RFC 6901 paths into the rejected module record.

The filesystem adapter rejects symlinks and escape paths, reads only bounded regular files under
`packages/readiness/src`, excludes tests, fixtures, declarations and generated output, and chooses
every production `oracle-*.ts` plus `semantic-relations*.ts` file as an entry. It then invokes the
core unchanged. ST-18 uses the core for checked-in positive/negative source fixtures and a temporary
repository for the adapter, requiring byte-identical diagnostics from both routes.

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
by semantic closure. Shift counts are unsigned `byte` or `word`; the result retains the left
operand's type. Right shift is logical for unsigned and sign-extending for signed types, while left
shift wraps at the left width. Any count at least that 8- or 16-bit width produces typed zero before
either shift. Boolean supports `!`, `==` and `!=` only.

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
pure module constants in an acyclic dependency graph, and recursively pure supported unary/binary
expressions only. Memory
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
- the first completed logical effect has ordinal `0n`; each later completed effect increments by
  exactly `1n`;
- later overlapping operations observe all prior writes.

The final state projection contains all initialized cells, including unchanged cells, sorted by
address. This prevents a comparator from hiding an omitted write or accidental unrelated change.
Because every address expression is word-typed and normalized before access, an out-of-range byte
address is not representable in valid IR. Byte access at `$ffff` succeeds when that cell exists.
Word access beginning at `$ffff` is unmodeled before any read, write or effect because its required
second byte lies outside the address space. Out-of-range address literals remain structural input
failures rather than evaluator cases.

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
It is distinct from the four immutable Phase 1 bootstrap façades, which retain
`evaluator-unavailable` for valid value-state requests. Future handler-specific selected-candidate
adapters validate their exact handler ID and delegate here; no adapter contains evaluator
semantics.

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
