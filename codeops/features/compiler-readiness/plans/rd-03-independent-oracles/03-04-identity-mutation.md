# Component Specification: Evaluation Identity and Mutation Adequacy

> **Document**: 03-04-identity-mutation.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P14, AR-P17–AR-P18, AR-P20, AR-P26–AR-P30, AR-P36, AR-P38

## Responsibility

Bind every expected-result decision to exact cases, policy, authority and executable revisions
without changing RD-02 source-case identity. Prove that every production semantic branch is
observable through a closed mutation catalog.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/oracle-evaluation-identity.ts` | Canonical preimage and digest |
| `packages/readiness/src/oracle-content-identity.ts` | Source/transformed canonical content digests |
| `packages/readiness/src/oracle-evaluation-collision.ts` | Bounded digest/preimage registry |
| `packages/readiness/src/oracle-mutation-model.ts` | Closed catalog and result contracts |
| `packages/readiness/src/oracle-conformance-v1.ts` | Operation-scoped production mutation seam |
| `packages/readiness/src/oracle-mutation-runner.ts` | Exhaustive catalog execution/report |
| `packages/readiness/src/oracle-mutation-worker.ts` | Bounded mutant/vector worker protocol |
| `readiness/oracles/oracle-mutations-v1.json` | Canonical required-mutant catalog |

## Evaluation Identity

```ts
interface OracleEvaluationIdentityInputV1 {
  readonly schemaVersion: 1;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  readonly sourceContentIdentity: Sha256Digest;
  readonly transformedContentIdentity?: Sha256Digest;
  readonly relationId?: SemanticRelationId;
  readonly entryFunction: string;
  readonly initialMemoryIdentity: Sha256Digest;
  readonly diagnosticManifestDigest: Sha256Digest;
  readonly bindingRejectionDigest: Sha256Digest;
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
Canonical source and transformed content identities use distinct
`blend65-oracle-source-content-v1` and `blend65-oracle-transformed-content-v1` domains so equal
content in different roles cannot alias.

Validation requires:

- complete replay provenance already regenerated against exact source case content;
- relation ID iff a transformed-content identity is present;
- exact entry function and a canonical `blend65-oracle-initial-memory-v1` digest covering every
  initialized address/value cell;
- exact source/transformed content, both authority, policy and projection identities;
- at least one and at most five lexical unique participants;
- the route-required oracle and, for metamorphic evaluation, transform handler;
- every participant contract and implementation revision from the same selected snapshot.

Every field mutation changes the digest. RD-02's campaign/configuration/case identities are
returned unchanged inside provenance and remain replayable. A bounded collision registry retains
canonical preimages and rejects equal digests for unequal bytes; no nearest/current revision
fallback exists.

Phase 4 implements only these pure provenance/content/evaluation identity primitives. It does not
bind final participant revisions into raw handlers because selection has not occurred. Phase 6's
resolver-owned evaluation API obtains participants from one accepted snapshot and returns the
closed evidence envelope.

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
  readonly pathId: string;
  readonly variantId: string;
}
```

Rows are lexical, unique and closed. Production modules expose closed stable operation and path
registries. Validation derives an exact required `(operationId, pathId)` pair set from every
evaluator dispatch/normalization branch, compiler-diagnostic and binding-rejection mapping,
relation precondition, closed rewrite variant and comparator branch. The catalog must equal this
set with at least one stable mutant per pair. Source checks reject missing, extra, duplicate,
unknown or unreachable paths; a broad operation row cannot cover an unnamed branch.

## Production-Path Mutation Seam

`oracle-conformance-v1.ts` is private to the package and uses Node `AsyncLocalStorage` to expose an
operation/path-scoped async context for tests. Production dispatch asks the seam for the selected
variant at the actual branch boundary. Mutants therefore alter real
evaluator/manifest/transform/comparator behavior rather than copying logic into tests.

The default context is immutable baseline behavior. Mutant contexts are isolated across concurrent
tests and awaited boundaries, reject nested incompatible activation and cannot leak into ordinary
calls. An immutable barrier-controlled specification interleaves one baseline and two different
mutants and requires all three results to retain their own context. The package-boundary test
prevents this policy seam from being imported by unrelated production modules.

Required mutant effects include:

- wrong arithmetic/bitwise/comparison/normalization result for every operation ID;
- operand or volatile-effect order reversal;
- one wrong exact diagnostic mapping for every manifest row;
- one false-positive precondition per relation;
- one non-preserving rewrite per closed rewrite variant;
- one required observable omitted or normalized incorrectly per comparator.

## Adequacy Result

```ts
type OracleMutationRunResultV1 =
  | {
      readonly ok: true;
      readonly catalogDigest: Sha256Digest;
      readonly required: bigint;
      readonly killed: bigint;
      readonly survivors: readonly string[];
    }
  | {
      readonly ok: false;
      readonly failure:
        | "worker-startup"
        | "worker-timeout"
        | "worker-crash"
        | "worker-protocol"
        | "worker-budget"
        | "harness-failure";
      readonly mutantId: string;
      readonly vectorId: string;
      readonly diagnostic: OracleDiagnostic;
    };
```

The mutation runner addresses each catalog row and immutable vector by stable IDs and executes the
pair in a dedicated `node:worker_threads` worker. The parent validates a closed versioned message
protocol and terminates the worker at the fixed deadline, so synchronous nontermination is
preemptible. A mutant is killed only when the expected specification assertion fails for the mutant
while the baseline passes. Completion requires `required === killed` and an empty survivor list.
Worker startup, timeout, crash, unknown message, budget or harness failures return the failure
branch, never consume kill credit and never appear as survivors. The diagnostic is bounded and
contains no worker stack or fixture content. Workers receive IDs and canonical fixture inputs,
never executable caller code or filesystem paths.

The catalog digest and conformance policy revision enter the relevant implementation revisions and
final semantic-review units. Adding a production operation without a catalog row fails source
checks before publication.
