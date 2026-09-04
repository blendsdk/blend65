# Phase-2 Executable Contracts: RD-08

> **Document**: 03-05-phase2-executable-contracts.md
> **Parent**: [Index](00-index.md)
> **Authority**: exact specification-test interface contract for tasks 2.1.1–2.2.6

## Scope

This document closes AR-14. It is the interface authority for implementation-blind Phase-2 tests.
The contracts are additive. Existing v1 bytes, digests, public signatures and opaque capabilities
remain unchanged.

The v2 parent is new. The existing execution-child v1 wire format and transaction are reused because
they already bind an opaque parent digest; no child invariant changes merely because the parent is
v2. Parent and child pointers remain separate. (AR-5, AR-13, AR-14)

## Stable handler population

`RuleFamilyHandlerIdV2` is the following exact lexical union and order:

```ts
export type RuleFamilyHandlerIdV2 =
  | "generator.compiler-cases"
  | "generator.frontend-cases"
  | "generator.runtime-cases"
  | "oracle.compiler-result"
  | "oracle.emitted-program"
  | "oracle.frontend-result"
  | "oracle.runtime-state"
  | "transform.boundary-variants"
  | "transform.semantic-relations";

export const RULE_FAMILY_HANDLER_IDS_V2: readonly RuleFamilyHandlerIdV2[];
```

Current revision digests are derived from fresh candidate authority. They are never hard-coded as
normative API constants. A migration contains all nine rows once, in the order above.

## Complete v2 rule-model document

The aliases and `TerminalRuleDispositionV2`/`RuleFamilyV2` definitions in
`03-02-rule-families-dispositions.md` remain authoritative. The persisted top-level document is:

```ts
export interface RuleModelVersionV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-version-v2";
  readonly version: "2.0.0";
  readonly predecessorPublicationDigest: Sha256Digest;
}

export interface PublishedStructuredCaseBindingV2 {
  readonly caseId: StructuredCaseIdV1;
  readonly caseDigest: Sha256Digest;
  readonly sourceDigest: Sha256Digest;
  readonly oracleEvaluationIdentity: Sha256Digest;
  readonly executionEnvelopeDigest?: Sha256Digest;
  readonly embedFixtureIds: readonly string[];
}

export interface RuleModelRegistryV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-registry-v2";
  readonly version: RuleModelVersionV2;
  readonly inventoryDigest: Sha256Digest;
  readonly specRevision: "spec-v3.0";
  readonly families: readonly RuleFamilyV2[];
  readonly dispositions: readonly TerminalRuleDispositionV2[];
  readonly firstVertical: FirstVerticalPublicationCandidateV2;
  readonly structuredCases: readonly PublishedStructuredCaseBindingV2[];
}

export type RuleModelV2DiagnosticCode =
  | "rule-model.unsupported-version"
  | "rule-model.invalid-cardinality"
  | "rule-model.invalid-disposition"
  | "rule-model.invalid-family"
  | "rule-model.invalid-first-vertical"
  | "rule-model.invalid-case-binding";

export type RuleModelV2ValidationResult =
  | {
      readonly ok: true;
      readonly model: RuleModelRegistryV2;
      readonly modelDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: RuleModelV2DiagnosticCode;
        readonly path: string;
        readonly message: string;
      }[];
    };

export interface CreateFirstRuleModelRegistryInputV2 {
  readonly sourceRecord: PublishedRuleFamilyRecord;
  readonly firstVertical: FirstVerticalPublicationCandidateV2;
  readonly fixtureSet: EmbeddedCaseFixtureSetV2;
}

export function createFirstRuleModelRegistryV2(
  input: CreateFirstRuleModelRegistryInputV2,
): RuleModelV2ValidationResult;

export function validateRuleModelRegistryV2(input: unknown): RuleModelV2ValidationResult;
```

The first candidate contains exactly 2,112 lexical unique disposition rule IDs. Exactly the 16
first-vertical rules use `state: "reviewed"`; the other 2,096 use only
`state: "pending-review"` with `family-review-pending`. A reviewed row carries the claim role,
route and result required by `03-02`; a pending row carries none of them. `outside-initial-slice`
is invalid v2 data.

Every first-vertical evidence binding is represented bidirectionally in `structuredCases` with the
same case ID and case digest. The combined execution exemplar
`case.structured.vertical-combined-v1` is also present once with an execution-envelope digest; it is
not invented as an additional rule binding.

