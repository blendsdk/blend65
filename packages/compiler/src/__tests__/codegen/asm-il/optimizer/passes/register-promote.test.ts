/**
 * RegisterPromotePass Tests
 *
 * Tests for the loop counter register promotion pass.
 * Verifies that INC/DEC memory operations in loops are promoted to
 * INX/DEX (or INY/DEY) when registers are available, including
 * associated LDA→TXA and CMP→CPX transformations.
 *
 * @module __tests__/codegen/asm-il/optimizer/passes/register-promote
 */

import { describe, it, expect } from 'vitest';
import { RegisterPromotePass } from '../../../../../codegen/asm-il/optimizer/passes/register-promote.js';
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

/** Get all instructions from the first section as an array */
function getInstructions(program: AsmILProgram) {
  return program.sections[0].elements
    .filter(isInstructionElement)
    .map(el => el.instruction);
}

/** Count instructions with a specific mnemonic */
function countMnemonic(program: AsmILProgram, mnemonic: string): number {
  return getInstructions(program).filter(i => i.mnemonic === mnemonic).length;
}

// ============================================================================
// Tests
// ============================================================================

describe('RegisterPromotePass', () => {
  const pass = new RegisterPromotePass();

  // ========================================================================
  // Basic Properties
  // ========================================================================

  describe('pass properties', () => {
    it('should have the name "register-promote"', () => {
      expect(pass.name).toBe('register-promote');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // INC → INX Promotion
  // ========================================================================

  describe('INC addr → INX promotion', () => {
    it('should promote INC $50 → INX when X is free in loop', () => {
      // A simple loop: label, LDA counter, INC counter, BNE back
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      const mnemonics = instrs.map(i => i.mnemonic);

      // Should have LDX before loop, TXA inside, INX inside, STX after
      expect(mnemonics).toContain('LDX');
      expect(mnemonics).toContain('TXA');
      expect(mnemonics).toContain('INX');
      expect(mnemonics).toContain('STX');

      // Should NOT contain INC $50 anymore
      expect(countMnemonic(result.program, 'INC')).toBe(0);
      // Should NOT contain LDA $50 anymore (replaced with TXA)
      const ldasWithAddr = instrs.filter(
        i => i.mnemonic === 'LDA' && i.operand === 0x50
      );
      expect(ldasWithAddr.length).toBe(0);
    });

    it('should use absolute addressing for addresses > 0xFF', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.Absolute, 0x1000),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      const ldx = instrs.find(i => i.mnemonic === 'LDX');
      expect(ldx?.mode).toBe(AsmAddressingMode.Absolute);
      expect(ldx?.operand).toBe(0x1000);
    });
  });

  // ========================================================================
  // DEC → DEX Promotion
  // ========================================================================

  describe('DEC addr → DEX promotion', () => {
    it('should promote DEC $50 → DEX when X is free in loop', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('DEC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      expect(countMnemonic(result.program, 'DEX')).toBe(1);
      expect(countMnemonic(result.program, 'DEC')).toBe(0);
    });
  });

  // ========================================================================
  // Y Register Fallback
  // ========================================================================

  describe('Y register fallback', () => {
    it('should promote to Y when X is already used in loop', () => {
      // Loop body uses X (STX), so Y should be used instead
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('STX', AsmAddressingMode.ZeroPage, 0x60), // X is used
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      // Should use Y register variants
      expect(instrs.some(i => i.mnemonic === 'LDY')).toBe(true);
      expect(instrs.some(i => i.mnemonic === 'INY')).toBe(true);
      expect(instrs.some(i => i.mnemonic === 'STY')).toBe(true);
    });
  });

  // ========================================================================
  // Safety: Skip Cases
  // ========================================================================

  describe('safety constraints', () => {
    it('should NOT promote when both X and Y are used in loop', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('STX', AsmAddressingMode.ZeroPage, 0x60), // X is used
        instr('STY', AsmAddressingMode.ZeroPage, 0x61), // Y is used
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when loop contains JSR', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('JSR', AsmAddressingMode.Absolute, 0x1000, 'subroutine'),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when INC/DEC uses unsupported addressing mode', () => {
      // ZeroPageX is not supported for promotion
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPageX, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT promote when there are multiple INC/DEC to same address', () => {
      // Two INC to same addr → complex pattern, skip
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // CMP Replacement
  // ========================================================================

  describe('CMP addr → CPX replacement', () => {
    it('should replace CMP of counter address with CPX', () => {
      // Pattern: LDA counter, CMP counter, BNE loop
      // After: counter in X, the CMP $50 should become CPX $50
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      // CMP $50 should be replaced with CPX $50
      expect(instrs.some(i => i.mnemonic === 'CPX')).toBe(true);
      const cmpToAddr = instrs.filter(
        i => i.mnemonic === 'CMP' && i.operand === 0x50
      );
      expect(cmpToAddr.length).toBe(0);
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

    it('should handle section with no loops', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program); // Same reference
    });

    it('should handle forward branch (not a loop)', () => {
      // BNE to a label that comes AFTER the branch → not a loop
      const program = createTestProgram([
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.skip'),
        instr('NOP'),
        createLabelElement('.skip', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should preserve comments in loop body', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        createCommentElement('loop body'),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      // Comment should still be present
      const hasComment = result.program.sections[0].elements.some(
        el => el.kind === 'comment'
      );
      expect(hasComment).toBe(true);
    });
  });

  // ========================================================================
  // JMP-based Loop Detection (Blend for-loop pattern)
  // ========================================================================

  describe('JMP-based loop detection', () => {
    it('should detect and promote loops using JMP backward branch', () => {
      // Blend for-loop pattern: LDA counter, CMP #limit, BCS .exit, ..., INC counter, JMP .loop
      const program = createTestProgram([
        createLabelElement('.for0', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x05),     // load counter
        instr('CMP', AsmAddressingMode.Immediate, 0x06),     // compare with limit
        instr('BCS', AsmAddressingMode.Relative, undefined, '.endfor1'), // exit
        instr('INC', AsmAddressingMode.ZeroPage, 0x05),      // counter++
        instr('JMP', AsmAddressingMode.Absolute, undefined, '.for0'), // backward jump
        createLabelElement('.endfor1', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);
      const mnemonics = instrs.map(i => i.mnemonic);

      // Should have LDX before loop, CPX #imm, INX, STX after loop
      expect(mnemonics).toContain('LDX');
      expect(mnemonics).toContain('INX');
      expect(mnemonics).toContain('STX');

      // INC $05 should be replaced with INX
      expect(countMnemonic(result.program, 'INC')).toBe(0);

      // CMP #$06 should become CPX #$06 (immediate compare pattern)
      const cpx = instrs.find(i => i.mnemonic === 'CPX');
      expect(cpx).toBeDefined();
      expect(cpx?.mode).toBe(AsmAddressingMode.Immediate);
      expect(cpx?.operand).toBe(0x06);
    });

    it('should handle inner for-loop with barrier label', () => {
      // Pattern from delay() inner loop: barrier label + LDA + CMP + BCS + INC + JMP
      const program = createTestProgram([
        createLabelElement('.for2', true),
        createLabelElement('.for_cont4', true), // barrier label
        instr('LDA', AsmAddressingMode.ZeroPage, 0x05),
        instr('CMP', AsmAddressingMode.Immediate, 0xFF),
        instr('BCS', AsmAddressingMode.Relative, undefined, '.endfor3'),
        instr('INC', AsmAddressingMode.ZeroPage, 0x05),
        instr('JMP', AsmAddressingMode.Absolute, undefined, '.for2'),
        createLabelElement('.endfor3', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);

      // LDA $05 before CMP should be removed (counter in X)
      // CMP #$FF → CPX #$FF
      const cpx = instrs.find(i => i.mnemonic === 'CPX');
      expect(cpx).toBeDefined();
      expect(cpx?.operand).toBe(0xFF);

      // INX should replace INC
      expect(countMnemonic(result.program, 'INX')).toBe(1);
      expect(countMnemonic(result.program, 'INC')).toBe(0);
    });

    it('should NOT promote JMP loop with JSR in body', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x05),
        instr('CMP', AsmAddressingMode.Immediate, 0x06),
        instr('BCS', AsmAddressingMode.Relative, undefined, '.end'),
        instr('JSR', AsmAddressingMode.Absolute, 0x1000, 'subroutine'),
        instr('INC', AsmAddressingMode.ZeroPage, 0x05),
        instr('JMP', AsmAddressingMode.Absolute, undefined, '.loop'),
        createLabelElement('.end', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Immediate Compare Pattern (LDA counter + CMP #imm)
  // ========================================================================

  describe('LDA counter + CMP #imm pattern', () => {
    it('should remove LDA and replace CMP with CPX for immediate compare', () => {
      // BNE-based loop with LDA+CMP#imm at the end
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('NOP'),  // some body work
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),      // load counter
        instr('CMP', AsmAddressingMode.Immediate, 0x0A),     // compare #10
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);

      // LDA $50 should be removed (not converted to TXA — it was paired with CMP)
      const ldaToAddr = instrs.filter(
        i => i.mnemonic === 'LDA' && i.operand === 0x50
      );
      expect(ldaToAddr.length).toBe(0);

      // CMP #$0A → CPX #$0A
      const cpx = instrs.find(i => i.mnemonic === 'CPX');
      expect(cpx).toBeDefined();
      expect(cpx?.mode).toBe(AsmAddressingMode.Immediate);
      expect(cpx?.operand).toBe(0x0A);

      // No TXA should be generated (LDA was paired with CMP, not a standalone load)
      expect(countMnemonic(result.program, 'TXA')).toBe(0);
    });

    it('should handle both standalone LDA and paired LDA+CMP in same loop', () => {
      // Loop with: LDA for use (→TXA) + LDA+CMP#imm (→remove+CPX)
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),      // standalone load → TXA
        instr('STA', AsmAddressingMode.Absolute, 0xD020),    // use value
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),      // paired with CMP → remove
        instr('CMP', AsmAddressingMode.Immediate, 0x10),     // → CPX #$10
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const instrs = getInstructions(result.program);

      // First LDA $50 → TXA (standalone load for use)
      expect(countMnemonic(result.program, 'TXA')).toBe(1);

      // Second LDA $50 removed, CMP → CPX
      const cpx = instrs.find(i => i.mnemonic === 'CPX');
      expect(cpx).toBeDefined();
      expect(cpx?.operand).toBe(0x10);
    });

    it('should report correct stats for immediate compare pattern', () => {
      const program = createTestProgram([
        createLabelElement('.for0', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x05),
        instr('CMP', AsmAddressingMode.Immediate, 0x06),
        instr('BCS', AsmAddressingMode.Relative, undefined, '.end'),
        instr('INC', AsmAddressingMode.ZeroPage, 0x05),
        instr('JMP', AsmAddressingMode.Absolute, undefined, '.for0'),
        createLabelElement('.end', true),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      // Patterns: INC→INX (1) + LDA removal (1) + CMP→CPX (1) = 3
      expect(result.stats.patternsMatched).toBe(3);
      // LDX + STX = 2 added
      expect(result.stats.instructionsAdded).toBe(2);
      // LDA removed = 1
      expect(result.stats.instructionsRemoved).toBe(1);
      expect(result.stats.estimatedCyclesSaved).toBeGreaterThan(0);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('statistics', () => {
    it('should report correct stats for a promotion', () => {
      const program = createTestProgram([
        createLabelElement('.loop', true),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      // INC→INX = 1 pattern, LDA→TXA = 1 pattern → 2 patterns matched
      expect(result.stats.patternsMatched).toBe(2);
      // LDX + STX = 2 instructions added
      expect(result.stats.instructionsAdded).toBe(2);
      expect(result.stats.estimatedCyclesSaved).toBeGreaterThan(0);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThan(0);
    });

    it('should return unchanged result when no promotion possible', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('RTS'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });
});
