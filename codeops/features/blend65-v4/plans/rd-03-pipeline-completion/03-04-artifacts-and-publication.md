# Artifacts and Publication: RD-03 Pipeline Completion

> **Document**: 03-04-artifacts-and-publication.md
> **Parent**: [Index](00-index.md)

## Overview

Serialize the closed machine/layout result to deterministic ACME, assemble and verify a PRG, write
the exact evidence sidecars, and publish one immutable generation through one current record. The
implementation is one direct pipeline and one small lock/pin lifecycle, not a build system,
transaction service, cache or readiness product (AR-C8, AR-C14, AR-C18).

## Terminal ACME Serialization

The serializer accepts only a final machine program, final addresses and a storage-closure
certificate. It emits:

- `!cpu 6502`, exact `* = $0801`, stable global/block/data labels and explicit segment origins;
- documented mnemonics/addressing modes already selected by the compiler;
- parenthesized link-time expressions and explicit low/high extraction;
- exact `!byte`/`!word` data and explicit fill values for padding; and
- no `!to`, macro that hides storage/branch repair, project-controlled symbol, raw basename or
  semantic choice (AR-C5, AR-C8).

Stable labels derive from compiler IDs through a fixed ASCII serializer. Source names never become
assembler identifiers. A final validation walks every emitted instruction against the selected
documented NMOS grid before writing source (AR-C5, AR-C14).

## Direct Phase Interfaces

The implementation exposes only the following direct functions and immutable records. Result
unions carry one safe `diagnostic` string and the closed `reason` shown below. These are internal
compiler interfaces, not a plugin surface.

```ts
type CompleteC64Layout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

interface AcmeSerializationInput {
  readonly layout: CompleteC64Layout;
  readonly certificate: StorageClosureCertificate;
  readonly profile: TargetProfile;
}

type AcmeSerializationResult =
  | {
      readonly kind: "complete";
      readonly source: string;
      readonly expectedLabels: readonly AcmeExpectedLabel[];
      readonly expectedSegments: readonly AcmeExpectedSegment[];
    }
  | {
      readonly kind: "error";
      readonly reason: "invalid-program" | "invalid-layout" | "unsupported-form";
      readonly diagnostic: string;
    };

function serializeAcme(input: AcmeSerializationInput): AcmeSerializationResult;

interface AcmeDiscoveryInput {
  readonly explicitPath?: string;
  readonly path?: string;
  readonly signal?: AbortSignal;
}

type AcmeDiscoveryResult =
  | { readonly kind: "complete"; readonly tool: AcmeToolIdentity }
  | {
      readonly kind: "error";
      readonly reason:
        | "invalid-path"
        | "not-found"
        | "version-mismatch"
        | "process"
        | "output-limit"
        | "cancelled";
      readonly diagnostic: string;
    };

function discoverAcme(input?: AcmeDiscoveryInput): Promise<AcmeDiscoveryResult>;

interface AcmeRunInput {
  readonly tool: AcmeToolIdentity;
  readonly stagingDirectory: string;
  readonly artifactName: string;
  readonly serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }>;
  readonly layout: CompleteC64Layout;
  readonly signal?: AbortSignal;
}

type AcmeRunResult =
  | { readonly kind: "complete"; readonly artifacts: AcmeArtifactSet }
  | {
      readonly kind: "error";
      readonly reason:
        | "invalid-staging"
        | "output-conflict"
        | "process"
        | "diagnostic"
        | "output-limit"
        | "cancelled"
        | "invalid-output";
      readonly diagnostic: string;
    };

function runAcme(input: AcmeRunInput): Promise<AcmeRunResult>;
```

`AcmeExpectedLabel`, `AcmeExpectedSegment`, `AcmeToolIdentity`, and `AcmeArtifactSet` are small
closed records containing only the symbol/range, canonical executable/version/hash, and exact
ordinary-file identities/digests needed by the next boundary. Production process-output and wait
bounds are fixed internal constants, not caller settings.

Each evidence family exports a named pair with no shared runtime dispatcher:

