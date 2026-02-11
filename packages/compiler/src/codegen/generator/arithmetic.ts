/**
 * Arithmetic Operations Generator
 *
 * Handles IL opcodes for arithmetic operations:
 * - ADD_BYTE, ADD_IMM, SUB_BYTE, SUB_IMM
 * - MUL_BYTE, MUL_IMM, DIV_BYTE, MOD_BYTE
 * - INC_BYTE, DEC_BYTE
 * - ADD_WORD_BYTE_IMM, ADD_WORD_IMM, ADD_WORD_BYTE_SLOT, ADD_WORD_SLOT
 * - SUB_WORD_BYTE_IMM, SUB_WORD_IMM, SUB_WORD_BYTE_SLOT, SUB_WORD_SLOT
 * - INC_WORD, DEC_WORD
 *
 * @module codegen/generator/arithmetic
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { MemoryOpsGenerator } from './memory.js';

/**
 * Arithmetic operations layer of the code generator.
 *
 * Extends MemoryOpsGenerator with arithmetic operations.
 */
export class ArithmeticOpsGenerator extends MemoryOpsGenerator {
  // ==========================================================================
  // ADD_BYTE - Add slot value to A
  // ==========================================================================

  /**
   * Generates code for ADD_BYTE.
   *
   * IL: ADD_BYTE slot
   * 6502: CLC / ADC addr
   */
  protected genAddByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.clc();
    this.asm.adc(address, mode);
    this.invalidateA(); // Result unknown
  }

  // ==========================================================================
  // ADD_IMM - Add immediate to A
  // ==========================================================================

  /**
   * Generates code for ADD_IMM.
   *
   * When value is 1, delegates to the CPU strategy for optimal output:
   * - **6502:** CLC + ADC #1 (3 bytes)
   * - **65C02:** INC A (1 byte, preserves carry)
   *
   * For other values, uses the standard CLC + ADC #value sequence
   * (identical on both CPUs).
   *
   * IL: ADD_IMM value
   */
  protected genAddImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    if (imm.value === 1) {
      // Special case: increment A by 1 — use CPU strategy
      // On 65C02 this emits INC A (1 byte) instead of CLC + ADC #1 (3 bytes)
      this.cpu.emitIncrementA(this.asm, 'A += 1');
    } else {
      this.asm.clc();
      this.asm.adc(imm.value, 'immediate');
    }
    this.invalidateA();
  }

  // ==========================================================================
  // SUB_BYTE - Subtract slot value from A
  // ==========================================================================

  /**
   * Generates code for SUB_BYTE.
   *
   * IL: SUB_BYTE slot
   * 6502: SEC / SBC addr
   */
  protected genSubByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.sec();
    this.asm.sbc(address, mode);
    this.invalidateA();
  }

  // ==========================================================================
  // SUB_IMM - Subtract immediate from A
  // ==========================================================================

  /**
   * Generates code for SUB_IMM.
   *
   * When value is 1, delegates to the CPU strategy for optimal output:
   * - **6502:** SEC + SBC #1 (3 bytes)
   * - **65C02:** DEC A (1 byte, preserves carry)
   *
   * For other values, uses the standard SEC + SBC #value sequence
   * (identical on both CPUs).
   *
   * IL: SUB_IMM value
   */
  protected genSubImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    if (imm.value === 1) {
      // Special case: decrement A by 1 — use CPU strategy
      // On 65C02 this emits DEC A (1 byte) instead of SEC + SBC #1 (3 bytes)
      this.cpu.emitDecrementA(this.asm, 'A -= 1');
    } else {
      this.asm.sec();
      this.asm.sbc(imm.value, 'immediate');
    }
    this.invalidateA();
  }

  // ==========================================================================
  // MUL_BYTE - Multiply A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for MUL_BYTE.
   *
   * IL: MUL_BYTE slot
   * 6502: (setup) JSR __mul8
   *
   * Multiplication requires a software routine.
   * A = multiplicand, loaded from slot = multiplier
   * Result in A.
   */
  protected genMulByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (multiplicand) to temp
    this.asm.sta(0xfe, 'zeroPage', 'multiplicand');
    // Load multiplier
    this.asm.lda(address, mode, 'multiplier');
    this.asm.sta(0xff, 'zeroPage');
    // Restore multiplicand
    this.asm.lda(0xfe, 'zeroPage');
    // Call multiply routine
    this.asm.jsr('__mul8');

    this.invalidateA();
  }

  // ==========================================================================
  // MUL_IMM - Multiply A by immediate (software)
  // ==========================================================================

  /**
   * Generates code for MUL_IMM.
   *
   * IL: MUL_IMM value
   * 6502: (setup) JSR __mul8_imm
   */
  protected genMulImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);

    // Save A (multiplicand) to temp
    this.asm.sta(0xfe, 'zeroPage', 'multiplicand');
    // Load multiplier
    this.asm.lda(imm.value, 'immediate', 'multiplier');
    this.asm.sta(0xff, 'zeroPage');
    // Restore multiplicand
    this.asm.lda(0xfe, 'zeroPage');
    // Call multiply routine
    this.asm.jsr('__mul8');

    this.invalidateA();
  }

  // ==========================================================================
  // DIV_BYTE - Divide A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for DIV_BYTE.
   *
   * IL: DIV_BYTE slot
   * 6502: (setup) JSR __div8
   *
   * Division requires a software routine.
   * A = dividend, slot = divisor
   * Result (quotient) in A.
   */
  protected genDivByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (dividend) to temp
    this.asm.sta(0xfe, 'zeroPage', 'dividend');
    // Load divisor
    this.asm.lda(address, mode, 'divisor');
    this.asm.sta(0xff, 'zeroPage');
    // Restore dividend
    this.asm.lda(0xfe, 'zeroPage');
    // Call divide routine
    this.asm.jsr('__div8');

    this.invalidateA();
  }

  // ==========================================================================
  // MOD_BYTE - Modulo A by slot value (software)
  // ==========================================================================

  /**
   * Generates code for MOD_BYTE.
   *
   * IL: MOD_BYTE slot
   * 6502: (setup) JSR __mod8
   *
   * Modulo requires a software routine.
   * A = dividend, slot = divisor
   * Result (remainder) in A.
   */
  protected genModByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    // Save A (dividend) to temp
    this.asm.sta(0xfe, 'zeroPage', 'dividend');
    // Load divisor
    this.asm.lda(address, mode, 'divisor');
    this.asm.sta(0xff, 'zeroPage');
    // Restore dividend
    this.asm.lda(0xfe, 'zeroPage');
    // Call modulo routine
    this.asm.jsr('__mod8');

    this.invalidateA();
  }

  // ==========================================================================
  // INC_BYTE - Increment memory
  // ==========================================================================

  /**
   * Generates code for INC_BYTE.
   *
   * IL: INC_BYTE slot
   * 6502: INC addr
   */
  protected genIncByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.inc(address, mode);
    // Invalidate A - the memory changed but we didn't load it
  }

  // ==========================================================================
  // DEC_BYTE - Decrement memory
  // ==========================================================================

  /**
   * Generates code for DEC_BYTE.
   *
   * IL: DEC_BYTE slot
   * 6502: DEC addr
   */
  protected genDecByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);

    this.asm.dec(address, mode);
    // Invalidate A if it held this address
    if (this.aHasSlot(address)) {
      this.invalidateA();
    }
  }

  // ==========================================================================
  // ADD_WORD_BYTE_IMM - Add byte immediate to A:X (16-bit)
  // ==========================================================================

  /**
   * Generates code for ADD_WORD_BYTE_IMM.
   *
   * Adds a byte immediate to the 16-bit A:X register pair.
   * Only the low byte (A) is added; if carry overflows, X is incremented.
   *
   * IL: ADD_WORD_BYTE_IMM value
   * 6502: CLC / ADC #value / BCC +2 / INX
   *
   * This is the most common word addition pattern, used for
   * expressions like `$0400 + 5` where the addend fits in a byte.
   */
  protected genAddWordByteImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const skipLabel = this.uniqueLabel('no_carry');

    this.asm.clc();
    this.asm.adc(imm.value, 'immediate');
    // If no carry from low byte addition, skip high byte increment
    this.asm.bcc(skipLabel);
    this.asm.inx('propagate carry to high byte');
    this.asm.label(skipLabel, true);

    this.invalidateA();
  }

  // ==========================================================================
  // ADD_WORD_IMM - Add word immediate to A:X (full 16-bit)
  // ==========================================================================

  /**
   * Generates code for ADD_WORD_IMM.
   *
   * Full 16-bit addition of an immediate word to A:X.
   * Uses PHA/TXA/TAX/PLA to add both bytes with carry propagation.
   *
   * IL: ADD_WORD_IMM value
   * 6502: CLC / ADC #<value / PHA / TXA / ADC #>value / TAX / PLA
   */
  protected genAddWordImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const lo = imm.value & 0xff;
    const hi = (imm.value >> 8) & 0xff;

    this.asm.clc();
    this.asm.adc(lo, 'immediate', 'add low bytes');
    this.asm.pha('save low result');
    this.asm.txa('get high byte');
    this.asm.adc(hi, 'immediate', 'add high bytes + carry');
    this.asm.tax('high result back to X');
    this.asm.pla('restore low result to A');

    this.invalidateA();
  }

  // ==========================================================================
  // ADD_WORD_BYTE_SLOT - Add byte slot to A:X (zero-extended)
  // ==========================================================================

  /**
   * Generates code for ADD_WORD_BYTE_SLOT.
   *
   * Adds a byte variable (zero-extended to 16-bit) to A:X.
   * Common for expressions like `$0400 + i` where i is a byte variable.
   *
   * IL: ADD_WORD_BYTE_SLOT slot
   * 6502: CLC / ADC slot_addr / BCC +2 / INX
   */
  protected genAddWordByteSlot(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    const skipLabel = this.uniqueLabel('no_carry');

    this.asm.clc();
    this.asm.adc(address, mode);
    // If no carry from low byte addition, skip high byte increment
    this.asm.bcc(skipLabel);
    this.asm.inx('propagate carry to high byte');
    this.asm.label(skipLabel, true);

    this.invalidateA();
  }

  // ==========================================================================
  // ADD_WORD_SLOT - Add word slot to A:X (full 16-bit)
  // ==========================================================================

  /**
   * Generates code for ADD_WORD_SLOT.
   *
   * Full 16-bit addition of a word variable to A:X.
   * Reads both bytes of the slot and adds with carry propagation.
   *
   * IL: ADD_WORD_SLOT slot
   * 6502: CLC / ADC slot_addr / PHA / TXA / ADC slot_addr+1 / TAX / PLA
   */
  protected genAddWordSlot(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    // High byte is at address+1, use same mode category
    const hiMode = mode === 'zeroPage' ? 'zeroPage' : 'absolute';

    this.asm.clc();
    this.asm.adc(address, mode, 'add low bytes');
    this.asm.pha('save low result');
    this.asm.txa('get high byte');
    this.asm.adc(address + 1, hiMode, 'add high bytes + carry');
    this.asm.tax('high result to X');
    this.asm.pla('restore low result to A');

    this.invalidateA();
  }

  // ==========================================================================
  // SUB_WORD_BYTE_IMM - Subtract byte immediate from A:X (16-bit)
  // ==========================================================================

  /**
   * Generates code for SUB_WORD_BYTE_IMM.
   *
   * Subtracts a byte immediate from the 16-bit A:X register pair.
   * Only the low byte (A) is subtracted; if borrow occurs, X is decremented.
   *
   * IL: SUB_WORD_BYTE_IMM value
   * 6502: SEC / SBC #value / BCS +2 / DEX
   */
  protected genSubWordByteImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const skipLabel = this.uniqueLabel('no_borrow');

    this.asm.sec();
    this.asm.sbc(imm.value, 'immediate');
    // If no borrow from low byte subtraction, skip high byte decrement
    this.asm.bcs(skipLabel);
    this.asm.dex('propagate borrow to high byte');
    this.asm.label(skipLabel, true);

    this.invalidateA();
  }

  // ==========================================================================
  // SUB_WORD_IMM - Subtract word immediate from A:X (full 16-bit)
  // ==========================================================================

  /**
   * Generates code for SUB_WORD_IMM.
   *
   * Full 16-bit subtraction of an immediate word from A:X.
   * Uses PHA/TXA/TAX/PLA to subtract both bytes with borrow propagation.
   *
   * IL: SUB_WORD_IMM value
   * 6502: SEC / SBC #<value / PHA / TXA / SBC #>value / TAX / PLA
   */
  protected genSubWordImm(instr: ILInstruction): void {
    this.emitComment(instr);
    const imm = this.getImmediateOperand(instr.operands);
    const lo = imm.value & 0xff;
    const hi = (imm.value >> 8) & 0xff;

    this.asm.sec();
    this.asm.sbc(lo, 'immediate', 'subtract low bytes');
    this.asm.pha('save low result');
    this.asm.txa('get high byte');
    this.asm.sbc(hi, 'immediate', 'subtract high bytes + borrow');
    this.asm.tax('high result back to X');
    this.asm.pla('restore low result to A');

    this.invalidateA();
  }

  // ==========================================================================
  // SUB_WORD_BYTE_SLOT - Subtract byte slot from A:X (zero-extended)
  // ==========================================================================

  /**
   * Generates code for SUB_WORD_BYTE_SLOT.
   *
   * Subtracts a byte variable (zero-extended) from A:X.
   *
   * IL: SUB_WORD_BYTE_SLOT slot
   * 6502: SEC / SBC slot_addr / BCS +2 / DEX
   */
  protected genSubWordByteSlot(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    const skipLabel = this.uniqueLabel('no_borrow');

    this.asm.sec();
    this.asm.sbc(address, mode);
    // If no borrow from low byte subtraction, skip high byte decrement
    this.asm.bcs(skipLabel);
    this.asm.dex('propagate borrow to high byte');
    this.asm.label(skipLabel, true);

    this.invalidateA();
  }

  // ==========================================================================
  // SUB_WORD_SLOT - Subtract word slot from A:X (full 16-bit)
  // ==========================================================================

  /**
   * Generates code for SUB_WORD_SLOT.
   *
   * Full 16-bit subtraction of a word variable from A:X.
   * Reads both bytes of the slot and subtracts with borrow propagation.
   *
   * IL: SUB_WORD_SLOT slot
   * 6502: SEC / SBC slot_addr / PHA / TXA / SBC slot_addr+1 / TAX / PLA
   */
  protected genSubWordSlot(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    const hiMode = mode === 'zeroPage' ? 'zeroPage' : 'absolute';

    this.asm.sec();
    this.asm.sbc(address, mode, 'subtract low bytes');
    this.asm.pha('save low result');
    this.asm.txa('get high byte');
    this.asm.sbc(address + 1, hiMode, 'subtract high bytes + borrow');
    this.asm.tax('high result to X');
    this.asm.pla('restore low result to A');

    this.invalidateA();
  }

  // ==========================================================================
  // INC_WORD - Increment word slot in place
  // ==========================================================================

  /**
   * Generates code for INC_WORD.
   *
   * Increments a 16-bit value stored in a word slot.
   * Low byte is incremented first; if it wraps to 0, high byte is incremented.
   *
   * IL: INC_WORD slot
   * 6502: INC slot_addr / BNE +2 / INC slot_addr+1
   */
  protected genIncWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    const hiMode = mode === 'zeroPage' ? 'zeroPage' : 'absolute';
    const skipLabel = this.uniqueLabel('inc_done');

    // Increment low byte
    this.asm.inc(address, mode);
    // If low byte didn't wrap to 0, we're done (no carry needed)
    this.asm.bne(skipLabel);
    // Low byte wrapped to 0 — propagate carry to high byte
    this.asm.inc(address + 1, hiMode, 'carry to high byte');
    this.asm.label(skipLabel, true);

    // Invalidate A if it held this address (memory changed)
    if (this.aHasSlot(address)) {
      this.invalidateA();
    }
  }

  // ==========================================================================
  // DEC_WORD - Decrement word slot in place
  // ==========================================================================

  /**
   * Generates code for DEC_WORD.
   *
   * Decrements a 16-bit value stored in a word slot.
   * Must check if low byte is 0 before decrementing to handle borrow.
   *
   * IL: DEC_WORD slot
   * 6502: LDA slot_addr / BNE +2 / DEC slot_addr+1 / DEC slot_addr
   *
   * Note: The LDA is needed to test if low byte is 0 before we decrement.
   * If low byte is 0, decrementing it wraps to 0xFF, requiring a borrow
   * from the high byte.
   */
  protected genDecWord(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot);
    const hiMode = mode === 'zeroPage' ? 'zeroPage' : 'absolute';
    const skipLabel = this.uniqueLabel('dec_no_borrow');

    // Check if low byte is 0 (will need borrow)
    this.asm.lda(address, mode, 'check low byte for borrow');
    this.asm.bne(skipLabel);
    // Low byte is 0 — decrement high byte first (borrow)
    this.asm.dec(address + 1, hiMode, 'borrow from high byte');
    this.asm.label(skipLabel, true);
    // Always decrement low byte
    this.asm.dec(address, mode);

    // A was loaded with the original low byte value, now invalidated
    this.invalidateA();
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  /**
   * Handles arithmetic operation opcodes.
   */
  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.ADD_BYTE:
        this.genAddByte(instr);
        break;
      case ILOpcode.ADD_IMM:
        this.genAddImm(instr);
        break;
      case ILOpcode.SUB_BYTE:
        this.genSubByte(instr);
        break;
      case ILOpcode.SUB_IMM:
        this.genSubImm(instr);
        break;
      case ILOpcode.MUL_BYTE:
        this.genMulByte(instr);
        break;
      case ILOpcode.MUL_IMM:
        this.genMulImm(instr);
        break;
      case ILOpcode.DIV_BYTE:
        this.genDivByte(instr);
        break;
      case ILOpcode.MOD_BYTE:
        this.genModByte(instr);
        break;
      case ILOpcode.INC_BYTE:
        this.genIncByte(instr);
        break;
      case ILOpcode.DEC_BYTE:
        this.genDecByte(instr);
        break;

      // --- Word arithmetic (16-bit A:X) ---
      case ILOpcode.ADD_WORD_BYTE_IMM:
        this.genAddWordByteImm(instr);
        break;
      case ILOpcode.ADD_WORD_IMM:
        this.genAddWordImm(instr);
        break;
      case ILOpcode.ADD_WORD_BYTE_SLOT:
        this.genAddWordByteSlot(instr);
        break;
      case ILOpcode.ADD_WORD_SLOT:
        this.genAddWordSlot(instr);
        break;
      case ILOpcode.SUB_WORD_BYTE_IMM:
        this.genSubWordByteImm(instr);
        break;
      case ILOpcode.SUB_WORD_IMM:
        this.genSubWordImm(instr);
        break;
      case ILOpcode.SUB_WORD_BYTE_SLOT:
        this.genSubWordByteSlot(instr);
        break;
      case ILOpcode.SUB_WORD_SLOT:
        this.genSubWordSlot(instr);
        break;
      case ILOpcode.INC_WORD:
        this.genIncWord(instr);
        break;
      case ILOpcode.DEC_WORD:
        this.genDecWord(instr);
        break;

      default:
        // Pass to parent
        super.generateInstruction(instr);
    }
  }
}