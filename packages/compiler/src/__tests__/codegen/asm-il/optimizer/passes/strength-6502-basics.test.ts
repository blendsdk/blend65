/**
 * Strength6502Pass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { Strength6502Pass } from '../../../../../codegen/asm-il/optimizer/passes/strength-6502.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
  createBlankElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILSection } from '../../../../../codegen/asm-il/types.js';

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

describe('Strength6502Pass — Basics', () => {
  const pass = new Strength6502Pass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "6502-strength"', () => {
      expect(pass.name).toBe('6502-strength');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // Unchanged Program Handling
  // ========================================================================

  describe('unchanged programs', () => {
    it('should return same reference for empty program', () => {
      const program = createAsmILProgram('test');
      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
      expect(result.stats.patternsMatched).toBe(0);
    });

    it('should return same reference when no runtime call patterns exist', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference when only non-instruction elements exist', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('comment'),
            createBlankElement(),
            createLabelElement('start'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference for program with no sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT optimize JSR to non-math routines', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'print_char'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT optimize when multiplier is not a power of 2', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 3), // 3 is NOT power of 2
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT optimize when divisor is not a power of 2', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 5), // 5 is NOT power of 2
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT optimize section with fewer than 3 elements', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Stats Reporting
  // ========================================================================

  describe('stats reporting', () => {
    it('should report zero stats when nothing changed', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
    });

    it('should report correct stats for single multiply replacement', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2), // *2 = 1 ASL
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(2); // LDX + JSR
      expect(result.stats.instructionsAdded).toBe(1);   // 1 ASL
      expect(result.stats.estimatedCyclesSaved).toBeGreaterThan(0);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThan(0);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
              instr('LDX', AsmAddressingMode.Immediate, 2),
              instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
            ],
          },
          {
            name: 'section2',
            elements: [
              instr('LDA', AsmAddressingMode.ZeroPage, 0x51),
              instr('LDX', AsmAddressingMode.Immediate, 4),
              instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
    });
  });

  // ========================================================================
  // Non-Instruction Element Preservation
  // ========================================================================

  describe('non-instruction element preservation', () => {
    it('should preserve comments around optimized pattern', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('multiply by 2'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            instr('LDX', AsmAddressingMode.Immediate, 2),
            instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
            createCommentElement('result in A'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements[0].kind).toBe('comment');
      expect(elements[elements.length - 1].kind).toBe('comment');
    });

    it('should preserve labels around optimized pattern', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createLabelElement('mul_section'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            instr('LDX', AsmAddressingMode.Immediate, 4),
            instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements[0].kind).toBe('label');
    });
  });

  // ========================================================================
  // Multiple Sections
  // ========================================================================

  describe('multiple sections', () => {
    it('should process each section independently', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'init',
            elements: [
              instr('LDA', AsmAddressingMode.Immediate, 5),
              instr('RTS'),
            ],
          },
          {
            name: 'main',
            elements: [
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
              instr('LDX', AsmAddressingMode.Immediate, 8),
              instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2); // unchanged
    });

    it('should preserve unchanged sections by reference', () => {
      const unchangedSection: AsmILSection = {
        name: 'init',
        elements: [
          instr('LDA', AsmAddressingMode.Immediate, 0),
          instr('RTS'),
        ],
      };

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          unchangedSection,
          {
            name: 'main',
            elements: [
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
              instr('LDX', AsmAddressingMode.Immediate, 2),
              instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
