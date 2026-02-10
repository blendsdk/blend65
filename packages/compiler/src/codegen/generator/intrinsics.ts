/**
 * Intrinsics Operations Generator
 *
 * Handles IL opcodes for intrinsic operations:
 * - PEEK, POKE, PEEKW, POKEW, HI, LO
 *
 * @module codegen/generator/intrinsics
 */

import { ILInstruction, ILOpcode } from '../../il/index.js';
import { AsmRawOperand } from '../../il/operands.js';
import { AsmAddressingMode } from '../asm-il/types.js';
import { FunctionOpsGenerator } from './functions.js';

/**
 * Intrinsics operations layer of the code generator.
 */
export class IntrinsicsOpsGenerator extends FunctionOpsGenerator {
  // ==========================================================================
  // PEEK - Read byte from address
  // ==========================================================================

  /**
   * Generates code for PEEK.
   *
   * IL: PEEK addr
   * 6502: LDA addr (or indirect for dynamic)
   */
  protected genPeek(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    // LDA supports: zeroPage, zeroPageX, absolute, absoluteX, absoluteY
    // (zeroPageY is not valid for LDA — only used for LDX)
    this.asm.lda(addr.address, mode as Parameters<typeof this.asm.lda>[1]);
    this.invalidateA();
  }

  // ==========================================================================
  // POKE - Write byte to address
  // ==========================================================================

  /**
   * Generates code for POKE.
   *
   * IL: POKE addr
   * 6502: STA addr
   *
   * Value to write should already be in A.
   */
  protected genPoke(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    // STA supports: zeroPage, zeroPageX, absolute, absoluteX, absoluteY
    // (zeroPageY is not valid for STA on 6502)
    this.asm.sta(addr.address, mode as Parameters<typeof this.asm.sta>[1]);
  }

  // ==========================================================================
  // PEEKW - Read word from address
  // ==========================================================================

