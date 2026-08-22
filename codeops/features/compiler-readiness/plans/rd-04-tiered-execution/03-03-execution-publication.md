# Component Design: Execution Publication and Composite Authority

> **Document**: 03-03-execution-publication.md
> **Parent**: [Index](00-index.md)
> **Decision**: AR-P5

## Responsibility

Publish the six route implementations as one independently reviewed child release bound to the
exact selected parent digest
`sha256:41557dde5590fed1fd28a8e920769787af43118de94c48c9484a20dc773e2706`.
Historical compiler-readiness publications remain byte-identical.

## Artifact layout

```text
readiness/execution-publications/
├── current-execution-publication.json
└── releases/<sha256-digest>/
    ├── manifest.json
    ├── parent-publication-v1.json
    ├── execution-bindings-v1.json
    └── semantic-review-v1.json
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

## Atomic publication

The existing pinned-directory, bounded-read, staging and atomic-pointer primitives are generalized
without weakening their checks. Candidate files are written to a sibling staging directory,
validated and reviewed from their final bytes, renamed to the digest directory, re-resolved, then
the pointer is atomically replaced and directory-synced. Failure at any step preserves the prior
selection. Reconciliation distinguishes complete release, recoverable staging residue and
ambiguous state; ambiguous state fails closed.

The historical source-boundary gate remains exact. A separate path-family owner allowlist permits
execution-publication root and pointer literals only in the named execution-publication modules in
`@blend65/readiness`, and live-catalog literals only in the named binding-catalog modules in
`@blend65/readiness-execution`. Complete-source tests scan both packages. The publication-v1 owner
set and existing immutable specification tests remain unchanged; ordinary modules may access
neither authority family.

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

Both historical four-binding and nine-binding parent releases remain independently resolvable.
Selecting a child against a different or unavailable parent is rejected. Re-selecting the original
parent or child reproduces its prior bytes and blockers. No migration edits an existing release.

Operators use guarded inspect and select-by-digest operations; raw pointer editing is never an
operational path. Selection revalidates immutable child bytes, exact parent, accepted review and
generated closure freshness immediately before atomic pointer replacement. Old→new→old selection
must reproduce the original bytes and composite blocker projection.

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
export function selectExecutionPublicationByDigestV1(
  root: string,
  digest: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>>;
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
```
