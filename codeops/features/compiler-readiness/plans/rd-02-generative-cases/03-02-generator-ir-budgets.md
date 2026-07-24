# Generator IR and Structural Budgets

> **Document**: 03-02-generator-ir-budgets.md
> **Parent**: [Index](00-index.md)

## Overview

The generator IR represents only constructs that the first modeled subset can prove. It is an
immutable, compiler-independent data model with no source spans or compiler symbols (AR-P3).

## IR surface

```ts
type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";
type UnaryOperator = "-" | "~" | "!";
type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "&"
  | "|"
  | "^"
  | "<<"
  | ">>"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">=";

type GenExpression =
  | { readonly kind: "literal"; readonly type: ScalarType; readonly value: bigint }
  | { readonly kind: "name"; readonly type: ScalarType; readonly name: GenIdentifier }
  | { readonly kind: "unary"; readonly type: ScalarType; readonly operator: UnaryOperator; readonly operand: GenExpression }
  | { readonly kind: "binary"; readonly type: ScalarType; readonly operator: BinaryOperator; readonly left: GenExpression; readonly right: GenExpression }
  | { readonly kind: "memory-read"; readonly type: "byte" | "word"; readonly width: 1 | 2; readonly address: GenExpression };

type GenStatement =
  | { readonly kind: "local"; readonly name: GenIdentifier; readonly type: ScalarType; readonly initializer: GenExpression }
  | { readonly kind: "assign"; readonly target: GenIdentifier; readonly value: GenExpression }
  | { readonly kind: "memory-write"; readonly width: 1 | 2; readonly address: GenExpression; readonly value: GenExpression }
  | { readonly kind: "return"; readonly value?: GenExpression };

interface GenParameter {
  readonly name: GenIdentifier;
  readonly type: ScalarType;
}

interface GenConst {
  readonly kind: "const";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
  readonly value: GenExpression;
}

interface GenFunction {
  readonly kind: "function";
  readonly name: GenIdentifier;
  readonly parameters: readonly GenParameter[];
  readonly returnType: ScalarType | "void";
  readonly body: readonly GenStatement[];
}

interface GenModule {
  readonly kind: "module";
  readonly path: readonly GenIdentifier[];
  readonly constants: readonly GenConst[];
  readonly functions: readonly GenFunction[];
}
```

Module, const, function and parameter declarations compose these nodes. Identifiers are validated
allowlist values and module paths are logical segments, never host paths.

`GenIdentifier` matches `^[A-Za-z][A-Za-z0-9_]{0,63}$`; module paths contain one to eight such
segments and never accept `.`, `..`, slashes, backslashes or absolute-path syntax. All exported
validators accept `unknown`, require plain own-data records and return failures as data.

```ts
type GenerationDiagnosticCode =
  | "generation-input-invalid"
  | "generation-type-invalid"
  | "generation-budget"
  | "generation-invariant"
  | "neighbor-invalid";

interface GenerationDiagnostic {
  readonly code: GenerationDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly dimension?: GenerationBudgetDimension;
}

type IrValidationResult =
  | { readonly ok: true; readonly module: GenModule; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

declare function validateGeneratorIr(input: unknown): IrValidationResult;
```

## Valid and invalid generation

Valid construction is predicate-driven. Every constructor returns a typed result with accumulated
cost; impossible choices are excluded before drawing. An invalid neighbor:

1. starts from a valid case;
2. applies exactly one named operation;
3. reruns all participating predicates;
4. succeeds only when the named predicate alone changes valid→invalid;
5. records the expected diagnostic family from the model.

This is the sole meaning of “one intentional violation” (AR-P8).

```ts
interface NamedModelPredicate {
  readonly predicateId: string;
  readonly evaluate: (module: GenModule) => boolean;
}

interface InvalidNeighborOperation {
  readonly neighborId: string;
  readonly targetPredicateId: string;
  readonly diagnosticFamily: string;
  readonly apply: (module: GenModule) => GenModule;
}

type NeighborResult =
  | {
      readonly ok: true;
      readonly module: GenModule;
      readonly neighborId: string;
      readonly violatedPredicateId: string;
      readonly diagnosticFamily: string;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

declare function applyInvalidNeighbor(input: {
  readonly baseline: GenModule;
  readonly operation: InvalidNeighborOperation;
  readonly predicates: readonly NamedModelPredicate[];
}): NeighborResult;
```

The function validates exact capability shapes and callability, snapshots the baseline, requires all
predicates true before the operation, reruns all predicates afterward and succeeds only when the
target alone becomes false. The success result contains a deeply immutable module plus
`neighborId`, `violatedPredicateId` and `diagnosticFamily`.

Invalid input paths root at `/baseline`, `/operation` or `/predicates`. A zero/multiple/incorrect
predicate flip reports `neighbor-invalid` at `/predicates`; a missing target reports it at
`/operation/targetPredicateId`.

