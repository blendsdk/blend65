# Identity, Deterministic Choices and Replay

> **Document**: 03-03-identity-replay.md
> **Parent**: [Index](00-index.md)

## Overview

Every case-shaping input is explicit, canonical and content-addressed. Random selection is
random-access by generation path rather than a mutable global stream (AR-P4, AR-P5).

## Identity contracts

`CampaignIdentityInput` carries exactly the fields owned by RD-02, including inventory schema/
version/digest/spec revision, rule-model version/digest, generator and boundary-transform binding
identities, renderer revision, target, PRNG ID/version, seed and configuration digest.

Canonical encoding uses a closed field sequence, length-prefixed UTF-8 values, decimal BigInt
strings and LF. Domain tags are distinct for configuration, campaign, draw and case digests.

The exact domain tags are `blend65-configuration-v1`, `blend65-campaign-v1`,
`blend65-counter-draw-v1`, `blend65-case-v1` and `blend65-handler-implementation-v1`.
Canonical bytes are: domain byte length as unsigned u32-BE, domain UTF-8, field count as u32-BE,
then for each fixed-order field its name length/name UTF-8 and value length/value UTF-8. Integers
are unsigned canonical decimal with no leading zero; paths are dot-joined unsigned decimals; hashes
are `sha256:<64 lowercase hex>`. Unknown/duplicate fields are never canonicalized.

```ts
interface HandlerIdentity {
  readonly handlerId: string;
  readonly contractVersion: string;
  readonly implementationRevision: Sha256Digest;
}

interface GenerationConfiguration {
  readonly caseCount: number;
  readonly maxInvalidCases: number;
  readonly enabledRuleIds: readonly string[];
  readonly spellings: readonly ("literal" | "const" | "local" | "parameter")[];
  readonly budget: GenerationBudget;
}

interface CampaignIdentityInput {
  readonly inventorySchemaVersion: 1;
  readonly inventoryVersion: string;
  readonly inventoryDigest: Sha256Digest;
  readonly specRevision: string;
  readonly ruleModelVersion: string;
  readonly ruleModelDigest: Sha256Digest;
  readonly generator: HandlerIdentity;
  readonly boundaryTransform: HandlerIdentity;
  readonly rendererRevision: Sha256Digest;
  readonly target: "c64" | "c64u" | "cx16" | "a800xl" | "a7800";
  readonly prngAlgorithm: "blend65-sha256-ctr-v1";
  readonly seed: Sha256Digest;
  readonly configurationDigest: Sha256Digest;
}

interface CaseIdentity {
  readonly campaignDigest: Sha256Digest;
  readonly generationPath: readonly number[];
  readonly ordinal: number;
  readonly digest: Sha256Digest;
}

type IdentityResult<T> =
  | { readonly ok: true; readonly identity: T; readonly preimage: Uint8Array; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly IdentityDiagnostic[] };

interface IdentityDiagnostic {
  readonly code:
    | "identity.input.invalid"
    | "identity.collision"
    | "identity.registry.limit"
    | "identity.registry.disposed";
  readonly path: string;
  readonly message: string;
}

interface IdentityCollisionRegistry {
  register(digest: Sha256Digest, preimage: Uint8Array): IdentityRegistryResult;
  dispose(): void;
}

declare function createIdentityCollisionRegistry(
  digest?: (preimage: Uint8Array) => Uint8Array,
): IdentityCollisionRegistry;

declare function deriveConfigurationIdentity(
  configuration: GenerationConfiguration,
  registry?: IdentityCollisionRegistry,
): IdentityResult<Sha256Digest>;

declare function deriveCampaignIdentity(
  input: CampaignIdentityInput,
  registry?: IdentityCollisionRegistry,
): IdentityResult<Sha256Digest>;

declare function deriveCaseIdentity(
  campaignDigest: Sha256Digest,
  generationPath: readonly number[],
  ordinal: number,
  registry?: IdentityCollisionRegistry,
): IdentityResult<CaseIdentity>;
```

