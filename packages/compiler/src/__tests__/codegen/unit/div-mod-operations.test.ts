/**
 * DIV and MOD Operations Unit Tests
 *
 * Tests for DIV_BYTE and MOD_BYTE code generation.
 *
 * DIV_BYTE: Divides accumulator by a slot value (quotient)
 * MOD_BYTE: Divides accumulator by a slot value (remainder)
 *
 * Since the 6502 has no native divide instruction, these operations
 * use software routines (__div8, __mod8) with temp storage:
 * - Save A (dividend) to $FE
 * - Load divisor to $FF
 * - Restore A and call __div8/__mod8
 *
 * @module __tests__/codegen/unit/div-mod-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createDivByteInstr,
  createModByteInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

describe('DIV/MOD Operations Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  // ==========================================================================
  // DIV_BYTE - Divide A by slot value (quotient)
  // ==========================================================================

  describe('DIV_BYTE', () => {
    describe('instruction sequence', () => {
      it('should generate correct sequence for DIV_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        // Expected: STA $FE, LDA slot, STA $FF, LDA $FE, JSR __div8
        expect(countInstructions(elements, 'STA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'LDA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'JSR')).toBe(1);
      });

      it('should save dividend to $FE first', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        expect(staInstructions.length).toBeGreaterThanOrEqual(2);

        // First STA should be to $FE
        if (isInstructionElement(staInstructions[0])) {
          expect(staInstructions[0].instruction.operand).toBe(0xfe);
        }
      });

      it('should load divisor from slot', () => {
        const slot = createZpSlot('divisor', 0x20);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot address
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x20
        );
        expect(loadFromSlot).toBeDefined();
      });

      it('should store divisor to $FF', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        const storeToFF = staInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xff
        );
        expect(storeToFF).toBeDefined();
      });

      it('should restore dividend from $FE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from $FE
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromFE = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
        );
        expect(loadFromFE).toBeDefined();
      });

      it('should call __div8 routine', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        const jsr = findInstruction(elements, 'JSR');
        expect(jsr).toBeDefined();
        if (jsr && isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe('__div8');
        }
      });
    });

    describe('zero page vs absolute', () => {
      it('should use zero page addressing for ZP slot', () => {
        const slot = createZpSlot('zp', 0x30);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x30
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        }
      });

      it('should use absolute addressing for absolute slot', () => {
        const slot = createAbsSlot('abs', 0x0400);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x0400
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after DIV_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testSetAFromImmediate(100);
        gen.testGenDivByte(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for DIV_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Div')).toBe(true);
      });

      it('should emit dividend comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'dividend')).toBe(true);
      });

      it('should emit divisor comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createDivByteInstr(slot);

        gen.testGenDivByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'divisor')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // MOD_BYTE - Divide A by slot value (remainder)
  // ==========================================================================

  describe('MOD_BYTE', () => {
    describe('instruction sequence', () => {
      it('should generate correct sequence for MOD_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        // Expected: STA $FE, LDA slot, STA $FF, LDA $FE, JSR __mod8
        expect(countInstructions(elements, 'STA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'LDA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'JSR')).toBe(1);
      });

      it('should save dividend to $FE first', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        expect(staInstructions.length).toBeGreaterThanOrEqual(2);

        // First STA should be to $FE
        if (isInstructionElement(staInstructions[0])) {
          expect(staInstructions[0].instruction.operand).toBe(0xfe);
        }
      });

      it('should load divisor from slot', () => {
        const slot = createZpSlot('divisor', 0x20);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot address
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x20
        );
        expect(loadFromSlot).toBeDefined();
      });

      it('should store divisor to $FF', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        const storeToFF = staInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xff
        );
        expect(storeToFF).toBeDefined();
      });

      it('should restore dividend from $FE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from $FE
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromFE = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
        );
        expect(loadFromFE).toBeDefined();
      });

      it('should call __mod8 routine', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        const jsr = findInstruction(elements, 'JSR');
        expect(jsr).toBeDefined();
        if (jsr && isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe('__mod8');
        }
      });
    });

    describe('zero page vs absolute', () => {
      it('should use zero page addressing for ZP slot', () => {
        const slot = createZpSlot('zp', 0x30);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x30
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        }
      });

      it('should use absolute addressing for absolute slot', () => {
        const slot = createAbsSlot('abs', 0x0400);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x0400
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after MOD_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testSetAFromImmediate(100);
        gen.testGenModByte(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for MOD_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Mod')).toBe(true);
      });

      it('should emit dividend comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'dividend')).toBe(true);
      });

      it('should emit divisor comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createModByteInstr(slot);

        gen.testGenModByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'divisor')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // DIV vs MOD comparison
  // ==========================================================================

  describe('DIV vs MOD', () => {
    it('should call __div8 for DIV_BYTE', () => {
      const slot = createZpSlot('x', 0x10);
      gen.testGenDivByte(createDivByteInstr(slot));
      const elements = gen.getElements();

      const jsr = findInstruction(elements, 'JSR');
      expect(jsr).toBeDefined();
      if (jsr && isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('__div8');
      }
    });

    it('should call __mod8 for MOD_BYTE', () => {
      const slot = createZpSlot('x', 0x10);
      gen.testGenModByte(createModByteInstr(slot));
      const elements = gen.getElements();

      const jsr = findInstruction(elements, 'JSR');
      expect(jsr).toBeDefined();
      if (jsr && isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('__mod8');
      }
    });

    it('should use same temp storage pattern for both', () => {
      const slot = createZpSlot('x', 0x10);

      // Test DIV
      const divGen = new TestableArithmeticOpsGenerator();
      divGen.testGenDivByte(createDivByteInstr(slot));
      const divElements = divGen.getElements();

      // Test MOD
      const modGen = new TestableArithmeticOpsGenerator();
      modGen.testGenModByte(createModByteInstr(slot));
      const modElements = modGen.getElements();

      // Both should use $FE and $FF
      for (const elements of [divElements, modElements]) {
        const staInstructions = findAllInstructions(elements, 'STA');
        const storeToFE = staInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
        );
        const storeToFF = staInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xff
        );
        expect(storeToFE).toBeDefined();
        expect(storeToFF).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Combined scenarios
  // ==========================================================================

  describe('multiple div/mod operations', () => {
    it('should generate independent sequences for DIV and MOD', () => {
      const slot = createZpSlot('x', 0x10);

      gen.testGenDivByte(createDivByteInstr(slot));
      gen.testGenModByte(createModByteInstr(slot));

      const elements = gen.getElements();

      // Should have 2 JSR calls
      expect(countInstructions(elements, 'JSR')).toBe(2);
    });

    it('should call correct routines in sequence', () => {
      const slot = createZpSlot('x', 0x10);

      gen.testGenDivByte(createDivByteInstr(slot));
      gen.testGenModByte(createModByteInstr(slot));

      const elements = gen.getElements();
      const jsrInstructions = findAllInstructions(elements, 'JSR');

      expect(jsrInstructions.length).toBe(2);

      // First JSR should be __div8
      if (isInstructionElement(jsrInstructions[0])) {
        expect(jsrInstructions[0].instruction.labelOperand).toBe('__div8');
      }

      // Second JSR should be __mod8
      if (isInstructionElement(jsrInstructions[1])) {
        expect(jsrInstructions[1].instruction.labelOperand).toBe('__mod8');
      }
    });
  });

  // ==========================================================================
  // Implementation detail verification
  // ==========================================================================

  describe('temp storage usage', () => {
    it('should use $FE for dividend temp storage in DIV', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createDivByteInstr(slot);

      gen.testGenDivByte(instr);
      const elements = gen.getElements();

      // Should have STA $FE and LDA $FE
      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFE = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(storeToFE).toBeDefined();

      const ldaInstructions = findAllInstructions(elements, 'LDA');
      const loadFromFE = ldaInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(loadFromFE).toBeDefined();
    });

    it('should use $FF for divisor temp storage in DIV', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createDivByteInstr(slot);

      gen.testGenDivByte(instr);
      const elements = gen.getElements();

      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFF = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xff
      );
      expect(storeToFF).toBeDefined();
    });

    it('should use $FE for dividend temp storage in MOD', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createModByteInstr(slot);

      gen.testGenModByte(instr);
      const elements = gen.getElements();

      // Should have STA $FE and LDA $FE
      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFE = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(storeToFE).toBeDefined();

      const ldaInstructions = findAllInstructions(elements, 'LDA');
      const loadFromFE = ldaInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(loadFromFE).toBeDefined();
    });

    it('should use $FF for divisor temp storage in MOD', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createModByteInstr(slot);

      gen.testGenModByte(instr);
      const elements = gen.getElements();

      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFF = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xff
      );
      expect(storeToFF).toBeDefined();
    });
  });
});