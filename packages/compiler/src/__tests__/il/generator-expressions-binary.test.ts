/**
 * IL Expression Generator Tests - Binary Expressions
 *
 * Tests for binary expression generation including:
 * - Arithmetic operations (+, -, *, /, %)
 * - Comparison operations (==, !=, <, <=, >, >=)
 * - Bitwise operations (&, |, ^, <<, >>)
 * - Complex nested expressions
 *
 * Part 3 of Phase 4 expression tests (~70 tests).
 *
 * @module __tests__/il/generator-expressions-binary.test
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

function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

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

function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  return findInstructions(ilFunc, opcode).length > 0;
}

// =============================================================================
// Arithmetic Operations
// =============================================================================

describe('ILExpressionGenerator - Binary Expressions: Arithmetic', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('addition', () => {
    it('should generate ADD for byte + byte', () => {
      const source = `module test\nfunction add(): byte\nlet a: byte = 5\nlet b: byte = 10\nreturn a + b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate ADD for word + word', () => {
      const source = `module test\nfunction add(): word\nlet a: word = 1000\nlet b: word = 2000\nreturn a + b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate ADD for literal + literal', () => {
      const source = `module test\nfunction add(): byte\nreturn 5 + 10\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('subtraction', () => {
    it('should generate SUB for byte - byte', () => {
      const source = `module test\nfunction sub(): byte\nlet a: byte = 20\nlet b: byte = 5\nreturn a - b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('sub')!, ILOpcode.SUB)).toBe(true);
    });

    it('should generate SUB for word - word', () => {
      const source = `module test\nfunction sub(): word\nlet a: word = 5000\nlet b: word = 2000\nreturn a - b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('sub')!, ILOpcode.SUB)).toBe(true);
    });
  });

  describe('multiplication', () => {
    it('should generate MUL for byte * byte', () => {
      const source = `module test\nfunction mul(): byte\nlet a: byte = 5\nlet b: byte = 10\nreturn a * b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mul')!, ILOpcode.MUL)).toBe(true);
    });

    it('should generate MUL for word * word', () => {
      const source = `module test\nfunction mul(): word\nlet a: word = 100\nlet b: word = 200\nreturn a * b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mul')!, ILOpcode.MUL)).toBe(true);
    });
  });

  describe('division', () => {
    it('should generate DIV for byte / byte', () => {
      const source = `module test\nfunction div(): byte\nlet a: byte = 100\nlet b: byte = 10\nreturn a / b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('div')!, ILOpcode.DIV)).toBe(true);
    });

    it('should generate DIV for word / word', () => {
      const source = `module test\nfunction div(): word\nlet a: word = 1000\nlet b: word = 100\nreturn a / b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('div')!, ILOpcode.DIV)).toBe(true);
    });
  });

  describe('modulo', () => {
    it('should generate MOD for byte % byte', () => {
      const source = `module test\nfunction mod(): byte\nlet a: byte = 17\nlet b: byte = 5\nreturn a % b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mod')!, ILOpcode.MOD)).toBe(true);
    });

    it('should generate MOD for word % word', () => {
      const source = `module test\nfunction mod(): word\nlet a: word = 1000\nlet b: word = 300\nreturn a % b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mod')!, ILOpcode.MOD)).toBe(true);
    });
  });

  describe('chained arithmetic', () => {
    it('should generate multiple ADD for a + b + c', () => {
      const source = `module test\nfunction chain(): byte\nlet a: byte = 1\nlet b: byte = 2\nlet c: byte = 3\nreturn a + b + c\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('chain')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
    });

    it('should generate MUL and ADD for a + b * c', () => {
      const source = `module test\nfunction mixed(): byte\nlet a: byte = 10\nlet b: byte = 2\nlet c: byte = 3\nreturn a + b * c\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.ADD)).toBe(true);
    });
  });
});

// =============================================================================
// Comparison Operations
// =============================================================================

describe('ILExpressionGenerator - Binary Expressions: Comparison', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('equal', () => {
    it('should generate CMP_EQ for byte == byte', () => {
      const source = `module test\nfunction eq(): bool\nlet a: byte = 5\nlet b: byte = 5\nreturn a == b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('eq')!, ILOpcode.CMP_EQ)).toBe(true);
    });

    it('should generate CMP_EQ for word == word', () => {
      const source = `module test\nfunction eq(): bool\nlet a: word = 1000\nlet b: word = 1000\nreturn a == b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('eq')!, ILOpcode.CMP_EQ)).toBe(true);
    });
  });

  describe('not equal', () => {
    it('should generate CMP_NE for byte != byte', () => {
      const source = `module test\nfunction ne(): bool\nlet a: byte = 5\nlet b: byte = 10\nreturn a != b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('ne')!, ILOpcode.CMP_NE)).toBe(true);
    });
  });

  describe('less than', () => {
    it('should generate CMP_LT for byte < byte', () => {
      const source = `module test\nfunction lt(): bool\nlet a: byte = 5\nlet b: byte = 10\nreturn a < b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('lt')!, ILOpcode.CMP_LT)).toBe(true);
    });
  });

  describe('less than or equal', () => {
    it('should generate CMP_LE for byte <= byte', () => {
      const source = `module test\nfunction le(): bool\nlet a: byte = 5\nlet b: byte = 10\nreturn a <= b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('le')!, ILOpcode.CMP_LE)).toBe(true);
    });
  });

  describe('greater than', () => {
    it('should generate CMP_GT for byte > byte', () => {
      const source = `module test\nfunction gt(): bool\nlet a: byte = 10\nlet b: byte = 5\nreturn a > b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('gt')!, ILOpcode.CMP_GT)).toBe(true);
    });
  });

  describe('greater than or equal', () => {
    it('should generate CMP_GE for byte >= byte', () => {
      const source = `module test\nfunction ge(): bool\nlet a: byte = 10\nlet b: byte = 10\nreturn a >= b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('ge')!, ILOpcode.CMP_GE)).toBe(true);
    });
  });

  describe('comparison in control flow', () => {
    it('should generate comparison for if condition', () => {
      const source = `module test\nfunction test(): byte\nlet x: byte = 5\nif x < 10 then\nreturn 1\nend if\nreturn 0\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CMP_LT)).toBe(true);
    });
  });
});

// =============================================================================
// Bitwise Operations
// =============================================================================

describe('ILExpressionGenerator - Binary Expressions: Bitwise', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('bitwise AND', () => {
    it('should generate AND for byte & byte', () => {
      const source = `module test\nfunction bitAnd(): byte\nlet a: byte = $FF\nlet b: byte = $0F\nreturn a & b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitAnd')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate AND for word & word', () => {
      const source = `module test\nfunction bitAnd(): word\nlet a: word = $FFFF\nlet b: word = $00FF\nreturn a & b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitAnd')!, ILOpcode.AND)).toBe(true);
    });
  });

  describe('bitwise OR', () => {
    it('should generate OR for byte | byte', () => {
      const source = `module test\nfunction bitOr(): byte\nlet a: byte = $F0\nlet b: byte = $0F\nreturn a | b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitOr')!, ILOpcode.OR)).toBe(true);
    });

    it('should generate OR for word | word', () => {
      const source = `module test\nfunction bitOr(): word\nlet a: word = $FF00\nlet b: word = $00FF\nreturn a | b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitOr')!, ILOpcode.OR)).toBe(true);
    });
  });

  describe('bitwise XOR', () => {
    it('should generate XOR for byte ^ byte', () => {
      const source = `module test\nfunction bitXor(): byte\nlet a: byte = $AA\nlet b: byte = $55\nreturn a ^ b\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitXor')!, ILOpcode.XOR)).toBe(true);
    });
  });

  describe('left shift', () => {
    it('should generate SHL for byte << literal', () => {
      const source = `module test\nfunction shl(): byte\nlet x: byte = 1\nreturn x << 4\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shl')!, ILOpcode.SHL)).toBe(true);
    });

    it('should generate SHL for word << literal', () => {
      const source = `module test\nfunction shl(): word\nlet x: word = 1\nreturn x << 8\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shl')!, ILOpcode.SHL)).toBe(true);
    });
  });

  describe('right shift', () => {
    it('should generate SHR for byte >> literal', () => {
      const source = `module test\nfunction shr(): byte\nlet x: byte = $80\nreturn x >> 4\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shr')!, ILOpcode.SHR)).toBe(true);
    });

    it('should generate SHR for word >> literal', () => {
      const source = `module test\nfunction shr(): word\nlet x: word = $FF00\nreturn x >> 8\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shr')!, ILOpcode.SHR)).toBe(true);
    });
  });

  describe('chained bitwise', () => {
    it('should generate chained AND and OR', () => {
      const source = `module test\nfunction chain(): byte\nlet a: byte = $FF\nlet b: byte = $0F\nlet c: byte = $F0\nreturn a & b | c\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('chain')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('chain')!, ILOpcode.OR)).toBe(true);
    });
  });
});

// =============================================================================
// Complex Expressions
// =============================================================================

describe('ILExpressionGenerator - Binary Expressions: Complex', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('mixed arithmetic and comparison', () => {
    it('should generate ADD and CMP_GT', () => {
      const source = `module test\nfunction mixed(): bool\nlet a: byte = 5\nlet b: byte = 10\nreturn a + b > 10\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.CMP_GT)).toBe(true);
    });

    it('should generate complex arithmetic', () => {
      const source = `module test\nfunction complex(): byte\nlet a: byte = 10\nlet b: byte = 2\nlet c: byte = 3\nlet d: byte = 4\nreturn a * b + c * d\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('complex')!, ILOpcode.MUL).length).toBeGreaterThanOrEqual(2);
      expect(hasInstruction(result.module.getFunction('complex')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('parenthesized expressions', () => {
    it('should respect parentheses in arithmetic', () => {
      const source = `module test\nfunction paren(): byte\nlet a: byte = 2\nlet b: byte = 3\nlet c: byte = 4\nreturn a * (b + c)\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.MUL)).toBe(true);
    });

    it('should respect parentheses in comparison', () => {
      const source = `module test\nfunction paren(): bool\nlet a: byte = 5\nlet b: byte = 10\nlet c: byte = 15\nreturn (a + b) == c\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.CMP_EQ)).toBe(true);
    });
  });

  describe('C64-specific patterns', () => {
    it('should generate sprite position calculation', () => {
      const source = `module test\nfunction spritePos(): word\nlet baseX: byte = 100\nlet spriteNum: byte = 2\nreturn baseX + spriteNum * 24\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('spritePos')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('spritePos')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate screen address calculation', () => {
      const source = `module test\nfunction screenAddr(): word\nlet row: byte = 10\nlet col: byte = 20\nreturn $0400 + row * 40 + col\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('screenAddr')!, ILOpcode.MUL)).toBe(true);
      expect(findInstructions(result.module.getFunction('screenAddr')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
    });

    it('should generate color masking operation', () => {
      const source = `module test\nfunction colorMask(): byte\nlet color: byte = $1F\nreturn color & $0F\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('colorMask')!, ILOpcode.AND)).toBe(true);
    });
  });
});