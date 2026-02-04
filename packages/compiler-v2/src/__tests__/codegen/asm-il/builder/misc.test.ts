/**
 * ASM-IL Builder Tests - Miscellaneous Instructions
 *
 * Tests for flag, stack, transfer, NOP, BRK, and BIT instruction methods.
 *
 * @module __tests__/codegen/asm-il/builder/misc.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Miscellaneous Instructions', () => {
  describe('Flag Instructions', () => {
    describe('CLC (Clear Carry)', () => {
      it('should emit CLC', () => {
        const builder = new AsmILBuilder('test');
        builder.clc();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('CLC');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit CLC with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.clc('Prepare for addition');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Prepare for addition');
        }
      });
    });

    describe('SEC (Set Carry)', () => {
      it('should emit SEC', () => {
        const builder = new AsmILBuilder('test');
        builder.sec();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('SEC');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit SEC with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.sec('Prepare for subtraction');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Prepare for subtraction');
        }
      });
    });

    describe('CLI (Clear Interrupt Disable)', () => {
      it('should emit CLI', () => {
        const builder = new AsmILBuilder('test');
        builder.cli();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('CLI');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit CLI with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.cli('Enable interrupts');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Enable interrupts');
        }
      });
    });

    describe('SEI (Set Interrupt Disable)', () => {
      it('should emit SEI', () => {
        const builder = new AsmILBuilder('test');
        builder.sei();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('SEI');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit SEI with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.sei('Disable interrupts');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Disable interrupts');
        }
      });
    });

    describe('CLD (Clear Decimal)', () => {
      it('should emit CLD', () => {
        const builder = new AsmILBuilder('test');
        builder.cld();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('CLD');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit CLD with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.cld('Binary mode');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Binary mode');
        }
      });
    });

    describe('SED (Set Decimal)', () => {
      it('should emit SED', () => {
        const builder = new AsmILBuilder('test');
        builder.sed();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('SED');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit SED with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.sed('BCD mode');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('BCD mode');
        }
      });
    });

    describe('CLV (Clear Overflow)', () => {
      it('should emit CLV', () => {
        const builder = new AsmILBuilder('test');
        builder.clv();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('CLV');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit CLV with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.clv('Clear overflow');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Clear overflow');
        }
      });
    });
  });

  describe('Stack Instructions', () => {
    describe('PHA (Push Accumulator)', () => {
      it('should emit PHA', () => {
        const builder = new AsmILBuilder('test');
        builder.pha();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('PHA');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit PHA with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.pha('Save A');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Save A');
        }
      });
    });

    describe('PLA (Pull Accumulator)', () => {
      it('should emit PLA', () => {
        const builder = new AsmILBuilder('test');
        builder.pla();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('PLA');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit PLA with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.pla('Restore A');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Restore A');
        }
      });
    });

    describe('PHP (Push Processor Status)', () => {
      it('should emit PHP', () => {
        const builder = new AsmILBuilder('test');
        builder.php();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('PHP');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit PHP with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.php('Save flags');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Save flags');
        }
      });
    });

    describe('PLP (Pull Processor Status)', () => {
      it('should emit PLP', () => {
        const builder = new AsmILBuilder('test');
        builder.plp();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('PLP');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit PLP with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.plp('Restore flags');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Restore flags');
        }
      });
    });
  });

  describe('Transfer Instructions', () => {
    describe('TAX (Transfer A to X)', () => {
      it('should emit TAX', () => {
        const builder = new AsmILBuilder('test');
        builder.tax();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TAX');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });

      it('should emit TAX with comment', () => {
        const builder = new AsmILBuilder('test');
        builder.tax('Copy A to X');

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.comment).toBe('Copy A to X');
        }
      });
    });

    describe('TAY (Transfer A to Y)', () => {
      it('should emit TAY', () => {
        const builder = new AsmILBuilder('test');
        builder.tay();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TAY');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });
    });

    describe('TXA (Transfer X to A)', () => {
      it('should emit TXA', () => {
        const builder = new AsmILBuilder('test');
        builder.txa();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TXA');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });
    });

    describe('TYA (Transfer Y to A)', () => {
      it('should emit TYA', () => {
        const builder = new AsmILBuilder('test');
        builder.tya();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TYA');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });
    });

    describe('TSX (Transfer SP to X)', () => {
      it('should emit TSX', () => {
        const builder = new AsmILBuilder('test');
        builder.tsx();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TSX');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });
    });

    describe('TXS (Transfer X to SP)', () => {
      it('should emit TXS', () => {
        const builder = new AsmILBuilder('test');
        builder.txs();

        const elements = builder.getAllElements();
        if (isInstructionElement(elements[0])) {
          expect(elements[0].instruction.mnemonic).toBe('TXS');
          expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
        }
      });
    });
  });

  describe('NOP (No Operation)', () => {
    it('should emit NOP', () => {
      const builder = new AsmILBuilder('test');
      builder.nop();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('NOP');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit NOP with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.nop('Timing delay');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Timing delay');
      }
    });
  });

  describe('BRK (Break)', () => {
    it('should emit BRK', () => {
      const builder = new AsmILBuilder('test');
      builder.brk();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BRK');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit BRK with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.brk('Software interrupt');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Software interrupt');
      }
    });
  });

  describe('BIT (Bit Test)', () => {
    it('should emit BIT zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.bit(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BIT');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(elements[0].instruction.operand).toBe(0x50);
      }
    });

    it('should emit BIT absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.bit(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.operand).toBe(0x1000);
      }
    });

    it('should emit BIT with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.bit(0xd012, 'absolute', 'Check raster line');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Check raster line');
      }
    });
  });

  describe('instruction counting', () => {
    it('should count misc instructions', () => {
      const builder = new AsmILBuilder('test');

      builder.clc().sec().pha().pla().tax().tay().nop().brk();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(8);
    });
  });

  describe('byte estimation', () => {
    it('should estimate 1 byte for implied mode', () => {
      const builder = new AsmILBuilder('test');
      builder.nop();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });

    it('should estimate 2 bytes for BIT zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.bit(0x50, 'zeroPage');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for BIT absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.bit(0x1000, 'absolute');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });
  });

  describe('fluent chaining', () => {
    it('should chain misc instructions', () => {
      const builder = new AsmILBuilder('test');

      const result = builder.sei().pha().txa().pha().pla().tax().pla().cli();

      expect(result).toBe(builder);
    });
  });

  describe('common misc patterns', () => {
    it('should support save/restore register pattern', () => {
      const builder = new AsmILBuilder('test');

      // Save A and X, do something, restore
      builder.pha().txa().pha().lda(0xff, 'immediate').pla().tax().pla();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(7);
    });

    it('should support disable/enable interrupts pattern', () => {
      const builder = new AsmILBuilder('test');

      // Critical section
      builder
        .sei() // Disable interrupts
        .lda(0xff, 'immediate')
        .sta(0xd020, 'absolute')
        .cli(); // Enable interrupts

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(4);
    });

    it('should support stack pointer setup pattern', () => {
      const builder = new AsmILBuilder('test');

      // Initialize stack pointer
      builder.ldx(0xff, 'immediate').txs();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(2);
    });

    it('should support raster wait pattern', () => {
      const builder = new AsmILBuilder('test');

      // Wait for specific raster line
      builder.label('.wait').lda(0xd012, 'absolute').cmp(0x80, 'immediate').bne('.wait');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
      expect(program.stats.labelCount).toBe(1);
    });

    it('should support BIT polling pattern', () => {
      const builder = new AsmILBuilder('test');

      // Poll VIC raster register
      builder.label('.poll').bit(0xd011, 'absolute').bpl('.poll');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(2);
      expect(program.stats.labelCount).toBe(1);
    });

    it('should support timing delay with NOPs', () => {
      const builder = new AsmILBuilder('test');

      // 6 cycle delay (3 NOPs × 2 cycles)
      builder.nop().nop().nop();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
      expect(program.stats.estimatedCycles).toBe(6);
    });
  });
});