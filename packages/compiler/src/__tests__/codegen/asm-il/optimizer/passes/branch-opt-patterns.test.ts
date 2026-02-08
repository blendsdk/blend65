/**
 * BranchOptPass — Pattern Tests
 *
 * Tests the three core optimization patterns:
 * 1. JMP chain collapse
 * 2. Unreachable code removal
 * 3. Branch-over-JMP inversion
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

/** Extract instruction mnemonics and label operands from elements for easy assertion */
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

/** Extract labels from elements */
function extractLabels(elements: readonly AsmILElement[]): string[] {
  return elements
    .filter(el => el.kind === 'label')
    .map(el => (el as { kind: 'label'; label: { name: string } }).label.name);
}

describe('BranchOptPass — Patterns', () => {
  const pass = new BranchOptPass();

  // ========================================================================
  // Pattern 1: JMP Chain Collapse
  // ========================================================================

  describe('JMP chain collapse', () => {
    it('should collapse a simple JMP → JMP chain', () => {
      // JMP label1; ...; label1: JMP label2 → JMP label2
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'label1'),
        createLabelElement('label1'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'label2'),
        createLabelElement('label2'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // First JMP should target label2 directly
      expect(instrs[0]).toBe('JMP label2');
    });

    it('should collapse a 3-level JMP chain', () => {
      // JMP A → A: JMP B → B: JMP C → JMP C directly
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        createLabelElement('A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'B'),
        createLabelElement('B'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'C'),
        createLabelElement('C'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // First JMP should go directly to C
      expect(instrs[0]).toBe('JMP C');
    });

    it('should collapse conditional branch → JMP chain', () => {
      // BEQ label1; ...; label1: JMP label2 → BEQ label2
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'label1'),
        instr('NOP'),
        createLabelElement('label1'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'final'),
        createLabelElement('final'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // BEQ should target 'final' directly
      expect(instrs[0]).toBe('BEQ final');
    });

    it('should collapse multiple branch chains in one pass', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'mid1'),
        instr('BNE', AsmAddressingMode.Relative, undefined, 'mid2'),
        instr('NOP'),
        createLabelElement('mid1'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'final1'),
        createLabelElement('mid2'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'final2'),
        createLabelElement('final1'),
        instr('NOP'),
        createLabelElement('final2'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ final1');
      expect(instrs[1]).toBe('BNE final2');
    });

    it('should not collapse JMP that does not go through a chain', () => {
      // JMP target where target is NOT followed by another JMP
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('target'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      // No chain — should not change JMP target
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('JMP target');
    });

    it('should handle label followed by multiple labels then JMP', () => {
      // label1: label2: JMP target — both should be chains
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'label1'),
        createLabelElement('label1'),
        createLabelElement('label2'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'final'),
        createLabelElement('final'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('JMP final');
    });
  });

  // ========================================================================
  // Pattern 2: Unreachable Code Removal
  // ========================================================================

  describe('unreachable code removal', () => {
    it('should remove instructions after JMP', () => {
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('LDA', AsmAddressingMode.Immediate, 5),   // unreachable
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),  // unreachable
        createLabelElement('target'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      const instrs = extractInstructions(elements);
      // Only JMP and RTS should remain
      expect(instrs).toEqual(['JMP target', 'RTS']);
    });

    it('should remove instructions after RTS', () => {
      const program = createTestProgram([
        instr('RTS'),
        instr('NOP'), // unreachable
        instr('NOP'), // unreachable
        createLabelElement('next'),
        instr('LDA', AsmAddressingMode.Immediate, 0),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toEqual(['RTS', 'LDA $0']);
    });

    it('should remove instructions after RTI', () => {
      const program = createTestProgram([
        instr('RTI'),
        instr('NOP'), // unreachable
        createLabelElement('next'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toEqual(['RTI', 'RTS']);
    });

    it('should remove instructions after BRK', () => {
      const program = createTestProgram([
        instr('BRK'),
        instr('NOP'), // unreachable
        createLabelElement('next'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toEqual(['BRK', 'RTS']);
    });

    it('should NOT remove code after conditional branches', () => {
      // Conditional branches have two successors — fall-through is reachable
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'target'),
        instr('NOP'), // reachable (fall-through)
        createLabelElement('target'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      // NOP is still there
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).toContain('NOP');
    });

    it('should stop removing at label boundaries', () => {
      // Labels can be jumped to from elsewhere — they start reachable code
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        instr('NOP'), // unreachable
        createLabelElement('middle'), // reachable boundary
        instr('LDA', AsmAddressingMode.Immediate, 42), // reachable (via middle label)
        createLabelElement('end'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      const instrs = extractInstructions(elements);
      // NOP removed, but LDA preserved
      expect(instrs).toEqual(['JMP end', 'LDA $2A', 'RTS']);
    });

    it('should handle multiple unreachable regions', () => {
      // JMP second → second: JMP end → chain collapses to JMP end
      // Both NOPs are unreachable and removed
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'second'),
        instr('NOP'), // unreachable
        createLabelElement('second'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        instr('NOP'), // unreachable
        instr('NOP'), // unreachable
        createLabelElement('end'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      // Chain collapse: JMP second → JMP end (second → end is a chain)
      expect(instrs).toEqual(['JMP end', 'JMP end', 'RTS']);
    });

    it('should remove comments and blanks in unreachable regions', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
            createCommentElement('unreachable comment'),
            instr('NOP'), // unreachable
            createBlankElement(),
            createLabelElement('end'),
            instr('RTS'),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const elements = result.program.sections[0].elements;
      // Should have: JMP, label, RTS (everything between removed)
      expect(elements).toHaveLength(3);
    });
  });

  // ========================================================================
  // Pattern 3: Branch-over-JMP Inversion
  // ========================================================================

  describe('branch-over-JMP inversion', () => {
    it('should replace BEQ skip; JMP target; skip: with BNE target', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BNE target');
    });

    it('should replace BNE skip; JMP target; skip: with BEQ target', () => {
      const program = createTestProgram([
        instr('BNE', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ target');
    });

    it('should replace BCC skip; JMP target; skip: with BCS target', () => {
      const program = createTestProgram([
        instr('BCC', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BCS target');
    });

    it('should replace BCS skip; JMP target; skip: with BCC target', () => {
      const program = createTestProgram([
        instr('BCS', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BCC target');
    });

    it('should replace BMI/BPL inversions', () => {
      // BMI → BPL
      const program1 = createTestProgram([
        instr('BMI', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);
      const result1 = pass.run(program1);
      expect(extractInstructions(result1.program.sections[0].elements)[0]).toBe('BPL target');

      // BPL → BMI
      const program2 = createTestProgram([
        instr('BPL', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);
      const result2 = pass.run(program2);
      expect(extractInstructions(result2.program.sections[0].elements)[0]).toBe('BMI target');
    });

    it('should replace BVC/BVS inversions', () => {
      // BVC → BVS
      const program1 = createTestProgram([
        instr('BVC', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);
      const result1 = pass.run(program1);
      expect(extractInstructions(result1.program.sections[0].elements)[0]).toBe('BVS target');

      // BVS → BVC
      const program2 = createTestProgram([
        instr('BVS', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);
      const result2 = pass.run(program2);
      expect(extractInstructions(result2.program.sections[0].elements)[0]).toBe('BVC target');
    });

    it('should preserve the skip label (it might be used by other branches)', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'far'),
        createLabelElement('skip'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const labels = extractLabels(result.program.sections[0].elements);
      // skip label should still be present
      expect(labels).toContain('skip');
    });

    it('should NOT match when there is code between branch and JMP', () => {
      // BEQ skip; NOP; JMP target; skip: — NOP is between branch and JMP
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('NOP'), // instruction between branch and JMP
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('skip'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      // Should NOT be changed by branch-over-JMP (NOP is between)
      const instrs = extractInstructions(result.program.sections[0].elements);
      // BEQ should still target 'skip'
      expect(instrs[0]).toBe('BEQ skip');
    });

    it('should NOT match when label between JMP and skip is wrong', () => {
      // BEQ skip; JMP target; other_label: — label doesn't match
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        createLabelElement('wrong_label'),
        instr('NOP'),
      ]);

      const result = pass.run(program);

      // Pattern doesn't match — BEQ unchanged
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BEQ skip');
    });

    it('should handle comments between JMP and skip label', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
            instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
            createCommentElement('this is a comment'),
            createLabelElement('skip'),
            instr('NOP'),
          ],
        }],
      };

      const result = pass.run(program);

      // Comments are transparent — pattern should still match
      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BNE target');
    });

    it('should handle multiple branch-over-JMP patterns in sequence', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip1'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target1'),
        createLabelElement('skip1'),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'skip2'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target2'),
        createLabelElement('skip2'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs[0]).toBe('BNE target1');
      expect(instrs[1]).toBe('BCS target2');
    });
  });

  // ========================================================================
  // Combined Patterns (cross-pattern interactions)
  // ========================================================================

  describe('combined pattern interactions', () => {
    it('should remove unreachable code created after chain collapse makes JMP dead', () => {
      // JMP A; NOP1; A: JMP B; NOP2; B: RTS
      // After chain collapse: JMP B; NOP1; A: JMP B; NOP2; B: RTS
      // After unreachable: JMP B; A: JMP B; B: RTS (NOP1 removed)
      // Then A: JMP B; is unreachable from JMP B; but label A ends it
      const program = createTestProgram([
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'A'),
        instr('NOP'), // unreachable
        createLabelElement('A'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'B'),
        instr('NOP'), // unreachable
        createLabelElement('B'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Both NOPs should be removed
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs).not.toContain('NOP');
    });

    it('should handle branch-over-JMP followed by unreachable code', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'done'),
        createLabelElement('skip'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'end'),
        instr('NOP'), // unreachable after JMP
        createLabelElement('done'),
        instr('NOP'),
        createLabelElement('end'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // The unreachable NOP after the second JMP should be removed
      const instrs = extractInstructions(result.program.sections[0].elements);
      expect(instrs.filter(i => i === 'NOP')).toHaveLength(1); // only the one at 'done'
    });
  });
});
