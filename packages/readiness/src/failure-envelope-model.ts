import type { ExecutionCaseV1 } from "./execution-case.js";
import type { FailurePredicateV1 } from "./failure-identity.js";
import type { FailureReductionPolicyV1 } from "./failure-contracts.js";
import type { GenModule } from "./generator-ir.js";
import type {
  MalformedDiagnosticCaseV1,
  MalformedReplayEnvelopeV1,
  MalformedTokenSpanV1,
} from "./malformed-diagnostic-case.js";
import type {
  GeneratedCaseProjection,
  InvalidSourceTransform,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { PublishedDiagnosticCaseV1 } from "./published-diagnostic-case.js";
import type { ReplayEnvelopeV1 } from "./replay-input-model.js";

/** Maximum canonical envelope or individual historical authority bytes. */
export const FAILURE_ENVELOPE_MAX_BYTES_V1 = 67_108_864;

/** Maximum combined exact historical bytes retained by one resolver. */
export const FAILURE_HISTORICAL_AUTHORITY_AGGREGATE_MAX_BYTES_V1 = 134_217_728;

/** One required or incidental semantic claim and its unique candidate witness. */
export interface FailureClaimWitnessV1 {
  /** Reviewed rule whose evidence remains live. */
  readonly ruleId: string;
  /** Canonical pointer into the candidate family model. */
  readonly path: string;
}

/** Initial family data derived only from a genuine source authority. */
export type FailureEnvelopeInitialCandidateV1 =
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "typed-valid";
      readonly sourceBytes: Uint8Array;
      readonly module: GenModule;
      readonly parameterBindings: readonly ParameterValueBinding[];
      readonly primaryRuleId: string;
      readonly claimedRuleIds: readonly string[];
      readonly claimWitnesses: readonly FailureClaimWitnessV1[];
    }
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "typed-invalid";
      readonly sourceBytes: Uint8Array;
      readonly baseline: GenModule;
      readonly transform: InvalidSourceTransform;
      readonly parameterBindings: readonly ParameterValueBinding[];
      readonly primaryRuleId: string;
      readonly claimedRuleIds: readonly string[];
      readonly claimWitnesses: readonly FailureClaimWitnessV1[];
      readonly neighborId: string;
      readonly violatedPredicateId: string;
      readonly diagnosticFamily: string;
    }
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "raw-malformed";
      readonly sourceBytes: Uint8Array;
      readonly tokens: readonly MalformedTokenSpanV1[];
    };

/** Closed tool identity retained by historical failure replay. */
export interface FailureToolIdentityV1 {
  /** Closed tool role. */
  readonly kind: "compiler" | "assembler" | "emulator";
  /** Bounded stable tool name. */
  readonly name: string;
  /** Bounded stable version. */
  readonly version: string;
  /** Digest of the complete tool contract. */
  readonly digest: Sha256Digest;
}

/** Passive typed or raw replay authority retained in a failure envelope. */
export type FailureReplayAuthorityV1 =
  | {
      readonly kind: "typed-campaign";
      readonly envelope: ReplayEnvelopeV1;
      readonly generatedProjection: GeneratedCaseProjection;
      readonly sourceBytes: Uint8Array;
    }
  | { readonly kind: "raw-malformed"; readonly envelope: MalformedReplayEnvelopeV1 };

/** Canonical passive failure envelope returned only from opaque authority. */
export interface FailureEnvelopeV1 {
  /** Closed envelope schema. */
  readonly revision: "failure-envelope-v1";
  /** Reduction family derived from genuine source authority. */
  readonly family: "typed-valid" | "typed-invalid" | "raw-malformed";
  /** Complete replay data. */
  readonly replay: FailureReplayAuthorityV1;
  /** Exact original route plan bytes. */
  readonly routePlanBytes: Uint8Array;
  /** Verified digest of route plan bytes. */
  readonly routePlanDigest: Sha256Digest;
  /** Immutable failure predicate. */
  readonly predicate: FailurePredicateV1;
  /** Policy selected once before reduction. */
  readonly policy: FailureReductionPolicyV1;
  /** Canonical observation bytes. */
  readonly observationBytes: Uint8Array;
  /** Complete bounded tool contract list. */
  readonly toolVersions: readonly FailureToolIdentityV1[];
  /** Initial family candidate reconstructed from exact replay authority. */
  readonly initialCandidate: FailureEnvelopeInitialCandidateV1;
  /** Ordered historical records required to resolve this envelope. */
  readonly authorityDigests: readonly Sha256Digest[];
  /** Digest of every preceding envelope field. */
  readonly digest: Sha256Digest;
}

