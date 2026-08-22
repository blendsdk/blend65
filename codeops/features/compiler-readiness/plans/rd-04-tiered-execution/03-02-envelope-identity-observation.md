# Component Design: Envelope, Identity and Observation

> **Document**: 03-02-envelope-identity-observation.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P7, AR-P8

## Responsibility

Turn only a selected valid generated case into an executable program without changing its RD-02
identity or embedding the RD-03 answer. Establish the target input fixture, allocate observable
state through the compiler, and prove the final layout before runtime evidence is accepted.

## Envelope IR

`ExecutionEnvelopeIrV1` is distinct from RD-02 `GenModule`. It contains the source-case digest,
complete typed external argument literals, one entry call, actual-observation declarations, a
non-success completion initializer and an exact post-entry store sequence. Scalar envelopes store
each actual observation byte in byte order and then store completion `0xA5`; direct-MMIO envelopes
contain only the completion store. Its validator accepts only the closed primitive set required by
the nine modeled rules and rejects duplicate, missing or out-of-order stores.

Fresh construction never trusts those structural fields. `createExecutionCaseV1` accepts a
genuine opaque `PreparedCampaign` plus ordinal, regenerates the factory-owned case, rejects every
non-valid case and derives the source digest, entry, ordered typed arguments and observation into
a module-private-brand `ExecutionCaseV1` whose regenerated case and envelope live in a
module-private `WeakMap`. The structural parser exists only for historical replay;
parsed bytes must resolve through the named historical campaign before rendering or execution.
Plain or copied envelope objects are never executable authority.
The readiness-owned guarded `getExecutionCaseProjectionV1` verifies that opaque handle against the
private registry and returns a frozen passive record graph whose returned source bytes are a fresh,
caller-owned mutable copy. Mutating that copy can never affect registered state or a later
projection. The execution package's
renderer and adapters pass the original handle to that accessor; they never inspect or duplicate
the private registry. A projection is data for rendering and identity only, never execution
authority, and cannot be passed where an `ExecutionCaseV1` is required.

The renderer emits a deterministic `main(): void` for valid cases. Scalar-returning cases store the
actual bytes into compiler-allocated module globals. Memory-write intrinsics use the narrowly
declared direct MMIO observable when mirroring into RAM would change semantics. The completion byte
starts at `0x00` and is written `0xA5` only after every actual store. Invalid diagnostic cases keep
their exact original source and cannot be enveloped. A focused source validator regenerates bytes
from the genuine opaque execution case and requires an exact match before compile; seeded oracle
text or values therefore change the bytes and reject without exposing oracle material to the
renderer.

## Initial and actual-observation projections

`ExecutionInitialStateFixtureV1` and input projection `c64-vic-color-readback-v1` establish the
current C64 fixture:

| Cell | Before entry | Oracle-visible value |
|---|---|---|
| `$D020` | write fixture low nibble, read back | `0xF0 | lowNibble` |
| `$D021` | write fixture low nibble, read back | `0xF0 | lowNibble` |
| `$D022` | write fixture low nibble, read back | `0xF0 | lowNibble` |

Word reads combine adjacent projected bytes little-endian. The route verifies all touched cells
before entry and gives the identical host fixture to RD-03 evaluation. A missing cell, unsupported
projection, or readback mismatch is non-passing. The projection cannot become selectable authority
until real VICE proves all three registers plus direct `$D020` and computed `$D021` word starts.

Actual memory writes use the separate versioned projection
`c64-vic-color-observation-v1`. It leaves RD-03's logical effects unchanged and maps every logical
write byte observed at `$D020..$D022` to `0xF0 | (logicalByte & 0x0F)` before comparing it with
VICE readback. Both projection revisions enter the execution identity. The direct `$20` case must
therefore observe `$F0`, and the `$2000` word case must observe `$F0F0`; low-nibble mutants must
still fail. Input fixture projection and post-write observation projection share one immutable
register-behavior table so their address and nibble rules cannot drift.

