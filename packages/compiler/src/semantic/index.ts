/**
 * Semantic Analyzer Module
 *
 * Exports all semantic analysis components:
 * - Symbol table infrastructure
 * - Type system infrastructure
 * - Semantic analyzer orchestrator
 * - Analysis visitors
 */

// Main analyzer
export { SemanticAnalyzer } from './analyzer.js';
export type { AnalysisResult } from './analyzer.js';

// Symbol table infrastructure
export { SymbolTable } from './symbol-table.js';
export { ScopeKind } from './scope.js';
export type { Scope, ScopeMetadata } from './scope.js';
export { SymbolKind, StorageClass } from './symbol.js';
export type { Symbol, SymbolMetadata } from './symbol.js';

// Type system infrastructure
export { TypeKind, TypeCompatibility } from './types.js';
export type { TypeInfo, FunctionSignature, TypeMetadata } from './types.js';
export { TypeSystem } from './type-system.js';
export { TypeResolver } from './visitors/type-resolver.js';

// Visitors
export { SymbolTableBuilder } from './visitors/symbol-table-builder.js';
export { TypeChecker } from './visitors/type-checker.js';
