/**
 * TransferOptPass — Pattern Tests
 *
 * Tests all four transfer register pairs and their reverse detection:
 * TAX↔TXA, TAY↔TYA, TXA↔TAX, TYA↔TAY
 */

import { describe, it, expect } from 'vitest';
import { TransferOptPass } from '../../../../../codegen/asm-il/optimizer/passes/transfer-opt.js';
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

/** Create a program with a single section */
function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[]
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

/** Extract instruction mnemonics from elements */
function extractMnemonics(elements: readonly AsmILElement[]): string[] {
  return elements
    .filter(isInstructionElement)
    .map(el => el.instruction.mnemonic);
}

describe('TransferOptPass — Patterns', () => {
  const pass = new TransferOptPass();

  // ========================================================================
  // TAX → TXA (redundant reverse: A is unchanged)
  // ========================================================================

  describe('TAX → TXA elimination', () => {
    it('should remove TXA immediately after TAX', () => {
      const program = createTestProgram([instr('TAX'), instr('TXA')]);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX']);
    });

    it('should remove TXA with non-A-modifying instructions between', () => {
      // TAX; STA $50; TXA — STA doesn't modify A, so TXA is still redundant
      const program = createTestProgram([
        instr('TAX'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TXA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX', 'STA']);
    });

    it('should NOT remove TXA when LDA appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('LDA', AsmAddressingMode.Immediate, 10),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when ADC appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('ADC', AsmAddressingMode.Immediate, 1),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when SBC appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('SBC', AsmAddressingMode.Immediate, 1),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when AND appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('AND', AsmAddressingMode.Immediate, 0x0F),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when ORA appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('ORA', AsmAddressingMode.Immediate, 0x80),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when EOR appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('EOR', AsmAddressingMode.Immediate, 0xFF),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TXA when PLA appears between', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('PLA'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // TAY → TYA (redundant reverse: A is unchanged)
  // ========================================================================

  describe('TAY → TYA elimination', () => {
    it('should remove TYA immediately after TAY', () => {
      const program = createTestProgram([instr('TAY'), instr('TYA')]);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAY']);
    });

    it('should remove TYA with non-A-modifying instructions between', () => {
      const program = createTestProgram([
        instr('TAY'),
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('TYA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAY', 'STX']);
    });

    it('should NOT remove TYA when LDA appears between', () => {
      const program = createTestProgram([
        instr('TAY'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TYA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // TXA → TAX (redundant reverse: X is unchanged)
  // ========================================================================

  describe('TXA → TAX elimination', () => {
    it('should remove TAX immediately after TXA', () => {
      const program = createTestProgram([instr('TXA'), instr('TAX')]);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TXA']);
    });

    it('should remove TAX with non-X-modifying instructions between', () => {
      // TXA; STA $50; TAX — STA doesn't modify X, TAX is redundant
      const program = createTestProgram([
        instr('TXA'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAX'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TXA', 'STA']);
    });

    it('should NOT remove TAX when LDX appears between', () => {
      const program = createTestProgram([
        instr('TXA'),
        instr('LDX', AsmAddressingMode.Immediate, 5),
        instr('TAX'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TAX when INX appears between', () => {
      const program = createTestProgram([
        instr('TXA'),
        instr('INX'),
        instr('TAX'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TAX when DEX appears between', () => {
      const program = createTestProgram([
        instr('TXA'),
        instr('DEX'),
        instr('TAX'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // TYA → TAY (redundant reverse: Y is unchanged)
  // ========================================================================

  describe('TYA → TAY elimination', () => {
    it('should remove TAY immediately after TYA', () => {
      const program = createTestProgram([instr('TYA'), instr('TAY')]);
      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TYA']);
    });

    it('should remove TAY with non-Y-modifying instructions between', () => {
      const program = createTestProgram([
        instr('TYA'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAY'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TYA', 'STA']);
    });

    it('should NOT remove TAY when LDY appears between', () => {
      const program = createTestProgram([
        instr('TYA'),
        instr('LDY', AsmAddressingMode.Immediate, 5),
        instr('TAY'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TAY when INY appears between', () => {
      const program = createTestProgram([
        instr('TYA'),
        instr('INY'),
        instr('TAY'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT remove TAY when DEY appears between', () => {
      const program = createTestProgram([
        instr('TYA'),
        instr('DEY'),
        instr('TAY'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Multiple transfer pairs in sequence
  // ========================================================================

  describe('multiple patterns in sequence', () => {
    it('should remove both reverse transfers in TAX;TXA;TAY;TYA', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('TXA'), // redundant
        instr('TAY'),
        instr('TYA'), // redundant
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(extractMnemonics(result.program.sections[0].elements)).toEqual(['TAX', 'TAY']);
    });

    it('should handle interleaved transfer patterns', () => {
      // TAX; STX $50; TXA; TAY; STY $60; TYA
      // Both TXA and TYA should be removed (A unmodified in both spans)
      const program = createTestProgram([
        instr('TAX'),
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('TXA'),  // redundant (A unmodified since TAX)
        instr('TAY'),
        instr('STY', AsmAddressingMode.ZeroPage, 0x60),
        instr('TYA'),  // redundant (A unmodified since TAY)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // TXA is removed first; then TAY is scanned — TYA would be found
      // But note: after removing TXA, TAX forward scan for TXA sees TAY (not TXA),
      // which doesn't match, then breaks at control flow. Actually TXA is removed.
      // Then TAY sees TYA and removes it.
      expect(result.stats.patternsMatched).toBe(2);
    });
  });

  // ========================================================================
  // Control flow breaks
  // ========================================================================

  describe('control flow breaks', () => {
    it('should NOT eliminate across JMP', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'target'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate across JSR', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'subroutine'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate across conditional branch', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate across RTS', () => {
      const program = createTestProgram([
        instr('TAX'),
        instr('RTS'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Label breaks
  // ========================================================================

  describe('label breaks', () => {
    it('should NOT eliminate when label appears between transfers', () => {
      // Labels break the pattern because code could jump to the label
      // with a different register state
      const program = createTestProgram([
        instr('TAX'),
        createLabelElement('middle'),
        instr('TXA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should NOT eliminate when label separates transfer pair', () => {
      const program = createTestProgram([
        instr('TAY'),
        createLabelElement('loop'),
        instr('NOP'),
        instr('TYA'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });
});
