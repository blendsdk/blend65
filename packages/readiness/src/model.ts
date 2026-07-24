/** Validation stage that owns a diagnostic. */
export type DiagnosticPhase =
  | "input"
  | "schema"
  | "source"
  | "declaration"
  | "conflict"
  | "ledger"
  | "graph"
  | "evolution";

/** Severity emitted by inventory validation. */
export type DiagnosticSeverity = "error" | "warning";

/** One-based source location used by diagnostics. */
export interface DiagnosticLocation {
  readonly line: number;
  readonly column: number;
}

/** Stable machine-readable validation diagnostic. */
export interface InventoryDiagnostic {
  readonly phase: DiagnosticPhase;
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly path: string;
  readonly location?: DiagnosticLocation;
  readonly relatedPaths: readonly string[];
  readonly message: string;
}

/** Condition that prevents a valid inventory from supporting readiness. */
export type ReadinessBlockingReasonKind =
  | "blocked-errata"
  | "unresolved-source-conflict"
  | "unbound-handler"
  | "unbound-evidence-capability";

/** Typed explanation for valid-but-not-ready state. */
export interface ReadinessBlockingReason {
  readonly kind: ReadinessBlockingReasonKind;
  readonly identity: string;
  readonly sourcePaths: readonly string[];
}

/** Authority role assigned to a source file or section. */
export type AuthorityClassification =
  | "normative-chapter"
  | "normative-grammar"
  | "normative-target"
  | "contextual"
  | "deferred"
  | "rejected"
  | "blocked-errata";

/** Versioned policy for deriving fragments from source bytes. */
export interface FragmentationProfile {
  readonly profileId: "markdown-ebnf-v1";
  readonly version: 1;
  readonly contentHashAlgorithm: "sha256";
  readonly newlinePolicy: "lf";
}

/** Closed classification for one selected source section. */
export interface SourceSection {
  readonly headingAncestry: readonly string[];
  readonly classification: AuthorityClassification;
  readonly contentHash: string;
}

/** Ordered entry in the source authority manifest. */
export interface NormativeSource {
  readonly path: string;
  readonly order: number;
  readonly classification: AuthorityClassification;
  readonly sections: readonly SourceSection[];
}

/** Kind of executable evidence handler. */
export type HandlerKind = "generator" | "oracle" | "transform";
/** Whether a declaration has an executable implementation. */
export type BindingState = "bound" | "unbound";

/** Versioned generator, oracle, or transform contract. */
export interface HandlerDeclaration {
  readonly id: string;
  readonly kind: HandlerKind;
  readonly owner: string;
  readonly contractVersion: string;
  readonly binding: BindingState;
}

/** Versioned declaration for an observable evidence boundary. */
export interface EvidenceCapabilityDeclaration {
  readonly id: string;
  readonly owner: string;
  readonly contractVersion: string;
  readonly binding: BindingState;
  readonly observableContract: string;
  readonly prerequisiteRoute: string;
}

/** Independently falsifiable outcome of a decomposed fragment. */
export interface ChildOutcome {
  readonly outcomeId: string;
  readonly ruleIds: readonly string[];
}

/** Exhaustive disposition assigned to one source fragment. */
export type ClauseLedgerEntry =
  | {
      readonly fragmentId: string;
      readonly disposition: "mapped";
      readonly ruleIds: readonly string[];
    }
  | {
      readonly fragmentId: string;
      readonly disposition: "decomposed";
      readonly childOutcomes: readonly ChildOutcome[];
    }
  | {
      readonly fragmentId: string;
      readonly disposition: "non-normative";
      readonly reasonCode: string;
    }
  | {
      readonly fragmentId: string;
      readonly disposition: "canonical-restatement";
      readonly canonicalRuleId: string;
      readonly conflictId: string;
    }
  | {
      readonly fragmentId: string;
      readonly disposition: "blocked-errata";
      readonly conflictId: string;
    };

/** Exact source identity carried by rules and conflicts. */
export interface SourceCitation {
  readonly path: string;
  readonly headingAncestry: readonly string[];
  readonly quote: string;
  readonly contentHash: string;
  readonly displayLine: number;
}

/** Reviewed relationship between overlapping normative statements. */
export type ConflictClassification =
  | "equivalent-restatement"
  | "duplicate-ownership"
  | "overlapping-obligation"
  | "contradiction";

/** Canonical aggregate for overlapping source statements. */
export interface ConflictRecord {
  readonly conflictId: string;
  readonly classification: ConflictClassification;
  readonly citations: readonly SourceCitation[];
  readonly ruleIds: readonly string[];
  readonly resolution: string;
}

