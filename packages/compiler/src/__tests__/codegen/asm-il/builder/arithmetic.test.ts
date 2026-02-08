/**
 * ASM-IL Builder Tests - Arithmetic Instructions
 *
 * Tests for ADC, SBC, INC, DEC, INX, INY, DEX, DEY instruction methods.
 *
 * @module __tests__/codegen/asm-il/builder/arithmetic.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Arithmetic Instructions', () => {
  describe('ADC (Add with Carry)', () => {
    it('should emit ADC immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x10, 'immediate');

      const elements = builder.getAllElements();
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('ADC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x10);
      }
    });

    it('should emit ADC zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit ADC zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit ADC absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit ADC absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit ADC absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x1000, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });

    it('should emit ADC (indirect,X)', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x50, 'indirectX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndexedIndirect);
      }
    });

    it('should emit ADC (indirect),Y', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x50, 'indirectY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndirectIndexed);
      }
    });

    it('should emit ADC with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x01, 'immediate', 'Add one');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Add one');
      }
    });
  });

  describe('SBC (Subtract with Carry)', () => {
    it('should emit SBC immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x10, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('SBC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x10);
      }
    });

    it('should emit SBC zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit SBC zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit SBC absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit SBC absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit SBC absolute,Y', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x1000, 'absoluteY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
      }
    });

    it('should emit SBC (indirect,X)', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x50, 'indirectX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndexedIndirect);
      }
    });

    it('should emit SBC (indirect),Y', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x50, 'indirectY');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.IndirectIndexed);
      }
    });

    it('should emit SBC with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.sbc(0x01, 'immediate', 'Subtract one');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Subtract one');
      }
    });
  });

  describe('INC (Increment Memory)', () => {
    it('should emit INC zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('INC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit INC zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit INC absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit INC absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit INC with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x50, 'zeroPage', 'Increment counter');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Increment counter');
      }
    });
  });

  describe('DEC (Decrement Memory)', () => {
    it('should emit DEC zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.dec(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('DEC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit DEC zero page,X', () => {
      const builder = new AsmILBuilder('test');
      builder.dec(0x50, 'zeroPageX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPageX);
      }
    });

    it('should emit DEC absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.dec(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit DEC absolute,X', () => {
      const builder = new AsmILBuilder('test');
      builder.dec(0x1000, 'absoluteX');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.AbsoluteX);
      }
    });

    it('should emit DEC with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.dec(0x50, 'zeroPage', 'Decrement counter');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Decrement counter');
      }
    });
  });

  describe('INX (Increment X)', () => {
    it('should emit INX', () => {
      const builder = new AsmILBuilder('test');
      builder.inx();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('INX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit INX with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.inx('Next column');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Next column');
      }
    });
  });

  describe('INY (Increment Y)', () => {
    it('should emit INY', () => {
      const builder = new AsmILBuilder('test');
      builder.iny();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('INY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit INY with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.iny('Next row');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Next row');
      }
    });
  });

  describe('DEX (Decrement X)', () => {
    it('should emit DEX', () => {
      const builder = new AsmILBuilder('test');
      builder.dex();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('DEX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit DEX with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.dex('Previous column');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Previous column');
      }
    });
  });

  describe('DEY (Decrement Y)', () => {
    it('should emit DEY', () => {
      const builder = new AsmILBuilder('test');
      builder.dey();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('DEY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit DEY with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.dey('Previous row');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Previous row');
      }
    });
  });

  describe('instruction counting', () => {
    it('should increment instruction count for arithmetic ops', () => {
      const builder = new AsmILBuilder('test');

      builder
        .adc(0x01, 'immediate')
        .sbc(0x01, 'immediate')
        .inc(0x50, 'zeroPage')
        .dec(0x50, 'zeroPage')
        .inx()
        .iny()
        .dex()
        .dey();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(8);
    });
  });

  describe('byte estimation', () => {
    it('should estimate 1 byte for implied (INX, DEY, etc.)', () => {
      const builder = new AsmILBuilder('test');
      builder.inx();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });

    it('should estimate 2 bytes for immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.adc(0x01, 'immediate');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 2 bytes for zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.inc(0x1000, 'absolute');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });
  });

  describe('fluent chaining', () => {
    it('should chain arithmetic instructions', () => {
      const builder = new AsmILBuilder('test');

      const result = builder
        .adc(0x01, 'immediate')
        .sbc(0x01, 'immediate')
        .inx()
        .iny()
        .dex()
        .dey();

      expect(result).toBe(builder);
    });
  });

  describe('common arithmetic patterns', () => {
    it('should support 16-bit addition pattern', () => {
      const builder = new AsmILBuilder('test');

      // Add 16-bit value: add low byte, then high byte with carry
      builder
        .clc()
        .lda(0x50, 'zeroPage')
        .adc(0x01, 'immediate')
        .sta(0x50, 'zeroPage')
        .lda(0x51, 'zeroPage')
        .adc(0x00, 'immediate')
        .sta(0x51, 'zeroPage');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(7);
    });

    it('should support loop counter decrement pattern', () => {
      const builder = new AsmILBuilder('test');

      builder.label('.loop').dex().bne('.loop');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(2); // DEX + BNE
      expect(program.stats.labelCount).toBe(1);
    });
  });
});