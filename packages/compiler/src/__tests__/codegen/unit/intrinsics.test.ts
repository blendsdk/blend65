/**
 * Intrinsics Operations Tests
 *
 * Tests for intrinsic operation code generation:
 * - PEEK: Read byte from memory address (LDA)
 * - POKE: Write byte to memory address (STA)
 * - PEEKW: Read word from memory address (LDA/LDX)
 * - POKEW: Write word to memory address (STA/STX)
 * - HI: Get high byte of word (TXA)
 * - LO: Get low byte of word (no-op, A already has it)
 *
 * @module __tests__/codegen/unit/intrinsics.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableIntrinsicsOpsGenerator,
  createPeekInstr,
  createPokeInstr,
  createPeekwInstr,
  createPokewInstr,
  createHiInstr,
  createLoInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  getInstructions,
  hasCommentContaining,
  C64_HARDWARE,
} from './_intrinsics-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('Intrinsics Operations', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator('test');
  });

  // ==========================================================================
  // PEEK Tests
  // ==========================================================================

  describe('PEEK', () => {
    it('generates LDA instruction for absolute address', () => {
      const instr = createPeekInstr(C64_HARDWARE.BORDER);

      gen.testGenPeek(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      expect(isInstructionElement(lda)).toBe(true);
    });

    it('uses absolute addressing for non-ZP address', () => {
      const instr = createPeekInstr(C64_HARDWARE.BORDER, false);

      gen.testGenPeek(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(C64_HARDWARE.BORDER);
      }
    });

    it('uses zero page addressing for ZP address', () => {
      const instr = createPeekInstr(C64_HARDWARE.ZP_TEMP, true);

      gen.testGenPeek(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(C64_HARDWARE.ZP_TEMP);
      }
    });

    it('generates exactly one LDA instruction', () => {
      const instr = createPeekInstr(C64_HARDWARE.BORDER);

      gen.testGenPeek(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('invalidates accumulator state after peek', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenPeek(createPeekInstr(C64_HARDWARE.BORDER));

      // A is invalidated after PEEK (new value loaded)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });

    it('generates comment for PEEK instruction', () => {
      const instr = createPeekInstr(C64_HARDWARE.BORDER);

      gen.testGenPeek(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'peek')).toBe(true);
    });

    it('handles various C64 hardware registers', () => {
      const registers = [
        C64_HARDWARE.BORDER,
        C64_HARDWARE.BACKGROUND,
        C64_HARDWARE.RASTER,
        C64_HARDWARE.CIA1_PORTA,
        C64_HARDWARE.SID_VOLUME,
      ];

      for (const addr of registers) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        newGen.testGenPeek(createPeekInstr(addr));

        const elements = newGen.getElements();
        const lda = findInstruction(elements, 'LDA');

        expect(lda).toBeDefined();
        if (isInstructionElement(lda)) {
          expect(lda.instruction.operand).toBe(addr);
        }
      }
    });

    it('handles zero page addresses', () => {
      const zpAddresses = [0x02, 0xfb, 0xfc, 0xfd, 0xfe];

      for (const addr of zpAddresses) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        newGen.testGenPeek(createPeekInstr(addr, true));

        const elements = newGen.getElements();
        const lda = findInstruction(elements, 'LDA');

        if (isInstructionElement(lda)) {
          expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(lda.instruction.operand).toBe(addr);
        }
      }
    });
  });

  // ==========================================================================
  // POKE Tests
  // ==========================================================================

  describe('POKE', () => {
    it('generates STA instruction for absolute address', () => {
      const instr = createPokeInstr(C64_HARDWARE.BORDER);

      gen.testGenPoke(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      expect(isInstructionElement(sta)).toBe(true);
    });

    it('uses absolute addressing for non-ZP address', () => {
      const instr = createPokeInstr(C64_HARDWARE.BORDER, false);

      gen.testGenPoke(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');

      if (isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(C64_HARDWARE.BORDER);
      }
    });

    it('uses zero page addressing for ZP address', () => {
      const instr = createPokeInstr(C64_HARDWARE.ZP_TEMP, true);

      gen.testGenPoke(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');

      if (isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(sta.instruction.operand).toBe(C64_HARDWARE.ZP_TEMP);
      }
    });

    it('generates exactly one STA instruction', () => {
      const instr = createPokeInstr(C64_HARDWARE.BORDER);

      gen.testGenPoke(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
    });

    it('does not invalidate accumulator state after poke', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BORDER));

      // A is unchanged by STA
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });

    it('generates comment for POKE instruction', () => {
      const instr = createPokeInstr(C64_HARDWARE.BORDER);

      gen.testGenPoke(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'poke')).toBe(true);
    });

    it('can poke to VIC registers', () => {
      const vicRegs = [
        C64_HARDWARE.BORDER,
        C64_HARDWARE.BACKGROUND,
        C64_HARDWARE.VIC_CTRL1,
        C64_HARDWARE.VIC_CTRL2,
        C64_HARDWARE.SPRITE_ENABLE,
      ];

      for (const addr of vicRegs) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        newGen.testGenPoke(createPokeInstr(addr));

        const elements = newGen.getElements();
        const sta = findInstruction(elements, 'STA');

        if (isInstructionElement(sta)) {
          expect(sta.instruction.operand).toBe(addr);
        }
      }
    });

    it('can poke to SID registers', () => {
      const sidRegs = [
        C64_HARDWARE.SID_VOICE1_FREQ_LO,
        C64_HARDWARE.SID_VOICE1_FREQ_HI,
        C64_HARDWARE.SID_VOLUME,
      ];

      for (const addr of sidRegs) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        newGen.testGenPoke(createPokeInstr(addr));

        const elements = newGen.getElements();
        const sta = findInstruction(elements, 'STA');

        if (isInstructionElement(sta)) {
          expect(sta.instruction.operand).toBe(addr);
        }
      }
    });

    it('can generate multiple pokes', () => {
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BORDER));
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BACKGROUND));

      const elements = gen.getElements();
      const stas = findAllInstructions(elements, 'STA');

      expect(stas.length).toBe(2);
    });
  });

  // ==========================================================================
  // PEEKW Tests
  // ==========================================================================

  describe('PEEKW', () => {
    it('generates LDA and LDX instructions', () => {
      const instr = createPeekwInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });

    it('loads low byte into A, high byte into X', () => {
      const addr = C64_HARDWARE.ZP_PTR_LO;
      const instr = createPeekwInstr(addr, true);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(addr); // Low byte
      }
      if (isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(addr + 1); // High byte
      }
    });

    it('uses zero page addressing for ZP address', () => {
      const instr = createPeekwInstr(C64_HARDWARE.ZP_PTR_LO, true);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      if (isInstructionElement(ldx)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('uses absolute addressing for non-ZP address', () => {
      const instr = createPeekwInstr(0x0400, false);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
      if (isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('invalidates accumulator state after peekw', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO));

      // A is invalidated (new value loaded)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });

    it('generates comment for PEEKW instruction', () => {
      const instr = createPeekwInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'peekw')).toBe(true);
    });

    it('generates exactly two load instructions', () => {
      const instr = createPeekwInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPeekw(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(2);
    });
  });

  // ==========================================================================
  // POKEW Tests
  // ==========================================================================

  describe('POKEW', () => {
    it('generates STA and STX instructions', () => {
      const instr = createPokewInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'STX')).toBe(1);
    });

    it('stores low byte from A, high byte from X', () => {
      const addr = C64_HARDWARE.ZP_PTR_LO;
      const instr = createPokewInstr(addr, true);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(addr); // Low byte
      }
      if (isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(addr + 1); // High byte
      }
    });

    it('uses zero page addressing for ZP address', () => {
      const instr = createPokewInstr(C64_HARDWARE.ZP_PTR_LO, true);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      if (isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('uses absolute addressing for non-ZP address', () => {
      const instr = createPokewInstr(0x0400, false);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
      if (isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('does not invalidate accumulator state after pokew', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenPokew(createPokewInstr(C64_HARDWARE.ZP_PTR_LO));

      // A is unchanged by STA (stores don't modify A)
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });

    it('generates comment for POKEW instruction', () => {
      const instr = createPokewInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'pokew')).toBe(true);
    });

    it('generates exactly two store instructions', () => {
      const instr = createPokewInstr(C64_HARDWARE.ZP_PTR_LO);

      gen.testGenPokew(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(2);
    });
  });

  // ==========================================================================
  // HI Tests
  // ==========================================================================

  describe('HI', () => {
    it('generates TXA instruction', () => {
      const instr = createHiInstr();

      gen.testGenHi(instr);

      const elements = gen.getElements();
      const txa = findInstruction(elements, 'TXA');

      expect(txa).toBeDefined();
      expect(isInstructionElement(txa)).toBe(true);
    });

    it('generates exactly one TXA instruction', () => {
      const instr = createHiInstr();

      gen.testGenHi(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TXA')).toBe(1);
    });

    it('invalidates accumulator state after HI', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenHi(createHiInstr());

      // A is invalidated (value from X moved to A)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });

    it('generates comment for HI instruction', () => {
      const instr = createHiInstr();

      gen.testGenHi(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'hi')).toBe(true);
    });

    it('TXA has implied addressing mode', () => {
      gen.testGenHi(createHiInstr());

      const elements = gen.getElements();
      const txa = findInstruction(elements, 'TXA');

      if (isInstructionElement(txa)) {
        expect(txa.instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('can be used after PEEKW to extract high byte', () => {
      // Simulate: word = peekw(addr); highByte = hi(word)
      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO));
      gen.testGenHi(createHiInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
    });
  });

  // ==========================================================================
  // LO Tests
  // ==========================================================================

  describe('LO', () => {
    it('generates comment (no-op)', () => {
      const instr = createLoInstr();

      gen.testGenLo(instr);

      const elements = gen.getElements();
      // LO is essentially a no-op since low byte is already in A
      expect(hasCommentContaining(elements, 'lo')).toBe(true);
    });

    it('does not generate any load/store instructions', () => {
      const instr = createLoInstr();

      gen.testGenLo(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(0);
      expect(countInstructions(elements, 'STA')).toBe(0);
      expect(countInstructions(elements, 'TXA')).toBe(0);
      expect(countInstructions(elements, 'TAX')).toBe(0);
    });

    it('does not invalidate accumulator state', () => {
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      gen.testGenLo(createLoInstr());

      // A is unchanged (LO is a no-op)
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });

    it('can be used after PEEKW to keep low byte', () => {
      // Simulate: word = peekw(addr); lowByte = lo(word)
      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO));
      gen.testGenLo(createLoInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
      // No TXA (because we want the low byte, which is already in A)
      expect(countInstructions(elements, 'TXA')).toBe(0);
    });
  });

  // ==========================================================================
  // Combined Intrinsics Tests
  // ==========================================================================

  describe('Combined Intrinsics', () => {
    it('can read-modify-write hardware register', () => {
      // Simulate: value = peek(BORDER); poke(BACKGROUND, value)
      gen.testGenPeek(createPeekInstr(C64_HARDWARE.BORDER));
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BACKGROUND));

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(1);
    });

    it('can copy word from one location to another', () => {
      // Simulate: word = peekw(src); pokew(dst, word)
      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO, true));
      gen.testGenPokew(createPokewInstr(0x0400, false));

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'STX')).toBe(1);
    });

    it('can extract both bytes from word', () => {
      // Simulate: word = peekw(addr); low = lo(word); high = hi(word)
      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO));
      gen.testGenPoke(createPokeInstr(0x0400)); // Store low byte
      gen.testGenHi(createHiInstr()); // Get high byte to A
      gen.testGenPoke(createPokeInstr(0x0401)); // Store high byte

      const elements = gen.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
      expect(countInstructions(elements, 'STA')).toBe(2);
      expect(countInstructions(elements, 'TXA')).toBe(1);
    });

    it('can set multiple VIC registers', () => {
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BORDER));
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BACKGROUND));
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.SPRITE_ENABLE));

      const elements = gen.getElements();
      expect(countInstructions(elements, 'STA')).toBe(3);
    });

    it('can read keyboard input from CIA', () => {
      // Simulate: reading keyboard matrix
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.CIA1_PORTA)); // Set column
      gen.testGenPeek(createPeekInstr(C64_HARDWARE.CIA1_PORTB)); // Read row

      const elements = gen.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  // ==========================================================================
  // Instruction Count Verification
  // ==========================================================================

  describe('Instruction Count Verification', () => {
    it('PEEK generates single instruction', () => {
      gen.testGenPeek(createPeekInstr(C64_HARDWARE.BORDER));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(1);
    });

    it('POKE generates single instruction', () => {
      gen.testGenPoke(createPokeInstr(C64_HARDWARE.BORDER));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(1);
    });

    it('PEEKW generates two instructions', () => {
      gen.testGenPeekw(createPeekwInstr(C64_HARDWARE.ZP_PTR_LO));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(2);
    });

    it('POKEW generates two instructions', () => {
      gen.testGenPokew(createPokewInstr(C64_HARDWARE.ZP_PTR_LO));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(2);
    });

    it('HI generates single instruction', () => {
      gen.testGenHi(createHiInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(1);
    });

    it('LO generates zero instructions', () => {
      gen.testGenLo(createLoInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);
      expect(instructions.length).toBe(0);
    });
  });

  // ==========================================================================
  // Addressing Mode Consistency Tests
  // ==========================================================================

  describe('Addressing Mode Consistency', () => {
    it('auto-detects zero page for addresses <= 0xFF', () => {
      const zpAddresses = [0x00, 0x02, 0x50, 0xfb, 0xff];

      for (const addr of zpAddresses) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        // Not explicitly specifying isZeroPage - should auto-detect
        newGen.testGenPeek(createPeekInstr(addr));

        const elements = newGen.getElements();
        const lda = findInstruction(elements, 'LDA');

        if (isInstructionElement(lda)) {
          expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        }
      }
    });

    it('auto-detects absolute for addresses > 0xFF', () => {
      const absAddresses = [0x0100, 0x0400, 0xd020, 0xffff];

      for (const addr of absAddresses) {
        const newGen = new TestableIntrinsicsOpsGenerator('test');
        newGen.testGenPeek(createPeekInstr(addr));

        const elements = newGen.getElements();
        const lda = findInstruction(elements, 'LDA');

        if (isInstructionElement(lda)) {
          expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      }
    });

    it('respects explicit isZeroPage flag', () => {
      // Force absolute mode for a small address
      const newGen = new TestableIntrinsicsOpsGenerator('test');
      newGen.testGenPeek(createPeekInstr(0x50, false));

      const elements = newGen.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });
});