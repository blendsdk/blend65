# Component Specification: Atomic Publication

> **Document**: 03-05-atomic-publication.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P15–AR-P16, AR-P21–AR-P25, AR-P28, AR-P33–AR-P35, AR-P37, AR-P39

## Responsibility

Promote four oracle façades and `transform.semantic-relations` as one reviewed authority while
preserving the exact publication-v1 wire format, historical four-binding releases and the selected
RD-02 authority until the final pointer commit.

## Compatibility Rule

`PUBLICATION_MEMBER_PATHS`, `PublicationManifestV1`, its digest domain and all seven ordered
members remain unchanged. RD-03 does not:

- add a diagnostic-manifest member;
- change `schemaVersion`;
- reinterpret an existing member;
- activate `evolutionGate`;
- make historical releases depend on the newest fixed candidate profile.

The diagnostic manifest is committed indirectly and exactly by:

1. including its canonical bytes, generated projection and parser in every relevant RD-03
   implementation dependency closure;
2. recording its digest in the dedicated diagnostic semantic-review unit;
3. recording the resulting five implementation revisions in `bindings-v1.json`;
4. committing bindings and accepted review evidence through the existing release digest.

Accepted review bytes are not implementation dependencies.

## Files

| File | Change |
|---|---|
| `packages/readiness/src/oracle-candidate-bindings.ts` | Fresh registration for five typed handlers |
| `packages/readiness/src/oracle-candidate-revisions.generated.ts` | Generated exact dependency closures |
| `packages/readiness/src/publication-candidates.ts` | Load candidates by requested serialized handler IDs |
| `packages/readiness/src/binding-publication.ts` | Preserve legacy wrapper; add explicit incremental preparation |
| `packages/readiness/src/publication-resolver.ts` | Reconstruct candidates/review and create bound evaluation context |
| `packages/readiness/src/published-oracle-context.ts` | Snapshot-bound authoritative evidence API |
| `packages/readiness/src/published-replay-authority.generated.ts` | Generated renderer and complete replay dependency closure |
| `packages/readiness/src/published-oracle.ts` | Public subpath entry for context/request/evaluation only |
| `packages/readiness/package.json` | Export `@blend65/readiness/published-oracle` without widening package root |
| `packages/readiness/src/publication-conformance-v1.ts` | Extend owner/boundary checks only |
| `readiness/reviews/semantic-review-v1.json` | Accepted review for exact staged nine-row release |
| `readiness/publications/` | Immutable compatible release and selected pointer |

## Candidate Registration

Five handler registrations are derived from checked-in complete dependency bytes:

| Handler | Kind | Contract | Route |
|---|---|---|---|
| `oracle.frontend-result` | oracle | `1.0.0` | scalar diagnostic/value contracts |
| `oracle.compiler-result` | oracle | `1.0.0` | implemented façade; initial routes unmodeled |
| `oracle.emitted-program` | oracle | `1.0.0` | implemented façade; initial routes unmodeled |
| `oracle.runtime-state` | oracle | `1.0.0` | memory diagnostic/state contracts |
| `transform.semantic-relations` | transform | `1.0.0` | five closed relation IDs |

The four oracle registrations use new handler-specific adapters
`evaluateFrontendResultCandidate`, `evaluateCompilerResultCandidate`,
`evaluateEmittedProgramCandidate` and `evaluateRuntimeStateCandidate`. Each validates its exact
serialized handler ID and delegates to `evaluateSourceOracleCase`; none contains semantic
evaluation logic. The immutable Phase 1 bootstrap façade functions are compatibility APIs only and
must never be registered as these candidates.

The loader accepts a lexical set of handler IDs from the release being prepared/resolved. It
returns exactly one fresh compatible registration per requested ID and rejects unknown, duplicate
or unavailable historical IDs.

The complete dependency closure for every RD-03 handler also includes
`published-oracle-context.ts`, its resolver context-factory/review-validation dependencies,
content/evaluation identity primitives and their policy bytes. This binds selected
invocation/evidence construction into the five implementation revisions; changing the wrapper or
authority factory cannot silently change behavior under an old release digest. The wrapper and
factory are specification-authored and implemented before those revisions are generated.

