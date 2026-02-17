/**
 * IL Builder - Base Layer
 *
 * Foundation class with core infrastructure:
 * - Instruction storage
 * - Label management
 * - Source location tracking
 * - Core emit() method
 *
 * @module il/builder/base
 */

import { SourceLocation } from '../../ast/base.js';
import { ILOpcode } from '../enums.js';
import { ILInstruction, InstructionCost, DefUse } from '../instruction.js';
import { ILOperand, SlotOperand } from '../operands.js';
import { createLabelOperand } from '../factories.js';
import { isSlotOperand } from '../guards.js';

// ============================================================================
// Cost Computation
// ============================================================================

/**
 * Base cost table for IL opcodes.
 *
 * Maps opcodes to estimated 6502 cycles, bytes, and memory accesses.
 * These are approximate values for optimization guidance.
 */
const BASE_COST_TABLE: Record<ILOpcode, InstructionCost> = {
  // Memory operations
  [ILOpcode.LOAD_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.STORE_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.LOAD_WORD]: { cycles: 6, bytes: 4, memoryAccesses: 2 },
  [ILOpcode.STORE_WORD]: { cycles: 6, bytes: 4, memoryAccesses: 2 },
  [ILOpcode.LOAD_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.LOAD_IMM_WORD]: { cycles: 4, bytes: 4, memoryAccesses: 0 },
  [ILOpcode.LOAD_ADDRESS]: { cycles: 4, bytes: 4, memoryAccesses: 0 },
  [ILOpcode.LOAD_ADDRESS_EXPR]: { cycles: 2, bytes: 2, memoryAccesses: 0 },

  // Arithmetic operations
  [ILOpcode.ADD_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.SUB_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.ADD_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.SUB_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.MUL_BYTE]: { cycles: 20, bytes: 10, memoryAccesses: 2 }, // Software mult
  [ILOpcode.MUL_IMM]: { cycles: 18, bytes: 8, memoryAccesses: 1 }, // Software mult with imm
  [ILOpcode.DIV_BYTE]: { cycles: 40, bytes: 20, memoryAccesses: 4 }, // Software div
  [ILOpcode.DIV_IMM]: { cycles: 38, bytes: 18, memoryAccesses: 3 }, // Software div with imm
  [ILOpcode.MOD_BYTE]: { cycles: 40, bytes: 20, memoryAccesses: 4 },
  [ILOpcode.MOD_IMM]: { cycles: 38, bytes: 18, memoryAccesses: 3 }, // Software mod with imm
  [ILOpcode.INC_BYTE]: { cycles: 5, bytes: 3, memoryAccesses: 2 },
  [ILOpcode.DEC_BYTE]: { cycles: 5, bytes: 3, memoryAccesses: 2 },

  // Word (16-bit) arithmetic operations
  // Costs reflect multi-instruction 6502 sequences for 16-bit math
  [ILOpcode.ADD_WORD_IMM]: { cycles: 15, bytes: 9, memoryAccesses: 0 }, // CLC/ADC#lo/PHA/TXA/ADC#hi/TAX/PLA
  [ILOpcode.ADD_WORD_BYTE_IMM]: { cycles: 6, bytes: 5, memoryAccesses: 0 }, // CLC/ADC#byte/BCC+2/INX
  [ILOpcode.ADD_WORD_SLOT]: { cycles: 17, bytes: 9, memoryAccesses: 2 }, // CLC/ADC slot/PHA/TXA/ADC slot+1/TAX/PLA
  [ILOpcode.ADD_WORD_BYTE_SLOT]: { cycles: 8, bytes: 5, memoryAccesses: 1 }, // CLC/ADC slot/BCC+2/INX
  [ILOpcode.SUB_WORD_IMM]: { cycles: 15, bytes: 9, memoryAccesses: 0 }, // SEC/SBC#lo/PHA/TXA/SBC#hi/TAX/PLA
  [ILOpcode.SUB_WORD_BYTE_IMM]: { cycles: 6, bytes: 5, memoryAccesses: 0 }, // SEC/SBC#byte/BCS+2/DEX
  [ILOpcode.SUB_WORD_SLOT]: { cycles: 17, bytes: 9, memoryAccesses: 2 }, // SEC/SBC slot/PHA/TXA/SBC slot+1/TAX/PLA
  [ILOpcode.SUB_WORD_BYTE_SLOT]: { cycles: 8, bytes: 5, memoryAccesses: 1 }, // SEC/SBC slot/BCS+2/DEX
  [ILOpcode.PROMOTE_BYTE_WORD]: { cycles: 2, bytes: 2, memoryAccesses: 0 }, // LDX #0
  [ILOpcode.INC_WORD]: { cycles: 12, bytes: 8, memoryAccesses: 4 }, // INC slot/BNE+2/INC slot+1 (2 RMW ops)
  [ILOpcode.DEC_WORD]: { cycles: 16, bytes: 11, memoryAccesses: 5 }, // LDA slot/BNE+2/DEC slot+1/DEC slot (read + 2 RMW ops)

  // Bitwise operations
  [ILOpcode.AND_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.OR_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.XOR_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.AND_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.OR_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.XOR_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.NOT_BYTE]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.SHL_BYTE]: { cycles: 4, bytes: 2, memoryAccesses: 0 }, // Per shift
  [ILOpcode.SHR_BYTE]: { cycles: 4, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.SHR_WORD]: { cycles: 12, bytes: 6, memoryAccesses: 0 }, // Per shift: PHA/TXA/LSR/TAX/PLA/ROR
  [ILOpcode.SHR_WORD_LO]: { cycles: 13, bytes: 8, memoryAccesses: 1 }, // STA tmp/TXA + (8-N)×(ASL tmp/ROL A) — avg for N=6

  // Comparison operations
  [ILOpcode.CMP_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
  [ILOpcode.CMP_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.CMP_WORD_IMM]: { cycles: 6, bytes: 6, memoryAccesses: 0 }, // CPX #>imm/BNE .done/CMP #<imm
  [ILOpcode.CMP_WORD_SLOT]: { cycles: 10, bytes: 8, memoryAccesses: 2 }, // CPX slot+1/BNE .done/CMP slot

  // Control flow
  [ILOpcode.LABEL]: { cycles: 0, bytes: 0, memoryAccesses: 0 },
  [ILOpcode.JUMP]: { cycles: 3, bytes: 3, memoryAccesses: 0 },
  [ILOpcode.JUMP_EQ]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.JUMP_NE]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.JUMP_LT]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.JUMP_LE]: { cycles: 4, bytes: 4, memoryAccesses: 0 },
  [ILOpcode.JUMP_GE]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.JUMP_GT]: { cycles: 4, bytes: 4, memoryAccesses: 0 },

  // Function operations
  [ILOpcode.CALL]: { cycles: 6, bytes: 3, memoryAccesses: 2 },
  [ILOpcode.RETURN]: { cycles: 6, bytes: 1, memoryAccesses: 2 },

  // Register transfers
  [ILOpcode.TRANSFER_AX]: { cycles: 2, bytes: 1, memoryAccesses: 0 },
  [ILOpcode.TRANSFER_AY]: { cycles: 2, bytes: 1, memoryAccesses: 0 },
  [ILOpcode.TRANSFER_XA]: { cycles: 2, bytes: 1, memoryAccesses: 0 },
  [ILOpcode.TRANSFER_YA]: { cycles: 2, bytes: 1, memoryAccesses: 0 },

  // Stack operations
  [ILOpcode.PUSH_A]: { cycles: 3, bytes: 1, memoryAccesses: 1 },
  [ILOpcode.POP_A]: { cycles: 4, bytes: 1, memoryAccesses: 1 },

  // Intrinsics
  [ILOpcode.PEEK]: { cycles: 4, bytes: 3, memoryAccesses: 1 },
  [ILOpcode.POKE]: { cycles: 4, bytes: 3, memoryAccesses: 1 },
  [ILOpcode.PEEKW]: { cycles: 8, bytes: 6, memoryAccesses: 2 },
  [ILOpcode.POKEW]: { cycles: 8, bytes: 6, memoryAccesses: 2 },
  [ILOpcode.STORE_ZP_PTR]: { cycles: 6, bytes: 4, memoryAccesses: 2 },    // STA $FB + STX $FC
  [ILOpcode.POKE_INDIRECT]: { cycles: 8, bytes: 4, memoryAccesses: 1 },   // LDY #0 + STA ($FB),Y
  [ILOpcode.PEEK_INDIRECT]: { cycles: 7, bytes: 4, memoryAccesses: 1 },   // LDY #0 + LDA ($FB),Y
  [ILOpcode.POKEW_INDIRECT]: { cycles: 14, bytes: 8, memoryAccesses: 2 }, // LDY #0 + STA ($FB),Y + TXA + LDY #1 + STA ($FB),Y
  [ILOpcode.PEEKW_INDIRECT]: { cycles: 14, bytes: 8, memoryAccesses: 2 }, // LDY #1 + LDA ($FB),Y + TAX + LDY #0 + LDA ($FB),Y
  [ILOpcode.HI]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
  [ILOpcode.LO]: { cycles: 2, bytes: 2, memoryAccesses: 0 },

  // Special
  [ILOpcode.NOP]: { cycles: 2, bytes: 1, memoryAccesses: 0 },
  // BARRIER is a pseudo-instruction: no runtime code, zero cost
  [ILOpcode.BARRIER]: { cycles: 0, bytes: 0, memoryAccesses: 0 },
  // ASM_RAW costs vary per instruction; use average 6502 instruction cost
  [ILOpcode.ASM_RAW]: { cycles: 3, bytes: 2, memoryAccesses: 1 },
};

