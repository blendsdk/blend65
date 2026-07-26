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

## Closed v1 contract

### Public API

Only the following publication operations are package exports. Member writes, release-directory
promotion, pointer replacement, acceptance execution and snapshot construction are private.

```ts
interface PreparedPublicationReview {
  readonly [PREPARED_PUBLICATION_REVIEW_CAPABILITY]: true;
}

interface PublicationReviewRequestV1 {
  readonly schemaVersion: 1;
  readonly semanticDigest: Sha256Digest;
  readonly specRevision: string;
  readonly dependencyDigests: {
    readonly bindings: Sha256Digest;
    readonly inventory: Sha256Digest;
    readonly "rule-model": Sha256Digest;
    readonly "rule-model-review": Sha256Digest;
  };
  readonly promotedHandlerIds: readonly string[];
  readonly reviewUnits: readonly {
    readonly unitId: string;
    readonly semanticDigest: Sha256Digest;
    readonly dependencyDigests: Readonly<Record<string, Sha256Digest>>;
  }[];
}

interface PublicationDiagnostic {
  readonly code:
    | "publication.input.invalid"
    | "publication.input.limit"
    | "publication.path.invalid"
    | "publication.digest.mismatch"
    | "publication.collision"
    | "publication.binding.invalid"
    | "publication.review.invalid"
    | "publication.review.stale"
    | "publication.review.not-accepted"
    | "publication.lock.contended"
    | "publication.durability-unsupported"
    | "publication.acceptance.failed"
    | "publication.io";
  readonly path: string;
  readonly message: string;
}

type PublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind:
        | "invalid"
        | "collision"
        | "contended"
        | "durability-unsupported"
        | "acceptance-failed"
        | "io";
      readonly diagnostics: readonly PublicationDiagnostic[];
    };

declare function prepareBindingPublicationReview(input: {
  readonly repositoryRoot: string;
}): Promise<
  PublicationResult<{
    readonly review: PreparedPublicationReview;
    readonly request: PublicationReviewRequestV1;
    readonly requestBytes: Uint8Array;
  }>
>;

declare function publishBindingTransaction(input: {
  readonly repositoryRoot: string;
  readonly semanticReviewBytes: Uint8Array;
}): Promise<
  PublicationResult<{
    readonly publicationDigest: Sha256Digest;
    readonly snapshot: PublishedSnapshot;
    readonly reusedExistingRelease: boolean;
  }>
>;

declare function resolvePublishedSnapshot(input: {
  readonly repositoryRoot: string;
}): Promise<PublicationResult<PublishedSnapshot>>;

declare function getPublishedBinding(
  snapshot: PublishedSnapshot,
  handlerId: string,
): ExecutableBinding | undefined;
declare function getPublishedInventory(snapshot: PublishedSnapshot): InventoryV1 | undefined;
declare function getPublishedMetadata(
  snapshot: PublishedSnapshot,
):
  | {
      readonly publicationDigest: Sha256Digest;
      readonly inventoryGenerationDigest: Sha256Digest;
    }
  | undefined;
```

`repositoryRoot` must be a canonical absolute path. `promotedHandlerIds` is lexical and unique.
`requestBytes` is the exact LF-terminated canonical JSON encoding of `request`. Preparation is
read-only. Every operation reconstructs callable authority from the package-owned dependency
catalog and an explicit version-one promotion profile containing exactly the four handlers in the
handler matrix below. Callers cannot supply executable candidates, and later catalog growth cannot
widen a publication implicitly. The transaction recomputes preparation from current bytes and
never trusts the earlier capability. A `PublishedSnapshot` exposes no fields. Inventory, bindings
and digests live in a module-private `WeakMap`, and all three read APIs reject forged values at
runtime.

### Wire schemas and digest

All JSON is strict duplicate-key-rejecting UTF-8, closed-property, LF-terminated and serialized in
the field order shown. `current-publication.json` is:

```json
{"schemaVersion":1,"publicationDigest":"sha256:<64 lowercase hex>"}
```

`manifest.json` is:

```json
{
  "schemaVersion": 1,
  "inventoryGenerationDigest": "sha256:<64 lowercase hex>",
  "members": [
    {
      "path": "bindings-v1.json",
      "byteLength": 123,
      "digest": "sha256:<64 lowercase hex>"
    }
  ]
}
```

Members are lexical by path and are exactly:

```text
bindings-v1.json
compiler-readiness-v1.json
compiler-readiness.md
declarations.ts
rule-models-v1-review.json
rule-models-v1.json
semantic-review-v1.json
```

`bindings-v1.json` is
`{"schemaVersion":1,"bindings":[{"handlerId", "kind", "contractVersion",
"implementationRevision"}]}` with those four binding fields emitted in that order and rows lexical
and unique by handler ID. Functions are never serialized. Resolution joins each row to one exact
fresh candidate before published-state validation.