The existing no-pointer four-handler preparation wrapper and its immutable behavior remain
unchanged. RD-03 adds a separate incremental entry whose inputs explicitly include the selected
base snapshot and exact target handler-ID set. Only that entry may stage the
four-carried-plus-five-promoted transaction.

## Phase 5 Callable Contract

AR-P73 freezes the implementation-blind callable surface below. Additive focused functions match
the package's existing functional API. A stateful publication service would combine unrelated
authority and introduce call-order state; overloading the legacy functions would admit ambiguous
partial incremental inputs. The existing signatures remain exactly:

```ts
function prepareBindingPublicationReview(
  input: { readonly repositoryRoot: string },
): Promise<PublicationResult<PreparedBindingPublicationReview>>;

function publishBindingTransaction(input: {
  readonly repositoryRoot: string;
  readonly semanticReviewBytes: Uint8Array;
}): Promise<PublicationResult<PublishedBindingTransaction>>;

function resolvePublishedSnapshot(input: {
  readonly repositoryRoot: string;
}): Promise<PublicationResult<PublishedSnapshot>>;
```

Candidate registration lives in `oracle-candidate-bindings.ts`:

```ts
interface OracleCandidateDependencyInput {
  readonly frontendResult: ImplementationRevisionInput;
  readonly compilerResult: ImplementationRevisionInput;
  readonly emittedProgram: ImplementationRevisionInput;
  readonly runtimeState: ImplementationRevisionInput;
  readonly semanticRelations: ImplementationRevisionInput;
}

type OracleCandidateDiagnostic =
  | ImplementationRevisionDiagnostic
  | ModelBindingDiagnostic;

type OracleCandidateRegistrationResult =
  | {
      readonly ok: true;
      readonly registrations: readonly FreshCandidateRegistration[];
      readonly bindings: ValidatedBindingRegistry;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleCandidateDiagnostic[] };

function registerOracleCandidateBindings(input: unknown): OracleCandidateRegistrationResult;
```

The generated `oracle-candidate-revisions.generated.ts` exports one
`GeneratedCandidateRevision` for each of the five handler IDs. Their dependency paths are lexical,
complete and content-derived. `publication-candidates.ts` retains the no-argument legacy loader
behavior and adds release-directed loading:

```ts
const RD03_PUBLICATION_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;

interface LoadPublicationCandidatesInput {
  readonly repositoryRoot: string;
  readonly handlerIds: readonly string[];
}

function loadPublicationCandidatesForHandlerIds(
  input: LoadPublicationCandidatesInput,
): Promise<PublicationCandidateCatalogResult>;
```

`handlerIds` must be lexical, unique and a subset of the closed compatible nine-handler map.
Unknown, duplicate, non-lexical or unavailable IDs return
`implementation.dependency.invalid` at `/handlerIds`; no candidate is returned. The existing
`loadPublicationCandidateCatalog(repositoryRoot)` continues to load exactly the four RD-02 IDs.

Named resolution in `publication-resolver.ts` never accepts caller candidates:

```ts
interface ResolvePublishedSnapshotByDigestInput {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
}

function resolvePublishedSnapshotByDigest(
  input: ResolvePublishedSnapshotByDigestInput,
): Promise<CompatiblePublicationResult<PublishedSnapshot>>;

function getPublishedBindingRows(
  snapshot: PublishedSnapshot,
): readonly PublicationBindingRow[] | undefined;
```

It reads and verifies the named release first, obtains the exact serialized handler IDs, loads only
those package-owned candidates, exact-joins ID/kind/contract/revision, reconstructs review units,
calls `validateReviewEvidence`, and only then creates the snapshot. A missing named release returns
`publication.release.not-found` at `/publicationDigest`. Missing/extra malformed evidence returns
`publication.review.invalid`; a digest or dependency mismatch returns
`publication.review.stale`; a blocked record returns `publication.review.not-accepted`, all at
`semantic-review-v1.json`. `getPublishedBindingRows` returns an immutable lexical metadata snapshot
for a genuine resolver-created snapshot and `undefined` for a forgery; it never exposes or accepts
candidate callables.

Incremental capability types live in `publication-model.ts`; operations live in
`binding-publication.ts`:

```ts
declare const preparedIncrementalPublicationBrand: unique symbol;

interface PreparedIncrementalBindingPublication {
  readonly [preparedIncrementalPublicationBrand]: true;
}

interface PrepareIncrementalBindingPublicationReviewInput {
  readonly repositoryRoot: string;
  readonly baseSnapshot: PublishedSnapshot;
  readonly targetHandlerIds: readonly string[];
}

interface PreparedIncrementalBindingPublicationReview {
  readonly request: PublicationReviewRequestV1;
  readonly requestBytes: Uint8Array;
}

function prepareIncrementalBindingPublicationReview(
  input: PrepareIncrementalBindingPublicationReviewInput,
): Promise<CompatiblePublicationResult<PreparedIncrementalBindingPublicationReview>>;

interface PrepareIncrementalBindingPublicationInput {
  readonly repositoryRoot: string;
  readonly baseSnapshot: PublishedSnapshot;
  readonly targetHandlerIds: readonly string[];
  readonly semanticReviewBytes: Uint8Array;
}

interface PreparedIncrementalBindingPublicationPreview {
  readonly prepared: PreparedIncrementalBindingPublication;
  readonly basePublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly promotedHandlerIds: readonly string[];
  readonly stagedSnapshot: PublishedSnapshot;
}

function prepareIncrementalBindingPublication(
  input: PrepareIncrementalBindingPublicationInput,
): Promise<CompatiblePublicationResult<PreparedIncrementalBindingPublicationPreview>>;

function publishIncrementalBindingPublication(
  prepared: PreparedIncrementalBindingPublication,
): Promise<CompatiblePublicationResult<PublishedBindingTransaction>>;
```

Review preparation is a read-only production workflow boundary, not a test seam. It returns the
exact canonical review request needed by an independent reviewer but no accepted status,
publication capability, staged snapshot or commit authority. Its request is deeply immutable and
its bytes are defensively copied. Review preparation and capability preparation call one private
canonical assembler. Capability preparation never accepts or trusts a prior preview: it rebuilds
the request from the current root, base and target set, then validates the supplied review bytes.
Candidate changes between calls therefore produce stale-review failure instead of validating an
obsolete preview.

The readable preview is immutable evidence, not commit authority. The `prepared` token is frozen
and authenticated by an unexported `WeakMap` whose record owns defensive copies of the canonical
root, base digest, exact targets, staged release digest, accepted-review digest and review bytes.
Publishing accepts only that token, re-resolves the selected base, reconstructs and revalidates
review evidence, and then uses the existing fsync/rename protocol. It accepts no root, bytes,
candidate, callback or path from the caller. An invalid base is
`publication.base.invalid` at `/baseSnapshot`; a selected-base change is
`publication.base.stale` at `/baseSnapshot/publicationDigest`; a target set other than the exact
five IDs is `publication.targets.invalid` at `/targetHandlerIds`; and a non-issued token is
`publication.capability.invalid` at `/prepared`.

The operation-specific result preserves the existing envelope without widening legacy exhaustive
switches:

```ts
type CompatiblePublicationDiagnosticCode =
  | PublicationDiagnostic["code"]
  | "publication.release.not-found"
  | "publication.base.invalid"
  | "publication.base.stale"
  | "publication.targets.invalid"
  | "publication.capability.invalid"
  | "publication.snapshot.invalid";

interface CompatiblePublicationDiagnostic {
  readonly code: CompatiblePublicationDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

type CompatiblePublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind:
        | "invalid"
        | "not-found"
        | "stale"
        | "collision"
        | "contended"
        | "durability-unsupported"
        | "acceptance-failed"
        | "io";
      readonly diagnostics: readonly CompatiblePublicationDiagnostic[];
    };
```

Selected evaluation lives in `published-oracle-context.ts`:

```ts
type PublishedOracleContextResult =
  | {
      readonly ok: true;
      readonly value: PublishedOracleContext;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };

function createPublishedOracleContext(
  snapshot: PublishedSnapshot,
): PublishedOracleContextResult;

function evaluatePublishedOracle(
  context: PublishedOracleContext,
  request: unknown,
): PublishedOracleEvaluationResultV1;
```

Published request construction is the context-bound public path:

```ts
interface PublishedOracleRequestIntentV1 {
  readonly schemaVersion: 1;
  readonly handlerId: OracleHandlerIdV1;
  readonly ruleId: RuleId;
  readonly seed: Sha256Digest;
  readonly configuration: GenerationConfiguration;
  readonly ordinal: number;
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
  readonly observable: OracleObservableV1;
}

function createPublishedOracleRequest(
  context: PublishedOracleContext,
  intent: unknown,
): OracleResult<OracleRequestV1>;
```

The closed intent contains semantic generation/evaluation choices only. Context-owned inventory,
rule-model suite, selected generator/boundary candidates and package renderer construct the exact
campaign, case and replay provenance. No participant revision, registry, resolver, callable,
registration, capability, source case or provenance override is accepted. Evaluation independently
revalidates the returned serializable request; it never assumes factory output is trusted.

`published-replay-authority.generated.ts` carries content-derived renderer metadata and its complete
package dependency closure. Context creation authenticates the snapshot's generator and boundary
rows, freshness-checks that generated renderer authority and builds the complete replay registry
behind the opaque context.

These APIs are public through the dedicated `@blend65/readiness/published-oracle` package subpath.
The package root remains unchanged because its frozen compatibility contract explicitly excludes a
published evaluator and context factory.

Context creation accepts the snapshot alone because it already binds root, release, accepted review
and participants; duplicate repository or digest inputs would grant substitution authority. A
forged snapshot returns `oracle.authority.missing` at `/snapshot`. The context is a second
runtime-authenticated opaque token. Evaluation accepts exactly `(context, request)`, selects the
required raw handler internally and uses the existing `PublishedOracleEvaluationResultV1`; a
forged context returns `oracle.authority.missing` at `/context`. Manifest, revision, review,
content or replay-provenance mismatches fail with the existing closed oracle diagnostics and never
emit a success evidence envelope.

Review-unit reconstruction remains package-private. ST-45 proves it through
`resolvePublishedSnapshotByDigest`; there is no caller-supplied review context. Phase 5
specification fixtures use temporary copies of the fixed publication-v1 artifacts and mutate their
own bytes. They may share a new test-fixture module, but no production fixture/probe API is added.

## Historical Resolution

Resolver behavior is release-directed:

```text
read and verify bindings-v1.json
  → collect exact serialized handler IDs
  → load fresh candidates for those IDs
  → require exact ID/kind/contract/revision equality
  → validate published declarations
  → reconstruct release-derived semantic review units and dependencies
  → validateReviewEvidence against exact accepted bytes
  → create opaque snapshot
```

The existing four-row RD-02 release therefore asks for and resolves four candidates even after
RD-03 code ships. The new release asks for nine. No global “latest profile” cardinality is used.
Review validation is factored so preparation and resolution share the same
`validateReviewEvidence` semantics. Missing, extra, rejected or stale evidence fails before a
snapshot or invocation context exists.

## Incremental Promotion Transaction

RD-03 requires the currently selected RD-02 publication as its base.
`prepareIncrementalBindingPublication({ baseSnapshot, targetHandlerIds, ... })`:

1. resolves the selected snapshot and exact four serialized RD-02 rows;
2. reconstructs their fresh callables and proves ID/kind/contract/revision equality;
3. validates exactly five new candidates against the five unbound RD-03 declarations;
4. stages the new transform declaration and marks only the five RD-03 declarations bound;
5. combines four carried rows and five promoted rows into one lexical nine-row binding file;
6. regenerates projections and all semantic review units through the same reconstruction function
   used during resolution;
7. reports `promotedHandlerIds` as exactly the five RD-03 IDs;
8. builds and resolves the complete staged release in isolation.

Any changed/missing carried row, extra promotion, incomplete review, stale manifest digest,
candidate mismatch or failed acceptance rejects before the pointer commit.

Successful preparation returns an opaque `PreparedIncrementalPublication` capability binding the
canonical repository root, selected base digest, exact target IDs, staged release digest and
accepted-review digest. Its companion
`publishIncrementalBindingPublication(prepared: PreparedIncrementalPublication)` is the only RD-03
commit entry. It re-resolves the base immediately before staging/commit, rejects a changed selected
base or forged/stale capability, then executes the existing fsync/rename protocol over the exact
prepared bytes. The legacy prepare/publish wrapper remains unchanged and cannot consume this
capability.