`createFirstRuleModelRegistryV2` is the only production constructor for this initial 2,112-row
projection. It derives the inventory population from the authenticated passive source record and
the reviewed rows from the authenticated first-vertical and fixture capabilities; callers never
supply or rebuild the denominator. This lets every owning package prepare a genuine v2 parent
through public APIs without exporting a test-only fixture or duplicating model-oracle logic.
(AR-15)

## Published structured execution exemplar

The optimizer-consumer payload has one immutable parent-member owner. It is not reconstructed from
the current case registry after publication.

```ts
export const FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID =
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end" as const;

export interface StructuredExecutionExemplarDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "structured-execution-exemplar-v2";
  readonly ruleId: typeof FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID;
  readonly caseId: "case.structured.vertical-combined-v1";
  readonly caseDigest: Sha256Digest;
  readonly source: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly digest: Sha256Digest;
  };
  readonly expectation: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly oracleEvaluationIdentity: Sha256Digest;
  };
  readonly envelope: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly digest: Sha256Digest;
  };
}

export interface PreparedStructuredExecutionExemplarV2 {
  readonly document: StructuredExecutionExemplarDocumentV2;
  readonly canonicalBytes: Uint8Array;
  readonly documentDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly expectationBytes: Uint8Array;
  readonly envelopeBytes: Uint8Array;
}

export function createFirstVerticalStructuredExecutionExemplarV2(): PublicationResult<PreparedStructuredExecutionExemplarV2>;
```

The factory resolves the authenticated combined structured case, then stores its canonical source,
independent expected observation and unchanged v1 execution-envelope bytes as base64. The expected
observation and envelope use the existing canonical publication JSON renderer. All returned byte
arrays are fresh copies. The exact rule ID above is the combined case's registry-declared primary
rule; the exemplar does not add another first-vertical rule binding. (AR-16)

## Authenticated embed-fixture references

```ts
export interface EmbeddedCaseFixtureReferenceV2 {
  readonly fixtureId: string;
  readonly digest: Sha256Digest;
  readonly relativePath: string;
}

export interface EmbeddedCaseFixtureDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "embedded-case-fixtures-v2";
  readonly fixtures: readonly EmbeddedCaseFixtureReferenceV2[];
}

declare const embeddedCaseFixtureSetBrand: unique symbol;
export interface EmbeddedCaseFixtureSetV2 {
  readonly [embeddedCaseFixtureSetBrand]: true;
}

export type EmbeddedCaseFixtureValidationResultV2 =
  | {
      readonly ok: true;
      readonly fixtureSet: EmbeddedCaseFixtureSetV2;
      readonly document: EmbeddedCaseFixtureDocumentV2;
      readonly fixtureSetDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code:
          | "rule-model.unauthenticated-fixture"
          | "rule-model.invalid-fixture-path"
          | "rule-model.invalid-fixture-digest"
          | "rule-model.invalid-fixture-population";
        readonly path: string;
        readonly message: string;
      }[];
    };

export function createFirstVerticalEmbeddedFixtureSetV2(
  candidate: FirstVerticalPublicationCandidateV2,
): EmbeddedCaseFixtureValidationResultV2;

export function validateEmbeddedCaseFixtureDocumentV2(
  input: unknown,
): EmbeddedCaseFixtureValidationResultV2;
```

The first vertical produces the authenticated empty fixture list because none of its cases uses
`embed()`. A populated document may contain only registry-owned fixture IDs. Each ID maps to one
fixed digest and one fixed canonical relative path beneath `fixtures/`; callers cannot select or
override either value. Absolute paths, `..`, empty segments, backslashes, symlinks, duplicates,
unknown IDs and over-limit lists reject at the exact row/field path before a workspace or worker is
created.

## Passive records and executable authority

Historical byte resolution and executable authority are deliberately different capabilities.

