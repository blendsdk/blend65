# Vertical Generated Programs: RD-08

> **Document**: 03-01-vertical-generated-programs.md
> **Parent**: [Index](00-index.md)

## Overview

Phase 1 extends the independent data model just far enough to generate, render and evaluate real
Blend programs containing fixed arrays, scalar calls, branches and bounded loops. It finishes
before any denominator-wide authority work begins. (AR-1, AR-2)

## Architecture

### Current Architecture

The closed IR in `generator-ir.ts` flows through defensive validation, deterministic rendering,
reviewed modeled construction, independent oracle evaluation and the existing published execution
case. The readiness package does not import production compiler workspaces.

### Proposed Changes

Keep the central unions in `generator-ir.ts`, then delegate new behavior to four public local
modules. The evaluator may use one private `structured-oracle-runtime.ts` implementation companion
to stay below the repository file-size ceiling; the public contract remains owned solely by
`structured-oracle-evaluator.ts` (AR-11).

```
GenModule
  ├─ structured-ir-validation.ts
  ├─ structured-source-renderer.ts
  ├─ structured-case-families.ts
  └─ structured-oracle-evaluator.ts
       └─ structured-oracle-runtime.ts (private)
                 ↓
       existing published case/envelope
                 ↓
 existing readiness-execution public routes
```

No module becomes a generic visitor, second parser or compiler AST adapter. Each handles only the
new closed discriminants. The private runtime companion exports no package API. (AR-4, AR-8,
AR-11)

## Implementation Details

### New IR types

The central type authority adds the following closed forms. These are specification-visible
contracts: implementation may refine only zero-semantic-impact field names.

```ts
export interface GenArrayType {
  readonly kind: "array-type";
  readonly elementType: ScalarType;
  readonly extent: number | null;
  readonly access: "const" | "mutable";
}

export interface GenArrayDeclaration {
  readonly kind: "array";
  readonly name: GenIdentifier;
  readonly elementType: ScalarType;
  readonly extent: number;
  readonly initializer: readonly GenExpression[];
}

export interface GenArrayReferenceExpression {
  readonly kind: "array-reference";
  readonly type: GenArrayType;
  readonly name: GenIdentifier;
}

export interface GenIndexExpression {
  readonly kind: "index";
  readonly type: ScalarType;
  readonly target: GenIdentifier;
  readonly index: GenExpression;
}

export interface GenCallExpression {
  readonly kind: "call";
  readonly type: ScalarType;
  readonly callee: GenIdentifier;
  readonly arguments: readonly (GenExpression | GenArrayReferenceExpression)[];
}

export interface GenIndexAssignmentTarget {
  readonly kind: "index-target";
  readonly type: ScalarType;
  readonly target: GenIdentifier;
  readonly index: GenExpression;
}

export interface GenCallStatement {
  readonly kind: "call-statement";
  readonly callee: GenIdentifier;
  readonly arguments: readonly (GenExpression | GenArrayReferenceExpression)[];
}

export interface GenScalarParameter {
  readonly kind: "scalar-parameter";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
}

export interface GenArrayParameter {
  readonly kind: "array-parameter";
  readonly name: GenIdentifier;
  readonly type: GenArrayType;
}

export type GenParameter = GenScalarParameter | GenArrayParameter;

export interface GenArrayPlacementFixtureV1 {
  readonly revision: "structured-array-placement-v1";
  readonly bindings: readonly {
    readonly arrayName: GenIdentifier;
    readonly baseAddress: number;
  }[];
}

export interface GenUnaryExpression {
  readonly kind: "unary";
  readonly type: ScalarType;
  readonly operator: "-" | "~" | "!";
  readonly operand: GenExpression;
}

export interface GenConst {
  readonly kind: "const";
  readonly name: GenIdentifier;
  readonly type: ScalarType;
  readonly value: GenExpression;
}

// GenModule.constants is readonly GenConst[].

export interface GenIfStatement {
  readonly kind: "if";
  readonly condition: GenExpression;
  readonly thenBody: readonly GenStatement[];
  readonly elseBody: readonly GenStatement[];
}

export interface GenWhileStatement {
  readonly kind: "while";
  readonly condition: GenExpression;
  readonly body: readonly GenStatement[];
}

export interface GenDoWhileStatement {
  readonly kind: "do-while";
  readonly body: readonly GenStatement[];
  readonly condition: GenExpression;
}

export interface GenForStatement {
  readonly kind: "for";
  readonly counter: GenIdentifier;
  readonly counterType: Exclude<ScalarType, "boolean">;
  readonly start: GenExpression;
  readonly direction: "until" | "to" | "downto";
  readonly end: GenExpression;
  readonly step: bigint;
  readonly body: readonly GenStatement[];
}

// GenExpression adds GenIndexExpression and scalar GenCallExpression.
// GenAssignStatement.target becomes GenIdentifier | GenIndexAssignmentTarget.
// GenStatement adds GenArrayDeclaration, GenCallStatement and all four control-flow statements.
```

`GenCallExpression` can represent only scalar-returning calls; a void call is representable only as
`GenCallStatement`. An array reference can occur only as a call argument, never as an arithmetic
operand or scalar assignment. `GenArrayDeclaration.extent` is always fixed; `null` is legal only in
`GenArrayParameter.type.extent`. This makes indexed writes, zero/void calls and sized/unsized
const/mutable array parameters representable without admitting dynamic arrays.

The existing v1 `GenerationBudget` and its historical identity remain unchanged. Structured cases
use `StructuredGenerationBudgetV2`, which adds positive `maxStatementDepth`, plus a v2 usage record
with the `"statement-depth"` dimension. Validation charges it before descending into any nested
statement body. Closed v1/v2 canonicalization and replay dispatch include the field only for v2;
there is no unversioned default or rewrite of historical bytes. Exact limit succeeds and
limit-plus-one returns `generation-budget` without recursive traversal.

The implementation may not add recursive calls, indirect calls, structs, dynamic arrays, general
blocks or unrestricted control flow to Phase 1. (AR-2, AR-4)

### Closed Phase-1 executable contracts

