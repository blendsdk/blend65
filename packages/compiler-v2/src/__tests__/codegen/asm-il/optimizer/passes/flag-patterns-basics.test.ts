/**
 * FlagPatternsPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, and stats reporting.
 */

import { describe, it, expect } from 'vitest';
import { FlagPatternsPass } from '../../../../../codegen/asm-il/optimizer/passes/flag-patterns.js';
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

describe('FlagPatternsPass — Basics', () => {
  const pass = new FlagPatternsPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "flag-patterns"', () => {
      expect(pass.name).toBe('flag-patterns');
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

    it('should return same reference for program with no optimizable patterns', () => {
      // CLC followed by ADC = carry IS read, so CLC is needed
      const program = createTestProgram([
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference for program with only non-instruction elements', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('This is a comment'),
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
  });

  // ========================================================================
  // Stats Reporting
  // ========================================================================

  describe('stats reporting', () => {
    it('should report zero stats when nothing changed', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
    });

    it('should count patterns matched and instructions removed', () => {
      // LDA + CMP #0 = 1 pattern matched, 1 instruction removed
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(1);
      expect(result.stats.estimatedBytesSaved).toBe(2); // CMP #0 = 2 bytes
      expect(result.stats.estimatedCyclesSaved).toBe(2); // CMP #0 = 2 cycles
    });

    it('should accumulate stats across multiple patterns in one section', () => {
      // Two redundant CMP #0 instructions in the same section
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done1'),
        instr('LDX', AsmAddressingMode.Immediate, 10),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BNE', AsmAddressingMode.Relative, undefined, 'loop'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
              instr('CMP', AsmAddressingMode.Immediate, 0),
            ],
          },
          {
            name: 'section2',
            elements: [
              instr('LDY', AsmAddressingMode.Immediate, 0),
              instr('CMP', AsmAddressingMode.Immediate, 0),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
    });
  });

  // ========================================================================
  // Non-Instruction Element Preservation
  // ========================================================================

  describe('non-instruction element preservation', () => {
    it('should preserve comments when removing instructions', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('load counter'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            createCommentElement('check if zero'),
            instr('CMP', AsmAddressingMode.Immediate, 0),
            instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Should have: comment, LDA, comment, BEQ (CMP #0 removed)
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(4);
      expect(elements[0].kind).toBe('comment');
      expect(elements[1].kind).toBe('instruction');
      expect(elements[2].kind).toBe('comment');
      expect(elements[3].kind).toBe('instruction');
    });

    it('should preserve blank lines when removing instructions', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            createBlankElement(),
            instr('CMP', AsmAddressingMode.Immediate, 0),
            instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
          ],
        }],
      };

      const result = pass.run(program);

      // Blank line between LDA and CMP #0: CMP #0 is still redundant
      // because blank is a non-instruction element (transparent)
      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // LDA, blank, BEQ
      expect(elements).toHaveLength(3);
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
              // No optimizable patterns
              instr('CLC'),
              instr('ADC', AsmAddressingMode.Immediate, 1),
            ],
          },
          {
            name: 'main',
            elements: [
              // Has optimizable pattern
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
              instr('CMP', AsmAddressingMode.Immediate, 0),
              instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // init section unchanged (2 elements)
      expect(result.program.sections[0].elements).toHaveLength(2);
      // main section optimized (CMP #0 removed → 2 elements)
      expect(result.program.sections[1].elements).toHaveLength(2);
    });

    it('should preserve unchanged sections by reference', () => {
      const unchangedSection: AsmILSection = {
        name: 'init',
        elements: [
          instr('LDA', AsmAddressingMode.Immediate, 5),
          instr('STA', AsmAddressingMode.ZeroPage, 0x50),
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
              instr('CMP', AsmAddressingMode.Immediate, 0),
            ],
          },
        ],
      };

      const result = pass.run(program);

      // Unchanged section should be the same reference (optimization)
      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
