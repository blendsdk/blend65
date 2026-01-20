/**
 * IL Instructions - Opcode Enum Tests
 *
 * Tests for ILOpcode enum values and categories.
 *
 * @module il/instructions-opcode.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode } from '../../il/instructions.js';

describe('ILOpcode Enum', () => {
  describe('constant opcodes', () => {
    it('should have CONST opcode', () => {
      expect(ILOpcode.CONST).toBe('CONST');
    });

    it('should have UNDEF opcode', () => {
      expect(ILOpcode.UNDEF).toBe('UNDEF');
    });
  });

  describe('memory operation opcodes', () => {
    it('should have LOAD_VAR opcode', () => {
      expect(ILOpcode.LOAD_VAR).toBe('LOAD_VAR');
    });

    it('should have STORE_VAR opcode', () => {
      expect(ILOpcode.STORE_VAR).toBe('STORE_VAR');
    });

    it('should have LOAD_ARRAY opcode', () => {
      expect(ILOpcode.LOAD_ARRAY).toBe('LOAD_ARRAY');
    });

    it('should have STORE_ARRAY opcode', () => {
      expect(ILOpcode.STORE_ARRAY).toBe('STORE_ARRAY');
    });

    it('should have LOAD_FIELD opcode', () => {
      expect(ILOpcode.LOAD_FIELD).toBe('LOAD_FIELD');
    });

    it('should have STORE_FIELD opcode', () => {
      expect(ILOpcode.STORE_FIELD).toBe('STORE_FIELD');
    });
  });

  describe('arithmetic operation opcodes', () => {
    it('should have ADD opcode', () => {
      expect(ILOpcode.ADD).toBe('ADD');
    });

    it('should have SUB opcode', () => {
      expect(ILOpcode.SUB).toBe('SUB');
    });

    it('should have MUL opcode', () => {
      expect(ILOpcode.MUL).toBe('MUL');
    });

    it('should have DIV opcode', () => {
      expect(ILOpcode.DIV).toBe('DIV');
    });

    it('should have MOD opcode', () => {
      expect(ILOpcode.MOD).toBe('MOD');
    });

    it('should have NEG opcode', () => {
      expect(ILOpcode.NEG).toBe('NEG');
    });
  });

  describe('bitwise operation opcodes', () => {
    it('should have AND opcode', () => {
      expect(ILOpcode.AND).toBe('AND');
    });

    it('should have OR opcode', () => {
      expect(ILOpcode.OR).toBe('OR');
    });

    it('should have XOR opcode', () => {
      expect(ILOpcode.XOR).toBe('XOR');
    });

    it('should have NOT opcode', () => {
      expect(ILOpcode.NOT).toBe('NOT');
    });

    it('should have SHL opcode', () => {
      expect(ILOpcode.SHL).toBe('SHL');
    });

    it('should have SHR opcode', () => {
      expect(ILOpcode.SHR).toBe('SHR');
    });
  });

  describe('comparison operation opcodes', () => {
    it('should have CMP_EQ opcode', () => {
      expect(ILOpcode.CMP_EQ).toBe('CMP_EQ');
    });

    it('should have CMP_NE opcode', () => {
      expect(ILOpcode.CMP_NE).toBe('CMP_NE');
    });

    it('should have CMP_LT opcode', () => {
      expect(ILOpcode.CMP_LT).toBe('CMP_LT');
    });

    it('should have CMP_LE opcode', () => {
      expect(ILOpcode.CMP_LE).toBe('CMP_LE');
    });

    it('should have CMP_GT opcode', () => {
      expect(ILOpcode.CMP_GT).toBe('CMP_GT');
    });

    it('should have CMP_GE opcode', () => {
      expect(ILOpcode.CMP_GE).toBe('CMP_GE');
    });
  });

  describe('logical operation opcodes', () => {
    it('should have LOGICAL_AND opcode', () => {
      expect(ILOpcode.LOGICAL_AND).toBe('LOGICAL_AND');
    });

    it('should have LOGICAL_OR opcode', () => {
      expect(ILOpcode.LOGICAL_OR).toBe('LOGICAL_OR');
    });

    it('should have LOGICAL_NOT opcode', () => {
      expect(ILOpcode.LOGICAL_NOT).toBe('LOGICAL_NOT');
    });
  });

  describe('type conversion opcodes', () => {
    it('should have ZERO_EXTEND opcode', () => {
      expect(ILOpcode.ZERO_EXTEND).toBe('ZERO_EXTEND');
    });

    it('should have TRUNCATE opcode', () => {
      expect(ILOpcode.TRUNCATE).toBe('TRUNCATE');
    });

    it('should have BOOL_TO_BYTE opcode', () => {
      expect(ILOpcode.BOOL_TO_BYTE).toBe('BOOL_TO_BYTE');
    });

    it('should have BYTE_TO_BOOL opcode', () => {
      expect(ILOpcode.BYTE_TO_BOOL).toBe('BYTE_TO_BOOL');
    });
  });

  describe('control flow opcodes', () => {
    it('should have JUMP opcode', () => {
      expect(ILOpcode.JUMP).toBe('JUMP');
    });

    it('should have BRANCH opcode', () => {
      expect(ILOpcode.BRANCH).toBe('BRANCH');
    });

    it('should have RETURN opcode', () => {
      expect(ILOpcode.RETURN).toBe('RETURN');
    });

    it('should have RETURN_VOID opcode', () => {
      expect(ILOpcode.RETURN_VOID).toBe('RETURN_VOID');
    });
  });

  describe('function call opcodes', () => {
    it('should have CALL opcode', () => {
      expect(ILOpcode.CALL).toBe('CALL');
    });

    it('should have CALL_VOID opcode', () => {
      expect(ILOpcode.CALL_VOID).toBe('CALL_VOID');
    });

    it('should have CALL_INDIRECT opcode', () => {
      expect(ILOpcode.CALL_INDIRECT).toBe('CALL_INDIRECT');
    });
  });

  describe('intrinsic opcodes', () => {
    it('should have INTRINSIC_PEEK opcode', () => {
      expect(ILOpcode.INTRINSIC_PEEK).toBe('INTRINSIC_PEEK');
    });

    it('should have INTRINSIC_POKE opcode', () => {
      expect(ILOpcode.INTRINSIC_POKE).toBe('INTRINSIC_POKE');
    });

    it('should have INTRINSIC_PEEKW opcode', () => {
      expect(ILOpcode.INTRINSIC_PEEKW).toBe('INTRINSIC_PEEKW');
    });

    it('should have INTRINSIC_POKEW opcode', () => {
      expect(ILOpcode.INTRINSIC_POKEW).toBe('INTRINSIC_POKEW');
    });

    it('should have INTRINSIC_LENGTH opcode', () => {
      expect(ILOpcode.INTRINSIC_LENGTH).toBe('INTRINSIC_LENGTH');
    });

    it('should have INTRINSIC_LO opcode', () => {
      expect(ILOpcode.INTRINSIC_LO).toBe('INTRINSIC_LO');
    });

    it('should have INTRINSIC_HI opcode', () => {
      expect(ILOpcode.INTRINSIC_HI).toBe('INTRINSIC_HI');
    });
  });

  describe('SSA opcodes', () => {
    it('should have PHI opcode', () => {
      expect(ILOpcode.PHI).toBe('PHI');
    });
  });

  describe('hardware access opcodes', () => {
    it('should have HARDWARE_READ opcode', () => {
      expect(ILOpcode.HARDWARE_READ).toBe('HARDWARE_READ');
    });

    it('should have HARDWARE_WRITE opcode', () => {
      expect(ILOpcode.HARDWARE_WRITE).toBe('HARDWARE_WRITE');
    });
  });

  describe('@map struct access opcodes', () => {
    it('should have MAP_LOAD_FIELD opcode', () => {
      expect(ILOpcode.MAP_LOAD_FIELD).toBe('MAP_LOAD_FIELD');
    });

    it('should have MAP_STORE_FIELD opcode', () => {
      expect(ILOpcode.MAP_STORE_FIELD).toBe('MAP_STORE_FIELD');
    });

    it('should have MAP_LOAD_RANGE opcode', () => {
      expect(ILOpcode.MAP_LOAD_RANGE).toBe('MAP_LOAD_RANGE');
    });

    it('should have MAP_STORE_RANGE opcode', () => {
      expect(ILOpcode.MAP_STORE_RANGE).toBe('MAP_STORE_RANGE');
    });
  });

  describe('optimization control opcodes', () => {
    it('should have OPT_BARRIER opcode', () => {
      expect(ILOpcode.OPT_BARRIER).toBe('OPT_BARRIER');
    });

    it('should have VOLATILE_READ opcode', () => {
      expect(ILOpcode.VOLATILE_READ).toBe('VOLATILE_READ');
    });

    it('should have VOLATILE_WRITE opcode', () => {
      expect(ILOpcode.VOLATILE_WRITE).toBe('VOLATILE_WRITE');
    });
  });

  describe('CPU instruction opcodes', () => {
    it('should have CPU_SEI opcode', () => {
      expect(ILOpcode.CPU_SEI).toBe('CPU_SEI');
    });

    it('should have CPU_CLI opcode', () => {
      expect(ILOpcode.CPU_CLI).toBe('CPU_CLI');
    });

    it('should have CPU_NOP opcode', () => {
      expect(ILOpcode.CPU_NOP).toBe('CPU_NOP');
    });

    it('should have CPU_BRK opcode', () => {
      expect(ILOpcode.CPU_BRK).toBe('CPU_BRK');
    });

    it('should have CPU_PHA opcode', () => {
      expect(ILOpcode.CPU_PHA).toBe('CPU_PHA');
    });

    it('should have CPU_PLA opcode', () => {
      expect(ILOpcode.CPU_PLA).toBe('CPU_PLA');
    });

    it('should have CPU_PHP opcode', () => {
      expect(ILOpcode.CPU_PHP).toBe('CPU_PHP');
    });

    it('should have CPU_PLP opcode', () => {
      expect(ILOpcode.CPU_PLP).toBe('CPU_PLP');
    });
  });
});