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

Keep the central unions in `generator-ir.ts`, then delegate new behavior to four local modules:

```
GenModule
  ├─ structured-ir-validation.ts
  ├─ structured-source-renderer.ts
  ├─ structured-case-families.ts
  └─ structured-oracle-evaluator.ts
                 ↓
       existing published case/envelope
                 ↓
 existing readiness-execution public routes
```

No module becomes a generic visitor, second parser or compiler AST adapter. Each handles only the
new closed discriminants. (AR-4, AR-8)

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

### Array semantics

- Valid declared extent is `1..floor(65535 / elementBytes)` for the C64 case model; `null` is
  allowed only for an unsized parameter. The exact maximum succeeds and the next extent returns a
  bounded generation/resource result before compiler invocation.
- An initializer may be empty where the frozen declaration rules permit it; zero extent is not an
  empty initializer and remains E10111.
- Constant index outside the fixed extent creates the named invalid diagnostic family
  `array-index-constant-out-of-range`; the readiness contract does not invent a compiler error
  code where the frozen source does not provide one.
- Computed indices remain valid and the independent expected address wraps in the 16-bit address
  space.
- Index type and tier are validated from total byte size.

ST-03 uses a versioned, identity-bound oracle placement fixture that maps one generated array name
to base `$FFF0`. The fixture is accepted only by the independent structured-oracle input, is never
rendered into Blend source, and is never derived from compiler output. Its arithmetic observation
proves `$FFF0 + $0020 -> $0010`. A separate public frontend/compiler route proves that the same
computed out-of-bounds source remains valid and emits without a bounds diagnostic; it does not
claim a byte value from compiler-selected placement.

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
| `rule.ch08.ar-8.without-bounds-check-out-bounds-runtime` | `case.structured.runtime-wrap-oracle-v1`, `case.structured.runtime-oob-public-v1` | ST-03 oracle and public route |

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
