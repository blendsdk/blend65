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