These contracts close the specification-facing interface before test authoring. Names, literal
discriminators and result branches are exact. Implementation may add private helpers, but may not
rename, widen or reinterpret these shapes. Existing v1 types, entry points, canonical bytes and
digests remain byte-for-byte unchanged. (AR-9)

#### Structured validation and budget

```ts
export interface StructuredGenerationBudgetV2 extends GenerationBudget {
  readonly schemaVersion: 2;
  readonly maxStatementDepth: number;
}

export type StructuredGenerationBudgetDimensionV2 =
  | GenerationBudgetDimension
  | "statement-depth";

export type StructuredGenerationReasonV2 =
  | "input-invalid"
  | "input-limit"
  | "budget-exceeded"
  | "array-size-zero"
  | "array-constant-index-out-of-range"
  | "array-index-tier-mismatch"
  | "array-extent-resource-limit"
  | "array-parameter-element-mismatch"
  | "array-parameter-extent-mismatch"
  | "array-parameter-access-mismatch"
  | "array-const-write"
  | "array-unsized-local"
  | "condition-not-boolean"
  | "function-return-path-missing"
  | "call-arity-mismatch"
  | "call-argument-type-mismatch"
  | "call-context-invalid"
  | "call-cycle"
  | "array-scalar-context-invalid"
  | "name-unresolved"
  | "name-conflict"
  | "expression-type-mismatch"
  | "initializer-type-mismatch"
  | "assignment-type-mismatch"
  | "memory-operand-type-mismatch"
  | "return-type-mismatch"
  | "loop-counter-read-only"
  | "constant-expression-not-constant"
  | "constant-dependency-cycle"
  | "constant-value-out-of-range"
  | "constant-zero-divisor"
  | "loop-counter-type"
  | "loop-step-invalid"
  | "loop-bound-out-of-range"
  | "loop-work-exceeded"
  | "statement-depth-exceeded";

export type StructuredDiagnosticFamilyV2 =
  | "array-size-at-least-one"
  | "array-index-constant-out-of-range"
  | "array-index-byte-required"
  | "array-index-word-required"
  | "array-parameter-element-type"
  | "array-parameter-fixed-extent"
  | "array-parameter-access"
  | "const-array-parameter-write"
  | "const-array-to-mutable-parameter"
  | "array-local-requires-fixed-extent"
  | "condition-boolean"
  | "all-code-paths-return"
  | "loop-step-positive"
  | "loop-bound-in-counter-range";

export interface StructuredGenerationDiagnosticV2
  extends Omit<GenerationDiagnostic, "dimension"> {
  readonly reason: StructuredGenerationReasonV2;
  readonly dimension?: StructuredGenerationBudgetDimensionV2;
  readonly diagnosticFamily?: StructuredDiagnosticFamilyV2;
  readonly expectedCompilerDiagnosticCode?: string;
}

export type StructuredGeneratorValidationResultV2 =
  | {
      readonly ok: true;
      readonly module: GenModule;
      readonly usage: Readonly<Record<StructuredGenerationBudgetDimensionV2, bigint>>;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly StructuredGenerationDiagnosticV2[];
    };

export function validateStructuredGeneratorProgram(
  module: unknown,
  budget: unknown,
): StructuredGeneratorValidationResultV2;
```

`validateGeneratorIr(input)` remains the defensive syntax-closure entry and delegates every new
node to the structured validator. `validateStructuredGeneratorProgram(module, budget)` adds type,
call-graph, return-path, access and structured-budget closure. Its v2 budget canonical domain is
the exact UTF-8 string `blend65.readiness.structured-generation-budget.v2`. Exact statement depth
succeeds; depth plus one fails at the first undispatched body path with code `generation-budget`,
reason `statement-depth-exceeded` and dimension `statement-depth`. Array extent above the C64
resource maximum fails with `generation-budget` and reason `array-extent-resource-limit` at the
declaration's `/extent` path; it has no budget dimension because it is a target resource limit.
Static loop work exceeding `maxLoopWork` fails with `generation-budget`, reason
`loop-work-exceeded`, dimension `loop-work` and the loop statement path. Every other inherited
budget dimension fails with `generation-budget`, reason `budget-exceeded`, its exact dimension and
the first rejected node path. Hostile shapes/accessors use `generation-input-invalid` with reason
`input-invalid`; defensive input ceilings use the same code with reason `input-limit`.

Static loop work is the saturating, call-expanded maximum across every declaration-ordered
possible function root. Work inside a statement sequence sums; an `if` charges calls in its
condition and the greater arm; a `for` with static domain size `N` charges calls in its start/end
expressions plus `N + N × bodyWork`; and every call expands the callee's work at that call site's
multiplicity. Each addition and multiplication saturates at `maxLoopWork + 1`. A statically false
`while` costs zero; a false-guard `do-while` costs one iteration plus its body. Every other
unproved dynamic `while` or `do-while` is over-bound. Thus a nested 100-by-100 loop costs 10,100,
not 200, and mutually exclusive roots are never summed. (AR-27)

For dynamic `for` bounds, compile-time expressions contribute singleton intervals and other bounds
contribute their complete scalar-type intervals. With positive step `s`, maximum trips are
`ceil(max(0,endMax-startMin)/s)` for `until`, `floor((endMax-startMin)/s)+1` for a non-empty `to`,
and `floor((startMax-endMin)/s)+1` for a non-empty `downto`. Bound calls execute once; each possible
iteration charges one plus body work. Runtime charges one evaluation step before trace/body work
for every actual iteration. (AR-31)

Module constants are resolved once before entry invocation through a declaration-ordered,
memoized dependency graph. Forward references succeed; the first deterministic dependency
back-edge rejects. Only literal, constant-name, unary and binary constant expressions are admitted;
values use full-precision constant arithmetic, must fit their declared type, and enter an immutable
global environment visible to every frame. Constant evaluation charges one evaluation step per
declaration and expression node, but no frame, memory-cell or effect budget. (AR-32)

A compile-time zero divisor rejects as `constant-zero-divisor` without an invented compiler-code
claim. In structured-v2 runtime evaluation only, `/ 0` returns the result type's maximum and `% 0`
returns typed zero; nonzero division truncates toward zero. Legacy oracle domains remain unchanged.
(AR-33)

