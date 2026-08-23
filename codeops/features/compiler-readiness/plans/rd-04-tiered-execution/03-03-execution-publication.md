# Component Design: Execution Publication and Composite Authority

> **Document**: 03-03-execution-publication.md
> **Parent**: [Index](00-index.md)
> **Decision**: AR-P5

## Responsibility

Publish the six route implementations as one independently reviewed child release bound to the
exact selected fresh parent digest
`sha256:8f27564485518a6addbab549ab75c85bbf19a3cc976ec9de61ea4d04a55bf597`.
Historical compiler-readiness publications remain byte-identical.

## Artifact layout

```text
readiness/execution-publications/
├── current-execution-publication.json
└── releases/<sha256-digest>/
    ├── execution-manifest-v1.json
    ├── execution-parent-v1.json
    ├── execution-bindings-v1.json
    └── execution-semantic-review-v1.json
```

The binding member has exactly one content-derived implementation for each declared route:
`frontend`, `compiler-api`, `cli`, `emit`, `acme` and `vice`. The manifest commits member digests,
schema and contract revisions. Parent reference, candidate preparation, semantic review and
selection are separate operations.

## Resolver model

`resolvePublishedExecutionRelease` pins and revalidates the child directory, reconstructs accepted
review evidence, verifies content-derived revision metadata and resolves the named parent by digest
rather than its mutable pointer. It returns opaque passive `PublishedExecutionRelease`; callers
cannot manufacture one structurally.
Resolution pins and repeatedly verifies the complete canonical
repository→readiness→execution-publications→releases→release ancestor chain around member reads,
parent-authority awaits and authority minting. Selected-pointer resolution may restart exactly once
only after a private verified-replacement marker proves that the selected pointer changed during the
attempt; named digest resolution never falls back or retries a different digest.

`resolveCompositeReadinessSnapshot` combines that release with the immutable parent. It projects an
`unbound` declaration as bound only for an exact accepted child row. Parent-only, missing, stale,
duplicate, undeclared or rejected rows retain the corresponding
`unbound-evidence-capability` blocker. A child never changes inventory/model/generator/oracle
authority and clears no blocker outside its six rows.
The composite is itself an opaque module-private-brand capability backed by resolver-owned
`WeakMap` state. A guarded accessor returns only its immutable capability projection; plain,
copied, proxied or structurally forged composites are rejected before route planning. The pure
planner consumes only that passive projection and produces no execution authority, so Phase 1 can
specify deterministic selection without manufacturing a future child release. The Phase 7
orchestrator alone performs the guarded composite-to-projection handoff before it invokes the
planner with the genuine campaign and oracle contexts.

The composite rule projection is the exact nine-rule modeled seed from the readiness-owned modeled
fact catalog, not the parent's complete 2,112-row inventory schema. For each exact modeled rule it
joins the parent's reviewed `applicability` and `evidenceObligations`, retains the closed four-field
`ExecutionRuleProjectionV1`, and derives the one modeled boundary ID exactly as campaign projection
does: `boundary.scalar.<scalarType>` or `boundary.memory.<intrinsic>`. Rows, obligations and boundary
IDs are lexical unique arrays. Missing, duplicate or incompatible modeled declarations fail closed;
unmodeled inventory rows remain parent authority and RD-08 scope rather than entering this planner.

`@blend65/readiness` owns passive child bytes, schema, path and digest validation only.
`@blend65/readiness-execution` owns the fixed six-handler live catalog and generated
cross-workspace dependency closures. It creates the separately branded `LiveExecutionContextV1`
only after the
passive resolver proves exact row order, implementation revision and generated-closure freshness.
Callers cannot register arbitrary handlers, substitute a current implementation for a historical
revision or fall back after a stale-closure failure. The exact commands are
`yarn workspace @blend65/readiness-execution generate:execution-bindings` for atomic regeneration
and `yarn workspace @blend65/readiness-execution check:execution-bindings` for non-mutating
freshness verification. The check must be green before candidate preparation and must fail on a
one-byte dependency mutation.
The generated closure is parsed from real JavaScript/TypeScript module syntax, includes literal
dynamic imports and `new URL(..., import.meta.url)` runtime assets, and has explicit live-handler,
worker, process-anchor and VICE-launcher roots. It binds the exact emitted distribution JavaScript
and assets executed by Node after a deterministic build→generate→build→check cycle. Live modules
obtain runtime readiness values only through the minimal `@blend65/readiness/execution-runtime`
leaf subpath; the closure rejects the broad readiness index and TypeScript boundary tooling. Every
reached third-party executable and its package manifest/export map are also bound, while unresolved
runtime edges fail generation. Runtime
freshness reads that closure with descriptor-backed no-follow/nonblocking opens, canonical
containment, single-link regular-file and inode-reverification checks plus fixed count, per-file and
aggregate bounds. One scan and hash per unique dependency is shared by all six rows and the final
commit guard.

