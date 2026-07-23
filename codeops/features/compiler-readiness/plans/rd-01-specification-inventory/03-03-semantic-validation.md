# Semantic Validation: RD-01 Specification Inventory

> **Document**: 03-03-semantic-validation.md
> **Parent**: [Index](00-index.md)

## Overview

Semantic validation turns schema-valid data and resolved source fragments into one trustworthy
denominator. Passes validate source ownership, ledger totality, decomposition, conflicts,
declarations, evidence capabilities, target projection and rule relationships (AR-P7–AR-P9).

## Validation pipeline

### Phase-3 public boundary

Phase 3 exposes pure, non-mutating validators. Tests and later composition use these exact
contracts; policy helpers and hash builders remain private:

```ts
export interface ResolvedSourceFragment {
  readonly sourcePath: string;
  readonly fragment: SourceFragment;
  readonly quote: string;
}

export interface SemanticValidationContext {
  readonly fragments: readonly ResolvedSourceFragment[];
  readonly identityLedgerBytes: Uint8Array;
  readonly limits: InventoryLimits;
}

export interface RuleGraphResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly topologicalRuleIds?: readonly string[];
}

export function validateLedger(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult;
export function validateConflicts(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult;
export function validateDeclarations(inventory: InventoryV1): ValidationResult;
export function validateRuleGraph(inventory: InventoryV1): RuleGraphResult;
export function validateInventorySemantics(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult;
```

Each focused `ValidationResult` validator returns the input inventory only on success;
`validateRuleGraph` instead returns only graph diagnostics/order. The composed validator detects
duplicate rule IDs first; on failure it builds no identity index or graph. It then runs ledger,
conflict, declaration and graph passes in that order, reports deterministic diagnostics from the
earliest failing pass only and returns no topological order on failure. Valid-but-blocked
inventories return `ok: true`, the inventory, graph order and typed blocking reasons. Callers pass
fragments, canonical source paths and normalized quotes already resolved by the source phase;
duplicate `(sourcePath, fragmentId)` pairs are invalid.

Conflict records and five target-projected child rules are authored, reviewed inventory authority.
Validators verify and index them; they never infer natural-language conflict classes, allocate IDs
or synthesize rule records. “Produces one aggregate” and “children result” mean the validated view
contains exactly the one authored aggregate or five authored children.

### Ownership, ledger and conflicts

Every derived included fragment has exactly one ledger entry whose disposition is:

- `mapped` to one or more independently falsifiable rules;
- `decomposed` with exhaustive, non-overlapping child outcomes;
- reason-coded `non-normative`;
- `canonical-restatement` linking the owning rule and reviewed equivalent-restatement conflict; or
- `blocked-errata` linking one aggregate conflict record.

Ledger entries have unique fragment IDs and every referenced rule/conflict exists. `mapped`
contains lexically ordered unique rule IDs. `decomposed` contains at least two child outcomes with
unique lexically ordered outcome IDs; each outcome has a nonempty lexically ordered unique rule-ID
set, and no rule ID occurs in two outcomes of that entry. Together the outcomes contain exactly the
rules sourced by that parent fragment. A rule can be owned by only one `mapped` or `decomposed`
entry; restatement and blocked entries never create ownership.

The v1 `canonical-restatement` schema/model therefore requires both `canonicalRuleId` and
`conflictId`. That conflict has classification `equivalent-restatement`, contains the restatement
fragment's resolved citation and names exactly the canonical rule.

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

`readiness/inventory/rule-identities-v1.jsonl` is supplied as bytes and is UTF-8, LF-delimited JSON
with no BOM or blank lines. Each line is one closed event:

```ts
export interface RuleIdentityEvent {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly operation: "allocate" | "retire";
  readonly ruleId: string;
  readonly predecessorRuleIds: readonly string[];
  readonly successorRuleIds: readonly string[];
  readonly previousHash: `sha256:${string}`;
  readonly eventHash: `sha256:${string}`;
}
```

Sequence starts at zero and is contiguous. The fixed previous hash for sequence zero is
`sha256:9aeecea544992e64dcac88c5d625cc43b036424482397cd72b56705abc46ca23`,
the SHA-256 of UTF-8 `blend65.rule-identities.v1\ngenesis\n`. Every later `previousHash` equals the
prior event hash; `identityLedgerHead` equals the final event hash, or the genesis hash for an
empty ledger.

To compute `eventHash`, serialize exactly these keys in order with JSON string escaping, no
insignificant whitespace and UTF-8:
`schemaVersion,sequence,operation,ruleId,predecessorRuleIds,successorRuleIds,previousHash`.
Arrays are lexically ordered and duplicate-free. Hash ASCII `blend65.rule-identity-event`, one
zero byte, then the canonical JSON bytes; render the full lowercase SHA-256 with `sha256:`.
`eventHash` is excluded from its own payload.

The stream is rejected before allocation above `maxInputBytes`. It uses strict
duplicate-preserving JSON intake per line, rejects malformed UTF-8/JSON, unknown or duplicate keys
and values beyond `maxDepth`, `maxStringBytes` or `maxRelationshipsPerRule`, and aborts before
event `maxRules * 2 + 1`. Empty input is the only zero-event representation.

