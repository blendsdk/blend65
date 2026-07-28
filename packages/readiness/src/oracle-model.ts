import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import type { NeighborId, RuleId, Sha256Digest } from "./model-registry-model.js";
import type { ReplayEnvelopeV1 } from "./replay-input.js";
import type { RevisionRegistry } from "./revision-registry.js";

/** Stable identifiers for the four raw oracle entry points. */
export type OracleHandlerIdV1 =
  | "oracle.frontend-result"
  | "oracle.compiler-result"
  | "oracle.emitted-program"
  | "oracle.runtime-state";

/** Stable engine failure categories returned by oracle APIs. */
export type OracleDiagnosticCode =
  | "oracle.input.invalid"
  | "oracle.input.limit"
  | "oracle.authority.missing"
  | "oracle.authority.stale"
  | "oracle.authority.not-accepted"
  | "oracle.route.invalid"
  | "oracle.contract.invalid"
  | "oracle.budget"
  | "oracle.identity.collision"
  | "oracle.relation.invalid"
  | "oracle.relation.violated";

/** One bounded, non-sensitive failure returned instead of throwing. */
export interface OracleDiagnostic {
  /** Stable machine-readable failure category. */
  readonly code: OracleDiagnosticCode;
  /** RFC 6901 pointer to the rejected value. */
  readonly path: string;
  /** Bounded human-readable explanation. */
  readonly message: string;
}

/** Closed hard maxima applied before oracle data is retained or evaluated. */
export interface OracleLimitsV1 {
  /** Maximum byte length of one authority JSON artifact. */
  readonly authorityBytes: number;
  /** Maximum number of records accepted by either authority parser. */
  readonly authorityRecords: number;
  /** Maximum UTF-8 byte length of an identifier-like string. */
  readonly identifierBytes: number;
  /** Maximum aggregate nodes in one hostile programmatic input. */
  readonly inputNodes: number;
  /** Maximum aggregate UTF-8 bytes across keys, strings and canonical decimal BigInts. */
  readonly inputBytes: number;
  /** Maximum magnitude digits in one canonical decimal BigInt value. */
  readonly bigintDecimalDigits: number;
  /** Maximum nesting depth in one hostile programmatic input. */
  readonly inputDepth: number;
  /** Maximum initialized cells in one memory fixture. */
  readonly memoryCells: bigint;
  /** Maximum value permitted for any caller-selected execution counter. */
  readonly executionEvents: bigint;
}

/**
 * Fixed resource limits for version-one oracle inputs.
 *
 * @example
 * ```ts
 * if (bytes.byteLength > ORACLE_V1_LIMITS.authorityBytes) return;
 * ```
 */
export const ORACLE_V1_LIMITS: OracleLimitsV1 = Object.freeze({
  authorityBytes: 1_048_576,
  authorityRecords: 64,
  identifierBytes: 512,
  inputNodes: 262_144,
  inputBytes: 8_388_608,
  bigintDecimalDigits: 4_096,
  inputDepth: 1_024,
  memoryCells: 65_536n,
  executionEvents: 4_294_967_295n,
});

/** Compiler phase owned by a reviewed diagnostic observation. */
export type DiagnosticOraclePhaseV1 = "lexer" | "parser" | "semantic";

/** Source construct that distinguishes one qualified diagnostic authority row. */
export type DiagnosticContextV1 =
  | "initializer"
  | "assignment"
  | "return-expression"
  | "intrinsic-argument";

/** One independently authored compiler-diagnostic authority record. */
export interface DiagnosticOracleRecordV1 {
  /** Modeled inventory rule rejected by the compiler. */
  readonly ruleId: RuleId;
  /** Exact invalid neighbor that creates the rejection. */
  readonly neighborId: NeighborId;
  /** Source construct qualifier when one rule/neighbor pair owns multiple diagnostics. */
  readonly diagnosticContext?: DiagnosticContextV1;
  /** Stable compiler diagnostic code. */
  readonly diagnosticCode: string;
  /** Compiler phase that owns the diagnostic. */
  readonly phase: DiagnosticOraclePhaseV1;
  /** Closed diagnostic severity. */
  readonly severity: "error";
  /** Exact observable fields compared by downstream evidence. */
  readonly observableFields: readonly ["code", "phase", "severity"];
}

