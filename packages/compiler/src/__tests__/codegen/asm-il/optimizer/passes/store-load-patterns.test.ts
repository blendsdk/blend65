/**
 * StoreLoadPass — Pattern Tests
 *
 * Tests the core store-load elimination patterns:
 * - STA/LDA, STX/LDX, STY/LDY same-address elimination
 * - Store-Other-Load with non-aliasing instructions between
 * - Safety: keeps loads when register modified between
 * - Safety: keeps loads when memory modified between
 * - Safety: keeps cross-register loads (STA $50; LDX $50)
 */

import { describe, it, expect } from 'vitest';
import { StoreLoadPass } from '../../../../../codegen/asm-il/optimizer/passes/store-load.js';
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

function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[],
  sectionName = 'code'
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

/** Get instruction mnemonic at index from first section */
function getMnemonic(program: AsmILProgram, index: number): string {
  const el = program.sections[0].elements[index];
  if (el.kind !== 'instruction') throw new Error(`Element ${index} is not an instruction`);
  return el.instruction.mnemonic;
}

describe('StoreLoadPass — Patterns', () => {
  const pass = new StoreLoadPass();

  // ========================================================================
  // Pattern 1: STA/LDA Same Address
  // ========================================================================

  describe('STA/LDA same address', () => {
    it('should remove LDA after STA to same zero-page address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
      expect(getMnemonic(result.program, 0)).toBe('STA');
    });

    it('should remove LDA after STA to same absolute address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
    });

    it('should remove LDA after STA to same label address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, undefined, 'counter'),
        instr('LDA', AsmAddressingMode.Absolute, undefined, 'counter'),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
    });
  });

  // ========================================================================
  // Pattern 2: STX/LDX Same Address
  // ========================================================================

  describe('STX/LDX same address', () => {
    it('should remove LDX after STX to same zero-page address', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
      expect(getMnemonic(result.program, 0)).toBe('STX');
    });

    it('should remove LDX after STX to same absolute address', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.Absolute, 0xD000),
        instr('LDX', AsmAddressingMode.Absolute, 0xD000),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
    });
  });

  // ========================================================================
  // Pattern 3: STY/LDY Same Address
  // ========================================================================

  describe('STY/LDY same address', () => {
    it('should remove LDY after STY to same zero-page address', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDY', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
      expect(getMnemonic(result.program, 0)).toBe('STY');
    });

    it('should remove LDY after STY to same absolute address', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.Absolute, 0x0400),
        instr('LDY', AsmAddressingMode.Absolute, 0x0400),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(1);
    });
  });

  // ========================================================================
  // Pattern 4: Store-Other-Load (Non-Aliasing Intervening Instructions)
  // ========================================================================

  describe('store-other-load (non-aliasing between)', () => {
    it('should remove LDA with INX between (INX does not affect A or memory)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INX'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
      expect(getMnemonic(result.program, 0)).toBe('STA');
      expect(getMnemonic(result.program, 1)).toBe('INX');
    });

    it('should remove LDA with multiple non-aliasing instructions between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INX'),
        instr('INY'),
        instr('NOP'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(4); // LDA removed
    });

    it('should remove LDX with PHA between (PHA does not affect X or memory)', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x60),
        instr('PHA'),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should remove LDA with STA to different address between', () => {
      // STA $50; STA $60; LDA $50 — STA $60 doesn't affect $50
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      // STA $60 writes to memory, but address analyzer should see it's
      // a different concrete address (0x60 != 0x50), so LDA is still redundant
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });
  });

  // ========================================================================
  // Safety: Register Modified Between
  // ========================================================================

  describe('keeps load when register modified between', () => {
    it('should keep LDA when ADC modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ADC', AsmAddressingMode.Immediate, 1),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
      expect(result.program.sections[0].elements).toHaveLength(3);
    });

    it('should keep LDA when SBC modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('SBC', AsmAddressingMode.Immediate, 1),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when AND modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('AND', AsmAddressingMode.Immediate, 0x0F),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when ORA modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ORA', AsmAddressingMode.Immediate, 0x80),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when EOR modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('EOR', AsmAddressingMode.Immediate, 0xFF),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when TXA modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('TXA'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when PLA modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('PLA'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when ASL Accumulator modifies A between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ASL', AsmAddressingMode.Accumulator),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDX when INX modifies X between', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('INX'),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDX when DEX modifies X between', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('DEX'),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDX when TAX modifies X between', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAX'),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDY when INY modifies Y between', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.ZeroPage, 0x50),
        instr('INY'),
        instr('LDY', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDY when DEY modifies Y between', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.ZeroPage, 0x50),
        instr('DEY'),
        instr('LDY', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDY when TAY modifies Y between', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.ZeroPage, 0x50),
        instr('TAY'),
        instr('LDY', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Safety: Memory Modified Between
  // ========================================================================

  describe('keeps load when memory modified between', () => {
    it('should keep LDA when INC modifies same address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INC', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when DEC modifies same address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('DEC', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when STX overwrites same address', () => {
      // STA $50; STX $50; LDA $50 — memory now has X's value, not A's
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when memory-mode ASL modifies same address', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ASL', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should remove LDA when memory-mode ASL affects different address', () => {
      // ASL $60 doesn't affect $50, and A is not modified by memory ASL
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('ASL', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });
  });

  // ========================================================================
  // Safety: Cross-Register Loads
  // ========================================================================

  describe('keeps cross-register loads', () => {
    it('should keep LDX after STA (different registers)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDY after STA (different registers)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDY', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after STX (different registers)', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after STY (different registers)', () => {
      const program = createTestProgram([
        instr('STY', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Safety: Different Addresses
  // ========================================================================

  describe('keeps load to different address', () => {
    it('should keep LDA when addresses differ', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x51),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when addressing modes differ (ZP vs Absolute)', () => {
      // STA $50 (ZP) vs LDA $0050 (Absolute) — different modes
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.Absolute, 0x0050),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when one has label and other has number', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.Absolute, 0x0400),
        instr('LDA', AsmAddressingMode.Absolute, undefined, 'screen'),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });
});