  /**
   * Generates code for PEEKW.
   *
   * IL: PEEKW addr
   * 6502: LDA addr / LDX addr+1
   */
  protected genPeekw(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    // PEEKW only supports non-indexed addressing (zeroPage or absolute)
    this.asm.lda(addr.address, mode as Parameters<typeof this.asm.lda>[1]);
    this.asm.ldx(addr.address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');
    this.invalidateA();
  }

  // ==========================================================================
  // POKEW - Write word to address
  // ==========================================================================

  /**
   * Generates code for POKEW.
   *
   * IL: POKEW addr
   * 6502: STA addr / STX addr+1
   *
   * Value to write: low byte in A, high byte in X.
   */
  protected genPokew(instr: ILInstruction): void {
    this.emitComment(instr);
    const addr = this.getAddressOperand(instr.operands);
    const mode = this.getAddressMode(addr);
    // POKEW only supports non-indexed addressing (zeroPage or absolute)
    this.asm.sta(addr.address, mode as Parameters<typeof this.asm.sta>[1]);
    this.asm.stx(addr.address + 1, mode === 'zeroPage' ? 'zeroPage' : 'absolute');
  }

  // ==========================================================================
  // HI - Get high byte of word
  // ==========================================================================

  /**
   * Generates code for HI.
   *
   * IL: HI
   * 6502: TXA (high byte is in X, move to A)
   */
  protected genHi(instr: ILInstruction): void {
    this.emitComment(instr);
    this.asm.txa();
    this.invalidateA();
  }

  // ==========================================================================
  // LO - Get low byte of word
  // ==========================================================================

  /**
   * Generates code for LO.
   *
   * IL: LO
   * 6502: (no-op, low byte already in A)
   */
  protected genLo(instr: ILInstruction): void {
    this.emitComment(instr);
    // Low byte is already in A from the word load — LO is a no-op
  }

  // ==========================================================================
  // ASM_RAW - Raw 6502 assembly instruction from asm_*() calls
  // ==========================================================================

  /**
   * Generates code for ASM_RAW.
   *
   * Translates an ASM_RAW IL instruction into the corresponding 6502
   * assembly instruction. The AsmRawOperand carries the mnemonic and
   * addressing mode; the code generator maps these to the correct
   * ASM-IL output format.
   *
   * For implied mode: emits just the mnemonic (e.g., SEI, NOP, TAX)
   * For addressed modes: uses the AsmILBuilder's `instruction()` method
   * with the appropriate AsmAddressingMode enum value.
   *
   * @param instr - IL instruction with ASM_RAW opcode
   */
  protected genAsmRaw(instr: ILInstruction): void {
    this.emitComment(instr);

    // First operand is always the AsmRawOperand with mnemonic + addressing mode
    const asmOp = instr.operands[0] as AsmRawOperand;
    const { mnemonic, addressingMode } = asmOp;

    // Map the IL addressing mode string to the ASM-IL AsmAddressingMode enum
    const asmMode = this.mapAsmRawAddressingMode(addressingMode);

    if (addressingMode === 'implied') {
      // Implied mode: just the mnemonic, no operand
      this.asm.instruction(mnemonic, AsmAddressingMode.Implied, undefined, undefined, `asm_raw: ${mnemonic}`);
    } else {
      // Addressed mode: emit mnemonic with operand value
      // The operand value was generated by the IL generator and is
      // conceptually "in the accumulator". For ASM_RAW, we use
      // operand value 0 as a placeholder — the actual operand comes
      // from the argument expression evaluated before this instruction.
      // The code generator uses the addressing mode to format correctly.
      this.asm.instruction(mnemonic, asmMode, 0, undefined, `asm_raw: ${mnemonic}`);
    }

    // ASM_RAW instructions that modify A invalidate the accumulator state
    // Conservative approach: always invalidate since we don't track
    // which mnemonics affect A (LDA, PLA, TAX, etc.)
    this.invalidateA();
  }

  /**
   * Map an IL addressing mode string to an AsmAddressingMode enum value.
   *
   * Converts the string-based addressing mode from AsmRawOperand
   * to the typed AsmAddressingMode enum used by the AsmILBuilder.
   *
   * @param mode - IL addressing mode string (e.g., 'immediate', 'zeroPage')
   * @returns Corresponding AsmAddressingMode enum value
   */
  protected mapAsmRawAddressingMode(mode: string): AsmAddressingMode {
    switch (mode) {
      case 'implied':
        return AsmAddressingMode.Implied;
      case 'immediate':
        return AsmAddressingMode.Immediate;
      case 'zeroPage':
        return AsmAddressingMode.ZeroPage;
      case 'zeroPageX':
        return AsmAddressingMode.ZeroPageX;
      case 'zeroPageY':
        return AsmAddressingMode.ZeroPageY;
      case 'absolute':
        return AsmAddressingMode.Absolute;
      case 'absoluteX':
        return AsmAddressingMode.AbsoluteX;
      case 'absoluteY':
        return AsmAddressingMode.AbsoluteY;
      case 'indirect':
        return AsmAddressingMode.Indirect;
      case 'indirectX':
        return AsmAddressingMode.IndexedIndirect;
      case 'indirectY':
        return AsmAddressingMode.IndirectIndexed;
      case 'relative':
        return AsmAddressingMode.Relative;
      default:
        // Fallback to implied for unknown modes
        return AsmAddressingMode.Implied;
    }
  }

  // ==========================================================================
  // Dispatch Override
  // ==========================================================================

  protected override generateInstruction(instr: ILInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.PEEK:
        this.genPeek(instr);
        break;
      case ILOpcode.POKE:
        this.genPoke(instr);
        break;
      case ILOpcode.PEEKW:
        this.genPeekw(instr);
        break;
      case ILOpcode.POKEW:
        this.genPokew(instr);
        break;
      case ILOpcode.HI:
        this.genHi(instr);
        break;
      case ILOpcode.LO:
        this.genLo(instr);
        break;
      case ILOpcode.ASM_RAW:
        this.genAsmRaw(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }
}
