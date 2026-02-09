/**
 * CompareBranchPass Tests
 *
 * Tests for the CMP+BCC+BEQ → CMP+BCC simplification pass.
 * Verifies pattern matching, operand adjustment, safety constraints,
 * and edge cases for the compare-branch optimization.
 *
 * @module __tests__/codegen/asm-il/optimizer/passes/compare-branch
 */

import { describe, it, expect } from 'vitest';
import { CompareBranchPass } from '../../../../../codegen/asm-il/optimizer/passes/compare-branch.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Shorthand for creating an instruction element */
function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
): AsmILElement {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

/** Create a program with a single section containing the given elements */
function createTestProgram(elements: AsmILElement[]): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

/** Count instructions in the first section */
function countInstructions(program: AsmILProgram): number {
  if (program.sections.length === 0) return 0;
  return program.sections[0].elements.filter(isInstructionElement).length;
}

/** Get instruction at a specific index (among instruction elements only) */
function getInstruction(program: AsmILProgram, index: number) {
  const instrs = program.sections[0].elements.filter(isInstructionElement);
  const el = instrs[index];
  if (el && el.kind === 'instruction') return el.instruction;
  return undefined;
}

// ============================================================================
// Tests
// ============================================================================

describe('CompareBranchPass', () => {
  const pass = new CompareBranchPass();

  // ========================================================================
  // Basic Properties
  // ========================================================================

  describe('pass properties', () => {
    it('should have the name "compare-branch"', () => {
      expect(pass.name).toBe('compare-branch');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // Pattern Matching: CMP+BCC+BEQ → CMP+BCC
  // ========================================================================

  describe('CMP+BCC+BEQ pattern', () => {
    it('should simplify CMP #$0F + BCC + BEQ to same label into CMP #$10 + BCC', () => {
      // CMP #$0F; BCC .target; BEQ .target → CMP #$10; BCC .target
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(countInstructions(result.program)).toBe(2);

      // CMP operand should be incremented to $10
      const cmp = getInstruction(result.program, 0);
      expect(cmp?.mnemonic).toBe('CMP');
      expect(cmp?.operand).toBe(0x10);

      // BCC should remain targeting the same label
      const bcc = getInstruction(result.program, 1);
      expect(bcc?.mnemonic).toBe('BCC');
      expect(bcc?.labelOperand).toBe('target');
    });

    it('should handle CMP #$00 (increments to CMP #$01)', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x00),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'done'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const cmp = getInstruction(result.program, 0);
      expect(cmp?.operand).toBe(0x01);
    });

    it('should handle CMP #$FE (increments to CMP #$FF — maximum valid)', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0xFE),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'label'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'label'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const cmp = getInstruction(result.program, 0);
      expect(cmp?.operand).toBe(0xFF);
    });

    it('should handle multiple patterns in one section', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x05),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'a'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'a'),
        instr('NOP'),
        instr('CMP', AsmAddressingMode.Immediate, 0x0A),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'b'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'b'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // 7 instructions → 5 (removed 2 BEQ instructions)
      expect(countInstructions(result.program)).toBe(5);
      expect(result.stats?.patternsMatched).toBe(2);
    });
  });

  // ========================================================================
  // Safety: Patterns That Must NOT Be Optimized
  // ========================================================================

  describe('safety constraints', () => {
    it('should NOT optimize CMP #$FF (cannot increment past byte range)', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0xFF),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(countInstructions(result.program)).toBe(3);
    });

    it('should NOT optimize when BCC and BEQ target different labels', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'labelA'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'labelB'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when CMP uses non-immediate addressing', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.ZeroPage, 0x50),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when a label interrupts the sequence', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        createLabelElement('midpoint'),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when next instruction after CMP is not BCC', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        instr('BCS', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('statistics', () => {
    it('should report correct stats for a single pattern', () => {
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.stats?.patternsMatched).toBe(1);
      expect(result.stats?.instructionsRemoved).toBe(1);
      expect(result.stats?.estimatedBytesSaved).toBe(2);
    });

    it('should return no-change result for unoptimizable code', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle empty program', () => {
      const program = createTestProgram([]);
      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should skip comments between CMP and BCC', () => {
      // Comments between instructions should be skipped during matching
      // but preserved in the output
      const program = createTestProgram([
        instr('CMP', AsmAddressingMode.Immediate, 0x0F),
        createCommentElement('check boundary'),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // BEQ removed but comment preserved
      const cmp = getInstruction(result.program, 0);
      expect(cmp?.operand).toBe(0x10);
    });
  });
});
