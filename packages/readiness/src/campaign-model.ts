import type { GenerationConfiguration } from "./canonical-identity.js";
import type { FreshCandidateRegistration } from "./binding-model.js";
import type { CampaignIdentityInput, CaseIdentity } from "./case-identity.js";
import type { GenerationUsage } from "./generator-ir.js";
import type {
  BoundaryVariantsHandlerV1,
  GeneratedModeledCase,
  GeneratorHandlerV1,
  ModeledCaseRequest,
  ModeledGeneratorSuite,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type {
  RoundTripDiagnostic,
  RoundTripModule,
  SourceRenderOptions,
} from "./roundtrip-model.js";

/** Generator routes that can own one prepared campaign. */
export type CampaignGeneratorId =
  | "generator.frontend-cases"
  | "generator.compiler-cases"
  | "generator.runtime-cases";

/** Exact inventory authority retained by a prepared campaign. */
export interface CampaignInventoryAuthorityV1 {
  readonly schemaVersion: 1;
  readonly inventoryVersion: string;
  readonly inventoryDigest: Sha256Digest;
  readonly specRevision: string;
}

/** Exact reviewed rule-model authority retained by a prepared campaign. */
export interface CampaignRuleModelAuthorityV1 {
  readonly schemaVersion: 1;
  readonly ruleModelVersion: string;
  readonly ruleModelDigest: Sha256Digest;
  readonly suite: ModeledGeneratorSuite;
}

/** One exact modeled generator implementation. */
export interface CampaignGeneratorBindingV1 {
  readonly handlerId: CampaignGeneratorId;
  readonly contractVersion: "1.0.0";
  readonly implementationRevision: Sha256Digest;
  readonly implementation: GeneratorHandlerV1;
}

/** Exact boundary-family implementation used while preparing coverage. */
export interface CampaignBoundaryBindingV1 {
  readonly handlerId: "transform.boundary-variants";
  readonly contractVersion: "1.0.0";
  readonly implementationRevision: Sha256Digest;
  readonly implementation: BoundaryVariantsHandlerV1;
}

/** How a generated case was independently rendered and parsed. */
export type CaseRenderRoundTripKind =
  | "valid"
  | "invalid-source-transform"
  | "invalid-parameter-binding";

/** Successful source rendering with independent structural evidence. */
export interface CaseRenderSuccess {
  readonly ok: true;
  readonly kind: CaseRenderRoundTripKind;
  readonly source: string;
  readonly sourceBytes: Uint8Array;
  readonly projection: RoundTripModule;
  readonly effectiveParameterBindings: readonly ParameterValueBinding[];
  readonly diagnostics: readonly [];
}

/** Closed result of rendering one modeled case. */
export type CaseRenderResult =
  | CaseRenderSuccess
  | { readonly ok: false; readonly diagnostics: readonly RoundTripDiagnostic[] };

/** Version-one generated-case renderer callable. */
export type CaseRendererV1 = (
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
) => CaseRenderResult;

/** Exact generated-case renderer revision. */
export interface CampaignRendererBindingV1 {
  readonly implementationRevision: Sha256Digest;
  readonly implementation: CaseRendererV1;
}

/** Complete campaign-wide dependencies validated during preparation. */
export interface CampaignDependenciesV1 {
  readonly inventory: CampaignInventoryAuthorityV1;
  readonly ruleModel: CampaignRuleModelAuthorityV1;
  readonly generator: FreshCandidateRegistration;
  readonly boundaryTransform: FreshCandidateRegistration;
  readonly renderer: CampaignRendererBindingV1;
}

/** Immutable campaign totals and parent identity. */
export interface CampaignPlanSummary {
  readonly schemaVersion: 1;
  readonly campaignDigest: Sha256Digest;
  readonly totalCaseCount: number;
  readonly validCaseCount: number;
  readonly invalidCaseCount: number;
}

/** Public marker paired with module-private prepared-campaign state. */
export const PREPARED_CAMPAIGN_CAPABILITY: unique symbol = Symbol("prepared-campaign");

/** Opaque immutable random-access campaign. */
export interface PreparedCampaign {
  readonly [PREPARED_CAMPAIGN_CAPABILITY]: true;
  readonly summary: CampaignPlanSummary;
}

/** Public marker paired with module-private collision-index state. */
export const CAMPAIGN_COLLISION_INDEX_CAPABILITY: unique symbol = Symbol(
  "campaign-collision-index",
);

/** Opaque single-use collision proof bound to one campaign digest. */
export interface CampaignCollisionIndex {
  readonly [CAMPAIGN_COLLISION_INDEX_CAPABILITY]: true;
}

/** Stable numeric path lane assigned to one plan item. */
export type CampaignPlanLane = "coverage-valid" | "random-valid" | "invalid";

/** Complete deterministic request metadata for one ordinal. */
export interface CampaignPlanItem {
  readonly ordinal: number;
  readonly generationPath: readonly [lane: 0 | 1 | 2, laneOrdinal: number];
  readonly lane: CampaignPlanLane;
  readonly request: ModeledCaseRequest;
  readonly renderOptions: SourceRenderOptions;
}

/** Final independently rendered case and all replayable evidence. */
export interface GeneratedCase {
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

/** Stable campaign preparation or generation failure. */
export interface CampaignDiagnostic {
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

/** Closed success-or-diagnostics result used by campaign APIs. */
export type CampaignResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly CampaignDiagnostic[] };

/** Input for preparing one immutable campaign. */
export interface CreateCampaignPlanInput {
  readonly campaign: CampaignIdentityInput;
  readonly configuration: GenerationConfiguration;
  readonly dependencies: CampaignDependenciesV1;
  readonly collisionIndex?: CampaignCollisionIndex;
}