The diagnostic families and frozen compiler codes are closed as follows. `—` means RD-08 must not
invent a compiler code; the family itself is the expectation authority.

| Invalid neighbor | `diagnosticFamily` | Compiler code |
|---|---|---|
| Zero array extent | `array-size-at-least-one` | `E10111` |
| Constant index outside fixed extent | `array-index-constant-out-of-range` | — |
| Known array at most 256 total bytes with `word` index | `array-index-byte-required` | `E10117` |
| Known array above 256 total bytes with `byte` index | `array-index-word-required` | `E10118` |
| Element type mismatch | `array-parameter-element-type` | — |
| Sized extent mismatch | `array-parameter-fixed-extent` | — |
| Const/mutable incompatibility | `array-parameter-access` | — |
| Const array-parameter write | `const-array-parameter-write` | `E10123` |
| Const array passed to mutable parameter | `const-array-to-mutable-parameter` | `E10122` |
| Unsized local hostile IR | `array-local-requires-fixed-extent` | — |
| Non-boolean condition | `condition-boolean` | `E10100` |
| Missing scalar return path | `all-code-paths-return` | `E10102` |
| Zero/non-positive loop step | `loop-step-positive` | `E10061` |
| Loop bound outside counter type | `loop-bound-in-counter-range` | `E10064` |

`StructuredDiagnosticFamilyV2` is the union of the literals in that table. Wrong call count or
type, call cycles, void-in-expression and array-in-scalar-expression are structural readiness
rejections with codes `generation-type-invalid` or `generation-input-invalid` and their exact
`reason`; they do not claim a frozen compiler diagnostic.

The remaining required shape mappings are exact. `<f>`, `<s>` and `<a>` are zero-based indices in
the canonical RFC 6901 path.

| Rejected shape | Code | Reason | Path suffix |
|---|---|---|---|
| Wrong call count | `generation-type-invalid` | `call-arity-mismatch` | Exact call path plus `/arguments` |
| Wrong scalar/array argument type | `generation-type-invalid` | `call-argument-type-mismatch` | Exact call path plus `/arguments/<a>` |
| Void call in expression or scalar call as statement | `generation-input-invalid` | `call-context-invalid` | Exact call-expression/statement path |
| Array reference in scalar operator/assignment | `generation-input-invalid` | `array-scalar-context-invalid` | Exact expression path |
| Recursive/direct or indirect call cycle | `generation-type-invalid` | `call-cycle` | `/functions/<f>/body/<s>/callee` |
| Unsized local array hostile shape | `generation-input-invalid` | `array-unsized-local` | `/functions/<f>/body/<s>/extent` |
| Const array write | `generation-type-invalid` | `array-const-write` | Exact index-target path |
| Array parameter element mismatch | `generation-type-invalid` | `array-parameter-element-mismatch` | `/functions/<f>/body/<s>/arguments/<a>` |
| Array parameter fixed-extent mismatch | `generation-type-invalid` | `array-parameter-extent-mismatch` | `/functions/<f>/body/<s>/arguments/<a>` |
| Array parameter access mismatch | `generation-type-invalid` | `array-parameter-access-mismatch` | `/functions/<f>/body/<s>/arguments/<a>` |
| Non-boolean condition | `generation-type-invalid` | `condition-not-boolean` | Exact statement `/condition` path |
| Missing scalar return path | `generation-type-invalid` | `function-return-path-missing` | `/functions/<f>/body` |
| Boolean/invalid loop counter | `generation-type-invalid` | `loop-counter-type` | Exact loop `/counterType` path |
| Non-positive/non-integer loop step | `generation-type-invalid` | `loop-step-invalid` | Exact loop `/step` path |
| Loop bound outside counter type | `generation-type-invalid` | `loop-bound-out-of-range` | Exact loop `/start` or `/end` path |
| Constant index outside extent | `neighbor-invalid` | `array-constant-index-out-of-range` | Exact index expression `/index` path |
| Known Tier-1/Tier-2 index width mismatch | `generation-type-invalid` | `array-index-tier-mismatch` | Exact index expression `/index` path, with `array-index-byte-required`/E10117 or `array-index-word-required`/E10118 |
| Non-constant const initializer | `generation-type-invalid` | `constant-expression-not-constant` | First non-constant expression path below `/constants/<index>/value`; expected compiler code E10193; no diagnostic family |
| Constant dependency cycle | `generation-type-invalid` | `constant-dependency-cycle` | First declaration-ordered name-reference path that closes the dependency cycle; expected compiler code E10194; no diagnostic family |
| Constant value outside declared type | `generation-type-invalid` | `constant-value-out-of-range` | Exact `/constants/<index>/value` path; expected compiler code E10084; no diagnostic family |
| Compile-time zero divisor | `generation-type-invalid` | `constant-zero-divisor` | Exact divisor expression path; no compiler-code claim and no diagnostic family |
| Zero array extent | `neighbor-invalid` | `array-size-zero` | Exact declaration `/extent` path |

#### Structured independent oracle

```ts
export interface StructuredOracleProgramInputV2 {
  readonly schemaVersion: 2;
  readonly handlerId: "oracle.structured-program";
  readonly module: GenModule;
  readonly entryFunction: GenIdentifier;
  readonly parameterBindings: readonly ParameterValueBinding[];
  readonly memory: MemoryFixtureV1;
  readonly arrayPlacement?: GenArrayPlacementFixtureV1;
  readonly generationBudget: StructuredGenerationBudgetV2;
  readonly budget: OracleBudgetV1;
  readonly expectationAuthority: "independent-structured-oracle-v2";
}

export interface StructuredLoopTraceEntryV2 {
  readonly loopPath: string;
  readonly counter: GenIdentifier;
  readonly value: bigint;
}

export interface StructuredArrayAccessTraceEntryV2 {
  readonly expressionPath: string;
  readonly arrayName: GenIdentifier;
  readonly index: bigint;
  readonly effectiveAddress: bigint;
}

export type StructuredOracleProgramResultV2 =
  | {
      readonly ok: true;
      readonly outcome: "modeled";
      readonly observation: ValueStateObservationV1;
      readonly loopTrace: readonly StructuredLoopTraceEntryV2[];
      readonly arrayAccessTrace: readonly StructuredArrayAccessTraceEntryV2[];
      readonly evaluationIdentity: Sha256Digest;
      readonly arrayPlacementIdentity?: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "oracle-unmodeled";
      readonly reason: OracleUnmodeledReason;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly (
        | OracleDiagnostic
        | StructuredGenerationDiagnosticV2
      )[];
    };

export function evaluateStructuredOracleProgram(
  input: unknown,
): StructuredOracleProgramResultV2;
```

