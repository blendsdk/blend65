/**
 * FlagPatternsPass — Dead CLC/SEC and Duplicate/Opposite Flag Tests
 *
 * Patterns 2-4: Dead carry operations, duplicate flag ops, opposite flag ops.
 */

import { describe, it, expect } from 'vitest';
import { FlagPatternsPass } from '../../../../../codegen/asm-il/optimizer/passes/flag-patterns.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
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

function prog(elements: ReturnType<typeof instr>[]): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

function getMnemonics(program: AsmILProgram): string[] {
  return program.sections[0].elements
    .filter((e) => e.kind === 'instruction')
    .map((e) => (e as { kind: 'instruction'; instruction: { mnemonic: string } }).instruction.mnemonic);
}

describe('FlagPatternsPass — Dead CLC/SEC', () => {
  const pass = new FlagPatternsPass();

  // ========================================================================
  // Duplicate Flag Operations
  // ========================================================================

  describe('duplicate CLC/SEC', () => {
    it('removes first CLC in CLC/CLC pair', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['CLC', 'ADC']);
    });

    it('removes first SEC in SEC/SEC pair', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('SEC'),
        instr('SBC', AsmAddressingMode.Immediate, 1),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['SEC', 'SBC']);
    });

    it('removes two of three consecutive CLCs', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('CLC'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
      ]));

      expect(result.changed).toBe(true);
      // First CLC: isDuplicateOrOppositeFlag → sees second CLC → dead
      // Second CLC: isDuplicateOrOppositeFlag → sees third CLC → dead
      // Third CLC: carry IS read by ADC → kept
      expect(getMnemonics(result.program)).toEqual(['CLC', 'ADC']);
    });

    it('removes duplicate CLC with intervening comment', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('CLC'),
            createCommentElement('redundant clear'),
            instr('CLC'),
            instr('ADC', AsmAddressingMode.Immediate, 5),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(1);
    });
  });

  // ========================================================================
  // Opposite Flag Operations
  // ========================================================================

  describe('opposite CLC/SEC', () => {
    it('removes CLC before SEC (opposite)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('SEC'),
        instr('SBC', AsmAddressingMode.Immediate, 5),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['SEC', 'SBC']);
    });

    it('removes SEC before CLC (opposite)', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['CLC', 'ADC']);
    });

    it('removes CLC before SEC with intervening non-flag instructions', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.Immediate, 10),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('SEC'),
        instr('SBC', AsmAddressingMode.Immediate, 3),
      ]));

      expect(result.changed).toBe(true);
      // CLC is dead because LDA/STA don't read carry, and SEC overwrites it
      expect(getMnemonics(result.program)).toEqual(['LDA', 'STA', 'SEC', 'SBC']);
    });
  });

  // ========================================================================
  // Dead CLC (carry not read before modification)
  // ========================================================================

  describe('dead CLC removal', () => {
    it('removes CLC when carry not read before end of section', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'STA']);
    });

    it('removes CLC when carry overwritten by ASL', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ASL', AsmAddressingMode.Accumulator),
      ]));

      expect(result.changed).toBe(true);
      // CLC is dead because ASL overwrites carry before it's read
      expect(getMnemonics(result.program)).toEqual(['LDA', 'ASL']);
    });

    it('removes CLC when carry overwritten by CMP', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 10),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'CMP']);
    });

    it('keeps CLC when followed by ADC (carry IS read)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('ADC', AsmAddressingMode.Immediate, 3),
      ]));

      expect(result.changed).toBe(false);
      expect(getMnemonics(result.program)).toEqual(['CLC', 'LDA', 'ADC']);
    });

    it('keeps CLC when followed by ROL (carry IS read)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('ROL', AsmAddressingMode.Accumulator),
      ]));

      expect(result.changed).toBe(false);
    });

    it('keeps CLC when followed by BCC (carry IS read)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'target'),
      ]));

      expect(result.changed).toBe(false);
    });

    it('keeps CLC when followed by BCS (carry IS read)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('BCS', AsmAddressingMode.Relative, undefined, 'target'),
      ]));

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Dead SEC removal
  // ========================================================================

  describe('dead SEC removal', () => {
    it('removes SEC when carry not read before end of section', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'STA']);
    });

    it('removes SEC when carry overwritten by LSR', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LSR', AsmAddressingMode.Accumulator),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'LSR']);
    });

    it('keeps SEC when followed by SBC (carry IS read)', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('LDA', AsmAddressingMode.Immediate, 10),
        instr('SBC', AsmAddressingMode.Immediate, 3),
      ]));

      expect(result.changed).toBe(false);
      expect(getMnemonics(result.program)).toEqual(['SEC', 'LDA', 'SBC']);
    });

    it('keeps SEC when followed by ROR (carry IS read)', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('ROR', AsmAddressingMode.Accumulator),
      ]));

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Label/Control Flow Boundaries
  // ========================================================================

  describe('label and control flow boundaries', () => {
    it('keeps CLC before label (label could be branch target)', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('CLC'),
            createLabelElement('target'),
            instr('ADC', AsmAddressingMode.Immediate, 5),
          ],
        }],
      };

      const result = pass.run(program);

      // CLC is kept because label breaks forward analysis
      expect(result.changed).toBe(false);
    });

    it('keeps CLC before JMP (control flow)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'somewhere'),
      ]));

      // JMP is control flow — conservative: keep CLC
      expect(result.changed).toBe(false);
    });

    it('keeps CLC before JSR (subroutine may read carry)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'subroutine'),
      ]));

      expect(result.changed).toBe(false);
    });

    it('keeps CLC before RTS (return may need carry state)', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('RTS'),
      ]));

      expect(result.changed).toBe(false);
    });

    it('keeps SEC before BEQ (BEQ reads Z not carry, but is control flow)', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]));

      // BEQ is control flow — stop analysis, keep SEC
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Combined Patterns
  // ========================================================================

  describe('combined patterns', () => {
    it('removes both dead CLC and redundant CMP #0 in same section', () => {
      const result = pass.run(prog([
        instr('CLC'),                                       // Dead CLC (no carry read)
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),       // Redundant CMP #0
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'BEQ']);
      expect(result.stats.patternsMatched).toBe(2);
    });

    it('handles interleaved dead carry and CMP #0 patterns', () => {
      const result = pass.run(prog([
        instr('SEC'),                                       // Dead SEC
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x60),
        instr('CMP', AsmAddressingMode.Immediate, 0),       // Redundant CMP #0
        instr('BNE', AsmAddressingMode.Relative, undefined, 'next'),
      ]));

      expect(result.changed).toBe(true);
      // SEC removed, CMP #0 removed
      expect(getMnemonics(result.program)).toEqual(['LDA', 'STA', 'LDA', 'BNE']);
      expect(result.stats.patternsMatched).toBe(2);
    });
  });
});
