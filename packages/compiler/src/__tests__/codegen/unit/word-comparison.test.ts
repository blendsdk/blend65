/**
 * Word Comparison Operations Tests
 *
 * Tests for 16-bit word comparison code generation:
 * - CMP_WORD_IMM: Compare A:X with immediate word value
 * - CMP_WORD_SLOT: Compare A:X with word stored in memory
 *
 * The A:X convention stores low byte in A, high byte in X.
 * Word comparisons compare high bytes first (CPX); if equal,
 * then compare low bytes (CMP) to determine the final result.
 *
 * @module __tests__/codegen/unit/word-comparison.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableComparisonOpsGenerator,
  createCmpWordImmInstr,
  createCmpWordSlotInstr,
  createZpWordSlot,
  createAbsWordSlot,
  findInstruction,
  findAllInstructions,
  countInstructions,
  getInstructions,
  hasCommentContaining,
} from './_comparison-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
  isLabelElement,
} from '../../../codegen/asm-il/types.js';

describe('Word Comparison Operations', () => {
  let gen: TestableComparisonOpsGenerator;

  beforeEach(() => {
    gen = new TestableComparisonOpsGenerator('test');
  });

  // ==========================================================================
  // CMP_WORD_IMM Tests
  // ==========================================================================

  describe('CMP_WORD_IMM', () => {
    describe('Instruction Sequence', () => {
      it('generates CPX/BNE/CMP/label sequence for word immediate comparison', () => {
        // Compare A:X with $0400 (hi=$04, lo=$00)
        const instr = createCmpWordImmInstr(0x0400);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const instructions = getInstructions(elements);

        // Expected sequence: CPX #$04 / BNE label / CMP #$00
        expect(instructions.length).toBe(3);

        // First: CPX #hi (compare high bytes)
        expect(isInstructionElement(instructions[0])).toBe(true);
        if (isInstructionElement(instructions[0])) {
          expect(instructions[0].instruction.mnemonic).toBe('CPX');
          expect(instructions[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(instructions[0].instruction.operand).toBe(0x04);
        }

        // Second: BNE (skip low byte compare if high bytes differ)
        expect(isInstructionElement(instructions[1])).toBe(true);
        if (isInstructionElement(instructions[1])) {
          expect(instructions[1].instruction.mnemonic).toBe('BNE');
        }

        // Third: CMP #lo (compare low bytes)
        expect(isInstructionElement(instructions[2])).toBe(true);
        if (isInstructionElement(instructions[2])) {
          expect(instructions[2].instruction.mnemonic).toBe('CMP');
          expect(instructions[2].instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(instructions[2].instruction.operand).toBe(0x00);
        }
      });

      it('generates a local label after the CMP instruction', () => {
        const instr = createCmpWordImmInstr(0x0400);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        // Should have a label element (the branch target)
        const labelElements = elements.filter(isLabelElement);
        expect(labelElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Byte Decomposition', () => {
      it('correctly decomposes $0400 into hi=$04, lo=$00', () => {
        const instr = createCmpWordImmInstr(0x0400);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0x04);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x00);
        }
      });

      it('correctly decomposes $1234 into hi=$12, lo=$34', () => {
        const instr = createCmpWordImmInstr(0x1234);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0x12);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x34);
        }
      });

      it('correctly decomposes $FFFF into hi=$FF, lo=$FF', () => {
        const instr = createCmpWordImmInstr(0xffff);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0xff);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0xff);
        }
      });

      it('correctly decomposes $0000 into hi=$00, lo=$00', () => {
        const instr = createCmpWordImmInstr(0x0000);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0x00);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x00);
        }
      });

      it('correctly decomposes $00FF into hi=$00, lo=$FF', () => {
        // Edge case: value fits in low byte only
        const instr = createCmpWordImmInstr(0x00ff);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0x00);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0xff);
        }
      });

      it('correctly decomposes $FF00 into hi=$FF, lo=$00', () => {
        // Edge case: value is all in high byte
        const instr = createCmpWordImmInstr(0xff00);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        const cpx = findInstruction(elements, 'CPX');
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cpx)) {
          expect(cpx.instruction.operand).toBe(0xff);
        }
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x00);
        }
      });
    });

    describe('Accumulator State', () => {
      it('does not invalidate A after CMP_WORD_IMM (CMP/CPX are non-destructive)', () => {
        gen.testSetAFromSlot(0x10);

        const instr = createCmpWordImmInstr(0x0400);
        gen.testGenCmpWordImm(instr);

        // A should still be tracked as holding slot 0x10
        // because CMP and CPX do not modify A or X
        expect(gen.testAHasSlot(0x10)).toBe(true);
      });
    });

    describe('Comment Generation', () => {
      it('generates comment for CMP_WORD_IMM instruction', () => {
        const instr = createCmpWordImmInstr(0x0400);

        gen.testGenCmpWordImm(instr);

        const elements = gen.getElements();
        expect(hasCommentContaining(elements, 'Compare')).toBe(true);
      });
    });

    describe('Unique Label Generation', () => {
      it('generates unique labels for multiple word comparisons', () => {
        const instr1 = createCmpWordImmInstr(0x0400);
        const instr2 = createCmpWordImmInstr(0x0800);

        gen.testGenCmpWordImm(instr1);
        gen.testGenCmpWordImm(instr2);

        const elements = gen.getElements();
        const labels = elements.filter(isLabelElement);

        // Should have 2 unique labels (one per comparison)
        expect(labels.length).toBe(2);
        // Labels should be different
        if (isLabelElement(labels[0]) && isLabelElement(labels[1])) {
          expect(labels[0].label.name).not.toBe(labels[1].label.name);
        }
      });
    });
  });

  // ==========================================================================
  // CMP_WORD_SLOT Tests
  // ==========================================================================

  describe('CMP_WORD_SLOT', () => {
    describe('Zero Page Addressing', () => {
      it('generates CPX/BNE/CMP/label sequence for zero page word slot', () => {
        // Word slot at ZP $10 (lo=$10, hi=$11)
        const slot = createZpWordSlot('target', 0x10);
        const instr = createCmpWordSlotInstr(slot);

        gen.testGenCmpWordSlot(instr);

        const elements = gen.getElements();
        const instructions = getInstructions(elements);

        // Expected: CPX $11 / BNE label / CMP $10
        expect(instructions.length).toBe(3);

        // First: CPX addr+1 (compare high bytes from ZP)
        if (isInstructionElement(instructions[0])) {
          expect(instructions[0].instruction.mnemonic).toBe('CPX');
          expect(instructions[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(instructions[0].instruction.operand).toBe(0x11); // addr+1
        }

        // Second: BNE
        if (isInstructionElement(instructions[1])) {
          expect(instructions[1].instruction.mnemonic).toBe('BNE');
        }

        // Third: CMP addr (compare low bytes from ZP)
        if (isInstructionElement(instructions[2])) {
          expect(instructions[2].instruction.mnemonic).toBe('CMP');
          expect(instructions[2].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(instructions[2].instruction.operand).toBe(0x10); // addr
        }
      });

      it('handles zero page word slot at various addresses', () => {
        const addresses = [0x02, 0x20, 0x50, 0xfe];

        for (const addr of addresses) {
          const newGen = new TestableComparisonOpsGenerator('test');
          const slot = createZpWordSlot(`var_${addr}`, addr);
          const instr = createCmpWordSlotInstr(slot);

          newGen.testGenCmpWordSlot(instr);

          const elements = newGen.getElements();
          const cpx = findInstruction(elements, 'CPX');
          const cmp = findInstruction(elements, 'CMP');

          // CPX should read high byte at addr+1
          if (isInstructionElement(cpx)) {
            expect(cpx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
            expect(cpx.instruction.operand).toBe(addr + 1);
          }
          // CMP should read low byte at addr
          if (isInstructionElement(cmp)) {
            expect(cmp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
            expect(cmp.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('Absolute Addressing', () => {
      it('generates CPX/BNE/CMP/label sequence for absolute word slot', () => {
        // Word slot at $0200 (lo=$0200, hi=$0201)
        const slot = createAbsWordSlot('counter', 0x0200);
        const instr = createCmpWordSlotInstr(slot);

        gen.testGenCmpWordSlot(instr);

        const elements = gen.getElements();
        const instructions = getInstructions(elements);

        // Expected: CPX $0201 / BNE label / CMP $0200
        expect(instructions.length).toBe(3);

        // First: CPX addr+1 (compare high bytes, absolute)
        if (isInstructionElement(instructions[0])) {
          expect(instructions[0].instruction.mnemonic).toBe('CPX');
          expect(instructions[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(instructions[0].instruction.operand).toBe(0x0201);
        }

        // Second: BNE
        if (isInstructionElement(instructions[1])) {
          expect(instructions[1].instruction.mnemonic).toBe('BNE');
        }

        // Third: CMP addr (compare low bytes, absolute)
        if (isInstructionElement(instructions[2])) {
          expect(instructions[2].instruction.mnemonic).toBe('CMP');
          expect(instructions[2].instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(instructions[2].instruction.operand).toBe(0x0200);
        }
      });

      it('handles absolute word slot at various addresses', () => {
        const addresses = [0x0200, 0x0400, 0x0800, 0xc000];

        for (const addr of addresses) {
          const newGen = new TestableComparisonOpsGenerator('test');
          const slot = createAbsWordSlot(`var_${addr}`, addr);
          const instr = createCmpWordSlotInstr(slot);

          newGen.testGenCmpWordSlot(instr);

          const elements = newGen.getElements();
          const cpx = findInstruction(elements, 'CPX');
          const cmp = findInstruction(elements, 'CMP');

          // CPX should read high byte at addr+1
          if (isInstructionElement(cpx)) {
            expect(cpx.instruction.mode).toBe(AsmAddressingMode.Absolute);
            expect(cpx.instruction.operand).toBe(addr + 1);
          }
          // CMP should read low byte at addr
          if (isInstructionElement(cmp)) {
            expect(cmp.instruction.mode).toBe(AsmAddressingMode.Absolute);
            expect(cmp.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('Accumulator State', () => {
      it('does not invalidate A after CMP_WORD_SLOT', () => {
        gen.testSetAFromSlot(0x30);

        const slot = createZpWordSlot('limit', 0x10);
        const instr = createCmpWordSlotInstr(slot);
        gen.testGenCmpWordSlot(instr);

        // CMP and CPX are non-destructive — A should still be tracked
        expect(gen.testAHasSlot(0x30)).toBe(true);
      });
    });

    describe('Comment Generation', () => {
      it('generates comment for CMP_WORD_SLOT instruction', () => {
        const slot = createZpWordSlot('limit', 0x10);
        const instr = createCmpWordSlotInstr(slot);

        gen.testGenCmpWordSlot(instr);

        const elements = gen.getElements();
        expect(hasCommentContaining(elements, 'Compare')).toBe(true);
      });
    });

    describe('Unique Label Generation', () => {
      it('generates unique labels for multiple slot comparisons', () => {
        const slot1 = createZpWordSlot('a', 0x10);
        const slot2 = createAbsWordSlot('b', 0x0200);

        gen.testGenCmpWordSlot(createCmpWordSlotInstr(slot1));
        gen.testGenCmpWordSlot(createCmpWordSlotInstr(slot2));

        const elements = gen.getElements();
        const labels = elements.filter(isLabelElement);

        // Should have 2 unique labels
        expect(labels.length).toBe(2);
        if (isLabelElement(labels[0]) && isLabelElement(labels[1])) {
          expect(labels[0].label.name).not.toBe(labels[1].label.name);
        }
      });
    });
  });

  // ==========================================================================
  // Mixed Word Comparison Tests
  // ==========================================================================

  describe('Mixed Word Comparisons', () => {
    it('can mix CMP_WORD_IMM and CMP_WORD_SLOT in same generator', () => {
      const slot = createZpWordSlot('counter', 0x10);

      gen.testGenCmpWordImm(createCmpWordImmInstr(0x0400));
      gen.testGenCmpWordSlot(createCmpWordSlotInstr(slot));

      const elements = gen.getElements();
      const cpxInstructions = findAllInstructions(elements, 'CPX');

      // Two CPX instructions: one for immediate, one for slot
      expect(cpxInstructions.length).toBe(2);

      // First CPX: immediate mode (from CMP_WORD_IMM)
      if (isInstructionElement(cpxInstructions[0])) {
        expect(cpxInstructions[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }

      // Second CPX: zero page mode (from CMP_WORD_SLOT)
      if (isInstructionElement(cpxInstructions[1])) {
        expect(cpxInstructions[1].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  // ==========================================================================
  // C64 Practical Comparison Scenarios
  // ==========================================================================

  describe('C64 Practical Comparison Scenarios', () => {
    it('compares with screen memory end ($07E8 = 1024+1000)', () => {
      // Checking if word pointer has reached end of screen memory
      const instr = createCmpWordImmInstr(0x07e8);

      gen.testGenCmpWordImm(instr);

      const elements = gen.getElements();
      const cpx = findInstruction(elements, 'CPX');
      const cmp = findInstruction(elements, 'CMP');

      if (isInstructionElement(cpx)) {
        expect(cpx.instruction.operand).toBe(0x07); // hi byte
      }
      if (isInstructionElement(cmp)) {
        expect(cmp.instruction.operand).toBe(0xe8); // lo byte
      }
    });

    it('compares with sprite pointer base ($07F8)', () => {
      const instr = createCmpWordImmInstr(0x07f8);

      gen.testGenCmpWordImm(instr);

      const elements = gen.getElements();
      const cpx = findInstruction(elements, 'CPX');
      const cmp = findInstruction(elements, 'CMP');

      if (isInstructionElement(cpx)) {
        expect(cpx.instruction.operand).toBe(0x07);
      }
      if (isInstructionElement(cmp)) {
        expect(cmp.instruction.operand).toBe(0xf8);
      }
    });

    it('compares word pointer with limit stored in ZP', () => {
      // Common loop pattern: compare word iterator with word limit in ZP
      const limitSlot = createZpWordSlot('limit', 0xfb);

      gen.testGenCmpWordSlot(createCmpWordSlotInstr(limitSlot));

      const elements = gen.getElements();
      const cpx = findInstruction(elements, 'CPX');
      const cmp = findInstruction(elements, 'CMP');

      // CPX reads high byte at $FC (addr+1)
      if (isInstructionElement(cpx)) {
        expect(cpx.instruction.operand).toBe(0xfc);
        expect(cpx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      // CMP reads low byte at $FB (addr)
      if (isInstructionElement(cmp)) {
        expect(cmp.instruction.operand).toBe(0xfb);
        expect(cmp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  // ==========================================================================
  // Instruction Count Verification
  // ==========================================================================

  describe('Instruction Count Verification', () => {
    it('CMP_WORD_IMM generates exactly 3 instructions (CPX/BNE/CMP)', () => {
      const instr = createCmpWordImmInstr(0x1234);

      gen.testGenCmpWordImm(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(3);
      expect(countInstructions(elements, 'CPX')).toBe(1);
      expect(countInstructions(elements, 'BNE')).toBe(1);
      expect(countInstructions(elements, 'CMP')).toBe(1);
    });

    it('CMP_WORD_SLOT generates exactly 3 instructions (CPX/BNE/CMP)', () => {
      const slot = createZpWordSlot('ptr', 0x10);
      const instr = createCmpWordSlotInstr(slot);

      gen.testGenCmpWordSlot(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(3);
      expect(countInstructions(elements, 'CPX')).toBe(1);
      expect(countInstructions(elements, 'BNE')).toBe(1);
      expect(countInstructions(elements, 'CMP')).toBe(1);
    });
  });
});
