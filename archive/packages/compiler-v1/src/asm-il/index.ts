/**
 * ASM-IL Module
 *
 * Assembly Intermediate Language for the Blend65 compiler.
 * Provides structured representation of 6502 assembly code.
 *
 * ## Main Entry Point
 *
 * Use `compileToAcme()` for complete compilation:
 *
 * ```typescript
 * import { compileToAcme, createDefaultConfig } from './asm-il/index.js';
 *
 * const config = createDefaultConfig();
 * const result = compileToAcme(ilModule, config);
 * console.log(result.asmText);
 * ```
 *
 * ## Individual Components
 *
 * For more control, use individual components:
 * - `AsmModuleBuilder` - Build ASM-IL modules
 * - `AsmOptimizer` - Optimize ASM-IL modules
 * - `AcmeEmitter` - Emit ACME assembly text
 *
 * @module asm-il
 */

// Re-export main compilation function
export {
  compileToAcme,
  createDefaultConfig,
  quickCompileToAcme,
  type CompileToAcmeConfig,
  type CompileToAcmeResult,
  type CompilationStats,
} from './compile-to-acme.js';

// Re-export all types
export * from './types.js';

// Re-export builder
export * from './builder/index.js';

// Re-export optimizer
export * from './optimizer/index.js';

// Re-export emitters
export * from './emitters/index.js';