```ts
export type PublishedRuleFamilyFormatVersion = 1 | 2;

declare const publishedRuleFamilyRecordBrand: unique symbol;
export interface PublishedRuleFamilyRecord {
  readonly [publishedRuleFamilyRecordBrand]: true;
}

export interface PublishedRuleFamilyRecordProjectionV2 {
  readonly schemaVersion: PublishedRuleFamilyFormatVersion;
  readonly publicationDigest: Sha256Digest;
  readonly predecessorPublicationDigest?: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly members: readonly {
    readonly path: string;
    readonly digest: Sha256Digest;
    readonly byteLength: number;
    readonly bytes: Uint8Array;
  }[];
}

export interface ResolvePublishedRuleFamilyRecordInputV2 {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
}

export function resolvePublishedRuleFamilyRecordByDigestV2(
  input: ResolvePublishedRuleFamilyRecordInputV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyRecord>>;

export function getPublishedRuleFamilyRecordProjectionV2(
  record: PublishedRuleFamilyRecord,
): PublicationResult<PublishedRuleFamilyRecordProjectionV2>;

declare const publishedRuleFamilySnapshotV2Brand: unique symbol;
export interface PublishedRuleFamilySnapshotV2 {
  readonly [publishedRuleFamilySnapshotV2Brand]: true;
}

export type PublishedRuleFamilyAuthorityV2 = PublishedSnapshot | PublishedRuleFamilySnapshotV2;

export function acquirePublishedRuleFamilyAuthorityV2(
  record: PublishedRuleFamilyRecord,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyAuthorityV2>>;
```

Passive resolution authenticates the directory, manifest, member bytes/digests, schema and stored
binding-row structure. It never loads callables and never creates `PublishedOracleContext`.
Projections return fresh member-byte copies.

Authority acquisition performs the existing exact fresh-callable join for every stored row. A
missing or different revision returns `ok: false`, `kind: "stale"`, diagnostic code
`publication.implementation-unavailable`, and path
`/bindings/<lexical-index>/implementationRevision`. Same handler ID, kind or contract version is
not a substitute. The legacy `resolvePublishedSnapshotByDigest` remains an executable resolver and
therefore fails the same way for obsolete v1 implementations; it is not a passive-resolution
bypass.

Test authority follows the same boundary. `createOraclePublicationSpecFixture` remains bound to
historical digest `sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403`
and is used for passive authentication plus exact stale-execution assertions. Legacy tests of the
still-supported schema-v1 staging transaction use
`createCurrentOraclePublicationSpecFixture(): Promise<OraclePublicationSpecFixture>` instead. That
factory creates an isolated, reviewed four-handler v1 base with current exact implementation
revisions; it does not rewrite or reinterpret a checked-in historical release. Spec-owner changes
may switch only fixture construction for tests that require a callable base; their staging,
hostile-input, canonical-byte and fault assertions remain unchanged. Carried-row assertions in
those tests compare staged rows to the corresponding authenticated current-base rows, never to
obsolete historical revision constants. (AR-19, AR-20)

Execution-child history follows the same distinction. The checked-in historical pair is v1 parent
`sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5` and child-v1
`sha256:2afaa8243acf4e47af1d23bb93a5069d0b88caf11721060b58e85db86e77d228`. The child
authenticates and retains that exact obsolete parent digest independently, while the parent resolves
passively and its executable resolver returns `publication.implementation-unavailable`. Such a pair
does not form a composite executable authority. The older migration-source parent
`sha256:41af…3403` has no historical child and must not be used to mint one. Only a parent with exact
installed revisions may enter `resolveCompositeReadinessSnapshot`; tests retain byte snapshots of
both parent and child releases across either outcome. The execution-publication test fixture keeps
its default isolated repository free of execution releases; the historical-pair case explicitly
calls `installHistoricalExecutionRelease(repositoryRoot): Promise<void>` to copy and validate only
the exact `2afaa8…d228` release without selecting it. (AR-21–AR-23)

Cross-package catalog and campaign tests that need executable authority resolve the selected current
v2 parent (currently `sha256:95196a…dfdf6`) from their existing current-authority fixture. Child v1 binds that
authenticated digest without interpreting the parent wire version. Their separately named
historical-authority fixture remains unchanged for passive and safety coverage. (AR-26)

## Deterministic all-nine revision-transition manifest

