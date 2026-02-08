/**
 * SizeOptPass — Tail Call Optimization Tests
 *
 * Tests the JSR+RTS → JMP tail call optimization pattern.
 * This optimization is available at both Os and Oz levels.
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

describe('SizeOptPass — Tail Call Optimization', () => {
  // Use Os mode (non-aggressive) — tail calls work the same in both modes
  const pass = new SizeOptPass(false);

  // ========================================================================
  // Basic Tail Call Patterns
  // ========================================================================

  describe('basic tail call replacement', () => {
    it('should replace JSR+RTS with JMP (label operand)', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'some_function'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(1);

      const jmp = elements[0];
      expect(isInstructionElement(jmp)).toBe(true);
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.mnemonic).toBe('JMP');
        expect(jmp.instruction.labelOperand).toBe('some_function');
      }
    });

    it('should replace JSR+RTS with JMP (numeric operand)', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, 0xFFD2),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(1);

      const jmp = elements[0];
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.mnemonic).toBe('JMP');
        expect(jmp.instruction.operand).toBe(0xFFD2);
      }
    });

    it('should preserve JSR comment on the generated JMP', () => {
      const jsrEl = createInstructionElement(
        'JSR',
        AsmAddressingMode.Absolute,
        undefined,
        'print_char',
        'Call print routine'
      );
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{ name: 'code', elements: [jsrEl, instr('RTS')] }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const jmp = result.program.sections[0].elements[0];
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.comment).toBe('Call print routine');
      }
    });

    it('should preserve JSR addressing mode on the generated JMP', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, 0x1000),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      const jmp = result.program.sections[0].elements[0];
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  // ========================================================================
  // Comments and Blanks Between JSR and RTS
  // ========================================================================

  describe('transparent elements between JSR and RTS', () => {
    it('should optimize when comments exist between JSR and RTS', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
            createCommentElement('end of function'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // JMP + comment (RTS removed)
      expect(elements).toHaveLength(2);

      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JMP');
      }
      expect(elements[1].kind).toBe('comment');
    });

    it('should optimize when blank lines exist between JSR and RTS', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
            createBlankElement(),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      expect(elements).toHaveLength(2); // JMP + blank
    });

    it('should optimize with multiple comments and blanks between', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
            createCommentElement('comment 1'),
            createBlankElement(),
            createCommentElement('comment 2'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // JMP + comment + blank + comment (RTS removed)
      expect(elements).toHaveLength(4);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JMP');
      }
    });
  });

  // ========================================================================
  // Pattern-Breaking Elements
  // ========================================================================

  describe('pattern breakers', () => {
    it('should NOT optimize when label appears between JSR and RTS', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
            createLabelElement('some_label'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when another instruction appears between JSR and RTS', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
        instr('NOP'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT optimize when JSR is at end of section without RTS', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Multiple Tail Calls in One Section
  // ========================================================================

  describe('multiple tail calls', () => {
    it('should optimize multiple JSR+RTS patterns in sequence', () => {
      // Two independent functions back-to-back
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createLabelElement('func_a'),
            instr('LDA', AsmAddressingMode.Immediate, 1),
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper_a'),
            instr('RTS'),
            createLabelElement('func_b'),
            instr('LDA', AsmAddressingMode.Immediate, 2),
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper_b'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);

      const elements = result.program.sections[0].elements;
      // 2 labels + 2 LDA + 2 JMP = 6 (two RTS removed)
      expect(elements).toHaveLength(6);
    });

    it('should optimize first JSR+RTS but leave non-matching JSR alone', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func1'),
        instr('RTS'), // This pair gets optimized
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func2'),
        instr('NOP'), // Breaks pattern
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1); // Only first pair

      const elements = result.program.sections[0].elements;
      // JMP + JSR + NOP + RTS = 4
      expect(elements).toHaveLength(4);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JMP');
      }
      if (isInstructionElement(elements[1])) {
        expect(elements[1].instruction.mnemonic).toBe('JSR');
      }
    });
  });

  // ========================================================================
  // Cross-Section Tail Calls
  // ========================================================================

  describe('cross-section behavior', () => {
    it('should optimize tail calls in different sections independently', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [
              instr('JSR', AsmAddressingMode.Absolute, undefined, 'a'),
              instr('RTS'),
            ],
          },
          {
            name: 'section2',
            elements: [
              instr('JSR', AsmAddressingMode.Absolute, undefined, 'b'),
              instr('RTS'),
            ],
          },
          {
            name: 'section3',
            elements: [
              instr('NOP'), // No tail call here
              instr('RTS'),
            ],
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);

      // Sections 1 & 2: JSR+RTS → JMP
      expect(result.program.sections[0].elements).toHaveLength(1);
      expect(result.program.sections[1].elements).toHaveLength(1);
      // Section 3: unchanged
      expect(result.program.sections[2].elements).toHaveLength(2);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle consecutive JSR+RTS pairs', () => {
      // This is actually: JSR a; RTS; (optimized) then JSR b is separate
      // First JSR+RTS becomes JMP a
      // Second RTS stands alone (no preceding JSR), so it stays
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'a'),
        instr('RTS'),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'b'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
      // Both pairs optimized: JMP a, JMP b
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should handle JSR with Kernal ROM addresses', () => {
      // Common C64 pattern: JSR $FFD2 (CHROUT); RTS
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, 0xFFD2),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const jmp = result.program.sections[0].elements[0];
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.mnemonic).toBe('JMP');
        expect(jmp.instruction.operand).toBe(0xFFD2);
      }
    });

    it('should preserve non-tail-call JSR instructions', () => {
      const program = createTestProgram([
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'init'),
        instr('LDA', AsmAddressingMode.Immediate, 0), // Not RTS, JSR stays
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'cleanup'),
        instr('RTS'), // This JSR+RTS IS a tail call
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);

      const elements = result.program.sections[0].elements;
      // JSR init + LDA + JMP cleanup = 3
      expect(elements).toHaveLength(3);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JSR'); // NOT optimized
      }
      if (isInstructionElement(elements[2])) {
        expect(elements[2].instruction.mnemonic).toBe('JMP'); // Optimized
        expect(elements[2].instruction.labelOperand).toBe('cleanup');
      }
    });
  });
});
