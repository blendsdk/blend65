# Component Specification: Evaluation Identity and Mutation Adequacy

> **Document**: 03-04-identity-mutation.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P14, AR-P17–AR-P18, AR-P20

## Responsibility

Bind every expected-result decision to exact cases, policy, authority and executable revisions
without changing RD-02 source-case identity. Prove that every production semantic branch is
observable through a closed mutation catalog.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/oracle-evaluation-identity.ts` | Canonical preimage and digest |
| `packages/readiness/src/oracle-evaluation-collision.ts` | Bounded digest/preimage registry |
| `packages/readiness/src/oracle-mutation-model.ts` | Closed catalog and result contracts |
| `packages/readiness/src/oracle-conformance-v1.ts` | Operation-scoped production mutation seam |
| `packages/readiness/src/oracle-mutation-runner.ts` | Exhaustive catalog execution/report |
| `readiness/oracles/oracle-mutations-v1.json` | Canonical required-mutant catalog |

## Evaluation Identity

```ts
interface OracleEvaluationIdentityInputV1 {
  readonly schemaVersion: 1;
  readonly sourceCaseId: Sha256Digest;
  readonly transformedCaseId?: Sha256Digest;
  readonly relationId?: SemanticRelationId;
  readonly diagnosticManifestDigest: Sha256Digest;
  readonly budget: OracleBudgetV1;
  readonly policyRevision: "oracle-policy-v1";
  readonly observableProjectionId: string;
  readonly participants: readonly {
    readonly handlerId: HandlerId;
    readonly contractVersion: string;
    readonly implementationRevision: Sha256Digest;
  }[];
}
```

Canonical encoding uses explicit field tags, fixed field order, UTF-8, length prefixes, canonical
decimal `bigint` strings, lexical participant order and domain
`blend65-oracle-evaluation-v1`. Optional fields are encoded with an explicit presence byte.

Validation requires:

- exact RD-02 source and optional transformed case digests;
- relation ID iff a transformed case is present;
- exact manifest, policy and projection identities;
- at least one and at most five lexical unique participants;
- the route-required oracle and, for metamorphic evaluation, transform handler;
- every participant contract and implementation revision from the same selected snapshot.

Every field mutation changes the digest. The source case ID itself is returned unchanged and
remains replayable under RD-02. A bounded collision registry retains canonical preimages and
rejects equal digests for unequal bytes; no nearest/current revision fallback exists.

## Mutation Catalog Shape

```ts
interface OracleMutationCatalogV1 {
  readonly schemaVersion: 1;
  readonly catalogVersion: "1.0.0";
  readonly policyRevision: "oracle-mutation-policy-v1";
  readonly mutants: readonly OracleMutantV1[];
}

interface OracleMutantV1 {
  readonly mutantId: string;
  readonly family:
    | "evaluator-operation"
    | "diagnostic-mapping"
    | "transform-precondition"
    | "transform-rewrite"
    | "relation-comparator";
  readonly operationId: string;
  readonly variantId: string;
}
```

Rows are lexical, unique and closed. Validation derives the required production operation set from
the evaluator operation registry, nineteen diagnostic mappings, five relation preconditions, every
closed rewrite variant and five comparators. Each required operation has at least one catalog row;
unknown, missing, duplicate and non-production operation IDs reject the catalog.

## Production-Path Mutation Seam

`oracle-conformance-v1.ts` is private to the package and exposes an operation-scoped async context
for tests. Production dispatch asks the seam for the selected variant at the actual operation
boundary. Mutants therefore alter real evaluator/manifest/transform/comparator behavior rather
than copying logic into tests.

The default context is immutable baseline behavior. Mutant contexts are isolated across concurrent
tests, reject nested incompatible activation and cannot leak into ordinary calls. The package
boundary test prevents this policy seam from being imported by unrelated production modules.

Required mutant effects include:

- wrong arithmetic/bitwise/comparison/normalization result for every operation ID;
- operand or volatile-effect order reversal;
- one wrong exact diagnostic mapping for every manifest row;
- one false-positive precondition per relation;
- one non-preserving rewrite per closed rewrite variant;
- one required observable omitted or normalized incorrectly per comparator.

## Adequacy Result

```ts
interface OracleMutationReportV1 {
  readonly catalogDigest: Sha256Digest;
  readonly required: bigint;
  readonly killed: bigint;
  readonly survivors: readonly string[];
}
```

The mutation runner executes the immutable specification vector assigned to each catalog row. A
mutant is killed only when the expected specification assertion fails for the mutant while the
baseline passes. Completion requires `required === killed` and an empty survivor list. Budget,
timeout or harness failures are failures, not kills.

The catalog digest and conformance policy revision enter the relevant implementation revisions and
final semantic-review units. Adding a production operation without a catalog row fails source
checks before publication.
