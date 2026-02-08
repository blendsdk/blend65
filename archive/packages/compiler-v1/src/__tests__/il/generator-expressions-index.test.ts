/**
 * IL Expression Generator Tests - Index Expressions
 *
 * Tests for index expression generation (array access) including:
 * - Array read with literal index
 * - Array read with variable index
 * - Array read with expression index
 * - Byte and word element types
 * - Multi-dimensional patterns
 *
 * Part 6 of Phase 4 expression tests (~30 tests).
 *
 * @module __tests__/il/generator-expressions-index.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILExpressionGenerator } from '../../il/generator/expressions.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILOpcode } from '../../il/instructions.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parses Blend65 source code into an AST Program.
 *
 * @param source - Blend65 source code
 * @returns Parsed AST Program
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates a fresh ILExpressionGenerator for testing.
 *
 * @returns New generator instance with fresh symbol table
 */
function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

/**
 * Finds all instructions with a specific opcode in a function.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to find
 * @returns Array of matching instructions
 */
function findInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): { opcode: ILOpcode }[] {
  const instructions: { opcode: ILOpcode }[] = [];
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) {
        instructions.push(instr as { opcode: ILOpcode });
      }
    }
  }
  return instructions;
}

/**
 * Checks if a function contains at least one instruction with a specific opcode.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to find
 * @returns true if opcode is present
 */
function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  return findInstructions(ilFunc, opcode).length > 0;
}

// =============================================================================
// Basic Index Expression Tests
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: Basic Access', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('array read with literal index', () => {
    it('should generate LOAD_ARRAY for byte array with literal index', () => {
      const source = `module test
function readAt(): byte {
  let buffer: byte[10];
  return buffer[5];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readAt')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY for first element (index 0)', () => {
      const source = `module test
function readFirst(): byte {
  let data: byte[5];
  return data[0];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFirst')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY for last element', () => {
      const source = `module test
function readLast(): byte {
  let data: byte[5];
  return data[4];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readLast')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });

  describe('array read with variable index', () => {
    it('should generate LOAD_ARRAY with variable index', () => {
      const source = `module test
function readAtIndex(idx: byte): byte {
  let data: byte[10];
  return data[idx];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readAtIndex')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_VAR and LOAD_ARRAY for local index variable', () => {
      const source = `module test
function readDynamic(): byte {
  let data: byte[5];
  let i: byte = 2;
  return data[i];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readDynamic')!, ILOpcode.LOAD_VAR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readDynamic')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });

  describe('array read with expression index', () => {
    it('should generate ADD and LOAD_ARRAY for computed index', () => {
      const source = `module test
function readComputed(): byte {
  let data: byte[10];
  let base: byte = 2;
  return data[base + 3];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readComputed')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readComputed')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate MUL and LOAD_ARRAY for multiplied index', () => {
      const source = `module test
function readStrided(): byte {
  let data: byte[20];
  let row: byte = 2;
  return data[row * 5];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readStrided')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readStrided')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate complex expression for 2D-like access', () => {
      const source = `module test
function read2D(): byte {
  let data: byte[25];
  let row: byte = 2;
  let col: byte = 3;
  return data[row * 5 + col];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('read2D')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('read2D')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('read2D')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// Word Array Tests
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: Word Arrays', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('word array access', () => {
    it('should generate LOAD_ARRAY for word array', () => {
      const source = `module test
function readWord(): word {
  let addresses: word[4];
  return addresses[2];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readWord')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY for word array with variable index', () => {
      const source = `module test
function readWordAtIndex(idx: byte): word {
  let ptrs: word[3];
  return ptrs[idx];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readWordAtIndex')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// Index Expression in Expressions Tests
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: In Expressions', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('array access in arithmetic', () => {
    it('should generate LOAD_ARRAY and ADD for array element in addition', () => {
      const source = `module test
function addArrayElement(): byte {
  let values: byte[5];
  return values[2] + 5;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('addArrayElement')!, ILOpcode.LOAD_ARRAY)).toBe(true);
      expect(hasInstruction(result.module.getFunction('addArrayElement')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate two LOAD_ARRAY for adding array elements', () => {
      const source = `module test
function addTwoElements(): byte {
  let data: byte[5];
  return data[0] + data[4];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('addTwoElements')!, ILOpcode.LOAD_ARRAY).length).toBe(2);
      expect(hasInstruction(result.module.getFunction('addTwoElements')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('array access in comparisons', () => {
    it('should generate LOAD_ARRAY and CMP for array comparison', () => {
      const source = `module test
function checkElement(): bool {
  let data: byte[5];
  return data[2] == 30;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkElement')!, ILOpcode.LOAD_ARRAY)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkElement')!, ILOpcode.CMP_EQ)).toBe(true);
    });

    it('should generate LOAD_ARRAY in inequality check', () => {
      const source = `module test
function checkNotZero(): bool {
  let data: byte[3];
  return data[1] != 0;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkNotZero')!, ILOpcode.LOAD_ARRAY)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkNotZero')!, ILOpcode.CMP_NE)).toBe(true);
    });
  });

  describe('array access in control flow', () => {
    it('should generate LOAD_ARRAY in if condition', () => {
      const source = `module test
function checkArray(): byte {
  let flags: byte[4];
  if (flags[1] == 1) {
    return 1;
  }
  return 0;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkArray')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// Loop Index Access Tests
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: Loop Access', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('array access patterns (simplified)', () => {
    it('should generate LOAD_ARRAY with variable index', () => {
      const source = `module test
function sumElement(): byte {
  let data: byte[5];
  let sum: byte = 0;
  let i: byte = 2;
  sum = sum + data[i];
  return sum;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('sumElement')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY with computed index', () => {
      const source = `module test
function readEvenElement(): byte {
  let data: byte[10];
  let result: byte = 0;
  let i: byte = 2;
  result = result + data[i * 2];
  return result;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readEvenElement')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readEvenElement')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Index Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('C64 screen memory patterns', () => {
    it('should generate LOAD_ARRAY for character lookup', () => {
      const source = `module test
function getCharacter(): byte {
  let charset: byte[8];
  let row: byte = 3;
  return charset[row];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getCharacter')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY for sprite data lookup', () => {
      const source = `module test
function getSpriteRow(): byte {
  let spriteData: byte[21];
  let row: byte = 4;
  return spriteData[row * 3];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getSpriteRow')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('getSpriteRow')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });

    it('should generate LOAD_ARRAY for color table lookup', () => {
      const source = `module test
function getColor(): byte {
  let colorTable: byte[16];
  let colorIndex: byte = 5;
  return colorTable[colorIndex];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getColor')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });

  describe('sine table pattern', () => {
    it('should generate LOAD_ARRAY for sine table lookup', () => {
      const source = `module test
function getSine(): byte {
  let sineTable: byte[8];
  let angle: byte = 3;
  return sineTable[angle];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getSine')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// Index Expression Edge Cases
// =============================================================================

describe('ILExpressionGenerator - Index Expressions: Edge Cases', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('chained array access', () => {
    it('should handle array element used as index', () => {
      const source = `module test
function indirectLookup(): byte {
  let indices: byte[4];
  let values: byte[4];
  return values[indices[0]];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('indirectLookup')!, ILOpcode.LOAD_ARRAY).length).toBe(2);
    });
  });

  describe('array access with bitwise index', () => {
    it('should generate AND and LOAD_ARRAY for masked index', () => {
      const source = `module test
function maskedAccess(): byte {
  let data: byte[8];
  let i: byte = 15;
  return data[i & $07];
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('maskedAccess')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('maskedAccess')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});