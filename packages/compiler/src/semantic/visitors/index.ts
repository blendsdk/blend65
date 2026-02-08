/**
 * Semantic Analysis Visitors for Blend65 Compiler v2
 *
 * This module exports all AST visitor passes used in semantic analysis:
 * - Pass 1: SymbolTableBuilder - Builds symbol table from declarations
 * - Pass 2: TypeResolver - Resolves type annotations
 * - Pass 3: TypeChecker - Type checks expressions and statements
 * - Pass 5: ControlFlowAnalyzer - Builds CFGs and detects unreachable code
 *
 * @module semantic/visitors
 */

// Pass 1: Symbol Table Builder
export { SymbolTableBuilder, SymbolTableDiagnosticCodes } from './symbol-table-builder.js';
export type { SymbolTableBuildResult } from './symbol-table-builder.js';

// Pass 2: Type Resolver
export { TypeResolver, TypeResolverDiagnosticCodes } from './type-resolver.js';
export type { TypeResolutionResult } from './type-resolver.js';

// Pass 3: Type Checker (inheritance chain)
export {
  TypeCheckerBase,
  TypeCheckDiagnosticCodes,
  LiteralTypeChecker,
  ExpressionTypeChecker,
  DeclarationTypeChecker,
  DeclarationDiagnosticCodes,
  StatementTypeChecker,
  StatementDiagnosticCodes,
  TypeChecker,
} from './type-checker/index.js';
export type { TypeCheckResult, TypeCheckPassResult, TypeCheckOptions } from './type-checker/index.js';

// Pass 5: Control Flow Analyzer
export { ControlFlowAnalyzer } from './control-flow-analyzer.js';