/** Declarative value-domain or invalid-neighbor description. */
export interface DomainDescriptor {
  readonly kind: string;
  readonly values: readonly string[];
}

/** Source-backed reason for non-mandatory C64 applicability. */
export interface ApplicabilityReason {
  readonly code: string;
  readonly target: string;
  readonly citation: SourceCitation;
}

/** Stable ancestry retained when rules split or merge. */
export interface RuleLineage {
  readonly supersedes?: readonly string[];
  readonly splitFrom?: readonly string[];
  readonly mergedFrom?: readonly string[];
}

/** Target child derived from a universal platform rule. */
export interface UniversalProjection {
  readonly parentRuleId: string;
  readonly target: "c64" | "c64u" | "cx16" | "a800xl" | "a7800";
}

/** Observable normative polarity of one rule. */
export type RulePolarity =
  | "positive"
  | "negative-diagnostic"
  | "negative-rejection"
  | "quality-obligation";

/** Participation of a rule in the C64 denominator. */
export type RuleApplicability =
  | "mandatory-c64"
  | "not-applicable-c64"
  | "out-of-claim-target"
  | "blocked-errata";

/** One independently falsifiable normative outcome. */
export interface InventoryRule {
  readonly ruleId: string;
  readonly source: SourceCitation;
  readonly requirement: string;
  readonly category: string;
  readonly polarity: RulePolarity;
  readonly applicability: RuleApplicability;
  readonly applicabilityReason?: ApplicabilityReason;
  readonly validDomains: readonly DomainDescriptor[];
  readonly invalidNeighbors: readonly DomainDescriptor[];
  readonly boundaryFamilies: readonly string[];
  readonly generatorIds: readonly string[];
  readonly oracleIds: readonly string[];
  readonly transformIds: readonly string[];
  readonly handlerAbsenceReason?: string;
  readonly evidenceObligations: readonly string[];
  readonly prerequisiteRuleIds: readonly string[];
  readonly relatedRuleIds: readonly string[];
  readonly lineage?: RuleLineage;
  readonly universalProjection?: UniversalProjection;
}

/** Approval record required before a format migration. */
export interface EvolutionGate {
  readonly owner: string;
  readonly semanticRevision: string;
  readonly acceptanceGate: string;
  readonly validatedAt: string;
}

/** Complete authoritative inventory aggregate for schema version 1. */
export interface InventoryV1 {
  readonly schemaVersion: 1;
  readonly inventoryVersion: string;
  readonly specRevision: string;
  readonly identityLedgerHead: string;
  readonly fragmentationProfile: FragmentationProfile;
  readonly normativeSources: readonly NormativeSource[];
  readonly handlerDeclarations: readonly HandlerDeclaration[];
  readonly evidenceCapabilityDeclarations: readonly EvidenceCapabilityDeclaration[];
  readonly clauseLedger: readonly ClauseLedgerEntry[];
  readonly conflicts: readonly ConflictRecord[];
  readonly rules: readonly InventoryRule[];
  readonly evolutionGate: EvolutionGate | null;
}

/** Source fragment paired with its canonical path and normalized quoted bytes. */
export interface ResolvedSourceFragment {
  readonly sourcePath: string;
  readonly fragment: SourceFragment;
  readonly quote: string;
}

/** Immutable inputs shared by the focused semantic validators. */
export interface SemanticValidationContext {
  readonly fragments: readonly ResolvedSourceFragment[];
  readonly identityLedgerBytes: Uint8Array;
  readonly limits: InventoryLimits;
}

/** One append-only allocation or retirement fact in the rule identity ledger. */
export interface RuleIdentityEvent {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly operation: "allocate" | "retire";
  readonly ruleId: string;
  readonly predecessorRuleIds: readonly string[];
  readonly successorRuleIds: readonly string[];
  readonly previousHash: `sha256:${string}`;
  readonly eventHash: `sha256:${string}`;
}

/** Result of validating prerequisite and target-projection relationships. */
export interface RuleGraphResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly topologicalRuleIds?: readonly string[];
}

/** Result returned by schema and semantic validation. */
export interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly inventory?: InventoryV1;
  readonly topologicalRuleIds?: readonly string[];
  readonly blockingReasons: readonly ReadinessBlockingReason[];
  readonly resolvedFragments?: readonly ResolvedSourceFragment[];
}

/** Result returned by strict raw JSON intake. */
export interface ParsedInventoryResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly inventory: unknown | undefined;
  readonly blockingReasons: readonly ReadinessBlockingReason[];
}
import type { SourceFragment } from "./fragment-model.js";
import type { InventoryLimits } from "./limits.js";