/** Closed version-one compiler-diagnostic authority manifest. */
export interface DiagnosticOracleManifestV1 {
  /** Supported manifest schema version. */
  readonly schemaVersion: 1;
  /** Version of the authored diagnostic facts. */
  readonly manifestVersion: "1.0.0";
  /** Frozen language-specification revision used by the facts. */
  readonly specRevision: Sha256Digest;
  /** Closed parser and join policy revision. */
  readonly policyRevision: "diagnostic-oracle-policy-v1";
  /** Lexically ordered reviewed diagnostic records. */
  readonly records: readonly DiagnosticOracleRecordV1[];
}

/** External parameter-value rejection category. */
export type BindingRejectionCodeV1 = "binding.value.type-invalid" | "binding.value.range-invalid";

/** One independently authored external parameter-binding rejection. */
export interface BindingRejectionRecordV1 {
  /** Modeled inventory rule whose parameter value is rejected. */
  readonly ruleId: RuleId;
  /** Exact invalid neighbor represented by the value. */
  readonly neighborId: NeighborId;
  /** Closed external spelling owned by this authority. */
  readonly spelling: "parameter";
  /** Stable rejection family for the external value. */
  readonly rejectionCode: BindingRejectionCodeV1;
}

/** Closed version-one external parameter-binding authority manifest. */
export interface BindingRejectionManifestV1 {
  /** Supported manifest schema version. */
  readonly schemaVersion: 1;
  /** Version of the authored binding facts. */
  readonly manifestVersion: "1.0.0";
  /** Closed parser and join policy revision. */
  readonly policyRevision: "binding-rejection-policy-v1";
  /** Lexically ordered reviewed binding records. */
  readonly records: readonly BindingRejectionRecordV1[];
}

/** Result of parsing and closing compiler-diagnostic authority bytes. */
export type DiagnosticOracleManifestParseResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Deeply immutable parsed manifest. */
      readonly manifest: DiagnosticOracleManifestV1;
      /** Digest of the exact supplied bytes. */
      readonly digest: Sha256Digest;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded parser diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Result of parsing and closing external binding-rejection authority bytes. */
export type BindingRejectionManifestParseResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Deeply immutable parsed manifest. */
      readonly manifest: BindingRejectionManifestV1;
      /** Digest of the exact supplied bytes. */
      readonly digest: Sha256Digest;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded parser diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Exact replay provenance reused without introducing a second identity format. */
export type Rd02ReplayProvenanceV1 = ReplayEnvelopeV1;

/** One initialized byte cell supplied to the reference memory model. */
export interface MemoryCellV1 {
  /** Absolute 16-bit address. */
  readonly address: bigint;
  /** Initialized byte value. */
  readonly value: bigint;
}

/** Closed initial memory fixture with no implicit zero-filled cells. */
export interface MemoryFixtureV1 {
  /** Supported memory fixture schema version. */
  readonly schemaVersion: 1;
  /** Unique cells ordered by ascending address. */
  readonly cells: readonly MemoryCellV1[];
}

/** Caller-selected limits for one bounded oracle evaluation. */
export interface OracleBudgetV1 {
  /** Maximum nodes admitted from the request. */
  readonly inputNodes: bigint;
  /** Maximum expression nesting depth. */
  readonly expressionDepth: bigint;
  /** Maximum evaluation events. */
  readonly evaluationSteps: bigint;
  /** Maximum function-entry frames. */
  readonly frames: bigint;
  /** Maximum initialized memory cells. */
  readonly memoryCells: bigint;
  /** Maximum recorded memory effects. */
  readonly effects: bigint;
  /** Maximum nodes in a transformed case. */
  readonly transformedNodes: bigint;
}

/** Typed scalar value produced by the independent evaluator. */
export type OracleValueV1 =
  | {
      /** Integer discriminator. */
      readonly kind: "integer";
      /** Exact integer type controlling normalization. */
      readonly type: "byte" | "sbyte" | "word" | "sword";
      /** Canonical value in the declared type's range. */
      readonly value: bigint;
    }
  | {
      /** Boolean discriminator. */
      readonly kind: "boolean";
      /** Closed boolean type marker. */
      readonly type: "boolean";
      /** Boolean semantic value. */
      readonly value: boolean;
    };

