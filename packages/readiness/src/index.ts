export { compareDiagnostics, createDiagnostic, sortDiagnostics } from "./diagnostics.js";
export { parseInventoryJson } from "./json-input.js";
export { INVENTORY_V1_LIMITS } from "./limits.js";
export { validateInventorySchema } from "./schema-validator.js";
export type { InventoryLimits } from "./limits.js";
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
  RuleApplicability,
  RuleLineage,
  RulePolarity,
  SourceCitation,
  SourceSection,
  UniversalProjection,
  ValidationResult,
} from "./model.js";
