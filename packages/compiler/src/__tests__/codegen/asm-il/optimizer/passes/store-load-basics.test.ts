/**
 * StoreLoadPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { StoreLoadPass } from '../../../../../codegen/asm-il/optimizer/passes/store-load.js';
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

describe('StoreLoadPass — Basics', () => {
  const pass = new StoreLoadPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "store-load"', () => {
      expect(pass.name).toBe('store-load');
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

    it('should return same reference for program with no store-load patterns', () => {
      // LDA followed by STA is normal code flow, not a pattern
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
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

    it('should return same reference when load uses immediate mode', () => {
      // LDA #5 is not a memory load — can't be eliminated
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 5),
        instr('LDA', AsmAddressingMode.Immediate, 5),
      ]);

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

    it('should report ZP byte/cycle savings for zero-page loads', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(1);
      expect(result.stats.estimatedBytesSaved).toBe(2); // ZP load = 2 bytes
      expect(result.stats.estimatedCyclesSaved).toBe(3); // ZP load = 3 cycles
    });

    it('should report absolute byte/cycle savings for absolute loads', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.estimatedBytesSaved).toBe(3); // Abs load = 3 bytes
      expect(result.stats.estimatedCyclesSaved).toBe(4); // Abs load = 4 cycles
    });

    it('should accumulate stats across multiple eliminations', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STX', AsmAddressingMode.Absolute, 0x0400),
        instr('LDX', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
      // ZP(2) + Abs(3) = 5 bytes
      expect(result.stats.estimatedBytesSaved).toBe(5);
      // ZP(3) + Abs(4) = 7 cycles
      expect(result.stats.estimatedCyclesSaved).toBe(7);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [
              instr('STA', AsmAddressingMode.ZeroPage, 0x50),
              instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            ],
          },
          {
            name: 'section2',
            elements: [
              instr('STY', AsmAddressingMode.ZeroPage, 0x60),
              instr('LDY', AsmAddressingMode.ZeroPage, 0x60),
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
    it('should preserve comments when removing loads', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('store value'),
            instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            createCommentElement('reload (redundant)'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Should have: comment, STA, comment (LDA removed)
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(3);
      expect(elements[0].kind).toBe('comment');
      expect(elements[1].kind).toBe('instruction');
      expect(elements[2].kind).toBe('comment');
    });

    it('should preserve blank lines when removing loads', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            createBlankElement(),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
          ],
        }],
      };

      const result = pass.run(program);

      // Blank line between STA and LDA is transparent (non-instruction)
      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(2); // STA + blank (LDA removed)
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
              instr('LDA', AsmAddressingMode.Immediate, 5),
              instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            ],
          },
          {
            name: 'main',
            elements: [
              // Has optimizable pattern
              instr('STA', AsmAddressingMode.ZeroPage, 0x60),
              instr('LDA', AsmAddressingMode.ZeroPage, 0x60),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2); // unchanged
      expect(result.program.sections[1].elements).toHaveLength(1); // LDA removed
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
              instr('STX', AsmAddressingMode.ZeroPage, 0x60),
              instr('LDX', AsmAddressingMode.ZeroPage, 0x60),
            ],
          },
        ],
      };

      const result = pass.run(program);

      // Unchanged section should be the same reference
      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
