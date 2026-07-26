# Component Specification: Atomic Publication

> **Document**: 03-05-atomic-publication.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P15–AR-P16, AR-P21–AR-P24

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
| `packages/readiness/src/binding-publication.ts` | Separate carried rows from new promotions |
| `packages/readiness/src/publication-resolver.ts` | Reconstruct exact candidate set per release |
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

The loader accepts a lexical set of handler IDs from the release being prepared/resolved. It
returns exactly one fresh compatible registration per requested ID and rejects unknown, duplicate
or unavailable historical IDs.

## Historical Resolution

Resolver behavior is release-directed:

```text
read and verify bindings-v1.json
  → collect exact serialized handler IDs
  → load fresh candidates for those IDs
  → require exact ID/kind/contract/revision equality
  → validate published declarations
  → create opaque snapshot
```

The existing four-row RD-02 release therefore asks for and resolves four candidates even after
RD-03 code ships. The new release asks for nine. No global “latest profile” cardinality is used.

## Incremental Promotion Transaction

RD-03 requires the currently selected RD-02 publication as its base. Preparation:

1. resolves the selected snapshot and exact four serialized RD-02 rows;
2. reconstructs their fresh callables and proves ID/kind/contract/revision equality;
3. validates exactly five new candidates against the five unbound RD-03 declarations;
4. stages the new transform declaration and marks only the five RD-03 declarations bound;
5. combines four carried rows and five promoted rows into one lexical nine-row binding file;
6. regenerates projections and all semantic review units;
7. reports `promotedHandlerIds` as exactly the five RD-03 IDs;
8. builds and resolves the complete staged release in isolation.

Any changed/missing carried row, extra promotion, incomplete review, stale manifest digest,
candidate mismatch or failed acceptance rejects before the pointer commit.

## Independent Review

The prepared request includes exact units for:

- diagnostic manifest and nineteen-record join;
- evaluator operations, widths, order, budget and memory policy;
- five relation contracts and comparators;
- evaluation-identity field coverage;
- mutation-catalog completeness;
- five handler dependency closures;
- inventory/declaration/binding/projection changes;
- carried-binding preservation and historical-resolution compatibility.

A semantics reviewer records accepted evidence for the exact semantic digest. Any implementation,
authority, catalog, projection or binding change after review makes the evidence stale.

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
Every injected failure after replacement resolves the complete nine-binding release. A mixed
manifest/binding/diagnostic/transform set is never observable.

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
