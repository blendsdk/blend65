/**
 * Blend65 Compiler v2
 *
 * A compiler for the Blend65 language targeting 6502-based systems
 * using Static Frame Allocation (SFA) architecture.
 *
 * **Key Features:**
 * - No SSA - Simple linear IL with direct memory addresses
 * - Static Frame Allocation - Each function gets a fixed memory region
 * - No recursion support - Compile-time cycle detection
 * - Simple accumulator-centric code generation
 *
 * **Pipeline (8 phases):**
 * 1. Parse - Lexer + Parser (source → AST)
 * 2. Semantic - Type checking, symbol resolution
 * 3. Frame - Static Frame Allocation
 * 4. IL - Intermediate language generation
 * 5. Optimize - IL optimization passes
 * 6. Codegen - IL → ASM-IL (structured assembly)
 * 7. AsmOpt - ASM-IL peephole optimization
 * 8. Emit - ASM-IL → assembly text
 *
 * **Re-export Strategy:**
 * Some internal modules define their own DiagnosticSeverity or
 * OptimizationLevel enums. To avoid conflicts at the top level:
 * - `ast/`, `lexer/`, `parser/` use wildcard re-exports (no conflicts)
 * - `semantic/`, `frame/`, `codegen/`, `optimizer/` use selective exports
 *   to avoid duplicate symbol names
 * - Consumers needing internal types can import from sub-module paths
 *
 * @packageDocumentation
 * @module @blend65/compiler-v2
 */

// Version info
export const VERSION = '0.1.0';

// ── Core Language Modules (no conflicts) ───────────────────────────

/** Lexer: Source → Tokens */
export * from './lexer/index.js';

/** Parser: Tokens → AST */
export * from './parser/index.js';

/** AST: Abstract Syntax Tree node types, diagnostics, etc. */
export * from './ast/index.js';

// ── Modules with selective exports (avoid name conflicts) ──────────

/**
 * Semantic: Key exports only. For internal types, import from
 * '@blend65/compiler-v2/semantic' directly.
 *
 * Note: semantic/analysis/advanced-analyzer.ts defines its own
 * DiagnosticSeverity which conflicts with ast's DiagnosticSeverity.
 */
export {
  // Main analyzer
  SemanticAnalyzer,
  DEFAULT_ANALYZER_OPTIONS,
  type AnalysisResult,
  type MultiModuleAnalysisResult,
  type SemanticAnalyzerOptions,
  // Symbol management
  Symbol,
  SymbolTable,
  Scope,
  // Type system
  TypeSystem,
  // Call graph + recursion detection
  CallGraph,
  CallGraphBuilder,
  RecursionChecker,
  // Module system
  ModuleRegistry,
  DependencyGraph,
  ImportResolver,
  GlobalSymbolTable,
  // Control flow
  ControlFlowGraph,
  CFGBuilder,
} from './semantic/index.js';

/**
 * Frame: Key exports only. For internal types, import from
 * '@blend65/compiler-v2/frame' directly.
 *
 * Note: frame/enums.ts defines its own DiagnosticSeverity
 * which conflicts with ast's DiagnosticSeverity.
 */
export {
  // Main allocator
  FrameAllocator,
  // Types
  type Frame,
  type FrameSlot,
  type FrameAllocationResult,
  type FrameAllocationStats,
  // Enums (excluding DiagnosticSeverity)
  SlotKind,
  // Platform config
  type PlatformConfig,
} from './frame/index.js';

/** IL: Intermediate Language types and generator */
export * from './il/index.js';

/**
 * Optimizer: Key exports only. For internal types, import from
 * '@blend65/compiler-v2/optimizer' directly.
 *
 * Note: Both optimizer and codegen export OptimizationLevel
 * and getDefaultOptions with different meanings.
 */
export {
  ILOptimizer,
  type OptimizationOptions,
  type OptimizationLevel,
  getDefaultOptions,
} from './optimizer/index.js';

/**
 * Code Generator: Key exports only. For internal types, import from
 * '@blend65/compiler-v2/codegen' directly.
 *
 * Note: codegen/asm-il/optimizer re-exports OptimizationLevel and
 * getDefaultOptions which conflict with optimizer module exports.
 */
export {
  // Main code generator
  CodeGenerator,
  // ASM-IL types
  type AsmILProgram,
  type AsmILSection,
  type AsmInstruction,
  // ASM-IL optimizer
  AsmOptimizer,
  // Emitter
  AsmILEmitter,
} from './codegen/index.js';

// ── Infrastructure Modules ─────────────────────────────────────────

/** Configuration types */
export * from './config/index.js';

/** Target architecture system */
export * from './target/index.js';

/** Library loader */
export * from './library/index.js';

// ── Pipeline & Compiler ────────────────────────────────────────────

/** Pipeline types and phase wrappers */
export * from './pipeline/index.js';

/** Main Compiler class and formatting utilities */
export { Compiler, formatDiagnostics, formatDiagnostic } from './compiler.js';
