/**
 * Semantic Analysis module for Blend65 v2
 *
 * Responsible for type checking, symbol resolution, and recursion detection.
 * This is a production-quality semantic analyzer with:
 * - Multi-pass architecture (symbol collection, type resolution, type checking, etc.)
 * - SFA-optimized design (no SSA, static frame allocation support)
 * - Recursion detection as compile-time error (required for SFA)
 * - Multi-module support with import/export resolution
 *
 * **Key Components:**
 * - Symbol: Represents declared identifiers (variables, functions, parameters, etc.)
 * - Scope: Represents lexical scopes (module, function, block, loop)
 * - SymbolTable: Manages scopes and symbol declarations/lookups
 * - TypeSystem: Type definitions and compatibility checking
 * - Type Checker: Semantic validation (multi-layer inheritance chain)
 * - Call Graph: Function call relationship tracking
 * - Recursion Detection: Compile-time cycle detection (SFA requirement)
 *
 * @module semantic
 */

// Core types
export * from './types.js';

// Symbol management
export * from './symbol.js';

// Scope management
export * from './scope.js';

// Symbol table
export * from './symbol-table.js';

// Type system
export * from './type-system.js';

// Semantic analysis visitors
export * from './visitors/index.js';

// Control flow analysis infrastructure
export {
  ControlFlowGraph,
  CFGBuilder,
  CFGNodeKind,
  type CFGNode,
  type LoopContext,
} from './control-flow.js';

// Multi-module support
export { ModuleRegistry, type RegisteredModule } from './module-registry.js';
export {
  DependencyGraph,
  type DependencyEdge,
  type CycleInfo,
} from './dependency-graph.js';

// Import resolution
export {
  ImportResolver,
  ImportErrorCode,
  type ImportError,
  type ImportResolution,
  type ResolvedImport,
  type ExportedSymbol,
} from './import-resolver.js';

// Global symbol table (cross-module symbol aggregation)
export {
  GlobalSymbolTable,
  GlobalSymbolKind,
  type GlobalSymbol,
  type GlobalLookupResult,
} from './global-symbol-table.js';

// Call graph (function call relationship tracking)
export {
  CallGraph,
  CallGraphBuilder,
  type CallGraphNode,
  type CallSite,
} from './call-graph.js';

// Recursion detection (SFA-critical - recursion is a compile-time error)
export {
  RecursionChecker,
  RecursionErrorCode,
  type RecursionError,
  type RecursionCheckResult,
} from './recursion-checker.js';

// Future exports (to be implemented in subsequent sessions):
// export * from './analyzer.js';