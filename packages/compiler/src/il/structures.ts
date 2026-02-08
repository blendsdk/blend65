/**
 * IL Program Structures
 *
 * Defines the higher-level structures that organize IL instructions:
 * - ILLoop: Loop boundary information for loop-aware optimization
 * - ILFunction: A function with its frame and instructions
 * - ILProgram: Complete program with all functions
 *
 * @module il/structures
 */

import { Frame } from '../frame/allocator/frame-calculator.js';
import { FrameSlot } from '../frame/types.js';
import { ILInstruction } from './instruction.js';

// ============================================================================
// Loop Structure
// ============================================================================

/**
 * Loop information for loop-aware optimizations.
 *
 * Preserves loop boundaries that are lost in flat control flow.
 * Used by optimizer for:
 * - Loop-invariant code motion
 * - Loop unrolling decisions
 * - Hot path detection
 *
 * @example
 * ```typescript
 * const forLoop: ILLoop = {
 *   headerLabel: 'for_0_header',
 *   exitLabel: 'for_0_exit',
 *   depth: 1,
 *   isCountedLoop: true,
 *   counterSlot: indexSlot,
 *   boundValue: 10,
 *   estimatedIterations: 10,
 * };
 * ```
 */
export interface ILLoop {
  /** Label at loop header (start) */
  readonly headerLabel: string;

  /** Label at loop exit */
  readonly exitLabel: string;

  /** Loop nesting depth (1 = outermost) */
  readonly depth: number;

  /** Is this a counted loop (for i = 0 to n)? */
  readonly isCountedLoop: boolean;

  /** Loop counter slot (if counted) */
  readonly counterSlot?: FrameSlot;

  /** Loop bound (if statically known) */
  readonly boundValue?: number;

  /** Loop bound slot (if dynamic) */
  readonly boundSlot?: FrameSlot;

  /** Estimated iteration count (for unrolling decisions) */
  readonly estimatedIterations?: number;
}

// ============================================================================
// IL Function
// ============================================================================

/**
 * An IL function (sequence of instructions with frame).
 *
 * Combines:
 * - The SFA frame (slots, addresses)
 * - The IL instruction sequence
 * - Loop structure information
 * - Function metadata
 *
 * @example
 * ```typescript
 * const mainFunc: ILFunction = {
 *   name: 'main',
 *   frame: mainFrame,
 *   instructions: [...],
 *   isExported: true,
 *   isCallback: false,
 *   loops: [],
 *   maxLoopDepth: 0,
 * };
 * ```
 */
export interface ILFunction {
  // ═══════════════════════════════════════════════════════════════════
  // Identity
  // ═══════════════════════════════════════════════════════════════════

  /** Function name */
  readonly name: string;

  // ═══════════════════════════════════════════════════════════════════
  // SFA Integration
  // ═══════════════════════════════════════════════════════════════════

  /** Associated frame from SFA */
  readonly frame: Frame;

  // ═══════════════════════════════════════════════════════════════════
  // IL Content
  // ═══════════════════════════════════════════════════════════════════

  /** Instructions (mutable during generation) */
  instructions: ILInstruction[];

  // ═══════════════════════════════════════════════════════════════════
  // Function Metadata
  // ═══════════════════════════════════════════════════════════════════

  /** Is this function exported? */
  readonly isExported: boolean;

  /** Is this a callback/interrupt handler? */
  readonly isCallback: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // Loop Structure (Beyond God-Level)
  // ═══════════════════════════════════════════════════════════════════

  /** Loops in this function (for loop-specific optimizations) */
  loops: ILLoop[];

  /** Maximum loop nesting depth */
  maxLoopDepth: number;
}

// ============================================================================
// IL Program
// ============================================================================

/**
 * Complete IL program (one or more modules).
 *
 * Top-level container for all generated IL:
 * - Functions with their frames and instructions
 * - Global variable initialization
 * - Entry point information
 * - Statistics for debugging/optimization
 *
 * @example
 * ```typescript
 * const program: ILProgram = {
 *   moduleName: 'game',
 *   functions: [mainFunc, updateFunc, renderFunc],
 *   globalInit: [...],
 *   entryPoint: 'main',
 *   instructionCount: 150,
 *   totalEstimatedCycles: 2500,
 * };
 * ```
 */
export interface ILProgram {
  /** Module name */
  readonly moduleName: string;

  /** All functions in the module */
  functions: ILFunction[];

  /** Global variable initialization code */
  globalInit: ILInstruction[];

  /** Entry point function name (usually 'main') */
  entryPoint: string;

  /** Total instruction count (for statistics) */
  instructionCount: number;

  /** Total estimated cycles (for all functions) */
  totalEstimatedCycles: number;
}