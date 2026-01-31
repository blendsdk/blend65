/**
 * Advanced Analysis Module for Blend65 Compiler v2
 *
 * Provides sophisticated program analysis beyond basic type checking:
 * - Definite assignment analysis (detecting uninitialized variables)
 * - Variable usage analysis (detecting unused variables/parameters)
 * - Dead code analysis (future)
 * - Liveness analysis (future)
 * - Purity analysis (future)
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