/**
 * Compute instruction cost based on opcode and operands.
 *
 * Adjusts cost based on addressing mode (ZP is cheaper).
 *
 * @param instr - Instruction to compute cost for
 * @returns Instruction cost
 */
export function computeInstructionCost(instr: ILInstruction): InstructionCost {
  const baseCost = BASE_COST_TABLE[instr.opcode];

  // Adjust for zero page addressing (saves 1 cycle, 1 byte)
  if (instr.operands.length > 0) {
    const firstOp = instr.operands[0];
    if (isSlotOperand(firstOp)) {
      const slot = (firstOp as SlotOperand).slot;
      if (slot.address !== undefined && slot.address < 0x100) {
        return {
          cycles: Math.max(baseCost.cycles - 1, 2),
          bytes: Math.max(baseCost.bytes - 1, 1),
          memoryAccesses: baseCost.memoryAccesses,
        };
      }
    }
  }

  return baseCost;
}

/**
 * Compute def-use information for an instruction.
 *
 * @param instr - Instruction to analyze
 * @returns Def-use information
 */
export function computeDefUse(instr: ILInstruction): DefUse {
  const defs: string[] = [];
  const uses: string[] = [];

  // Extract slot names from operands
  for (const op of instr.operands) {
    if (isSlotOperand(op)) {
      const slotName = op.slot.name;

      // Determine if this is a def or use based on opcode
      switch (instr.opcode) {
        case ILOpcode.STORE_BYTE:
        case ILOpcode.STORE_WORD:
        case ILOpcode.INC_BYTE:
        case ILOpcode.DEC_BYTE:
        // Word increment/decrement also modify the slot in place
        case ILOpcode.INC_WORD:
        case ILOpcode.DEC_WORD:
          defs.push(slotName);
          // INC/DEC (byte and word) also use the slot
          if (
            instr.opcode === ILOpcode.INC_BYTE ||
            instr.opcode === ILOpcode.DEC_BYTE ||
            instr.opcode === ILOpcode.INC_WORD ||
            instr.opcode === ILOpcode.DEC_WORD
          ) {
            uses.push(slotName);
          }
          break;

        case ILOpcode.LOAD_BYTE:
        case ILOpcode.LOAD_WORD:
        case ILOpcode.ADD_BYTE:
        case ILOpcode.SUB_BYTE:
        case ILOpcode.AND_BYTE:
        case ILOpcode.OR_BYTE:
        case ILOpcode.XOR_BYTE:
        case ILOpcode.CMP_BYTE:
        // Word arithmetic slot opcodes read from the slot
        case ILOpcode.ADD_WORD_SLOT:
        case ILOpcode.ADD_WORD_BYTE_SLOT:
        case ILOpcode.SUB_WORD_SLOT:
        case ILOpcode.SUB_WORD_BYTE_SLOT:
        // Word comparison with slot reads from it
        case ILOpcode.CMP_WORD_SLOT:
          uses.push(slotName);
          break;
      }
    }
  }

  return { defs, uses };
}