```ts
function encodeBuildEvidence(value: unknown): EvidenceEncodingResult;
function validateBuildEvidence(bytes: Uint8Array): EvidenceValidationResult<BuildEvidence>;
function encodeAssetsEvidence(value: unknown): EvidenceEncodingResult;
function validateAssetsEvidence(bytes: Uint8Array): EvidenceValidationResult<AssetsEvidence>;
function encodeMemoryEvidence(value: unknown): EvidenceEncodingResult;
function validateMemoryEvidence(bytes: Uint8Array): EvidenceValidationResult<MemoryEvidence>;
function encodeCostsEvidence(value: unknown): EvidenceEncodingResult;
function validateCostsEvidence(bytes: Uint8Array): EvidenceValidationResult<CostsEvidence>;
function encodeDebugEvidence(value: unknown): EvidenceEncodingResult;
function validateDebugEvidence(bytes: Uint8Array): EvidenceValidationResult<DebugEvidence>;

type EvidenceEncodingResult =
  | { readonly kind: "complete"; readonly bytes: Uint8Array; readonly sha256: string }
  | {
      readonly kind: "error";
      readonly reason: "malformed" | "unsupported-version" | "inconsistent";
      readonly diagnostic: string;
    };

type EvidenceValidationResult<T> =
  | { readonly kind: "complete"; readonly value: T }
  | {
      readonly kind: "error";
      readonly reason: "malformed" | "unsupported-version" | "inconsistent";
      readonly diagnostic: string;
    };
```

The five evidence value types reproduce only their frozen version-1 records. The generic result
type is compile-time reuse; validation remains five direct functions rather than a schema engine.

Publication consumes an already complete owned staging directory and the existing project snapshot;
it does not compile, assemble, or manufacture evidence inside its critical section:

```ts
interface PreparedGeneration {
  readonly snapshot: ProjectSnapshot;
  readonly generationId: string;
  readonly stagingDirectory: string;
  readonly files: readonly PublishedFileExpectation[];
  readonly primaryArtifact: string;
  readonly buildJsonSha256: string;
  readonly pinForRun?: boolean;
  readonly signal?: AbortSignal;
}

interface PublishedFileExpectation {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

type PublicationCheckpointPhase =
  | "before-lock"
  | "after-lock"
  | "before-generation-rename"
  | "after-generation-rename"
  | "before-current-replace"
  | "after-current-replace"
  | "after-pin-create"
  | "before-cleanup-scan"
  | "before-generation-remove"
  | "before-pin-remove"
  | "before-lock-release";

interface PublicationCheckpoint {
  readonly phase: PublicationCheckpointPhase;
  readonly generationId: string;
  readonly path: string | null;
}

interface PublicationControls {
  readonly onCheckpoint?: (checkpoint: PublicationCheckpoint) => void | Promise<void>;
}

type PublicationErrorReason =
  | "invalid-path"
  | "ownership"
  | "lock-timeout"
  | "cancelled"
  | "invalid-staging"
  | "current"
  | "pin"
  | "cleanup"
  | "committed-recovery";

interface GenerationPinInput {
  readonly snapshot: ProjectSnapshot;
  readonly signal?: AbortSignal;
}

type PublicationLookupResult =
  | { readonly kind: "complete"; readonly generation: PublishedGeneration }
  | { readonly kind: "error"; readonly reason: PublicationErrorReason; readonly diagnostic: string };

type GenerationPinResult =
  | { readonly kind: "complete"; readonly pin: GenerationPin }
  | { readonly kind: "error"; readonly reason: PublicationErrorReason; readonly diagnostic: string };

type PublicationOperationResult =
  | { readonly kind: "complete" }
  | { readonly kind: "error"; readonly reason: PublicationErrorReason; readonly diagnostic: string };

type PublicationResult =
  | {
      readonly kind: "complete";
      readonly generation: PublishedGeneration;
      readonly pin: GenerationPin | null;
    }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

function publishGeneration(
  input: PreparedGeneration,
  controls?: PublicationControls,
): Promise<PublicationResult>;
function readCurrentGeneration(
  snapshot: ProjectSnapshot,
  controls?: PublicationControls,
): Promise<PublicationLookupResult>;
function pinGeneration(
  input: GenerationPinInput,
  controls?: PublicationControls,
): Promise<GenerationPinResult>;
function releaseGenerationPin(
  pin: GenerationPin,
  controls?: PublicationControls,
): Promise<PublicationOperationResult>;
function cleanupGenerations(
  snapshot: ProjectSnapshot,
  controls?: PublicationControls,
): Promise<PublicationOperationResult>;
```

