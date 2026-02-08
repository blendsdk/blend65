/**
 * SizeOptPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation for both Os and Oz modes.
 */

import { describe, it, expect } from 'vitest';
import { SizeOptPass } from '../../../../../codegen/asm-il/optimizer/passes/size-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
  createBlankElement,
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

describe('SizeOptPass — Basics', () => {
  const osPass = new SizeOptPass(false);  // Os mode: tail calls only
  const ozPass = new SizeOptPass(true);   // Oz mode: tail calls + factoring

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "size-opt"', () => {
      expect(osPass.name).toBe('size-opt');
      expect(ozPass.name).toBe('size-opt');
    });

    it('should be a transform pass', () => {
      expect(osPass.isTransform).toBe(true);
      expect(ozPass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // Unchanged Program Handling
  // ========================================================================

  describe('unchanged programs', () => {
    it('should return same reference for empty program (Os)', () => {
      const program = createAsmILProgram('test');
      const result = osPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
      expect(result.stats.patternsMatched).toBe(0);
    });

    it('should return same reference for empty program (Oz)', () => {
      const program = createAsmILProgram('test');
      const result = ozPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference when no JSR/RTS patterns exist', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('NOP'),
      ]);

      const result = osPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference when JSR is NOT followed by RTS', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'some_func'),
        instr('NOP'),  // Not RTS — breaks pattern
        instr('RTS'),
      ]);

      const result = osPass.run(program);

      // JSR is followed by NOP (not RTS), so no tail call optimization
      expect(result.changed).toBe(false);
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

      const result = osPass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return same reference for program with no sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [],
      };

      const result = osPass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should return same reference for single-element section', () => {
      const program = createTestProgram([
        instr('RTS'),
      ]);

      const result = osPass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT optimize JSR when label breaks pattern before RTS', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
            createLabelElement('skip_point'),  // Label breaks the pattern
            instr('RTS'),
          ],
        }],
      };

      const result = osPass.run(program);

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

      const result = osPass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
    });

    it('should report correct stats for single tail call', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
        instr('RTS'),
      ]);

      const result = osPass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
      expect(result.stats.instructionsRemoved).toBe(1); // RTS removed
      expect(result.stats.estimatedBytesSaved).toBe(1); // JSR+RTS=4, JMP=3
      expect(result.stats.estimatedCyclesSaved).toBe(9);
    });

    it('should accumulate stats across multiple tail calls', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'func1',
            elements: [
              instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper1'),
              instr('RTS'),
            ],
          },
          {
            name: 'func2',
            elements: [
              instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper2'),
              instr('RTS'),
            ],
          },
        ],
      };

      const result = osPass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
      expect(result.stats.estimatedBytesSaved).toBe(2);
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
              instr('LDA', AsmAddressingMode.Immediate, 0),
              instr('RTS'),
            ],
          },
          {
            name: 'main',
            elements: [
              instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper'),
              instr('RTS'),
            ],
          },
        ],
      };

      const result = osPass.run(program);

      expect(result.changed).toBe(true);
      // First section unchanged (no JSR+RTS pattern)
      expect(result.program.sections[0].elements).toHaveLength(2);
      // Second section: JSR→JMP, RTS removed
      expect(result.program.sections[1].elements).toHaveLength(1);
    });
  });
});