Entry parameters remain scalar bindings in declaration order; array scenarios use a zero-parameter
entry wrapper that calls the array-taking function. The evaluator runs
`validateStructuredGeneratorProgram(module, generationBudget)` before execution, so every invalid
structured program rejects before any oracle step. Generation-budget failures retain the complete
structured diagnostic; an oracle runtime-budget excess returns the existing `oracle.budget`
failure without a partial modeled result. Both budgets and the optional placement fixture digest
enter `evaluationIdentity`; the fixture also appears as `arrayPlacementIdentity`, and no fixture
field is rendered into source.

Only the exact expectation-authority literal is accepted. The hostile literals `compiler-output`,
`unoptimized-output` and `golden` each fail with oracle diagnostic code
`oracle.authority.not-accepted` at `/expectationAuthority`. This is a provenance boundary, not a
claim that an arbitrary caller string is trusted; authenticated publication still derives the
accepted expectation from this evaluator's identity-bound result.

#### Loop-unrolling relation and mutation paths

`SemanticRelationRequestV1` and `SemanticRelationResultV1` remain unchanged. The existing
`evaluateSemanticRelation` entry additionally accepts this additive request and result:

```ts
export interface SemanticRelationRequestV2
  extends Omit<SemanticRelationRequestV1, "schemaVersion" | "relationId" | "variantId"> {
  readonly schemaVersion: 2;
  readonly relationId: "relation.loop-unrolling";
  readonly variantId: "unroll-exact-domain-v1";
  readonly generationBudget: StructuredGenerationBudgetV2;
}

export interface SemanticRelationModeledResultV2 {
  readonly ok: true;
  readonly outcome: "modeled";
  readonly relationId: "relation.loop-unrolling";
  readonly sourceCase: GeneratedModeledCase;
  readonly transformedCase: GeneratedModeledCase;
  readonly sourceObservation: OracleObservationV1;
  readonly transformedObservation: OracleObservationV1;
  readonly observation: OracleObservationV1;
  readonly iterationDomain: readonly StructuredLoopTraceEntryV2[];
  readonly diagnostics: readonly [];
}

export type SemanticRelationResultV2 =
  | SemanticRelationModeledResultV2
  | {
      readonly ok: true;
      readonly outcome: "proof-incomplete";
      readonly relationId: "relation.loop-unrolling";
      readonly reason: "volatile-effect-order-unproven";
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "relation-inapplicable";
      readonly relationId: "relation.loop-unrolling";
      readonly diagnostics: readonly [];
    }
  | Exclude<
      OracleResultV1,
      | { readonly ok: true; readonly outcome: "modeled" }
      | { readonly ok: true; readonly outcome: "relation-inapplicable" }
    >;
```

For v2, `selectionPath` must select one `GenForStatement` at
`/functions/<index>/body/<index>`; nested-body selection is outside Phase 1. A pure exact-domain
loop returns modeled equal observations plus one normalized `iterationDomain`, derived from the
selected source loop before rewriting. The rewrite proof must show one unrolled body copy for each
domain entry in order; the transformed program is not required to synthesize a fictitious loop
trace. Any volatile read/write whose order cannot be proven returns `proof-incomplete`; forcing
applicability and the rewrite then returns `oracle.relation.violated`.

The relation adds these exact production paths while reusing the existing fault vocabulary:

| Operation ID | Path ID | Registered variant / fault |
|---|---|---|
| `relation.loop-unrolling` | `relation.loop-unrolling.precondition` | `force-true-v1` / `relation.fault.force-precondition-true` |
| `relation.loop-unrolling` | `relation.loop-unrolling.rewrite` | `non-preserving.unroll-exact-domain-v1` / `relation.fault.non-preserving-rewrite` |
| `relation.loop-unrolling` | `relation.loop-unrolling.rewrite` | `semantic-closure-invalid-v1` / `relation.fault.semantic-closure-invalid-rewrite` |
| `relation.loop-unrolling` | `relation.loop-unrolling.comparator` | `omit-required-observable-v1` / `relation.fault.omit-required-observable` |

The structured evaluator adds these exact mutation dispatch markers to the existing mutation
registry. Tests activate them only through `runWithOracleMutationVariant`; no mutation selector is
added to an oracle request.

`relation.fault.force-precondition-true` is the one additive relation fault required to exercise a
rewrite after the normal volatile-order precondition returns proof-incomplete. The existing
`relation.fault.force-precondition-false` retains its current meaning and v1 behavior.

| Operation ID | Path ID | Variant ID |
|---|---|---|
| `oracle.structured-program` | `oracle.structured.index-address` | `unscaled-index-v1` |
| `oracle.structured-program` | `oracle.structured.call-arguments` | `right-to-left-v1` |
| `oracle.structured-program` | `oracle.structured.scalar-parameter` | `alias-caller-v1` |
| `oracle.structured-program` | `oracle.structured.array-parameter` | `copy-argument-v1` |
| `oracle.structured-program` | `oracle.structured.branch-selection` | `opposite-arm-v1` |
| `oracle.structured-program` | `oracle.structured.loop-domain` | `wrapped-terminal-counter-v1` |

#### Canonical rendering grammar

`renderSourceModule` remains the only renderer entry. It emits exactly two ASCII spaces per block
depth, no blank lines, declarations/functions in existing module order, and one final LF. New forms
render exactly as follows; the existing expression renderer retains precedence and literal
spelling authority.

