/**
 * Constant Propagation Optimization Pass
 *
 * Tracks known constant values through variables and replaces loads
 * with immediate values when the constant is known.
 *
 * **Example:**
 * ```
 * // Before:
 * LOAD_IMM 5
 * STORE_BYTE x
 * LOAD_BYTE x    // x is known to be 5
 *
 * // After:
 * LOAD_IMM 5
 * STORE_BYTE x
 * LOAD_IMM 5     // Replaced with constant
 * ```
 *
 * **Invalidation Rules:**
 * - STORE_BYTE/STORE_WORD: Invalidates the stored-to slot
 * - INC_BYTE/DEC_BYTE: Invalidates the modified slot
 * - LABEL: Clears all constants (control flow merge)
 * - JUMP variants: Clears all constants (control flow diverge)
 * - CALL: Clears all constants (callee may modify memory)
 *
 * @module optimizer/passes/constant-prop
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isSlotOperand, isImmediateOperand } from '../../il/guards.js';
import { createInstruction, createImmediateOperand } from '../../il/factories.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { createResult } from '../pass.js';

// ============================================================================
// Constant Propagation Pass
// ============================================================================

/**
 * Constant Propagation optimization pass.
 *
 * Tracks which slots hold known constant values and replaces
 * subsequent loads with immediate values.
 *
 * **How It Works:**
 * 1. When LOAD_IMM followed by STORE_BYTE is seen, record the constant
 * 2. When LOAD_BYTE is seen for a known slot, replace with LOAD_IMM
 * 3. When slot is written to or control flow changes, invalidate
 *
 * **Works Best After:**
 * - DCE: Removes dead code that would confuse tracking
 * - Constant Folding: Creates more constant values to propagate
 *
 * @example
 * ```typescript
 * const prop = new ConstantPropPass();
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(prop);
 * ```
 */
export class ConstantPropPass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'constant-prop';

  /**
   * Dependencies - runs after DCE and constant folding for best results.
   */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run constant propagation on a function.
   *
   * Tracks known constant values and replaces loads with immediates.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Track known constants: slot name → value
    const constants = new Map<string, number>();
    const instructions = func.instructions;
    const debugInfo: string[] = [];
    let replaced = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Check for control flow that clears all constants
      if (this.clearsAllConstants(instr)) {
        if (options.debug && constants.size > 0) {
          debugInfo.push(
            `Control flow at ${i} (${ILOpcode[instr.opcode]}) clears ${constants.size} constant(s)`
          );
        }
        constants.clear();
        continue;
      }

      // LOAD_BYTE: replace with LOAD_IMM if constant known
      if (instr.opcode === ILOpcode.LOAD_BYTE) {
        const slot = this.getSlotName(instr);
        if (slot && constants.has(slot)) {
          const value = constants.get(slot)!;
          instructions[i] = this.createLoadImm(value, instr);
          replaced++;

          if (options.debug) {
            debugInfo.push(`Propagated constant ${value} for slot '${slot}' at index ${i}`);
          }
        }
        continue;
      }

      // Check for invalidating writes
      if (this.invalidatesSlot(instr)) {
        const slot = this.getSlotName(instr);
        if (slot) {
          // Check if this is LOAD_IMM followed by STORE_BYTE
          // (we need to look at the previous instruction to track new constant)
          if (instr.opcode === ILOpcode.STORE_BYTE && i > 0) {
            const prev = instructions[i - 1];
            if (prev.opcode === ILOpcode.LOAD_IMM) {
              const value = this.getImmediateValue(prev);
              if (value !== null) {
                constants.set(slot, value);
                if (options.debug) {
                  debugInfo.push(`Tracking constant: '${slot}' = ${value}`);
                }
                continue;
              }
            }
          }

          // Not a constant store, invalidate any tracked constant
          if (constants.has(slot)) {
            if (options.debug) {
              debugInfo.push(`Invalidated constant for slot '${slot}' at index ${i}`);
            }
            constants.delete(slot);
          }
        }
      }
    }

    return createResult(0, replaced, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Extract slot name from instruction operand.
   *
   * @param instr - Instruction with slot operand
   * @returns Slot name or null
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  /**
   * Extract immediate value from instruction operand.
   *
   * @param instr - Instruction with immediate operand
   * @returns Value or null
   */
  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }

  /**
   * Check if instruction invalidates a specific slot's constant value.
   *
   * @param instr - Instruction to check
   * @returns true if instruction writes to a slot
   */
  protected invalidatesSlot(instr: ILInstruction): boolean {
    return (
      instr.opcode === ILOpcode.STORE_BYTE ||
      instr.opcode === ILOpcode.STORE_WORD ||
      instr.opcode === ILOpcode.INC_BYTE ||
      instr.opcode === ILOpcode.DEC_BYTE
    );
  }

  /**
   * Check if instruction clears all known constants.
   *
   * Control flow instructions make it impossible to know which
   * path was taken, so we must assume all constants are invalid.
   *
   * @param instr - Instruction to check
   * @returns true if all constants should be cleared
   */
  protected clearsAllConstants(instr: ILInstruction): boolean {
    const opcode = instr.opcode;

    // Labels are merge points
    if (opcode === ILOpcode.LABEL) return true;

    // All jumps diverge control flow
    if (
      opcode === ILOpcode.JUMP ||
      opcode === ILOpcode.JUMP_EQ ||
      opcode === ILOpcode.JUMP_NE ||
      opcode === ILOpcode.JUMP_LT ||
      opcode === ILOpcode.JUMP_LE ||
      opcode === ILOpcode.JUMP_GE ||
      opcode === ILOpcode.JUMP_GT
    ) {
      return true;
    }

    // Calls may modify any slot (callee could do anything)
    if (opcode === ILOpcode.CALL) return true;

    return false;
  }

  /**
   * Create a LOAD_IMM instruction to replace a LOAD_BYTE.
   *
   * Preserves location and adds a comment explaining the propagation.
   *
   * @param value - The constant value
   * @param original - The original LOAD_BYTE instruction
   * @returns New LOAD_IMM instruction
   */
  protected createLoadImm(value: number, original: ILInstruction): ILInstruction {
    return createInstruction(
      ILOpcode.LOAD_IMM,
      [createImmediateOperand(value, false)],
      {
        location: original.location,
        comment: original.comment
          ? `${original.comment} (propagated constant)`
          : `Propagated constant: ${value}`,
      }
    );
  }
}