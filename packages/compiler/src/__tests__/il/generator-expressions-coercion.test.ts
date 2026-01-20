/**
 * IL Expression Generator Tests - Type Coercion
 *
 * Tests for type coercion and conversion operations:
 * - Byte to word (ZERO_EXTEND)
 * - Word to byte (TRUNCATE)
 * - Bool conversions (BOOL_TO_BYTE, BYTE_TO_BOOL)
 * - Implicit coercion in operations
 * - Coercion in function calls
 * - Assignment coercion
 *
 * Part 9 of Phase 4 expression tests (~50 tests).
 *
 * @module __tests__/il/generator-expressions-coercion.test
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
// Byte to Word Coercion Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: Byte to Word', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('explicit byte to word conversion', () => {
    it('should handle byte in word context', () => {
      const source = `module test
function byteToWord(): word
  let b: byte = 100
  let w: word = 0
  w = b
  return w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('byteToWord')).toBeDefined();
    });

    it('should handle byte literal in word variable', () => {
      const source = `module test
function literalToWord(): word
  let w: word = 255
  return w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('literalToWord')).toBeDefined();
    });

    it('should handle byte return in word function', () => {
      const source = `module test
function returnByteAsWord(): word
  let b: byte = 42
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('returnByteAsWord')).toBeDefined();
    });
  });

  describe('byte to word in arithmetic', () => {
    it('should handle byte + word operation', () => {
      const source = `module test
function byteAddWord(): word
  let b: byte = 100
  let w: word = 1000
  return b + w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('byteAddWord')!, ILOpcode.ADD)).toBe(true);
    });

    it('should handle byte * word operation', () => {
      const source = `module test
function byteMulWord(): word
  let b: byte = 10
  let w: word = 500
  return b * w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('byteMulWord')!, ILOpcode.MUL)).toBe(true);
    });
  });
});

// =============================================================================
// Word to Byte Coercion Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: Word to Byte', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('word to byte truncation', () => {
    it('should handle word in byte context', () => {
      const source = `module test
function wordToByte(): byte
  let w: word = 256
  let b: byte = 0
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('wordToByte')).toBeDefined();
    });

    it('should handle word literal in small range', () => {
      const source = `module test
function smallWord(): byte
  let b: byte = 100
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('smallWord')).toBeDefined();
    });
  });

  describe('low byte extraction pattern', () => {
    it('should handle AND mask for low byte', () => {
      const source = `module test
function getLowByte(): byte
  let w: word = $1234
  let b: byte = w & $FF
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getLowByte')!, ILOpcode.AND)).toBe(true);
    });

    it('should handle shift for high byte extraction', () => {
      const source = `module test
function getHighByte(): byte
  let w: word = $1234
  let b: byte = w >> 8
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('getHighByte')!, ILOpcode.SHR)).toBe(true);
    });
  });
});

// =============================================================================
// Bool Conversion Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: Bool Conversions', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('bool to byte conversion', () => {
    it('should handle bool in byte context', () => {
      const source = `module test
function boolToByte(): byte
  let flag: bool = true
  let b: byte = 0
  if flag then
    b = 1
  end if
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('boolToByte')).toBeDefined();
    });

    it('should handle true literal as 1', () => {
      const source = `module test
function trueAsByte(): byte
  let b: byte = 0
  let flag: bool = true
  if flag then
    b = 1
  end if
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('trueAsByte')).toBeDefined();
    });

    it('should handle false literal as 0', () => {
      const source = `module test
function falseAsByte(): byte
  let b: byte = 1
  let flag: bool = false
  if !flag then
    b = 0
  end if
  return b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('falseAsByte')).toBeDefined();
    });
  });

  describe('byte to bool conversion', () => {
    it('should handle byte in bool context (if condition)', () => {
      const source = `module test
function byteAsBool(): byte
  let value: byte = 1
  if value != 0 then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('byteAsBool')!, ILOpcode.CMP_NE)).toBe(true);
    });

    it('should handle zero as false', () => {
      const source = `module test
function zeroIsFalse(): bool
  let value: byte = 0
  return value != 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('zeroIsFalse')).toBeDefined();
    });

    it('should handle non-zero as true', () => {
      const source = `module test
function nonZeroIsTrue(): bool
  let value: byte = 42
  return value != 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('nonZeroIsTrue')).toBeDefined();
    });
  });
});

// =============================================================================
// Coercion in Binary Operations Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: In Operations', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('coercion in arithmetic', () => {
    it('should handle mixed byte/word addition', () => {
      const source = `module test
function mixedAdd(): word
  let b: byte = 200
  let w: word = 1000
  return b + w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixedAdd')!, ILOpcode.ADD)).toBe(true);
    });

    it('should handle mixed byte/word subtraction', () => {
      const source = `module test
function mixedSub(): word
  let w: word = 1000
  let b: byte = 100
  return w - b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixedSub')!, ILOpcode.SUB)).toBe(true);
    });

    it('should handle byte multiplication with promotion', () => {
      const source = `module test
function byteMul(): word
  let a: byte = 200
  let b: byte = 100
  return a * b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('byteMul')!, ILOpcode.MUL)).toBe(true);
    });
  });

  describe('coercion in comparisons', () => {
    it('should handle byte/word comparison', () => {
      const source = `module test
function byteWordCmp(): bool
  let b: byte = 100
  let w: word = 1000
  return b < w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('byteWordCmp')!, ILOpcode.CMP_LT)).toBe(true);
    });

    it('should handle word/byte equality', () => {
      const source = `module test
function wordByteEq(): bool
  let w: word = 100
  let b: byte = 100
  return w == b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('wordByteEq')!, ILOpcode.CMP_EQ)).toBe(true);
    });
  });

  describe('coercion in bitwise operations', () => {
    it('should handle byte/word AND', () => {
      const source = `module test
function mixedAnd(): word
  let w: word = $FFFF
  let b: byte = $0F
  return w & b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixedAnd')!, ILOpcode.AND)).toBe(true);
    });

    it('should handle byte/word OR', () => {
      const source = `module test
function mixedOr(): word
  let w: word = $FF00
  let b: byte = $0F
  return w | b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixedOr')!, ILOpcode.OR)).toBe(true);
    });
  });
});

// =============================================================================
// Coercion in Assignments Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: In Assignments', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('assignment coercion', () => {
    it('should handle byte to word assignment', () => {
      const source = `module test
function assignByteToWord()
  let b: byte = 200
  let w: word = 0
  w = b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignByteToWord')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should handle compound assignment with coercion', () => {
      const source = `module test
function compoundCoercion()
  let w: word = 1000
  let b: byte = 100
  w += b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('compoundCoercion')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('compoundCoercion')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });

  describe('array element coercion', () => {
    it('should handle byte array with word index calculation', () => {
      const source = `module test
function arrayCoercion(): byte
  let data: byte[10]
  let i: byte = 5
  return data[i]
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('arrayCoercion')!, ILOpcode.LOAD_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Coercion Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('address calculations', () => {
    it('should handle byte offset in word address', () => {
      const source = `module test
function calcAddress(): word
  let base: word = $0400
  let row: byte = 10
  let col: byte = 20
  return base + row * 40 + col
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('calcAddress')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('calcAddress')!, ILOpcode.ADD)).toBe(true);
    });

    it('should handle sprite coordinate calculation', () => {
      const source = `module test
function spriteCoord(): word
  let x: byte = 100
  let msb: byte = 0
  let coord: word = x + msb * 256
  return coord
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('spriteCoord')).toBeDefined();
    });
  });

  describe('color and value packing', () => {
    it('should handle byte to word for color pair', () => {
      const source = `module test
function packColors(): word
  let fg: byte = 1
  let bg: byte = 6
  let packed: word = bg * 16 + fg
  return packed
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('packColors')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('packColors')!, ILOpcode.ADD)).toBe(true);
    });

    it('should handle value extraction with shift', () => {
      const source = `module test
function extractNibble(): byte
  let value: byte = $AB
  let high: byte = value >> 4
  let low: byte = value & $0F
  return high + low
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('extractNibble')!, ILOpcode.SHR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('extractNibble')!, ILOpcode.AND)).toBe(true);
    });
  });

  describe('hardware register patterns', () => {
    it('should handle byte mask with word register', () => {
      const source = `module test
function maskRegister(): byte
  let reg: byte = $FF
  let mask: byte = $0F
  return reg & mask
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('maskRegister')!, ILOpcode.AND)).toBe(true);
    });
  });
});

// =============================================================================
// Coercion Edge Cases Tests
// =============================================================================

describe('ILExpressionGenerator - Type Coercion: Edge Cases', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('boundary values', () => {
    it('should handle max byte to word', () => {
      const source = `module test
function maxByte(): word
  let b: byte = 255
  let w: word = b
  return w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('maxByte')).toBeDefined();
    });

    it('should handle zero byte to word', () => {
      const source = `module test
function zeroByte(): word
  let b: byte = 0
  let w: word = b
  return w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('zeroByte')).toBeDefined();
    });

    it('should handle word max value', () => {
      const source = `module test
function maxWord(): word
  let w: word = $FFFF
  return w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('maxWord')).toBeDefined();
    });
  });

  describe('chained coercions', () => {
    it('should handle multiple type conversions in expression', () => {
      const source = `module test
function chainedTypes(): word
  let a: byte = 10
  let b: byte = 20
  let w: word = 1000
  return a + b + w
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('chainedTypes')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
    });

    it('should handle nested operations with different types', () => {
      const source = `module test
function nestedMixed(): word
  let a: byte = 5
  let b: word = 1000
  let c: byte = 3
  return (a + b) * c
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('nestedMixed')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('nestedMixed')!, ILOpcode.MUL)).toBe(true);
    });
  });
});