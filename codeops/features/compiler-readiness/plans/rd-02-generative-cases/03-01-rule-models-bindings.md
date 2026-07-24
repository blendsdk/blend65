# Rule Models and Bindings

> **Document**: 03-01-rule-models-bindings.md
> **Parent**: [Index](00-index.md)

## Overview

This component turns RD-01 rule identities into explicit generator readiness without modifying
inventory semantics. Canonical JSON owns reviewable facts; TypeScript owns executable operations
(AR-P2). Bindings are validated in candidate and published states (AR-P9).

## Canonical contracts

```ts
type RuleModelState =
  | { readonly state: "modeled"; readonly model: ModeledRuleRecord }
  | { readonly state: "unmodeled"; readonly reason: RuleModelReason }
  | { readonly state: "not-generatable"; readonly reason: RuleModelReason };

interface ModeledRuleRecord {
  readonly ruleId: RuleId;
  readonly citations: readonly ModelCitation[];
  readonly constructorIds: readonly ConstructorId[];
  readonly predicateIds: readonly PredicateId[];
  readonly neighborIds: readonly NeighborId[];
  readonly boundaryFamilyIds: readonly BoundaryFamilyId[];
  readonly spellings: readonly SpellingKind[];
}

interface ExecutableBinding<TImplementation> {
  readonly handlerId: HandlerId;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: Sha256Digest;
  readonly implementation: TImplementation;
}
```

`RuleModelReason`, operation IDs and spelling kinds are closed discriminated unions. The canonical
manifest covers every current inventory rule exactly once and is stored in lexical rule-ID order.
Modeled records require at least one source citation and one executable predicate. Non-modeled
states project to RD-06 `unmodeled` while retaining their distinct reason code.

## Executable registry

The TypeScript registry contains pure constructors, predicates and neighbor operations keyed by
generated closed IDs. Loading performs three linear joins:

1. inventory rule IDs ↔ canonical model records;
2. modeled operation IDs ↔ executable operations;
3. handler declarations ↔ executable handler bindings.

No operation may inspect requirement prose, compiler types or compiler output.

## Binding state machines

### Candidate validation

- declaration exists and is `unbound`;
- ID, kind and contract version match;
- implementation revision is a canonical SHA-256 digest;
- implementation is registered exactly once;
- candidate is not returned by published lookup.

### Published-state validation

- declaration exists and is `bound`;
- exactly one compatible binding exists in the selected publication snapshot;
- no unbound declaration has a published binding;
- every RD-02-owned bound declaration has a binding;
- RD-03/RD-04 unbound declarations remain untouched.

## First modeled subset

The manifest models only the cited rules needed for primitive scalar types, literal/const/local/
parameter expressions, minimal module/functions, arithmetic/comparison grouping and the four
memory intrinsics. It includes runtime/computed address operands because the specification permits
them; current compiler rejection is evidence to be found later, not a generator constraint
(AR-P1).

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Missing/duplicate/unknown rule | Deterministic model-registry diagnostic | AR-P2 |
| Unknown operation ID | Registry rejected before generation | AR-P2 |
| Candidate against bound declaration | Candidate-state mismatch | AR-P9 |
| Published binding against unbound declaration | Published-state mismatch | AR-P9 |
| Invalid digest/version/kind | Closed binding diagnostic | AR-P9 |

## Tests

- Exhaustive 2,112-rule coverage and non-vacuity.
- One-to-one executable operation joins.
- Candidate/published state matrix.
- Dependency boundary across every new production file.
