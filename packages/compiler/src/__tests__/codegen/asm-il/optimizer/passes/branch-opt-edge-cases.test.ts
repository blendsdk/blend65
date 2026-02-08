/**
 * BranchOptPass — Edge Case Tests
 *
 * Tests boundary conditions, circular references, deep chains,
 * empty sections, and complex interactions.
 */

import { describe, it, expect } from 'vitest';
import { BranchOptPass } from '../../../../../codegen/asm-il/optimizer/passes/branch-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

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

/** Extract instruction mnemonics and label operands from elements */
function extractInstructions(elements: readonly AsmILElement[]): string[] {
  return elements
    .filter(isInstructionElement)
    .map(el => {
      const i = el.instruction;
      if (i.labelOperand !== undefined) return `${i.mnemonic} ${i.labelOperand}`;
      if (i.operand !== undefined) return `${i.mnemonic} $${i.operand.toString(16).toUpperCase()}`;
      return i.mnemonic;
    });
}

describe('BranchOptPass — Edge Cases', () => {
  const pass = new BranchOptPass();

  // ========================================================================
  // Circular Reference Handling
  // ========================================================================

  describe('circular references', () => {
    it('should handle self-referencing JMP (infinite loop)', () => {
      // label1: JMP label1 — infinite loop, chain resolves to self
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'loop'),
        createLabelElement('loop'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'loop'),
      ]);

      // Should not crash or infinite-loop
      const result = pass.run(program);

      // The first JMP targets 'loop' which JMPs to 'loop' — self-reference.
      // resolveChain should stop because target === label
      expect(result.program).toBeDefined();
    });

    it('should handle mutual circular JMP chains (A→B→A)', () => {
      // A: JMP B; B: JMP A — circular chain
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        createLabelElement('A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'B'),
        createLabelElement('B'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
      ]);

      // Should not crash — depth limit prevents infinite recursion
      const result = pass.run(program);
      expect(result.program).toBeDefined();
    });

    it('should limit chain resolution to prevent stack overflow', () => {
      // Create a chain deeper than 10 hops
      const elements: AsmILElement[] = [
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'L0'),
      ];
      for (let i = 0; i < 15; i++) {
        elements.push(createLabelElement(`L${i}`));
        elements.push(instr('JMP', AsmAddressingMode.Absolute, undefined, `L${i + 1}`));
      }
      elements.push(createLabelElement('L15'));
      elements.push(instr('RTS'));

      const program = createTestProgram(elements);

      // Should not crash and should resolve at least partially
      const result = pass.run(program);
      expect(result.program).toBeDefined();
    });
  });

  // ========================================================================
  // Empty and Minimal Sections
  // ========================================================================

  describe('empty and minimal sections', () => {
    it('should handle section with only a label', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [createLabelElement('start')],
        }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should handle section with single instruction', () => {
      const program = createTestProgram([
        instr('RTS'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should handle section with single JMP (no chain target)', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'nowhere'),
      ]);

      const result = pass.run(program);
      // No label to chain through — no change
      expect(result.changed).toBe(false);
    });

    it('should handle empty section among other sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          { name: 'empty', elements: [] },
          {
            name: 'code',
            elements: [
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
      // Empty section unchanged
      expect(result.program.sections[0].elements).toHaveLength(0);
    });
  });

  // ========================================================================
  // Consecutive Terminators
  // ========================================================================

  describe('consecutive terminators', () => {
    it('should handle JMP followed by RTS (RTS is unreachable)', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('RTS'), // unreachable
        createLabelElement('target'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // RTS removed as unreachable
      expect(instrs).toEqual(['JMP target', 'NOP']);
    });

    it('should handle multiple JMPs in sequence (each makes next unreachable)', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'B'), // unreachable
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'C'), // unreachable
        createLabelElement('A'),
        createLabelElement('B'),
        createLabelElement('C'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // Only first JMP and RTS remain
      expect(instrs).toEqual(['JMP A', 'RTS']);
    });
  });

  // ========================================================================
  // All-Unreachable Section
  // ========================================================================

  describe('all-unreachable sections', () => {
    it('should handle section where everything after first instruction is unreachable', () => {
      const program = createTestProgram([
        instr('RTS'),
        instr('NOP'), // unreachable
        instr('NOP'), // unreachable
        instr('NOP'), // unreachable
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toEqual(['RTS']);
    });
  });

  // ========================================================================
  // Label-Only Chains
  // ========================================================================

  describe('label-only sections', () => {
    it('should handle consecutive labels without instructions', () => {
      const program = createTestProgram([
        createLabelElement('A'),
        createLabelElement('B'),
        createLabelElement('C'),
        instr('RTS'),
      ]);

      const result = pass.run(program);
      // No chains (labels are not followed by JMPs)
      expect(result.changed).toBe(false);
    });

    it('should handle JMP to label that has no instruction after it', () => {
      // label at end of section — no JMP chain possible
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        createLabelElement('end'),
      ]);

      const result = pass.run(program);
      // No chain — nothing after the label
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Comments/Blanks Between Label and JMP
  // ========================================================================

  describe('non-instruction elements in chains', () => {
    it('should still detect chain when comment is between label and JMP', () => {
      // label1: ; comment; JMP target — should still chain
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JMP', AsmAddressingMode.Absolute, undefined, 'label1'),
            createLabelElement('label1'),
            createCommentElement('this label chains'),
            instr('JMP', AsmAddressingMode.Absolute, undefined, 'final'),
            createLabelElement('final'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      // buildLabelTargetMap skips non-instruction elements between label and JMP
      // so this should still be detected as a chain (comments are skipped)
      // Note: actual behavior depends on implementation — comments are not isInstructionElement
      // The implementation skips non-instruction elements, so it will find the JMP
      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('JMP final');
    });
  });

  // ========================================================================
  // Branch-over-JMP Edge Cases
  // ========================================================================

  describe('branch-over-JMP edge cases', () => {
    it('should NOT match when branch has no label operand', () => {
      // Branch with numeric operand (shouldn't happen in practice, but edge case)
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, 5), // numeric, not label
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      // No pattern match because branch doesn't have labelOperand
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ $5');
    });

    it('should NOT match when JMP has no label operand', () => {
      // JMP to numeric address — can't match pattern
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, 0xFFFC), // numeric
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      // No pattern match
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ skip');
    });

    it('should NOT match when skip label is at end of section', () => {
      // Branch → JMP → (no label follows)
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        // No skip label at all
      ]);

      const result = pass.run(program);

      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ skip');
    });

    it('should handle branch-over-JMP where skip label is the last element', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        // No instruction after skip — still valid pattern
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BNE target');
    });
  });

  // ========================================================================
  // Fixed-Point Iteration
  // ========================================================================

  describe('fixed-point iteration', () => {
    it('should converge after all patterns are resolved', () => {
      // A complex case that requires multiple iterations:
      // JMP chain + unreachable code
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        instr('NOP'), // unreachable
        createLabelElement('A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'B'),
        instr('NOP'), // unreachable
        createLabelElement('B'),
        instr('LDA', AsmAddressingMode.Immediate, 42),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // Both NOPs should be removed, JMP should chain to B
      expect(instrs).not.toContain('NOP');
      expect(instrs[0]).toBe('JMP B');
    });

    it('should handle interleaved patterns requiring multiple passes', () => {
      // BEQ skip; JMP A; skip: NOP; JMP end; NOP; A: JMP end; NOP; end: RTS
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        createLabelElement('skip'),
        instr('NOP'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        instr('NOP'), // unreachable
        createLabelElement('A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        instr('NOP'), // unreachable
        createLabelElement('end'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Both unreachable NOPs should be removed
      // BEQ skip; JMP A; should become BNE A (or BNE end after chain resolve)
      // A → end is a chain, so BNE end
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toContain('RTS');
    });
  });

  // ========================================================================
  // Idempotency
  // ========================================================================

  describe('idempotency', () => {
    it('should return unchanged when run on already-optimized program', () => {
      // First run to optimize
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('NOP'), // unreachable
        createLabelElement('target'),
        instr('RTS'),
      ]);

      const firstResult = pass.run(program);
      expect(firstResult.changed).toBe(true);

      // Second run should be idempotent
      const secondResult = pass.run(firstResult.program);
      expect(secondResult.changed).toBe(false);
      expect(secondResult.program).toBe(firstResult.program);
    });

    it('should be idempotent on branch-over-JMP optimized code', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const first = pass.run(program);
      const second = pass.run(first.program);

      expect(second.changed).toBe(false);
      expect(second.program).toBe(first.program);
    });
  });
});
