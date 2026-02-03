/**
 * IL Peephole Optimization Pass
 *
 * Applies local pattern-based optimizations on instruction sequences.
 * This is the final IL optimization pass before code generation.
 *
 * **Patterns Handled:**
 * - Identity elimination: Remove operations that have no effect
 * - Strength reduction: Replace expensive operations with cheaper ones
 * - Load-store elimination: Remove redundant load/store pairs
 *
 * @module optimizer/passes/il-peephole
 */

import type { ILFunction } from '../../il/structures.js';
import type { ILInstruction } from '../../il/instruction.js';
import { ILOpcode } from '../../il/enums.js';
import { isImmediateOperand, isSlotOperand } from '../../il/guards.js';
import { createInstruction, createImmediateOperand } from '../../il/factories.js';
import type { OptimizationOptions } from '../options.js';
import type { OptimizationPass, PassResult } from '../pass.js';
import { mergeResults, createResult } from '../pass.js';

// ============================================================================
// IL Peephole Pass
// ============================================================================

/**
 * IL Peephole optimization pass.
 *
 * Applies local pattern-based optimizations that look at one or more
 * adjacent instructions and transform them into more efficient forms.
 *
 * **Why Run Last:**
 * This pass runs after other optimizations to clean up any remaining
 * patterns that emerged from earlier transformations.
 *
 * @example
 * ```typescript
 * const peephole = new ILPeepholePass();
 * const manager = new PassManager({ level: 'O2' });
 * manager.registerPass(peephole);
 * ```
 */
export class ILPeepholePass implements OptimizationPass {
  // ═══════════════════════════════════════════════════════════════════
  // OptimizationPass Interface
  // ═══════════════════════════════════════════════════════════════════

  /** Pass name - used for configuration and logging */
  readonly name = 'il-peephole';

  /** Dependencies - runs after other passes have simplified code */
  readonly dependencies: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Pass Execution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run peephole optimization on a function.
   *
   * Applies multiple pattern transformations in order:
   * 1. Identity elimination (removes no-op instructions)
   * 2. Strength reduction (replaces expensive ops with cheaper)
   * 3. Load-store elimination (removes redundant pairs)
   *
   * @param func - IL function to optimize (modified in place)
   * @param options - Optimization options
   * @returns Pass result with modification statistics
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const results: PassResult[] = [];

    // Run each pattern transformation
    results.push(this.identityElimination(func, options));
    results.push(this.strengthReduction(func, options));
    results.push(this.loadStoreElimination(func, options));

    return mergeResults(results);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 1: Identity Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove identity operations that have no effect.
   *
   * Patterns removed:
   * - ADD_IMM 0 (x + 0 = x)
   * - SUB_IMM 0 (x - 0 = x)
   * - OR_IMM 0 (x | 0 = x)
   * - XOR_IMM 0 (x ^ 0 = x)
   * - AND_IMM 0xFF (x & 0xFF = x for bytes)
   * - SHL_BYTE 0 (x << 0 = x)
   * - SHR_BYTE 0 (x >> 0 = x)
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected identityElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove: number[] = [];
    const debugInfo: string[] = [];

    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      const identityReason = this.getIdentityReason(instr);