```text
let values: byte[4] = [1, 2, 3, 4];
let values: byte[4] = [];
value: byte
data: const byte[]
data: byte[4]
values[index]
callee(arg1, arg2)
values[index] = value;
callee(arg1, arg2);
if (condition) {
  statement;
} else {
  statement;
}
while (condition) {
  statement;
}
do {
  statement;
} while (condition);
for (let i: byte = start until end) {
  statement;
}
for (let i: byte = start to end step 2) {
  statement;
}
```

`step 1` is omitted; every larger positive step is rendered as lowercase ` step <decimal>`.

#### Bidirectional package and expectation boundaries

`scanReadinessOracleBoundary` remains the production readiness-to-workspace graph scanner and
retains its existing v1 codes. A narrow companion scanner makes the bidirectional repository rule
callable without introducing a generalized dependency framework:

```ts
export interface ReadinessCompilerBoundaryModuleV1 {
  readonly owner: "readiness" | "compiler-toolchain";
  readonly path: string;
  readonly source: Uint8Array;
}

export interface ReadinessCompilerBoundaryScanInputV1 {
  readonly schemaVersion: 1;
  readonly modules: readonly ReadinessCompilerBoundaryModuleV1[];
}

export type ReadinessCompilerBoundaryDiagnosticCodeV1 =
  | "boundary.readiness-imports-compiler"
  | "boundary.compiler-imports-readiness";

export type ReadinessCompilerBoundaryScanResultV1 =
  | {
      readonly ok: true;
      readonly modulePaths: readonly string[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: ReadinessCompilerBoundaryDiagnosticCodeV1;
        readonly path: string;
        readonly message: string;
      }[];
    };

export function scanReadinessCompilerBoundary(
  input: unknown,
): ReadinessCompilerBoundaryScanResultV1;
```

`test/readiness-boundary.spec.test.ts` reads repository files and supplies them to this scanner. It
includes non-test `.ts` files under `packages/readiness/src` as `readiness` and the production
sources of `core`, `frontend`, `codegen`, `platforms`, `config`, `compiler`, `cli`,
`language-server`, `vscode` and `test-harness` as `compiler-toolchain`. The scanner reports:

- `boundary.readiness-imports-compiler` for any static/dynamic/require import or export of
  `@blend65/compiler` from readiness production;
- `boundary.compiler-imports-readiness` for any static/dynamic/require import or export of
  `@blend65/readiness` from production compiler/toolchain sources;

Synthetic in-memory source modules prove both import directions through the same function. Comments
and unrelated string literals are not imports. Test fixture files and
`*.spec.test.ts`/`*.impl.test.ts` files are outside the production scan so the specification
harness can import the contracts it verifies. Expectation-origin rejection is exercised through
`evaluateStructuredOracleProgram`; the test labels those assertions
`boundary.oracle-expectation-origin`, but that label is not a third scanner diagnostic.

### Authenticated case, execution and initial-binding contracts

The same structured-case registry owns relation fixtures, execution authority and first-vertical
digests. Callers select a stable ID only; they cannot supply a generated case, provenance, oracle
suite, expected observation or digest. (AR-10)

```ts
export type StructuredCaseIdV1 =
  | FirstVerticalCaseIdV1
  | "case.structured.vertical-combined-v1"
  | "case.structured.loop-volatile-order-v1";

export interface StructuredCaseAuthorityV1 {
  readonly caseId: StructuredCaseIdV1;
  readonly caseDigest: Sha256Digest;
  readonly generatedCase: GeneratedModeledCase;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  readonly oracleSuite: OracleSuite;
  readonly oracleInput: StructuredOracleProgramInputV2;
  readonly relationSelectionPath?: string;
}

export type StructuredCaseAuthorityResultV1 =
  | {
      readonly ok: true;
      readonly authority: StructuredCaseAuthorityV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: "structured-case.unknown" | "structured-case.unavailable";
        readonly path: "/caseId";
        readonly message: string;
      }[];
    };

export function resolveStructuredCaseAuthorityV1(
  caseId: unknown,
): StructuredCaseAuthorityResultV1;
```

`caseDigest` is the complete durable authority identity, not merely a source digest. Its canonical
domain is the exact UTF-8 string `blend65.readiness.structured-case-authority.v1`; length-prefixed
fields bind the authority schema/revision, `caseId`, canonical structured-IR digest, rendered
source digest and bytes, spelling, complete validity, primary and ordered claimed rules, bindings,
recomputed construction usage, oracle schema/handler/entry, initial memory, optional placement,
generation and oracle budgets, expectation authority, optional relation path and validated full
replay provenance. The registry deep-snapshots and freezes those same values before insertion, so
no retained caller reference can change semantics without changing identity. (AR-28)

`case.structured.for-inclusive-extremes-v1` resolves a pure top-level `GenForStatement` and
`case.structured.loop-volatile-order-v1` resolves the same finite domain with a volatile access
whose relative order is not proven. Both return `relationSelectionPath` equal to an exact
`/functions/<index>/body/<index>` path. Their provenance, suite and case are constructed together,
so a `SemanticRelationRequestV2` is formed only by copying those authority fields and selecting
`relation.loop-unrolling`/`unroll-exact-domain-v1`; replacing any one authority field rejects as
stale or not accepted. The fixed `generationBudget` is copied from `oracleInput`.

The combined case is the exact canonical form of the program in `00-index` and has these semantic
facts: entry `main`, no entry parameters, empty initial memory, direct one-byte observation at
`$C000`, and independently expected final byte `12`. Its source case digest and oracle evaluation
identity are separately retained.

#### Structured execution-case overload

The existing positional `createExecutionCaseV1(campaign, ordinal, observation)` signature and all
v1 results remain unchanged. It gains only this overload:

```ts
export interface StructuredExecutionCaseRequestV1 {
  readonly schemaVersion: 1;
  readonly kind: "structured-generated";
  readonly caseId: "case.structured.vertical-combined-v1";
}

export function createExecutionCaseV1(
  request: StructuredExecutionCaseRequestV1,
): ExecutionOperationResultV1<ExecutionCaseV1>;

export interface StructuredExecutionCaseProjectionV1 extends ExecutionCaseProjectionV1 {
  readonly kind: "structured-generated";
  readonly caseId: "case.structured.vertical-combined-v1";
  readonly caseDigest: Sha256Digest;
  readonly oracleEvaluationIdentity: Sha256Digest;
  readonly expectedObservation: {
    readonly kind: "direct-mmio";
    readonly address: 49152;
    readonly byteLength: 1;
    readonly value: 12;
  };
}

export function getStructuredExecutionCaseProjectionV1(
  executionCase: ExecutionCaseV1,
): ExecutionOperationResultV1<StructuredExecutionCaseProjectionV1>;

export function getStructuredExecutionOracleContextV1(
  executionCase: ExecutionCaseV1,
): ExecutionOperationResultV1<PublishedOracleContext>;
```

The overload resolves and independently evaluates the registry case internally. It accepts no
observation, address, expected value, digest or oracle result. `sourceCaseDigest` and `caseDigest`
are equal; `oracleEvaluationIdentity` is distinct and binds both structured/oracle budgets. The
fixture and envelope remain the existing v1 shapes, and the envelope observes `$C000` directly.

ST-14 then uses the unchanged `createExecutionRouteRequestV1` and
`createExecutionRouteHandlersV1` entries. The test obtains the opaque oracle through
`getStructuredExecutionOracleContextV1` and supplies the existing request shape. Its deterministic
route item is:

The structured oracle value is a fresh token retained in the same private execution-case state as
its capability; it is not inserted into publication context state and remains invalid at
`createPublishedOracleRequest`. The existing `@blend65/readiness/execution-runtime` subpath exposes
only `isExecutionCaseOraclePairV1(executionCase, oracle)`: structured cases require exact token
identity for that case, while legacy cases preserve the existing published-context probe. The
unchanged route-construction entry uses this verifier, so copied, forged and cross-case tokens fail
closed without creating a second publication authority. (AR-12)

```ts
export type StructuredPhase1ExecutionTierV1 =
  | "frontend"
  | "compiler-api"
  | "emit"
  | "acme";

export function deriveStructuredExecutionRouteRankV1(
  caseDigest: Sha256Digest,
  terminalTier: StructuredPhase1ExecutionTierV1,
): Sha256Digest;
```

The rank preimage is the exact UTF-8 concatenation
`blend65.readiness.structured-route-rank.v1\0<caseDigest>\0<terminalTier>`. The route has
`caseIdentity = caseDigest`, the primary rule
`rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end`,
`obligation = terminalTier`, and the existing canonical prerequisite tiers. No structured route
kind or new runner is added.

The public handler result remains `ExecutionResultV1`. ST-14 asserts one of these exact terminal
codes for each exercised tier; resource-policy codes remain valid globally but are not substituted
for a semantic compiler/emit/assembly result in this case.

| Tier | Passing code | Typed semantic failure codes exercised by ST-14 |
|---|---|---|
| `frontend` | `pass` | `diagnostic-mismatch`, `compiler-ice` |
| `compiler-api` | `pass` | `diagnostic-mismatch`, `compiler-ice` |
| `emit` | `pass` | `diagnostic-mismatch`, `unexpected-emission`, `compiler-ice`, `emission-failure` |
| `acme` | `pass` | `emission-failure`, `assembler-failure`, `tier-unavailable` |

Identity retention is exact across the existing objects: the structured projection retains
`caseId`, `caseDigest` and `oracleEvaluationIdentity`; the route request retains the same digest as
`route.caseIdentity`; and the terminal result retains its tier, stage and evidence digest. The
test compares the projection before and after handler execution. A compiler failure is evidence,
not a reason to alter the independent expected byte.

#### Passive first-vertical candidate validation

Phase 1 validates the exact rule/case/digest map but does not persist or select it. Phase 2 consumes
the validated value through its publication transaction.

```ts
export interface FirstVerticalPublicationCandidateV2 {
  readonly schemaVersion: 2;
  readonly firstVerticalRuleIds: readonly RuleId[];
  readonly evidenceBindings: readonly FirstVerticalEvidenceBindingV2[];
}

export type FirstVerticalCandidateDiagnosticCodeV2 =
  | "first-vertical.input.invalid"
  | "first-vertical.rule-population"
  | "first-vertical.binding-population"
  | "first-vertical.case-identity"
  | "first-vertical.case-digest";

export interface FirstVerticalCandidateDiagnosticV2 {
  readonly code: FirstVerticalCandidateDiagnosticCodeV2;
  readonly path: string;
  readonly message: string;
}

export type FirstVerticalCandidateValidationResultV2 =
  | {
      readonly ok: true;
      readonly candidate: FirstVerticalPublicationCandidateV2;
      readonly candidateDigest: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly FirstVerticalCandidateDiagnosticV2[];
    };

export const FIRST_VERTICAL_RULE_IDS_V1: readonly RuleId[];
export const FIRST_VERTICAL_CASE_IDS_V1: readonly FirstVerticalCaseIdV1[];

export function createFirstVerticalPublicationCandidateV2():
  FirstVerticalPublicationCandidateV2;

export function validateFirstVerticalPublicationCandidateV2(
  input: unknown,
): FirstVerticalCandidateValidationResultV2;
```

The two exported lists equal the literal rule list and case-ID union in this document. The
constructor resolves every digest through `resolveStructuredCaseAuthorityV1` and emits rule rows in
lexical rule order, with each row's evidence in lexical case-ID order. The validator independently
re-resolves those authorities; it never trusts a caller-supplied digest. `candidateDigest` is SHA-256
over canonical candidate bytes with domain
`blend65.readiness.first-vertical-publication-candidate.v2` and no digest field in the input.

Mutation diagnostics use these exact first-failure paths:

| Mutation | Code | Path |
|---|---|---|
| Non-object, extra/missing field or wrong schema | `first-vertical.input.invalid` | Exact rejected field; `/` for the root |
| Shuffled or substituted rule | `first-vertical.rule-population` | `/firstVerticalRuleIds/<index>` |
| Duplicate rule | `first-vertical.rule-population` | Path of the second occurrence |
| Omitted rule | `first-vertical.rule-population` | `/firstVerticalRuleIds` |
| Missing/extra/duplicate/reordered binding row | `first-vertical.binding-population` | `/evidenceBindings` or the first row field that differs |
| Swapped, list-shape-only or unrelated case | `first-vertical.case-identity` | `/evidenceBindings/<row>/evidence/<item>/caseId` |
| Missing, forged or stale digest | `first-vertical.case-digest` | `/evidenceBindings/<row>/evidence/<item>/caseDigest` |

The list-shape-only mutation replaces a rule's complete evidence array with exactly one record:
`{ caseId: "case.structured.first-vertical-list-shape-only-v1", caseDigest: <that row's first
otherwise-valid digest> }`. That hostile ID is deliberately absent from `StructuredCaseIdV1` and
`FirstVerticalCaseIdV1`; it proves that a non-empty, correctly shaped list is not semantic evidence.
It fails with `first-vertical.case-identity` at that record's `/caseId` path before its borrowed
digest is considered.

All diagnostics are deterministically ordered by path then code. The successful candidate and
authority projections are deeply immutable fresh values; mutating a caller-owned clone never
changes registry authority.

### Array semantics

- Valid declared extent is `1..floor(65535 / elementBytes)` for the C64 case model; `null` is
  allowed only for an unsized parameter. The exact maximum succeeds and the next extent returns a
  bounded generation/resource result before compiler invocation.
- An initializer may be empty where the frozen declaration rules permit it; zero extent is not an
  empty initializer and remains E10111.
- Constant index outside the fixed extent creates the named invalid diagnostic family
  `array-index-constant-out-of-range`; the readiness contract does not invent a compiler error
  code where the frozen source does not provide one.
- Runtime-shaped indices remain valid and the independent expected address wraps in the 16-bit
  address space. Any compile-time-foldable index is checked against the fixed extent.
- Index type and tier are validated from total byte size: known arrays at most 256 bytes require a
  `byte` index, larger arrays require `word`, and unsized parameters accept either unsigned width.

ST-03 uses a versioned, identity-bound oracle placement fixture that maps one generated `byte[4]`
array to base `$FFF0`. Its entry parameter `i: byte` has the authenticated binding `$20`, so the
index is runtime-shaped and the arithmetic observation proves `$FFF0 + $20 -> $0010`. A valid
`main(): void` keeps the same module executable through the public frontend/compiler route without
the oracle-only placement fixture; it emits no bounds diagnostic and makes no compiler-selected
readback claim. The word-scaling mutation instead uses Tier-2 `word[129]`, entry parameter
`i: word = $0081` and base `$FFF0`: scaled/wrapped `$00F2` contains `$1234`, while unscaled/wrapped
`$0071` contains `$ABCD`. Parameter bindings and memory bytes enter existing authority identity.
(AR-34)

The structured-oracle input gains optional `arrayPlacement: GenArrayPlacementFixtureV1`. Validation
requires the exact revision, a non-empty unique binding list, an in-module array name and an integer
base in `0..65535`; the canonical fixture bytes and digest enter oracle-evaluation identity.

### Call semantics

- Resolve a unique generated function by name; recursion/cycles are rejected before evaluation.
- Arguments evaluate left-to-right and must match parameter count/type.
- Scalars are copied into the callee frame; nested calls use distinct evaluator frames.
- Sized and unsized array arguments bind by reference to caller storage. An indexed write through a
  mutable parameter is immediately caller-observable; copying the array is an oracle mutation.
- A write through a `const` array parameter rejects before evaluation. Element type, fixed extent
  and const/mutable compatibility are validated at the call path; an unsized parameter accepts any
  positive extent with the exact element type and required access.
- `void` calls are statements; scalar calls are expressions; return propagation is exact.

### Branch and loop semantics

- Conditions are boolean; both branch bodies are ordered statement arrays.
- The evaluator charges every condition, statement, call and loop iteration.
- `while` covers zero iterations; `do-while` covers at least one; `for` covers zero/one/multiple
  iterations with explicit inclusive/exclusive direction.
- Ordered-domain construction explicitly covers a full ascending type range, descending to the
  type minimum and a positive step whose next value crosses the type maximum. Termination occurs
  after the last in-range iteration rather than after a wrapped comparison.
- A step must be a positive compile-time integer. The first operation exceeding `loop-work`
  returns the existing `generation-budget`/oracle budget result without partial passing evidence.
- Name, scope, expression, initializer, assignment, memory-operand, return and loop-counter
  failures use the focused AR-29 reasons at the first offending path. Existing array, call and
  condition reasons remain authoritative when they are more specific; `generation-type-invalid`
  remains the general closed-type failure rather than being overloaded with a call-specific code.
- The loop-unrolling relation applies only when it proves the same ordered iteration domain,
  overflow and effects. A loop with an unproven volatile-effect order returns proof-incomplete;
  applying the transform anyway is a mutation failure.

### Exact first vertical rule population

The first publication's `firstVerticalRuleIds` is exactly this lexical list. Each ID is directly
owned by one or more ST cases; no chapter/category predicate adds members. (AR-3)

```text
rule.ch05.4-2-rules.both-body-else-body-blocks-cf
rule.ch05.4-2-rules.e10100-condition-boolean-cf-2-divide
rule.ch05.4-2-rules.e10102-all-code-paths-return-non
rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false
rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated
rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end
rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end
rule.ch06.fn-10.calling-function-multiple-arguments-argument-expressions
rule.ch06.fn-2.callee-receives-copy-modifying-parameter-inside
rule.ch06.fn-2.parameters-scalar-types-byte-sbyte-word
rule.ch06.fn-4.functions-return-scalar-types-only
rule.ch08.2-2-element-types.byte.size-per-element.1-byte
rule.ch08.ar-8.compile-time-index-compile-time-constant
rule.ch08.ar-8.out-bounds-constant-index-compile-error
rule.ch08.ar-8.runtime-no-bounds-checking-default-too
rule.ch08.ar-8.without-bounds-check-out-bounds-runtime
```

