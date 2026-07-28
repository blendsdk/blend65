# Component Specification: Evaluation Identity and Mutation Adequacy

> **Document**: 03-04-identity-mutation.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P14, AR-P17–AR-P18, AR-P20, AR-P26–AR-P30, AR-P36, AR-P38,
> AR-P59–AR-P60

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
| `packages/readiness/src/oracle-mutation-assertions.ts` | Immutable vector fixtures and independent assertion evaluation |
| `packages/readiness/src/oracle-conformance-v1.ts` | Operation-scoped production mutation seam |
| `packages/readiness/src/oracle-mutation-runner.ts` | Exhaustive catalog execution/report |
| `packages/readiness/src/oracle-mutation-worker.ts` | Bounded mutant/vector worker protocol |
| `readiness/oracles/oracle-mutations-v1.json` | Canonical required-mutant catalog |
| `phase4-canonical-vectors.json` | Independent identity vectors and exact mutation inventory |

## Callable Contract

AR-P59 freezes the Phase 4 callable organization below. All result unions are immutable and use
`ok` as their discriminator. `OracleIdentityResultV1` returns `identity`, an isolated canonical
`preimage` and an empty diagnostic tuple on success. `OracleValidationResultV1<T>` returns `value`
and an empty diagnostic tuple on success. Failures return a non-empty bounded
`OracleDiagnostic[]`.

```ts
interface OracleReplayValidationInputV1 {
  readonly envelopeBytes: Uint8Array;
  readonly registry: RevisionRegistry;
  readonly expectedProvenance: Rd02ReplayProvenanceV1;
  readonly expectedSourceContent: Uint8Array;
}

function validateOracleReplayProvenance(
  input: OracleReplayValidationInputV1,
): OracleValidationResultV1<Rd02ReplayProvenanceV1>;

function deriveOracleSourceContentIdentity(
  content: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1;

function deriveOracleTransformedContentIdentity(
  content: Uint8Array,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1;

function deriveOracleInitialMemoryIdentity(
  memory: MemoryFixtureV1,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1;

function deriveOracleEvaluationIdentity(
  input: OracleEvaluationIdentityInputV1,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1;

interface OracleEvaluationCollisionRegistry {
  readonly register: (
    digest: Sha256Digest,
    preimage: Uint8Array,
  ) => OracleValidationResultV1<true>;
  readonly dispose: () => void;
}

function createOracleEvaluationCollisionRegistry(
  digest?: (preimage: Uint8Array) => Uint8Array,
): OracleEvaluationCollisionRegistry;

function parseOracleMutationCatalog(
  input: unknown,
): OracleValidationResultV1<OracleMutationCatalogV1>;

function oracleMutationPathRegistry(): OracleMutationPathRegistryV1;

function validateOracleMutationCatalog(
  catalog: OracleMutationCatalogV1,
  registry: OracleMutationPathRegistryV1,
): OracleValidationResultV1<ValidatedOracleMutationCatalogV1>;

interface OracleMutationRunRequestV1 {
  readonly catalog: ValidatedOracleMutationCatalogV1;
  readonly vectorIds: readonly string[];
  readonly deadlineMilliseconds: number;
}

function runOracleMutationCatalog(
  request: OracleMutationRunRequestV1,
): Promise<OracleMutationRunResultV1>;
```

The conformance module exports `runWithOracleMutationVariant(selection, operation)` and
`selectedOracleMutationVariant(operationId, pathId)` only for package-internal production
dispatch and specification access; neither is re-exported from `index.ts`. Activation accepts one
closed `{ mutantId, operationId, pathId, variantId }` selection, rejects an incompatible nested
selection and awaits `operation` inside the isolated context. Branch lookup returns the selected
variant only for the exact operation/path pair.

The worker module exposes a package-internal
`runOracleMutationWorkerProbe(mode, deadlineMilliseconds)` for the five finite conformance modes
`"timeout"`, `"crash"`, `"budget"`, `"invalid-protocol"` and `"baseline-mismatch"`. It exercises the same worker
boundary and result mapping as the catalog runner. It does not accept callbacks, source text,
commands or filesystem paths.

Worker lifetime uses two explicit bounds (AR-P69): a fixed 1,000 ms process-startup/ready-handshake
cap followed by the caller's 1–60,000 ms execution deadline. Failure before ready is
`worker-startup`; after ready the selected execution outcome determines timeout/crash/budget/
protocol classification. The execution deadline still preempts synchronous nontermination, while
host startup latency cannot turn a 50 ms crash probe into a timeout.