      if (identityReason) {
        toRemove.push(i);
        if (options.debug) {
          debugInfo.push(
            `Identity elimination at ${i}: ${ILOpcode[instr.opcode]} (${identityReason})`
          );
        }
      }
    }

    // Remove in reverse order to preserve indices
    if (toRemove.length > 0) {
      func.instructions = func.instructions.filter((_, i) => !toRemove.includes(i));
    }

    return createResult(toRemove.length, 0, debugInfo.length > 0 ? debugInfo : undefined);
  }

  /**
   * Check if instruction is an identity operation and return reason.
   *
   * @param instr - Instruction to check
   * @returns Reason string if identity, null otherwise
   */
  protected getIdentityReason(instr: ILInstruction): string | null {
    const value = this.getImmediateValue(instr);
    if (value === null) return null;

    switch (instr.opcode) {
      case ILOpcode.ADD_IMM:
        return value === 0 ? 'x + 0 = x' : null;
      case ILOpcode.SUB_IMM:
        return value === 0 ? 'x - 0 = x' : null;
      case ILOpcode.OR_IMM:
        return value === 0 ? 'x | 0 = x' : null;
      case ILOpcode.XOR_IMM:
        return value === 0 ? 'x ^ 0 = x' : null;
      case ILOpcode.AND_IMM:
        return value === 0xff ? 'x & 0xFF = x (byte)' : null;
      case ILOpcode.SHL_BYTE:
        return value === 0 ? 'x << 0 = x' : null;
      case ILOpcode.SHR_BYTE:
        return value === 0 ? 'x >> 0 = x' : null;
      default:
        return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 2: Strength Reduction
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Replace expensive operations with cheaper equivalents.
   *
   * Patterns:
   * - MUL_BYTE by power of 2 → SHL_BYTE log2(n)
   * - DIV_BYTE by power of 2 → SHR_BYTE log2(n)
   * - MUL_BYTE 0 → LOAD_IMM 0 (x * 0 = 0)
   * - AND_IMM 0 → LOAD_IMM 0 (x & 0 = 0)
   * - OR_IMM 0xFF → LOAD_IMM 0xFF (x | 0xFF = 0xFF for byte)
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected strengthReduction(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const debugInfo: string[] = [];
    let replaced = 0;

    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      const replacement = this.tryStrengthReduce(instr, options);

      if (replacement) {
        func.instructions[i] = replacement.instruction;
        replaced++;

        if (options.debug) {
          debugInfo.push(
            `Strength reduction at ${i}: ${ILOpcode[instr.opcode]} → ${ILOpcode[replacement.instruction.opcode]} (${replacement.reason})`
          );
        }
      }
    }

    return createResult(0, replaced, debugInfo.length > 0 ? debugInfo : undefined);
  }

  /**
   * Attempt to strength-reduce an instruction.
   *
   * @param instr - Instruction to check
   * @param _options - Optimization options (unused, reserved for future)
   * @returns Replacement instruction and reason, or null
   */
  protected tryStrengthReduce(
    instr: ILInstruction,
    _options: OptimizationOptions
  ): StrengthReductionResult | null {
    const value = this.getImmediateValue(instr);

    switch (instr.opcode) {
      case ILOpcode.MUL_BYTE:
        return this.tryReduceMultiply(instr, value);

      case ILOpcode.DIV_BYTE:
        return this.tryReduceDivide(instr, value);

      case ILOpcode.AND_IMM:
        if (value === 0) {
          return {
            instruction: this.createLoadImm(0, instr),
            reason: 'x & 0 = 0',
          };
        }
        return null;

      case ILOpcode.OR_IMM:
        if (value === 0xff) {
          return {
            instruction: this.createLoadImm(0xff, instr),
            reason: 'x | 0xFF = 0xFF (byte)',
          };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Try to reduce multiply to shift or constant.
   *
   * @param _instr - MUL_BYTE instruction (unused, reserved for future)
   * @param _value - Immediate value if slot has known constant (unused, reserved for future)
   * @returns Reduction result or null
   */
  protected tryReduceMultiply(
    _instr: ILInstruction,
    _value: number | null
  ): StrengthReductionResult | null {
    // Note: MUL_BYTE operates on slots, but we need to check for
    // known constant values from constant propagation.
    // For now, we can only handle MUL when combined with LOAD_IMM patterns.
    // Full implementation would require value tracking from previous passes.

    // Check if this is a multiply followed by known value pattern
    // This is a simplified version - full impl needs data flow analysis
    return null;
  }

  /**
   * Try to reduce divide to shift.
   *
   * @param _instr - DIV_BYTE instruction (unused, reserved for future)
   * @param _value - Immediate value if slot has known constant (unused, reserved for future)
   * @returns Reduction result or null
   */
  protected tryReduceDivide(
    _instr: ILInstruction,
    _value: number | null
  ): StrengthReductionResult | null {
    // Similar to multiply - needs data flow for full implementation
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pattern 3: Load-Store Elimination
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Remove redundant load-store pairs.
   *
   * Patterns:
   * - LOAD_BYTE x; STORE_BYTE x → remove both (no-op)
   * - LOAD_IMM n; STORE_BYTE x; LOAD_BYTE x → remove last load
   *
   * @param func - Function to optimize
   * @param options - Optimization options
   * @returns Result with statistics
   */
  protected loadStoreElimination(
    func: ILFunction,
    options: OptimizationOptions
  ): PassResult {
    const toRemove = new Set<number>();
    const debugInfo: string[] = [];

    for (let i = 0; i < func.instructions.length - 1; i++) {
      if (toRemove.has(i)) continue;

      const instr = func.instructions[i];
      const next = func.instructions[i + 1];

      // Pattern: LOAD_BYTE x; STORE_BYTE x → remove both
      if (
        instr.opcode === ILOpcode.LOAD_BYTE &&
        next.opcode === ILOpcode.STORE_BYTE
      ) {
        const loadSlot = this.getSlotName(instr);
        const storeSlot = this.getSlotName(next);

        if (loadSlot && storeSlot && loadSlot === storeSlot) {
          toRemove.add(i);
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Load-store elimination at ${i}-${i + 1}: LOAD_BYTE ${loadSlot}; STORE_BYTE ${storeSlot}`
            );
          }
        }
      }

      // Pattern: STORE_BYTE x; LOAD_BYTE x (consecutive) → keep just STORE
      // The value is already in accumulator after store
      if (
        instr.opcode === ILOpcode.STORE_BYTE &&
        next.opcode === ILOpcode.LOAD_BYTE
      ) {
        const storeSlot = this.getSlotName(instr);
        const loadSlot = this.getSlotName(next);

        if (storeSlot && loadSlot && storeSlot === loadSlot) {
          toRemove.add(i + 1);

          if (options.debug) {
            debugInfo.push(
              `Redundant load after store at ${i + 1}: LOAD_BYTE ${loadSlot} (value already in A)`
            );
          }
        }
      }
    }

    // Remove marked instructions
    if (toRemove.size > 0) {
      func.instructions = func.instructions.filter((_, i) => !toRemove.has(i));
    }

    return createResult(
      toRemove.size,
      0,
      debugInfo.length > 0 ? debugInfo : undefined
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════

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

  /**
   * Extract slot name from instruction operand.
   *
   * @param instr - Instruction to examine
   * @returns Slot name or null if not a slot operand
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) {
      return null;
    }

    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  /**
   * Create a LOAD_IMM instruction preserving metadata.
   *
   * @param value - Immediate value to load
   * @param original - Original instruction for metadata
   * @returns New LOAD_IMM instruction
   */
  protected createLoadImm(value: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.LOAD_IMM, [createImmediateOperand(value, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced)`
        : 'Strength reduced',
    });
  }

  /**
   * Create a SHL_BYTE instruction preserving metadata.
   *
   * @param shiftCount - Number of bits to shift
   * @param original - Original instruction for metadata
   * @returns New SHL_BYTE instruction
   */
  protected createShiftLeft(shiftCount: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.SHL_BYTE, [createImmediateOperand(shiftCount, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced from multiply)`
        : 'Strength reduced from multiply',
    });
  }

  /**
   * Create a SHR_BYTE instruction preserving metadata.
   *
   * @param shiftCount - Number of bits to shift
   * @param original - Original instruction for metadata
   * @returns New SHR_BYTE instruction
   */
  protected createShiftRight(shiftCount: number, original: ILInstruction): ILInstruction {
    return createInstruction(ILOpcode.SHR_BYTE, [createImmediateOperand(shiftCount, false)], {
      location: original.location,
      comment: original.comment
        ? `${original.comment} (strength reduced from divide)`
        : 'Strength reduced from divide',
    });
  }

  /**
   * Check if a number is a power of 2.
   *
   * @param n - Number to check
   * @returns true if n is a power of 2
   */
  protected isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Calculate log base 2 of a power of 2.
   *
   * @param n - Power of 2
   * @returns log2(n)
   */
  protected log2(n: number): number {
    return Math.log2(n);
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a strength reduction attempt.
 */
interface StrengthReductionResult {
  /** The replacement instruction */
  instruction: ILInstruction;
  /** Human-readable reason for the reduction */
  reason: string;
}