The implementation retains canonical preimages during a campaign and rejects an unequal-preimage
digest collision. Each registry fails closed before retaining more than 4,096 entries or 16 MiB of
canonical preimages. `dispose()` clears retained bytes and permanently closes the registry.

`createIdentityCollisionRegistry(digest?: (preimage: Uint8Array) => Uint8Array)` returns an opaque
registry. Registering an equal digest/equal preimage is idempotent; equal digest/unequal preimage
returns `identity.collision`. Identity diagnostics use `/configuration`, `/campaign`,
`/generationPath`, `/ordinal`, `/digest` or `/registry`; exhausted and disposed registries return
`identity.registry.limit` and `identity.registry.disposed`.

## Deterministic choice source

`blend65-sha256-ctr-v1` computes each block from campaign seed, generation path and draw ordinal.
Bounded integers use rejection sampling, never modulo bias. A sibling-path insertion cannot alter
draws on an existing path. Campaign loops create one opaque choice context per seed/path: the
factory validates and closes those invariant inputs once, then pre-encodes the counter domain,
field count, seed and generation-path chunks for reuse by every draw on that path. Existing
single-operation wrappers preserve their input and result contracts by preparing transient state
through the same validation path. The default SHA-256 path streams cached invariant chunks plus
new draw/index chunks directly into the digest; only injected conformance digests require a
materialized isolated preimage.

```ts
interface DeterministicChoiceContextInput {
  readonly seed: Sha256Digest;
  readonly generationPath: readonly number[];
}

interface DeterministicChoiceContext {}

declare function createDeterministicChoiceContext(
  input: DeterministicChoiceContextInput,
): ChoiceResult<DeterministicChoiceContext>;

declare function drawCounterBlockFromContext(
  context: DeterministicChoiceContext,
  drawOrdinal: bigint,
  blockIndex: bigint,
): ChoiceResult<Uint8Array>;

declare function drawBoundedIntegerFromContext(
  context: DeterministicChoiceContext,
  drawOrdinal: bigint,
  upperExclusive: bigint,
  blockDigest?: (preimage: Uint8Array) => Uint8Array,
): ChoiceResult<bigint>;

declare function drawCounterBlock(input: {
  readonly seed: Sha256Digest;
  readonly generationPath: readonly number[];
  readonly drawOrdinal: bigint;
  readonly blockIndex: bigint;
}): ChoiceResult<Uint8Array>;

declare function drawBoundedInteger(input: {
  readonly seed: Sha256Digest;
  readonly generationPath: readonly number[];
  readonly drawOrdinal: bigint;
  readonly upperExclusive: bigint;
}, blockDigest?: (preimage: Uint8Array) => Uint8Array): ChoiceResult<bigint>;

type ChoiceResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly ChoiceDiagnostic[] };
```

The counter preimage uses the canonical encoder with fields `seed`, `generationPath`,
`drawOrdinal`, `blockIndex` in that order and the counter domain tag. The SHA-256 output is the
32-byte block. Bounded draws interpret a block as unsigned big-endian 256-bit `x`, compute
`limit = floor(2^256 / upperExclusive) * upperExclusive`, accept only `x < limit`, and return
`x % upperExclusive`; rejection increments `blockIndex` from zero without changing draw ordinal.
`upperExclusive` is `1..2^256`; path components are `0..2^32-1`; ordinals/indices are
`0..2^64-1`. Choice failures use `choice.input.invalid` at `/seed`, `/generationPath/<n>`,
`/drawOrdinal`, `/blockIndex` or `/upperExclusive`.

Published vector `blend65-sha256-ctr-v1/vector-1` uses seed `sha256:` plus 64 zeroes, path `[1,2]`,
draw ordinal `0` and block index `0`. Its counter block is
`441053163d1086217c3a5af54508abc0ba51d534a26f62c9b6a2fb1e306bbe51`.
Bounded vector `vector-1/mod-1000` uses that accepted block and returns `425`. Rejection tests inject
the SHA-256 block source: a block representing `limit` is rejected and the next block at
`blockIndex=1` is consumed.

