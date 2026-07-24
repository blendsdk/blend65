/** Canonical SHA-256 digest spelling used by readiness artifacts. */
export type Sha256Digest = `sha256:${string}`;

/** Stable identity of one inventoried specification rule. */
export type RuleId = string;

/** Closed reason retained when a rule cannot contribute generated coverage. */
export type RuleModelReason =
  | "outside-initial-slice"
  | "requires-semantic-oracle"
  | "not-source-generatable";

/** Closed scalar domain understood by the rule-model wire format. */
export type RuleModelScalarType = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

/** Closed source spelling families available to modeled rule constructors. */
export type SpellingKind = "literal" | "named-constant" | "local-variable" | "parameter";

/** Stable identity of a modeled constructor operation. */
export type ConstructorId = string;

/** Stable identity of a modeled predicate operation. */
export type PredicateId = string;

/** Stable identity of an invalid-neighbor operation. */
export type NeighborId = string;

/** Stable identity of a boundary-family operation. */
export type BoundaryFamilyId = string;

/** Source content that supports one modeled semantic fact. */
export interface ModelCitation {
  readonly sourcePath: string;
  readonly contentHash: Sha256Digest;
}

/** Closed construction condition that must hold before a modeled case is valid. */
export interface ConstructionPrecondition {
  readonly kind: "type-in" | "value-range" | "arity" | "spelling-in";
  readonly subject: string;
  readonly values: readonly string[];
}

/** Typed value domain attached to one modeled subject. */
export interface TypedDomain {
  readonly subject: string;
  readonly type: RuleModelScalarType;
  readonly values: readonly string[];
}

/** Invalid contract and the operations that create its nearest invalid cases. */
export interface InvalidContract {
  readonly contractId: string;
  readonly diagnosticFamily: string;
  readonly neighborIds: readonly NeighborId[];
}

/** Complete reviewable facts and executable-operation references for one modeled rule. */
export interface ModeledRuleRecord {
  readonly ruleId: RuleId;
  readonly state: "modeled";
  readonly citations: readonly ModelCitation[];
  readonly constructionPreconditions: readonly ConstructionPrecondition[];
  readonly typedDomains: readonly TypedDomain[];
  readonly invalidContracts: readonly InvalidContract[];
  readonly constructorIds: readonly ConstructorId[];
  readonly predicateIds: readonly PredicateId[];
  readonly neighborIds: readonly NeighborId[];
  readonly boundaryFamilyIds: readonly BoundaryFamilyId[];
  readonly spellings: readonly SpellingKind[];
}

/** Explicit coverage state for an inventory rule outside the modeled population. */
export interface NonModeledRuleRecord {
  readonly ruleId: RuleId;
  readonly state: "unmodeled" | "not-generatable";
  readonly reason: RuleModelReason;
}

/** One closed entry in the canonical rule-model registry. */
export type RuleModelEntryInput = ModeledRuleRecord | NonModeledRuleRecord;

/** Closed version-one JSON envelope for canonical rule-model facts. */
export interface RuleModelRegistryInput {
  readonly schemaVersion: 1;
  readonly registryVersion: string;
  readonly rules: readonly RuleModelEntryInput[];
}

/** Immutable validated rule-model registry with direct rule lookup. */
export interface RuleModelRegistry extends RuleModelRegistryInput {
  readonly get: (ruleId: RuleId) => RuleModelEntryInput | undefined;
  readonly has: (ruleId: RuleId) => boolean;
}

/** Exact population counts returned with a validated registry. */
export interface RuleModelStateCounts {
  readonly modeled: number;
  readonly unmodeled: number;
  readonly "not-generatable": number;
}

/** Stable diagnostic codes emitted by model and binding validation. */
export type ModelBindingDiagnosticCode =
  | "model.input.invalid-json"
  | "model.input.invalid-utf8"
  | "model.input.limit"
  | "model.schema.invalid"
  | "model.rule.missing"
  | "model.rule.duplicate"
  | "model.rule.unknown"
  | "model.modeled.incomplete"
  | "model.operation.unknown"
  | "binding.declaration.missing"
  | "binding.declaration.duplicate"
  | "binding.entry.duplicate"
  | "binding.entry.kind"
  | "binding.entry.contract"
  | "binding.entry.revision"
  | "binding.candidate.state"
  | "binding.published.state"
  | "binding.published.missing";

/** Stable machine-readable failure from rule-model or binding validation. */
export interface ModelBindingDiagnostic {
  readonly code: ModelBindingDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

/** Result of parsing bounded canonical rule-model JSON bytes. */
export type RuleModelRegistryParseResult =
  | {
      readonly ok: true;
      readonly input: RuleModelRegistryInput;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

/** Result of exhaustively joining rule-model facts with authority and operations. */
export type RuleModelRegistryResult =
  | {
      readonly ok: true;
      readonly registry: RuleModelRegistry;
      readonly counts: RuleModelStateCounts;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

/** Resource limits enforced before canonical rule-model input is materialized. */
export interface RuleModelInputLimits {
  readonly maxInputBytes: number;
  readonly maxDepth: number;
  readonly maxRules: number;
  readonly maxStringBytes: number;
  readonly maxArrayItems: number;
}

/**
 * Immutable resource policy for the version-one rule-model registry.
 *
 * @example
 * ```ts
 * const maximum = RULE_MODEL_V1_LIMITS.maxRules;
 * ```
 */
export const RULE_MODEL_V1_LIMITS: RuleModelInputLimits = Object.freeze({
  maxInputBytes: 16_777_216,
  maxDepth: 16,
  maxRules: 32_768,
  maxStringBytes: 65_536,
  maxArrayItems: 65_536,
});
