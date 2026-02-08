/**
 * StackOptPass — Pattern Tests
 *
 * Tests the two core removal patterns:
 * 1. A unmodified between PHA/PLA → remove both
 * 2. A immediately overwritten after PLA → remove both
 */

import { describe, it, expect } from 'vitest';
import { StackOptPass } from '../../../../../codegen/asm-il/optimizer/passes/stack-opt.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
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

/** Get mnemonics from result program for easy assertions */
function getMnemonics(program: AsmILProgram, sectionIndex = 0): string[] {
  return program.sections[sectionIndex].elements
    .filter(isInstructionElement)
    .map(el => el.instruction.mnemonic);
}

describe('StackOptPass — Patterns', () => {
  const pass = new StackOptPass();

  // ========================================================================
  // Pattern 1: A Unmodified Between PHA/PLA
  // ========================================================================

  describe('Pattern 1: A unmodified between PHA/PLA', () => {
    it('should remove PHA/PLA with nothing between them', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(0);
    });

    it('should remove PHA/PLA with non-A instructions between', () => {
      // INX, INY, STX do NOT modify A
      const program = createTestProgram([
        instr('PHA'),
        instr('INX'),
        instr('INY'),
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // PHA/PLA removed, INX/INY/STX preserved
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['INX', 'INY', 'STX']);
    });

    it('should remove PHA/PLA with STA between (STA reads A, does not modify it)', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['STA']);
    });

    it('should remove PHA/PLA with CMP between (CMP does not modify A)', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('CMP', AsmAddressingMode.Immediate, 5),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['CMP']);
    });

    it('should remove PHA/PLA with DEX/DEY between (do not modify A)', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('DEX'),
        instr('DEY'),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['DEX', 'DEY']);
    });
  });

  // ========================================================================
  // Pattern 2: A Immediately Overwritten After PLA
  // ========================================================================

  describe('Pattern 2: A overwritten after PLA', () => {
    it('should remove PHA/PLA when LDA follows immediately', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('PLA'),
        instr('LDA', AsmAddressingMode.Immediate, 10), // immediately overwrites A
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // PHA and PLA removed; LDA, STA, LDA remain
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['LDA', 'STA', 'LDA']);
    });

    it('should remove PHA/PLA when TXA follows immediately', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('ADC', AsmAddressingMode.Immediate, 1), // modifies A
        instr('PLA'),
        instr('TXA'), // overwrites A
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['ADC', 'TXA']);
    });

    it('should remove PHA/PLA when TYA follows immediately', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('SBC', AsmAddressingMode.Immediate, 3), // modifies A
        instr('PLA'),
        instr('TYA'), // overwrites A
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['SBC', 'TYA']);
    });

    it('should remove PHA/PLA when another PLA follows immediately', () => {
      // Nested: outer PHA, inner work, outer PLA, immediately another PLA
      // This tests that PLA itself is in the OVERWRITES_A set
      const program = createTestProgram([
        instr('PHA'),         // outer push
        instr('EOR', AsmAddressingMode.Immediate, 0xFF), // modifies A
        instr('PLA'),         // outer pop — restores A
        instr('PLA'),         // another PLA overwrites A immediately
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
    });
  });

  // ========================================================================
  // Non-Removable Patterns
  // ========================================================================

  describe('non-removable patterns', () => {
    it('should NOT remove when A is modified and NOT overwritten after PLA', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A
        instr('PLA'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50), // uses A (restored) — needs PLA
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT remove when A is modified and NOP follows after PLA', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5), // modifies A
        instr('PLA'),
        instr('NOP'), // NOP does NOT overwrite A
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should NOT remove when A is modified and CMP follows after PLA', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('ADC', AsmAddressingMode.Immediate, 1), // modifies A
        instr('PLA'),
        instr('CMP', AsmAddressingMode.Immediate, 5), // reads A, does NOT overwrite
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Multiple Sequential Removable Pairs
  // ========================================================================

  describe('multiple sequential removable pairs', () => {
    it('should remove two independent PHA/PLA pairs', () => {
      const program = createTestProgram([
        instr('PHA'),
        instr('INX'),
        instr('PLA'),
        instr('PHA'),
        instr('DEX'),
        instr('PLA'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
      const mnemonics = getMnemonics(result.program);
      expect(mnemonics).toEqual(['INX', 'DEX']);
    });

    it('should remove mixed pattern types', () => {
      const program = createTestProgram([
        // Pattern 1: A unmodified
        instr('PHA'),
        instr('INX'),
        instr('PLA'),
        // Pattern 2: A overwritten after
        instr('PHA'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('PLA'),
        instr('LDA', AsmAddressingMode.Immediate, 10), // overwrite
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
    });
  });
});
