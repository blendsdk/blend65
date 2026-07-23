# Semantic Validation: RD-01 Specification Inventory

> **Document**: 03-03-semantic-validation.md
> **Parent**: [Index](00-index.md)

## Overview

Semantic validation turns schema-valid data and resolved source fragments into one trustworthy
denominator. Passes validate source ownership, ledger totality, decomposition, conflicts,
declarations, evidence capabilities, target projection and rule relationships (AR-P7–AR-P9).

## Validation pipeline

### Ownership, ledger and conflicts

Every derived included fragment has exactly one ledger entry whose disposition is:

- `mapped` to one or more independently falsifiable rules;
- `decomposed` with exhaustive, non-overlapping child outcomes;
- reason-coded `non-normative`;
- `canonical-restatement` linking the owning rule; or
- `blocked-errata` linking one aggregate conflict record.

The conflict classifier distinguishes equivalent restatement, duplicate ownership, overlapping
obligations and contradiction. A contradiction produces one stable aggregate containing all
citations and no competing passable rule. Automated checks validate structure and ownership; the
inventory records the reviewed classification rather than attempting to infer natural-language
equivalence at runtime.

Rule decomposition is unique by normative outcome × polarity × applicability. Split/merge lineage
references retired stable IDs; the validator rejects ID reuse, uncovered child outcomes and one
outcome mapped twice (AR-P8). The append-only hash-chained identity ledger is the source of truth
for allocated and retired IDs. Current validation walks from fixed v1 genesis to the
inventory-anchored head and rejects missing, mutated, reordered or reactivated identity facts.

### Handler and evidence declarations

The v1 declaration registry contains generator, oracle and transform contracts with owner RD,
contract version and binding state. Evidence capability declarations cover `frontend`,
`compiler-api`, `cli`, `emit`, `acme` and `vice`. Declared/unbound is schema-valid but produces a
distinct readiness-blocking reason; missing or incompatible declarations are validation errors
(AR-P9).

Generated literal unions and declaration records are derived from the authoritative inventory and
written to `packages/readiness/src/generated/declarations.ts` during Phase 5, exported through the
package barrel and checked for freshness with the complete inventory. Phase 4 renders them in
memory after each population unit to prove deterministic representability without prematurely
publishing a partial projection. They cover bounded handler, capability and declaration identities;
semantic rule IDs remain branded and runtime-validated. They expose identity and contract shape
only, never executable handler logic.

### Independent semantic review

Mechanical validation cannot infer whether real natural-language fragments were classified,
decomposed or assigned evidence correctly. Each chapter, grammar, target-projection and contextual
population unit therefore has separate author and compiler/language reviewer ownership. The
reviewer checks every disposition, normative outcome, applicability choice, conflict class and
evidence-obligation set. Disagreement becomes `blocked-errata`, never a silently accepted row.

`readiness/reviews/compiler-readiness-v1-review.json` records reviewer identity, spec revision,
canonical semantic digest of the reviewed unit, closed dependency digests, outcome and resolved
disagreement references. A unit review survives unrelated later population but becomes stale when
its own fragments/rules or any declared dependency class changes. It is process evidence rather
than semantic authority. The aggregate review is keyed separately to the complete inventory
revision and covers canonical ownership, cross-chapter duplicates, conflicts and target
projections.

### Rule graph and target projection

`prerequisiteRuleIds` forms a deterministic DAG. Validation rejects unknown/self/duplicate edges,
cycles, mandatory-to-inapplicable edges and cross-target prerequisites. Universal obligations
project to stable children for C64, C64U, CX16, A800XL and A7800. Parent prerequisites rewrite to
the corresponding child or target-neutral rule. Only the C64 child is `mandatory-c64`; siblings
remain visible as `out-of-claim-target`.

`relatedRuleIds` is descriptive, allows cycles and never changes topological order. A
lexicographically stable Kahn traversal returns the topological rule sequence; cycle errors include
one deterministic canonical cycle path.

### Blocking reasons

The validator emits typed reasons at minimum for:

- `blocked-errata`;
- `unresolved-source-conflict`;
- `unbound-handler`;
- `unbound-evidence-capability`.

Reasons include affected rule/declaration IDs and source paths, are deterministically ordered and
are exported for RD-06. A blocking reason does not make otherwise valid inventory metadata
unreadable.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Missing/duplicate fragment disposition | Ledger error with fragment ID | AR-P1, AR-P7 |
| Duplicate rule ID or retired-ID reuse | Identity error; graph is not evaluated | AR-P8 |
| Contradiction represented as passable rows | Conflict error requiring one aggregate | AR-P7 |
| Unknown/unbound declaration | Unknown is invalid; unbound is valid plus blocking reason | AR-P9 |
| Invalid prerequisite | Graph diagnostic with source/target IDs | AR-P7 |
| Cycle | One canonical cycle path; no topological output | AR-P7 |
| Missing projected child | Projection diagnostic naming parent and target | AR-P7, AR-P8 |

## Testing Requirements

- Controlled conflict fixtures for all four classifications.
- Ledger totality/decomposition and lineage fixtures.
- Declaration/binding fixtures for all handler kinds and six capabilities.
- Five-target projection and prerequisite-rewrite fixtures.
- DAG, deterministic cycle and related-cycle fixtures.
- Stable blocking-reason serialization for RD-06 consumption.
- Permanent identity/tombstone and predecessor-migration integrity fixtures.
- Revision-keyed per-source-group and aggregate semantic-review evidence fixtures.
