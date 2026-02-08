/**
 * TransferOptPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { TransferOptPass } from '../../../../../codegen/asm-il/optimizer/passes/transfer-opt.js';
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

describe('TransferOptPass — Basics', () => {
  const pass = new TransferOptPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "transfer-opt"', () => {
      expect(pass.name).toBe('transfer-opt');
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

    it('should return same reference for program with no transfer patterns', () => {
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

    it('should NOT optimize single transfer without reverse', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should NOT optimize when source register is modified between transfers', () => {
      // TAX; LDA #5; TXA — LDA modifies A, so TXA is needed
      const program = createTestProgram([
        instr('TAX'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('TXA'),
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
        instr('TAX'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
    });

    it('should report correct stats for single elimination', () => {
      // TAX; TXA — TXA is redundant (A is unchanged)
      const program = createTestProgram([
        instr('TAX'),
        instr('TXA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(1);
      expect(result.stats.estimatedBytesSaved).toBe(1);  // 1 byte per transfer
      expect(result.stats.estimatedCyclesSaved).toBe(2);  // 2 cycles per transfer
    });

    it('should accumulate stats across multiple eliminations', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('TXA'),  // redundant
        instr('TAY'),
        instr('TYA'),  // redundant
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
      expect(result.stats.estimatedBytesSaved).toBe(2);
      expect(result.stats.estimatedCyclesSaved).toBe(4);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [instr('TAX'), instr('TXA')],
          },
          {
            name: 'section2',
            elements: [instr('TAY'), instr('TYA')],
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
    it('should preserve comments when removing transfers', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('copy to X'),
            instr('TAX'),
            createCommentElement('copy back (redundant)'),
            instr('TXA'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Should have: comment, TAX, comment (TXA removed)
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(3);
      expect(elements[0].kind).toBe('comment');
      expect(elements[1].kind).toBe('instruction');
      expect(elements[2].kind).toBe('comment');
    });

    it('should preserve blank lines when removing transfers', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('TAX'),
            createBlankElement(),
            instr('TXA'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(2); // TAX + blank (TXA removed)
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
              instr('TAX'),
              instr('RTS'),
            ],
          },
          {
            name: 'main',
            elements: [
              instr('TAY'),
              instr('TYA'), // redundant
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(3); // unchanged
      expect(result.program.sections[1].elements).toHaveLength(1); // TYA removed
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
            elements: [instr('TAX'), instr('TXA')],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
