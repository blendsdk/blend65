/**
 * ZPPromotionPass — Pattern Tests
 *
 * Tests the core promotion patterns: Absolute→ZeroPage, AbsoluteX→ZeroPageX,
 * AbsoluteY→ZeroPageY, hotness ranking, and slot allocation.
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
    }));
}

const DEFAULT_SLOTS = [0x50, 0x51, 0x52, 0x53];

describe('ZPPromotionPass — Patterns', () => {
  const pass = new ZPPromotionPass(DEFAULT_SLOTS);

  // ========================================================================
  // Absolute → ZeroPage Promotion
  // ========================================================================

  describe('Absolute → ZeroPage promotion', () => {
    it('should promote LDA Absolute to LDA ZeroPage', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[0].operand).toBe(0x50); // First available slot
    });

    it('should promote STA Absolute to STA ZeroPage', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mnemonic).toBe('STA');
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[0].operand).toBe(0x50);
    });

    it('should promote multiple accesses of same address to same ZP slot', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('ADC', AsmAddressingMode.Immediate, 1),
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // Both LDA and STA should use same ZP slot
      expect(instrs[0].operand).toBe(0x50);
      expect(instrs[2].operand).toBe(0x50);
    });
  });

  // ========================================================================
  // AbsoluteX → ZeroPageX Promotion
  // ========================================================================

  describe('AbsoluteX → ZeroPageX promotion', () => {
    it('should promote LDA AbsoluteX to LDA ZeroPageX', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.AbsoluteX, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPageX);
      expect(instrs[0].operand).toBe(0x50);
    });

    it('should promote STA AbsoluteX to STA ZeroPageX', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.AbsoluteX, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPageX);
    });
  });

  // ========================================================================
  // AbsoluteY → ZeroPageY Promotion
  // ========================================================================

  describe('AbsoluteY → ZeroPageY promotion', () => {
    it('should promote LDA AbsoluteY to LDA ZeroPageY', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.AbsoluteY, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPageY);
      expect(instrs[0].operand).toBe(0x50);
    });

    it('should promote LDX AbsoluteY to LDX ZeroPageY', () => {
      const program = createTestProgram([
        instr('LDX', AsmAddressingMode.AbsoluteY, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mnemonic).toBe('LDX');
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPageY);
    });
  });

  // ========================================================================
  // Hotness Ranking & Slot Allocation
  // ========================================================================

  describe('hotness ranking and slot allocation', () => {
    it('should allocate ZP slot to hottest (most accessed) address', () => {
      // Address 0x0500 accessed 3 times, 0x0400 accessed 1 time
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
        instr('STA', AsmAddressingMode.Absolute, 0x0500),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // 0x0500 (hotter, 3 accesses) gets first slot 0x50
      // 0x0400 (cooler, 1 access) gets second slot 0x51
      expect(instrs[0].operand).toBe(0x51); // 0x0400 → slot 0x51
      expect(instrs[1].operand).toBe(0x50); // 0x0500 → slot 0x50
    });

    it('should allocate different slots to different addresses', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // Both have 1 access each; lower address gets priority as tie-break
      const operands = new Set([instrs[0].operand, instrs[1].operand]);
      expect(operands.size).toBe(2); // Different slots assigned
    });

    it('should only allocate up to available slots', () => {
      // Use pass with only 2 slots
      const twoSlotPass = new ZPPromotionPass([0x50, 0x51]);

      // 3 different addresses but only 2 slots
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
        instr('LDA', AsmAddressingMode.Absolute, 0x0600),
      ]);

      const result = twoSlotPass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);

      // Only 2 should be promoted (the coldest address stays absolute)
      const zpModes = instrs.filter(i =>
        i.mode === AsmAddressingMode.ZeroPage
      );
      const absModes = instrs.filter(i =>
        i.mode === AsmAddressingMode.Absolute
      );

      expect(zpModes).toHaveLength(2);
      expect(absModes).toHaveLength(1);
    });

    it('should break hotness ties by preferring lower address', () => {
      // Both have exactly 1 access — tie-break: lower address gets first slot
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0600),
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // 0x0400 (lower) gets first slot 0x50
      expect(instrs[1].operand).toBe(0x50); // 0x0400 → slot 0x50
      expect(instrs[0].operand).toBe(0x51); // 0x0600 → slot 0x51
    });
  });

  // ========================================================================
  // Mixed Addressing Modes
  // ========================================================================

  describe('mixed addressing modes', () => {
    it('should promote Absolute and AbsoluteX of same address to same slot', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.AbsoluteX, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // Same address → same ZP slot, but different addressing modes
      expect(instrs[0].operand).toBe(0x50);
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[1].operand).toBe(0x50);
      expect(instrs[1].mode).toBe(AsmAddressingMode.ZeroPageX);
    });

    it('should count accesses across different modes for same address', () => {
      // 0x0400 accessed 3 times total (Absolute + AbsoluteX + AbsoluteY)
      // 0x0500 accessed 1 time
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.AbsoluteX, 0x0400),
        instr('STA', AsmAddressingMode.AbsoluteY, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0500),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // 0x0400 (3 accesses) should get first slot 0x50
      expect(instrs[0].operand).toBe(0x50);
      expect(instrs[1].operand).toBe(0x50);
      expect(instrs[2].operand).toBe(0x50);
    });

    it('should not affect non-promotable modes mixed in', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // LDA Immediate unchanged
      expect(instrs[0].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[0].operand).toBe(5);
      // STA promoted
      expect(instrs[1].mode).toBe(AsmAddressingMode.ZeroPage);
      // NOP unchanged
      expect(instrs[2].mode).toBe(AsmAddressingMode.Implied);
    });
  });
});
