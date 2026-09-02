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

The central type authority adds:

```ts
export interface GenArrayType {
  readonly kind: "array-type";
  readonly elementType: ScalarType;
  readonly extent: number | null;
}

export interface GenArrayDeclaration {
  readonly kind: "array";
  readonly name: GenIdentifier;
  readonly elementType: ScalarType;
  readonly extent: number | null;
  readonly initializer: readonly GenExpression[];
}

export interface GenIndexExpression {
  readonly kind: "index";
  readonly type: ScalarType;
  readonly target: GenIdentifier;
  readonly index: GenExpression;
}

export interface GenCallExpression {
  readonly kind: "call";
  readonly type: ScalarType | "void";
  readonly callee: GenIdentifier;
  readonly arguments: readonly GenExpression[];
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
```

The implementation may refine field names only for zero-semantic-impact consistency. It may not
add recursion, indirect calls, structs, dynamic arrays, general blocks or unrestricted control
flow to Phase 1. (AR-2, AR-4)

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

### Call semantics

- Resolve a unique generated function by name; recursion/cycles are rejected before evaluation.
- Arguments evaluate left-to-right and must match parameter count/type.
- Scalars are copied into the callee frame; nested calls use distinct evaluator frames.
- `void` calls are statements; scalar calls are expressions; return propagation is exact.

### Branch and loop semantics

- Conditions are boolean; both branch bodies are ordered statement arrays.
- The evaluator charges every condition, statement, call and loop iteration.
- `while` covers zero iterations; `do-while` covers at least one; `for` covers zero/one/multiple
  iterations with explicit inclusive/exclusive direction.
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

## Integration Points

- `validateGeneratorIr` remains the public closure operation and invokes structured validation.
- `renderSourceModule` remains the renderer entry and invokes structured rendering.
- Existing modeled suite/case identities remain the case authority.
- Existing oracle suite remains the expectation authority; compiler output is never an oracle.
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

- ST-01–ST-15 plus ST-33 and ST-35 cover exact IR, source, oracle, relation and public-route
  behavior.
- Mutation tests seed wrong indexing, call order/return, branch selection, loop bounds and effect
  order.
- Phase 1 full verify must pass even when a generated compiler case records a failing disposition;
  the evidence contract, not compiler correctness, is RD-08's implementation result.
