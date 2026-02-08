/**
 * IL Instruction Types
 *
 * Defines the ILInstruction interface and related hint/cost interfaces.
 * Instructions carry optimization hints for the peephole optimizer.
 *
 * @module il/instruction
 */

import { SourceLocation } from '../ast/base.js';
import { ILOpcode } from './enums.js';
import { ILOperand } from './operands.js';

// ============================================================================
// Cost Model
// ============================================================================

/**
 * Cost model for an instruction.
 *
 * Used by optimizer to make informed decisions about:
 * - Which code sequences to prefer
 * - When to inline vs call
 * - Hot path optimization
 *
 * @example
 * ```typescript
 * // LOAD_BYTE from ZP is cheaper than from absolute
 * const zpCost: InstructionCost = { cycles: 3, bytes: 2, memoryAccesses: 1 };
 * const absCost: InstructionCost = { cycles: 4, bytes: 3, memoryAccesses: 1 };
 * ```
 */
export interface InstructionCost {
  /** Estimated 6502 cycles to execute */
  readonly cycles: number;

  /** Estimated instruction bytes in output */
  readonly bytes: number;

  /** Number of memory accesses */
  readonly memoryAccesses: number;
}

// ============================================================================
// Def-Use Information
// ============================================================================

/**
 * Def-use information for live range analysis.
 *
 * Tracks which variables are read (used) and written (defined)
 * by each instruction. Used for:
 * - Register allocation
 * - Dead code elimination
 * - Live range computation
 *
 * @example
 * ```typescript
 * // x = y + z
 * // Uses: y, z
 * // Defines: x
 * const defUse: DefUse = {
 *   defs: ['x'],
 *   uses: ['y', 'z'],
 * };
 * ```
 */
export interface DefUse {
  /** Slot names defined (written) by this instruction */
  readonly defs: string[];

  /** Slot names used (read) by this instruction */
  readonly uses: string[];
}

// ============================================================================
// Optimization Hints
// ============================================================================

/**
 * Optimization hints for peephole optimizer.
 *
 * Pre-computed hints that guide optimization passes:
 * - Hot path detection for aggressive optimization
 * - Dead code marking for elimination
 * - Coalescing opportunities
 *
 * @example
 * ```typescript
 * const hints: OptimizationHints = {
 *   isHotPath: true,        // In inner loop
 *   isFrequentAccess: true, // Variable accessed many times
 *   canCoalesce: true,      // Can merge with adjacent
 *   isDead: false,          // Result is used
 * };
 * ```
 */
export interface OptimizationHints {
  /** Is this instruction in a hot loop? */
  readonly isHotPath: boolean;

  /** Is this a frequently accessed variable? */
  readonly isFrequentAccess: boolean;

  /** Can this be coalesced with adjacent instructions? */
  readonly canCoalesce: boolean;

  /** Is this instruction dead (result unused)? */
  readonly isDead: boolean;
}

// ============================================================================
// IL Instruction
// ============================================================================

/**
 * A single IL instruction.
 *
 * Represents one operation in the intermediate language.
 * Contains the opcode, operands, and optional optimization metadata.
 *
 * **Design Philosophy:**
 * - Immutable core (opcode, operands)
 * - Mutable metadata (cost, hints, live ranges)
 * - Rich source tracking for debugging
 *
 * @example
 * ```typescript
 * // LOAD_BYTE counter
 * const loadInstr: ILInstruction = {
 *   opcode: ILOpcode.LOAD_BYTE,
 *   operands: [createSlotOperand(counterSlot)],
 *   location: counterNode.getLocation(),
 *   comment: 'Load counter variable',
 *   cost: { cycles: 3, bytes: 2, memoryAccesses: 1 },
 *   defUse: { defs: [], uses: ['counter'] },
 * };
 * ```
 */
export interface ILInstruction {
  // ═══════════════════════════════════════════════════════════════════
  // Core Instruction Data (immutable)
  // ═══════════════════════════════════════════════════════════════════

  /** The opcode */
  readonly opcode: ILOpcode;

  /** Operands (0-2 depending on opcode) */
  readonly operands: ILOperand[];

  // ═══════════════════════════════════════════════════════════════════
  // Source Location (optional)
  // ═══════════════════════════════════════════════════════════════════

  /** Source location for debugging */
  readonly location?: SourceLocation;

  /** Comment for IL debugging/output */
  readonly comment?: string;

  // ═══════════════════════════════════════════════════════════════════
  // Optimization Annotations (mutable, set by analysis passes)
  // ═══════════════════════════════════════════════════════════════════

  /** Cost model (cycles, bytes, memory accesses) */
  cost?: InstructionCost;

  /** Def-use information */
  defUse?: DefUse;

  /** Variables live at this instruction's entry */
  liveIn?: Set<string>;

  /** Variables live at this instruction's exit */
  liveOut?: Set<string>;

  /** Optimization hints */
  hints?: OptimizationHints;
}