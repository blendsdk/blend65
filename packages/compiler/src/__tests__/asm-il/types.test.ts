/**
 * ASM-IL Types Tests
 *
 * Tests for type definitions, enums, type guards, and utility functions.
 *
 * @module __tests__/asm-il/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Enums
  AddressingMode,
  DataType,
  LabelType,
  // Type guards
  isAsmInstruction,
  isAsmLabel,
  isAsmData,
  isAsmOrigin,
  isAsmComment,
  isAsmBlankLine,
  isAsmRaw,
  // Factory functions
  createAsmModule,
  // Utility functions
  getInstructionCycles,
  getInstructionBytes,
  // Constants
  INSTRUCTION_BYTES,
  INSTRUCTION_CYCLES,
} from '../../asm-il/types.js';
import type {
  AsmInstruction,
  AsmLabel,
  AsmData,
  AsmOrigin,
  AsmComment,
  AsmBlankLine,
  AsmRaw,
  AsmItem,
  AsmModule,
  Mnemonic,
} from '../../asm-il/types.js';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Create a test instruction
 */
function createTestInstruction(
  mnemonic: Mnemonic = 'LDA',
  mode: AddressingMode = AddressingMode.Immediate,
  operand?: number | string,
): AsmInstruction {
  return {
    kind: 'instruction',
    mnemonic,
    mode,
    operand,
    cycles: getInstructionCycles(mnemonic, mode),
    bytes: getInstructionBytes(mode),
  };
}

/**
 * Create a test label
 */
function createTestLabel(name: string = 'test_label', type: LabelType = LabelType.Function): AsmLabel {
  return {
    kind: 'label',
    name,
    type,
    exported: false,
  };
}

/**
 * Create test data
 */
function createTestData(type: DataType = DataType.Byte, values: number[] | string | { count: number; value: number } = [0]): AsmData {
  return {
    kind: 'data',
    type,
    values,
  };
}

// ============================================================================
// ADDRESSING MODE ENUM TESTS
// ============================================================================

describe('AddressingMode enum', () => {
  it('should have all 13 addressing modes', () => {
    // String enum: keys and values are the same set
    expect(Object.keys(AddressingMode)).toHaveLength(13);
    expect(Object.values(AddressingMode)).toHaveLength(13);
  });

  it('should have correct string values', () => {
    expect(AddressingMode.Implied).toBe('implied');
    expect(AddressingMode.Accumulator).toBe('accumulator');
    expect(AddressingMode.Immediate).toBe('immediate');
    expect(AddressingMode.ZeroPage).toBe('zeroPage');
    expect(AddressingMode.ZeroPageX).toBe('zeroPageX');
    expect(AddressingMode.ZeroPageY).toBe('zeroPageY');
    expect(AddressingMode.Absolute).toBe('absolute');
    expect(AddressingMode.AbsoluteX).toBe('absoluteX');
    expect(AddressingMode.AbsoluteY).toBe('absoluteY');
    expect(AddressingMode.IndirectX).toBe('indirectX');
    expect(AddressingMode.IndirectY).toBe('indirectY');
    expect(AddressingMode.Relative).toBe('relative');
    expect(AddressingMode.Indirect).toBe('indirect');
  });
});

// ============================================================================
// DATA TYPE ENUM TESTS
// ============================================================================

describe('DataType enum', () => {
  it('should have all 4 data types', () => {
    expect(Object.values(DataType).filter((v) => typeof v === 'string')).toHaveLength(4);
  });

  it('should have correct string values', () => {
    expect(DataType.Byte).toBe('byte');
    expect(DataType.Word).toBe('word');
    expect(DataType.Text).toBe('text');
    expect(DataType.Fill).toBe('fill');
  });
});

// ============================================================================
// LABEL TYPE ENUM TESTS
// ============================================================================