## Replay

```ts
type ReplayResult =
  | { readonly ok: true; readonly case: GeneratedCase; readonly source: Uint8Array }
  | { readonly ok: false; readonly kind: "replay-incompatible"; readonly missing: IdentityComponent }
  | { readonly ok: false; readonly kind: "replay-invalid"; readonly diagnostics: readonly ReplayDiagnostic[] };
```

Phase 3 owns parsing and resolution, not case generation:

```ts
interface ReplayEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly campaign: CampaignIdentityInput;
  readonly campaignDigest: Sha256Digest;
  readonly caseIdentity: CaseIdentity;
  readonly configuration: GenerationConfiguration;
}

type IdentityComponent =
  | "inventory"
  | "rule-model"
  | "generator"
  | "boundary-transform"
  | "renderer"
  | "configuration";

interface ReplayDiagnostic {
  readonly code:
    | "replay.input.invalid-json"
    | "replay.input.invalid-utf8"
    | "replay.input.limit"
    | "replay.schema.invalid"
    | "replay.identity.mismatch";
  readonly path: string;
  readonly message: string;
}

type ReplayEnvelopeParseResult =
  | { readonly ok: true; readonly envelope: ReplayEnvelopeV1; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly ReplayDiagnostic[] };

interface RevisionEntry {
  readonly component: IdentityComponent;
  readonly revision: Sha256Digest;
  readonly value: unknown;
}

interface RevisionRegistry {
  resolve(component: IdentityComponent, revision: Sha256Digest): unknown | undefined;
}

type RevisionRegistryResult =
  | { readonly ok: true; readonly registry: RevisionRegistry; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly ReplayDiagnostic[] };

type RevisionResolutionResult =
  | { readonly ok: true; readonly resolved: Readonly<Record<IdentityComponent, unknown>> }
  | { readonly ok: false; readonly kind: "replay-incompatible"; readonly missing: IdentityComponent };

declare function parseReplayEnvelope(bytes: Uint8Array): ReplayEnvelopeParseResult;
declare function createRevisionRegistry(entries: readonly RevisionEntry[]): RevisionRegistryResult;
declare function resolveReplayRevisions(
  envelope: ReplayEnvelopeV1,
  registry: RevisionRegistry,
): RevisionResolutionResult;
```

Replay v1 limits are 1 MiB input, depth 12, string 512 bytes, 4,096 total values, 4,096 rule IDs,
64 path components and 32 spellings. IDs match the accepted model/handler patterns. Arrays that
are sets are lexical, unique and closed. Parser diagnostics are
`replay.input.invalid-json`, `replay.input.invalid-utf8`, `replay.input.limit`,
`replay.schema.invalid`, `replay.identity.mismatch` and use RFC 6901 paths from the envelope root.

A revision entry is `{ component, revision, value }`; component is the closed
`IdentityComponent`, revision is a canonical digest and value is an opaque callable/object.
The exact own-key set is enforced, including symbol and non-enumerable keys. Duplicate
component/revision pairs reject. One registry accepts at most 4,096 entries, 65,536 aggregate
closed value/key nodes and 4 MiB aggregate UTF-8 value/key bytes. Factory registries are marked by
module-private authority and retain deeply immutable values once; exact replay returns those
closed values without cloning them again. Resolution returns the exact six resolved values or
`{ ok: false, kind: "replay-incompatible", missing: IdentityComponent }`; it never probes another
revision and exposes no “current” fallback API.

The replay envelope carries the complete closed normalized generation configuration as well as the
identities and path/ordinal. Replay verifies its bytes against the configuration digest, then
resolves every exact digest/revision before generation. Any missing component, missing
configuration or digest/content mismatch returns `replay-incompatible`; it never substitutes
current implementations, consults ambient process configuration or emits partial source (AR-P6).
Bulk cases remain ephemeral; identity plus digest-verified configuration reconstructs them under
the current supported revision.

