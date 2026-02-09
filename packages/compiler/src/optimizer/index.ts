/**
 * IL Optimizer Module
 *
 * Implements optimization passes on the IL (Intermediate Language)
 * before code generation. This is the first stage of a two-stage
 * optimization pipeline.
 *
 * **Two-Stage Optimizer Pipeline:**
 * ```
 * IL Generator → IL OPTIMIZER → CodeGen → ASM-IL → ASM-IL Optimizer → Emitter
 *                  (this)                             (phase 2)
 * ```
 *
 * **Key Components:**
 * - OptimizationOptions: Configuration for optimization levels (O0-Oz)
 * - OptimizationPass: Interface for individual optimization passes
 * - PassManager: Orchestrates pass execution with dependency ordering
 * - ILOptimizer: High-level API for optimizing functions and programs
 *
 * **Optimization Passes:**
 * - DCE (Dead Code Elimination): Remove unused stores and unreachable code
 * - Constant Folding: Evaluate constant expressions at compile time
 * - Constant Propagation: Replace variables with known constant values
 * - Copy Propagation: Replace copies with original values
 * - IL Peephole: Pattern-based local optimizations
 *
 * **Optimization Levels:**
 * - O0: No optimization (fastest compile, debugging)
 * - O1: Basic (DCE, constant folding)
 * - O2: Standard (all passes, single iteration)
 * - O3: Aggressive (all passes, multiple iterations)
 * - Os: Size (all passes, prefer smaller code)
 * - Oz: Minimum size (aggressive size reduction)
 *
 * @module optimizer
 */

// ============================================================================
// Options
// ============================================================================

export type { OptimizationLevel, OptimizationOptions } from './options.js';

export {
  getDefaultOptions,
  getPassesForLevel,
  getProgramPassesForLevel,
  shouldIterate,
  isSizeOptimization,
  getIterationCount,
  resolveEnabledPasses,
  resolveProgramPasses,
} from './options.js';

// ============================================================================
// Pass Interface
// ============================================================================

export type {
  PassResult,
  OptimizationPass,
  PassStats,
  OptimizationResult,
  ProgramPassResult,
  ProgramOptimizationPass,
} from './pass.js';

export {
  createEmptyResult,
  createResult,
  mergeResults,
  createEmptyProgramResult,
  createProgramResult,
} from './pass.js';

// ============================================================================
// Pass Manager
// ============================================================================

export { PassManager } from './pass-manager.js';

// ============================================================================
// IL Optimizer
// ============================================================================

export type {
  FunctionOptimizationResult,
  ProgramOptimizationResult,
} from './il-optimizer.js';

export { ILOptimizer } from './il-optimizer.js';

// ============================================================================
// Optimization Passes
// ============================================================================

// Phase 2: DCE Pass
export { DCEPass } from './passes/dce.js';

// Phase 3: Constant Folding
export { ConstantFoldPass } from './passes/constant-fold.js';

// Phase 4: Constant Propagation
export { ConstantPropPass } from './passes/constant-prop.js';

// Phase 5: Copy Propagation
export { CopyPropPass } from './passes/copy-prop.js';

// Phase 6: IL Peephole
export { ILPeepholePass } from './passes/il-peephole.js';

// Program-Level: Dead Function Elimination
export { DeadFunctionElimPass } from './passes/dead-function-elim.js';

// Program-Level: Dead Global Elimination
export { DeadGlobalElimPass } from './passes/dead-global-elim.js';

// Program-Level: Function Inlining
export { FunctionInliningPass } from './passes/function-inlining.js';
export type { InlineCandidate } from './passes/function-inlining.js';

// ============================================================================
// Analysis
// ============================================================================

export { CallGraph } from './analysis/index.js';
