/**
 * Constant Tracker - tracks which virtual registers hold constant values
 *
 * This utility performs a simple forward dataflow analysis to determine
 * which registers hold constant values at each point in the IL. This is
 * essential for the intrinsic lowering pass which needs to know if a
 * peek/poke address operand is a constant.
 *
 * The analysis is intraprocedural (within a single function) and uses
 * a simple worklist algorithm.
 *
 * @module optimizer/constant-tracker
 */

import type { BasicBlock } from '../il/basic-block.js';
import type { ILFunction } from '../il/function.js';
import type { VirtualRegister } from '../il/values.js';
import { ILOpcode, ILConstInstruction } from '../il/instructions.js';

/**
 * Information about a constant value in a register.
 */
export interface ConstantInfo {
  /** The constant value */
  readonly value: number;

  /** The instruction ID that defined this constant */
  readonly definingInstructionId: number;

  /** The block ID where the constant was defined */
  readonly definingBlockId: number;
}

/**
 * Result of constant tracking for a function.
 *
 * Provides methods to query constant values at specific points in the IL.
 */
export interface ConstantTrackingResult {
  /**
   * Gets the constant value of a register, if known.
   *
   * @param reg - The register to query
   * @returns The constant info, or undefined if not a constant
   */
  getConstant(reg: VirtualRegister): ConstantInfo | undefined;

  /**
   * Checks if a register holds a constant value.
   *
   * @param reg - The register to check
   * @returns true if the register holds a constant
   */
  isConstant(reg: VirtualRegister): boolean;

  /**
   * Gets all registers that hold constant values.
   *
   * @returns Map from register ID to constant info
   */
  getAllConstants(): ReadonlyMap<number, ConstantInfo>;

  /**
   * Gets the set of registers that are used (not just their constant value).
   *
   * This is useful for dead code elimination - a CONST instruction
   * whose result is never used can be removed.
   *
   * @returns Set of register IDs that are used
   */
  getUsedRegisters(): ReadonlySet<number>;
}

/**
 * Tracks which registers hold constant values in a function.
 *
 * This class performs a simple forward dataflow analysis to determine
 * constant values. It handles:
 * - CONST instructions that define constants
 * - Instructions that invalidate registers (assignments)
 * - PHI nodes (conservatively marks as non-constant)
 *
 * @example
 * ```typescript
 * const tracker = new ConstantTracker();
 * const result = tracker.analyze(func);
 *
 * // Check if a register holds a constant
 * if (result.isConstant(addressReg)) {
 *   const value = result.getConstant(addressReg)!.value;
 *   // Transform peek(addressReg) to HARDWARE_READ(value)
 * }
 * ```
 */
export class ConstantTracker {
  /**
   * Analyzes a function to track constant values.
   *
   * @param func - The function to analyze
   * @returns The constant tracking result
   */
  analyze(func: ILFunction): ConstantTrackingResult {
    // Map from register ID to constant info
    const constants = new Map<number, ConstantInfo>();

    // Track which registers are used
    const usedRegisters = new Set<number>();

    // Process blocks in reverse postorder for efficient forward dataflow
    const blocks = func.getBlocksInReversePostorder();

    for (const block of blocks) {
      this.analyzeBlock(block, constants, usedRegisters);
    }

    return this.createResult(constants, usedRegisters);
  }

  /**
   * Analyzes a single basic block.
   *
   * Updates the constants map based on instructions in the block.
   *
   * @param block - The block to analyze
   * @param constants - Map to update with constant values
   * @param usedRegisters - Set to update with used register IDs
   */
  protected analyzeBlock(
    block: BasicBlock,
    constants: Map<number, ConstantInfo>,
    usedRegisters: Set<number>,
  ): void {
    const instructions = block.getInstructions();

    for (const instr of instructions) {
      // Track used registers
      for (const usedReg of instr.getUsedRegisters()) {
        usedRegisters.add(usedReg.id);
      }

      // Handle CONST instructions - these define constants
      if (instr.opcode === ILOpcode.CONST && instr.result) {
        const constInstr = instr as ILConstInstruction;
        constants.set(instr.result.id, {
          value: constInstr.value,
          definingInstructionId: instr.id,
          definingBlockId: block.id,
        });
        continue;
      }

      // Handle PHI instructions - conservatively mark as non-constant
      // A PHI could merge a constant with a non-constant, so we can't
      // assume it's constant unless all sources are the same constant
      if (instr.opcode === ILOpcode.PHI && instr.result) {
        // For simplicity, we mark PHI results as non-constant
        // A more sophisticated analysis could check if all sources
        // have the same constant value
        constants.delete(instr.result.id);
        continue;
      }

      // Any other instruction with a result invalidates that register
      // as a "known constant" from our perspective (we could track
      // more cases like binary ops on constants, but that's overkill
      // for intrinsic lowering)
      if (instr.result) {
        constants.delete(instr.result.id);
      }
    }
  }

  /**
   * Creates the result object from the analysis data.
   *
   * @param constants - Map of register ID to constant info
   * @param usedRegisters - Set of used register IDs
   * @returns The constant tracking result
   */
  protected createResult(
    constants: Map<number, ConstantInfo>,
    usedRegisters: Set<number>,
  ): ConstantTrackingResult {
    return {
      getConstant(reg: VirtualRegister): ConstantInfo | undefined {
        return constants.get(reg.id);
      },

      isConstant(reg: VirtualRegister): boolean {
        return constants.has(reg.id);
      },

      getAllConstants(): ReadonlyMap<number, ConstantInfo> {
        return constants;
      },

      getUsedRegisters(): ReadonlySet<number> {
        return usedRegisters;
      },
    };
  }
}

/**
 * Creates a new ConstantTracker instance.
 *
 * @returns A new ConstantTracker
 */
export function createConstantTracker(): ConstantTracker {
  return new ConstantTracker();
}