```ts
export interface RuleFamilyHandlerMigrationV2 {
  readonly handlerId: RuleFamilyHandlerIdV2;
  readonly kind: "generator" | "oracle" | "transform";
  readonly contractVersion: "1.0.0";
  readonly fromRevision: Sha256Digest;
  readonly toRevision: Sha256Digest;
}

export interface RuleModelMigrationDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-migration-v2";
  readonly sourcePublicationDigest: Sha256Digest;
  readonly targetModelDigest: Sha256Digest;
  readonly firstVerticalCandidateDigest: Sha256Digest;
  readonly fixtureSetDigest: Sha256Digest;
  readonly handlers: readonly RuleFamilyHandlerMigrationV2[];
}

declare const preparedRuleModelMigrationV2Brand: unique symbol;
export interface PreparedRuleModelMigrationV2 {
  readonly [preparedRuleModelMigrationV2Brand]: true;
}

export interface PrepareRuleModelMigrationInputV2 {
  readonly schemaVersion: 2;
  readonly sourceRecord: PublishedRuleFamilyRecord;
  readonly targetModel: RuleModelRegistryV2;
  readonly firstVerticalCandidate: FirstVerticalPublicationCandidateV2;
  readonly fixtureSet: EmbeddedCaseFixtureSetV2;
}

export type RuleModelMigrationValidationResultV2 =
  | {
      readonly ok: true;
      readonly migration: PreparedRuleModelMigrationV2;
      readonly document: RuleModelMigrationDocumentV2;
      readonly migrationDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code:
          | "rule-model.invalid-handler-migration"
          | "rule-model.invalid-first-vertical"
          | "rule-model.unauthenticated-fixture";
        readonly path: string;
        readonly message: string;
      }[];
    };

export function prepareRuleModelMigrationV2(
  input: PrepareRuleModelMigrationInputV2,
): RuleModelMigrationValidationResultV2;

export function validateRuleModelMigrationDocumentV2(
  sourceRecord: PublishedRuleFamilyRecord,
  input: unknown,
): RuleModelMigrationValidationResultV2;
```

Preparation derives `fromRevision` only from the authenticated passive v1 record and `toRevision`
only from the package-owned fresh current candidate catalog. The caller supplies neither revision
set. The raw-document validator exists for canonical replay and hostile-input tests, but accepts a
row only when both revisions equal those authorities.

The document contains all nine rows once in `RULE_FAMILY_HANDLER_IDS_V2` order. A five-row update,
authority-inconsistent mixed table, omission, duplicate, reordering, wildcard, identity
substitution or implicit carry forward returns `rule-model.invalid-handler-migration` at
`/handlers` or the first exact row path. A row with equal `fromRevision` and `toRevision` is valid
only when the authenticated source revision and independently package-derived current revision
genuinely agree; mixed or all-identity authoritative rows are therefore valid. The same inputs
produce byte-identical canonical bytes and digest. (AR-30)

## Parent v2 wire format

The v2 manifest has this exact lexical member population:

```ts
export const RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS = [
  "binding-rejections-v1.json",
  "bindings-v2.json",
  "compiler-readiness-v1.json",
  "diagnostic-oracle-v1.json",
  "embed-fixtures-v2.json",
  "first-vertical-v2.json",
  "migration-v2.json",
  "rule-model-seed-v1.json",
  "rule-models-v2-review.json",
  "rule-models-v2.json",
  "semantic-review-v2.json",
  "structured-execution-exemplar-v2.json",
] as const;

export interface RuleFamilyPublicationManifestV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-family-publication-v2";
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly members: readonly PublicationManifestMember[];
}

export interface RuleFamilyPublicationPointerV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-family-publication-pointer-v2";
  readonly publicationDigest: Sha256Digest;
}
```

The existing parent pointer path is reused. Parsers dispatch only on the exact `(schemaVersion,
kind)` pair; mixed v1/v2 fields reject. Stored v1 pointer, manifest and member bytes remain
byte-identical.

`compiler-readiness-v1.json` names the unchanged inventory wire schema, not predecessor bytes. The
v2 release owns a new canonical schema-v1 successor inventory produced by one shared deterministic
projection used by both `createFirstRuleModelRegistryV2` and parent assembly. The projection:

1. parses the authenticated predecessor inventory;
2. joins it to the closed `RULE_FAMILY_HANDLER_IDS_V2` catalog in exact catalog order;
3. rejects any retained declaration whose metadata does not exactly match the catalog;
4. adds only the catalog-owned `transform.semantic-relations` declaration when absent;
5. marks all nine declarations `bound` while preserving every other inventory field; and
6. schema-validates and canonically renders the result once.

The registry's `inventoryDigest` is the digest of those rendered successor bytes, never the
predecessor member digest. Parent preparation requires that digest to equal the digest of its
`compiler-readiness-v1.json` member, and the manifest authenticates the same digest. Executable
acquisition verifies this equality before invoking the unchanged strict
`validatePublishedBindings`; a mismatch fails closed. The predecessor release's inventory bytes,
manifest digest and interpretation remain byte-identical. (AR-18)

## Parent review, prepare and publish

