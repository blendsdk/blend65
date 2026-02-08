/**
 * ASM-IL Builder Tests - 65C02-Specific Instructions
 *
 * Tests for STZ, BRA, INA, DEA, PHX, PLX, PHY, PLY builder helpers.
 * These instructions are exclusive to the WDC 65C02 CPU and MUST only
 * be emitted when targeting a 65C02 platform (e.g., Commander X16).
 *
 * @module __tests__/codegen/asm-il/builder/65c02.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - 65C02-Specific Instructions', () => {
  // ==========================================================================
  // STZ (Store Zero)
  // ==========================================================================

  describe('STZ (Store Zero)', () => {
    it('should emit STZ zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STZ');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit STZ zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STZ');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit STZ absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0xd020, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STZ');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.operand).toBe(0xd020);
      }
    });

    it('should emit STZ absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0x0400, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STZ');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
        expect(elements[0].instruction.operand).toBe(0x0400);
      }
    });

    it('should emit STZ with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0xd020, 'absolute', 'Clear border color');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Clear border color');
      }
    });

    it('should estimate 2 bytes for STZ zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0x50, 'zeroPage');

      const program = builder.build();
      // Zero page mode = 2 bytes (opcode + operand)
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for STZ absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.stz(0xd020, 'absolute');

      const program = builder.build();
      // Absolute mode = 3 bytes (opcode + lo + hi)
      expect(program.stats.estimatedBytes).toBe(3);
    });
  });

  // ==========================================================================
  // BRA (Branch Always)
  // ==========================================================================

  describe('BRA (Branch Always)', () => {
    it('should emit BRA with label operand', () => {
      const builder = new AsmILBuilder('test');
      builder.bra('.loop_start');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BRA');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
        expect(elements[0].instruction.labelOperand).toBe('.loop_start');
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit BRA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.bra('.end', 'Skip to end');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Skip to end');
      }
    });

    it('should estimate 2 bytes for BRA (relative addressing)', () => {
      const builder = new AsmILBuilder('test');
      builder.bra('.target');

      const program = builder.build();
      // Relative mode = 2 bytes (opcode + offset)
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should follow same pattern as other branch instructions', () => {
      // BRA should behave identically to BEQ/BNE etc. structurally
      const braBuilder = new AsmILBuilder('test');
      braBuilder.bra('.target', 'branch always');

      const beqBuilder = new AsmILBuilder('test');
      beqBuilder.beq('.target', 'branch if equal');

      const braElements = braBuilder.getAllElements();
      const beqElements = beqBuilder.getAllElements();

      if (isInstructionElement(braElements[0]) && isInstructionElement(beqElements[0])) {
        // Both use Relative addressing mode
        expect(braElements[0].instruction.mode).toBe(beqElements[0].instruction.mode);
        // Both use label operand, no numeric operand
        expect(braElements[0].instruction.labelOperand).toBe('.target');
        expect(braElements[0].instruction.operand).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // INA (Increment Accumulator)
  // ==========================================================================

  describe('INA (Increment Accumulator)', () => {
    it('should emit INC with Accumulator mode', () => {
      const builder = new AsmILBuilder('test');
      builder.ina();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        // INA emits "INC" mnemonic with Accumulator addressing
        expect(elements[0].instruction.mnemonic).toBe('INC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit INA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.ina('Increment counter in A');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Increment counter in A');
      }
    });

    it('should estimate 1 byte for INA (accumulator mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.ina();

      const program = builder.build();
      // Accumulator mode = 1 byte (opcode only)
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // DEA (Decrement Accumulator)
  // ==========================================================================

  describe('DEA (Decrement Accumulator)', () => {
    it('should emit DEC with Accumulator mode', () => {
      const builder = new AsmILBuilder('test');
      builder.dea();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        // DEA emits "DEC" mnemonic with Accumulator addressing
        expect(elements[0].instruction.mnemonic).toBe('DEC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit DEA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.dea('Decrement loop counter');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Decrement loop counter');
      }
    });

    it('should estimate 1 byte for DEA (accumulator mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.dea();

      const program = builder.build();
      // Accumulator mode = 1 byte (opcode only)
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // PHX (Push X Register)
  // ==========================================================================

  describe('PHX (Push X Register)', () => {
    it('should emit PHX implied', () => {
      const builder = new AsmILBuilder('test');
      builder.phx();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('PHX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit PHX with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.phx('Save X before function call');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Save X before function call');
      }
    });

    it('should estimate 1 byte for PHX (implied mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.phx();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // PLX (Pull X Register)
  // ==========================================================================

  describe('PLX (Pull X Register)', () => {
    it('should emit PLX implied', () => {
      const builder = new AsmILBuilder('test');
      builder.plx();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('PLX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit PLX with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.plx('Restore X after function call');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Restore X after function call');
      }
    });

    it('should estimate 1 byte for PLX (implied mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.plx();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // PHY (Push Y Register)
  // ==========================================================================

  describe('PHY (Push Y Register)', () => {
    it('should emit PHY implied', () => {
      const builder = new AsmILBuilder('test');
      builder.phy();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('PHY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit PHY with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.phy('Save Y for loop');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Save Y for loop');
      }
    });

    it('should estimate 1 byte for PHY (implied mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.phy();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // PLY (Pull Y Register)
  // ==========================================================================

  describe('PLY (Pull Y Register)', () => {
    it('should emit PLY implied', () => {
      const builder = new AsmILBuilder('test');
      builder.ply();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('PLY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        expect(elements[0].instruction.operand).toBeUndefined();
      }
    });

    it('should emit PLY with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.ply('Restore Y after loop');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Restore Y after loop');
      }
    });

    it('should estimate 1 byte for PLY (implied mode)', () => {
      const builder = new AsmILBuilder('test');
      builder.ply();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  // ==========================================================================
  // Integration: Instruction Counting & Fluent Chaining
  // ==========================================================================

  describe('instruction counting', () => {
    it('should count all 65C02 instructions', () => {
      const builder = new AsmILBuilder('test');

      builder
        .stz(0x50, 'zeroPage')
        .bra('.loop')
        .ina()
        .dea()
        .phx()
        .plx()
        .phy()
        .ply();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(8);
    });
  });

  describe('fluent chaining', () => {
    it('should chain all 65C02 instructions', () => {
      const builder = new AsmILBuilder('test');

      // Every 65C02 helper should return `this` for chaining
      const result = builder
        .stz(0x50, 'zeroPage')
        .bra('.loop')
        .ina()
        .dea()
        .phx()
        .plx()
        .phy()
        .ply();

      expect(result).toBe(builder);
    });

    it('should chain 65C02 instructions with 6502 instructions', () => {
      const builder = new AsmILBuilder('test');

      // Verify 65C02 helpers interleave seamlessly with 6502 helpers
      const result = builder
        .lda(0x00, 'immediate')    // 6502
        .stz(0xd020, 'absolute')   // 65C02
        .ina()                     // 65C02
        .sta(0xd021, 'absolute')   // 6502
        .phx()                     // 65C02
        .jsr('subroutine')         // 6502
        .plx()                     // 65C02
        .bra('.done');             // 65C02

      expect(result).toBe(builder);

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(8);
    });
  });

  describe('byte estimation for mixed 65C02/6502 code', () => {
    it('should correctly estimate bytes for a 65C02 function prologue/epilogue', () => {
      const builder = new AsmILBuilder('test');

      // Typical 65C02 function: save X/Y, do work, restore, branch back
      builder
        .phx()                       // 1 byte (implied)
        .phy()                       // 1 byte (implied)
        .stz(0x50, 'zeroPage')       // 2 bytes (zp)
        .ina()                       // 1 byte (accumulator)
        .sta(0x50, 'zeroPage')       // 2 bytes (zp)
        .ply()                       // 1 byte (implied)
        .plx()                       // 1 byte (implied)
        .bra('.done');               // 2 bytes (relative)

      const program = builder.build();
      // Total: 1+1+2+1+2+1+1+2 = 11 bytes
      expect(program.stats.estimatedBytes).toBe(11);
      expect(program.stats.instructionCount).toBe(8);
    });
  });
});