/** Source capability accepted by envelope authorization. */
export type FailureEnvelopeSourceAuthorityV1 =
  | { readonly kind: "typed-valid"; readonly authority: ExecutionCaseV1 }
  | { readonly kind: "typed-invalid"; readonly authority: PublishedDiagnosticCaseV1 }
  | { readonly kind: "raw-malformed"; readonly authority: MalformedDiagnosticCaseV1 };

/** Closed input accepted by the failure-envelope authority factory. */
export interface FailureEnvelopeAuthorizationInputV1 {
  /** Closed authorization-input schema. */
  readonly revision: "failure-envelope-authorization-input-v1";
  /** Genuine typed-valid, typed-invalid, or raw-malformed source authority. */
  readonly source: FailureEnvelopeSourceAuthorityV1;
  /** Exact original route-plan bytes. */
  readonly routePlanBytes: Uint8Array;
  /** Verified digest of the route-plan bytes. */
  readonly routePlanDigest: Sha256Digest;
  /** Immutable failure predicate joined to the source family. */
  readonly predicate: FailurePredicateV1;
  /** Reduction policy selected once for the envelope. */
  readonly policy: FailureReductionPolicyV1;
  /** Canonical original observation bytes. */
  readonly observationBytes: Uint8Array;
  /** Complete bounded compiler, assembler, and emulator identities. */
  readonly toolVersions: readonly FailureToolIdentityV1[];
}

/** Canonical content-addressed historical authority record. */
export interface FailureHistoricalAuthorityRecordV1 {
  /** Closed record schema. */
  readonly revision: "failure-historical-authority-record-v1";
  /** Semantic authority role. */
  readonly kind:
    | "inventory"
    | "rule-model"
    | "campaign"
    | "generator"
    | "boundary-transform"
    | "renderer"
    | "oracle"
    | "diagnostic"
    | "execution-publication"
    | "projection"
    | "fixture"
    | "platform"
    | "tool";
  /** Bounded version or selected revision. */
  readonly contentRevision: string;
  /** Canonical exact authority bytes. */
  readonly bytes: Uint8Array;
  /** Digest of `bytes`. */
  readonly digest: Sha256Digest;
}

/** Runtime brand for a canonical failure envelope. */
export const AUTHORIZED_FAILURE_ENVELOPE_V1: unique symbol = Symbol(
  "authorized-failure-envelope-v1",
);

/** Opaque structurally and historically authorized failure envelope. */
export interface AuthorizedFailureEnvelopeV1 {
  /** Compile-time marker paired with module-private canonical state. */
  readonly [AUTHORIZED_FAILURE_ENVELOPE_V1]: true;
}

/** Runtime brand for one bounded immutable historical record resolver. */
export const FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1: unique symbol = Symbol(
  "failure-historical-authority-resolver-v1",
);

/** Opaque exact-content resolver with no callback or ambient fallback. */
export interface FailureHistoricalAuthorityResolverV1 {
  /** Compile-time marker paired with a module-private record map. */
  readonly [FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1]: true;
}

/** Closed resolution result that never fabricates an unavailable envelope. */
export type FailureEnvelopeResolutionV1 =
  | {
      readonly outcome: "resolved";
      readonly envelope: AuthorizedFailureEnvelopeV1;
      readonly missingAuthorityDigests: readonly [];
    }
  | {
      readonly outcome: "historical-authority-unavailable";
      readonly missingAuthorityDigests: readonly Sha256Digest[];
    };
