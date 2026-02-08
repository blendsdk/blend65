/**
 * Pass-Through Optimization Pass
 *
 * A no-op pass that returns the input program unchanged.
 * Useful for testing the optimizer infrastructure without
 * any actual transformations.
 *
 * @module codegen/asm-il/optimizer/pass-through
 */

import type { AsmILProgram } from '../types.js';
import type { AsmOptimizationPass, AsmOptimizationPassResult } from './types.js';
import { createUnchangedPassResult } from './types.js';

/**
 * No-op optimization pass that leaves the program unchanged.
 *
 * Used for:
 * - Testing the pass manager infrastructure
 * - Placeholder pass during development
 * - Benchmarking pass manager overhead
 *
 * @example
 * ```typescript
 * const pass = new PassThroughPass();
 * const result = pass.run(program);
 * console.log(result.changed); // false — always
 * ```
 */
export class PassThroughPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'pass-through';

  /** @inheritdoc */
  readonly isTransform = false;

  /**
   * Returns the program unchanged with empty statistics.
   *
   * @param program - The input program (returned as-is)
   * @returns Unchanged pass result
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    return createUnchangedPassResult(program);
  }
}
