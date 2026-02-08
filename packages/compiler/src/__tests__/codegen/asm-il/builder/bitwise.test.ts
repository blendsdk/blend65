/**
 * ASM-IL Builder Tests - Bitwise/Logical Instructions
 *
 * Tests for AND, ORA, EOR, ASL, LSR, ROL, ROR instruction methods.
 *
 * @module __tests__/codegen/asm-il/builder/bitwise.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Bitwise/Logical Instructions', () => {
  describe('AND (Logical AND)', () => {
    it('should emit AND immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x0f, 'immediate');

      const elements = builder.getAllElements();
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('AND');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x0f);
      }
    });

    it('should emit AND zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit AND zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit AND absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit AND absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit AND absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x1000, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });

    it('should emit AND (indirect,X)', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x50, 'indirectX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndexedIndirect);
      }
    });

    it('should emit AND (indirect),Y', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x50, 'indirectY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndirectIndexed);
      }
    });

    it('should emit AND with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x0f, 'immediate', 'Mask lower nibble');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Mask lower nibble');
      }
    });
  });

  describe('ORA (Logical OR)', () => {
    it('should emit ORA immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.ora(0xf0, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('ORA');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0xf0);
      }
    });

    it('should emit ORA zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.ora(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit ORA absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.ora(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit ORA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.ora(0x80, 'immediate', 'Set high bit');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Set high bit');
      }
    });
  });

  describe('EOR (Exclusive OR)', () => {
    it('should emit EOR immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.eor(0xff, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('EOR');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0xff);
      }
    });

    it('should emit EOR zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.eor(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit EOR absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.eor(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit EOR with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.eor(0xff, 'immediate', 'Flip all bits');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Flip all bits');
      }
    });
  });

  describe('ASL (Arithmetic Shift Left)', () => {
    it('should emit ASL accumulator', () => {
      const builder = new AsmILBuilder('test');
      builder.asl();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('ASL');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
      }
    });

    it('should emit ASL zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit ASL zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit ASL absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit ASL absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit ASL with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(undefined, 'accumulator', 'Multiply by 2');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Multiply by 2');
      }
    });
  });

  describe('LSR (Logical Shift Right)', () => {
    it('should emit LSR accumulator', () => {
      const builder = new AsmILBuilder('test');
      builder.lsr();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('LSR');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
      }
    });

    it('should emit LSR zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.lsr(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit LSR zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.lsr(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit LSR absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.lsr(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit LSR with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.lsr(undefined, 'accumulator', 'Divide by 2');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Divide by 2');
      }
    });
  });

  describe('ROL (Rotate Left)', () => {
    it('should emit ROL accumulator', () => {
      const builder = new AsmILBuilder('test');
      builder.rol();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('ROL');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
      }
    });

    it('should emit ROL zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.rol(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit ROL absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.rol(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit ROL with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.rol(undefined, 'accumulator', 'Rotate through carry');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Rotate through carry');
      }
    });
  });

  describe('ROR (Rotate Right)', () => {
    it('should emit ROR accumulator', () => {
      const builder = new AsmILBuilder('test');
      builder.ror();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('ROR');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Accumulator);
      }
    });

    it('should emit ROR zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.ror(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit ROR absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.ror(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit ROR with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.ror(undefined, 'accumulator', 'Rotate right through carry');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Rotate right through carry');
      }
    });
  });

  describe('instruction counting', () => {
    it('should increment instruction count for bitwise ops', () => {
      const builder = new AsmILBuilder('test');

      builder.and(0x0f, 'immediate').ora(0xf0, 'immediate').eor(0xff, 'immediate').asl().lsr().rol().ror();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(7);
    });
  });

  describe('byte estimation', () => {
    it('should estimate 1 byte for accumulator mode', () => {
      const builder = new AsmILBuilder('test');
      builder.asl();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });

    it('should estimate 2 bytes for immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.and(0x0f, 'immediate');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 2 bytes for zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.asl(0x1000, 'absolute');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });
  });

  describe('fluent chaining', () => {
    it('should chain bitwise instructions', () => {
      const builder = new AsmILBuilder('test');

      const result = builder.and(0x0f, 'immediate').ora(0x80, 'immediate').asl().lsr();

      expect(result).toBe(builder);
    });
  });

  describe('common bitwise patterns', () => {
    it('should support multiply by 4 pattern (2x ASL)', () => {
      const builder = new AsmILBuilder('test');

      builder.asl().asl();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(2);
    });

    it('should support divide by 8 pattern (3x LSR)', () => {
      const builder = new AsmILBuilder('test');

      builder.lsr().lsr().lsr();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });

    it('should support toggle bit pattern', () => {
      const builder = new AsmILBuilder('test');

      // Toggle bit 7 of memory location
      builder.lda(0x50, 'zeroPage').eor(0x80, 'immediate').sta(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });

    it('should support clear bit pattern', () => {
      const builder = new AsmILBuilder('test');

      // Clear bit 0
      builder.lda(0x50, 'zeroPage').and(0xfe, 'immediate').sta(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });

    it('should support set bit pattern', () => {
      const builder = new AsmILBuilder('test');

      // Set bit 0
      builder.lda(0x50, 'zeroPage').ora(0x01, 'immediate').sta(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });
  });
});