## Atomic publication

The existing pinned-directory, bounded-read, staging and atomic-pointer primitives are generalized
without weakening their checks. Candidate files are written to a sibling staging directory,
validated and reviewed from their final bytes, renamed to the digest directory, re-resolved, then
the pointer is atomically replaced and directory-synced. Failure at any step preserves the prior
selection. Reconciliation distinguishes complete release, recoverable staging residue and
ambiguous state; ambiguous state fails closed.
Passive preparation remains valid for any exact fresh named parent and grants no execution
authority. All asynchronous fault hooks, ancestor checks and catalog reads complete before the
final commit section. That synchronous section rechecks the pinned catalog snapshot and currently
selected exact-parent pointer, exact child release identities and bytes, and the retained temporary
pointer inode and bytes, then invokes the rename syscall without an intervening yield. The renamed
pointer must preserve that inode and bytes. A bounded post-rename directory-sync retry must prove
durability; pointer visibility alone never turns a failed sync into success. Unprovable durability
returns reconciliation-indeterminate, while proven success re-resolves and returns the now-selected
child rather than the precommit passive object.

The historical source-boundary gate remains exact. A separate path-family owner allowlist permits
execution-publication root and pointer literals only in the named execution-publication modules in
`@blend65/readiness`, and live-catalog literals only in the named binding-catalog modules in
`@blend65/readiness-execution`. Complete-source tests scan both packages. The publication-v1 owner
set and existing immutable specification tests remain unchanged; ordinary modules may access
neither authority family.
Every gate compares an exact normalized package-relative path and rejects absolute paths,
traversal, separator aliases and duplicate records; basename equality never grants ownership.

The child wire family uses canonical UTF-8 JSON with exact closed keys and one trailing LF. Its
pointer is `{schemaVersion:1,kind:"execution-publication-pointer-v1",publicationDigest}`; its parent
member is `{schemaVersion:1,kind:"execution-parent-publication-v1",parentDigest}`; and its binding
member is `{schemaVersion:1,kind:"execution-bindings-v1",bindings}`. `bindings` contains exactly six
unique `{capabilityId,contractVersion,implementationRevision}` rows, sorted lexically by the full
tuple. The review member is
`{schemaVersion:1,kind:"execution-semantic-review-v1",specRevision,parentDigest,bindingDigest,ciSafe,coverage,localAcmeVice,unresolvedCritical,unresolvedMajor,reviewer,outcome}`;
each of `ciSafe`, `coverage` and `localAcmeVice` is exactly `{digest,outcome}`, every digest is
SHA-256, every outcome must be `accepted`, both unresolved counts must be zero and the parent and
binding digests must reconstruct exactly, and `specRevision` must equal the resolved parent
inventory revision. The manifest is
`{schemaVersion:1,kind:"execution-publication-v1",parentDigest,members}` with the three non-manifest
members in lexical order and exact `{path,byteLength,digest}` entries.

Member digests use `sha256(bytes)`. The binding revision uses
`sha256("blend65-execution-binding-v1\0" || canonical participant-and-closure bytes)`; the child
release uses `sha256("blend65-execution-publication-v1\0" || canonical manifest bytes)`. The
generated catalog is TypeScript, not runtime JSON, so `tsc` validates the fixed metadata and the
published package contains the same closure authority used by the freshness check.

Implementation-blind specifications may use package-private conformance modules only. Readiness
owns a scoped fault/observation seam spanning member sync, staging sync, review validation, release
rename, releases-directory sync, pointer file sync/rename/directory sync and reconciliation.
Readiness-execution owns a defensive passive catalog descriptor plus one scoped one-byte dependency
mutation. Neither seam is exported from the package root, returns handlers, registers handlers or
mints authority. Independent test-fixture modules encode the wire format without importing its
production encoder.

## Review gate

The semantic-review packet covers:

- exact six-row completeness and content-derived revisions;
- route-contract and policy compatibility;
- parent digest compatibility;
- accepted CI-safe specifications and focused coverage;
- mandatory local real ACME/VICE evidence for the C64 projection and all four modeled memory rules;
- zero unresolved critical/major review or security findings.

Preparation may occur before local tools exist, but review acceptance and selection may not. Review
records contain digests and outcomes, never trusted prose as executable authority.

## Compatibility and recovery

