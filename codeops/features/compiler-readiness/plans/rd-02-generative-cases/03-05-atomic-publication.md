# Atomic Binding Publication

> **Document**: 03-05-atomic-publication.md
> **Parent**: [Index](00-index.md)

## Overview

RD-02 ends by changing four handler declarations from `unbound` to `bound`. Inventory bytes,
review evidence, projections and executable binding metadata must become visible together
(AR-P10, AR-P14).

## Release layout

```text
readiness/publications/
  releases/<publication-digest>/
    manifest.json
    compiler-readiness-v1.json
    rule-models-v1.json
    rule-models-v1-review.json
    bindings-v1.json
    semantic-review-v1.json
    declarations.ts
    compiler-readiness.md
  current-publication.json
```

The manifest records schema, inventory generation digest and SHA-256 for every member. The
publication digest uses domain tag `blend65-publication-v1` over the canonical closed
manifest/member-digest record; pointer digest, directory name and recomputed digest must match.
Release directories are immutable after validation. An existing digest is reusable only when its
manifest and every member are byte-identical; unequal preimages are a collision and leave the old
pointer selected. `current-publication.json` is a regular file naming one digest and is the sole
commit point.

## Publication algorithm

1. Acquire the existing generation lock.
2. Build a unique staging directory under the publication root.
3. Candidate-validate all four RD-02 bindings against unbound declarations.
4. Stage inventory v1 with only those declaration binding states changed.
5. Compute staged semantic digests and pause for independent semantic review; accepted,
   digest-matching review records are inputs, never generated approval.
6. Recompute projections and validate the staged authority plus published-state registry.
7. Write and fsync every bounded regular-file member, fsync the staging directory, rename it to the
   content-addressed release name, then fsync `releases/`.
8. Run the complete specification suite against an isolated resolver selecting the staged release.
9. Atomically write/fsync/rename the pointer and fsync the publication root.
10. Verify the selected digest and release again, then release the lock.

Any failure before step 9 leaves the previous pointer authoritative. A release directory not
referenced by the pointer is inert and recoverable garbage. No schema-v2 inventory is introduced.

## Reader boundary

Published-state readers resolve the pointer, validate it as a regular contained path, load the
manifest, verify every digest and then return an opaque `PublishedSnapshot` capability containing
authority and bindings. Every published lookup and readiness-claim API requires that capability;
raw/candidate validators are explicitly non-authoritative. Static tests reject direct reads of
published loose artifacts outside this resolver as defense in depth.

`readiness:generate` and a new `readiness:source-check` remain source-authoring commands over loose
inputs and cannot make a readiness claim. `readiness:check` resolves and validates the selected
publication. A guarded, handler-agnostic `readiness:publish` command is the durable entry point for
RD-02 and future binding promotions; it uses the shared generation lock and staged-review protocol
without hard-coding RD-02 handler IDs. The CLI, command tests, root scripts and
`readiness/README.md` migrate together.

Before any read or hash, the resolver uses `open` plus regular-file `fstat` and enforces named caps
for pointer bytes, manifest bytes, binding bytes, member count, each member and total release bytes.
Exact-limit and limit-plus-one cases are specification-tested. Platforms or filesystems unable to
provide the required file and directory synchronization return
`publication-durability-unsupported`; they never claim crash durability.

## Failure and recovery

| Failure | Behavior | AR Ref |
|---|---|---|
| Crash before pointer replacement | Old release remains current | AR-P10 |
| Crash after atomic pointer replacement | New synced complete release is current | AR-P10 |
| Existing digest with unequal bytes | Collision; old release remains current | AR-P5, AR-P10 |
| Digest/symlink/path mismatch | Reject before reading member | AR-P12 |
| Oversized pointer/manifest/member/total | Reject before allocation or hashing | AR-P12 |
| Concurrent publisher | Existing lock protocol serializes | AR-P10 |
| Stale bound declaration or missing binding | Published-state validation fails | AR-P9 |

## Closeout

After publication, regenerate the checked-in current projections from the selected release,
run `readiness:generate` and `readiness:check`, update traceability, and perform the mandatory
deferral-expiry review. `spec/` remains untouched.
