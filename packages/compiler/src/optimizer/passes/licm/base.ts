/**
 * LICM Base — Core Analysis Helpers
 *
 * Foundation layer for the Loop Invariant Code Motion pass.
 * Provides helpers for:
 * - Collecting slot definitions within a loop body
 * - Classifying instructions (side effects, control flow)
 * - Describing instructions for debug output
 *
 * Inheritance chain: LICMBase → LICMInvariance → LICMPass
 *
 * @module optimizer/passes/licm/base
 */

import { ILOpcode } from '../../../il/enums.js';
import { isSlotOperand } from '../../../il/guards.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILFunction } from '../../../il/structures.js';

// ============================================================================
// LICMBase — Foundation for LICM
// ============================================================================

/**
 * Base class for the LICM pass inheritance chain.
 *
 * Provides foundational analysis helpers used by the invariance
 * and hoisting layers. Methods here are purely analytical — they
 * inspect instructions and loop bodies but never modify them.
 *
 * @see LICMInvariance — Adds invariance detection logic
 * @see LICMPass — Adds hoisting and the OptimizationPass run() method
 */
export class LICMBase {
  // ═══════════════════════════════════════════════════════════════════
  // Loop Body Analysis
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Collect all slot names defined (written to) within a loop body.
   *
   * Scans the instructions at the given indices and aggregates all
   * slot names from each instruction's defUse.defs. This tells us
   * which variables are modified inside the loop, which is critical
   * for determining if a LOAD is invariant.
   *
   * @param func - The IL function containing the instructions
   * @param bodyIndices - Instruction indices forming the loop body
   * @returns Set of slot names defined inside the loop
   */
  protected collectLoopDefs(func: ILFunction, bodyIndices: number[]): Set<string> {
    const defs = new Set<string>();

    for (const idx of bodyIndices) {
      const instr = func.instructions[idx];
      if (!instr) continue;

      // Collect explicit defs from defUse metadata
      if (instr.defUse) {
        for (const def of instr.defUse.defs) {
          defs.add(def);
        }
      }

      // Also detect implicit defs from store-like opcodes
      // that might not have defUse populated
      if (this.isStoreOpcode(instr.opcode)) {
        const slotName = this.getSlotName(instr);
        if (slotName !== null) {
          defs.add(slotName);
        }
      }

      // INC/DEC both read and write their operand (byte and word variants)
      if (
        instr.opcode === ILOpcode.INC_BYTE || instr.opcode === ILOpcode.DEC_BYTE ||
        instr.opcode === ILOpcode.INC_WORD || instr.opcode === ILOpcode.DEC_WORD
      ) {
        const slotName = this.getSlotName(instr);
        if (slotName !== null) {
          defs.add(slotName);
        }
      }
    }

    return defs;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Instruction Classification
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if an instruction has side effects that prevent hoisting.
   *
   * Instructions with side effects must stay in the loop body because
   * moving them could change program behavior. Side effects include:
   * - Memory stores (STORE_BYTE, STORE_WORD)
   * - Hardware I/O (POKE, POKEW)
   * - Function calls (CALL — may have arbitrary side effects)
   * - Stack operations (PUSH_A, POP_A — affect stack state)
   *
   * @param instr - Instruction to check
   * @returns true if the instruction has side effects
   */
  protected hasSideEffects(instr: ILInstruction): boolean {
    switch (instr.opcode) {
      // Memory stores — modify variable state
      case ILOpcode.STORE_BYTE:
      case ILOpcode.STORE_WORD:
        return true;

      // Hardware I/O — modify memory-mapped registers
      case ILOpcode.POKE:
      case ILOpcode.POKEW:
        return true;

      // Function calls — may have arbitrary effects
      case ILOpcode.CALL:
        return true;

      // Stack operations — modify hardware stack
      case ILOpcode.PUSH_A:
      case ILOpcode.POP_A:
        return true;

      // INC/DEC modify memory in place (byte and word variants)
      case ILOpcode.INC_BYTE:
      case ILOpcode.DEC_BYTE:
      case ILOpcode.INC_WORD:
      case ILOpcode.DEC_WORD:
        return true;

      // Indirect addressing — write through ZP pointer
      case ILOpcode.STORE_ZP_PTR:
      case ILOpcode.POKE_INDIRECT:
      case ILOpcode.POKEW_INDIRECT:
        return true;

      // Raw assembly — unknown side effects
      case ILOpcode.ASM_RAW:
      case ILOpcode.DELAY_LOOP:
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if an instruction is a control flow operation.
   *
   * Control flow instructions must not be hoisted because they
   * define the loop structure (labels, jumps, branches).
   *
   * @param instr - Instruction to check
   * @returns true if the instruction is control flow
   */
  protected isControlFlow(instr: ILInstruction): boolean {
    switch (instr.opcode) {
      case ILOpcode.LABEL:
      case ILOpcode.JUMP:
      case ILOpcode.JUMP_EQ:
      case ILOpcode.JUMP_NE:
      case ILOpcode.JUMP_LT:
      case ILOpcode.JUMP_LE:
      case ILOpcode.JUMP_GE:
      case ILOpcode.JUMP_GT:
      case ILOpcode.RETURN:
        return true;
      default:
        return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Opcode Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if an opcode is a store operation.
   *
   * @param opcode - IL opcode to check
   * @returns true if the opcode writes to a slot
   */
  protected isStoreOpcode(opcode: ILOpcode): boolean {
    return (
      opcode === ILOpcode.STORE_BYTE ||
      opcode === ILOpcode.STORE_WORD
    );
  }

  /**
   * Extract the slot name from an instruction's first operand.
   *
   * Returns null if the instruction has no slot operand.
   *
   * @param instr - Instruction to inspect
   * @returns Slot name or null
   */
  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length > 0 && isSlotOperand(instr.operands[0])) {
      return instr.operands[0].slot.name;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Debug Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a human-readable description of an instruction for debug output.
   *
   * @param instr - Instruction to describe
   * @returns String like "LOAD_BYTE" or "ADD_IMM"
   */
  protected describeInstruction(instr: ILInstruction): string {
    return ILOpcode[instr.opcode] ?? `OPCODE_${instr.opcode}`;
  }
}