/** One ordered logical memory access observed during evaluation. */
export type MemoryEffectV1 =
  | {
      /** Zero-based logical effect order. */
      readonly ordinal: bigint;
      /** Read discriminator. */
      readonly kind: "read";
      /** Byte width of the completed access. */
      readonly width: 1 | 2;
      /** First address accessed. */
      readonly address: bigint;
      /** Complete little-endian value read. */
      readonly value: bigint;
    }
  | {
      /** Zero-based logical effect order. */
      readonly ordinal: bigint;
      /** Write discriminator. */
      readonly kind: "write";
      /** Byte width of the completed access. */
      readonly width: 1 | 2;
      /** First address accessed. */
      readonly address: bigint;
      /** Complete little-endian value written. */
      readonly value: bigint;
    };

/** Reviewed compiler-diagnostic observation for invalid source. */
export interface DiagnosticObservationV1 {
  /** Observation discriminator. */
  readonly kind: "diagnostic";
  /** Modeled rule that owns the rejection. */
  readonly ruleId: RuleId;
  /** Exact invalid neighbor that was generated. */
  readonly neighborId: NeighborId;
  /** Stable compiler diagnostic code. */
  readonly code: string;
  /** Compiler phase that owns the diagnostic. */
  readonly phase: DiagnosticOraclePhaseV1;
  /** Closed severity. */
  readonly severity: "error";
}

/** Reviewed rejection observation for an external parameter value. */
export interface BindingRejectionObservationV1 extends BindingRejectionRecordV1 {
  /** Observation discriminator distinct from compiler diagnostics. */
  readonly kind: "binding-rejection";
}

/** Complete evaluator-owned value, effect, and final-memory projection. */
export interface ValueStateObservationV1 {
  /** Observation discriminator. */
  readonly kind: "value-state";
  /** Typed return value, or null for a void entry function. */
  readonly returnValue: OracleValueV1 | null;
  /** Ordered completed logical memory effects. */
  readonly effects: readonly MemoryEffectV1[];
  /** Complete initialized memory state ordered by address. */
  readonly finalMemory: readonly MemoryCellV1[];
}

/** Closed observations that can establish an expected oracle result. */
export type OracleObservationV1 =
  | DiagnosticObservationV1
  | BindingRejectionObservationV1
  | ValueStateObservationV1;

/** Closed semantic-relation identities reserved by the transform declaration. */
export type SemanticRelationId =
  | "relation.identifier-renaming"
  | "relation.literal-to-local"
  | "relation.local-to-parameter"
  | "relation.algebraic-identity"
  | "relation.independent-declaration-reordering";

/** Stable reasons why a structurally valid request has no modeled oracle answer. */
export type OracleUnmodeledReason =
  | "rule-unavailable"
  | "route-unavailable"
  | "unsupported-observable"
  | "unsupported-semantics"
  | "evaluator-unavailable"
  | "blocked-errata-division-by-zero";

/** Closed raw result returned by source-authoring oracle entry points. */
export type OracleResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Modeled observation discriminator. */
      readonly outcome: "modeled";
      /** Exact independently derived observation. */
      readonly observation: OracleObservationV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Explicit unsupported-result discriminator. */
      readonly outcome: "oracle-unmodeled";
      /** Closed reason for the unsupported result. */
      readonly reason: OracleUnmodeledReason;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Explicit false-precondition discriminator. */
      readonly outcome: "relation-inapplicable";
      /** Relation whose precondition was false. */
      readonly relationId: SemanticRelationId;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded engine diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Exact projection category used when inspecting an oracle route. */
export type OracleProjectionKindV1 =
  | "valid"
  | "invalid-source-transform"
  | "invalid-parameter-binding";

/** Closed observable request accepted by raw oracle entry points. */
export type OracleObservableV1 = { readonly kind: "diagnostic" } | { readonly kind: "value-state" };

/** Complete raw request for one independently replayed generated case. */
export interface OracleRequestV1 {
  /** Supported request schema version. */
  readonly schemaVersion: 1;
  /** Exact raw façade requested by the caller. */
  readonly handlerId: OracleHandlerIdV1;
  /** Primary reviewed rule claimed by the case. */
  readonly ruleId: RuleId;
  /** Complete identity-verified replay provenance. */
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  /** Exact generated modeled case named by the provenance. */
  readonly case: GeneratedModeledCase;
  /** Lexically exact function entry name. */
  readonly entryFunction: string;
  /** Initial explicit memory contents. */
  readonly memory: MemoryFixtureV1;
  /** Bounded evaluation limits. */
  readonly budget: OracleBudgetV1;
  /** Requested observable projection. */
  readonly observable: OracleObservableV1;
}