## Independent Review

The prepared request includes exact units for:

- diagnostic manifest/nineteen-record join and separate binding-rejection authority/join;
- complete freshness-verified RD-02 replay registry, including renderer authority;
- evaluator operations, widths, order, budget and memory policy;
- five relation contracts and comparators;
- content/evaluation-identity field coverage, including entry and initial-memory identity;
- mutation-catalog completeness;
- snapshot wrapper/context factory and five complete handler dependency closures;
- inventory/declaration/binding/projection changes;
- carried-binding preservation, incremental capability integrity, resolver retry/reconciliation and
  historical-resolution compatibility.

A semantics reviewer records accepted evidence for the exact semantic digest. Any implementation,
authority, catalog, projection or binding change after review makes the evidence stale.

After accepted selection, the resolver creates `PublishedOracleContext` from the exact snapshot,
reviewed suite dependencies and selected participant metadata. `evaluatePublishedOracle` invokes
the required raw handler internally and returns
`{ result, evaluationIdentity, sourceProvenance, contentIdentities }`. It rejects any attempt to
provide caller-selected authority or participant revisions.

The published-evidence specification supplies one fixed semantic intent to
`createPublishedOracleRequest` and asserts the exact selected generator, boundary and generated
renderer identities in its returned raw request. The fixture exposes no replay registry, callable,
capability or revision override. It mutates each returned participant identity to prove evaluation
does not blindly trust factory output.

The selected RD-02 generator revision remains executable authority. Phase 4 added only separable
oracle identity/hardening and mutation-limit concerns to two files inside that released closure.
Those concerns live in oracle-specific modules; all 21 released generator closure files remain
byte-identical and regenerate exact revision `b715303…`. SharedArrayBuffer rejection and every
Phase 4 identity, assertion, mutation and replay regression remain mandatory. If exact bytes or
hardening coverage cannot both be proved, an authentic versioned historical closure is required.

## Commit Point and Crash Safety

Publication retains the RD-02 protocol:

1. stage immutable release files;
2. fsync files and release directory;
3. resolve and run acceptance through the isolated release digest;
4. recompute exact staged semantic/release digests;
5. atomically replace the regular-file pointer;
6. fsync pointer and publication root;
7. resolve the newly selected snapshot and all nine bindings.

Every injected failure before pointer replacement leaves the four-binding RD-02 release selected.
After any fault at or after replacement, publication reconciles by re-reading the pointer and fully
resolving:

- exact new release selected → return committed success and its digest;
- exact old release selected → return the ordinary pre-commit failure;
- neither result can be established → return closed `commit-indeterminate` with expected old/new
  digests and a bounded recovery diagnostic.

Deterministic barrier-controlled worker-thread readers include one resolution forced across pointer
replacement plus controls on both sides. Every completed reader must return exactly the old
four-row or new nine-row snapshot; mixed cardinality, revisions, authority or transform state is
forbidden.

Because the existing hardened pointer reader intentionally rejects an inode/path change during
atomic rename, selected resolution adds one bounded retry from the beginning only for that verified
pointer-replacement race. The retry reopens and revalidates the canonical regular pointer, release
path, digests, review and candidates; it never reuses partially read state. A second path change or
any other filesystem diagnostic fails closed. Worker barriers force at least one reader into this
window and prove the retry returns an exact old/new snapshot rather than avoiding the race.

`oracle-publication.spec.test.ts` owns staging behavior and is immutable after Phase 5 authoring.
Before Phase 6 integration, a separate `oracle-final-publication.spec.test.ts` owns reconciliation,
concurrent-reader and final snapshot/evidence behavior; Phase 6 never edits the Phase 5 file.

## Closeout

After selected resolution and the full gate:

- verify all nine bindings exactly once and five RD-03 rows newly bound;
- verify the old four-row digest still resolves in a fixture/release-directed compatibility test;
- run source-authoring and selected-publication checks;
- run CodeOps traceability validation/readiness;
- run the repository's frozen-`spec/` cleanliness check;
- answer the mandatory deferral-expiry question and preserve RD-08 ownership;
- update feature roadmap; update portfolio only under integration-branch policy;
- commit the green checkpoint and never push.
