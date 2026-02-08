/**
 * Advanced Analysis Module for Blend65 Compiler v2
 *
 * Provides sophisticated program analysis beyond basic type checking:
 * - Definite assignment analysis (detecting uninitialized variables)
 * - Variable usage analysis (detecting unused variables/parameters)
 * - Dead code analysis (detecting unreachable code)
 * - Liveness analysis (computing live variable sets)
 * - Purity analysis (detecting function side effects)
 * - Loop analysis (detecting loop invariants and induction variables)
 * - M6502 hints (zero-page candidates, inline hints, hot variables)
 *
 * These analyzers help catch bugs and improve code quality by detecting
 * patterns that are likely errors or suboptimal.
 *
 * @module semantic/analysis
 */

// Definite Assignment Analysis
export {
  DefiniteAssignmentAnalyzer,
  DefiniteAssignmentSeverity,
  DefiniteAssignmentIssueKind,
  type DefiniteAssignmentIssue,
  type DefiniteAssignmentResult,
} from './definite-assignment.js';

// Variable Usage Analysis
export {
  VariableUsageAnalyzer,
  VariableUsageSeverity,
  VariableUsageIssueKind,
  DEFAULT_VARIABLE_USAGE_OPTIONS,
  type VariableUsageIssue,
  type VariableUsageResult,
  type VariableUsageOptions,
} from './variable-usage.js';

// Dead Code Analysis
export {
  DeadCodeAnalyzer,
  DeadCodeSeverity,
  DeadCodeIssueKind,
  type DeadCodeIssue,
  type DeadCodeResult,
} from './dead-code.js';

// Liveness Analysis
export {
  LivenessAnalyzer,
  DEFAULT_LIVENESS_OPTIONS,
  type LivenessInfo,
  type LivenessResult,
  type LivenessOptions,
} from './liveness.js';

// Purity Analysis
export {
  PurityAnalyzer,
  PurityStatus,
  ImpurityKind,
  DEFAULT_PURITY_OPTIONS,
  type FunctionPurity,
  type ImpurityReason,
  type PurityAnalysisResult,
  type PurityAnalysisOptions,
} from './purity-analysis.js';

// Loop Analysis
export {
  LoopAnalyzer,
  LoopKind,
  InductionVariableKind,
  DEFAULT_LOOP_OPTIONS,
  type LoopInfo,
  type InductionVariable,
  type LoopInvariant,
  type LoopAnalysisResult,
  type LoopAnalysisOptions,
} from './loop-analysis.js';

// M6502 Hints Analysis
export {
  M6502HintAnalyzer,
  M6502HintKind,
  HintPriority,
  DEFAULT_M6502_OPTIONS,
  type M6502Hint,
  type ZeroPageRecommendation,
  type VariableAccessInfo,
  type FunctionMetrics,
  type M6502HintResult,
  type M6502HintOptions,
} from './m6502-hints.js';

// Advanced Analyzer Orchestrator
export {
  AdvancedAnalyzer,
  DiagnosticSeverity,
  DiagnosticCategory,
  DEFAULT_ADVANCED_OPTIONS,
  type AdvancedDiagnostic,
  type AdvancedAnalysisOptions,
  type AdvancedAnalysisResult,
} from './advanced-analyzer.js';