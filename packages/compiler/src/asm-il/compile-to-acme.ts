/**
 * ASM-IL Complete Compilation Pipeline
 *
 * Provides the `compileToAcme()` function that integrates all ASM-IL components:
 * IL Module → CodeGenerator → AsmOptimizer → AcmeEmitter → ACME text
 *
 * This is the main public API for compiling IL to ACME assembly text.
 *
 * @module asm-il/compile-to-acme
 * @since Phase 3f (CodeGenerator Integration)
 */

import type { ILModule } from '../il/module.js';
import type { AsmModule } from './types.js';
import type { CodegenOptions, CodegenResult } from '../codegen/types.js';
import type { AsmOptimizerConfig, AsmOptimizationResult } from './optimizer/types.js';
import type { AcmeEmitterConfig, EmitterResult } from './emitters/types.js';
import { CodeGenerator } from '../codegen/code-generator.js';
import { createAsmOptimizer, createPassThroughOptimizer } from './optimizer/index.js';
import { createAcmeEmitter } from './emitters/index.js';
import { getDefaultTargetConfig } from '../target/registry.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complete compilation configuration
 *
 * Combines code generation, optimization, and emission settings.
 */
export interface CompileToAcmeConfig {
  /**
   * Code generation options
   */
  codeGen: CodegenOptions;

  /**
   * Whether to run optimization passes
   * @default false
   */
  optimize?: boolean;

  /**
   * ASM-IL optimizer configuration
   * Only used when optimize is true
   */
  asmOptimizer?: AsmOptimizerConfig;

  /**
   * ACME emitter configuration (partial, merged with defaults)
   */
  emitter?: Partial<AcmeEmitterConfig>;
}

/**
 * Complete compilation result
 *
 * Contains all outputs from the compilation pipeline.
 */
export interface CompileToAcmeResult {
  /**
   * Final ACME assembly text output
   */
  asmText: string;

  /**
   * Structured ASM-IL module (for inspection/debugging)
   */
  asmModule: AsmModule;

  /**
   * Original CodeGenerator result
   */
  codeGenResult: CodegenResult;

  /**
   * Optimization result (if optimization was enabled)
   */
  optimizationResult?: AsmOptimizationResult;

  /**
   * Emitter result with statistics
   */
  emitterResult: EmitterResult;

  /**
   * Aggregated statistics from all pipeline stages
   */
  stats: CompilationStats;
}

/**
 * Aggregated compilation statistics
 */
export interface CompilationStats {
  /**
   * Total bytes of generated code
   */
  totalBytes: number;

  /**
   * Number of lines in output
   */
  lineCount: number;

  /**
   * Code size in bytes (from CodeGenerator)
   */
  codeSize: number;

  /**
   * Data size in bytes (from CodeGenerator)
   */
  dataSize: number;

  /**
   * Number of optimization passes run
   */
  optimizationPasses: number;

  /**
   * Whether optimization changed anything
   */
  optimizationChanged: boolean;

  /**
   * Number of functions generated
   */
  functionCount: number;

  /**
   * Number of global variables generated
   */
  globalCount: number;

  /**
   * Zero-page bytes used
   */
  zpBytesUsed: number;
}

// ============================================================================
// MAIN COMPILATION FUNCTION
// ============================================================================

/**
 * Compile an IL module to ACME assembly text
 *
 * This function orchestrates the complete compilation pipeline:
 *
 * 1. **Code Generation** (IL → AsmModule)
 *    - Uses CodeGenerator.generateWithAsmIL()
 *    - Produces structured ASM-IL representation
 *
 * 2. **Optimization** (AsmModule → AsmModule)
 *    - Uses AsmOptimizer (currently pass-through)
 *    - Can be enabled/disabled via config
 *
 * 3. **Emission** (AsmModule → text)
 *    - Uses AcmeEmitter
 *    - Produces ACME-compatible assembly text
 *
 * @param ilModule - The IL module to compile
 * @param config - Compilation configuration
 * @returns Complete compilation result with all outputs
 *
 * @throws Error if code generation fails
 * @throws Error if optimization fails (when enabled)
 * @throws Error if emission fails
 *
 * @example
 * ```typescript
 * import { compileToAcme } from './asm-il/index.js';
 *
 * const result = compileToAcme(ilModule, {
 *   codeGen: {
 *     target: { architecture: 'c64' },
 *     format: 'asm',
 *     basicStub: true,
 *   },
 *   optimize: false,
 *   emitter: {
 *     includeComments: true,
 *     uppercaseMnemonics: true,
 *   },
 * });
 *
 * console.log(result.asmText);
 * console.log(`Total bytes: ${result.stats.totalBytes}`);
 * ```
 *
 * @example With optimization
 * ```typescript
 * const result = compileToAcme(ilModule, {
 *   codeGen: options,
 *   optimize: true,
 *   asmOptimizer: {
 *     enabled: true,
 *     maxIterations: 10,
 *   },
 * });
 *
 * if (result.stats.optimizationChanged) {
 *   console.log('Optimization applied successfully');
 * }
 * ```
 */
