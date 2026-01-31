/**
 * Semantic Analysis Visitors for Blend65 Compiler v2
 *
 * This module exports all AST visitor passes used in semantic analysis:
 * - Pass 1: SymbolTableBuilder - Builds symbol table from declarations
 * - Pass 2: TypeResolver - Resolves type annotations
 * - Pass 3: TypeChecker - Type checks expressions and statements
 *
 * @module semantic/visitors
 */

// Pass 1: Symbol Table Builder
export {
  SymbolTableBuilder,
  SymbolTableBuildResult,
  SymbolTableDiagnosticCodes,
} from './symbol-table-builder.js';

// Pass 2: Type Resolver
export {
  TypeResolver,
  TypeResolutionResult,
  TypeResolverDiagnosticCodes,
} from './type-resolver.js';

// Pass 3: Type Checker (inheritance chain)
export {
  TypeCheckerBase,
  TypeCheckResult,
  TypeCheckPassResult,
  TypeCheckDiagnosticCodes,
  LiteralTypeChecker,
} from './type-checker/index.js';