describe('LabelType enum', () => {
  it('should have all 5 label types', () => {
    expect(Object.values(LabelType).filter((v) => typeof v === 'string')).toHaveLength(5);
  });

  it('should have correct string values', () => {
    expect(LabelType.Function).toBe('function');
    expect(LabelType.Global).toBe('global');
    expect(LabelType.Block).toBe('block');
    expect(LabelType.Data).toBe('data');
    expect(LabelType.Temp).toBe('temp');
  });
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('Type guards', () => {
  describe('isAsmInstruction', () => {
    it('should return true for instruction items', () => {
      const instr = createTestInstruction();
      expect(isAsmInstruction(instr)).toBe(true);
    });

    it('should return false for non-instruction items', () => {
      const label = createTestLabel();
      const data = createTestData();
      const origin: AsmOrigin = { kind: 'origin', address: 0x0801 };
      const comment: AsmComment = { kind: 'comment', text: 'test', style: 'line' };
      const blank: AsmBlankLine = { kind: 'blank' };
      const raw: AsmRaw = { kind: 'raw', text: 'test' };

      expect(isAsmInstruction(label)).toBe(false);
      expect(isAsmInstruction(data)).toBe(false);
      expect(isAsmInstruction(origin)).toBe(false);
      expect(isAsmInstruction(comment)).toBe(false);
      expect(isAsmInstruction(blank)).toBe(false);
      expect(isAsmInstruction(raw)).toBe(false);
    });
  });

  describe('isAsmLabel', () => {
    it('should return true for label items', () => {
      const label = createTestLabel();
      expect(isAsmLabel(label)).toBe(true);
    });

    it('should return false for non-label items', () => {
      const instr = createTestInstruction();
      expect(isAsmLabel(instr)).toBe(false);
    });
  });

  describe('isAsmData', () => {
    it('should return true for data items', () => {
      const data = createTestData();
      expect(isAsmData(data)).toBe(true);
    });

    it('should return false for non-data items', () => {
      const instr = createTestInstruction();
      expect(isAsmData(instr)).toBe(false);
    });
  });

  describe('isAsmOrigin', () => {
    it('should return true for origin items', () => {
      const origin: AsmOrigin = { kind: 'origin', address: 0x0801 };
      expect(isAsmOrigin(origin)).toBe(true);
    });

    it('should return false for non-origin items', () => {
      const instr = createTestInstruction();
      expect(isAsmOrigin(instr)).toBe(false);
    });
  });

  describe('isAsmComment', () => {
    it('should return true for comment items', () => {
      const comment: AsmComment = { kind: 'comment', text: 'test', style: 'line' };
      expect(isAsmComment(comment)).toBe(true);
    });

    it('should return false for non-comment items', () => {
      const instr = createTestInstruction();
      expect(isAsmComment(instr)).toBe(false);
    });
  });

  describe('isAsmBlankLine', () => {
    it('should return true for blank line items', () => {
      const blank: AsmBlankLine = { kind: 'blank' };
      expect(isAsmBlankLine(blank)).toBe(true);
    });

    it('should return false for non-blank items', () => {
      const instr = createTestInstruction();
      expect(isAsmBlankLine(instr)).toBe(false);
    });
  });

  describe('isAsmRaw', () => {
    it('should return true for raw items', () => {
      const raw: AsmRaw = { kind: 'raw', text: 'test' };
      expect(isAsmRaw(raw)).toBe(true);
    });

    it('should return false for non-raw items', () => {
      const instr = createTestInstruction();
      expect(isAsmRaw(instr)).toBe(false);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createAsmModule', () => {
  it('should create a module with default values', () => {
    const module = createAsmModule('test.blend');
    
    expect(module.name).toBe('test.blend');
    expect(module.origin).toBe(0x0801);
    expect(module.target).toBe('c64');
    expect(module.items).toEqual([]);
    expect(module.labels).toBeInstanceOf(Map);
    expect(module.labels.size).toBe(0);
  });

  it('should create a module with custom origin', () => {
    const module = createAsmModule('test.blend', 0xC000);
    
    expect(module.origin).toBe(0xC000);
  });

  it('should create a module with custom target', () => {
    const module = createAsmModule('test.blend', 0x0801, 'vic20');
    
    expect(module.target).toBe('vic20');
  });

  it('should have valid metadata', () => {
    const module = createAsmModule('test.blend');
    
    expect(module.metadata).toBeDefined();
    expect(module.metadata.compilerVersion).toBe('0.1.0');
    expect(module.metadata.optimizationLevel).toBe('O0');
    expect(module.metadata.estimatedCodeSize).toBe(0);
    expect(module.metadata.estimatedDataSize).toBe(0);
    expect(module.metadata.functionCount).toBe(0);
    expect(module.metadata.globalCount).toBe(0);
    expect(module.metadata.generatedAt).toBeDefined();
  });
});

// ============================================================================
// INSTRUCTION BYTES TABLE TESTS
// ============================================================================

describe('INSTRUCTION_BYTES', () => {
  it('should have correct byte counts for all addressing modes', () => {
    expect(INSTRUCTION_BYTES[AddressingMode.Implied]).toBe(1);
    expect(INSTRUCTION_BYTES[AddressingMode.Accumulator]).toBe(1);
    expect(INSTRUCTION_BYTES[AddressingMode.Immediate]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.ZeroPage]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.ZeroPageX]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.ZeroPageY]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.Absolute]).toBe(3);
    expect(INSTRUCTION_BYTES[AddressingMode.AbsoluteX]).toBe(3);
    expect(INSTRUCTION_BYTES[AddressingMode.AbsoluteY]).toBe(3);
    expect(INSTRUCTION_BYTES[AddressingMode.IndirectX]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.IndirectY]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_BYTES[AddressingMode.Indirect]).toBe(3);
  });
});

// ============================================================================
// INSTRUCTION CYCLES TABLE TESTS
// ============================================================================

describe('INSTRUCTION_CYCLES', () => {
  it('should have correct cycle counts for LDA', () => {
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.Immediate]).toBe(2);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.ZeroPage]).toBe(3);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.ZeroPageX]).toBe(4);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.Absolute]).toBe(4);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.AbsoluteX]).toBe(4);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.AbsoluteY]).toBe(4);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.IndirectX]).toBe(6);
    expect(INSTRUCTION_CYCLES.LDA?.[AddressingMode.IndirectY]).toBe(5);
  });

  it('should have correct cycle counts for STA', () => {
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.ZeroPage]).toBe(3);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.ZeroPageX]).toBe(4);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.Absolute]).toBe(4);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.AbsoluteX]).toBe(5);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.AbsoluteY]).toBe(5);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.IndirectX]).toBe(6);
    expect(INSTRUCTION_CYCLES.STA?.[AddressingMode.IndirectY]).toBe(6);
  });

  it('should have correct cycle counts for transfer instructions', () => {
    expect(INSTRUCTION_CYCLES.TAX?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.TAY?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.TXA?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.TYA?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.TSX?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.TXS?.[AddressingMode.Implied]).toBe(2);
  });

  it('should have correct cycle counts for stack instructions', () => {
    expect(INSTRUCTION_CYCLES.PHA?.[AddressingMode.Implied]).toBe(3);
    expect(INSTRUCTION_CYCLES.PHP?.[AddressingMode.Implied]).toBe(3);
    expect(INSTRUCTION_CYCLES.PLA?.[AddressingMode.Implied]).toBe(4);
    expect(INSTRUCTION_CYCLES.PLP?.[AddressingMode.Implied]).toBe(4);
  });

  it('should have correct cycle counts for branch instructions', () => {
    expect(INSTRUCTION_CYCLES.BCC?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BCS?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BEQ?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BMI?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BNE?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BPL?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BVC?.[AddressingMode.Relative]).toBe(2);
    expect(INSTRUCTION_CYCLES.BVS?.[AddressingMode.Relative]).toBe(2);
  });

  it('should have correct cycle counts for jump instructions', () => {
    expect(INSTRUCTION_CYCLES.JMP?.[AddressingMode.Absolute]).toBe(3);
    expect(INSTRUCTION_CYCLES.JMP?.[AddressingMode.Indirect]).toBe(5);
    expect(INSTRUCTION_CYCLES.JSR?.[AddressingMode.Absolute]).toBe(6);
    expect(INSTRUCTION_CYCLES.RTS?.[AddressingMode.Implied]).toBe(6);
    expect(INSTRUCTION_CYCLES.RTI?.[AddressingMode.Implied]).toBe(6);
    expect(INSTRUCTION_CYCLES.BRK?.[AddressingMode.Implied]).toBe(7);
  });

  it('should have correct cycle counts for flag instructions', () => {
    expect(INSTRUCTION_CYCLES.CLC?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.CLD?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.CLI?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.CLV?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.SEC?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.SED?.[AddressingMode.Implied]).toBe(2);
    expect(INSTRUCTION_CYCLES.SEI?.[AddressingMode.Implied]).toBe(2);
  });

  it('should have correct cycle counts for NOP', () => {
    expect(INSTRUCTION_CYCLES.NOP?.[AddressingMode.Implied]).toBe(2);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getInstructionCycles', () => {
  it('should return correct cycles for known mnemonic/mode combinations', () => {
    expect(getInstructionCycles('LDA', AddressingMode.Immediate)).toBe(2);
    expect(getInstructionCycles('STA', AddressingMode.Absolute)).toBe(4);
    expect(getInstructionCycles('RTS', AddressingMode.Implied)).toBe(6);
  });

  it('should return 0 for unknown combinations', () => {
    // LDA doesn't have Implied mode
    expect(getInstructionCycles('LDA', AddressingMode.Implied)).toBe(0);
  });
});

