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

`resolvePublishedExecutionContext` pins and revalidates the child directory, reconstructs accepted
review evidence, verifies content-derived handlers and resolves the named parent by digest rather
than its mutable pointer. It returns opaque `PublishedExecutionContext`; callers cannot manufacture
one structurally.

`resolveCompositeReadinessSnapshot` combines that context with the immutable parent. It projects an
`unbound` declaration as bound only for an exact accepted child row. Parent-only, missing, stale,
duplicate, undeclared or rejected rows retain the corresponding
`unbound-evidence-capability` blocker. A child never changes inventory/model/generator/oracle
authority and clears no blocker outside its six rows.

## Atomic publication

The existing pinned-directory, bounded-read, staging and atomic-pointer primitives are generalized
without weakening their checks. Candidate files are written to a sibling staging directory,
validated and reviewed from their final bytes, renamed to the digest directory, re-resolved, then
the pointer is atomically replaced and directory-synced. Failure at any step preserves the prior
selection. Reconciliation distinguishes complete release, recoverable staging residue and
ambiguous state; ambiguous state fails closed.

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