The lookup, pin and operation results use the same publication error reasons. A private optional
checkpoint callback may pause tests immediately before the documented mutation boundaries; it
cannot replace filesystem, process, UUID, clock, hashing, retry or validation behavior.

## Tool Discovery and ACME Driver

Machine-local `tools.jsonc` is optional and outside project roots: the accepted Linux and Windows
locations/tokens follow requirements AR-048. A valid explicit absolute tool path wins; otherwise
one ordered process-`PATH` scan is used. The first discovered candidate must pass the exact version
probe or discovery fails—there is no fallback search, registry, `PATHEXT`, shell or auto-install
(AR-C14).

ACME is invoked with an argument array equivalent to:

```text
acme --cpu 6502 --strict-segments --format cbm
  --outfile <staging>/<name>.prg
  --report <staging>/.acme.report
  --symbollist <staging>/.labels
  <staging>/.asm
```

The driver requires version 0.97, distinct absent output paths and an empty unique staging
directory owned by this build. It bounds stderr/stdout bytes, observes cancellation, waits for
complete child exit and treats any nonzero status or ACME error diagnostic as failure. It never
invokes a shell (AR-C8, AR-C14).

After success it rejects symlinks, devices, directories, aliases, missing/unexpected/overwritten
files and identity changes. It parses report/symbols, validates segments/non-overlap, checks actual
opcode/addressing bytes, PRG header/body/load origin, sprite bytes and startup entry, then deletes
the staging-only `.acme.report` before evidence publication. A stale file from any prior attempt is
never accepted (AR-C8, AR-C14).

## Evidence Writers

The selected profile creates exactly:

```text
<name>.prg
.asm
.labels
.memory.json
.assets.json
.costs.json
.debug.json
.build.json
```

Each sidecar has one direct version-1 encoder/validator matching RD-03's owning schema. Repeated
record shapes may share TypeScript value types but do not share a generic schema runtime, registry,
code generator or database. Encoders reject unknown/missing/mistyped/duplicate/out-of-range data,
sort required arrays/keys, emit canonical UTF-8 JSON with one LF and immediately re-parse/validate
their own bytes before publication (AR-C8).

`.build.json` is written last. It binds the Specification 4 identity, compiler/expert identity,
project snapshot, profile/options/overrides, raw asset and every other published artifact hash. It
does not hash itself. Host provenance is separate from portable reproducibility fields (AR-C8).

## Direct Publication Lifecycle

```ts
interface PublishedGeneration {
  readonly generationId: string;
  readonly directory: string;
  readonly buildJsonSha256: string;
  readonly primaryArtifact: string;
}

interface GenerationPin extends PublishedGeneration {
  readonly pinId: string;
  readonly release: () => Promise<void>;
}
```

### Paths and Lock

- Staging: `<outDir>/.staging-<generationId>`; exclusive ordinary directory.
- Immutable generation: `<outDir>/<generationId>`; must not exist before commit.
- Current record: `<outDir>/current.json`; the only deliberately replaced component.
- Pins: `<outDir>/.pins/<generationId>/<pinId>.pin`; zero-byte exclusive regular files.
- Lock: `<outDir>/.publish.lock`; exclusive ordinary directory (AR-C18).

Lock acquisition uses bounded cancellable retry. It never decides that a lock is stale from PID,
age or process state. Timeout/uncertain ownership reports a structured recovery diagnostic. Normal
release removes only the exact owned empty lock directory. A crash-left lock is manual recovery,
not an automatic break (AR-C14, AR-C18).

The output root is not trusted merely because RD-02 resolved it earlier. Before every mutation
critical section, publication re-resolves project/output containment and compares the recorded
identity of every existing ancestor. Missing compiler-owned components are created one at a time,
then checked with non-following metadata. Any symlink, alias, type or identity change stops the
operation. The same checks run immediately before generation/current rename and cleanup; cleanup
performs no recursive removal after an identity change (AR-C14, AR-C18).

### Commit and Current Record

Compilation, evidence creation and ACME run outside the lock. Under the lock, publication:

1. revalidates every staged ordinary file and digest;
2. renames the unique staging directory once to the absent immutable generation name;
3. reads/validates the prior current generation, if any;
4. writes a canonical unique sibling current-record candidate, closes/revalidates it and atomically
   renames it over `current.json`;
