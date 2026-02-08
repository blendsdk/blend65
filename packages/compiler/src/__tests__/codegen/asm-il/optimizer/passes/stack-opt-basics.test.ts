/**
 * StackOptPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { StackOptPass } from '../../../../../codegen/asm-il/optimizer/passes/stack-opt.js';
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

describe('StackOptPass — Basics', () => {
  const pass = new StackOptPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "stack-opt"', () => {
      expect(pass.name).toBe('stack-opt');
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

    it('should return same reference when no PHA/PLA patterns exist', () => {
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

    it('should NOT remove PHA without matching PLA (unbalanced)', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('NOP'),
        // No PLA
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT remove PHA/PLA when A is modified AND not overwritten after', () => {
      // A is modified between PHA/PLA AND not immediately overwritten after
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A
        instr('STA', AsmAddressingMode.ZeroPage, 0x50), // uses A but doesn't overwrite
        instr('PLA'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x51), // uses restored A (not overwrite)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should return same reference for section with single element', () => {
      const program = createTestProgram([
        instr('NOP'),
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

    it('should report correct stats for single pair removal', () => {
      // PHA; PLA — A unmodified, pair is redundant
      const program = createTestProgram([
        instr('PHA'),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(2); // PHA + PLA
      expect(result.stats.estimatedCyclesSaved).toBe(7); // 3+4 cycles
      expect(result.stats.estimatedBytesSaved).toBe(2);  // 1+1 bytes
    });

    it('should accumulate stats across multiple pair removals', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('PLA'),
        instr('PHA'),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(4);
      expect(result.stats.estimatedCyclesSaved).toBe(14);
      expect(result.stats.estimatedBytesSaved).toBe(4);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [instr('PHA'), instr('PLA')],
          },
          {
            name: 'section2',
            elements: [instr('PHA'), instr('PLA')],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(4);
    });
  });

  // ========================================================================
  // Non-Instruction Element Preservation
  // ========================================================================

  describe('non-instruction element preservation', () => {
    it('should preserve comments when removing PHA/PLA pair', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('save A'),
            instr('PHA'),
            createCommentElement('nothing happens'),
            instr('PLA'),
            createCommentElement('done'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // PHA and PLA removed, 3 comments remain
      expect(elements).toHaveLength(3);
      expect(elements.every(e => e.kind === 'comment')).toBe(true);
    });

    it('should preserve blank lines when removing PHA/PLA pair', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('PHA'),
            createBlankElement(),
            instr('PLA'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(1); // Only blank line remains
      expect(elements[0].kind).toBe('blank');
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
              instr('PHA'),
              instr('PLA'), // redundant
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2); // unchanged
      expect(result.program.sections[1].elements).toHaveLength(0); // both removed
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
            elements: [instr('PHA'), instr('PLA')],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