## Campaign composition

Campaign composition prepares immutable authority once, then generates by ordinal without a
mutable cursor. The total number of planned cases is exactly `configuration.caseCount`;
`maxInvalidCases` is a ceiling inside that total, not an additional count. Campaign creation
rejects totals above 100,000.

One campaign binds exactly one of the three generator handlers. Every enabled modeled rule must
route to that binding's handler ID. A frontend/runtime mixture therefore uses two campaigns; the
compiler handler remains a deliberate empty direct domain. This preserves the singular generator
identity already carried by `CampaignIdentityInput`.

```ts
type CampaignGeneratorId =
  | "generator.frontend-cases"
  | "generator.compiler-cases"
  | "generator.runtime-cases";

interface CampaignInventoryAuthorityV1 {
  readonly schemaVersion: 1;
  readonly inventoryVersion: string;
  readonly inventoryDigest: Sha256Digest;
  readonly specRevision: string;
}

interface CampaignRuleModelAuthorityV1 {
  readonly schemaVersion: 1;
  readonly ruleModelVersion: string;
  readonly ruleModelDigest: Sha256Digest;
  readonly suite: ModeledGeneratorSuite;
}

type CampaignGeneratorRegistrationV1 = FreshCandidateRegistration;
type CampaignBoundaryRegistrationV1 = FreshCandidateRegistration;

type CaseRenderRoundTripKind =
  | "valid"
  | "invalid-source-transform"
  | "invalid-parameter-binding";

interface CaseRenderSuccess {
  readonly ok: true;
  readonly kind: CaseRenderRoundTripKind;
  readonly source: string;
  readonly sourceBytes: Uint8Array;
  readonly projection: RoundTripModule;
  readonly effectiveParameterBindings: readonly ParameterValueBinding[];
  readonly diagnostics: readonly [];
}

type CaseRenderResult =
  | CaseRenderSuccess
  | { readonly ok: false; readonly diagnostics: readonly RoundTripDiagnostic[] };

type CaseRendererV1 = (
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
) => CaseRenderResult;

declare function renderGeneratedCase(
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
): CaseRenderResult;

interface CampaignRendererBindingV1 {
  readonly implementationRevision: Sha256Digest;
  readonly implementation: CaseRendererV1;
}

interface CampaignDependenciesV1 {
  readonly inventory: CampaignInventoryAuthorityV1;
  readonly ruleModel: CampaignRuleModelAuthorityV1;
  readonly generator: CampaignGeneratorRegistrationV1;
  readonly boundaryTransform: CampaignBoundaryRegistrationV1;
  readonly renderer: CampaignRendererBindingV1;
}

interface CampaignPlanSummary {
  readonly schemaVersion: 1;
  readonly campaignDigest: Sha256Digest;
  readonly totalCaseCount: number;
  readonly validCaseCount: number;
  readonly invalidCaseCount: number;
}

declare const PREPARED_CAMPAIGN_CAPABILITY: unique symbol;

interface PreparedCampaign {
  readonly [PREPARED_CAMPAIGN_CAPABILITY]: true;
  readonly summary: CampaignPlanSummary;
}

declare const CAMPAIGN_COLLISION_INDEX_CAPABILITY: unique symbol;

interface CampaignCollisionIndex {
  readonly [CAMPAIGN_COLLISION_INDEX_CAPABILITY]: true;
}

type CampaignPlanLane = "coverage-valid" | "random-valid" | "invalid";

interface CampaignPlanItem {
  readonly ordinal: number;
  readonly generationPath: readonly [lane: 0 | 1 | 2, laneOrdinal: number];
  readonly lane: CampaignPlanLane;
  readonly request: ModeledCaseRequest;
  readonly renderOptions: SourceRenderOptions;
}

interface GeneratedCase {
  readonly identity: CaseIdentity;
  readonly planItem: CampaignPlanItem;
  readonly modeledCase: GeneratedModeledCase;
  readonly source: string;
  readonly sourceBytes: Uint8Array;
  readonly roundTripProjection: RoundTripModule;
  readonly effectiveParameterBindings: readonly ParameterValueBinding[];
  readonly usage: GenerationUsage;
  readonly attempts: number;
}

interface CampaignDiagnostic {
  readonly code:
    | "campaign.input.invalid"
    | "campaign.identity.mismatch"
    | "campaign.dependency.mismatch"
    | "campaign.rule.unavailable"
    | "campaign.coverage.insufficient"
    | "campaign.choice.invalid"
    | "campaign.identity.collision"
    | "campaign.case.invalid"
    | "campaign.render.invalid";
  readonly path: string;
  readonly message: string;
}

type CampaignResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly CampaignDiagnostic[] };

declare function createCampaignCollisionIndex(input: {
  readonly campaignDigest: Sha256Digest;
  readonly digest?: (preimage: Uint8Array) => Uint8Array;
}): CampaignResult<CampaignCollisionIndex>;

declare function createCampaignPlan(input: {
  readonly campaign: CampaignIdentityInput;
  readonly configuration: GenerationConfiguration;
  readonly dependencies: CampaignDependenciesV1;
  readonly collisionIndex?: CampaignCollisionIndex;
}): CampaignResult<PreparedCampaign>;

declare function getCampaignPlanItem(
  campaign: PreparedCampaign,
  ordinal: number,
): CampaignResult<CampaignPlanItem>;

declare function generateCase(
  campaign: PreparedCampaign,
  item: CampaignPlanItem,
): CampaignResult<GeneratedCase>;

declare function generateCampaignCase(
  campaign: PreparedCampaign,
  ordinal: number,
): CampaignResult<GeneratedCase>;

declare function replayCase(input: {
  readonly envelopeBytes: Uint8Array;
  readonly registry: RevisionRegistry;
  readonly collisionIndex?: CampaignCollisionIndex;
}): ReplayResult;
```