describe('getInstructionBytes', () => {
  it('should return correct bytes for all addressing modes', () => {
    expect(getInstructionBytes(AddressingMode.Implied)).toBe(1);
    expect(getInstructionBytes(AddressingMode.Immediate)).toBe(2);
    expect(getInstructionBytes(AddressingMode.Absolute)).toBe(3);
  });
});

// ============================================================================
// INSTRUCTION INTERFACE TESTS
// ============================================================================

describe('AsmInstruction interface', () => {
  it('should create a valid instruction with number operand', () => {
    const instr: AsmInstruction = {
      kind: 'instruction',
      mnemonic: 'LDA',
      mode: AddressingMode.Immediate,
      operand: 0x05,
      cycles: 2,
      bytes: 2,
    };

    expect(instr.kind).toBe('instruction');
    expect(instr.mnemonic).toBe('LDA');
    expect(instr.mode).toBe(AddressingMode.Immediate);
    expect(instr.operand).toBe(0x05);
  });

  it('should create a valid instruction with label operand', () => {
    const instr: AsmInstruction = {
      kind: 'instruction',
      mnemonic: 'JMP',
      mode: AddressingMode.Absolute,
      operand: '_main',
      cycles: 3,
      bytes: 3,
    };

    expect(instr.operand).toBe('_main');
  });

  it('should create a valid instruction without operand (implied)', () => {
    const instr: AsmInstruction = {
      kind: 'instruction',
      mnemonic: 'RTS',
      mode: AddressingMode.Implied,
      cycles: 6,
      bytes: 1,
    };

    expect(instr.operand).toBeUndefined();
  });

  it('should support optional comment', () => {
    const instr: AsmInstruction = {
      kind: 'instruction',
      mnemonic: 'LDA',
      mode: AddressingMode.Immediate,
      operand: 0x00,
      cycles: 2,
      bytes: 2,
      comment: 'Load zero',
    };

    expect(instr.comment).toBe('Load zero');
  });
});

