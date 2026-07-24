export { compareDiagnostics, createDiagnostic, sortDiagnostics } from "./diagnostics.js";
export { parseInventoryJson } from "./json-input.js";
export { fragmentSource } from "./fragmenter.js";
export { INVENTORY_V1_LIMITS } from "./limits.js";
export { createSourceRepository, validateInventorySources } from "./source-repository.js";
export { validateInventorySchema } from "./schema-validator.js";
export { validateLedger } from "./ledger-validator.js";
export { validateConflicts } from "./conflict-validator.js";
export { validateDeclarations } from "./declaration-validator.js";
export { renderDeclarationModule } from "./declaration-generator.js";
export { validateRuleGraph } from "./rule-graph.js";
export { validateInventorySemantics } from "./semantic-validator.js";
export { validateReviewEvidence } from "./review-evidence.js";
export {
  computeInventoryReviewDigests,
  INVENTORY_REVIEW_UNIT_IDS,
} from "./review-digests.js";
export type {
  FragmentKind,
  FragmentationResult,
  SourceDocument,
  SourceFragment,
} from "./fragment-model.js";
export type { InventoryLimits } from "./limits.js";
export type { SourceRepository } from "./source-repository.js";
export type {
  ApplicabilityReason,
  AuthorityClassification,
  BindingState,
  ChildOutcome,
  ClauseLedgerEntry,
  ConflictClassification,
  ConflictRecord,
  DiagnosticLocation,
  DiagnosticPhase,
  DiagnosticSeverity,
  DomainDescriptor,
  EvidenceCapabilityDeclaration,
  EvolutionGate,
  FragmentationProfile,
  HandlerDeclaration,
  HandlerKind,
  InventoryDiagnostic,
  InventoryRule,
  InventoryV1,
  NormativeSource,
  ParsedInventoryResult,
  ReadinessBlockingReason,
  ReadinessBlockingReasonKind,
  ResolvedSourceFragment,
  RuleGraphResult,
  RuleIdentityEvent,
  RuleApplicability,
  RuleLineage,
  RulePolarity,
  SourceCitation,
  SourceSection,
  SemanticValidationContext,
  UniversalProjection,
  ValidationResult,
} from "./model.js";
export type {
  ReviewEvidenceContext,
  ReviewEvidenceResult,
  SemanticReviewRecord,
} from "./review-evidence.js";
export type { InventoryReviewDigests } from "./review-digests.js";