5. for `run`, creates its unique pin before releasing this same critical section; and
6. retains current, the immediately prior current and every generation with any pin entry; removes
   only other provably unpinned generations while still holding the lock (AR-C8, AR-C18).

An unknown `.pins` entry, unreadable state, symlink or type ambiguity stops cleanup. Generation and
pin spelling is canonical lowercase UUID v4. No timestamp/PID/lease is deletion authority. Failed
pre-commit work removes only its own staging directory. Post-current-record failure preserves the
complete generation and reports the recovery state (AR-C8, AR-C14).

### Pin Lifecycle

A reader resolves one current record under the lock, validates its `.build.json` digest and creates
its own exclusive pin before retaining the generation path. `run` pins the exact generation its own
build just committed, not a later current record. Release happens under the lock only after all
owned readers, VICE and monitor sockets have stopped. Failed release deliberately leaves the pin
and reports manual recovery (AR-C8).

## VICE Process and Monitor

`runProject` discovers/probes VICE 3.10 exactly, spawns its pinned PRG with the selected PAL C64
profile through an argument array and owns cancellation/process-tree cleanup. Interactive mode
uses normal-speed visible VICE and leaves control with the developer (AR-C9, AR-C12, AR-C14).

Automated qualification uses this ordered argument contract, with values represented as separate
array elements and `<port>`/`<prg>` supplied only from validated compiler-owned values:

```text
-default -model c64 -pal -sidmodel 0 -console +sound +warp
-binarymonitor -binarymonitoraddress 127.0.0.1:<port>
-controlport2device 37 -limitcycles 100000000 -autostart <prg>
```

Before sending a monitor command on Linux, the driver proves that the listening socket belongs to
the spawned `x64sc` process or its still-owned process tree and that the connected peer is that
socket. Failure to attest ownership is a tool failure. Native Windows socket/process attestation is
part of AR-C16 at RD-10. The small protocol client supports only required commands: checkpoint
set/delete, memory get, display get, VICE info, joyport set and monitor exit. It validates frame
lengths, request IDs, response types, error bytes and bounded payload sizes. This is a test helper,
not a reusable emulator abstraction (AR-C11, AR-C12, AR-C14).

Display signatures use binary-monitor `Display Get (0x84)` indexed VIC-II pixels with the returned
dimensions/offsets included in the hash. Joystick values are set only at the emitted
post-frame-wait/pre-sample label. Memory reads observe result/state/assets/pointers; no monitor write
changes game state. The driver resumes after each input and externally terminates only after
restoration and the pinned BASIC-return checkpoint are observed (AR-C11, AR-C12).

## Cancellation and Failure Boundary

| Point | Required outcome | AR Ref |
|---|---|---|
| Before generation rename/current commit | Stop children, close files, remove only owned staging; prior current unchanged | AR-C14 |
| During lock wait | Abort wait and report cancellation; do not alter lock/output | AR-C18 |
| After current commit but before/during VICE | Keep complete generation/current; stop only owned run resources; release pin last | AR-C8, AR-C14 |
| ACME/VICE output exceeds bound or process cannot stop | Tool/process failure; retain uncertain pin if readers may remain | AR-C14 |
| Current/generation/pin validation fails | Fail closed with exact path/invariant; no guessed repair | AR-C8, AR-C14 |

## Testing Requirements

- ACME source goldens are separate from actual report/symbol/byte/PRG assertions.
- Tool tests use real ACME for exact version/invocation/output behavior. Linux CI provisions the
  checksum-pinned 0.97 binary and treats absence/version mismatch as failure. An optional local
  environment without ACME reports `Unknown`, never pass; the required local M1 qualification must
  have it.
- Publication cases cover competing builds, failed staging, current replacement, pin acquisition,
  active/crash-left pins, uncertain pin namespace, predecessor retention, ancestor replacement and
  deterministic cleanup.
- Pure filesystem/process seams use real temporary directories/children, not mocked implementation
  objects; only platform-unavailable native Windows execution remains AR-C16.
- Cancellation cases cover every row above.
- VICE monitor codec/protocol cases run in CI without VICE; the one real runtime path runs locally,
  sequentially, on VICE 3.10. It asserts the exact argument array and Linux child/socket ownership.