Fixture validation is passive in this phase: it verifies complete unique projected cells and a
zero completion byte before entry, returning a closed non-passing result for missing cells,
readback mismatch or a stale success sentinel. Phase 5 proves the corresponding VICE entry is not
reached; Phase 2 does not manufacture execution authority through a callback.

## Two-stage execution identity

1. The pre-build identity hashes the immutable source-case identity, rendered source digest,
   argument bindings, envelope/selector/fixture revisions, canonical fixture-content digest,
   target, budgets, the lexically sorted handler participant tuples
   `{capabilityId, contractVersion, implementationRevision}` and declared observation request.
2. The final identity additionally hashes ACME label/report-derived addresses and the accepted
   layout proof.

Replay requires the historical revisions named by the record. It never substitutes current
handlers. Changing any identity input changes the execution identity while the RD-02 source-case
identity remains byte-identical.

## Layout proof

`ExecutionObservationLayoutV1` records compiler symbols for result bytes and completion. The
passive `resolveExecutionObservationLayoutV1` remains the frozen structural/historical validator.
The live `resolveExecutionCaseObservationLayoutV1` additionally uses the genuine execution case,
emitted labels and compiler build metadata to prove that each range is unique and disjoint
from code, constants/data, semantic memory footprint, stack, MMIO and every other observation
range. It resolves against the genuine execution case, requiring zero result symbols for direct
MMIO or exactly the scalar byte width. Ordered report-derived store records must match the exact
envelope store sequence, target the resolved observation/completion cells and increase by
instruction address, proving completion remains last after lowering and assembly. Selected symbol
names, addresses and store records all enter the proof digest. Fixed absolute ordinary-RAM
addresses and post-build binary patching are forbidden.

## Failure behavior

Envelope validation, expectation-text leakage, incomplete arguments, stale sentinel, missing
labels, overlapping ranges, unsupported direct observables and fixture mismatches return stable
pre-runtime failures. No such failure may be converted into partial passing evidence or allowed to
launch VICE.

## Specification-visible TypeScript interface

The following declarations are exported from `@blend65/readiness`:

```ts
export type ExecutionProjectionRevisionV1 =
  | 'c64-vic-color-readback-v1'
  | 'c64-vic-color-observation-v1';
export interface ExecutionArgumentLiteralV1 {
  readonly name: string;
  readonly type: 'boolean' | 'byte' | 'sbyte' | 'word' | 'sword';
  readonly value: number | boolean;
}
export interface ExecutionObservationRequestV1 {
  readonly kind: 'scalar-bytes' | 'direct-mmio';
  readonly byteLength: 1 | 2;
  readonly address?: number;
  readonly projectionRevision?: ExecutionProjectionRevisionV1;
}
export type ExecutionEnvelopePostEntryStoreV1 =
  | { readonly kind: 'observation-byte'; readonly byteIndex: 0 | 1 }
  | { readonly kind: 'completion'; readonly value: 165 };
export interface ExecutionEnvelopeIrV1 {
  readonly revision: 'execution-envelope-ir-v1';
  readonly sourceCaseDigest: string;
  readonly arguments: readonly ExecutionArgumentLiteralV1[];
  readonly entryFunction: string;
  readonly observation: ExecutionObservationRequestV1;
  readonly completionInitialValue: 0;
  readonly completionSuccessValue: 165;
  readonly postEntryStores: readonly ExecutionEnvelopePostEntryStoreV1[];
}
export interface ExecutionInitialStateFixtureV1 {
  readonly revision: 'c64-vic-color-readback-v1';
  readonly cells: readonly { readonly address: number; readonly logicalValue: number }[];
}
declare const EXECUTION_CASE_BRAND: unique symbol;
export interface ExecutionCaseV1 {
  readonly [EXECUTION_CASE_BRAND]: true;
}
export interface ExecutionCaseProjectionV1 {
  readonly sourceCaseDigest: string;
  readonly sourceBytes: Uint8Array;
  readonly envelope: ExecutionEnvelopeIrV1;
  readonly fixture: ExecutionInitialStateFixtureV1;
  readonly observation: ExecutionObservationRequestV1;
}
export interface ExecutionObservationLayoutV1 {
  readonly revision: 'execution-observation-layout-v1';
  readonly resultSymbols: readonly string[];
  readonly resultAddresses: readonly number[];
  readonly completionSymbol: string;
  readonly completionAddress: number;
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
  readonly proofDigest: string;
}
export type ExecutionEmittedStoreV1 =
  | {
      readonly instructionAddress: number;
      readonly targetAddress: number;
      readonly kind: 'observation-byte';
      readonly byteIndex: 0 | 1;
    }
  | {
      readonly instructionAddress: number;
      readonly targetAddress: number;
      readonly kind: 'completion';
      readonly value: 165;
    };
export interface ExecutionAddressRangeV1 {
  readonly start: number;
  readonly length: number;
}
export interface ExecutionPrebuildIdentityInputV1 {
  readonly sourceCaseDigest: string;
  readonly renderedSourceDigest: string;
  readonly argumentsDigest: string;
  readonly envelopeRevision: 'execution-envelope-ir-v1';
  readonly selectorRevision: string;
  readonly fixtureRevision: 'c64-vic-color-readback-v1';
  readonly fixtureDigest: string;
  readonly observationProjectionRevision?: 'c64-vic-color-observation-v1';
  readonly target: 'c64';
  readonly policyDigest: string;
  readonly handlers: readonly ExecutionHandlerIdentityV1[];
  readonly observation: ExecutionObservationRequestV1;
}
export interface ExecutionHandlerIdentityV1 {
  readonly capabilityId: ExecutionCapabilityIdV1;
  readonly contractVersion: string;
  readonly implementationRevision: string;
}
export interface ExecutionLayoutProofInputV1 {
  readonly labels: ReadonlyMap<string, number>;
  readonly codeRanges: readonly ExecutionAddressRangeV1[];
  readonly dataRanges: readonly ExecutionAddressRangeV1[];
  readonly semanticRanges: readonly ExecutionAddressRangeV1[];
  readonly stackRanges: readonly ExecutionAddressRangeV1[];
  readonly observationSymbols: readonly string[];
  readonly completionSymbol: string;
}
export interface ExecutionCaseLayoutProofInputV1 extends ExecutionLayoutProofInputV1 {
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
}
export function parseExecutionEnvelopeIrV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionEnvelopeIrV1>;
export function parseExecutionInitialStateFixtureV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionInitialStateFixtureV1>;
export function createExecutionCaseV1(
  campaign: PreparedCampaign,
  ordinal: number,
  observation: ExecutionObservationRequestV1,
): ExecutionOperationResultV1<ExecutionCaseV1>;
export function resolveExecutionEnvelopeReplayV1(
  campaign: PreparedCampaign,
  envelope: ExecutionEnvelopeIrV1,
): ExecutionOperationResultV1<ExecutionCaseV1>;
export function getExecutionCaseProjectionV1(
  executionCase: ExecutionCaseV1,
): ExecutionOperationResultV1<ExecutionCaseProjectionV1>;
export function projectC64InitialStateV1(
  address: number,
  logicalByte: number,
): ExecutionOperationResultV1<number>;
export function projectC64ActualWriteV1(
  address: number,
  logicalByte: number,
): ExecutionOperationResultV1<number>;
```

The following declarations are exported from `@blend65/readiness-execution`:

```ts
export function renderExecutionEnvelopeV1(
  executionCase: ExecutionCaseV1,
): ExecutionOperationResultV1<string>;
export interface ExecutionValidatedSourceV1 {
  readonly revision: 'execution-validated-source-v1';
  readonly sourceDigest: string;
}
export interface ExecutionFixtureReadbackV1 {
  readonly revision: 'execution-fixture-readback-v1';
  readonly cells: readonly {
    readonly address: number;
    readonly projectedValue: number;
  }[];
  readonly completionValueBeforeEntry: number;
}
export function validateRenderedExecutionSourceV1(
  executionCase: ExecutionCaseV1,
  sourceBytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionValidatedSourceV1>;
export function deriveExecutionFixtureDigestV1(
  fixture: ExecutionInitialStateFixtureV1,
): ExecutionOperationResultV1<string>;
export function validateExecutionFixtureReadbackV1(
  executionCase: ExecutionCaseV1,
  readback: unknown,
): 'pass' | 'invalid-evidence-input';
export function derivePrebuildExecutionIdentityV1(input: ExecutionPrebuildIdentityInputV1): string;
export function resolveExecutionObservationLayoutV1(
  input: ExecutionLayoutProofInputV1,
): ExecutionOperationResultV1<ExecutionObservationLayoutV1>;
export function resolveExecutionCaseObservationLayoutV1(
  executionCase: ExecutionCaseV1,
  input: ExecutionCaseLayoutProofInputV1,
): ExecutionOperationResultV1<ExecutionObservationLayoutV1>;
export function deriveFinalExecutionIdentityV1(
  prebuildIdentity: string,
  layout: ExecutionObservationLayoutV1,
): string;
```

## Invalid diagnostic sibling authority

`ExecutionCaseV1` remains valid-only: rejected source is never wrapped as an executable envelope.
For frontend/compiler/CLI diagnostic routes, `@blend65/readiness/published-oracle` exports a sibling
opaque capability created only by jointly authenticating the selected oracle and genuine campaign:

```ts
export interface PublishedDiagnosticCaseV1 {
  readonly [PUBLISHED_DIAGNOSTIC_CASE_V1]: true;
}
export interface PublishedDiagnosticCaseProjectionV1 {
  readonly schemaVersion: 1;
  readonly kind: 'invalid-source-transform';
  readonly sourceCaseDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly expectedDiagnostic: DiagnosticObservationV1;
  readonly authority: Readonly<{
    readonly joinPolicyRevision: "published-diagnostic-case-equivalence-v1";
    readonly selectedReleaseDigest: Sha256Digest;
    readonly selectedCampaignDigest: Sha256Digest;
    readonly selectedSourceCaseDigest: Sha256Digest;
    readonly evaluationIdentity: Sha256Digest;
    readonly sourceContentIdentity: Sha256Digest;
  }>;
}
export function createPublishedDiagnosticCaseV1(
  context: PublishedOracleContext,
  campaign: PreparedCampaign,
  ordinal: number,
): OracleValidationResultV1<PublishedDiagnosticCaseV1>;
export function getPublishedDiagnosticCaseProjectionV1(
  value: PublishedDiagnosticCaseV1,
): OracleValidationResultV1<PublishedDiagnosticCaseProjectionV1>;
```

The constructor regenerates the ordinal, requires `invalid-source-transform`, and authenticates a
versioned cross-authority case-equivalence join. It retains the caller's genuine source-case digest
and separately retains the selected release/campaign/case provenance. The join requires equal
inventory schema/version/digest, spec revision, rule-model version/digest, target, PRNG algorithm,
and generator/boundary handler IDs and contract versions. Seed and normalized configuration are
authenticated caller-campaign replay inputs: selected replay must echo them exactly, and both enter
caller/selected campaign, case and evaluation identities. Participant implementation revisions may
differ only when the complete modeled case and exact rendered source are equal. The selected rule
route privately determines the oracle handler; callers cannot supply
one. Evaluation must prove exact rule, neighbor, modeled error diagnostic and source-content
identity. Callers provide no expectation fields. The guarded projection is passive rendering/
reporting data and is never accepted by an evidence-classification seam; workers receive source
bytes and case kind but never expected truth. Both provenances and the join-policy revision enter
downstream execution/publication identity. The symbols export only from the published-oracle
subpath, not the readiness root barrel.
