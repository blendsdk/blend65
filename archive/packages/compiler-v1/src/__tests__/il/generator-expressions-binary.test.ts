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
      const source = `module test\nfunction add(): byte { let a: byte = 5; let b: byte = 10; return a + b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate ADD for word + word', () => {
      const source = `module test\nfunction add(): word { let a: word = 1000; let b: word = 2000; return a + b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate ADD for literal + literal', () => {
      const source = `module test\nfunction add(): byte { return 5 + 10; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('add')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('subtraction', () => {
    it('should generate SUB for byte - byte', () => {
      const source = `module test\nfunction sub(): byte { let a: byte = 20; let b: byte = 5; return a - b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('sub')!, ILOpcode.SUB)).toBe(true);
    });

    it('should generate SUB for word - word', () => {
      const source = `module test\nfunction sub(): word { let a: word = 5000; let b: word = 2000; return a - b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('sub')!, ILOpcode.SUB)).toBe(true);
    });
  });

  describe('multiplication', () => {
    it('should generate MUL for byte * byte', () => {
      const source = `module test\nfunction mul(): byte { let a: byte = 5; let b: byte = 10; return a * b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mul')!, ILOpcode.MUL)).toBe(true);
    });

    it('should generate MUL for word * word', () => {
      const source = `module test\nfunction mul(): word { let a: word = 100; let b: word = 200; return a * b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mul')!, ILOpcode.MUL)).toBe(true);
    });
  });

  describe('division', () => {
    it('should generate DIV for byte / byte', () => {
      const source = `module test\nfunction div(): byte { let a: byte = 100; let b: byte = 10; return a / b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('div')!, ILOpcode.DIV)).toBe(true);
    });

    it('should generate DIV for word / word', () => {
      const source = `module test\nfunction div(): word { let a: word = 1000; let b: word = 100; return a / b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('div')!, ILOpcode.DIV)).toBe(true);
    });
  });

  describe('modulo', () => {
    it('should generate MOD for byte % byte', () => {
      const source = `module test\nfunction mod(): byte { let a: byte = 17; let b: byte = 5; return a % b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mod')!, ILOpcode.MOD)).toBe(true);
    });

    it('should generate MOD for word % word', () => {
      const source = `module test\nfunction mod(): word { let a: word = 1000; let b: word = 300; return a % b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mod')!, ILOpcode.MOD)).toBe(true);
    });
  });

  describe('chained arithmetic', () => {
    it('should generate multiple ADD for a + b + c', () => {
      const source = `module test\nfunction chain(): byte { let a: byte = 1; let b: byte = 2; let c: byte = 3; return a + b + c; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('chain')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
    });

    it('should generate MUL and ADD for a + b * c', () => {
      const source = `module test\nfunction mixed(): byte { let a: byte = 10; let b: byte = 2; let c: byte = 3; return a + b * c; }`;
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
      const source = `module test\nfunction eq(): bool { let a: byte = 5; let b: byte = 5; return a == b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('eq')!, ILOpcode.CMP_EQ)).toBe(true);
    });

    it('should generate CMP_EQ for word == word', () => {
      const source = `module test\nfunction eq(): bool { let a: word = 1000; let b: word = 1000; return a == b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('eq')!, ILOpcode.CMP_EQ)).toBe(true);
    });
  });

  describe('not equal', () => {
    it('should generate CMP_NE for byte != byte', () => {
      const source = `module test\nfunction ne(): bool { let a: byte = 5; let b: byte = 10; return a != b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('ne')!, ILOpcode.CMP_NE)).toBe(true);
    });
  });

  describe('less than', () => {
    it('should generate CMP_LT for byte < byte', () => {
      const source = `module test\nfunction lt(): bool { let a: byte = 5; let b: byte = 10; return a < b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('lt')!, ILOpcode.CMP_LT)).toBe(true);
    });
  });

  describe('less than or equal', () => {
    it('should generate CMP_LE for byte <= byte', () => {
      const source = `module test\nfunction le(): bool { let a: byte = 5; let b: byte = 10; return a <= b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('le')!, ILOpcode.CMP_LE)).toBe(true);
    });
  });

  describe('greater than', () => {
    it('should generate CMP_GT for byte > byte', () => {
      const source = `module test\nfunction gt(): bool { let a: byte = 10; let b: byte = 5; return a > b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('gt')!, ILOpcode.CMP_GT)).toBe(true);
    });
  });

  describe('greater than or equal', () => {
    it('should generate CMP_GE for byte >= byte', () => {
      const source = `module test\nfunction ge(): bool { let a: byte = 10; let b: byte = 10; return a >= b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('ge')!, ILOpcode.CMP_GE)).toBe(true);
    });
  });

  describe('comparison in control flow', () => {
    it('should generate comparison for if condition', () => {
      const source = `module test\nfunction test(): byte { let x: byte = 5; if (x < 10) { return 1; } return 0; }`;
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
      const source = `module test\nfunction bitAnd(): byte { let a: byte = $FF; let b: byte = $0F; return a & b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitAnd')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate AND for word & word', () => {
      const source = `module test\nfunction bitAnd(): word { let a: word = $FFFF; let b: word = $00FF; return a & b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitAnd')!, ILOpcode.AND)).toBe(true);
    });
  });

  describe('bitwise OR', () => {
    it('should generate OR for byte | byte', () => {
      const source = `module test\nfunction bitOr(): byte { let a: byte = $F0; let b: byte = $0F; return a | b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitOr')!, ILOpcode.OR)).toBe(true);
    });

    it('should generate OR for word | word', () => {
      const source = `module test\nfunction bitOr(): word { let a: word = $FF00; let b: word = $00FF; return a | b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitOr')!, ILOpcode.OR)).toBe(true);
    });
  });

  describe('bitwise XOR', () => {
    it('should generate XOR for byte ^ byte', () => {
      const source = `module test\nfunction bitXor(): byte { let a: byte = $AA; let b: byte = $55; return a ^ b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitXor')!, ILOpcode.XOR)).toBe(true);
    });
  });

  describe('left shift', () => {
    it('should generate SHL for byte << literal', () => {
      const source = `module test\nfunction shl(): byte { let x: byte = 1; return x << 4; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shl')!, ILOpcode.SHL)).toBe(true);
    });

    it('should generate SHL for word << literal', () => {
      const source = `module test\nfunction shl(): word { let x: word = 1; return x << 8; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shl')!, ILOpcode.SHL)).toBe(true);
    });
  });

  describe('right shift', () => {
    it('should generate SHR for byte >> literal', () => {
      const source = `module test\nfunction shr(): byte { let x: byte = $80; return x >> 4; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shr')!, ILOpcode.SHR)).toBe(true);
    });

    it('should generate SHR for word >> literal', () => {
      const source = `module test\nfunction shr(): word { let x: word = $FF00; return x >> 8; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shr')!, ILOpcode.SHR)).toBe(true);
    });
  });

  describe('chained bitwise', () => {
    it('should generate chained AND and OR', () => {
      const source = `module test\nfunction chain(): byte { let a: byte = $FF; let b: byte = $0F; let c: byte = $F0; return a & b | c; }`;
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
      const source = `module test\nfunction mixed(): bool { let a: byte = 5; let b: byte = 10; return a + b > 10; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.CMP_GT)).toBe(true);
    });

    it('should generate complex arithmetic', () => {
      const source = `module test\nfunction complex(): byte { let a: byte = 10; let b: byte = 2; let c: byte = 3; let d: byte = 4; return a * b + c * d; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('complex')!, ILOpcode.MUL).length).toBeGreaterThanOrEqual(2);
      expect(hasInstruction(result.module.getFunction('complex')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('parenthesized expressions', () => {
    it('should respect parentheses in arithmetic', () => {
      const source = `module test\nfunction paren(): byte { let a: byte = 2; let b: byte = 3; let c: byte = 4; return a * (b + c); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.MUL)).toBe(true);
    });

    it('should respect parentheses in comparison', () => {
      const source = `module test\nfunction paren(): bool { let a: byte = 5; let b: byte = 10; let c: byte = 15; return (a + b) == c; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('paren')!, ILOpcode.CMP_EQ)).toBe(true);
    });
  });

  describe('C64-specific patterns', () => {
    it('should generate sprite position calculation', () => {
      const source = `module test\nfunction spritePos(): word { let baseX: byte = 100; let spriteNum: byte = 2; return baseX + spriteNum * 24; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('spritePos')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('spritePos')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate screen address calculation', () => {
      const source = `module test\nfunction screenAddr(): word { let row: byte = 10; let col: byte = 20; return $0400 + row * 40 + col; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('screenAddr')!, ILOpcode.MUL)).toBe(true);
      expect(findInstructions(result.module.getFunction('screenAddr')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
    });

    it('should generate color masking operation', () => {
      const source = `module test\nfunction colorMask(): byte { let color: byte = $1F; return color & $0F; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('colorMask')!, ILOpcode.AND)).toBe(true);
    });
  });
});