// ============================================================================
// LABEL INTERFACE TESTS
// ============================================================================

describe('AsmLabel interface', () => {
  it('should create a valid function label', () => {
    const label: AsmLabel = {
      kind: 'label',
      name: '_main',
      type: LabelType.Function,
      exported: true,
    };

    expect(label.kind).toBe('label');
    expect(label.name).toBe('_main');
    expect(label.type).toBe(LabelType.Function);
    expect(label.exported).toBe(true);
  });

  it('should create a valid block label', () => {
    const label: AsmLabel = {
      kind: 'label',
      name: '.loop',
      type: LabelType.Block,
      exported: false,
    };

    expect(label.type).toBe(LabelType.Block);
    expect(label.exported).toBe(false);
  });

  it('should support optional address', () => {
    const label: AsmLabel = {
      kind: 'label',
      name: '_main',
      type: LabelType.Function,
      address: 0x0801,
    };

    expect(label.address).toBe(0x0801);
  });
});

// ============================================================================
// DATA INTERFACE TESTS
// ============================================================================

describe('AsmData interface', () => {
  it('should create byte data', () => {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Byte,
      values: [0x00, 0x01, 0x02],
    };

    expect(data.kind).toBe('data');
    expect(data.type).toBe(DataType.Byte);
    expect(data.values).toEqual([0x00, 0x01, 0x02]);
  });

  it('should create word data', () => {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Word,
      values: [0x1234, 0x5678],
    };

    expect(data.type).toBe(DataType.Word);
    expect(data.values).toEqual([0x1234, 0x5678]);
  });

  it('should create text data', () => {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Text,
      values: 'HELLO',
    };

    expect(data.type).toBe(DataType.Text);
    expect(data.values).toBe('HELLO');
  });

  it('should create fill data', () => {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Fill,
      values: { count: 256, value: 0x00 },
    };

    expect(data.type).toBe(DataType.Fill);
    expect(data.values).toEqual({ count: 256, value: 0x00 });
  });
});

// ============================================================================
// MODULE INTERFACE TESTS
// ============================================================================

describe('AsmModule interface', () => {
  it('should have all required properties', () => {
    const module = createAsmModule('test.blend');

    expect(module).toHaveProperty('name');
    expect(module).toHaveProperty('origin');
    expect(module).toHaveProperty('target');
    expect(module).toHaveProperty('items');
    expect(module).toHaveProperty('labels');
    expect(module).toHaveProperty('metadata');
  });

  it('should have valid metadata structure', () => {
    const module = createAsmModule('test.blend');

    expect(module.metadata).toHaveProperty('generatedAt');
    expect(module.metadata).toHaveProperty('compilerVersion');
    expect(module.metadata).toHaveProperty('optimizationLevel');
    expect(module.metadata).toHaveProperty('estimatedCodeSize');
    expect(module.metadata).toHaveProperty('estimatedDataSize');
    expect(module.metadata).toHaveProperty('functionCount');
    expect(module.metadata).toHaveProperty('globalCount');
  });
});