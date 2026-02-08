/**
 * Strength6502Pass — Edge Case Tests
 *
 * Tests non-power-of-2 constants, ×1 and ×0, broken patterns,
 * and pattern boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { Strength6502Pass } from '../../../../../codegen/asm-il/optimizer/passes/strength-6502.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
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

describe('Strength6502Pass — Edge Cases', () => {
  const pass = new Strength6502Pass();

  // ========================================================================
  // Non-Power-of-2 Constants (Should NOT Match)
  // ========================================================================

  describe('non-power-of-2 constants', () => {
    it('should NOT replace ×3 (not power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 3),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace ×5 (not power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 5),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace ÷6 (not power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 6),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace %10 (not power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 10),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace ×255 (not power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 255),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Special Constants (×1, ×0)
  // ========================================================================

  describe('special constants', () => {
    it('should NOT replace ×1 (log2(1) = 0, no shifts needed)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 1),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace ÷1 (log2(1) = 0, no shifts needed)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 1),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace ×0 (zero is not a valid power of 2)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 0),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Broken Patterns (Incomplete Sequences)
  // ========================================================================

  describe('broken patterns', () => {
    it('should NOT match when first element is not LDA', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50), // NOT LDA
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT match when second element is not LDX #imm', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDY', AsmAddressingMode.Immediate, 4), // LDY, not LDX
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT match when LDX is not Immediate mode', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x60), // ZeroPage, not Immediate
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT match when third element is not JSR', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JMP', AsmAddressingMode.Absolute, undefined, '__mul_byte'), // JMP, not JSR
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT match when non-instruction breaks the pattern', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            createLabelElement('here'), // Label breaks the 3-instruction window
            instr('LDX', AsmAddressingMode.Immediate, 4),
            instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
          ],
        }],
      };

      const result = pass.run(program);
      // The pattern scan sees LDA, then label (not LDX), so no match
      expect(result.changed).toBe(false);
    });

    it('should NOT match when JSR has no label operand', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, 0x1000), // numeric, no label
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Pattern at Section Boundaries
  // ========================================================================

  describe('pattern at section boundaries', () => {
    it('should match pattern at very start of section', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should match pattern at very end of section', () => {
      const program = createTestProgram([
        instr('NOP'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should NOT match when pattern is split across 2 remaining elements', () => {
      // Only 2 elements remain at position — not enough for 3-element pattern
      const program = createTestProgram([
        instr('NOP'),
        instr('NOP'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        // Missing JSR — only 2 elements of pattern present
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Large Shift Counts
  // ========================================================================

  describe('large shift counts', () => {
    it('should NOT replace ×256 (shift count 8, exceeds byte limit of 7)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 256),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Unknown Runtime Routine Names
  // ========================================================================

  describe('unknown routine names', () => {
    it('should NOT replace unknown multiply routine', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'my_mul'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT replace unknown divide routine', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'custom_div'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });
});
