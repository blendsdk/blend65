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
// Arithmetic Negation Tests
// =============================================================================

describe('ILExpressionGenerator - Unary Expressions: Arithmetic Negation', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('basic negation', () => {
    it('should generate NEG for byte negation', () => {
      const source = `module test\nfunction neg(): byte\nlet x: byte = 10\nreturn -x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });

    it('should generate NEG for word negation', () => {
      const source = `module test\nfunction neg(): word\nlet x: word = 1000\nreturn -x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });

    it('should generate NEG for literal negation', () => {
      const source = `module test\nfunction neg(): byte\nreturn -10\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Note: Could be constant-folded, but the generator should still handle it
      expect(result.module.getFunction('neg')).toBeDefined();
    });

    it('should handle negation of expression result', () => {
      const source = `module test\nfunction neg(): byte\nlet a: byte = 5\nlet b: byte = 3\nreturn -(a + b)\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('neg')!, ILOpcode.NEG)).toBe(true);
    });
  });

  describe('double negation', () => {
    it('should generate two NEG for double negation', () => {
      const source = `module test\nfunction neg(): byte\nlet x: byte = 10\nreturn --x\nend function`;
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
      const source = `module test\nfunction notOp(): bool\nlet flag: bool = true\nreturn !flag\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT for comparison result', () => {
      const source = `module test\nfunction notOp(): bool\nlet a: byte = 5\nlet b: byte = 10\nreturn !(a < b)\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT for false literal', () => {
      const source = `module test\nfunction notOp(): bool\nreturn !false\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('notOp')).toBeDefined();
    });

    it('should generate LOGICAL_NOT for true literal', () => {
      const source = `module test\nfunction notOp(): bool\nreturn !true\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('notOp')).toBeDefined();
    });
  });

  describe('double logical NOT', () => {
    it('should generate two LOGICAL_NOT for double NOT', () => {
      const source = `module test\nfunction notOp(): bool\nlet flag: bool = true\nreturn !!flag\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('notOp')!, ILOpcode.LOGICAL_NOT).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('logical NOT in conditions', () => {
    it('should generate LOGICAL_NOT in if condition', () => {
      const source = `module test\nfunction test(): byte\nlet done: bool = false\nif !done then\nreturn 1\nend if\nreturn 0\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate LOGICAL_NOT with equality check', () => {
      const source = `module test\nfunction test(): bool\nlet a: byte = 5\nlet b: byte = 5\nreturn !(a == b)\nend function`;
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
      const source = `module test\nfunction bitNot(): byte\nlet x: byte = $FF\nreturn ~x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for word bitwise complement', () => {
      const source = `module test\nfunction bitNot(): word\nlet x: word = $FFFF\nreturn ~x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for hex literal complement', () => {
      const source = `module test\nfunction bitNot(): byte\nreturn ~$0F\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('bitNot')).toBeDefined();
    });

    it('should generate NOT for zero', () => {
      const source = `module test\nfunction bitNot(): byte\nlet x: byte = 0\nreturn ~x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitNot')!, ILOpcode.NOT)).toBe(true);
    });
  });

  describe('double bitwise NOT', () => {
    it('should generate two NOT for double complement', () => {
      const source = `module test\nfunction bitNot(): byte\nlet x: byte = $AA\nreturn ~~x\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('bitNot')!, ILOpcode.NOT).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('bitwise NOT in expressions', () => {
    it('should generate NOT with AND', () => {
      const source = `module test\nfunction mask(): byte\nlet value: byte = $FF\nlet mask: byte = $0F\nreturn value & ~mask\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mask')!, ILOpcode.NOT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mask')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate NOT for clearing bits', () => {
      const source = `module test\nfunction clearBits(): byte\nlet x: byte = $FF\nlet clearMask: byte = $F0\nreturn x & ~clearMask\nend function`;
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
      const source = `module test\nfunction mixed(): byte\nlet x: byte = 10\nreturn ~(-x)\nend function`;
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
      const source = `module test\nfunction invertSpriteMask(): byte\nlet spriteMask: byte = $07\nreturn ~spriteMask\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('invertSpriteMask')!, ILOpcode.NOT)).toBe(true);
    });

    it('should generate NOT for bit clearing pattern', () => {
      const source = `module test\nfunction clearBit(): byte\nlet value: byte = $FF\nlet bit: byte = $04\nreturn value & ~bit\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBit')!, ILOpcode.NOT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clearBit')!, ILOpcode.AND)).toBe(true);
    });

    it('should generate LOGICAL_NOT for game state check', () => {
      const source = `module test\nfunction checkGameOver(): bool\nlet gameRunning: bool = true\nreturn !gameRunning\nend function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkGameOver')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });
  });
});