AR-P62 adds a separate immutable data-only assertion packet,
`phase4-mutation-assertions.json`, with exactly one row for every canonical vector ID. Each row
contains its canonical fixture input, assertion kind and literal expected baseline observation.
Package-private `runOracleMutationVectorForConformance(vectorId, selection?)` resolves only these
closed stable IDs and executes the complete real evaluator, authority-mapping or semantic-relation
path. `evaluateOracleMutationAssertion(assertion, observation)` is pure and accepts only the
closed assertion shapes in that packet. Neither callable is re-exported from `index.ts`.

The worker first executes the baseline and applies the independent assertion. A baseline mismatch
returns `harness-failure` and no kill credit. It then executes the selected mutant against the
same isolated fixture and awards kill credit only when that same assertion rejects the mutant
observation. Comparing baseline and mutant for inequality is insufficient. Relation precondition
vectors execute a complete inapplicable transformation request: each real computed applicability
boolean passes through the mutation seam before the production branch, so `force-true-v1` cannot
be killed by a synthetic direct helper call.

AR-P63 freezes the additive packet and callable shapes:

```ts
type OracleMutationFixtureV1 =
  | {
      readonly kind: "program-evaluation";
      readonly input: OracleProgramInputV1;
    }
  | {
      readonly kind: "diagnostic-mapping";
      readonly ruleId: string;
      readonly neighborId: string;
      readonly diagnosticContext?: string;
    }
  | {
      readonly kind: "binding-rejection-mapping";
      readonly ruleId: string;
      readonly neighborId: string;
      readonly parameterPath: string;
    }
  | {
      readonly kind: "semantic-relation";
      readonly suite: OracleMutationSuiteDescriptorV1;
      readonly request: SemanticRelationRequestV1;
    };

interface OracleMutationSuiteDescriptorV1 {
  readonly schemaVersion: 1;
  readonly suiteId: "oracle-suite.phase4-mutation-v1";
  readonly inventoryDigest: Sha256Digest;
  readonly seedContractDigest: Sha256Digest;
  readonly ruleModelDigest: Sha256Digest;
  readonly ruleModelReviewDigest: Sha256Digest;
  readonly diagnosticManifestDigest: Sha256Digest;
  readonly bindingRejectionDigest: Sha256Digest;
  readonly replayRevisions: {
    readonly inventory: Sha256Digest;
    readonly ruleModel: Sha256Digest;
    readonly generator: Sha256Digest;
    readonly boundaryTransform: Sha256Digest;
    readonly renderer: Sha256Digest;
    readonly configuration: Sha256Digest;
  };
}

type OracleMutationObservationV1 =
  | OracleResultV1
  | { readonly kind: "diagnostic-mapping"; readonly diagnosticCode: string }
  | { readonly kind: "binding-rejection-mapping"; readonly rejectionCode: string }
  | {
      readonly kind: "semantic-relation-modeled";
      readonly relationId: SemanticRelationId;
      readonly sourceObservation: OracleObservationV1;
      readonly transformedObservation: OracleObservationV1;
    }
  | {
      readonly kind: "semantic-relation-inapplicable";
      readonly relationId: SemanticRelationId;
    }
  | {
      readonly kind: "semantic-relation-unmodeled";
      readonly reason: OracleUnmodeledReason;
    }
  | {
      readonly kind: "semantic-relation-failure";
      readonly diagnostics: readonly OracleDiagnostic[];
    };

interface OracleMutationAssertionV1 {
  readonly kind: "exact-observation";
  readonly expected: OracleMutationObservationV1;
}

interface OracleMutationAssertionRowV1 {
  readonly vectorId: string;
  readonly family: OracleMutantV1["family"];
  readonly fixture: OracleMutationFixtureV1;
  readonly assertion: OracleMutationAssertionV1;
}

type OracleMutationVectorResultV1 =
  | { readonly ok: true; readonly observation: OracleMutationObservationV1 }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };

type OracleMutationAssertionResultV1 =
  | { readonly ok: true; readonly passed: boolean }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };

function runOracleMutationVectorForConformance(
  vectorId: string,
  selection?: OracleMutationSelectionV1,
): Promise<OracleMutationVectorResultV1>;

function evaluateOracleMutationAssertion(
  assertion: OracleMutationAssertionV1,
  observation: OracleMutationObservationV1,
): OracleMutationAssertionResultV1;
```