`semantic-review-v1.json` reuses the existing `{ schemaVersion: 1, reviews: [...] }` envelope and
contains exactly one accepted record for every lexical `reviewUnits` request row. The existing 20
inventory review units are recomputed for the staged inventory, and one `publication-bindings` row
has `semanticDigest` equal to the top-level review-request digest and exactly the four top-level
dependency keys/digests. Every record uses the request's `specRevision`; the reviewer and
`resolvedDisagreementIds` remain independently authored evidence. Missing, duplicate, stale,
blocked, unexpected or dependency-mismatched review prevents staging. The review request therefore
contains every digest an independent reviewer needs; no production API manufactures acceptance.

The publication preimage uses the existing u32-BE length-prefixed canonical-field encoding and
domain `blend65-publication-v1`. Fields are, in order: `schemaVersion = "1"`,
`inventoryGenerationDigest`, `memberCount = "7"`, then for each lexical member
`member.N.path`, `member.N.byteLength` as unsigned canonical decimal, and `member.N.digest`.
`publicationDigest` is SHA-256 of that preimage. The manifest does not contain its own digest or
the publication digest. Directory name, pointer value and recomputed digest must agree.

### Resource limits

```ts
const PUBLICATION_V1_LIMITS = {
  maxPointerBytes: 256,
  maxManifestBytes: 16_384,
  maxBindingBytes: 1_048_576,
  maxSemanticReviewBytes: 1_048_576,
  maxMembers: 7,
  maxMemberBytes: 16_777_216,
  maxTotalReleaseBytes: 67_108_864,
  maxBindings: 4_096,
  maxJsonDepth: 16,
  maxJsonValues: 65_536,
  maxStringBytes: 65_536,
} as const;
```

The resolver opens each path and uses `fstat` to prove a bounded regular file before reading,
allocating or hashing it. It rejects symlinks, hard-link substitution, absolute/traversal member
paths, devices, FIFOs and sockets. Diagnostic messages are at most 512 UTF-8 bytes.

### Handler matrix

Only these declarations become bound, each with one exact compatible binding:

```text
generator.compiler-cases     generator  1.0.0
generator.frontend-cases     generator  1.0.0
generator.runtime-cases      generator  1.0.0
transform.boundary-variants  transform  1.0.0
```

`oracle.compiler-result`, `oracle.emitted-program`, `oracle.frontend-result` and
`oracle.runtime-state` remain unbound and have no binding. Every RD-04 evidence-capability
declaration also remains unbound.

### Conformance and crash protocol

The non-package-exported `publication-conformance-v1.ts` seam contains only:

```ts
type PublicationFaultPoint =
  | "after-publication-directory-sync"
  | "after-member-sync"
  | "after-staging-directory-sync"
  | "before-release-rename"
  | "after-release-rename"
  | "after-releases-directory-sync"
  | "before-staged-validation"
  | "after-staged-validation"
  | "after-pointer-temporary-sync"
  | "after-pointer-rename"
  | "after-publication-root-sync";

type PublicationFilesystemFaultPoint =
  | "after-directory-lstat"
  | "before-directory-sync"
  | "after-file-lstat"
  | "after-file-open"
  | "before-file-read"
  | "after-file-read"
  | "after-output-open"
  | "after-file-sync"
  | "after-directory-enumeration"
  | "before-remove";

interface PublicationConformanceHooks {
  readonly atFaultPoint?: (
    point: PublicationFaultPoint,
    context: {
      readonly publicationDigest?: Sha256Digest;
      readonly memberPath?: string;
    },
  ) => void | Promise<void>;
  readonly atFilesystemPoint?: (
    point: PublicationFilesystemFaultPoint,
    context: {
      readonly path: string;
    },
  ) => void | Promise<void>;
  readonly digest?: (domain: string, bytes: Uint8Array) => Sha256Digest;
  readonly forceDurabilityUnsupported?: boolean;
  readonly forceStagedValidationFailure?: boolean;
}

declare function runWithPublicationConformance<T>(
  hooks: PublicationConformanceHooks,
  operation: () => Promise<T>,
): Promise<T>;

declare function inspectPublicationLimitsForTest(input: {
  readonly pointerBytes: number;
  readonly manifestBytes: number;
  readonly bindingBytes: number;
  readonly semanticReviewBytes: number;
  readonly memberCount: number;
  readonly memberBytes: number;
  readonly totalReleaseBytes: number;
}): PublicationResult<true>;

declare function validatePublicationModuleBoundary(
  files: readonly {
    readonly path: string;
    readonly source: string;
  }[],
): PublicationResult<true>;
```