The factory first validates exact own-data input and configuration/campaign digests. It requires
factory-produced `FreshCandidateRegistration` capabilities for the generator and boundary
transform, checks their verified bindings plus inventory, rule-model and renderer identities
against the campaign, then invokes the boundary transform during canonical coverage preparation
and requires its typed families to agree with the reviewed suite. Dependencies are snapshotted
once. No later operation reads caller-owned objects, accessors, environment, process arguments,
current bindings or the filesystem.

The mandatory valid prefix contains one canonical case for every enabled rule and every permitted
literal/const/local/parameter position in that rule's reviewed spelling matrix, including ordinary
local and parameter address/value positions for memory intrinsics. If `caseCount` cannot hold that
prefix, creation fails with `campaign.coverage.insufficient`. Remaining valid slots use path-local
draws. Invalid slots use only space remaining after mandatory valid coverage, up to
`maxInvalidCases`. The three fixed path lanes are `[0, coverageOrdinal]`,
`[1, randomValidOrdinal]` and `[2, invalidOrdinal]`; adding an unrelated branch cannot renumber an
existing lane.

Every plan item uses `{ maxSourceBytes: configuration.budget.maxSourceBytes,
literalSpellings: [] }` as its closed render options in v1. A later spelling-policy revision must
become a case-shaping identity input rather than consulting ambient renderer defaults.

`PreparedCampaign` is factory-branded, deeply immutable and has no cursor. Plan-item and case
lookups are output-pure by ordinal: repetition, permutation and concurrent calls return the same
identity, metadata, bindings and bytes. Plan items are derived lazily rather than retaining up to
100,000 request objects. The campaign's exact case identities are nevertheless collision-checked
before the prepared capability is returned.

`CampaignCollisionIndex` is an opaque factory value bound to one campaign digest. It accepts at
most 100,000 case witnesses. A witness stores the exact generation path and ordinal while the
campaign digest is retained once, so collision proof does not duplicate the invariant campaign
preimage for every case. An injected digest function exists only on its factory for collision
conformance tests. Equal digest/equal witness is idempotent; equal digest/unequal witness returns
`campaign.identity.collision`. A supplied index must be fresh and bound to the derived campaign.
The normal factory creates one internally.

