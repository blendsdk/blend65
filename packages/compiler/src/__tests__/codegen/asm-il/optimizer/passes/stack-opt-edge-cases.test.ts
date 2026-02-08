/**
 * StackOptPass — Edge Case Tests
 *
 * Tests labels breaking patterns, control flow, nested PHA/PLA,
 * and boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { StackOptPass } from '../../../../../codegen/asm-il/optimizer/passes/stack-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
) {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[],
  sectionName = 'code'
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

function getMnemonics(program: AsmILProgram, sectionIndex = 0): string[] {
  return program.sections[sectionIndex].elements
    .filter(isInstructionElement)
    .map(el => el.instruction.mnemonic);
}

describe('StackOptPass — Edge Cases', () => {
  const pass = new StackOptPass();

  // ========================================================================
  // Labels Break Patterns
  // ========================================================================

  describe('labels break patterns', () => {
    it('should NOT remove PHA/PLA when label exists between them', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('PHA'),
            createLabelElement('target'), // Label breaks analysis
            instr('PLA'),
          ],
        }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove when label after PLA prevents overwrite detection', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('PHA'),
            instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A
            instr('PLA'),
            createLabelElement('here'), // Label before LDA blocks overwrite detection
            instr('LDA', AsmAddressingMode.Immediate, 10),
          ],
        }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Control Flow Breaks Patterns
  // ========================================================================

  describe('control flow breaks patterns', () => {
    it('should NOT remove PHA/PLA when JMP exists between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'elsewhere'),
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove PHA/PLA when JSR exists between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'subroutine'),
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove PHA/PLA when BEQ exists between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove PHA/PLA when BNE exists between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('BNE', AsmAddressingMode.Relative, undefined, 'loop'),
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove PHA/PLA when RTS exists between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('RTS'),
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Nested PHA/PLA Pairs
  // ========================================================================

  describe('nested PHA/PLA pairs', () => {
    it('should handle nested PHA/PLA — remove outer if A unmodified at outer level', () => {
      // Outer: PHA...PLA with nested PHA/PLA inside
      // At outer level, only INX runs (no A modification)
      const program = createTestProgram([
        instr('PHA'),       // outer push (depth=1)
        instr('INX'),       // no A mod
        instr('PHA'),       // inner push (depth=2)
        instr('INY'),       // no A mod (at depth 2, doesn't affect outer check)
        instr('PLA'),       // inner pop (depth=1)
        instr('PLA'),       // outer pop (depth=0)
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should NOT remove outer PHA/PLA when A modified at outer depth level', () => {
      // No inner PHA/PLA here — just test the outer pair with A modification
      const program = createTestProgram([
        instr('PHA'),       // outer push
        instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A at depth 1
        instr('STA', AsmAddressingMode.ZeroPage, 0x60), // uses new A
        instr('PLA'),       // outer pop — restores original A
        instr('STA', AsmAddressingMode.ZeroPage, 0x50), // uses restored A (not overwrite)
      ]);

      const result = pass.run(program);
      // Outer pair: A modified, not overwritten after → keep
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // A-Modifying Instructions
  // ========================================================================

  describe('A-modifying instructions between PHA/PLA', () => {
    it('should track LDA as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('PLA'),
        instr('NOP'), // NOT an overwrite
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track ADC as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('ADC', AsmAddressingMode.Immediate, 1),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track SBC as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('SBC', AsmAddressingMode.Immediate, 1),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track AND as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('AND', AsmAddressingMode.Immediate, 0x0F),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track ORA as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('ORA', AsmAddressingMode.Immediate, 0x80),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track EOR as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('EOR', AsmAddressingMode.Immediate, 0xFF),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track TXA as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('TXA'),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should track TYA as modifying A', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('TYA'),
        instr('PLA'),
        instr('NOP'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // PLA at End of Section (No Instruction After)
  // ========================================================================

  describe('PLA at end of section', () => {
    it('should NOT remove when A modified and PLA is last instruction', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('PLA'),
        // Nothing after PLA — can't detect overwrite
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should remove when A unmodified and PLA is last instruction', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('INX'), // does NOT modify A
        instr('PLA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['INX']);
    });
  });
});
