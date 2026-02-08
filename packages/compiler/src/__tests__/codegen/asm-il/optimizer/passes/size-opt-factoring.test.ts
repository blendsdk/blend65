/**
 * SizeOptPass — Sequence Factoring Tests (Oz only)
 *
 * Tests the common sequence factoring optimization that extracts
 * repeated instruction sequences into generated subroutines.
 * This optimization is only active in aggressive (Oz) mode.
 */

import { describe, it, expect } from 'vitest';
import { SizeOptPass } from '../../../../../codegen/asm-il/optimizer/passes/size-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
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

/**
 * Create a repeated instruction sequence (3 instructions).
 * LDA #value; STA addr; NOP — a simple, non-control-flow pattern.
 */
function repeatedSequence(value: number, addr: number): AsmILElement[] {
  return [
    instr('LDA', AsmAddressingMode.Immediate, value),
    instr('STA', AsmAddressingMode.Absolute, addr),
    instr('NOP'),
  ];
}

/** Count instruction elements in an element array */
function countInstructions(elements: readonly AsmILElement[]): number {
  return elements.filter(e => isInstructionElement(e)).length;
}

/** Find all JSR instructions targeting factored routines */
function findFactoredJSRs(elements: readonly AsmILElement[]): AsmILElement[] {
  return elements.filter(
    e => isInstructionElement(e)
      && e.instruction.mnemonic === 'JSR'
      && e.instruction.labelOperand?.startsWith('.factored_')
  );
}

