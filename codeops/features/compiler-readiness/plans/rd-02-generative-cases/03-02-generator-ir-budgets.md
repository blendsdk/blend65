# Generator IR and Structural Budgets

> **Document**: 03-02-generator-ir-budgets.md
> **Parent**: [Index](00-index.md)

## Overview

The generator IR represents only constructs that the first modeled subset can prove. It is an
immutable, compiler-independent data model with no source spans or compiler symbols (AR-P3).

## IR surface

```ts
type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";

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
```

Module, const, function and parameter declarations compose these nodes. Identifiers are validated
allowlist values and module paths are logical segments, never host paths.

## Valid and invalid generation

Valid construction is predicate-driven. Every constructor returns a typed result with accumulated
cost; impossible choices are excluded before drawing. An invalid neighbor:

1. starts from a valid case;
2. applies exactly one named operation;
3. reruns all participating predicates;
4. succeeds only when the named predicate alone changes valid→invalid;
5. records the expected diagnostic family from the model.

This is the sole meaning of “one intentional violation” (AR-P8).

## Boundary transform

`transform.boundary-variants` deterministically expands a model choice into empty/min/max and
nearest-invalid neighbors, width/sign boundaries, spelling variants, nesting depths and minimal
cross-module forms. It does not decide expected runtime values; RD-03 owns that oracle.

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
```

All numeric fields are positive closed-range integers. Construction accounts incrementally and
the final case is recounted independently. Products use checked BigInt arithmetic. The initial IR
does not emit loops, but `maxLoopWork` remains zero/one-derived and is tested so later extension
cannot bypass the contract (AR-P11).

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Invalid identifier/path segment | `generation-input-invalid` | AR-P12 |
| Budget exceeded during construction | `generation-budget` with dimension | AR-P11 |
| Completed case recount differs | Internal invariant failure; no source | AR-P11 |
| Neighbor flips zero/multiple contracts | `neighbor-invalid` | AR-P8 |
