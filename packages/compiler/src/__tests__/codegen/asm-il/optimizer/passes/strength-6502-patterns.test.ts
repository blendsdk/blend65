/**
 * Strength6502Pass — Pattern Tests
 *
 * Tests multiply→ASL, divide→LSR, modulo→AND replacement patterns,
 * with various power-of-2 constants and runtime routine names.
 */

import { describe, it, expect } from 'vitest';
import { Strength6502Pass } from '../../../../../codegen/asm-il/optimizer/passes/strength-6502.js';
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

/** Extract instruction details from result for assertions */
function getInstructions(program: AsmILProgram, sectionIndex = 0) {
  return program.sections[sectionIndex].elements
    .filter(isInstructionElement)
    .map(el => ({
      mnemonic: el.instruction.mnemonic,
      mode: el.instruction.mode,
      operand: el.instruction.operand,
    }));
}

describe('Strength6502Pass — Patterns', () => {
  const pass = new Strength6502Pass();

  // ========================================================================
  // Multiply → ASL Replacement
  // ========================================================================

  describe('multiply → ASL replacement', () => {
    it('should replace ×2 with 1 ASL via __mul_byte', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      // LDA preserved, 1 ASL added
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[1].mnemonic).toBe('ASL');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('should replace ×4 with 2 ASLs via __mul_byte', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(3); // LDA + 2 ASLs
      expect(instrs[1].mnemonic).toBe('ASL');
      expect(instrs[2].mnemonic).toBe('ASL');
    });

    it('should replace ×8 with 3 ASLs via __mul_byte', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 8),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(4); // LDA + 3 ASLs
    });

    it('should replace ×16 with 4 ASLs', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 16),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(5); // LDA + 4 ASLs
    });

    it('should replace ×64 with 6 ASLs', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 64),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(7); // LDA + 6 ASLs
    });

    it('should replace ×128 with 7 ASLs', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 128),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(8); // LDA + 7 ASLs
    });

    it('should handle __mul8 routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul8'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should handle _mul routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '_mul'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should preserve original LDA mode and operand', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Absolute);
      expect(instrs[0].operand).toBe(0x0400);
    });
  });

  // ========================================================================
  // Divide → LSR Replacement
  // ========================================================================

  describe('divide → LSR replacement', () => {
    it('should replace ÷2 with 1 LSR via __div_byte', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(2); // LDA + 1 LSR
      expect(instrs[1].mnemonic).toBe('LSR');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('should replace ÷4 with 2 LSRs', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(3); // LDA + 2 LSRs
      expect(instrs[1].mnemonic).toBe('LSR');
      expect(instrs[2].mnemonic).toBe('LSR');
    });

    it('should replace ÷8 with 3 LSRs', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 8),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(4); // LDA + 3 LSRs
    });

    it('should handle __div8 routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div8'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should handle _div routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '_div'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });
  });

  // ========================================================================
  // Modulo → AND Replacement
  // ========================================================================

  describe('modulo → AND replacement', () => {
    it('should replace %2 with AND #$01 via __mod_byte', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs).toHaveLength(2); // LDA + AND
      expect(instrs[1].mnemonic).toBe('AND');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[1].operand).toBe(0x01); // 2 - 1 = 1
    });

    it('should replace %4 with AND #$03', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[1].mnemonic).toBe('AND');
      expect(instrs[1].operand).toBe(0x03); // 4 - 1 = 3
    });

    it('should replace %8 with AND #$07', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 8),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[1].operand).toBe(0x07); // 8 - 1 = 7
    });

    it('should replace %16 with AND #$0F', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 16),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[1].operand).toBe(0x0F); // 16 - 1 = 15
    });

    it('should replace %128 with AND #$7F', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 128),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      const instrs = getInstructions(result.program);
      expect(instrs[1].operand).toBe(0x7F); // 128 - 1 = 127
    });

    it('should handle __mod8 routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 8),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod8'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });

    it('should handle _mod routine name', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '_mod'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
    });
  });

  // ========================================================================
  // Multiple Patterns in Same Section
  // ========================================================================

  describe('multiple patterns in same section', () => {
    it('should replace multiple runtime calls in sequence', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 4),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x51),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__div_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
      const instrs = getInstructions(result.program);
      // First: LDA + 2 ASLs = 3
      // Second: LDA + 1 LSR = 2
      expect(instrs).toHaveLength(5);
    });

    it('should handle non-matching instructions between patterns', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.Immediate, 2),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mul_byte'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x51), // Not part of a pattern
        instr('LDA', AsmAddressingMode.ZeroPage, 0x52),
        instr('LDX', AsmAddressingMode.Immediate, 8),
        instr('JSR', AsmAddressingMode.Absolute, undefined, '__mod_byte'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
    });
  });
});