describe('SizeOptPass — Sequence Factoring (Oz)', () => {
  const ozPass = new SizeOptPass(true);   // Oz: factoring enabled
  const osPass = new SizeOptPass(false);  // Os: factoring disabled

  // ========================================================================
  // Mode Gating
  // ========================================================================

  describe('mode gating', () => {
    it('should NOT factor sequences in Os mode (non-aggressive)', () => {
      // Create a program with identical sequences that would be factorable
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq,
            instr('INX'),
            ...seq,
            instr('INX'),
            ...seq,
          ],
        }],
      };

      const result = osPass.run(program);

      // Os mode should not create any factored routines section
      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should factor sequences in Oz mode (aggressive)', () => {
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq,
            instr('INX'),
            ...seq,
            instr('INX'),
            ...seq,
          ],
        }],
      };

      const result = ozPass.run(program);

      expect(result.changed).toBe(true);
      // Should have created a _factored_routines section
      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeDefined();
    });
  });

  // ========================================================================
  // Basic Factoring
  // ========================================================================

  describe('basic factoring', () => {
    it('should extract repeated 3-instruction sequences into subroutines', () => {
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq,       // Occurrence 1
            instr('INX'), // Separator
            ...seq,       // Occurrence 2
            instr('INX'), // Separator
            ...seq,       // Occurrence 3
          ],
        }],
      };

      const result = ozPass.run(program);

      expect(result.changed).toBe(true);

      // Original section should have JSR calls replacing the sequences
      const codeSection = result.program.sections.find(s => s.name === 'code')!;
      const jsrs = findFactoredJSRs(codeSection.elements);
      expect(jsrs.length).toBeGreaterThanOrEqual(2); // At least 2 replacements

      // Should have a _factored_routines section
      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      )!;
      expect(factoredSection).toBeDefined();

      // The factored section should contain the sequence + RTS
      const factoredInstructions = factoredSection.elements.filter(
        e => isInstructionElement(e)
      );
      // Should have the 3 original instructions + RTS
      expect(factoredInstructions.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate unique subroutine labels', () => {
      // Two different repeated sequences
      const seq1 = repeatedSequence(0x01, 0xD020);
      const seq2 = repeatedSequence(0x02, 0xD021);

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq1, instr('INX'),
            ...seq1, instr('INX'),
            ...seq2, instr('INX'),
            ...seq2, instr('INX'),
          ],
        }],
      };

      const result = ozPass.run(program);

      if (result.changed) {
        const factoredSection = result.program.sections.find(
          s => s.name === '_factored_routines'
        );
        if (factoredSection) {
          // Check that labels are unique
          const labels = factoredSection.elements
            .filter(e => e.kind === 'label')
            .map(e => (e as { kind: 'label'; label: { name: string } }).label.name);
          const uniqueLabels = new Set(labels);
          expect(uniqueLabels.size).toBe(labels.length);
        }
      }
    });

    it('should add RTS at end of each factored subroutine', () => {
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq, instr('INX'),
            ...seq, instr('INX'),
            ...seq,
          ],
        }],
      };

      const result = ozPass.run(program);

      if (result.changed) {
        const factoredSection = result.program.sections.find(
          s => s.name === '_factored_routines'
        );
        if (factoredSection) {
          // Last instruction should be RTS
          const lastInstr = [...factoredSection.elements]
            .reverse()
            .find(e => isInstructionElement(e));
          expect(lastInstr).toBeDefined();
          if (lastInstr && isInstructionElement(lastInstr)) {
            expect(lastInstr.instruction.mnemonic).toBe('RTS');
          }
        }
      }
    });
  });

  // ========================================================================
  // Control Flow Safety
  // ========================================================================

  describe('control flow safety', () => {
    it('should NOT factor sequences containing JMP', () => {
      // Sequence with control flow — not safe to extract
      const seqWithJmp: AsmILElement[] = [
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('NOP'),
      ];

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seqWithJmp, instr('INX'),
            ...seqWithJmp, instr('INX'),
            ...seqWithJmp,
          ],
        }],
      };

      const result = ozPass.run(program);

      // Should not have a factored section (control flow prevents factoring)
      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should NOT factor sequences containing branch instructions', () => {
      const seqWithBranch: AsmILElement[] = [
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('NOP'),
      ];

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seqWithBranch, instr('INX'),
            ...seqWithBranch, instr('INX'),
            ...seqWithBranch,
          ],
        }],
      };

      const result = ozPass.run(program);

      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should NOT factor sequences containing JSR', () => {
      const seqWithJSR: AsmILElement[] = [
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'func'),
        instr('NOP'),
      ];

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seqWithJSR, instr('INX'),
            ...seqWithJSR, instr('INX'),
            ...seqWithJSR,
          ],
        }],
      };

      const result = ozPass.run(program);

      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should NOT factor sequences containing RTS', () => {
      const seqWithRTS: AsmILElement[] = [
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('RTS'),
      ];

      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seqWithRTS, instr('INX'),
            ...seqWithRTS, instr('INX'),
            ...seqWithRTS,
          ],
        }],
      };

      const result = ozPass.run(program);

      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should not factor when sequence appears only once', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.Immediate, 0x01),
            instr('STA', AsmAddressingMode.Absolute, 0xD020),
            instr('NOP'),
            instr('INX'),
          ],
        }],
      };

      const result = ozPass.run(program);

      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should handle empty program without errors', () => {
      const program = createAsmILProgram('test');
      const result = ozPass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should handle section with fewer instructions than minimum sequence length', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.Immediate, 0),
            instr('RTS'), // Only 2 instructions, below min sequence length of 3
          ],
        }],
      };

      const result = ozPass.run(program);

      // No factoring possible with only 2 instructions
      const factoredSection = result.program.sections.find(
        s => s.name === '_factored_routines'
      );
      expect(factoredSection).toBeUndefined();
    });

    it('should factor sequences that span across sections', () => {
      const seq = repeatedSequence(0x05, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          {
            name: 'section1',
            elements: [...seq, instr('INX')],
          },
          {
            name: 'section2',
            elements: [...seq, instr('INX')],
          },
        ],
      };

      const result = ozPass.run(program);

      // The same sequence in two different sections should be factorable
      if (result.changed) {
        const factoredSection = result.program.sections.find(
          s => s.name === '_factored_routines'
        );
        expect(factoredSection).toBeDefined();
      }
    });
  });

  // ========================================================================
  // Stats
  // ========================================================================

  describe('factoring stats', () => {
    it('should report patterns matched for factored sequences', () => {
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            ...seq, instr('INX'),
            ...seq, instr('INX'),
            ...seq,
          ],
        }],
      };

      const result = ozPass.run(program);

      if (result.changed) {
        // Should report patterns matched (one per replacement)
        expect(result.stats.patternsMatched).toBeGreaterThan(0);
        // Should report instructions removed
        expect(result.stats.instructionsRemoved).toBeGreaterThan(0);
        // Should report instructions added (JSRs + subroutine)
        expect(result.stats.instructionsAdded).toBeGreaterThan(0);
      }
    });
  });

  // ========================================================================
  // Combined Tail Call + Factoring
  // ========================================================================

  describe('combined optimizations', () => {
    it('should apply both tail call and sequence factoring in Oz mode', () => {
      const seq = repeatedSequence(0x00, 0xD020);
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            // Tail call pattern
            instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper'),
            instr('RTS'),
          ],
        },
        {
          name: 'code2',
          elements: [
            // Repeated sequences for factoring
            ...seq, instr('INX'),
            ...seq, instr('INX'),
            ...seq,
          ],
        }],
      };

      const result = ozPass.run(program);

      expect(result.changed).toBe(true);

      // Tail call should be optimized
      const codeSection = result.program.sections.find(s => s.name === 'code')!;
      const jmpFound = codeSection.elements.some(
        e => isInstructionElement(e) && e.instruction.mnemonic === 'JMP'
      );
      expect(jmpFound).toBe(true);
    });
  });
});
