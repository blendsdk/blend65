/**
 * LongBranchExpansionPass — Unit Tests
 *
 * Tests the long-branch expansion pass that detects conditional branches
 * whose targets may exceed the 6502's ±127 byte range and expands them
 * into inverted-branch + JMP patterns.
 *
 * Covers:
 * - Pass metadata
 * - Short branches NOT expanded
 * - Long forward branches expanded with correct inversion
 * - Long backward branches expanded
 * - All 8 branch type inversions (BCS↔BCC, BEQ↔BNE, BMI↔BPL, BVC↔BVS)
 * - Unique skip label generation
 * - Target not found in section (no crash)
 * - Multiple sections processed independently
 * - Mixed short and long branches
 * - Stats reporting
 * - Byte estimation per addressing mode
 */

import { describe, it, expect } from 'vitest';
import { LongBranchExpansionPass } from '../../../../../codegen/asm-il/optimizer/passes/long-branch-expansion.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
  createBlankElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILElement, AsmILProgram } from '../../../../../codegen/asm-il/types.js';

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

/**
 * Create a section with a forward branch followed by N filler instructions
 * and then the target label. Each filler is a 2-byte LDA #imm instruction.
 *
 * This simulates a branch jumping over a large block of code.
 *
 * @param branchMnemonic - The conditional branch mnemonic (e.g., 'BCS')
 * @param targetLabel - The label the branch targets
 * @param fillerCount - Number of filler instructions between branch and label
 * @returns Array of AsmILElements forming the section content
 */
function createForwardBranchSection(
  branchMnemonic: string,
  targetLabel: string,
  fillerCount: number
): AsmILElement[] {
  const elements: AsmILElement[] = [];

  // The conditional branch
  elements.push(instr(branchMnemonic, AsmAddressingMode.Relative, undefined, targetLabel));

  // N filler instructions (each is 2 bytes: LDA #imm)
  for (let i = 0; i < fillerCount; i++) {
    elements.push(instr('LDA', AsmAddressingMode.Immediate, i & 0xFF));
  }

  // The target label
  elements.push(createLabelElement(targetLabel, true));

  // A trailing instruction after the label
  elements.push(instr('RTS'));

  return elements;
}

/**
 * Create a section with a backward branch (label before branch) separated
 * by N filler instructions. Each filler is a 2-byte LDA #imm instruction.
 *
 * @param branchMnemonic - The conditional branch mnemonic
 * @param targetLabel - The label the branch targets
 * @param fillerCount - Number of filler instructions between label and branch
 * @returns Array of AsmILElements forming the section content
 */
function createBackwardBranchSection(
  branchMnemonic: string,
  targetLabel: string,
  fillerCount: number
): AsmILElement[] {
  const elements: AsmILElement[] = [];

  // The target label (comes first for backward branch)
  elements.push(createLabelElement(targetLabel, true));

  // N filler instructions (each is 2 bytes: LDA #imm)
  for (let i = 0; i < fillerCount; i++) {
    elements.push(instr('LDA', AsmAddressingMode.Immediate, i & 0xFF));
  }

  // The conditional branch (jumps backward to label)
  elements.push(instr(branchMnemonic, AsmAddressingMode.Relative, undefined, targetLabel));

  return elements;
}

