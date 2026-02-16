/**
 * Loop Unroll Base — Core Helpers for Body Duplication
 *
 * Foundation layer for the Loop Unrolling pass.
 * Provides helpers for:
 * - Classifying instructions as body vs control flow
 * - Cloning instructions for body duplication
 * - Computing unroll factors based on optimization level
 * - Describing instructions for debug output
 *
 * Inheritance chain: LoopUnrollBase → LoopUnrollAnalysis → LoopUnrollPass
 *
 * @module optimizer/passes/loop-unroll/base
 */

import type { FrameSlot } from '../../../frame/types.js';
import { ILOpcode } from '../../../il/enums.js';
import { isLabelOperand } from '../../../il/guards.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILFunction } from '../../../il/structures.js';
import type { OptimizationOptions } from '../../options.js';
import { isSizeOptimization } from '../../options.js';

// ============================================================================
// Constants — Unroll Thresholds
// ============================================================================

/**
 * Maximum loop body size (in instructions) for unrolling at O2.
 * Keeps unrolled code from bloating too much at standard optimization.
 */
export const O2_MAX_BODY_SIZE = 8;

/**
 * Maximum loop body size (in instructions) for unrolling at O3.
 * Aggressive optimization allows larger loop bodies to be unrolled.
 */
export const O3_MAX_BODY_SIZE = 16;

/**
 * Unroll factor at O2 — duplicate loop body this many times.
 * Factor of 2 means the body appears twice per "logical iteration".
 */
export const O2_UNROLL_FACTOR = 2;

/**
 * Unroll factor at O3 — more aggressive duplication.
 * Factor of 4 means the body appears four times per "logical iteration".
 */
export const O3_UNROLL_FACTOR = 4;

/**
 * Maximum total iteration count eligible for full unrolling.
 * Loops with more iterations than this are only partially unrolled.
 * Full unrolling completely eliminates the loop overhead.
 */
export const MAX_FULL_UNROLL_ITERATIONS = 8;

// ============================================================================
// LoopUnrollBase — Foundation for Loop Unrolling
// ============================================================================

/**
 * Base class for the loop unrolling pass inheritance chain.
 *
 * Provides foundational helpers for instruction cloning, body
 * classification, and unroll factor computation. Methods here
 * are purely analytical or produce new instructions — they
 * never modify the function's instruction array directly.
 *
 * @see LoopUnrollAnalysis — Adds iteration count detection
 * @see LoopUnrollPass — Adds the OptimizationPass run() method
 */
export class LoopUnrollBase {
  // ═══════════════════════════════════════════════════════════════════
  // Unroll Factor Computation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Determine the unroll factor for a given optimization level.
   *
   * Returns 0 for levels where unrolling is disabled (O0, O1, Os, Oz).
   * Os/Oz optimize for code size, so unrolling (which increases size)
   * is counter-productive.
   *
   * @param options - Optimization options with level
   * @returns Unroll factor (0 = disabled, 2 = O2, 4 = O3)
   */
  protected getUnrollFactor(options: OptimizationOptions): number {
    // Size optimization levels: no unrolling (increases code size)
    if (isSizeOptimization(options.level)) {
      return 0;
    }

    switch (options.level) {
      case 'O3':
        return O3_UNROLL_FACTOR;
      case 'O2':
        return O2_UNROLL_FACTOR;
      default:
        // O0, O1: no unrolling
        return 0;
    }
  }

