/**
 * LOAD_WORD Tests - CGT3.3
 *
 * Tests for LOAD_WORD code generation.
 * Verifies correct LDA/LDX instruction generation for 16-bit values.
 *
 * @module __tests__/codegen/unit/load-word
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpWordSlot,
  createAbsWordSlot,
  createLoadWordInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// LOAD_WORD Tests
// ============================================================================

describe('LOAD_WORD', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates LDA and LDX for zero page word', () => {
      const slot = createZpWordSlot('pointer', 0x50);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();

      // Should have LDA for low byte
      expect(countInstructions(elements, 'LDA')).toBe(1);
      // Should have LDX for high byte
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });

    it('generates LDA and LDX for absolute word', () => {
      const slot = createAbsWordSlot('data', 0x0200);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();

      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });
  });

  describe('zero page word addresses', () => {
    it('uses ZP mode for both low and high byte', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      expect(lda).toBeDefined();
      expect(ldx).toBeDefined();

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0x50); // Low byte
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(ldx.instruction.operand).toBe(0x51); // High byte (addr+1)
      }
    });

    it('loads from adjacent addresses', () => {
      const slot = createZpWordSlot('vector', 0x20);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x20);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x21);
      }
    });

    it('handles ZP word at boundary ($FE-$FF)', () => {
      const slot = createZpWordSlot('boundary', 0xfe);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0xfe);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0xff);
      }
    });
  });

  describe('absolute word addresses', () => {
    it('uses absolute mode for both bytes', () => {
      const slot = createAbsWordSlot('data', 0x0200);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      expect(lda).toBeDefined();
      expect(ldx).toBeDefined();

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0x0200);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(ldx.instruction.operand).toBe(0x0201);
      }
    });

    it('loads from screen memory base ($0400)', () => {
      const slot = createAbsWordSlot('screenPtr', 0x0400);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x0400);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x0401);
      }
    });

    it('handles high memory address ($C000)', () => {
      const slot = createAbsWordSlot('rom', 0xc000);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0xc000);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0xc001);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('invalidates A state after word load', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createLoadWordInstr(slot);

      // Pre-set A to have some value
      generator.testSetAFromSlot(0x50);
      expect(generator.testAHasSlot(0x50)).toBe(true);

      generator.testGenLoadWord(instr);

      // Word operations invalidate simple A tracking
      // (A now contains the low byte, which is complex)
      expect(generator.testAHasSlot(0x50)).toBe(false);
    });

    it('word load does not optimize like byte load', () => {
      const slot = createZpWordSlot('ptr', 0x50);

      // Two consecutive word loads should both emit instructions
      generator.testGenLoadWord(createLoadWordInstr(slot));
      generator.testGenLoadWord(createLoadWordInstr(slot));

      const elements = generator.getElements();

      // Both loads should emit (word tracking is complex)
      expect(countInstructions(elements, 'LDA')).toBe(2);
      expect(countInstructions(elements, 'LDX')).toBe(2);
    });
  });

  describe('instruction ordering', () => {
    it('emits LDA before LDX', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const instructions = elements.filter(isInstructionElement);

      let ldaIndex = -1;
      let ldxIndex = -1;

      instructions.forEach((el, index) => {
        if (isInstructionElement(el)) {
          if (el.instruction.mnemonic === 'LDA') ldaIndex = index;
          if (el.instruction.mnemonic === 'LDX') ldxIndex = index;
        }
      });

      expect(ldaIndex).toBeGreaterThanOrEqual(0);
      expect(ldxIndex).toBeGreaterThanOrEqual(0);
      expect(ldaIndex).toBeLessThan(ldxIndex);
    });
  });

  describe('C64 hardware vectors', () => {
    it('loads IRQ vector ($0314)', () => {
      const slot = createAbsWordSlot('irqVec', 0x0314);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x0314);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x0315);
      }
    });

    it('loads NMI vector ($0318)', () => {
      const slot = createAbsWordSlot('nmiVec', 0x0318);
      const instr = createLoadWordInstr(slot);

      generator.testGenLoadWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x0318);
      }
      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x0319);
      }
    });
  });
});