/** Closed query used to inspect one rule-to-oracle route. */
export interface OracleRouteQueryV1 {
  /** Exact raw façade being inspected. */
  readonly handlerId: OracleHandlerIdV1;
  /** Reviewed rule identity being inspected. */
  readonly ruleId: RuleId;
  /** Observable requested from the façade. */
  readonly observable: OracleObservableV1;
  /** Case projection category selecting any reviewed authority. */
  readonly projectionKind: OracleProjectionKindV1;
}

/** Result of exact route resolution without aliasing or fallback. */
export type OracleRouteResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Routed-result discriminator. */
      readonly outcome: "routed";
      /** Exact reviewed rule identity. */
      readonly ruleId: RuleId;
      /** Exact owning raw façade. */
      readonly handlerId: OracleHandlerIdV1;
      /** Exact observable kind. */
      readonly observable: OracleObservableV1["kind"];
      /** Reviewed authority required by this projection. */
      readonly authority: "none" | "diagnostic-manifest" | "binding-rejections";
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Explicit unavailable-route discriminator. */
      readonly outcome: "oracle-unmodeled";
      /** Closed reason for the unavailable route. */
      readonly reason: OracleUnmodeledReason;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded query diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/**
 * Package-private runtime marker paired with module-private suite membership.
 *
 * This value is intentionally not re-exported from the package entry point.
 */
export const ORACLE_SUITE_CAPABILITY: unique symbol = Symbol("oracle-suite");

/** Opaque source-authoring capability produced only after exact authority joins. */
export interface OracleSuite {
  /** Compile-time nominal marker paired with module-private runtime membership. */
  readonly [ORACLE_SUITE_CAPABILITY]: true;
}

/** Raw inputs required to construct one source-authoring oracle suite. */
export interface OracleSuiteInput {
  /** Independently reviewed modeled generator capability. */
  readonly modeledSuite: ModeledGeneratorSuite;
  /** Exact six-component replay revision registry. */
  readonly replayRegistry: RevisionRegistry;
  /** Validated inventory authority supplying rule routes and specification revision. */
  readonly inventory: unknown;
  /** Raw compiler-diagnostic authority bytes. */
  readonly diagnosticManifestBytes: Uint8Array;
  /** Raw external binding-rejection authority bytes. */
  readonly bindingRejectionBytes: Uint8Array;
}

/** Result of joining modeled facts, replay dependencies, and both authorities. */
export type OracleSuiteResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Opaque source-authoring suite. */
      readonly suite: OracleSuite;
      /** Digests of both independently reviewable authority artifacts. */
      readonly authorityDigests: {
        /** Compiler-diagnostic manifest digest. */
        readonly diagnosticManifest: Sha256Digest;
        /** External binding-rejection manifest digest. */
        readonly bindingRejections: Sha256Digest;
      };
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded construction diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

declare const publishedOracleContextBrand: unique symbol;

/** Opaque resolver-owned authority for one selected published snapshot. */
export interface PublishedOracleContext {
  /** Compile-time nominal marker whose runtime authority remains resolver-private. */
  readonly [publishedOracleContextBrand]: true;
  /** Digest of the exact selected release supplying all participant revisions. */
  readonly selectedReleaseDigest: Sha256Digest;
}

/** Revision-complete authoritative evidence around one raw oracle result. */
export interface PublishedOracleEvidenceV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Raw closed oracle result produced under the selected snapshot. */
  readonly result: OracleResultV1;
  /** Identity binding provenance, content, policy, and selected revisions. */
  readonly evaluationIdentity: Sha256Digest;
  /** Exact verified source replay provenance. */
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  /** Role-separated source and optional transformed content identities. */
  readonly contentIdentities: {
    /** Verified source content identity. */
    readonly source: Sha256Digest;
    /** Revalidated transformed content identity when a relation rewrites the case. */
    readonly transformed?: Sha256Digest;
  };
}

/** Closed selected-evaluation result without any caller-supplied authority. */
export type PublishedOracleEvaluationResultV1 =
  | PublishedOracleEvidenceV1
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded selected-evaluation diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/**
 * Passive callable type for resolver-owned selected evaluation.
 *
 * @example
 * ```ts
 * declare const evaluate: PublishedOracleEvaluator;
 * const result = evaluate(context, request);
 * ```
 */
export type PublishedOracleEvaluator = (
  context: PublishedOracleContext,
  request: unknown,
) => PublishedOracleEvaluationResultV1;