The first publication additionally carries closed bindings from rule identity to stable published
case identity and its content digest:

```ts
export type FirstVerticalCaseIdV1 =
  | "case.structured.branch-arms-v1"
  | "case.structured.invalid-condition-v1"
  | "case.structured.missing-return-v1"
  | "case.structured.while-zero-v1"
  | "case.structured.do-while-one-v1"
  | "case.structured.for-inclusive-extremes-v1"
  | "case.structured.for-until-v1"
  | "case.structured.call-argument-order-v1"
  | "case.structured.scalar-copy-v1"
  | "case.structured.scalar-signatures-v1"
  | "case.structured.scalar-returns-v1"
  | "case.structured.byte-array-index-v1"
  | "case.structured.constant-index-v1"
  | "case.structured.constant-oob-v1"
  | "case.structured.runtime-oob-public-v1"
  | "case.structured.runtime-wrap-oracle-v1";

export interface FirstVerticalEvidenceBindingV2 {
  readonly ruleId: RuleId;
  readonly evidence: readonly {
    readonly caseId: FirstVerticalCaseIdV1;
    readonly caseDigest: Sha256Digest;
  }[];
}
```

ST labels below are test-plan traceability only and never appear in publication bytes. Selection
requires exact lexical rule identity, the exact stable case identities below and digests matching
the authenticated published cases. It rejects absent/duplicate/swapped bindings, list-shape-only
evidence and an unrelated semantic case at the exact binding path.

| First-vertical rule ID | Stable published case identity | Test traceability |
|---|---|---|
| `rule.ch05.4-2-rules.both-body-else-body-blocks-cf` | `case.structured.branch-arms-v1` | ST-08, ST-09 |
| `rule.ch05.4-2-rules.e10100-condition-boolean-cf-2-divide` | `case.structured.invalid-condition-v1` | ST-38 |
| `rule.ch05.4-2-rules.e10102-all-code-paths-return-non` | `case.structured.missing-return-v1` | ST-38 |
| `rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false` | `case.structured.while-zero-v1` | ST-10 |
| `rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated` | `case.structured.do-while-one-v1` | ST-11 |
| `rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end` | `case.structured.for-inclusive-extremes-v1` | ST-12, ST-40 |
| `rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end` | `case.structured.for-until-v1` | ST-12 |
| `rule.ch06.fn-10.calling-function-multiple-arguments-argument-expressions` | `case.structured.call-argument-order-v1` | ST-05, ST-07 |
| `rule.ch06.fn-2.callee-receives-copy-modifying-parameter-inside` | `case.structured.scalar-copy-v1` | ST-06 |
| `rule.ch06.fn-2.parameters-scalar-types-byte-sbyte-word` | `case.structured.scalar-signatures-v1` | ST-39 |
| `rule.ch06.fn-4.functions-return-scalar-types-only` | `case.structured.scalar-returns-v1` | ST-39 |
| `rule.ch08.2-2-element-types.byte.size-per-element.1-byte` | `case.structured.byte-array-index-v1` | ST-01, ST-39 |
| `rule.ch08.ar-8.compile-time-index-compile-time-constant` | `case.structured.constant-index-v1` | ST-01, ST-02 |
| `rule.ch08.ar-8.out-bounds-constant-index-compile-error` | `case.structured.constant-oob-v1` | ST-02 |
| `rule.ch08.ar-8.runtime-no-bounds-checking-default-too` | `case.structured.runtime-oob-public-v1` | ST-03 public route |
| `rule.ch08.ar-8.without-bounds-check-out-bounds-runtime` | `case.structured.runtime-oob-public-v1`, `case.structured.runtime-wrap-oracle-v1` | ST-03 oracle and public route |

## Integration Points

- `validateGeneratorIr` remains the public closure operation and invokes structured validation.
- `renderSourceModule` remains the renderer entry and invokes structured rendering.
- Existing modeled suite/case identities remain the case authority.
- Existing oracle suite remains the expectation authority; compiler output is never an oracle.
- Structured-v2 budget, canonical identity, replay normalization and oracle-evaluation identity
  carry `maxStatementDepth`; the v1 budget and canonical bytes remain unchanged.
- The existing semantic-relation ID/input, analysis-path, transform, comparison, conformance and
  mutation-dispatch modules all receive the loop-unrolling relation as one closed path. No
  structured-only shadow relation is permitted.
- `createExecutionCaseV1` gains one authenticated structured-case branch that derives the existing
  execution projection's source, entry observation and bounded memory cells from the modeled case
  plus accepted oracle result. Callers cannot supply an address or expectation directly. This
  admits ST-14's `$C000` observation without changing the execution envelope or route format and
  preserves the existing fixed memory-case behavior.
- `@blend65/readiness-execution` consumes the unchanged published envelope through its current
  public route adapters; the integration fixture adds no route or production seam. (AR-8)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Hostile/cyclic/accessor IR | Existing bounded defensive inspection rejects before traversal | AR-4 |
| Zero array extent | Named E10111 invalid neighbor; never valid empty shape | AR-2 |
| Constant OOB index | Named diagnostic family; compiler mismatch becomes evidence | AR-2 |
| Computed OOB index | Valid, with 16-bit wrapped expected address | AR-2 |
| Wrong call count/type or call cycle | Stable invalid/unmodeled result before compiler invocation | AR-2 |
| Non-boolean branch/loop condition | Stable type-invalid result | AR-2 |
| Loop budget exceeded | Existing applicable budget result; no partial success | AR-2 |
| Compiler rejects or miscompiles valid source | Exact failing evidence routed outside RD-08 | AR-1 |

## Testing Requirements

- ST-01–ST-15, ST-33–ST-36 and ST-38–ST-40 cover the Phase-1 exact IR, source, oracle,
  relation and public-route behavior. Phase 4 reuses ST-34 while binding its family; ST-37 remains
  owned by Phase 2.
- Mutation tests seed wrong indexing, call order/return, branch selection, loop bounds and effect
  order.
- Phase 1 full verify must pass even when a generated compiler case records a failing disposition;
  the evidence contract, not compiler correctness, is RD-08's implementation result.
