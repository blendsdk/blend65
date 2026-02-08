/**
 * Tests for IL Enums
 *
 * @module __tests__/il/enums.test
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode, AddressingModeHint } from '../../il/enums.js';

describe('ILOpcode', () => {
  describe('Memory Operations', () => {
    it('should have LOAD_BYTE opcode', () => {
      expect(ILOpcode.LOAD_BYTE).toBe('LOAD_BYTE');
    });

    it('should have STORE_BYTE opcode', () => {
      expect(ILOpcode.STORE_BYTE).toBe('STORE_BYTE');
    });

    it('should have LOAD_WORD opcode', () => {
      expect(ILOpcode.LOAD_WORD).toBe('LOAD_WORD');
    });

    it('should have STORE_WORD opcode', () => {
      expect(ILOpcode.STORE_WORD).toBe('STORE_WORD');
    });

    it('should have LOAD_IMM opcode', () => {
      expect(ILOpcode.LOAD_IMM).toBe('LOAD_IMM');
    });

    it('should have LOAD_IMM_WORD opcode', () => {
      expect(ILOpcode.LOAD_IMM_WORD).toBe('LOAD_IMM_WORD');
    });
  });

  describe('Arithmetic Operations', () => {
    it('should have ADD_BYTE opcode', () => {
      expect(ILOpcode.ADD_BYTE).toBe('ADD_BYTE');
    });

    it('should have SUB_BYTE opcode', () => {
      expect(ILOpcode.SUB_BYTE).toBe('SUB_BYTE');
    });

    it('should have ADD_IMM opcode', () => {
      expect(ILOpcode.ADD_IMM).toBe('ADD_IMM');
    });

    it('should have SUB_IMM opcode', () => {
      expect(ILOpcode.SUB_IMM).toBe('SUB_IMM');
    });

    it('should have MUL_BYTE opcode', () => {
      expect(ILOpcode.MUL_BYTE).toBe('MUL_BYTE');
    });

    it('should have DIV_BYTE opcode', () => {
      expect(ILOpcode.DIV_BYTE).toBe('DIV_BYTE');
    });

    it('should have MOD_BYTE opcode', () => {
      expect(ILOpcode.MOD_BYTE).toBe('MOD_BYTE');
    });

    it('should have INC_BYTE opcode', () => {
      expect(ILOpcode.INC_BYTE).toBe('INC_BYTE');
    });

    it('should have DEC_BYTE opcode', () => {
      expect(ILOpcode.DEC_BYTE).toBe('DEC_BYTE');
    });
  });

  describe('Bitwise Operations', () => {
    it('should have AND_BYTE opcode', () => {
      expect(ILOpcode.AND_BYTE).toBe('AND_BYTE');
    });

    it('should have OR_BYTE opcode', () => {
      expect(ILOpcode.OR_BYTE).toBe('OR_BYTE');
    });

    it('should have XOR_BYTE opcode', () => {
      expect(ILOpcode.XOR_BYTE).toBe('XOR_BYTE');
    });

    it('should have NOT_BYTE opcode', () => {
      expect(ILOpcode.NOT_BYTE).toBe('NOT_BYTE');
    });

    it('should have SHL_BYTE opcode', () => {
      expect(ILOpcode.SHL_BYTE).toBe('SHL_BYTE');
    });

    it('should have SHR_BYTE opcode', () => {
      expect(ILOpcode.SHR_BYTE).toBe('SHR_BYTE');
    });
  });

  describe('Comparison Operations', () => {
    it('should have CMP_BYTE opcode', () => {
      expect(ILOpcode.CMP_BYTE).toBe('CMP_BYTE');
    });

    it('should have CMP_IMM opcode', () => {
      expect(ILOpcode.CMP_IMM).toBe('CMP_IMM');
    });
  });

  describe('Control Flow', () => {
    it('should have LABEL opcode', () => {
      expect(ILOpcode.LABEL).toBe('LABEL');
    });

    it('should have JUMP opcode', () => {
      expect(ILOpcode.JUMP).toBe('JUMP');
    });

    it('should have conditional jump opcodes', () => {
      expect(ILOpcode.JUMP_EQ).toBe('JUMP_EQ');
      expect(ILOpcode.JUMP_NE).toBe('JUMP_NE');
      expect(ILOpcode.JUMP_LT).toBe('JUMP_LT');
      expect(ILOpcode.JUMP_LE).toBe('JUMP_LE');
      expect(ILOpcode.JUMP_GE).toBe('JUMP_GE');
      expect(ILOpcode.JUMP_GT).toBe('JUMP_GT');
    });
  });

  describe('Function Operations', () => {
    it('should have CALL opcode', () => {
      expect(ILOpcode.CALL).toBe('CALL');
    });

    it('should have RETURN opcode', () => {
      expect(ILOpcode.RETURN).toBe('RETURN');
    });
  });

  describe('Register Transfers', () => {
    it('should have all transfer opcodes', () => {
      expect(ILOpcode.TRANSFER_AX).toBe('TRANSFER_AX');
      expect(ILOpcode.TRANSFER_AY).toBe('TRANSFER_AY');
      expect(ILOpcode.TRANSFER_XA).toBe('TRANSFER_XA');
      expect(ILOpcode.TRANSFER_YA).toBe('TRANSFER_YA');
    });
  });

  describe('Intrinsics', () => {
    it('should have PEEK/POKE opcodes', () => {
      expect(ILOpcode.PEEK).toBe('PEEK');
      expect(ILOpcode.POKE).toBe('POKE');
      expect(ILOpcode.PEEKW).toBe('PEEKW');
      expect(ILOpcode.POKEW).toBe('POKEW');
    });

    it('should have HI/LO opcodes', () => {
      expect(ILOpcode.HI).toBe('HI');
      expect(ILOpcode.LO).toBe('LO');
    });
  });

  describe('Special', () => {
    it('should have NOP opcode', () => {
      expect(ILOpcode.NOP).toBe('NOP');
    });

    it('should have stack opcodes', () => {
      expect(ILOpcode.PUSH_A).toBe('PUSH_A');
      expect(ILOpcode.POP_A).toBe('POP_A');
    });
  });
});

describe('AddressingModeHint', () => {
  describe('Zero Page Modes', () => {
    it('should have ZeroPage hint', () => {
      expect(AddressingModeHint.ZeroPage).toBe('ZeroPage');
    });

    it('should have ZeroPageX hint', () => {
      expect(AddressingModeHint.ZeroPageX).toBe('ZeroPageX');
    });

    it('should have ZeroPageY hint', () => {
      expect(AddressingModeHint.ZeroPageY).toBe('ZeroPageY');
    });
  });

  describe('Absolute Modes', () => {
    it('should have Absolute hint', () => {
      expect(AddressingModeHint.Absolute).toBe('Absolute');
    });

    it('should have AbsoluteX hint', () => {
      expect(AddressingModeHint.AbsoluteX).toBe('AbsoluteX');
    });

    it('should have AbsoluteY hint', () => {
      expect(AddressingModeHint.AbsoluteY).toBe('AbsoluteY');
    });
  });

  describe('Indirect Modes', () => {
    it('should have Indirect hint', () => {
      expect(AddressingModeHint.Indirect).toBe('Indirect');
    });

    it('should have IndirectX hint', () => {
      expect(AddressingModeHint.IndirectX).toBe('IndirectX');
    });

    it('should have IndirectY hint', () => {
      expect(AddressingModeHint.IndirectY).toBe('IndirectY');
    });
  });
});