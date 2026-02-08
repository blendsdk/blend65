/**
 * FlagPatternsPass — Edge Cases and Real-World C64 Patterns
 *
 * Tests boundary conditions, real-world 6502 code patterns,
 * and idempotent behavior.
 */

import { describe, it, expect } from 'vitest';
import { FlagPatternsPass } from '../../../../../codegen/asm-il/optimizer/passes/flag-patterns.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
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

describe('FlagPatternsPass — Edge Cases', () => {
  const pass = new FlagPatternsPass();

  // ========================================================================
  // Idempotent Behavior
  // ========================================================================

  describe('idempotency', () => {
    it('should be idempotent — running twice gives same result', () => {
      const program = prog([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
        instr('CLC'),
        instr('CLC'),
        instr('ADC', AsmAddressingMode.Immediate, 5),
      ]);

      const result1 = pass.run(program);
      const result2 = pass.run(result1.program);

      // Second run should not change anything
      expect(result2.changed).toBe(false);
      expect(result2.program).toBe(result1.program);
    });

    it('should converge after single pass for simple patterns', () => {
      const program = prog([
        instr('SEC'),
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);

      const result2 = pass.run(result.program);
      expect(result2.changed).toBe(false);
    });
  });

  // ========================================================================
  // Real-World C64 Patterns
  // ========================================================================

  describe('real-world C64 patterns', () => {
    it('optimizes typical counter check: LDA counter / CMP #0 / BEQ done', () => {
      const result = pass.run(prog([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x02), // load counter
        instr('CMP', AsmAddressingMode.Immediate, 0),   // redundant
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'game_over'),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'BEQ']);
    });

    it('preserves CLC/ADC addition pattern', () => {
      // Standard 16-bit addition — CLC is essential
      const result = pass.run(prog([
        instr('CLC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x10),
        instr('ADC', AsmAddressingMode.ZeroPage, 0x12),
        instr('STA', AsmAddressingMode.ZeroPage, 0x14),
      ]));

      expect(result.changed).toBe(false);
    });

    it('preserves SEC/SBC subtraction pattern', () => {
      const result = pass.run(prog([
        instr('SEC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x10),
        instr('SBC', AsmAddressingMode.ZeroPage, 0x12),
        instr('STA', AsmAddressingMode.ZeroPage, 0x14),
      ]));

      expect(result.changed).toBe(false);
    });

    it('preserves CMP for greater-than comparison', () => {
      // CMP #100 — NOT #0, should never be removed
      const result = pass.run(prog([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x02),
        instr('CMP', AsmAddressingMode.Immediate, 100),
        instr('BCS', AsmAddressingMode.Relative, undefined, 'high_score'),
      ]));

      expect(result.changed).toBe(false);
    });

    it('optimizes dead CLC in sprite setup code', () => {
      // Common pattern: CLC before non-carry instructions
      const result = pass.run(prog([
        instr('CLC'),                                    // Dead — no carry read
        instr('LDA', AsmAddressingMode.Immediate, 0x01),
        instr('STA', AsmAddressingMode.Absolute, 0xD015), // sprite enable
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'STA']);
    });

    it('preserves CLC in loop with carry-dependent addition', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            createLabelElement('loop'),
            instr('CLC'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x02),
            instr('ADC', AsmAddressingMode.Immediate, 1),
            instr('STA', AsmAddressingMode.ZeroPage, 0x02),
            instr('BNE', AsmAddressingMode.Relative, undefined, 'loop'),
          ],
        }],
      };

      const result = pass.run(program);

      // CLC is alive: carry IS read by ADC
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Single Instruction Sections
  // ========================================================================

  describe('single instruction sections', () => {
    it('removes lone CLC at end of section (carry unused)', () => {
      const result = pass.run(prog([
        instr('CLC'),
      ]));

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(0);
    });

    it('removes lone SEC at end of section (carry unused)', () => {
      const result = pass.run(prog([
        instr('SEC'),
      ]));

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(0);
    });

    it('keeps lone LDA (no pattern to match)', () => {
      const result = pass.run(prog([
        instr('LDA', AsmAddressingMode.Immediate, 5),
      ]));

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Empty & Minimal Sections
  // ========================================================================

  describe('empty and minimal sections', () => {
    it('handles section with no elements', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{ name: 'empty', elements: [] }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('handles section with only labels', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'labels',
          elements: [
            createLabelElement('start'),
            createLabelElement('end'),
          ],
        }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // NOP Transparency
  // ========================================================================

  describe('NOP instruction handling', () => {
    it('CMP #0 is still redundant after LDA with NOP between', () => {
      // NOP doesn't modify any flags, so LDA's flags are preserved
      const result = pass.run(prog([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('NOP'),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['LDA', 'NOP', 'BEQ']);
    });

    it('CLC is still dead with NOP before ASL', () => {
      const result = pass.run(prog([
        instr('CLC'),
        instr('NOP'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ASL', AsmAddressingMode.Accumulator),
      ]));

      expect(result.changed).toBe(true);
      expect(getMnemonics(result.program)).toEqual(['NOP', 'LDA', 'ASL']);
    });
  });
});
