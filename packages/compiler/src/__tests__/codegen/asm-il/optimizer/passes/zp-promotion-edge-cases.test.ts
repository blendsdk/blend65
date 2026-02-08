/**
 * ZPPromotionPass — Edge Case Tests
 *
 * Tests I/O range exclusion, already-ZP addresses, label operands,
 * single-slot allocation, and boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { ZPPromotionPass } from '../../../../../codegen/asm-il/optimizer/passes/zp-promotion.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Shorthand for creating an instruction element */
function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
) {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

/** Create a program with a single section containing the given elements */
function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[],
  sectionName = 'code'
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

/** Extract instruction details from result for easy assertions */
function getInstructions(program: AsmILProgram, sectionIndex = 0) {
  return program.sections[sectionIndex].elements
    .filter(isInstructionElement)
    .map(el => ({
      mnemonic: el.instruction.mnemonic,
      mode: el.instruction.mode,
      operand: el.instruction.operand,
      labelOperand: el.instruction.labelOperand,
    }));
}

const DEFAULT_SLOTS = [0x50, 0x51, 0x52, 0x53];

describe('ZPPromotionPass — Edge Cases', () => {
  const pass = new ZPPromotionPass(DEFAULT_SLOTS);

  // ========================================================================
  // I/O Range Exclusion ($D000-$DFFF)
  // ========================================================================

  describe('I/O range exclusion', () => {
    it('should NOT promote $D020 (VIC border color)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT promote $D021 (VIC background color)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, 0xD021),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT promote $D000 (start of I/O range)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xD000),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT promote $DFFF (end of I/O range)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xDFFF),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT promote $D800 (color RAM)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.AbsoluteX, 0xD800),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should promote $CFFF (just below I/O range)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xCFFF),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
    });

    it('should promote $E000 (just above I/O range)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xE000),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
    });

    it('should promote non-I/O but skip I/O in mixed program', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400), // promotable
        instr('STA', AsmAddressingMode.Absolute, 0xD020), // I/O — skip
        instr('STA', AsmAddressingMode.Absolute, 0x0400), // promotable
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage); // promoted
      expect(instrs[1].mode).toBe(AsmAddressingMode.Absolute); // I/O unchanged
      expect(instrs[2].mode).toBe(AsmAddressingMode.ZeroPage); // promoted
    });
  });

  // ========================================================================
  // Already Zero-Page Addresses
  // ========================================================================

  describe('already zero-page addresses', () => {
    it('should NOT promote address $00 (already zero-page)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x00),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT promote address $FF (top of zero-page)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xFF),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should promote address $100 (just above zero-page range)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x100),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
    });
  });

  // ========================================================================
  // Label-Based Operands
  // ========================================================================

  describe('label-based operands', () => {
    it('should NOT promote instructions with label operands (address unknown)', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'main_loop'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT promote JSR with label operands', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'subroutine'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Single-Slot Allocation
  // ========================================================================

  describe('single slot allocation', () => {
    it('should work with exactly one available slot', () => {
      const singleSlotPass = new ZPPromotionPass([0x50]);

      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
      ]);

      const result = singleSlotPass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);

      // Only one address should be promoted (the one with equal access, tie-break lower)
      const zpCount = instrs.filter(i => i.mode === AsmAddressingMode.ZeroPage).length;
      const absCount = instrs.filter(i => i.mode === AsmAddressingMode.Absolute).length;

      expect(zpCount).toBe(1);
      expect(absCount).toBe(1);
    });
  });

  // ========================================================================
  // Default Constructor (No Slots)
  // ========================================================================

  describe('default constructor (no slots)', () => {
    it('should do nothing when constructed with default (empty) slots', () => {
      const defaultPass = new ZPPromotionPass();

      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = defaultPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Mnemonic Preservation
  // ========================================================================

  describe('mnemonic preservation', () => {
    it('should preserve original mnemonic after promotion', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('CMP', AsmAddressingMode.Absolute, 0x0400),
        instr('ADC', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[1].mnemonic).toBe('STA');
      expect(instrs[2].mnemonic).toBe('CMP');
      expect(instrs[3].mnemonic).toBe('ADC');
    });
  });

  // ========================================================================
  // High Address Range
  // ========================================================================

  describe('high address range', () => {
    it('should promote addresses in BASIC ROM range ($A000-$BFFF)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xA000),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
    });

    it('should promote addresses in Kernal ROM range ($E000-$FFFF)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xFFFF),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
    });

    it('should promote addresses in screen RAM ($0400-$07FF)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('STA', AsmAddressingMode.AbsoluteX, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
    });
  });
});