`CaseRendererV1` first validates the model-valid baseline. Valid cases and
`parameter-binding-replace` cases use the ordinary independent round-trip validator; the latter
also replaces exactly the named effective external binding. Source-transform invalid cases apply
their one closed transform at the renderer's structural expression/argument seam, parse the result
with the independent inverse and prove that the resolved transform path contains the exact
replacement while unrelated structure is unchanged. No invalid case is passed through valid-only
IR validation after its transform. `GeneratedCase.usage` is finalized once from construction
usage, rendered bytes and attempts; `sourceBytes` and replay's `source` reference the same isolated
byte array.

The finite reviewed valid and neighbor constructions are prepared once behind the factory-produced
modeled-suite capability. Preparation independently validates every template and retains its exact
construction usage. Per-case generation still invokes the exact registered handler, but it may
consume that branded prepared evidence instead of rebuilding, resnapshotting and recounting the
same IR. Arbitrary or unbranded handler results receive the complete structural validation path.
Independent rendering, parsing and projection comparison still run for every generated case.

Replay parses bounded bytes first, resolves all six exact revisions and validates the resolved
closed value shapes. Normal replay creates a private target-only capability after the same
campaign, configuration, dependency and domain validation; it derives only the carried ordinal's
lane, path, plan item and complete identity before regenerating and comparing that case. This
capability is not a `PreparedCampaign` and does not claim that a fresh process repeated the public
factory's global collision proof. Public `createCampaignPlan` remains the sole producer of a
globally proven prepared campaign and still checks every case identity before returning. When a
caller explicitly supplies a collision-conformance index, replay uses the full-proof path.
Generator and boundary-transform revision entries must be
`FreshCandidateRegistration` capabilities; the registry validates them and its private replay
path consumes only their verified bindings. The rule-model entry is the factory-produced
`ModeledGeneratorSuite` itself and is preserved by identity rather than structurally cloned. That
suite retains three distinct authority facts: protocol compatibility `rule-model-v1`, the
manifest's own `registryVersion`, and the digest of the exact validated manifest bytes. Campaign
composition requires the protocol label and digest to match the suite; revision registration
may retain nonrequested alternate suites, but resolving one as authority requires its key,
retained digest and campaign digest to agree. A disagreement is `replay-incompatible` naming
`rule-model` before any handler runs. Raw `RevisionRegistry.resolve` is compatibility-set lookup;
exported `resolveReplayRevisions` performs this authority check, and `replayCase` repeats it as
defense in depth. The manifest release version is already protected by those digested bytes and is
not an alias for the protocol label.
A missing exact value returns `replay-incompatible`; invalid input returns `replay-invalid`;
neither path invokes a current handler or returns source.

### Fresh-process fixture protocol

The checked-in child accepts exactly one bounded `ReplayEnvelopeV1` JSON byte sequence on stdin.
It accepts no argv configuration or path, and reads no campaign configuration from the
environment, current working directory or ambient binding state. For a valid request it constructs
only the fixture's exact revision registry from code and fixed authority assets addressed relative
to the fixture module, then calls `replayCase`.

Stdout is exactly one canonical LF-terminated JSON object:

```ts
type ReplayChildResponseV1 =
  | {
      readonly schemaVersion: 1;
      readonly ok: true;
      readonly caseDigest: Sha256Digest;
      readonly sourceBase64: string;
    }
  | {
      readonly schemaVersion: 1;
      readonly ok: false;
      readonly result:
        | { readonly kind: "replay-incompatible"; readonly missing: IdentityComponent }
        | { readonly kind: "replay-invalid"; readonly diagnostics: readonly ReplayDiagnostic[] };
    };
```