/** Create a program with a single section containing the given elements */
function createTestProgram(elements: AsmILElement[], sectionName = 'code'): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LongBranchExpansionPass', () => {
  const pass = new LongBranchExpansionPass();

  // ========================================================================
  // Pass Metadata
  // ========================================================================

  describe('metadata', () => {
    it('should have name "long-branch-expansion"', () => {
      expect(pass.name).toBe('long-branch-expansion');
    });

    it('should be a transform pass', () => {
      expect(pass.isTransform).toBe(true);
    });
  });

  // ========================================================================
  // Short Branches — NOT Expanded
  // ========================================================================

  describe('short branches NOT expanded', () => {
    it('should not expand a short forward branch (20 instructions = ~40 bytes)', () => {
      const elements = createForwardBranchSection('BCS', '.endloop', 20);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      // 40 bytes is well under the 100-byte threshold — no expansion
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
      expect(result.stats.patternsMatched).toBe(0);
    });

    it('should not expand a short backward branch (10 instructions = ~20 bytes)', () => {
      const elements = createBackwardBranchSection('BNE', '.loop', 10);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should not expand a branch to a nearby label', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, '.skip'),
        instr('LDA', AsmAddressingMode.Immediate, 42),
        createLabelElement('.skip', true),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Long Forward Branches — Expanded
  // ========================================================================

  describe('long forward branches expanded', () => {
    it('should expand a forward BCS that exceeds the threshold', () => {
      // 60 LDA #imm instructions = 60×2 = 120 bytes > 100 threshold
      const elements = createForwardBranchSection('BCS', '.endfor', 60);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);

      // Verify the expansion pattern: BCC .skip_long_0; JMP .endfor; .skip_long_0:
      const resultElements = result.program.sections[0].elements;

      // First element should be the inverted branch (BCS → BCC)
      expect(resultElements[0].kind).toBe('instruction');
      if (resultElements[0].kind === 'instruction') {
        expect(resultElements[0].instruction.mnemonic).toBe('BCC');
        expect(resultElements[0].instruction.labelOperand).toBe('.skip_long_0');
        expect(resultElements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
      }

      // Second element should be JMP to the original target
      expect(resultElements[1].kind).toBe('instruction');
      if (resultElements[1].kind === 'instruction') {
        expect(resultElements[1].instruction.mnemonic).toBe('JMP');
        expect(resultElements[1].instruction.labelOperand).toBe('.endfor');
        expect(resultElements[1].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }

      // Third element should be the skip label
      expect(resultElements[2].kind).toBe('label');
      if (resultElements[2].kind === 'label') {
        expect(resultElements[2].label.name).toBe('.skip_long_0');
        expect(resultElements[2].label.isLocal).toBe(true);
      }

      // Original filler instructions and target label should follow
      // Total: 3 (expanded) + 60 (filler) + 1 (target label) + 1 (RTS) = 65
      expect(resultElements.length).toBe(65);
    });
  });

  // ========================================================================
  // Long Backward Branches — Expanded
  // ========================================================================

  describe('long backward branches expanded', () => {
    it('should expand a backward BNE that exceeds the threshold', () => {
      // 60 LDA #imm instructions = 60×2 = 120 bytes > 100 threshold
      const elements = createBackwardBranchSection('BNE', '.loopstart', 60);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);

      // The branch is the last element in the original array.
      // After expansion, it should be replaced with:
      // BEQ .skip_long_0; JMP .loopstart; .skip_long_0:
      const resultElements = result.program.sections[0].elements;

      // The expanded branch should be near the end (after label + 60 fillers)
      // Index: 0 (label) + 60 (fillers) = index 61 is where BNE was
      // Now it's: index 61 = BEQ (inverted), 62 = JMP, 63 = skip label
      const branchIdx = 61;
      expect(resultElements[branchIdx].kind).toBe('instruction');
      if (resultElements[branchIdx].kind === 'instruction') {
        expect(resultElements[branchIdx].instruction.mnemonic).toBe('BEQ');
        expect(resultElements[branchIdx].instruction.labelOperand).toBe('.skip_long_0');
      }

      expect(resultElements[branchIdx + 1].kind).toBe('instruction');
      if (resultElements[branchIdx + 1].kind === 'instruction') {
        expect(resultElements[branchIdx + 1].instruction.mnemonic).toBe('JMP');
        expect(resultElements[branchIdx + 1].instruction.labelOperand).toBe('.loopstart');
      }

      expect(resultElements[branchIdx + 2].kind).toBe('label');
      if (resultElements[branchIdx + 2].kind === 'label') {
        expect(resultElements[branchIdx + 2].label.name).toBe('.skip_long_0');
      }
    });
  });

  // ========================================================================
  // All 8 Branch Inversions
  // ========================================================================

  describe('all 8 branch type inversions', () => {
    const inversions: [string, string][] = [
      ['BCS', 'BCC'],
      ['BCC', 'BCS'],
      ['BEQ', 'BNE'],
      ['BNE', 'BEQ'],
      ['BMI', 'BPL'],
      ['BPL', 'BMI'],
      ['BVC', 'BVS'],
      ['BVS', 'BVC'],
    ];

    for (const [original, inverted] of inversions) {
      it(`should invert ${original} to ${inverted} when expanding`, () => {
        // 60 fillers = 120 bytes > 100 threshold
        const elements = createForwardBranchSection(original, '.target', 60);
        const program = createTestProgram(elements);

        const result = pass.run(program);

        expect(result.changed).toBe(true);

        const firstEl = result.program.sections[0].elements[0];
        expect(firstEl.kind).toBe('instruction');
        if (firstEl.kind === 'instruction') {
          expect(firstEl.instruction.mnemonic).toBe(inverted);
        }
      });
    }
  });

  // ========================================================================
  // Unique Skip Labels
  // ========================================================================

  describe('unique skip labels', () => {
    it('should generate unique skip labels for multiple expansions in same section', () => {
      const elements: AsmILElement[] = [];

      // First long branch
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target1'));
      for (let i = 0; i < 60; i++) {
        elements.push(instr('LDA', AsmAddressingMode.Immediate, i & 0xFF));
      }
      elements.push(createLabelElement('.target1', true));

      // Second long branch
      elements.push(instr('BEQ', AsmAddressingMode.Relative, undefined, '.target2'));
      for (let i = 0; i < 60; i++) {
        elements.push(instr('STA', AsmAddressingMode.ZeroPage, i & 0xFF));
      }
      elements.push(createLabelElement('.target2', true));

      elements.push(instr('RTS'));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);

      // Find the two skip labels — they should be different
      const labels = result.program.sections[0].elements
        .filter(e => e.kind === 'label' && e.label.name.startsWith('.skip_long_'))
        .map(e => (e as { kind: 'label'; label: { name: string } }).label.name);

      expect(labels).toHaveLength(2);
      expect(labels[0]).toBe('.skip_long_0');
      expect(labels[1]).toBe('.skip_long_1');
      expect(labels[0]).not.toBe(labels[1]);
    });

    it('should generate local labels (starting with .)', () => {
      const elements = createForwardBranchSection('BCS', '.endfor', 60);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      const skipLabels = result.program.sections[0].elements
        .filter(e => e.kind === 'label' && e.label.name.startsWith('.skip_long_'));

      expect(skipLabels.length).toBeGreaterThan(0);
      for (const label of skipLabels) {
        if (label.kind === 'label') {
          expect(label.label.name.startsWith('.')).toBe(true);
          expect(label.label.isLocal).toBe(true);
        }
      }
    });
  });

  // ========================================================================
  // Target Not Found in Section
  // ========================================================================

  describe('target not found', () => {
    it('should not expand and not crash when target label is not in section', () => {
      // Branch to a label that doesn't exist in the section
      const program = createTestProgram([
        instr('BCS', AsmAddressingMode.Relative, undefined, '.external_label'),
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      // Should not crash, should not expand
      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
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
              // Short branch — no expansion
              instr('BEQ', AsmAddressingMode.Relative, undefined, '.done'),
              instr('NOP'),
              createLabelElement('.done', true),
              instr('RTS'),
            ],
          },
          {
            name: 'main',
            elements: createForwardBranchSection('BCS', '.endfor', 60),
          },
        ],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // First section unchanged (short branch)
      expect(result.program.sections[0].elements).toHaveLength(4);
      // Second section expanded (long branch: 1 branch → 3 elements)
      expect(result.program.sections[1].elements.length).toBeGreaterThan(62);
    });

    it('should preserve unchanged sections by reference', () => {
      const unchangedSection = {
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
            elements: createForwardBranchSection('BCS', '.endfor', 60),
          },
        ],
      };

      const result = pass.run(program);

      // Unchanged section should be the same reference
      expect(result.program.sections[0]).toBe(unchangedSection);
    });
  });

  // ========================================================================
  // No Branches in Section
  // ========================================================================

  describe('no branches in section', () => {
    it('should return unchanged program when there are no conditional branches', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        createLabelElement('.done', true),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return unchanged for empty program', () => {
      const program = createAsmILProgram('test');
      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Mixed Short and Long Branches
  // ========================================================================

  describe('mixed short and long branches', () => {
    it('should only expand long branches, keeping short ones intact', () => {
      const elements: AsmILElement[] = [];

      // Short branch (5 instructions = 10 bytes — well under threshold)
      elements.push(instr('BEQ', AsmAddressingMode.Relative, undefined, '.near'));
      for (let i = 0; i < 5; i++) {
        elements.push(instr('NOP'));
      }
      elements.push(createLabelElement('.near', true));

      // Long branch (60 instructions = 120 bytes — over threshold)
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.far'));
      for (let i = 0; i < 60; i++) {
        elements.push(instr('LDA', AsmAddressingMode.Immediate, i & 0xFF));
      }
      elements.push(createLabelElement('.far', true));

      elements.push(instr('RTS'));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Only the long branch should be expanded
      expect(result.stats.patternsMatched).toBe(1);

      // The short BEQ should still be there unchanged
      const firstEl = result.program.sections[0].elements[0];
      expect(firstEl.kind).toBe('instruction');
      if (firstEl.kind === 'instruction') {
        expect(firstEl.instruction.mnemonic).toBe('BEQ');
        expect(firstEl.instruction.labelOperand).toBe('.near');
      }
    });
  });

  // ========================================================================
  // Stats Reporting
  // ========================================================================

  describe('stats reporting', () => {
    it('should report zero stats when no branches are expanded', () => {
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, undefined, '.done'),
        instr('NOP'),
        createLabelElement('.done', true),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
    });

    it('should report correct stats for a single expansion', () => {
      const elements = createForwardBranchSection('BCS', '.endfor', 60);
      const program = createTestProgram(elements);

      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(1);
      // 1 instruction added (replaced 1 branch with 2 instructions + 1 label = net +1)
      expect(result.stats.instructionsAdded).toBe(1);
      // 3 bytes added per expansion (2-byte branch → 2-byte branch + 3-byte JMP)
      expect(result.stats.estimatedBytesSaved).toBe(-3);
    });

    it('should accumulate stats across multiple expansions', () => {
      const elements: AsmILElement[] = [];

      // Two long branches
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.t1'));
      for (let i = 0; i < 60; i++) elements.push(instr('LDA', AsmAddressingMode.Immediate, 0));
      elements.push(createLabelElement('.t1', true));

      elements.push(instr('BEQ', AsmAddressingMode.Relative, undefined, '.t2'));
      for (let i = 0; i < 60; i++) elements.push(instr('LDA', AsmAddressingMode.Immediate, 0));
      elements.push(createLabelElement('.t2', true));

      elements.push(instr('RTS'));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsAdded).toBe(2);
      expect(result.stats.estimatedBytesSaved).toBe(-6);
    });
  });

  // ========================================================================
  // Byte Estimation Accuracy
  // ========================================================================

  describe('byte estimation per addressing mode', () => {
    it('should estimate 1 byte for Implied mode instructions', () => {
      // Byte distance includes the branch instruction itself (2 bytes, Relative mode).
      // Use 98 NOP (Implied) instructions — each is 1 byte = 98 bytes.
      // Total: 2 (branch) + 98 (NOPs) = 100 bytes = threshold, NOT > 100.
      const elements: AsmILElement[] = [];
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target'));
      for (let i = 0; i < 98; i++) {
        elements.push(instr('NOP', AsmAddressingMode.Implied));
      }
      elements.push(createLabelElement('.target', true));
      elements.push(instr('RTS'));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // 2 + 98 = 100 bytes — NOT > 100, so no expansion
      expect(result.changed).toBe(false);
    });

    it('should estimate 1 byte correctly — 99 Implied instructions should expand', () => {
      // Total: 2 (branch) + 99 (NOPs) = 101 bytes > 100 threshold → expand
      const elements: AsmILElement[] = [];
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target'));
      for (let i = 0; i < 99; i++) {
        elements.push(instr('NOP', AsmAddressingMode.Implied));
      }
      elements.push(createLabelElement('.target', true));
      elements.push(instr('RTS'));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // 2 + 99 = 101 bytes > 100 threshold → expand
      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
    });

    it('should estimate 2 bytes for Immediate mode instructions', () => {
      // 51 LDA #imm (Immediate) = 51 × 2 = 102 bytes > 100 → expand
      const elements: AsmILElement[] = [];
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target'));
      for (let i = 0; i < 51; i++) {
        elements.push(instr('LDA', AsmAddressingMode.Immediate, 0));
      }
      elements.push(createLabelElement('.target', true));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // 51 × 2 = 102 > 100 → should expand
      expect(result.changed).toBe(true);
    });

    it('should estimate 3 bytes for Absolute mode instructions', () => {
      // 34 STA $1000 (Absolute) = 34 × 3 = 102 bytes > 100 → expand
      const elements: AsmILElement[] = [];
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target'));
      for (let i = 0; i < 34; i++) {
        elements.push(instr('STA', AsmAddressingMode.Absolute, 0x1000));
      }
      elements.push(createLabelElement('.target', true));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // 34 × 3 = 102 > 100 → should expand
      expect(result.changed).toBe(true);
    });

    it('should not count labels and comments in byte estimation', () => {
      // 49 LDA #imm = 49 × 2 = 98 bytes < 100
      // But add many labels and comments — they should not add bytes
      const elements: AsmILElement[] = [];
      elements.push(instr('BCS', AsmAddressingMode.Relative, undefined, '.target'));
      for (let i = 0; i < 49; i++) {
        elements.push(createCommentElement(`iteration ${i}`));
        elements.push(createLabelElement(`.iter${i}`, true));
        elements.push(instr('LDA', AsmAddressingMode.Immediate, i & 0xFF));
        elements.push(createBlankElement());
      }
      elements.push(createLabelElement('.target', true));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // Only 49 × 2 = 98 bytes of instructions — should NOT expand
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle JMP instructions without expanding them (only conditional branches)', () => {
      // JMP is not a conditional branch — should never be expanded
      const elements: AsmILElement[] = [];
      elements.push(instr('JMP', AsmAddressingMode.Absolute, undefined, '.far'));
      for (let i = 0; i < 60; i++) {
        elements.push(instr('LDA', AsmAddressingMode.Immediate, 0));
      }
      elements.push(createLabelElement('.far', true));

      const program = createTestProgram(elements);
      const result = pass.run(program);

      // JMP already has unlimited range — no expansion needed
      expect(result.changed).toBe(false);
    });

    it('should handle branches without label operands (numeric operand)', () => {
      // A branch with no labelOperand — should not be processed
      const program = createTestProgram([
        instr('BEQ', AsmAddressingMode.Relative, 10),
        instr('NOP'),
        instr('RTS'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should reset label counter between run() invocations', () => {
      const elements = createForwardBranchSection('BCS', '.endfor', 60);

      // Run the pass twice on different programs
      const program1 = createTestProgram(elements, 'code1');
      const result1 = pass.run(program1);

      const program2 = createTestProgram(
        createForwardBranchSection('BEQ', '.endwhile', 60),
        'code2'
      );
      const result2 = pass.run(program2);

      // Both should start with .skip_long_0 (counter resets per run)
      const skipLabel1 = result1.program.sections[0].elements
        .find(e => e.kind === 'label' && e.label.name.startsWith('.skip_long_'));
      const skipLabel2 = result2.program.sections[0].elements
        .find(e => e.kind === 'label' && e.label.name.startsWith('.skip_long_'));

      expect(skipLabel1).toBeDefined();
      expect(skipLabel2).toBeDefined();
      if (skipLabel1?.kind === 'label' && skipLabel2?.kind === 'label') {
        expect(skipLabel1.label.name).toBe('.skip_long_0');
        expect(skipLabel2.label.name).toBe('.skip_long_0');
      }
    });
  });
});
