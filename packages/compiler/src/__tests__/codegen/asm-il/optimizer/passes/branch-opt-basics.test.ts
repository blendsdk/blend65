/**
 * BranchOptPass — Basic Behavior Tests
 *
 * Tests pass metadata, unchanged program handling, stats reporting,
 * and non-instruction element preservation.
 */

import { describe, it, expect } from 'vitest';
import { BranchOptPass } from '../../../../../codegen/asm-il/optimizer/passes/branch-opt.js';
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

describe('BranchOptPass — Basics', () => {
  const pass = new BranchOptPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "branch-opt"', () => {
      expect(pass.name).toBe('branch-opt');
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

    it('should return same reference for program with no branch patterns', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('RTS'),
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

    it('should not optimize conditional branches that are not part of a pattern', () => {
      // Simple conditional branch to a label — no chain, no branch-over-JMP
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        createLabelElement('done'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should not optimize JMP with numeric operand (non-label)', () => {
      // JMP to a numeric address, not a label — can't follow chain
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, 0xFFFC),
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

    it('should report stats for unreachable code removal', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('LDA', AsmAddressingMode.Immediate, 5),  // unreachable
        instr('STA', AsmAddressingMode.ZeroPage, 0x50), // unreachable
        createLabelElement('target'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBeGreaterThanOrEqual(2);
      expect(result.stats.instructionsRemoved).toBeGreaterThanOrEqual(2);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThan(0);
    });

    it('should report stats for branch-over-JMP optimization', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBeGreaterThanOrEqual(1);
      expect(result.stats.instructionsRemoved).toBeGreaterThanOrEqual(1);
      expect(result.stats.estimatedBytesSaved).toBeGreaterThanOrEqual(3); // JMP = 3 bytes
      expect(result.stats.estimatedCyclesSaved).toBeGreaterThanOrEqual(3); // JMP = 3 cycles
    });

    it('should accumulate stats across multiple sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [
              instr('JMP', AsmAddressingMode.Absolute, undefined, 'label1'),
              instr('NOP'), // unreachable
              createLabelElement('label1'),
              instr('RTS'),
            ],
          },
          {
            name: 'section2',
            elements: [
              instr('RTS'),
              instr('NOP'), // unreachable
              createLabelElement('label2'),
              instr('RTS'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Both sections had unreachable code
      expect(result.stats.instructionsRemoved).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Non-Instruction Element Preservation
  // ========================================================================

  describe('non-instruction element preservation', () => {
    it('should preserve labels that start reachable sections', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('NOP'), // unreachable
        createLabelElement('target'),
        instr('LDA', AsmAddressingMode.Immediate, 42),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // JMP, target label, and LDA should remain; NOP removed
      const labels = elements.filter(e => e.kind === 'label');
      expect(labels.length).toBe(1);
    });

    it('should preserve labels between JMP and reachable code', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        createLabelElement('other'), // Labels end unreachable sections
        instr('NOP'),
        createLabelElement('end'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      // 'other' label should be preserved (could be branch target)
      const elements = result.program.sections[0].elements;
      const labels = elements.filter(e => e.kind === 'label');
      expect(labels.length).toBe(2); // both 'other' and 'end'
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
              instr('RTS'),
            ],
          },
          {
            name: 'main',
            elements: [
              // Has optimizable pattern — unreachable NOP
              instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
              instr('NOP'), // unreachable
              createLabelElement('end'),
              instr('RTS'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // First section unchanged
      expect(result.program.sections[0].elements).toHaveLength(3);
      // Second section: JMP, label, RTS (NOP removed)
      expect(result.program.sections[1].elements).toHaveLength(3);
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
              instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
              instr('NOP'), // unreachable
              createLabelElement('target'),
              instr('RTS'),
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