## Boundary transform

`transform.boundary-variants` deterministically expands a model choice into empty/min/max and
nearest-invalid neighbors, width/sign boundaries, spelling variants, nesting depths and minimal
cross-module forms. It does not decide expected runtime values; RD-03 owns that oracle.

`createBoundaryVariants({ type, spellings, minNestingDepth, maxNestingDepth })` returns a
deduplicated immutable lexical sequence of typed descriptors covering min, max, nearest-below,
nearest-above, each requested spelling and each requested nesting depth. Boolean has only
`false`/`true` and no numeric nearest-invalid value. Empty forms apply only to constructs whose
closed input explicitly permits emptiness.

```ts
type BoundaryVariantKind =
  | "empty"
  | "minimum"
  | "maximum"
  | "nearest-below"
  | "nearest-above"
  | "spelling"
  | "nesting";

interface BoundaryVariant {
  readonly kind: BoundaryVariantKind;
  readonly type: ScalarType;
  readonly value: bigint | boolean | null;
  readonly spelling?: "literal" | "const" | "local" | "parameter";
  readonly nestingDepth?: number;
}

type BoundaryVariantResult =
  | { readonly ok: true; readonly variants: readonly BoundaryVariant[]; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

declare function createBoundaryVariants(input: {
  readonly type: ScalarType;
  readonly spellings: readonly ("literal" | "const" | "local" | "parameter")[];
  readonly minNestingDepth: number;
  readonly maxNestingDepth: number;
  readonly allowEmpty: boolean;
}): BoundaryVariantResult;
```

Input diagnostics use `/type`, `/spellings`, `/minNestingDepth`, `/maxNestingDepth` and
`/allowEmpty`. Output ordering is kind, numeric/boolean value, spelling, then depth; exact duplicate
descriptors are removed without reordering surviving entries.

## Structural budgets

```ts
interface GenerationBudget {
  readonly maxModules: number;
  readonly maxDeclarations: number;
  readonly maxIrNodes: number;
  readonly maxStatements: number;
  readonly maxExpressionDepth: number;
  readonly maxLoopWork: bigint;
  readonly maxSourceBytes: number;
  readonly maxAttempts: number;
}

type GenerationBudgetDimension =
  | "modules"
  | "declarations"
  | "ir-nodes"
  | "statements"
  | "expression-depth"
  | "loop-work"
  | "source-bytes"
  | "attempts";

declare function validateGenerationBudget(input: unknown): GenerationBudgetResult;

declare function createGenerationBudgetTracker(
  budget: GenerationBudget,
): GenerationBudgetTracker;

type GenerationBudgetResult =
  | { readonly ok: true; readonly budget: GenerationBudget; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

type GenerationUsage = Readonly<Record<GenerationBudgetDimension, bigint>>;

type GenerationBudgetStepResult =
  | { readonly ok: true; readonly usage: GenerationUsage; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

interface GenerationBudgetTracker {
  consume(dimension: GenerationBudgetDimension, amount: number | bigint): GenerationBudgetStepResult;
  finalize(module: GenModule, sourceBytes: number, attempts: number): GenerationBudgetStepResult;
  snapshot(): GenerationUsage;
}
```

All numeric fields are positive closed-range integers. Construction accounts incrementally and
the final case is recounted independently. Products use checked BigInt arithmetic. The initial IR
does not emit loops, but `maxLoopWork` remains zero/one-derived and is tested so later extension
cannot bypass the contract (AR-P11).

The tracker exposes `consume(dimension, amount)` and `finalize(module, sourceBytes, attempts)`.
Every call returns a discriminated result and never throws for expected invalid input. Amounts are
non-negative safe integers except loop work, which is non-negative `bigint`. The tracker uses
checked `bigint` internally, rejects overflow before mutation and retains no partial consumption on
failure. `finalize` independently recounts modules, declarations, nodes, statements, expression
depth and loop work, compares them with incremental counts and returns `generation-invariant` on
disagreement. Hitting a limit exactly succeeds; exceeding it by one returns `generation-budget`
with the exact dimension.

Budget validation paths are `/budget/<field>`. `consume` uses `/dimension` and `/amount` for invalid
inputs and `/usage/<dimension>` for an exceeded limit. `finalize` uses `/sourceBytes`, `/attempts`
and `/usage/<dimension>`; recount disagreement reports `generation-invariant` at the mismatched
usage path. Failed steps leave `snapshot()` byte-for-byte unchanged.

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Invalid identifier/path segment | `generation-input-invalid` | AR-P12 |
| Budget exceeded during construction | `generation-budget` with dimension | AR-P11 |
| Completed case recount differs | Internal invariant failure; no source | AR-P11 |
| Neighbor flips zero/multiple contracts | `neighbor-invalid` | AR-P8 |
