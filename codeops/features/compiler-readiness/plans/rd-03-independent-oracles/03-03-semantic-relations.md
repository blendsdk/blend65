# Component Specification: Semantic Relations

> **Document**: 03-03-semantic-relations.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P11–AR-P13, AR-P16–AR-P20

## Responsibility

Apply one machine-checkable semantics-preserving transformation to a generated case, revalidate
the result and compare the exact relation-owned observable projection. The transform engine never
uses current compiler behavior to decide applicability or equivalence.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/semantic-relation-model.ts` | Closed relation request/result contracts |
| `packages/readiness/src/semantic-relation-input.ts` | Hostile-input validation and snapshotting |
| `packages/readiness/src/semantic-relation-analysis.ts` | Binding, dependency, purity and path analysis |
| `packages/readiness/src/semantic-relation-transform.ts` | Relation dispatch and immutable rewrites |
| `packages/readiness/src/semantic-relation-compare.ts` | Relation-local projections/comparators |
| `packages/readiness/src/semantic-relations.ts` | Published handler entrypoint |
| `packages/readiness/src/semantic-relations.impl.test.ts` | Algorithm and negative-path tests |

## Closed Relation Protocol

```ts
type SemanticRelationId =
  | "relation.identifier-renaming"
  | "relation.literal-to-local"
  | "relation.local-to-parameter"
  | "relation.algebraic-identity"
  | "relation.independent-declaration-reordering";

interface SemanticRelationRequestV1 {
  readonly schemaVersion: 1;
  readonly relationId: SemanticRelationId;
  readonly sourceCaseId: Sha256Digest;
  readonly sourceCase: GeneratedModeledCase;
  readonly selectionPath: string;
  readonly variantId: string;
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
}
```

The public handler accepts `unknown`; validates the closed request, source case, canonical JSON
pointer, relation/variant pair and budget; applies one rewrite to an immutable copy; revalidates
the transformed IR; derives its RD-02-compatible case-content identity; evaluates source and
transformed observations; compares the relation-owned projection; then derives the separate
oracle-evaluation identity.

False preconditions return `relation-inapplicable`. Unknown relation/variant IDs, malformed
selection paths, invalid transformed IR or a comparator mismatch are failures. Inapplicable and
failed relations never count as readiness success.

## Relation Contracts

### Identifier renaming

- **Selection:** one constant, function, parameter or local declaration.
- **Precondition:** the declaration and every bound reference are uniquely resolved; the
  deterministic fresh identifier is valid, non-reserved and absent from every intersecting scope.
- **Rewrite:** rename the declaration and its complete bound reference set, including invalid-case
  transform paths when structurally affected; never text-replace source.
- **Variants:** `fresh-sibling-v1`.
- **Allowed cases:** valid and single-neighbor invalid.
- **Comparator:** typed return, full final memory and ordered effects for valid cases; exact
  manifest diagnostic code/phase/severity for invalid cases. Identifier/span/message text is not
  observable.

### Literal to local

- **Selection:** one literal expression inside the entry-function body.
- **Precondition:** the expression is in executable statement scope, the literal is type-valid,
  and insertion before the containing statement cannot cross a return.
- **Rewrite:** insert one deterministic fresh typed local initialized with the literal immediately
  before the containing statement and replace only the selected literal with its name.
- **Variants:** `introduce-local-v1`.
- **Allowed cases:** valid only.
- **Comparator:** exact value-state observation.

### Local to parameter

- **Selection:** one entry-function local declaration.
- **Precondition:** its initializer is pure and uses only literals, constants and existing
  parameters; the local has no later assignment; evaluation succeeds without memory effects; a
  fresh parameter name is capture-free.
- **Rewrite:** remove the local, append one parameter, append the exact evaluated initializer value
  to external parameter bindings and rewrite every bound local reference.
- **Variants:** `lift-entry-local-v1`.
- **Allowed cases:** valid only.
- **Comparator:** exact value-state observation.

### Algebraic identity

- **Selection:** one numeric expression.
- **Precondition:** the expression's declared numeric type admits the selected identity; the
  generated literal has the same type; the rewrite evaluates the original expression exactly once
  and introduces no effects.
- **Rewrite variants:** `add-zero-right`, `subtract-zero-right`, `multiply-one-right`,
  `divide-one-right`, `or-zero-right`, `xor-zero-right`, `and-all-ones-right`,
  `shift-left-zero` and `shift-right-zero`.
- **Allowed cases:** valid only. No commutation, reassociation, `x-x`, `x*0` or other rewrite that
  can change evaluation count/order or intermediate-width overflow is permitted.
- **Comparator:** exact value-state observation.

### Independent declaration reordering

- **Selection:** two adjacent module constants.
- **Precondition:** both initializers are pure; the resolved dependency graph has no path in either
  direction; neither initializer reads memory; both names remain in identical scope.
- **Rewrite:** swap exactly the selected constants.
- **Variants:** `swap-independent-constants-v1`.
- **Allowed cases:** valid and single-neighbor invalid when the invalid transform remains
  structurally resolvable.
- **Comparator:** exact value-state or manifest diagnostic projection according to case validity.

## Analysis Invariants

- Binding analysis is independent of compiler symbol tables.
- Purity is a closed structural predicate: literals/names and recursively pure unary/binary
  expressions only; every memory read is impure.
- Dependency analysis is lexical-ID based, bounded and rejects unresolved/cyclic graphs.
- Every rewrite preserves node type annotations and immutable input.
- Every transformed node consumes the shared transformed-output budget.
- Revalidation uses the public independent IR validator, not transform assumptions.
- A no-op rewrite is `relation-inapplicable`, not success.

## Comparator Invariants

There is no global generic-deep-equality fallback. Each relation dispatcher selects a named closed
projection/comparator revision. State comparators include:

- typed return value including signed type;
- every ordered memory effect including width/address/value;
- every final initialized memory cell including unchanged cells.

Diagnostic comparators include exactly the manifest-declared code, phase and severity. They exclude
source positions, renamed identifiers and message formatting. Any omitted required observable,
changed order, type-only mismatch or unexpected extra effect violates the relation.

## Handler Contract

`transform.semantic-relations` is declared as kind `transform`, owner `readiness-rd03`, contract
`1.0.0`. Its implementation revision covers the relation model, validator, analysis, all rewrite
and comparator modules, oracle protocol/evaluator dependencies, diagnostic manifest/projection
bytes and the closed mutation conformance seam.
