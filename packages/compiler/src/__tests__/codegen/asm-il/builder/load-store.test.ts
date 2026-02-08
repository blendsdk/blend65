/**
 * ASM-IL Builder Tests - Load and Store Instructions
 *
 * Tests for LDA, LDX, LDY, STA, STX, STY instruction methods.
 *
 * @module __tests__/codegen/asm-il/builder/load-store.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Load/Store Instructions', () => {
  describe('LDA (Load Accumulator)', () => {
    it('should emit LDA immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0xff, 'immediate');

      const elements = builder.getAllElements();
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('LDA');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0xff);
      }
    });

    it('should emit LDA zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit LDA zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit LDA absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.operand).toBe(0x1000);
      }
    });

    it('should emit LDA absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit LDA absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x1000, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });

    it('should emit LDA (indirect,X)', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x50, 'indirectX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndexedIndirect);
      }
    });

    it('should emit LDA (indirect),Y', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0x50, 'indirectY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndirectIndexed);
      }
    });

    it('should emit LDA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0xff, 'immediate', 'Load max value');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Load max value');
      }
    });
  });

  describe('LDX (Load X Register)', () => {
    it('should emit LDX immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.ldx(0x10, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('LDX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x10);
      }
    });

    it('should emit LDX zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.ldx(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit LDX zero page,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.ldx(0x50, 'zeroPageY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageY);
      }
    });

    it('should emit LDX absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.ldx(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit LDX absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.ldx(0x1000, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });
  });

  describe('LDY (Load Y Register)', () => {
    it('should emit LDY immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.ldy(0x20, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('LDY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x20);
      }
    });

    it('should emit LDY zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.ldy(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit LDY zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.ldy(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit LDY absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.ldy(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit LDY absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.ldy(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });
  });

  describe('STA (Store Accumulator)', () => {
    it('should emit STA zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STA');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit STA zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit STA absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0xd020, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.operand).toBe(0xd020);
      }
    });

    it('should emit STA absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x0400, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit STA absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x0400, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });

    it('should emit STA (indirect,X)', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x50, 'indirectX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndexedIndirect);
      }
    });

    it('should emit STA (indirect),Y', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x50, 'indirectY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndirectIndexed);
      }
    });

    it('should emit STA with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0xd020, 'absolute', 'Set border color');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Set border color');
      }
    });
  });

  describe('STX (Store X Register)', () => {
    it('should emit STX zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.stx(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit STX zero page,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.stx(0x50, 'zeroPageY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageY);
      }
    });

    it('should emit STX absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.stx(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('STY (Store Y Register)', () => {
    it('should emit STY zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.sty(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('STY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit STY zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.sty(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit STY absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.sty(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('instruction counting', () => {
    it('should increment instruction count for load/store', () => {
      const builder = new AsmILBuilder('test');

      builder
        .lda(0xff, 'immediate')
        .ldx(0x10, 'immediate')
        .ldy(0x20, 'immediate')
        .sta(0x50, 'zeroPage')
        .stx(0x51, 'zeroPage')
        .sty(0x52, 'zeroPage');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(6);
    });
  });

  describe('byte/cycle estimation', () => {
    it('should estimate 2 bytes for immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.lda(0xff, 'immediate');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 2 bytes for zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.sta(0xd020, 'absolute');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });
  });

  describe('fluent chaining', () => {
    it('should chain load/store instructions', () => {
      const builder = new AsmILBuilder('test');

      const result = builder
        .lda(0xff, 'immediate')
        .sta(0xd020, 'absolute')
        .ldx(0x00, 'immediate')
        .ldy(0x00, 'immediate');

      expect(result).toBe(builder);

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(4);
    });
  });
});