JSON decimal strings in typed integer, memory, budget and replay positions are converted to
`bigint` by the packet parser; no arbitrary JSON value reaches a fixture. The finite worker probe
mode union is extended with `"baseline-mismatch"`. That mode resolves one real canonical vector
and substitutes a module-owned impossible expected observation only at the assertion boundary,
returning `harness-failure` without kill credit. It does not add a catalog/vector row and accepts
no caller assertion or observation.

The semantic-relation suite descriptor is data-only (AR-P64). Package-owned hydration reads only
the fixed checked-in inventory, seed contract, rule-model, review, diagnostic and binding files,
verifies every exact digest, constructs the modeled suite, and resolves all six exact replay
revisions through a factory-owned registry. The fixed suite ID selects the package's closed Phase
4 fixture generator; it is not a module name. Any unknown ID, stale/missing revision, changed
authority byte or digest mismatch fails the vector before evaluation. No registry, function,
callback, filesystem path or source text is serialized into the packet or worker message.

Semantic-relation results are projected before assertion (AR-P65). A modeled result retains only
the relation ID and exact source/transformed semantic observations. Inapplicable and unmodeled
results retain their closed relation/reason discriminator; failures retain the exact bounded
diagnostics. Source/transformed cases, syntax and generated fresh names are excluded. This keeps
the assertion implementation-blind while the vector still executes the complete real relation
path and observes non-preserving rewrite or comparator faults.

All evaluator rows use complete `program-evaluation` fixtures and assert `OracleResultV1`
(AR-P66). No scalar helper result enters the assertion packet. Unary, binary, normalization,
memory and evaluation-order mutants are therefore exercised through the ordinary bounded program
evaluator rather than a helper-level surrogate.

Diagnostic fixture context is absent exactly when the canonical authority row omits it (AR-P67).
Only the two contextual rows carry their literal context strings; empty strings and invented
sentinels are rejected.

## AR-P60: Independent Canonical Authority

AR-P60 freezes `phase4-canonical-vectors.json` as the specification-author authority for identity
bytes and mutation inventory. The packet is not generated from production and specification tests
must not derive expected fields, IDs, catalog rows or digests from implementation registries. The
production identities, registries, catalog and private vector registry must instead join exactly
to the packet.

Every version-one identity preimage has this byte form:

```text
u32be(domain.byteLength)
|| utf8(domain)
|| u32be(fieldCount)
|| for each field in the frozen order:
     u32be(utf8(fieldName).byteLength)
     || utf8(fieldName)
     || u32be(fieldValue.byteLength)
     || fieldValue
```

`u32be` is an unsigned 32-bit big-endian integer. Text is strict UTF-8 without normalization,
terminators or BOM. Unsigned integers and non-negative `bigint` values are base-ten ASCII with no
leading zero except `0`. Digests are the 71 ASCII bytes of `sha256:` plus 64 lowercase hexadecimal
digits. Raw content fields are the exact supplied bytes. An optional field is always present in the
field table: its value is exactly byte `00` when absent or byte `01` followed immediately by the
ordinary field representation when present. The outer field-value length includes this presence
byte.

The source and transformed domains each contain exactly one raw `content` field. Initial memory
uses `schemaVersion`, `cellCount`, then `cells.<i>.address` and `cells.<i>.value` for every
ascending-address cell. Evaluation uses the exact `fieldNames` order published with its vector.
For variable-length values the order is count first, then ascending zero-based members:

- `sourceProvenance.caseIdentity.generationPath.count`, then
  `sourceProvenance.caseIdentity.generationPath.<i>`;
- `sourceProvenance.configuration.enabledRuleIds.count`, then
  `sourceProvenance.configuration.enabledRuleIds.<i>`;
- `sourceProvenance.configuration.spellings.count`, then
  `sourceProvenance.configuration.spellings.<i>`;
- `participantCount`, then the three
  `participants.<i>.handlerId`, `participants.<i>.contractVersion` and
  `participants.<i>.implementationRevision` fields.

All other provenance, generation-budget, oracle-budget and identity members appear literally under
their dot-qualified names shown in the published evaluation vector. Participants are sorted by
`handlerId`; generation paths retain source order; enabled rule IDs and spellings are already
lexical unique inputs. `transformedContentIdentity` and `relationId` use the optional representation
above and are either both present or both absent. SHA-256 is computed over the complete preimage and
rendered in canonical digest spelling.