The fresh four-binding base and refreshed nine-binding parent remain independently resolvable.
Superseded releases remain byte-identical and fail closed when their executable revisions are stale.
Selecting a child against a different or unavailable parent is rejected. Re-selecting the original
parent or child reproduces its prior bytes and blockers. No migration edits an existing release.

Operators use guarded inspect and select-by-digest operations; raw pointer editing is never an
operational path. Selection revalidates immutable child bytes, exact parent, accepted review and
generated closure freshness immediately before atomic pointer replacement. Old→new→old selection
must reproduce the original bytes and composite blocker projection.
Inspection pins and revalidates the complete repository/readiness/publication/releases chain,
validates a bounded set of release, staging and pointer-temporary entries with lstat, diagnoses
malformed digest names, links, special nodes and cleanup residue, and validates the named release
before reporting a selected child as healthy. Cleanup failures and throws remain visible
diagnostics.

The public select-by-digest operation is owned by `@blend65/readiness-execution`, because only that
package can prove the generated live catalog without reversing the dependency edge. Readiness does
not export a raw durable commit subpath. It exposes only a defensive read-only descriptor accessor
that requires a genuine opaque passive release; the live package co-locates operational pointer
selection and alone reaches the synchronous final guard/rename section. A changed closure or parent
selection aborts without replacement. There is no public passive selector, raw commit primitive or
pre-minted freshness token.

## Specification-visible TypeScript interface

The following passive declarations are exported from `@blend65/readiness`:

```ts
export interface ExecutionPublicationCandidateV1 {
  readonly digest: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly semanticReviewDigest: string;
}
declare const PUBLISHED_EXECUTION_RELEASE_BRAND: unique symbol;
export interface PublishedExecutionRelease {
  readonly [PUBLISHED_EXECUTION_RELEASE_BRAND]: true;
}
declare const COMPOSITE_READINESS_SNAPSHOT_BRAND: unique symbol;
export interface CompositeReadinessSnapshot {
  readonly [COMPOSITE_READINESS_SNAPSHOT_BRAND]: true;
}
export interface PrepareExecutionPublicationInputV1 {
  readonly repositoryRoot: string;
  readonly parentDigest: string;
  readonly bindingBytes: Uint8Array;
  readonly semanticReviewBytes: Uint8Array;
}
export interface ExecutionPublicationInspectionV1 {
  readonly selectedDigest?: string;
  readonly releases: readonly string[];
  readonly diagnostics: readonly ExecutionPublicationDiagnosticV1[];
}
export interface ExecutionPublicationDiagnosticV1 {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export function prepareExecutionPublicationCandidateV1(
  input: PrepareExecutionPublicationInputV1,
): Promise<ExecutionOperationResultV1<ExecutionPublicationCandidateV1>>;
export function resolvePublishedExecutionRelease(
  root: string,
  digest?: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>>;
export function resolveCompositeReadinessSnapshot(
  parent: PublishedSnapshot,
  execution: PublishedExecutionRelease,
): ExecutionOperationResultV1<CompositeReadinessSnapshot>;
export function getCompositeReadinessProjectionV1(
  composite: CompositeReadinessSnapshot,
): ExecutionOperationResultV1<CompositeReadinessProjectionV1>;
export function inspectExecutionPublicationV1(
  root: string,
): Promise<ExecutionOperationResultV1<ExecutionPublicationInspectionV1>>;
```

The live composition declarations are exported from `@blend65/readiness-execution`:

```ts
export interface PublishedExecutionHandlersV1 {
  readonly frontend: ExecutionRouteHandlerV1;
  readonly 'compiler-api': ExecutionRouteHandlerV1;
  readonly cli: ExecutionRouteHandlerV1;
  readonly emit: ExecutionRouteHandlerV1;
  readonly acme: ExecutionRouteHandlerV1;
  readonly vice: ExecutionRouteHandlerV1;
}
declare const LIVE_EXECUTION_CONTEXT_BRAND: unique symbol;
export interface LiveExecutionContextV1 {
  readonly [LIVE_EXECUTION_CONTEXT_BRAND]: true;
}
export function resolveLiveExecutionContextV1(
  release: PublishedExecutionRelease,
): ExecutionOperationResultV1<LiveExecutionContextV1>;
export function getPublishedExecutionHandlersV1(
  context: LiveExecutionContextV1,
): PublishedExecutionHandlersV1;
export function assertGeneratedExecutionBindingsFreshV1(): ExecutionOperationResultV1<true>;
export function selectExecutionPublicationByDigestV1(
  root: string,
  digest: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>>;
```