  /**
   * Get the maximum body size eligible for unrolling at this level.
   *
   * Larger bodies produce more code when duplicated, so we limit
   * the body size more aggressively at lower optimization levels.
   *
   * @param options - Optimization options with level
   * @returns Maximum body instruction count for unrolling eligibility
   */
  protected getMaxBodySize(options: OptimizationOptions): number {
    switch (options.level) {
      case 'O3':
        return O3_MAX_BODY_SIZE;
      case 'O2':
        return O2_MAX_BODY_SIZE;
      default:
        return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Body Instruction Extraction
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Extract the "effective body" instructions from a loop.
   *
   * The effective body excludes the header LABEL, back-edge JUMP,
   * and the loop's termination check (CMP + conditional JUMP to exit).
   * These are the instructions that represent the actual loop work
   * and should be duplicated during unrolling.
   *
   * When `counterSlot` is provided, also excludes:
   * - Counter increment/decrement instructions (INC/DEC on the counter)
   * - Termination check instructions (LOAD counter + CMP bound)
   *
   * This prevents the bug where counter modifications are duplicated
   * both inside the extracted body AND separately by the partial
   * unroller, leading to triple-increments per iteration (bug L1).
   *
   * @param func - IL function containing the loop
   * @param headerIdx - Index of the loop header LABEL instruction
   * @param exitIdx - Index of the loop exit LABEL instruction
   * @param counterSlot - Optional counter slot to exclude counter ops from body
   * @returns Array of body instructions suitable for duplication
   */
  protected extractBodyInstructions(
    func: ILFunction,
    headerIdx: number,
    exitIdx: number,
    counterSlot?: FrameSlot
  ): ILInstruction[] {
    const body: ILInstruction[] = [];
    const counterName = counterSlot?.name;

    // Walk from after header to before exit, skipping:
    // - The header LABEL itself
    // - The back-edge JUMP (last instruction before exit)
    // - Control flow to exit label (CMP + conditional jump)
    // - Counter modifications and termination checks (when counterSlot provided)
    for (let i = headerIdx + 1; i < exitIdx; i++) {
      const instr = func.instructions[i];

      // Skip the back-edge JUMP to header
      if (this.isBackEdgeJump(instr, func, headerIdx)) {
        continue;
      }

      // Skip conditional jumps to the exit label (loop termination)
      if (this.isExitBranch(instr, func, exitIdx)) {
        continue;
      }

      // Skip counter increment/decrement (handled separately by partial unroll)
      // This prevents the triple-increment bug where the body already contains
      // the INC and the partial unroller adds another copy per unrolled iteration.
      if (counterName && this.isCounterModification(instr, counterName)) {
        continue;
      }

      // Skip termination check instructions (LOAD counter + CMP bound)
      // These are loop overhead, not actual work instructions.
      if (counterName && this.isTerminationCheck(instr, counterName)) {
        continue;
      }

      body.push(instr);
    }

    return body;
  }

  /**
   * Check if an instruction is the back-edge jump to the loop header.
   *
   * @param instr - Instruction to check
   * @param func - IL function (for label resolution)
   * @param headerIdx - Index of the header LABEL
   * @returns true if this is a JUMP to the header label
   */
  protected isBackEdgeJump(instr: ILInstruction, func: ILFunction, headerIdx: number): boolean {
    if (instr.opcode !== ILOpcode.JUMP) return false;

    // Check if the target matches the header label
    if (instr.operands.length > 0 && isLabelOperand(instr.operands[0])) {
      const headerInstr = func.instructions[headerIdx];
      if (
        headerInstr &&
        headerInstr.opcode === ILOpcode.LABEL &&
        headerInstr.operands.length > 0 &&
        isLabelOperand(headerInstr.operands[0])
      ) {
        return instr.operands[0].name === headerInstr.operands[0].name;
      }
    }
    return false;
  }

  /**
   * Check if an instruction is a conditional branch to the exit label.
   *
   * These are the loop termination branches (e.g., JUMP_NE loop_exit)
   * that should not be duplicated during unrolling — the unrolled body
   * should execute unconditionally.
   *
   * @param instr - Instruction to check
   * @param func - IL function (for label resolution)
   * @param exitIdx - Index of the exit LABEL
   * @returns true if this is a conditional jump to the exit label
   */
  protected isExitBranch(instr: ILInstruction, func: ILFunction, exitIdx: number): boolean {
    // Only conditional jumps can be exit branches
    if (!this.isConditionalJump(instr)) return false;

    // Check if the target matches the exit label
    if (instr.operands.length > 0 && isLabelOperand(instr.operands[0])) {
      const exitInstr = func.instructions[exitIdx];
      if (
        exitInstr &&
        exitInstr.opcode === ILOpcode.LABEL &&
        exitInstr.operands.length > 0 &&
        isLabelOperand(exitInstr.operands[0])
      ) {
        return instr.operands[0].name === exitInstr.operands[0].name;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Instruction Cloning
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Clone an instruction, producing a new instruction object.
   *
   * Creates a deep-enough copy that the clone can be modified
   * without affecting the original. Operands are shallow-copied
   * since they are immutable value objects.
   *
   * @param instr - Instruction to clone
   * @returns A new instruction identical to the original
   */
  protected cloneInstruction(instr: ILInstruction): ILInstruction {
    return {
      opcode: instr.opcode,
      operands: [...instr.operands],
      location: instr.location,
      comment: instr.comment,
      defUse: instr.defUse
        ? { defs: [...instr.defUse.defs], uses: [...instr.defUse.uses] }
        : undefined,
    };
  }

  /**
   * Clone an array of instructions for loop body duplication.
   *
   * When `copyIndex` is provided, all labels defined within the
   * instruction set are remapped with a `_u{copyIndex}` suffix to
   * ensure uniqueness across multiple unrolled copies. Without this,
   * full unrolling produces duplicate label names that cause assembler
   * errors (bug L2).
   *
   * When `copyIndex` is undefined, instructions are cloned without
   * any label remapping (backward-compatible behavior).
   *
   * @param instructions - Instructions to clone
   * @param copyIndex - Optional copy index for unique label suffixes
   * @returns Array of cloned instructions with optionally remapped labels
   */
  protected cloneInstructions(instructions: ILInstruction[], copyIndex?: number): ILInstruction[] {
    if (copyIndex === undefined) {
      // No remapping needed (single copy or legacy callers)
      return instructions.map(instr => this.cloneInstruction(instr));
    }

    // Collect all labels defined in this instruction set so we only
    // remap references to locally-defined labels (not external targets)
    const definedLabels = new Set<string>();
    for (const instr of instructions) {
      if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
        const labelOp = instr.operands[0];
        if (isLabelOperand(labelOp)) {
          definedLabels.add(labelOp.name);
        }
      }
    }

    // Clone with label remapping — append `_u{copyIndex}` to all
    // operands that reference locally-defined labels
    const suffix = `_u${copyIndex}`;
    return instructions.map(instr => {
      // Remap label operands that reference locally-defined labels.
      // We build the remapped operands first, then create the cloned
      // instruction with them (since operands is read-only).
      const remappedOperands = instr.operands.map(op => {
        if (isLabelOperand(op) && definedLabels.has(op.name)) {
          return { ...op, name: op.name + suffix };
        }
        return op;
      });

      return {
        opcode: instr.opcode,
        operands: remappedOperands,
        location: instr.location,
        comment: instr.comment,
        defUse: instr.defUse
          ? { defs: [...instr.defUse.defs], uses: [...instr.defUse.uses] }
          : undefined,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Instruction Classification
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if an instruction is a conditional jump.
   *
   * @param instr - Instruction to check
   * @returns true if conditional jump (JUMP_EQ, JUMP_NE, etc.)
   */
  protected isConditionalJump(instr: ILInstruction): boolean {
    switch (instr.opcode) {
      case ILOpcode.JUMP_EQ:
      case ILOpcode.JUMP_NE:
      case ILOpcode.JUMP_LT:
      case ILOpcode.JUMP_LE:
      case ILOpcode.JUMP_GE:
      case ILOpcode.JUMP_GT:
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if an instruction is a comparison.
   *
   * @param instr - Instruction to check
   * @returns true if comparison (CMP_BYTE, CMP_IMM)
   */
  protected isComparison(instr: ILInstruction): boolean {
    return (
      instr.opcode === ILOpcode.CMP_BYTE ||
      instr.opcode === ILOpcode.CMP_IMM ||
      // Word (16-bit) comparisons
      instr.opcode === ILOpcode.CMP_WORD_IMM ||
      instr.opcode === ILOpcode.CMP_WORD_SLOT
    );
  }

  /**
   * Check if an instruction is a counter increment or decrement.
   *
   * Counter modifications (INC_BYTE, DEC_BYTE, INC_WORD, DEC_WORD)
   * that define (write to) the named counter slot are loop overhead.
   * They must be excluded from the body to prevent the partial unroller
   * from duplicating them (since it already handles counter increments
   * separately via `findCounterIncrements()`).
   *
   * @param instr - Instruction to check
   * @param counterName - Name of the counter slot variable
   * @returns true if this instruction modifies the loop counter
   */
  protected isCounterModification(instr: ILInstruction, counterName: string): boolean {
    // Only INC/DEC opcodes can be counter modifications
    if (
      instr.opcode !== ILOpcode.INC_BYTE &&
      instr.opcode !== ILOpcode.DEC_BYTE &&
      instr.opcode !== ILOpcode.INC_WORD &&
      instr.opcode !== ILOpcode.DEC_WORD
    ) {
      return false;
    }

    // Check if this instruction defines (writes to) the counter slot
    return instr.defUse?.defs.includes(counterName) ?? false;
  }

  /**
   * Check if an instruction is part of the loop termination check.
   *
   * The termination check is typically a LOAD of the counter slot
   * followed by a CMP instruction. These are loop overhead that
   * should not be duplicated in the unrolled body — the loop
   * structure retains its own termination check.
   *
   * @param instr - Instruction to check
   * @param counterName - Name of the counter slot variable
   * @returns true if this instruction is part of the termination check
   */
  protected isTerminationCheck(instr: ILInstruction, counterName: string): boolean {
    // LOAD_BYTE of the counter (loading counter value for comparison)
    if (instr.opcode === ILOpcode.LOAD_BYTE && instr.defUse?.uses.includes(counterName)) {
      return true;
    }

    // CMP instruction that uses the counter (comparing counter to bound)
    if (this.isComparison(instr) && instr.defUse?.uses.includes(counterName)) {
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Label Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find the instruction index of a named label.
   *
   * @param func - IL function to search
   * @param labelName - Label name to find
   * @returns Index of the LABEL instruction, or -1 if not found
   */
  protected findLabelIndex(func: ILFunction, labelName: string): number {
    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      if (
        instr.opcode === ILOpcode.LABEL &&
        instr.operands.length > 0 &&
        isLabelOperand(instr.operands[0]) &&
        instr.operands[0].name === labelName
      ) {
        return i;
      }
    }
    return -1;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Debug Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a human-readable description of an instruction.
   *
   * @param instr - Instruction to describe
   * @returns String like "LOAD_BYTE" or "ADD_IMM"
   */
  protected describeInstruction(instr: ILInstruction): string {
    return ILOpcode[instr.opcode] ?? `OPCODE_${instr.opcode}`;
  }
}
