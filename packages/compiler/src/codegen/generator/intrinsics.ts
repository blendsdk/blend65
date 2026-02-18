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
  // STORE_ZP_PTR - Store A:X to zero-page pointer ($FB/$FC)
  // ==========================================================================

  /**
   * Generates code for STORE_ZP_PTR.
   *
   * Stores the A:X 16-bit value into the zero-page pointer at $FB/$FC.
   * This pointer is then used by POKE_INDIRECT / PEEK_INDIRECT.
   *
   * IL: STORE_ZP_PTR (no operands, operates on A:X)
   * 6502: STA $FB / STX $FC
   */
  protected genStoreZpPtr(instr: ILInstruction): void {
    this.emitComment(instr);
    // Store low byte (A) to $FB, high byte (X) to $FC
    this.asm.sta(0xFB, 'zeroPage');
    this.asm.stx(0xFC, 'zeroPage');
  }

  // ==========================================================================
  // POKE_INDIRECT - Write A through ZP pointer ($FB/$FC)
  // ==========================================================================

  /**
   * Generates code for POKE_INDIRECT.
   *
   * Writes the accumulator through the zero-page pointer using
   * 6502 indirect indexed addressing mode: STA ($FB),Y with Y=0.
   *
   * IL: POKE_INDIRECT (no operands, value in A, address in $FB/$FC)
   * 6502: LDY #0 / STA ($FB),Y
   */
  protected genPokeIndirect(instr: ILInstruction): void {
    this.emitComment(instr);
    // Y=0 for indirect indexed with no offset
    this.asm.ldy(0, 'immediate');
    // STA ($FB),Y — store A through pointer
    this.asm.sta(0xFB, 'indirectY');
  }

  // ==========================================================================
  // PEEK_INDIRECT - Read A through ZP pointer ($FB/$FC)
  // ==========================================================================

  /**
   * Generates code for PEEK_INDIRECT.
   *
   * Reads a byte through the zero-page pointer using 6502
   * indirect indexed addressing mode: LDA ($FB),Y with Y=0.
   *
   * IL: PEEK_INDIRECT (no operands, address in $FB/$FC)
   * 6502: LDY #0 / LDA ($FB),Y
   */
  protected genPeekIndirect(instr: ILInstruction): void {
    this.emitComment(instr);
    // Y=0 for indirect indexed with no offset
    this.asm.ldy(0, 'immediate');
    // LDA ($FB),Y — load through pointer
    this.asm.lda(0xFB, 'indirectY');
    this.invalidateA();
  }

  // ==========================================================================
  // POKEW_INDIRECT - Write A:X (word) through ZP pointer ($FB/$FC)
  // ==========================================================================

  /**
   * Generates code for POKEW_INDIRECT.
   *
   * Writes a 16-bit value (A:X) through the zero-page pointer:
   * 1. Store low byte (A) at ($FB),Y with Y=0
   * 2. Transfer high byte X→A via TXA
   * 3. Store high byte at ($FB),Y with Y=1
   *
   * IL: POKEW_INDIRECT (no operands, value in A:X, address in $FB/$FC)
   * 6502: LDY #0 / STA ($FB),Y / TXA / LDY #1 / STA ($FB),Y
   */
  protected genPokewIndirect(instr: ILInstruction): void {
    this.emitComment(instr);
    // Store low byte (A) at addr+0
    this.asm.ldy(0, 'immediate');
    this.asm.sta(0xFB, 'indirectY');
    // Store high byte (X→A) at addr+1
    this.asm.txa();
    this.asm.ldy(1, 'immediate');
    this.asm.sta(0xFB, 'indirectY');
    this.invalidateA();
  }

  // ==========================================================================
  // PEEKW_INDIRECT - Read A:X (word) through ZP pointer ($FB/$FC)
  // ==========================================================================

  /**
   * Generates code for PEEKW_INDIRECT.
   *
   * Reads a 16-bit value through the zero-page pointer:
   * 1. Load high byte at ($FB),Y with Y=1 → TAX
   * 2. Load low byte at ($FB),Y with Y=0 → A
   * Result: low in A, high in X (A:X convention).
   *
   * IL: PEEKW_INDIRECT (no operands, address in $FB/$FC)
   * 6502: LDY #1 / LDA ($FB),Y / TAX / LDY #0 / LDA ($FB),Y
   */
  protected genPeekwIndirect(instr: ILInstruction): void {
    this.emitComment(instr);
    // Load high byte first (addr+1) → X
    this.asm.ldy(1, 'immediate');
    this.asm.lda(0xFB, 'indirectY');
    this.asm.tax();
    // Load low byte (addr+0) → A
    this.asm.ldy(0, 'immediate');
    this.asm.lda(0xFB, 'indirectY');
    this.invalidateA();
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
      case ILOpcode.STORE_ZP_PTR:
        this.genStoreZpPtr(instr);
        break;
      case ILOpcode.POKE_INDIRECT:
        this.genPokeIndirect(instr);
        break;
      case ILOpcode.PEEK_INDIRECT:
        this.genPeekIndirect(instr);
        break;
      case ILOpcode.POKEW_INDIRECT:
        this.genPokewIndirect(instr);
        break;
      case ILOpcode.PEEKW_INDIRECT:
        this.genPeekwIndirect(instr);
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
      case ILOpcode.MEMCPY:
        this.genMemcpy(instr);
        break;
      default:
        super.generateInstruction(instr);
    }
  }

  // ==========================================================================
  // MEMCPY - Block Memory Copy via ZP Indirect Addressing
  // ==========================================================================

  /**
   * Generates optimized page-based 6502 memory copy code.
   *
   * Precondition: Source address in $FB/$FC, dest address in $FD/$FE.
   * These are set up by the preceding IL instructions (POKE to $FD/$FE
   * and STORE_ZP_PTR to $FB/$FC).
   *
   * Strategy:
   * - For count < 256: single Y-indexed loop (LDY #0, loop: LDA ($FB),Y / STA ($FD),Y / INY / CPY #count / BNE loop)
   * - For count >= 256: outer page loop (X = pages) + inner byte loop (Y = 0..255) + remainder byte loop
   *
   * The page-based approach copies 256 bytes per page, then increments
   * the high bytes of both ZP pointers to advance to the next page.
   * Any remaining bytes (count % 256) are copied in a final byte loop.
   *
   * IL: MEMCPY [ImmediateOperand(count)]
   *
   * @param instr - MEMCPY instruction with count operand
   */
  protected genMemcpy(instr: ILInstruction): void {
    this.emitComment(instr);

    const imm = this.getImmediateOperand(instr.operands);
    const count = imm.value;

    // Total pages (full 256-byte blocks) and remainder bytes
    const fullPages = Math.floor(count / 256);
    const remainder = count % 256;

    if (fullPages === 0) {
      // Small copy (< 256 bytes): single Y-indexed loop
      // LDY #0
      // .loop: LDA ($FB),Y / STA ($FD),Y / INY / CPY #remainder / BNE .loop
      const loopLabel = this.uniqueLabel('mcpy');

      this.asm.ldy(0, 'immediate');
      this.asm.label(this.localLabel(loopLabel));
      this.asm.lda(0xFB, 'indirectY');   // LDA ($FB),Y — read src byte
      this.asm.sta(0xFD, 'indirectY');   // STA ($FD),Y — write dst byte
      this.asm.iny();                     // INY — next byte
      this.asm.cpy(remainder, 'immediate');  // CPY #remainder
      this.asm.bne(this.localLabel(loopLabel));  // BNE .loop
    } else {
      // Large copy (>= 256 bytes): page-based loop
      // Outer loop: X = number of full pages
      // Inner loop: Y = 0..255 (one full page)
      // After all pages: remainder loop if remainder > 0
      const pageLabel = this.uniqueLabel('mcpg');
      const byteLabel = this.uniqueLabel('mcby');

      // LDX #fullPages — page counter
      this.asm.ldx(fullPages, 'immediate');

      // Outer page loop
      this.asm.label(this.localLabel(pageLabel));
      // LDY #0 — reset byte counter for each page
      this.asm.ldy(0, 'immediate');

      // Inner byte loop (copies 256 bytes per page)
      this.asm.label(this.localLabel(byteLabel));
      this.asm.lda(0xFB, 'indirectY');   // LDA ($FB),Y — read src
      this.asm.sta(0xFD, 'indirectY');   // STA ($FD),Y — write dst
      this.asm.iny();                     // INY
      this.asm.bne(this.localLabel(byteLabel));  // BNE .byteLoop (Y wraps 0)

      // After 256 bytes: increment high bytes of both ZP pointers
      // to advance to next page
      this.asm.inc(0xFC, 'zeroPage');     // INC $FC (src high byte)
      this.asm.inc(0xFE, 'zeroPage');     // INC $FE (dst high byte)

      // DEX / BNE — decrement page counter and loop
      this.asm.dex();
      this.asm.bne(this.localLabel(pageLabel));

      // Remainder: copy remaining bytes (count % 256)
      if (remainder > 0) {
        const remLabel = this.uniqueLabel('mcrem');

        // LDY #0 already set from the last inner loop wrap
        // But be safe: Y is 0 after INY wrapped from 255→0 and BNE fell through
        this.asm.ldy(0, 'immediate');
        this.asm.label(this.localLabel(remLabel));
        this.asm.lda(0xFB, 'indirectY');   // LDA ($FB),Y
        this.asm.sta(0xFD, 'indirectY');   // STA ($FD),Y
        this.asm.iny();
        this.asm.cpy(remainder, 'immediate');
        this.asm.bne(this.localLabel(remLabel));
      }
    }

    // All registers (A, X, Y) are clobbered by memcpy
    this.invalidateA();
  }
}
