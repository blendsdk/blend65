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

### Modeled case construction

The valid `GenModule` contract remains valid-only. Invalid memory signatures and scalar nearest
neighbors therefore use one closed structural delta over a valid baseline instead of weakening the
IR or editing rendered text.

```ts
type InvalidSourceTransform =
  | {
      readonly kind: "intrinsic-argument-remove";
      readonly callPath: string;
      readonly argumentIndex: number;
    }
  | {
      readonly kind: "intrinsic-argument-insert";
      readonly callPath: string;
      readonly argumentIndex: number;
      readonly argument: GenExpression;
    }
  | {
      readonly kind: "intrinsic-argument-replace";
      readonly callPath: string;
      readonly argumentIndex: number;
      readonly argument: GenExpression;
    }
  | {
      readonly kind: "scalar-expression-replace";
      readonly expressionPath: string;
      readonly replacement: {
        readonly kind: "integer-literal";
        readonly value: bigint;
      };
    }
  | {
      readonly kind: "parameter-binding-replace";
      readonly parameterPath: string;
      readonly replacement: {
        readonly kind: "integer-literal";
        readonly value: bigint;
      };
    };

type GeneratedCaseProjection =
  | { readonly kind: "valid"; readonly module: GenModule }
  | {
      readonly kind: "invalid";
      readonly baseline: GenModule;
      readonly transform: InvalidSourceTransform;
    };

interface NamedCasePredicate {
  readonly predicateId: string;
  readonly evaluate: (generatedCase: GeneratedModeledCase) => boolean;
}

interface InvalidCaseNeighborOperation {
  readonly neighborId: string;
  readonly targetPredicateId: string;
  readonly diagnosticFamily: string;
  readonly apply: (baseline: GeneratedModeledCase) => InvalidSourceTransform;
}

type InvalidCaseNeighborResult =
  | {
      readonly ok: true;
      readonly projection: Extract<GeneratedCaseProjection, { readonly kind: "invalid" }>;
      readonly neighborId: NeighborId;
      readonly violatedPredicateId: PredicateId;
      readonly diagnosticFamily: string;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

declare function applyInvalidCaseNeighbor(input: {
  readonly baseline: GenModule;
  readonly operation: InvalidCaseNeighborOperation;
  readonly predicates: readonly NamedCasePredicate[];
}): InvalidCaseNeighborResult;

declare function renderInvalidCase(
  projection: Extract<GeneratedCaseProjection, { readonly kind: "invalid" }>,
  options: SourceRenderOptions,
): SourceRenderResult;
```

`callPath` is a bounded canonical JSON Pointer that resolves exactly one existing
`memory-read`/`memory-write` node. Inserted or replacement expressions must independently pass
structural and scope validation. Predicates derive effective arity and operand types from the
projected call; they never trust the transform discriminator. Every baseline passes normal
`validateRoundTrip` before a delta is admitted. Baseline predicates are all true and exactly the
named target is false afterward. Invalid rendering applies the descriptor at the intrinsic
argument-list seam; arbitrary or post-render string replacement is forbidden. Invalid rendering
uses frozen expected-byte vectors and dedicated transform mutation tests, not the valid round-trip
inverse. Added expression nodes/depth and final source bytes count toward Phase 6 budgets.

The Phase 5 suite exposes a closed choice surface:

```ts
type ScalarCaseChoice = {
  readonly kind: "scalar";
  readonly ruleId: RuleId;
  readonly spelling: GenerationSpelling;
  readonly value: bigint | boolean;
};

type MemoryExpressionForm = "direct" | "computed";

type MemoryCaseChoice = {
  readonly kind: "memory";
  readonly ruleId: RuleId;
  readonly addressSpelling: GenerationSpelling;
  readonly addressForm: MemoryExpressionForm;
  readonly valueSpelling?: GenerationSpelling;
};

type ModeledCaseChoice = ScalarCaseChoice | MemoryCaseChoice;

type ModeledCaseValidity =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly neighborId: NeighborId };

interface ModeledCaseRequest {
  readonly handlerId:
    | "generator.frontend-cases"
    | "generator.compiler-cases"
    | "generator.runtime-cases";
  readonly modulePath: readonly string[];
  readonly choice: ModeledCaseChoice;
  readonly validity: ModeledCaseValidity;
  readonly budget: GenerationBudget;
}

type ConstructionUsage = Readonly<
  Record<
    | "modules"
    | "declarations"
    | "ir-nodes"
    | "statements"
    | "expression-depth"
    | "loop-work",
    bigint
  >
>;

interface GeneratedModeledCase {
  readonly projection: GeneratedCaseProjection;
  readonly parameterBindings: readonly {
    readonly kind: "parameter-value";
    readonly parameterPath: string;
    readonly value: bigint | boolean;
  }[];
  readonly primaryRuleId: RuleId;
  readonly claimedRuleIds: readonly RuleId[];
  readonly spelling: GenerationSpelling;
  readonly validity:
    | { readonly kind: "valid" }
    | {
        readonly kind: "invalid";
        readonly neighborId: NeighborId;
        readonly violatedPredicateId: PredicateId;
        readonly expectedDiagnosticFamily: string;
      };
  readonly constructionUsage: ConstructionUsage;
}

type GeneratorCaseResult =
  | {
      readonly ok: true;
      readonly outcome: "generated";
      readonly case: GeneratedModeledCase;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "unavailable";
      readonly ruleId: RuleId;
      readonly state: "unmodeled" | "not-generatable";
      readonly reason: RuleModelReason;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledGenerationDiagnostic[];
    };

type PredicateResult =
  | {
      readonly ok: true;
      readonly predicateId: PredicateId;
      readonly valid: boolean;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledGenerationDiagnostic[];
    };

declare function constructModeledCase(
  suite: ModeledGeneratorSuite,
  request: unknown,
): GeneratorCaseResult;

declare function evaluateModeledRule(
  suite: ModeledGeneratorSuite,
  request: unknown,
): PredicateResult;

declare function applyModeledRuleNeighbor(
  suite: ModeledGeneratorSuite,
  request: unknown,
): GeneratorCaseResult;

type GeneratorHandlerV1 = (
  suite: ModeledGeneratorSuite,
  request: unknown,
) => GeneratorCaseResult;

declare const generateFrontendCase: GeneratorHandlerV1;
declare const generateCompilerCase: GeneratorHandlerV1;
declare const generateRuntimeCase: GeneratorHandlerV1;
declare const boundaryVariantsHandler: (input: unknown) => BoundaryVariantResult;
```

Every request is a closed own-data record. The suite validates and snapshots it before any
constructor or budget capability runs. Generation choices are lexical and duplicate-free so Phase
6 can index them with path-local draws. `constructionUsage` excludes source bytes and attempts;
Phase 6 supplies those only after rendering and finalization. Scalar rules route directly to the
frontend handler, memory rules to runtime, and the compiler handler accepts only already modeled
composition choices. Wrong-handler calls fail with `modeled.handler.route`.

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

`scalar-expression-replace` resolves exactly one canonical source-expression path;
`parameter-binding-replace` resolves exactly one binding keyed to an existing parameter
declaration. Numeric neighbors contain only the named nearest value outside the range; boolean
wrong-type contains canonical integer zero. Parameter-spelling cases carry exactly one immutable
binding to `/functions/<i>/parameters/<j>` whose value equals the chosen boundary. Other scalar
spellings carry none. Phase 6 replays source and bindings together; source compilation alone does
not claim that a parameter boundary executed.

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
