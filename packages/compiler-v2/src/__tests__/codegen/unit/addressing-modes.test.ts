/**
 * Addressing Modes Tests - CGT3.7
 *
 * Tests for zero page vs absolute addressing mode selection.
 * Verifies correct addressing mode is used based on slot location.
 *
 * @module __tests__/codegen/unit/addressing-modes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createZpWordSlot,
  createAbsWordSlot,
  createLoadByteInstr,
  createStoreByteInstr,
  createLoadWordInstr,
  createStoreWordInstr,
  findInstruction,
  findAllInstructions,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// ZP vs Absolute Mode Selection Tests
// ============================================================================

describe('Addressing Mode Selection', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('byte operations - ZP mode', () => {
    it('LOAD_BYTE uses ZP mode for ZP slot', () => {
      const slot = createZpSlot('zpVar', 0x50);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('STORE_BYTE uses ZP mode for ZP slot', () => {
      const slot = createZpSlot('zpVar', 0x50);
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  describe('byte operations - absolute mode', () => {
    it('LOAD_BYTE uses absolute mode for frame slot', () => {
      const slot = createAbsSlot('frameVar', 0x0200);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('STORE_BYTE uses absolute mode for frame slot', () => {
      const slot = createAbsSlot('frameVar', 0x0200);
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('word operations - ZP mode', () => {
    it('LOAD_WORD uses ZP mode for both bytes when slot is ZP', () => {
      const slot = createZpWordSlot('zpPtr', 0x50);
      generator.testGenLoadWord(createLoadWordInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      expect(lda).toBeDefined();
      expect(ldx).toBeDefined();

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('STORE_WORD uses ZP mode for both bytes when slot is ZP', () => {
      const slot = createZpWordSlot('zpPtr', 0x50);
      generator.testGenStoreWord(createStoreWordInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      expect(sta).toBeDefined();
      expect(stx).toBeDefined();

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  describe('word operations - absolute mode', () => {
    it('LOAD_WORD uses absolute mode for both bytes when slot is frame', () => {
      const slot = createAbsWordSlot('framePtr', 0x0200);
      generator.testGenLoadWord(createLoadWordInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      expect(lda).toBeDefined();
      expect(ldx).toBeDefined();

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('STORE_WORD uses absolute mode for both bytes when slot is frame', () => {
      const slot = createAbsWordSlot('framePtr', 0x0200);
      generator.testGenStoreWord(createStoreWordInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      expect(sta).toBeDefined();
      expect(stx).toBeDefined();

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('ZP address range', () => {
    it('address $00 uses ZP mode', () => {
      const slot = createZpSlot('first', 0x00);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0x00);
      }
    });

    it('address $FF uses ZP mode', () => {
      const slot = createZpSlot('last', 0xff);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0xff);
      }
    });

    it('C64 free ZP range $02-$8F uses ZP mode', () => {
      const addresses = [0x02, 0x50, 0x8f];

      for (const addr of addresses) {
        const gen = new TestableMemoryOpsGenerator('test');
        const slot = createZpSlot(`var_${addr}`, addr);
        gen.testGenLoadByte(createLoadByteInstr(slot));

        const elements = gen.getElements();
        const lda = findInstruction(elements, 'LDA');

        expect(lda).toBeDefined();
        if (lda && isInstructionElement(lda)) {
          expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        }
      }
    });
  });

  describe('absolute address range', () => {
    it('address $0100 uses absolute mode', () => {
      const slot = createAbsSlot('stackArea', 0x0100);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0x0100);
      }
    });

    it('frame region $0200-$03FF uses absolute mode', () => {
      const addresses = [0x0200, 0x0300, 0x03ff];

      for (const addr of addresses) {
        const gen = new TestableMemoryOpsGenerator('test');
        const slot = createAbsSlot(`frame_${addr}`, addr);
        gen.testGenLoadByte(createLoadByteInstr(slot));

        const elements = gen.getElements();
        const lda = findInstruction(elements, 'LDA');

        expect(lda).toBeDefined();
        if (lda && isInstructionElement(lda)) {
          expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      }
    });

    it('screen memory $0400-$07E7 uses absolute mode', () => {
      const slot = createAbsSlot('screen', 0x0400);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('I/O registers $D000-$DFFF uses absolute mode', () => {
      const addresses = [0xd000, 0xd020, 0xd021, 0xd800];

      for (const addr of addresses) {
        const gen = new TestableMemoryOpsGenerator('test');
        const slot = createAbsSlot(`io_${addr}`, addr);
        gen.testGenStoreByte(createStoreByteInstr(slot));

        const elements = gen.getElements();
        const sta = findInstruction(elements, 'STA');

        expect(sta).toBeDefined();
        if (sta && isInstructionElement(sta)) {
          expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      }
    });
  });

  describe('mixed operations', () => {
    it('different slots use appropriate modes', () => {
      const zpSlot = createZpSlot('zpVar', 0x50);
      const absSlot = createAbsSlot('frameVar', 0x0200);

      generator.testGenLoadByte(createLoadByteInstr(zpSlot));
      generator.testGenLoadByte(createLoadByteInstr(absSlot));

      const elements = generator.getElements();
      const ldas = findAllInstructions(elements, 'LDA');

      expect(ldas.length).toBe(2);

      // First should be ZP
      if (ldas[0] && isInstructionElement(ldas[0])) {
        expect(ldas[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }

      // Second should be absolute
      if (ldas[1] && isInstructionElement(ldas[1])) {
        expect(ldas[1].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('C64 memory map scenarios', () => {
    it('BASIC area ($0801) uses absolute', () => {
      const slot = createAbsSlot('basic', 0x0801);
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('Kernal ROM ($E000) uses absolute', () => {
      const slot = createAbsSlot('kernal', 0xe000);
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('color RAM ($D800) uses absolute', () => {
      const slot = createAbsSlot('color', 0xd800);
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });
});