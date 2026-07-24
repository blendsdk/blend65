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
  readonly constructionPreconditions: readonly ConstructionPrecondition[];
  readonly typedDomains: readonly TypedDomain[];
  readonly invalidContracts: readonly InvalidContract[];
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
Modeled records require at least one source citation, one closed construction precondition, one
typed domain and one executable predicate. Each invalid contract names its expected diagnostic
family. Validation evaluates executable operations against these canonical facts; matching IDs
alone never establishes modeled coverage. Non-modeled states project to RD-06 `unmodeled` while
retaining their distinct reason code.

## Executable registry

The TypeScript registry contains pure constructors, predicates and neighbor operations keyed by
generated closed IDs. Loading performs three linear joins:

1. inventory rule IDs ↔ canonical model records;
2. modeled operation IDs ↔ executable operations;
3. handler declarations ↔ executable handler bindings.

No operation may inspect requirement prose, compiler types or compiler output.

`implementationRevision` is derived, not supplied. The domain tag
`blend65-handler-implementation-v1` covers canonical LF-normalized UTF-8 bytes of the handler entry
module and its complete transitive production-module dependency set, each preceded by its
repository-relative path and byte length in lexical path order. Generated revision metadata and a
freshness gate reject changed, missing or extra dependency bytes before candidate validation,
replay or publication.

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

The initial modeled set is exactly these nine inventory rules. Every other rule remains explicitly
`unmodeled` or `not-generatable`; adding a rule requires an amended seed contract and new accepted
review evidence.

| Concern | Exact rule IDs |
|---|---|
| Scalar value domains | `rule.ch02.2-primitive-types.byte.range.0-255`; `rule.ch02.2-primitive-types.sbyte.range.128-127`; `rule.ch02.2-primitive-types.word.range.0-65535`; `rule.ch02.2-primitive-types.sword.range.32768-32767`; `rule.ch02.2-primitive-types.boolean.range.true` |
| Memory signatures | `rule.ch12.3-1-memory-access.peek-addr.signature.word`; `rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte`; `rule.ch12.3-1-memory-access.peekw-addr.signature.word`; `rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word` |

Each scalar rule carries its exact domain, boundary family, literal/const/local/parameter
constructors, range/type predicate and nearest-invalid neighbors. Each memory rule carries its
exact parameter/return types, literal/const/local/parameter address spellings, value spellings
where applicable, and wrong-type/wrong-arity invalid contracts. Runtime/computed address operands
are mandatory model-valid constructor variants because the specification permits them; current
compiler rejection is evidence to be found later, not a generator constraint (AR-P1).
Arithmetic/comparison expressions and module/function scaffolding are IR composition machinery,
not extra modeled-coverage claims.

Before generator implementation, a separate semantics reviewer records the exact seed-contract and
manifest digests, reviewer identity, disposition and citations in
`readiness/reviews/rule-models-v1-review.json`. Candidate validation requires accepted,
digest-matching evidence; any model-fact or manifest change invalidates it.

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
- Exact equality with the nine-rule seed set and per-rule contract/spelling matrix.
- Manifest-fact mutation and implementation-revision freshness failures.
- Candidate/published state matrix.
- Dependency boundary across every new production file.