An allocation has no successors and a retirement has no predecessors. A rule ID is allocated once,
may be retired once and can never be allocated or active again. Every current inventory rule is
allocated and active; every lineage predecessor is allocated and retired. Successor allocations
precede corresponding predecessor retirements. Each connected replacement is exactly one of:
one-to-one `supersedes`, one-to-many `splitFrom`, or many-to-one `mergedFrom`. Many-to-many
replacement and mixing lineage fields on one rule are invalid and require staged events.
Allocation predecessor and retirement successor sets are lexical, reciprocal and complete.

Conflict validation treats `conflicts` as reviewed input. IDs are unique; citations inside one
record are unique and lexically ordered by path, ancestry, hash and quote; rule IDs are unique and
lexically ordered. Equivalent restatement names one canonical rule; duplicate ownership and
overlapping obligation name every affected rule; contradiction names no passable rule. Every
`blocked-errata` fragment referencing a contradiction points to that one record, and every
citation participating in the contradiction appears in it. Two contradiction records cannot share
a citation. An unresolved contradiction emits one `unresolved-source-conflict` blocking reason
keyed by conflict ID.

### Handler and evidence declarations

The v1 declaration registry contains generator, oracle and transform contracts with owner RD,
contract version and binding state. Evidence capability declarations cover `frontend`,
`compiler-api`, `cli`, `emit`, `acme` and `vice`. Declared/unbound is schema-valid but produces a
distinct readiness-blocking reason; missing or incompatible declarations are validation errors
(AR-P9).

Handler IDs are unique across the handler registry. Every rule `generatorIds`, `oracleIds` and
`transformIds` list is lexical and duplicate-free, resolves to a declaration of the corresponding
kind, and uses that declaration's current contract. When all three lists are empty,
`handlerAbsenceReason` is required; when any is nonempty it is forbidden. Capability IDs are unique
and the authoritative six IDs are exactly `frontend`, `compiler-api`, `cli`, `emit`, `acme` and
`vice`. Every `evidenceObligations` entry is lexical, duplicate-free and resolves to one of these
capabilities. A referenced unbound handler emits one `unbound-handler` reason per declaration; a
referenced unbound capability emits one `unbound-evidence-capability` reason per declaration.
Reason identities are declaration IDs and source paths are the lexical unique paths of affected
rules. Duplicate or unknown declarations are errors, not blocking reasons.

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

`validateReviewEvidence(records, context)` receives `{ expectedSpecRevision, requiredUnitIds,
requiredDependencyIdsByUnit, currentDigests }`. Required unit IDs and every unit's required
dependency IDs are lexical and unique. Records cover the unit set exactly once, and each record's
dependency keys exactly equal that unit's required dependency set: missing, extra or duplicate
units or dependency keys fail. Reviewers are nonempty after trimming, `specRevision` equals the
expected revision, semantic and dependency digests equal current values, and `outcome` is
`accepted`; a blocked outcome never satisfies the gate. Resolved disagreement IDs are lexical and
unique.

### Rule graph and target projection

`prerequisiteRuleIds` forms a deterministic DAG. Validation rejects unknown/self/duplicate edges,
cycles, mandatory-to-inapplicable edges and cross-target prerequisites. Universal obligations
project to stable children for C64, C64U, CX16, A800XL and A7800. Parent prerequisites rewrite to
the corresponding child or target-neutral rule. Only the C64 child is `mandatory-c64`; siblings
remain visible as `out-of-claim-target`.

The authored projection set is grouped by `universalProjection.parentRuleId`. Each parent is an
existing target-neutral rule without `universalProjection`; each group contains exactly one child
for `c64`, `c64u`, `cx16`, `a800xl` and `a7800`. Child IDs remain authored stable IDs. The C64 child
is `mandatory-c64`; the other four are `out-of-claim-target`. All five retain the parent's source
citation. For each parent prerequisite, a child depends on the same-target child when that
prerequisite has a projection group, otherwise on the target-neutral prerequisite. Authored child
prerequisite arrays must already equal that rewrite; validation never mutates them. A projected
child cannot depend on a sibling of another target.

The target-neutral parent uses `out-of-claim-target` with applicability reason code
`universal-parent`, target `universal` and its own source citation. Apart from
`ruleId`, `applicability`, `applicabilityReason`, `prerequisiteRuleIds`, `relatedRuleIds`, `lineage`
and `universalProjection`, every child field equals its parent. Projection is not identity
replacement: children do not name the active parent in lineage. Sibling relationships, if
recorded, use `relatedRuleIds`.

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

`blocked-errata` reasons are keyed by fragment ID and use the referenced conflict's citation paths;
`unresolved-source-conflict` reasons are keyed by contradiction conflict ID and use its citation
paths. Handler/capability reasons use their declaration IDs and affected rule paths. Paths are
lexical and unique. Reasons sort by kind in the list order above, then identity, then the joined
source-path tuple.

For graph failures, inspect rule IDs and neighbor lists lexically. Choose the cyclic strongly
connected component with the lexically least member, start at that member, follow lexically ordered
depth-first edges until the first return to the start, and report the closed path with the start ID
repeated. This defines one canonical cycle even when multiple cycles exist.

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
