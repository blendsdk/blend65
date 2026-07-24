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
    bindings-v1.json
    semantic-review-v1.json
    declarations.ts
    compiler-readiness.md
  current-publication.json
```

The manifest records schema, inventory generation digest and SHA-256 for every member. Release
directories are immutable after validation. `current-publication.json` is a regular file naming
one digest and is the sole commit point.

## Publication algorithm

1. Acquire the existing generation lock.
2. Build a unique staging directory under the publication root.
3. Candidate-validate all four RD-02 bindings against unbound declarations.
4. Stage inventory v1 with only those declaration binding states changed.
5. Recompute independent review evidence and generated projections.
6. Validate the staged authority plus published-state registry and every manifest digest.
7. Rename the staging directory to its content-addressed release name.
8. Atomically replace and fsync the pointer file and parent directory.
9. Release the lock.

Any failure before step 8 leaves the previous pointer authoritative. A release directory not
referenced by the pointer is inert and recoverable garbage. No schema-v2 inventory is introduced.

## Reader boundary

Published-state readers resolve the pointer, validate it as a regular contained path, load the
manifest, verify every digest and then load authority/bindings. Static tests reject direct reads of
published loose artifacts outside this resolver. Source-authoring tools may still read the
repository inputs explicitly; readiness claims use the publication resolver.

## Failure and recovery

| Failure | Behavior | AR Ref |
|---|---|---|
| Crash before pointer replacement | Old release remains current | AR-P10 |
| Crash after atomic pointer replacement | New complete release is current | AR-P10 |
| Digest/symlink/path mismatch | Reject before reading member | AR-P12 |
| Concurrent publisher | Existing lock protocol serializes | AR-P10 |
| Stale bound declaration or missing binding | Published-state validation fails | AR-P9 |

## Closeout

After publication, regenerate the checked-in current projections from the selected release,
run `readiness:generate` and `readiness:check`, update traceability, and perform the mandatory
deferral-expiry review. `spec/` remains untouched.