Exit zero means one typed response was produced; a non-zero exit means fixture/protocol failure.
ST-17 launches two independent children with the same stdin and compares the decoded source bytes,
case digest and exact response shape.

## Input safety

Replay JSON is parsed with byte/depth/string/count limits, closed properties and duplicate-key
rejection. The intrinsic typed-array byte length is checked against the 1 MiB limit before a
defensive byte copy is allocated. Canonical preimages, injected digest outputs and implementation
dependency contents likewise use the intrinsic byte length before copying; fixed digest widths,
per-input maxima and aggregate dependency/retention bounds are rejected before allocation. Target,
algorithm, identity and logical path values use allowlists. No replay field is joined to a host
path (AR-P12).

## Implementation revision freshness

```ts
interface ImplementationRevisionInput {
  readonly contractVersion: string;
  readonly entryPath: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: Uint8Array;
  }[];
}

declare function deriveImplementationRevision(
  input: ImplementationRevisionInput,
): ImplementationRevisionDerivationResult;

declare function validateImplementationRevision(input: {
  readonly claimedRevision: Sha256Digest;
  readonly metadata: ImplementationRevisionInput;
}): ImplementationRevisionValidationResult;

interface ImplementationRevisionDiagnostic {
  readonly code:
    | "implementation.input.invalid"
    | "implementation.dependency.invalid"
    | "implementation.revision.stale";
  readonly path: string;
  readonly message: string;
}

type ImplementationRevisionFailure = {
  readonly ok: false;
  readonly diagnostics: readonly ImplementationRevisionDiagnostic[];
};

type DerivedImplementationRevisionSuccess =
  | {
      readonly ok: true;
      readonly revision: Sha256Digest;
      readonly normalizedFiles: readonly { readonly path: string; readonly content: Uint8Array }[];
      readonly diagnostics: readonly [];
    };

interface FreshImplementationRevision {
  readonly revision: Sha256Digest;
}

type ValidatedImplementationRevisionSuccess =
  DerivedImplementationRevisionSuccess & FreshImplementationRevision;
type ImplementationRevisionDerivationResult =
  DerivedImplementationRevisionSuccess | ImplementationRevisionFailure;
type ImplementationRevisionValidationResult =
  ValidatedImplementationRevisionSuccess | ImplementationRevisionFailure;

declare function registerFreshCandidateBinding(input: {
  readonly binding: ExecutableBindingInput;
  readonly freshness: FreshImplementationRevision;
}): FreshCandidateRegistrationResult;
```

Paths are contained POSIX repository-relative paths, unique and lexical; `entryPath` must name one
member. Each content length and the next aggregate total are validated before its defensive copy.
Contents normalize CRLF/CR to LF, then canonical bytes include contract version and each path,
normalized byte length and normalized bytes in lexical order under the implementation domain tag.
Missing/extra/duplicate/non-lexical/traversal paths reject. Stable diagnostics are
`implementation.input.invalid`, `implementation.dependency.invalid` and
`implementation.revision.stale`, rooted at `/contractVersion`, `/entryPath`, `/files/<n>` or
`/claimedRevision`. `validateCandidateBindings` remains the Phase 1 non-authoritative structural
compatibility check over raw metadata. Derivation returns no freshness brand. Successful
claimed-revision validation returns a distinct success type carrying module-private, non-forgeable
`FreshImplementationRevision` authority bound to both the exact revision and contract version;
only `registerFreshCandidateBinding`, revision registration, replay and publication accept that
capability. Stale metadata or a contract mismatch is therefore rejected before any callable enters
an authoritative registry without changing the Phase 1 immutable API (AR-P21, AR-P22).

## Tests

- Official deterministic vectors for counter blocks and rejection sampling.
- Fresh-process byte equality.
- Field-by-field identity mutation, including inventory content and boundary transform.
- Path-local stability when unrelated branches are inserted.
- Collision fixture with injected digest function.
- Missing exact revision with no fallback calls.
- Fresh-process replay with no ambient campaign configuration.
- Missing configuration and configuration digest/content mismatch.
