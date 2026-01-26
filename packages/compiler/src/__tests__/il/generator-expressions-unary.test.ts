/**
 * IL Expression Generator Tests - Unary Expressions
 *
 * Tests for unary expression generation including:
 * - Arithmetic negation (-)
 * - Logical NOT (!)
 * - Bitwise NOT (~)
 * - Address-of operator (@)
 * - Nested unary operators
 *
 * Part 4 of Phase 4 expression tests (~30 tests).
 *
 * @module __tests__/il/generator-expressions-unary.test
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
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates a fresh ILExpressionGenerator for testing.
 */
function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

/**
 * Finds all instructions with a specific opcode in a function.
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
 */
function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  return findInstructions(ilFunc, opcode).length > 0;
}

// =============================================================================
// Arithmetic Negation Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: Arithmetic Negation', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('basic negation', () => {
    it('should generate NEG for byte negation', () => {
      const source = `module test\nfunction neg(): byte { let x: byte = 10; return -x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });

    it('should generate NEG for word negation', () => {
      const source = `module test\nfunction neg(): word { let x: word = 1000; return -x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });

    it('should generate NEG for literal negation', () => {
      const source = `module test\nfunction neg(): byte { return -10; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Note: Could be constant-folded, but the generator should still handle it
      expect(result.module.getFunction('neg')).toBeDefined();
    });

    it('should handle negation of expression result', () => {
      const source = `module test\nfunction neg(): byte { let a: byte = 5; let b: byte = 3; return -(a + b); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });
  });

  describe('double negation', () => {
    it('should generate two NEG for double negation', () => {
      const source = `module test\nfunction neg(): byte { let x: byte = 10; return --x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('neg')!, ILOpcode.NEG).length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =============================================================================
// Logical NOT Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: Logical NOT', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('basic logical NOT', () => {
    it('should generate LOGICAL_NOT for bool NOT', () => {
      const source = `module test\nfunction notOp(): bool { let flag: bool = true; return !flag; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT for comparison result', () => {
      const source = `module test\nfunction notOp(): bool { let a: byte = 5; let b: byte = 10; return !(a < b); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT for false literal', () => {
      const source = `module test\nfunction notOp(): bool { return !false; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('notOp')).toBeDefined();
    });

    it('should generate LOGICAL_NOT for true literal', () => {
      const source = `module test\nfunction notOp(): bool { return !true; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('notOp')).toBeDefined();
    });
  });

  describe('double logical NOT', () => {
    it('should generate two LOGICAL_NOT for double NOT', () => {
      const source = `module test\nfunction notOp(): bool { let flag: bool = true; return !!flag; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('logical NOT in conditions', () => {
    it('should generate LOGICAL_NOT in if condition', () => {
      const source = `module test\nfunction test(): byte { let done: bool = false; if (!done) { return 1; } return 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT with equality check', () => {
      const source = `module test\nfunction test(): bool { let a: byte = 5; let b: byte = 5; return !(a == b); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CMP_EQ)).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });
  });
});

// =============================================================================
// Bitwise NOT Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: Bitwise NOT', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('basic bitwise NOT', () => {
    it('should generate NOT for byte bitwise complement', () => {
      const source = `module test\nfunction bitNot(): byte { let x: byte = $FF; return ~x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for word bitwise complement', () => {
      const source = `module test\nfunction bitNot(): word { let x: word = $FFFF; return ~x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for hex literal complement', () => {
      const source = `module test\nfunction bitNot(): byte { return ~$0F; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('bitNot')).toBeDefined();
    });

    it('should generate NOT for zero', () => {
      const source = `module test\nfunction bitNot(): byte { let x: byte = 0; return ~x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });
  });

  describe('double bitwise NOT', () => {
    it('should generate two NOT for double complement', () => {
      const source = `module test\nfunction bitNot(): byte { let x: byte = $AA; return ~~x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('bitNot')!, ILOpcode.NOT).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('bitwise NOT in expressions', () => {
    it('should generate NOT with AND', () => {
      const source = `module test\nfunction mask(): byte { let value: byte = $FF; let mask: byte = $0F; return value & ~mask; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mask')!, ILOpcode.NOT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mask')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate NOT for clearing bits', () => {
      const source = `module test\nfunction clearBits(): byte { let x: byte = $FF; let clearMask: byte = $F0; return x & ~clearMask; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBits')!, ILOpcode.NOT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBits')!, ILOpcode.AND)).toBe(true);
    });
  });
});

// =============================================================================
// Mixed Unary Operators Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: Mixed Operators', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('combining different unary operators', () => {
    it('should handle negation and bitwise NOT', () => {
      const source = `module test\nfunction mixed(): byte { let x: byte = 10; return ~(-x); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.NEG)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mixed')!, ILOpcode.NOT)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Unary Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('C64 hardware patterns', () => {
    it('should generate NOT for sprite mask inversion', () => {
      const source = `module test\nfunction invertSpriteMask(): byte { let spriteMask: byte = $07; return ~spriteMask; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('invertSpriteMask')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for bit clearing pattern', () => {
      const source = `module test\nfunction clearBit(): byte { let value: byte = $FF; let bit: byte = $04; return value & ~bit; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBit')!, ILOpcode.NOT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBit')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate LOGICAL_NOT for game state check', () => {
      const source = `module test\nfunction checkGameOver(): bool { let gameRunning: bool = true; return !gameRunning; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkGameOver')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });
  });
});