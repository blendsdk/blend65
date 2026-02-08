/**
 * ZPPromotionPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { ZPPromotionPass } from '../../../../../codegen/asm-il/optimizer/passes/zp-promotion.js';
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

/** Default ZP slots available for testing */
const DEFAULT_SLOTS = [0x50, 0x51, 0x52, 0x53];

describe('ZPPromotionPass — Basics', () => {
  const pass = new ZPPromotionPass(DEFAULT_SLOTS);

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "zp-promotion"', () => {
      expect(pass.name).toBe('zp-promotion');
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

    it('should return same reference when no ZP slots are available', () => {
      const noSlotsPass = new ZPPromotionPass([]);
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('STA', AsmAddressingMode.Absolute, 0x0401),
      ]);

      const result = noSlotsPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference when program has no sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [],
      };

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

    it('should return same reference when all addresses are already ZP', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x10),
        instr('STA', AsmAddressingMode.ZeroPage, 0x20),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference for Implied-mode instructions only', () => {
      const program = createTestProgram([
        instr('NOP'),
        instr('RTS'),
        instr('CLC'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference for Immediate-mode instructions only', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('LDX', AsmAddressingMode.Immediate, 10),
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
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
    });

    it('should report correct stats for single promotion', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      // Each promoted access: 1 instruction removed, 1 added, 1 cycle saved, 1 byte saved
      expect(result.stats.estimatedCyclesSaved).toBe(1);
      expect(result.stats.estimatedBytesSaved).toBe(1);
    });

    it('should accumulate stats across multiple promotions of same address', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(3);
      expect(result.stats.estimatedCyclesSaved).toBe(3);
      expect(result.stats.estimatedBytesSaved).toBe(3);
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [instr('LDA', AsmAddressingMode.Absolute, 0x0400)],
          },
          {
            name: 'section2',
            elements: [instr('STA', AsmAddressingMode.Absolute, 0x0400)],
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
    it('should preserve comments when promoting addresses', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createCommentElement('load screen'),
            instr('LDA', AsmAddressingMode.Absolute, 0x0400),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(2);
      expect(elements[0].kind).toBe('comment');
      expect(elements[1].kind).toBe('instruction');
    });

    it('should preserve labels when promoting addresses', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createLabelElement('loop'),
            instr('LDA', AsmAddressingMode.Absolute, 0x0400),
            instr('STA', AsmAddressingMode.Absolute, 0x0400),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements[0].kind).toBe('label');
    });

    it('should preserve blank lines when promoting addresses', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.Absolute, 0x0400),
            createBlankElement(),
            instr('STA', AsmAddressingMode.Absolute, 0x0400),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(3);
      expect(elements[1].kind).toBe('blank');
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
              instr('LDA', AsmAddressingMode.Absolute, 0x0400),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Init section unchanged, main section has promotion
      expect(result.program.sections[0].elements).toHaveLength(2);
      expect(result.program.sections[1].elements).toHaveLength(1);
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
            elements: [instr('LDA', AsmAddressingMode.Absolute, 0x0400)],
          },
        ],
      };

      const result = pass.run(program);

      // Unchanged section should be same reference (optimization)
      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });
});
