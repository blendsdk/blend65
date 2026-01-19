/**
 * Phase 8: Advanced Analysis (Optimization Analysis)
 *
 * Exports all optimization analysis components for Phase 8.
 *
 * This module provides:
 * - Optimization metadata keys (enum-based, IL optimizer friendly)
 * - Type-safe metadata accessor
 * - Advanced analyzer orchestrator
 * - Individual analysis passes (implemented in future tasks)
 */

// Core infrastructure
export {
  OptimizationMetadataKey,
  TypeCoercionKind,
  DeadCodeKind,
  PurityLevel,
  EscapeReason,
  MemoryRegion,
  Register,
  AddressingMode,
  type InductionVariable,
} from './optimization-metadata-keys.js';

export { OptimizationMetadataAccessor } from './metadata-accessor.js';

export { AdvancedAnalyzer } from './advanced-analyzer.js';

// Individual analysis passes
export { DefiniteAssignmentAnalyzer } from './definite-assignment.js';
export { VariableUsageAnalyzer } from './variable-usage.js';
export { UnusedFunctionAnalyzer } from './unused-functions.js';
export { DeadCodeAnalyzer } from './dead-code.js';
export { ReachingDefinitionsAnalyzer } from './reaching-definitions.js';
export { LivenessAnalyzer, type LivenessInfo, type LivenessInterval } from './liveness.js';
export { ConstantPropagationAnalyzer, type ConstantPropagationInfo, type LatticeValue } from './constant-propagation.js';
export { AliasAnalyzer } from './alias-analysis.js';
export { PurityAnalyzer } from './purity-analysis.js';
export { EscapeAnalyzer } from './escape-analysis.js';
export { LoopAnalyzer } from './loop-analysis.js';
export { CallGraphAnalyzer } from './call-graph.js';
export { M6502HintAnalyzer, M6502Register, MemoryAccessPattern } from './m6502-hints.js';
export { GlobalValueNumberingAnalyzer } from './global-value-numbering.js';
export { CommonSubexpressionEliminationAnalyzer } from './common-subexpr-elimination.js';

// IL Readiness analyzers
export { TypeCoercionAnalyzer, type CoercionInfo } from './type-coercion.js';
export { ExpressionComplexityAnalyzer, type ComplexityInfo } from './expression-complexity.js';