// ============================================================================
// ILBuilderBase Class
// ============================================================================

/**
 * Base class for IL Builder.
 *
 * Provides core infrastructure:
 * - Instruction storage and retrieval
 * - Label management (generation and emission)
 * - Source location tracking
 * - Core emit() method with cost/def-use computation
 *
 * Extended by operation-specific layers.
 */
export class ILBuilderBase {
  /** Accumulated instructions */
  protected instructions: ILInstruction[] = [];

  /** Label counter for unique names */
  protected labelCounter: number = 0;

  /** Current source location (for debugging) */
  protected currentLocation?: SourceLocation;

  // ═══════════════════════════════════════════════════════════════════
  // Label Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate a unique label name.
   *
   * @param prefix - Label prefix (default: 'L')
   * @returns Unique label name
   */
  newLabel(prefix: string = 'L'): string {
    return `${prefix}${this.labelCounter++}`;
  }

  /**
   * Emit a label definition.
   *
   * @param name - Label name
   */
  label(name: string): void {
    this.emit(ILOpcode.LABEL, [createLabelOperand(name)]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Source Location
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Set current source location for subsequent instructions.
   *
   * @param location - Source location
   */
  setLocation(location: SourceLocation): void {
    this.currentLocation = location;
  }

  /**
   * Clear current source location.
   */
  clearLocation(): void {
    this.currentLocation = undefined;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Core Emit
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Emit a raw instruction with operands.
   *
   * Automatically computes cost and def-use information.
   *
   * @param opcode - IL opcode
   * @param operands - Instruction operands
   * @param comment - Optional comment
   */
  emit(opcode: ILOpcode, operands: ILOperand[], comment?: string): void {
    const instr: ILInstruction = {
      opcode,
      operands,
      location: this.currentLocation,
      comment,
    };

    // Compute cost and def-use
    instr.cost = computeInstructionCost(instr);
    instr.defUse = computeDefUse(instr);

    this.instructions.push(instr);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get all built instructions.
   *
   * @returns Array of instructions
   */
  getInstructions(): ILInstruction[] {
    return this.instructions;
  }

  /**
   * Get instruction count.
   *
   * @returns Number of instructions
   */
  getInstructionCount(): number {
    return this.instructions.length;
  }

  /**
   * Clear instructions for reuse.
   */
  clear(): void {
    this.instructions = [];
    // NOTE: labelCounter is intentionally NOT reset here.
    // Labels must be unique across all functions in a module.
    // clear() is called per-function (via beginFunction()) and during
    // global init save/restore, so resetting the counter would produce
    // duplicate labels like .while0 in multiple functions.
    this.currentLocation = undefined;
  }
}