```ts
declare const ruleFamilyPublicationReviewV2Brand: unique symbol;
export interface RuleFamilyPublicationReviewV2 {
  readonly [ruleFamilyPublicationReviewV2Brand]: true;
}

declare const preparedRuleFamilyPublicationV2Brand: unique symbol;
export interface PreparedRuleFamilyPublicationV2 {
  readonly [preparedRuleFamilyPublicationV2Brand]: true;
}

export interface PrepareRuleFamilyPublicationReviewInputV2 {
  readonly repositoryRoot: string;
  readonly migration: PreparedRuleModelMigrationV2;
}

export interface PreparedRuleFamilyPublicationReviewV2 {
  readonly review: RuleFamilyPublicationReviewV2;
  readonly request: PublicationSemanticReviewRequestV1;
  readonly requestBytes: Uint8Array;
}

export function prepareRuleFamilyPublicationReviewV2(
  input: PrepareRuleFamilyPublicationReviewInputV2,
): Promise<PublicationResult<PreparedRuleFamilyPublicationReviewV2>>;

export interface PrepareRuleFamilyPublicationInputV2 {
  readonly repositoryRoot: string;
  readonly migration: PreparedRuleModelMigrationV2;
  readonly semanticReviewBytes: Uint8Array;
}

export interface RuleFamilyPublicationPreviewV2 {
  readonly prepared: PreparedRuleFamilyPublicationV2;
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly stagedRecord: PublishedRuleFamilyRecord;
}

export function prepareRuleFamilyPublicationV2(
  input: PrepareRuleFamilyPublicationInputV2,
): Promise<PublicationResult<RuleFamilyPublicationPreviewV2>>;

export interface PublishedRuleFamilyTransactionV2 {
  readonly publicationDigest: Sha256Digest;
  readonly snapshot: PublishedRuleFamilySnapshotV2;
  readonly reusedExistingRelease: boolean;
}

export function publishRuleFamilyPublicationV2(
  prepared: PreparedRuleFamilyPublicationV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyTransactionV2>>;
```

Review binds every v2 member digest, the migration digest and the current compatible publication
implementation revision. Any family, case, handler, revision or implementation change returns
`publication.review.stale`. The preparation capability is one-use; reuse returns
`publication.capability.invalid`. Existing publication conformance fault points remain the only
fault-injection seam. Tests may import `runWithPublicationConformance` from
`publication-conformance-v1.ts`; no new production fault API is added.

Publishing promotes the immutable release before pointer commit, revalidates the staged record,
performs the existing compare-and-swap pointer operation, and resolves exact current authority.
Before/after rename failures preserve the old or complete new pointer; partial/mixed bytes never
resolve.

## Passive execution-child record

Historical child authentication is separate from executable-compatible child authority:

```ts
declare const publishedExecutionReleaseRecordV1Brand: unique symbol;
export interface PublishedExecutionReleaseRecordV1 {
  readonly [publishedExecutionReleaseRecordV1Brand]: true;
}

export interface ResolvePublishedExecutionReleaseRecordInputV1 {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
}

export interface PublishedExecutionReleaseRecordProjectionV1 {
  readonly schemaVersion: 1;
  readonly publicationDigest: Sha256Digest;
  readonly parentDigest: Sha256Digest;
  readonly bindingDigest: Sha256Digest;
  readonly semanticReviewDigest: Sha256Digest;
  readonly semanticReviewSpecRevision: string;
  readonly bindings: readonly ExecutionPublicationBindingV1[];
  readonly members: readonly {
    readonly path:
      | typeof EXECUTION_MANIFEST_V1_FILENAME
      | (typeof EXECUTION_PUBLICATION_MEMBER_FILENAMES)[number];
    readonly digest: Sha256Digest;
    readonly byteLength: number;
    readonly bytes: Uint8Array;
  }[];
}

export function resolvePublishedExecutionReleaseRecordByDigestV1(
  input: ResolvePublishedExecutionReleaseRecordInputV1,
): Promise<ExecutionOperationResultV1<PublishedExecutionReleaseRecordV1>>;

export function getPublishedExecutionReleaseRecordProjectionV1(
  record: PublishedExecutionReleaseRecordV1,
): ExecutionOperationResultV1<PublishedExecutionReleaseRecordProjectionV1>;
```

