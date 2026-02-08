/**
 * ASM-IL Builder Tests - Control Flow Instructions
 *
 * Tests for CMP, CPX, CPY, branch, JMP, JSR, RTS, RTI instruction methods.
 *
 * @module __tests__/codegen/asm-il/builder/control-flow.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Control Flow Instructions', () => {
  describe('CMP (Compare Accumulator)', () => {
    it('should emit CMP immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.cmp(0x10, 'immediate');

      const elements = builder.getAllElements();
      expect(isInstructionElement(elements[0])).toBe(true);
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('CMP');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(elements[0].instruction.operand).toBe(0x10);
      }
    });

    it('should emit CMP zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.cmp(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit CMP absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.cmp(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });

    it('should emit CMP with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.cmp(0x00, 'immediate', 'Check if zero');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Check if zero');
      }
    });
  });

  describe('CPX (Compare X Register)', () => {
    it('should emit CPX immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.cpx(0x10, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('CPX');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });

    it('should emit CPX zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.cpx(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit CPX absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.cpx(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('CPY (Compare Y Register)', () => {
    it('should emit CPY immediate', () => {
      const builder = new AsmILBuilder('test');
      builder.cpy(0x20, 'immediate');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('CPY');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });

    it('should emit CPY zero page', () => {
      const builder = new AsmILBuilder('test');
      builder.cpy(0x50, 'zeroPage');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should emit CPY absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.cpy(0x1000, 'absolute');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  describe('BEQ (Branch if Equal)', () => {
    it('should emit BEQ with label', () => {
      const builder = new AsmILBuilder('test');
      builder.beq('.done');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BEQ');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
        expect(elements[0].instruction.labelOperand).toBe('.done');
      }
    });

    it('should emit BEQ with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.beq('.exit', 'Exit if zero');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Exit if zero');
      }
    });
  });

  describe('BNE (Branch if Not Equal)', () => {
    it('should emit BNE with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bne('.loop');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BNE');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
        expect(elements[0].instruction.labelOperand).toBe('.loop');
      }
    });

    it('should emit BNE with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.bne('.continue', 'Continue if not zero');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Continue if not zero');
      }
    });
  });

  describe('BCC (Branch if Carry Clear)', () => {
    it('should emit BCC with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bcc('.no_carry');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BCC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
        expect(elements[0].instruction.labelOperand).toBe('.no_carry');
      }
    });
  });

  describe('BCS (Branch if Carry Set)', () => {
    it('should emit BCS with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bcs('.has_carry');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BCS');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
        expect(elements[0].instruction.labelOperand).toBe('.has_carry');
      }
    });
  });

  describe('BPL (Branch if Plus)', () => {
    it('should emit BPL with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bpl('.positive');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BPL');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
      }
    });
  });

  describe('BMI (Branch if Minus)', () => {
    it('should emit BMI with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bmi('.negative');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BMI');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
      }
    });
  });

  describe('BVC (Branch if Overflow Clear)', () => {
    it('should emit BVC with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bvc('.no_overflow');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BVC');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
      }
    });
  });

  describe('BVS (Branch if Overflow Set)', () => {
    it('should emit BVS with label', () => {
      const builder = new AsmILBuilder('test');
      builder.bvs('.has_overflow');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('BVS');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Relative);
      }
    });
  });

  describe('JMP (Jump)', () => {
    it('should emit JMP with label', () => {
      const builder = new AsmILBuilder('test');
      builder.jmp('main');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JMP');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.labelOperand).toBe('main');
      }
    });

    it('should emit JMP with numeric address', () => {
      const builder = new AsmILBuilder('test');
      builder.jmp(0x1000);

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JMP');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.operand).toBe(0x1000);
      }
    });

    it('should emit JMP indirect', () => {
      const builder = new AsmILBuilder('test');
      builder.jmp(0x1000, true);

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Indirect);
      }
    });

    it('should emit JMP with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.jmp('main_loop', false, 'Back to main');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Back to main');
      }
    });
  });

  describe('JSR (Jump to Subroutine)', () => {
    it('should emit JSR with label', () => {
      const builder = new AsmILBuilder('test');
      builder.jsr('print_char');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('JSR');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(elements[0].instruction.labelOperand).toBe('print_char');
      }
    });

    it('should emit JSR with numeric address', () => {
      const builder = new AsmILBuilder('test');
      builder.jsr(0xffd2);

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.operand).toBe(0xffd2);
      }
    });

    it('should emit JSR with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.jsr(0xffd2, 'CHROUT');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('CHROUT');
      }
    });
  });

  describe('RTS (Return from Subroutine)', () => {
    it('should emit RTS', () => {
      const builder = new AsmILBuilder('test');
      builder.rts();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('RTS');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit RTS with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.rts('Return to caller');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Return to caller');
      }
    });
  });

  describe('RTI (Return from Interrupt)', () => {
    it('should emit RTI', () => {
      const builder = new AsmILBuilder('test');
      builder.rti();

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.mnemonic).toBe('RTI');
        expect(elements[0].instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });

    it('should emit RTI with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.rti('Return from IRQ');

      const elements = builder.getAllElements();
      if (isInstructionElement(elements[0])) {
        expect(elements[0].instruction.comment).toBe('Return from IRQ');
      }
    });
  });

  describe('instruction counting', () => {
    it('should count control flow instructions', () => {
      const builder = new AsmILBuilder('test');

      builder.cmp(0x00, 'immediate').beq('.done').bne('.loop').jmp('main').jsr('sub').rts();

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(6);
    });
  });

  describe('byte estimation', () => {
    it('should estimate 2 bytes for branches', () => {
      const builder = new AsmILBuilder('test');
      builder.beq('.done');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(2);
    });

    it('should estimate 3 bytes for JMP absolute', () => {
      const builder = new AsmILBuilder('test');
      builder.jmp('main');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });

    it('should estimate 3 bytes for JSR', () => {
      const builder = new AsmILBuilder('test');
      builder.jsr('sub');

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });

    it('should estimate 1 byte for RTS', () => {
      const builder = new AsmILBuilder('test');
      builder.rts();

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(1);
    });
  });

  describe('cycle estimation', () => {
    it('should estimate 6 cycles for JSR', () => {
      const builder = new AsmILBuilder('test');
      builder.jsr('sub');

      const program = builder.build();
      expect(program.stats.estimatedCycles).toBe(6);
    });

    it('should estimate 6 cycles for RTS', () => {
      const builder = new AsmILBuilder('test');
      builder.rts();

      const program = builder.build();
      expect(program.stats.estimatedCycles).toBe(6);
    });
  });

  describe('fluent chaining', () => {
    it('should chain control flow instructions', () => {
      const builder = new AsmILBuilder('test');

      const result = builder.cmp(0x00, 'immediate').beq('.done').jmp('main');

      expect(result).toBe(builder);
    });
  });

  describe('common control flow patterns', () => {
    it('should support conditional branch pattern', () => {
      const builder = new AsmILBuilder('test');

      builder.lda(0x50, 'zeroPage').cmp(0x00, 'immediate').beq('.is_zero').jmp('.not_zero');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(4);
    });

    it('should support loop pattern', () => {
      const builder = new AsmILBuilder('test');

      builder.ldx(0x00, 'immediate').label('.loop').inx().cpx(0x10, 'immediate').bne('.loop');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(4);
      expect(program.stats.labelCount).toBe(1);
    });

    it('should support subroutine call and return pattern', () => {
      const builder = new AsmILBuilder('test');

      builder.jsr('init').jsr('main').jmp('.done').label('init').rts().label('main').rts().label('.done');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(5); // JSR, JSR, JMP, RTS, RTS
      expect(program.stats.labelCount).toBe(3);
    });

    it('should support signed comparison pattern', () => {
      const builder = new AsmILBuilder('test');

      // Check if A < 0 (negative)
      builder.cmp(0x00, 'immediate').bmi('.negative').jmp('.positive');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });

    it('should support unsigned comparison pattern', () => {
      const builder = new AsmILBuilder('test');

      // Check if A < value (unsigned)
      builder.cmp(0x80, 'immediate').bcc('.less_than').jmp('.greater_or_equal');

      const program = builder.build();
      expect(program.stats.instructionCount).toBe(3);
    });
  });
});