# Component Specification: Semantic Relations

> **Document**: 03-03-semantic-relations.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P11–AR-P13, AR-P16–AR-P20, AR-P26–AR-P28, AR-P40

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
| `packages/readiness/src/semantic-relation-conformance.ts` | Relation-scoped production fault seam |
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
  readonly handlerId: "transform.semantic-relations";
  readonly relationId: SemanticRelationId;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  readonly sourceCase: GeneratedModeledCase;
  readonly entryFunction: string;
  readonly selectionPath: string;
  readonly variantId: string;
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
}
```

The public source-authoring handler accepts an `OracleSuite` plus `unknown`; the authoritative entry
receives its reviewed suite through `PublishedOracleContext`. Both validate the closed request and
complete RD-02 replay provenance, regenerate and compare the source case, validate the canonical
JSON pointer/relation/variant/budget, apply one rewrite to an immutable copy, run structural and
oracle semantic-closure validation, evaluate both observations and compare the relation-owned
projection. Phase 4's pure orchestration derives separate domain-separated source/transformed
content digests from those validated immutable cases. A transformed case is never assigned
synthetic RD-02 campaign coordinates. Only the selected-snapshot wrapper derives
revision-complete evaluation identity.

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
- **Comparator:** typed return, full final memory and ordered effects for valid cases. For invalid
  source projections, compare exact manifest code/phase/severity; for invalid external bindings,
  compare exact binding-rejection kind/code/rule/neighbor/spelling. Identifier/span/message text is
  not observable.

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
- **Precondition:** the expression's declared numeric type admits the selected identity. Arithmetic
  and bitwise variants generate a literal of that same numeric type; shift variants generate the
  required canonical unsigned `byte` amount. The rewrite evaluates the original expression exactly
  once and introduces no effects.
- **Rewrite variants:** `add-zero-right`, `subtract-zero-right`, `multiply-one-right`,
  `divide-one-right`, `or-zero-right`, `xor-zero-right`, `and-all-ones-right`,
  `shift-left-zero` and `shift-right-zero`. Arithmetic/bitwise identity literals use the numeric
  expression type. Shift identity amounts use the frozen operator contract's canonical unsigned
  `byte` zero while the shifted expression/result retains its original signed or unsigned type.
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
- **Comparator:** exact value-state for valid cases; exact manifest diagnostic or
  binding-rejection projection according to the invalid projection kind.

## Analysis Invariants

- Binding analysis is independent of compiler symbol tables.
- Purity is a closed structural predicate: literals/names and recursively pure unary/binary
  expressions only; every memory read is impure.
- Dependency analysis is lexical-ID based, bounded and rejects unresolved/cyclic graphs.
- Every rewrite preserves node type annotations and immutable input.
- Every transformed node consumes the shared transformed-output budget.
- Revalidation uses both the public structural IR validator and oracle semantic-closure validator,
  not transform assumptions.
- A no-op rewrite is `relation-inapplicable`, not success.

## Relation Fault Seam

Before the immutable relation suite can reach GREEN, `semantic-relation-conformance.ts` supplies a
private relation-scoped production dispatch seam for precondition, rewrite and comparator paths.
Specification tests use it to inject a false precondition, non-preserving rewrite and omitted
observable into the real relation path. The baseline is immutable and the seam is unavailable from
the public package API.

Phase 4 incorporates these stable relation path IDs into the general exhaustive mutation catalog.
That later generalization may add catalog/worker orchestration but cannot change the already
immutable relation specification or its production path.

## Comparator Invariants

There is no global generic-deep-equality fallback. Each relation dispatcher selects a named closed
projection/comparator revision. State comparators include:

- typed return value including signed type;
- every ordered memory effect including width/address/value;
- every final initialized memory cell including unchanged cells.

Compiler-diagnostic comparators include exactly manifest-declared code, phase and severity.
External-binding comparators include exactly rejection kind/code/rule/neighbor/spelling. They
exclude source positions, renamed identifiers and message formatting. Any omitted required
observable, changed order, type-only mismatch or unexpected extra effect violates the relation.

## Handler Contract

`transform.semantic-relations` is declared as kind `transform`, owner `readiness-rd03`, contract
`1.0.0`. Its implementation revision covers the relation model, validator, analysis, all rewrite
and comparator modules, oracle protocol/evaluator dependencies, diagnostic manifest/projection
bytes and the closed mutation conformance seam.