The transaction syncs every member, the staging directory, `releases/` after release rename, the
pointer temporary, and the publication root after pointer rename. Unsupported file or directory
sync returns the typed durability result; it never degrades. The wrapper scopes hooks to one async
operation and restores prior state even when the operation fails; tests never mutate a global hook.
The two directory/rename points added by filesystem hardening expose ordering around persistent
parent creation and release promotion. `PublicationFilesystemFaultPoint` is implementation-only:
it injects path substitution and I/O failure at the shared no-follow guard boundaries without
changing production defaults.

The checked-in crash child accepts one bounded canonical JSON stdin request
`{schemaVersion:1,repositoryRoot,crashAt}`. `repositoryRoot` is a canonical absolute temporary
test root and `crashAt` is one of the original nine post-write/validation fault points or `null`;
the child does not accept `after-publication-directory-sync`, `before-release-rename`, or any
filesystem-only point. The child reconstructs the same package-owned catalog as production and
owns only the review evidence. A selected fault terminates the child immediately. Without a crash
it writes one
canonical JSON line `{schemaVersion:1,ok,publicationDigest?}` to stdout; stderr is empty unless the
fixture itself crashes. The parent always resolves in a new process.

### CLI and static boundary

CLI argv is exactly one of `source-check`, `generate`, `check`, `publish`, with no extra arguments.
Success is exit 0 with empty stdout/stderr. Domain, validation, contention, durability and I/O
failure are exit 1 with empty stdout and sorted `code: path: message\n` stderr. Invalid argv is exit
2 with empty stdout and exactly
`Usage: cli.js <source-check|generate|check|publish>\n` on stderr.

`source-check` validates loose source authority and authoring projection freshness; `generate`
regenerates loose projections under the shared lock; neither returns a readiness capability.
`check` resolves and validates the selected publication read-only. `publish` uses the fixed
staged-review path; the resolver and transaction reconstruct the package-owned catalog internally
and share the generation lock. Root scripts add `readiness:source-check` and
`readiness:publish`.

Production ownership of `readiness/publications/**`, member-name constants or snapshot construction
is limited to the exact paths `binding-publication.ts`, `publication-conformance-v1.ts`,
`publication-model.ts`, `publication-pointer.ts` and `publication-resolver.ts`. All other
production modules use only the public resolver and snapshot read APIs. The permanent static
boundary test scans the complete production TypeScript closure, and exact-path matching rejects
nested files that reuse an allowed basename.

## Publication algorithm

1. Acquire the existing generation lock.
2. Reconstruct the package-owned callable catalog from exact dependency bytes and select only the
   explicit version-one handler profile.
3. Build a unique staging directory under the publication root and candidate-validate all four
   bindings against unbound declarations.
4. Stage inventory v1 with only those declaration binding states changed.
5. Compute staged semantic digests and pause for independent semantic review; accepted,
   digest-matching review records are inputs, never generated approval.
6. Recompute projections and validate the staged authority plus published-state registry.
7. Write and fsync every bounded regular-file member, fsync the staging directory, rename it to the
   content-addressed release name, then fsync `releases/`.
8. Resolve and fully validate the exact staged release through the package-owned isolated resolver;
   any invariant failure prevents pointer replacement.
9. Atomically write/fsync/rename the pointer and fsync the publication root.
10. Verify the selected digest and release again, then release the lock.

Any failure before step 9 leaves the previous pointer authoritative. A release directory not
referenced by the pointer is inert and recoverable garbage. No schema-v2 inventory is introduced.

## Workflow release gate

Immediately before the one real publication, CodeOps runs ST-01–ST-40 on the exact unchanged phase
tree and records the tree revision plus green result. With no intervening code or authority change,
the real transaction recomputes the reviewed authority, stages the resulting exact digest, validates
all staged invariants through the isolated resolver and performs the sole pointer commit. The full
test runner is a workflow gate, not a production dependency and never runs recursively inside the
transaction.

## Reader boundary

Published-state readers resolve the pointer, validate it as a regular contained path, load the
manifest, verify every digest and then return an opaque `PublishedSnapshot` capability containing
authority and bindings. Every published lookup and readiness-claim API requires that capability;
raw/candidate validators are explicitly non-authoritative. Static tests reject direct reads of
published loose artifacts outside this resolver as defense in depth.

`readiness:generate` and a new `readiness:source-check` remain source-authoring commands over loose
inputs and cannot make a readiness claim. `readiness:check` resolves and validates the selected
publication. A guarded `readiness:publish` command is the durable entry point; it uses the shared
generation lock, staged-review protocol and package-private version-one promotion profile without
accepting caller-provided callables. Future binding sets require their own explicit profile/version
decision. The CLI, command tests, root scripts and `readiness/README.md` migrate together.

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
