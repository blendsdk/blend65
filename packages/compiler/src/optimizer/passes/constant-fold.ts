/**
 * Constant Folding Optimization Pass
 *
 * Evaluates arithmetic operations on compile-time known values,
 * replacing `LOAD_IMM a; OP_IMM b` sequences with `LOAD_IMM result`.
 *
 * **What It Folds:**
 * - Arithmetic: ADD_IMM, SUB_IMM
 * - Bitwise: AND_IMM, OR_IMM, XOR_IMM
 * - Shifts: SHL_BYTE, SHR_BYTE
 *
 * **8-bit Overflow Handling:**
 * Results are masked to 8-bit (& 0xFF) to match 6502 behavior.
 *
 * @module optimizer/passes/constant-fold
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isImmediateOperand } from '../../il/guards.js';
import { createInstruction, createImmediateOperand } from '../../il/factories.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { createResult } from '../pass.js';

// ============================================================================
// Constant Folding Pass
// ============================================================================

/**
 * Constant Folding optimization pass.
 *
 * Identifies sequences where:
 * 1. Accumulator is loaded with immediate value
 * 2. Immediate arithmetic/bitwise operation follows
 *
 * These are folded into a single LOAD_IMM with the computed result.
 *
 * **Why DCE Should Run First:**
 * Constant folding can create more dead code (e.g., the intermediate
 * load becomes unnecessary). DCE running before helps, but running
 * after may also clean up folding artifacts.
 *
 * @example
 * ```typescript
 * const fold = new ConstantFoldPass();
 * const manager = new PassManager({ level: 'O1' });
 * manager.registerPass(fold);
 * ```
 */
export class ConstantFoldPass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'constant-fold';

  /**
   * Dependencies - we optionally benefit from DCE running first.
   * However, DCE should also run after to clean up any new dead code.
   */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run constant folding on a function.
   *
   * Scans for LOAD_IMM followed by foldable IMM operations.
   * When found, replaces both instructions with a single LOAD_IMM
   * containing the computed result.
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const instructions = func.instructions;
    const result: ILInstruction[] = [];
    const debugInfo: string[] = [];
    let removed = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // Check for LOAD_IMM followed by arithmetic IMM
      if (instr.opcode === ILOpcode.LOAD_IMM && i + 1 < instructions.length) {
        const next = instructions[i + 1];
        const folded = this.tryFold(instr, next);

        if (folded) {
          // Push the folded instruction instead of original two
          result.push(folded.instruction);
          i++; // Skip next instruction (it's been folded)
          removed++;

          if (options.debug) {
            debugInfo.push(
              `Folded LOAD_IMM ${folded.originalA} ${this.opcodeToSymbol(next.opcode)} ${folded.originalB} → LOAD_IMM ${folded.result}`
            );
          }
          continue;
        }
      }

      result.push(instr);
    }

    func.instructions = result;
    return createResult(removed, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Folding Logic
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Attempt to fold LOAD_IMM + arithmetic IMM into single LOAD_IMM.
   *
   * @param load - LOAD_IMM instruction
   * @param op - Following arithmetic instruction
   * @returns Fold result or null if not foldable
   */
  protected tryFold(
    load: ILInstruction,
    op: ILInstruction
  ): FoldResult | null {
    const a = this.getImmediateValue(load);
    const b = this.getImmediateValue(op);

    if (a === null || b === null) {
      return null;
    }

    const value = this.computeFold(op.opcode, a, b);
    if (value === null) {
      return null;
    }

    // Create new LOAD_IMM with folded result
    // Preserve location from original load for debugging
    const instruction = createInstruction(
      ILOpcode.LOAD_IMM,
      [createImmediateOperand(value, false)],
      {
        location: load.location,
        comment: load.comment
          ? `${load.comment} (folded from ${a} ${this.opcodeToSymbol(op.opcode)} ${b})`
          : `Folded: ${a} ${this.opcodeToSymbol(op.opcode)} ${b}`,
      }
    );

    return {
      instruction,
      originalA: a,
      originalB: b,
      result: value,
    };
  }

  /**
   * Compute the folded value for a given operation.
   *
   * All operations mask result to 8 bits to match 6502 behavior.
   *
   * @param opcode - The arithmetic opcode
   * @param a - First operand (from LOAD_IMM)
   * @param b - Second operand (from arithmetic IMM)
   * @returns Computed result or null if opcode not foldable
   */
  protected computeFold(opcode: ILOpcode, a: number, b: number): number | null {
    switch (opcode) {
      // Arithmetic operations
      case ILOpcode.ADD_IMM:
        return (a + b) & 0xff;

      case ILOpcode.SUB_IMM:
        // Handle underflow: result wraps around
        return (a - b) & 0xff;

      // Bitwise operations
      case ILOpcode.AND_IMM:
        return a & b;

      case ILOpcode.OR_IMM:
        return a | b;

      case ILOpcode.XOR_IMM:
        return a ^ b;

      // Shift operations
      case ILOpcode.SHL_BYTE:
        // Shift left, mask to 8 bits
        return (a << b) & 0xff;

      case ILOpcode.SHR_BYTE:
        // Logical shift right (unsigned)
        return a >>> b;

      default:
        return null;
    }
  }

  /**
   * Extract immediate value from instruction operand.
   *
   * @param instr - Instruction to examine
   * @returns Immediate value or null if not immediate
   */
  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) {
      return null;
    }

    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Debug Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Convert opcode to human-readable symbol for debug output.
   *
   * @param opcode - The IL opcode
   * @returns Symbol string (e.g., '+', '-', '&')
   */
  protected opcodeToSymbol(opcode: ILOpcode): string {
    switch (opcode) {
      case ILOpcode.ADD_IMM:
        return '+';
      case ILOpcode.SUB_IMM:
        return '-';
      case ILOpcode.AND_IMM:
        return '&';
      case ILOpcode.OR_IMM:
        return '|';
      case ILOpcode.XOR_IMM:
        return '^';
      case ILOpcode.SHL_BYTE:
        return '<<';
      case ILOpcode.SHR_BYTE:
        return '>>';
      default:
        return ILOpcode[opcode] ?? '?';
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a successful fold operation.
 */
interface FoldResult {
  /** The new LOAD_IMM instruction */
  instruction: ILInstruction;
  /** Original first operand value */
  originalA: number;
  /** Original second operand value */
  originalB: number;
  /** Computed result */
  result: number;
}