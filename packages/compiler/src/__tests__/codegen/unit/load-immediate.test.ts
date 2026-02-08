/**
 * LOAD_IMM and LOAD_IMM_WORD Tests - CGT3.5-CGT3.6
 *
 * Tests for immediate value code generation.
 * Verifies correct LDA #value and LDA #lo / LDX #hi generation.
 *
 * @module __tests__/codegen/unit/load-immediate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createLoadImmInstr,
  createLoadImmWordInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// LOAD_IMM Tests (CGT3.5)
// ============================================================================

describe('LOAD_IMM', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates LDA #value for immediate', () => {
      const instr = createLoadImmInstr(42);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(lda.instruction.operand).toBe(42);
      }
    });

    it('generates exactly one LDA instruction', () => {
      const instr = createLoadImmInstr(100);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('byte value range', () => {
    it('loads minimum value 0', () => {
      const instr = createLoadImmInstr(0);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0);
      }
    });

    it('loads maximum byte value 255 ($FF)', () => {
      const instr = createLoadImmInstr(255);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(255);
      }
    });

    it('loads common value 1', () => {
      const instr = createLoadImmInstr(1);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(1);
      }
    });

    it('loads hex value $7F (127)', () => {
      const instr = createLoadImmInstr(0x7f);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x7f);
      }
    });

    it('loads hex value $80 (128)', () => {
      const instr = createLoadImmInstr(0x80);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x80);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('updates A state after loading immediate', () => {
      const instr = createLoadImmInstr(42);

      expect(generator.testAHasImmediate(42)).toBe(false);

      generator.testGenLoadImm(instr);

      expect(generator.testAHasImmediate(42)).toBe(true);
    });

    it('skips LDA when A already has the immediate value', () => {
      const instr = createLoadImmInstr(42);

      // Pre-set A to have this immediate value
      generator.testSetAFromImmediate(42);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      // Should not emit LDA since A already has the value
      expect(countInstructions(elements, 'LDA')).toBe(0);
    });

    it('emits comment when skipping redundant load', () => {
      const instr = createLoadImmInstr(42);

      // Pre-set A to have this immediate value
      generator.testSetAFromImmediate(42);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'A already has')).toBe(true);
    });

    it('loads when A has different immediate', () => {
      const instr = createLoadImmInstr(42);

      // Pre-set A to have different value
      generator.testSetAFromImmediate(100);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      // Should emit LDA since A has different value
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('loads after A is invalidated', () => {
      const instr = createLoadImmInstr(42);

      // Pre-set then invalidate
      generator.testSetAFromImmediate(42);
      generator.testInvalidateA();

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      // Should emit LDA since A was invalidated
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('multiple immediate loads', () => {
    it('optimizes sequential loads of same value', () => {
      // First load
      generator.testGenLoadImm(createLoadImmInstr(42));
      // Second load of same value (should be skipped)
      generator.testGenLoadImm(createLoadImmInstr(42));

      const elements = generator.getElements();
      // Only first load should generate LDA
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('loads both when different values', () => {
      generator.testGenLoadImm(createLoadImmInstr(42));
      generator.testGenLoadImm(createLoadImmInstr(100));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('common C64 values', () => {
    it('loads screen code space ($20)', () => {
      const instr = createLoadImmInstr(0x20);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x20);
      }
    });

    it('loads common color value ($01 - white)', () => {
      const instr = createLoadImmInstr(0x01);

      generator.testGenLoadImm(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x01);
      }
    });
  });
});

// ============================================================================
// LOAD_IMM_WORD Tests (CGT3.6)
// ============================================================================

describe('LOAD_IMM_WORD', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates LDA #lo and LDX #hi for word immediate', () => {
      const instr = createLoadImmWordInstr(0x1234);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();

      expect(countInstructions(elements, 'LDA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });

    it('uses immediate mode for both registers', () => {
      const instr = createLoadImmWordInstr(0x1234);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      expect(lda).toBeDefined();
      expect(ldx).toBeDefined();

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Immediate);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });
  });

  describe('byte splitting', () => {
    it('splits $1234 into $34 (lo) and $12 (hi)', () => {
      const instr = createLoadImmWordInstr(0x1234);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x34); // Low byte
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x12); // High byte
      }
    });

    it('handles value $0000', () => {
      const instr = createLoadImmWordInstr(0x0000);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x00);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x00);
      }
    });

    it('handles max value $FFFF', () => {
      const instr = createLoadImmWordInstr(0xffff);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0xff);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0xff);
      }
    });

    it('handles value $00FF (lo=$FF, hi=$00)', () => {
      const instr = createLoadImmWordInstr(0x00ff);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0xff);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x00);
      }
    });

    it('handles value $FF00 (lo=$00, hi=$FF)', () => {
      const instr = createLoadImmWordInstr(0xff00);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x00);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0xff);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('invalidates A state after word immediate load', () => {
      const instr = createLoadImmWordInstr(0x1234);

      generator.testSetAFromImmediate(0x34);
      expect(generator.testAHasImmediate(0x34)).toBe(true);

      generator.testGenLoadImmWord(instr);

      // Word operations invalidate simple A tracking
      expect(generator.testAHasImmediate(0x34)).toBe(false);
    });

    it('word immediate load does not optimize', () => {
      // Two consecutive word immediate loads should both emit
      generator.testGenLoadImmWord(createLoadImmWordInstr(0x1234));
      generator.testGenLoadImmWord(createLoadImmWordInstr(0x1234));

      const elements = generator.getElements();

      expect(countInstructions(elements, 'LDA')).toBe(2);
      expect(countInstructions(elements, 'LDX')).toBe(2);
    });
  });

  describe('instruction ordering', () => {
    it('emits LDA before LDX', () => {
      const instr = createLoadImmWordInstr(0x1234);

      generator.testGenLoadImmWord(instr);

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

  describe('C64 common addresses as immediates', () => {
    it('loads screen memory address ($0400)', () => {
      const instr = createLoadImmWordInstr(0x0400);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x00); // Low byte of $0400
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x04); // High byte of $0400
      }
    });

    it('loads BASIC start address ($0801)', () => {
      const instr = createLoadImmWordInstr(0x0801);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x01);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0x08);
      }
    });

    it('loads VIC register base ($D000)', () => {
      const instr = createLoadImmWordInstr(0xd000);

      generator.testGenLoadImmWord(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');
      const ldx = findInstruction(elements, 'LDX');

      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x00);
      }

      if (ldx && isInstructionElement(ldx)) {
        expect(ldx.instruction.operand).toBe(0xd0);
      }
    });
  });
});