The packet publishes four literal input → preimage hex → SHA-256 vectors:
`identity.source-content.v1`, `identity.transformed-content.v1`,
`identity.initial-memory.v1` and `identity.evaluation.v1`. JSON decimal strings in memory, oracle
budget and `maxLoopWork` positions are converted to `bigint`; other JSON numbers remain numbers.
The carried campaign, configuration and case digests are independently valid under the already
frozen RD-02 canonical identity format. The exact diagnostic and binding digests name the authority
bytes against which the Phase 4 packet was authored.

### Exact mutation inventory

The same packet freezes 84 lexical rows with columns
`mutantId`, `family`, `operationId`, `pathId`, `variantId`, `vectorId`. Rows are strictly increasing
by `mutantId`; vector IDs are unique and their lexical set is the complete required runner input.
The family totals are 32 evaluator operations, 29 diagnostic mappings, five transform
preconditions, thirteen transform rewrites and five relation comparators.
The specification author constructs `OracleMutationCatalogV1.mutants` by projecting the first five
columns of every row without reordering and obtains the runner's `vectorIds` by projecting the
sixth column.

The evaluator paths name all reachable closed dispatches: two boolean equality branches, fourteen
integer arithmetic/bitwise/comparison branches, both shifts, three unary branches, four scalar
normalizations, four width-specific memory branches and three observable evaluation-order branches.
Diagnostic paths exact-join all twenty compiler-manifest records and all nine
binding-rejection records; the two contextual boolean records remain distinct. Relation
operation IDs are the five relation IDs, path IDs are the fifteen stable Phase 3 conformance paths,
and rewrite mutation variants name all thirteen closed rewrite variants.

Catalog validation compares the exact required
`(operationId, pathId, variantId)` triple set, not merely a broad operation/path pair. Missing,
extra, duplicate or unreachable triples fail. Each triple names exactly one packet vector. The
runner requires the caller's `vectorIds` to equal the packet's complete lexical vector set. It
resolves each ID through a private immutable, data-only fixture registry before starting a worker;
callers and worker messages never supply executable code, callbacks, module names, commands or
filesystem paths.

Executable coverage uses those marker objects as dispatch data, not as a parallel declaration
(AR-P72). Closed operator and branch maps return the exact marker consumed at the mutation lookup;
dynamic authority and relation paths exact-resolve a marker and fail if none exists. The runtime
registry is projected from the same marker values. Source validation rejects any production lookup
that falls back to the observation-only string form, so adding a reachable route without metadata
cannot silently preserve a mutually consistent but incomplete registry and catalog.

## Evaluation Identity

```ts
type OraclePolicyRevision = `oracle-policy-v${number}`;

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
  readonly policyRevision: OraclePolicyRevision;
  readonly observableProjectionId: string;
  readonly participants: readonly {
    readonly handlerId: HandlerId;
    readonly contractVersion: string;
    readonly implementationRevision: Sha256Digest;
  }[];
}
```

Identity input validation accepts only ASCII policy revisions matching
`^oracle-policy-v[1-9][0-9]{0,8}$`. Identity derivation commits that exact revision so a future
canonical policy revision changes the digest as required by ST-32/ST-33. This is content
addressing, not compatibility acceptance: Phase 4 evaluation/publication paths still accept only
`oracle-policy-v1`, and deriving an identity for another canonical revision does not authorize
executing or publishing it (AR-P61).

Canonical encoding is the complete byte contract and frozen field order in the independent packet,
with domain `blend65-oracle-evaluation-v1`. Canonical source and transformed content identities use
distinct `blend65-oracle-source-content-v1` and
`blend65-oracle-transformed-content-v1` domains so equal content in different roles cannot alias.

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

Rows are lexical, unique and closed. Production modules expose closed stable operation, path and
mutation-variant registries. Validation derives the exact required triple set from every
evaluator dispatch/normalization branch, compiler-diagnostic and binding-rejection mapping,
relation precondition, closed rewrite variant and comparator branch. The catalog must equal this
set and exact packet row population. Source checks reject missing, extra, duplicate, unknown or
unreachable paths; a broad operation row cannot cover an unnamed branch or rewrite variant.

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

The mutation runner addresses each catalog row and its packet-owned immutable vector by stable IDs
and executes the pair in a dedicated `node:worker_threads` worker. The parent resolves the
data-only canonical fixture before dispatch and validates a closed versioned message
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
