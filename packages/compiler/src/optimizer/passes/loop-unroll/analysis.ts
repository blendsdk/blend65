/**
 * Loop Unroll Analysis — Iteration Count Detection
 *
 * Middle layer of the Loop Unrolling inheritance chain.
 * Detects whether a loop has a known constant iteration count
 * by examining the ILLoop metadata (isCountedLoop, boundValue,
 * counterSlot).
 *
 * A loop is eligible for unrolling when:
 * 1. It is a counted loop (isCountedLoop === true)
 * 2. It has a statically known bound (boundValue is set)
 * 3. Its iteration count is within the unroll threshold
 * 4. Its body is small enough (within maxBodySize)
 *
 * Inheritance chain: LoopUnrollBase → LoopUnrollAnalysis → LoopUnrollPass
 *
 * @module optimizer/passes/loop-unroll/analysis
 */

import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction, ILLoop } from '../../../il/structures.js';
import type { LoopInfo } from '../../analysis/loop-tree.js';
import type { OptimizationOptions } from '../../options.js';
import { LoopUnrollBase, MAX_FULL_UNROLL_ITERATIONS } from './base.js';

// ============================================================================
// UnrollCandidate — Analysis result for a single loop
// ============================================================================

/**
 * Describes a loop that is eligible for unrolling.
 *
 * Contains the analysis results needed by the unrolling engine
 * to decide how to transform the loop.
 *
 * @example
 * ```typescript
 * const candidate: UnrollCandidate = {
 *   loop: loopInfo,
 *   iterationCount: 4,
 *   bodySize: 3,
 *   isFullUnroll: true,    // 4 <= MAX_FULL_UNROLL_ITERATIONS
 *   unrollFactor: 4,       // Will duplicate body 4 times
 * };
 * ```
 */
export interface UnrollCandidate {
  /** The loop to unroll */
  readonly loop: LoopInfo;

  /** Known constant iteration count */
  readonly iterationCount: number;

  /** Number of effective body instructions (excluding overhead) */
  readonly bodySize: number;

  /**
   * Whether to fully unroll (eliminate loop entirely).
   * True when iterationCount <= MAX_FULL_UNROLL_ITERATIONS.
   */
  readonly isFullUnroll: boolean;

  /** How many times to duplicate the body */
  readonly unrollFactor: number;
}

// ============================================================================
// LoopUnrollAnalysis — Iteration Count Detection
// ============================================================================

/**
 * Analysis layer for loop unrolling.
 *
 * Examines loops to determine if they have a known constant
 * iteration count and are eligible for unrolling. Uses the
 * ILLoop metadata populated by the IL generator (for-loops
 * with constant bounds set isCountedLoop and boundValue).
 *
 * @see LoopUnrollBase — Foundation helpers
 * @see LoopUnrollPass — Uses candidates to perform unrolling
 */
export class LoopUnrollAnalysis extends LoopUnrollBase {
  // ═══════════════════════════════════════════════════════════════════
  // Candidate Detection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Analyze a loop to determine if it's an unroll candidate.
   *
   * A loop is eligible for unrolling when ALL of:
   * 1. The ILLoop metadata says it's a counted loop
   * 2. The iteration count is statically known (boundValue set)
   * 3. The effective body size is within the max for this level
   * 4. The iteration count is reasonable (> 1, not infinite)
   *
   * @param func - IL function containing the loop
   * @param loop - LoopInfo from the LoopTree
   * @param options - Optimization options (determines thresholds)
   * @returns UnrollCandidate if eligible, or null if not
   */
  protected analyzeCandidate(
    func: ILFunction,
    loop: LoopInfo,
    options: OptimizationOptions
  ): UnrollCandidate | null {
    // Step 1: Check if the underlying ILLoop is a counted loop
    const ilLoop = loop.loop;
    if (!ilLoop.isCountedLoop) {
      return null;
    }

    // Step 2: Get the iteration count
    const iterationCount = this.getIterationCount(ilLoop);
    if (iterationCount === null || iterationCount <= 1) {
      // Unknown count, zero iterations, or single iteration — skip
      return null;
    }

    // Step 3: Check body size against level-specific threshold
    const headerIdx = this.findLabelIndex(func, loop.headerLabel);
    const exitIdx = this.findLabelIndex(func, loop.exitLabel);
    if (headerIdx === -1 || exitIdx === -1) {
      return null;
    }

    const bodyInstructions = this.extractBodyInstructions(func, headerIdx, exitIdx);

    // Safety guard: Reject loops containing BARRIER — the barrier() intrinsic
    // explicitly prevents optimization across its boundary. Unrolling a loop
    // with barrier() would duplicate the barrier semantics incorrectly and
    // produce corrupt code at O2/O3.
    const containsBarrier = bodyInstructions.some(
      instr => instr.opcode === ILOpcode.BARRIER
    );
    if (containsBarrier) {
      return null;
    }

    const maxBodySize = this.getMaxBodySize(options);
    if (bodyInstructions.length > maxBodySize || bodyInstructions.length === 0) {
      return null;
    }

    // Step 4: Determine unroll strategy
    const baseUnrollFactor = this.getUnrollFactor(options);
    if (baseUnrollFactor === 0) {
      return null;
    }

    // Decide between full unroll (eliminate loop) and partial unroll
    const isFullUnroll = iterationCount <= MAX_FULL_UNROLL_ITERATIONS;
    const unrollFactor = isFullUnroll ? iterationCount : baseUnrollFactor;

    // For partial unrolling, ensure iteration count is evenly divisible
    // by the unroll factor. If not, skip (handling remainder loops adds
    // complexity we avoid for now).
    if (!isFullUnroll && iterationCount % unrollFactor !== 0) {
      return null;
    }

    return {
      loop,
      iterationCount,
      bodySize: bodyInstructions.length,
      isFullUnroll,
      unrollFactor,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Iteration Count Resolution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Determine the iteration count of a counted loop.
   *
   * Uses the ILLoop metadata populated by the IL generator:
   * - `boundValue`: The statically known upper bound
   * - `estimatedIterations`: Pre-computed iteration estimate
   *
   * For simple counted loops (`for i = 0 to N`), the iteration
   * count equals the bound value. For other patterns, we use
   * the estimated iterations if available.
   *
   * @param ilLoop - The ILLoop metadata
   * @returns Known iteration count, or null if not statically determinable
   */
  protected getIterationCount(ilLoop: ILLoop): number | null {
    // Prefer the pre-computed estimate from the IL generator
    // (it accounts for start value, direction, and step)
    if (ilLoop.estimatedIterations !== undefined && ilLoop.estimatedIterations > 0) {
      return ilLoop.estimatedIterations;
    }

    // Fallback: use boundValue directly if available
    // (assumes simple 0..N counted loop pattern)
    if (ilLoop.boundValue !== undefined && ilLoop.boundValue > 0) {
      return ilLoop.boundValue;
    }

    // Dynamic bound or unknown — cannot determine
    return null;
  }
}