`execution-publication-record.ts` owns the opaque record, defensive projection and one shared
child-only validator. That validator authenticates the canonical repository root and digest, pinned
real release directory, exact four-name set, canonical manifest, domain-separated publication
digest, every member length/digest, binding/parent/review schemas and the internal parent/binding
joins. It never resolves or reads parent authority, pointers, inventory, declarations, installed
handlers or freshness. Projection member bytes are fresh copies. The closed path union includes
the manifest itself plus the three manifest-described members;
`EXECUTION_PUBLICATION_MEMBER_FILENAMES` remains unchanged because adding the manifest there would
alter existing wire validation and digest semantics. (AR-25)

Malformed inputs return `execution.invalid-schema`; missing/unsafe paths return `execution.io`;
release/member identity mismatches return `execution.identity`; stored parent or review/binding
disagreements return `execution.stale-authority` at `/parentDigest` or `/bindingDigest`; forged
record projection returns `execution.identity` at `/record`. Parent absence or executable staleness
is not a passive-record diagnostic.

The existing executable resolver consumes this package-private authenticated record state, then
performs its unchanged parent/spec/declaration/freshness checks and mints the existing live release
capability. The record is not exported through execution-publication internals, and passing it to
composite resolution fails `execution.identity`. (AR-24)

## Existing execution child and stale-pair recovery

No execution-child v2 schema is added. The existing `ExecutionParentReferenceV1.parentDigest`
already binds any authenticated parent digest without interpreting its wire version.

ST-26 uses the existing entries unchanged:

```ts
prepareExecutionPublicationCandidateV1(...)
resolvePublishedExecutionRelease(...)
selectExecutionPublicationByDigestV1(...)
resolveCompositeReadinessSnapshot(...)
getCompositeReadinessProjectionV1(...)
```

The additive passive-history entries are
`resolvePublishedExecutionReleaseRecordByDigestV1` and
`getPublishedExecutionReleaseRecordProjectionV1`. The existing
`resolvePublishedExecutionRelease` is documented as executable-compatible child authority; its
signature and behavior do not change.

After the v2 parent pointer is selected while the selected child still names the v1 parent,
`resolveCompositeReadinessSnapshot` returns `ok: false` with
`execution.stale-authority` at `/parentDigest`. Preparing and selecting an ordinary child v1 that
names the v2 parent digest restores an exact pair. Neither resolver falls back to the prior pair,
and no combined parent/child transaction is introduced.

Historical child v1 bytes and passive named record resolution remain unchanged. Historical child
records never imply parent executability or composite authority.

## Identity-only optimizer consumer

```ts
export interface OptimizerConsumerProjectionV2 {
  readonly schemaVersion: 2;
  readonly kind: "optimizer-consumer-projection-v2";
  readonly parentPublicationDigest: Sha256Digest;
  readonly executionPublicationDigest: Sha256Digest;
  readonly ruleId: RuleId;
  readonly caseId: "case.structured.vertical-combined-v1";
  readonly caseDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly sourceDigest: Sha256Digest;
  readonly expectationBytes: Uint8Array;
  readonly oracleEvaluationIdentity: Sha256Digest;
  readonly envelopeBytes: Uint8Array;
  readonly envelopeDigest: Sha256Digest;
}

export function getOptimizerConsumerProjectionV2(
  composite: CompositeReadinessSnapshot,
): ExecutionOperationResultV1<OptimizerConsumerProjectionV2>;
```

The function accepts only a genuine exact composite pair. It reads the authenticated
`structured-execution-exemplar-v2.json` member and returns fresh copies of its published combined
case source, independent expectation and unchanged v1 execution-envelope bytes. Its `ruleId` is
`FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID`; digests match the v2 parent member, child identity and
structured registry identities. It never re-renders or re-evaluates a current registry case.

The exact key set above is closed. There is no byte count, cycle count, threshold, measured value,
profitability flag, parity result, optimizer result or cost digest. `scanReadinessCompilerBoundary`
proves production compiler/codegen modules import no readiness package; the consumer fixture lives
only in readiness tests/production provider code.

## New diagnostic additions

The new parent surface adds only:

```ts
type RuleFamilyPublicationDiagnosticCodeV2 =
  | "publication.version.unsupported"
  | "publication.record.invalid"
  | "publication.implementation-unavailable"
  | "publication.migration.invalid"
  | "publication.fixture.invalid";
```

Existing publication review, stale, collision, capability, commit-indeterminate, path, digest,
I/O and execution diagnostics are reused. No `latest`, `compatible-enough`, current-substitution or
mixed-pair success exists.