export function compileToAcme(ilModule: ILModule, config: CompileToAcmeConfig): CompileToAcmeResult {
  // ========================================
  // Step 1: Code Generation
  // ========================================

  const codeGenerator = new CodeGenerator();
  const codeGenResult = codeGenerator.generateWithAsmIL(ilModule, config.codeGen);

  // Ensure AsmModule was produced
  if (!codeGenResult.module) {
    throw new Error('Code generation failed: AsmModule not produced. This is an internal error.');
  }

  const asmModule = codeGenResult.module;

  // ========================================
  // Step 2: Optimization
  // ========================================

  let optimizedModule: AsmModule = asmModule;
  let optimizationResult: AsmOptimizationResult | undefined;

  if (config.optimize) {
    // Use full optimizer with provided config
    const optimizer = createAsmOptimizer(config.asmOptimizer ?? { enabled: true });
    optimizationResult = optimizer.optimize(asmModule);
    optimizedModule = optimizationResult.module;
  } else {
    // Use pass-through optimizer (no changes)
    const passThrough = createPassThroughOptimizer();
    optimizationResult = passThrough.optimize(asmModule);
    optimizedModule = optimizationResult.module;
  }

  // ========================================
  // Step 3: Emission
  // ========================================

  const emitter = createAcmeEmitter(config.emitter);
  const emitterResult = emitter.emit(optimizedModule);

  // ========================================
  // Build Result
  // ========================================

  // Aggregate statistics
  const stats: CompilationStats = {
    totalBytes: emitterResult.totalBytes,
    lineCount: emitterResult.lineCount,
    codeSize: codeGenResult.stats.codeSize,
    dataSize: codeGenResult.stats.dataSize,
    optimizationPasses: optimizationResult?.iterations ?? 0,
    optimizationChanged: optimizationResult?.changed ?? false,
    functionCount: codeGenResult.stats.functionCount,
    globalCount: codeGenResult.stats.globalCount,
    zpBytesUsed: codeGenResult.stats.zpBytesUsed,
  };

  return {
    asmText: emitterResult.text,
    asmModule: optimizedModule,
    codeGenResult,
    optimizationResult,
    emitterResult,
    stats,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a default compilation configuration for C64 target
 *
 * @param overrides - Optional overrides for specific settings
 * @returns Complete compilation configuration
 *
 * @example
 * ```typescript
 * const config = createDefaultConfig({ optimize: true });
 * const result = compileToAcme(module, config);
 * ```
 */
export function createDefaultConfig(
  overrides?: Partial<CompileToAcmeConfig>
): CompileToAcmeConfig {
  return {
    codeGen: {
      target: getDefaultTargetConfig(),
      format: 'asm',
      sourceMap: false,
      debug: 'none',
      basicStub: true,
    },
    optimize: false,
    emitter: {
      includeComments: true,
      uppercaseMnemonics: true,
    },
    ...overrides,
  };
}

/**
 * Quick compile with default C64 configuration
 *
 * Convenience function for simple compilation scenarios.
 *
 * @param ilModule - The IL module to compile
 * @returns ACME assembly text
 *
 * @example
 * ```typescript
 * const asmText = quickCompileToAcme(module);
 * writeFileSync('output.asm', asmText);
 * ```
 */
export function quickCompileToAcme(ilModule: ILModule): string {
  const config = createDefaultConfig();
  const result = compileToAcme(ilModule, config);
  return result.asmText;
}