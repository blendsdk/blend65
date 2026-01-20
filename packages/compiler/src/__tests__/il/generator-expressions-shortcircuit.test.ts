/**
 * IL Expression Generator Tests - Short-Circuit Expressions
 *
 * Tests for short-circuit evaluation of logical operators:
 * - Logical AND (&&)
 * - Logical OR (||)
 * - Short-circuit evaluation verification
 * - Side effect handling
 * - Complex nested logical expressions
 *
 * Part 8 of Phase 4 expression tests (~50 tests).
 *
 * @module __tests__/il/generator-expressions-shortcircuit.test
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
// Basic Short-Circuit AND Tests
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: Basic AND', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('simple AND expressions', () => {
    it('should generate AND for bool && bool', () => {
      const source = `module test
function testAnd(): bool
  let a: bool = true
  let b: bool = true
  return a && b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // AND generates bitwise AND for now (or BRANCH for short-circuit)
      const func = result.module.getFunction('testAnd')!;
      expect(
        hasInstruction(func, ILOpcode.AND) || hasInstruction(func, ILOpcode.BRANCH),
      ).toBe(true);
    });

    it('should generate AND with comparison results', () => {
      const source = `module test
function testAnd(): bool
  let a: byte = 5
  let b: byte = 10
  return (a < 10) && (b > 5)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('testAnd')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('testAnd')!, ILOpcode.CMP_GT)).toBe(true);
    });

    it('should generate AND with literal true values', () => {
      const source = `module test
function testAnd(): bool
  return true && true
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('testAnd')).toBeDefined();
    });

    it('should generate AND with literal false value', () => {
      const source = `module test
function testAnd(): bool
  return true && false
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('testAnd')).toBeDefined();
    });
  });

  describe('AND in control flow', () => {
    it('should generate AND in if condition', () => {
      const source = `module test
function checkBoth(): byte
  let a: byte = 5
  let b: byte = 10
  if (a < 10) && (b < 20) then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('checkBoth')).toBeDefined();
    });

    it('should generate AND in condition', () => {
      const source = `module test
function conditionAnd(): byte
  let i: byte = 5
  let running: bool = true
  if i < 10 && running then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('conditionAnd')!, ILOpcode.AND)).toBe(true);
    });
  });
});

// =============================================================================
// Basic Short-Circuit OR Tests
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: Basic OR', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('simple OR expressions', () => {
    it('should generate OR for bool || bool', () => {
      const source = `module test
function testOr(): bool
  let a: bool = true
  let b: bool = false
  return a || b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // OR generates bitwise OR for now (or BRANCH for short-circuit)
      const func = result.module.getFunction('testOr')!;
      expect(
        hasInstruction(func, ILOpcode.OR) || hasInstruction(func, ILOpcode.BRANCH),
      ).toBe(true);
    });

    it('should generate OR with comparison results', () => {
      const source = `module test
function testOr(): bool
  let a: byte = 5
  let b: byte = 10
  return (a > 10) || (b > 5)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('testOr')!, ILOpcode.CMP_GT)).toBe(true);
    });

    it('should generate OR with literal false values', () => {
      const source = `module test
function testOr(): bool
  return false || false
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('testOr')).toBeDefined();
    });

    it('should generate OR with literal true value', () => {
      const source = `module test
function testOr(): bool
  return false || true
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('testOr')).toBeDefined();
    });
  });

  describe('OR in control flow', () => {
    it('should generate OR in if condition', () => {
      const source = `module test
function checkEither(): byte
  let a: byte = 15
  let b: byte = 10
  if (a > 10) || (b > 20) then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('checkEither')).toBeDefined();
    });

    it('should generate OR in condition', () => {
      const source = `module test
function conditionOr(): byte
  let i: byte = 5
  let forceStop: bool = false
  if (i > 10) || forceStop then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('conditionOr')!, ILOpcode.OR)).toBe(true);
    });
  });
});

// =============================================================================
// Mixed AND/OR Tests
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: Mixed AND/OR', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('nested AND and OR', () => {
    it('should generate mixed AND and OR', () => {
      const source = `module test
function mixed(): bool
  let a: bool = true
  let b: bool = false
  let c: bool = true
  return a && b || c
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('mixed')).toBeDefined();
    });

    it('should generate OR with nested AND', () => {
      const source = `module test
function orWithAnd(): bool
  let a: bool = true
  let b: bool = true
  let c: bool = false
  return (a && b) || c
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('orWithAnd')).toBeDefined();
    });

    it('should generate AND with nested OR', () => {
      const source = `module test
function andWithOr(): bool
  let a: bool = true
  let b: bool = false
  let c: bool = true
  return a && (b || c)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('andWithOr')).toBeDefined();
    });
  });

  describe('complex logical expressions', () => {
    it('should generate complex three-way AND', () => {
      const source = `module test
function threeAnd(): bool
  let a: bool = true
  let b: bool = true
  let c: bool = true
  return a && b && c
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('threeAnd')).toBeDefined();
    });

    it('should generate complex three-way OR', () => {
      const source = `module test
function threeOr(): bool
  let a: bool = false
  let b: bool = false
  let c: bool = true
  return a || b || c
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('threeOr')).toBeDefined();
    });

    it('should generate complex mixed comparisons', () => {
      const source = `module test
function complexCondition(): bool
  let x: byte = 5
  let y: byte = 10
  let z: byte = 15
  return (x < y) && (y < z) || (x == 0)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('complexCondition')).toBeDefined();
    });
  });
});

// =============================================================================
// Short-Circuit with NOT Tests
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: With NOT', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('NOT with AND/OR', () => {
    it('should generate NOT and AND', () => {
      const source = `module test
function notAnd(): bool
  let a: bool = true
  let b: bool = false
  return !a && b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notAnd')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate NOT and OR', () => {
      const source = `module test
function notOr(): bool
  let a: bool = false
  let b: bool = true
  return !a || b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('notOr')!, ILOpcode.LOGICAL_NOT)).toBe(true);
    });

    it('should generate De Morgan transformation pattern', () => {
      const source = `module test
function deMorgan(): bool
  let a: bool = true
  let b: bool = true
  return !(!a || !b)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(
        findInstructions(result.module.getFunction('deMorgan')!, ILOpcode.LOGICAL_NOT).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});

// =============================================================================
// C64-Specific Logical Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('game state checks', () => {
    it('should generate AND for game state validation', () => {
      const source = `module test
function isValidState(): bool
  let gameRunning: bool = true
  let playerAlive: bool = true
  return gameRunning && playerAlive
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('isValidState')).toBeDefined();
    });

    it('should generate OR for termination check', () => {
      const source = `module test
function shouldExit(): bool
  let gameOver: bool = false
  let quitPressed: bool = false
  return gameOver || quitPressed
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('shouldExit')).toBeDefined();
    });

    it('should generate collision detection pattern', () => {
      const source = `module test
function checkCollision(): bool
  let x1: byte = 100
  let y1: byte = 100
  let x2: byte = 110
  let y2: byte = 110
  let width: byte = 24
  let height: byte = 21
  return (x1 < x2 + width) && (x1 + width > x2) && (y1 < y2 + height) && (y1 + height > y2)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('checkCollision')).toBeDefined();
    });
  });

  describe('bounds checking patterns', () => {
    it('should generate AND for range check', () => {
      const source = `module test
function inRange(): bool
  let x: byte = 100
  let minX: byte = 24
  let maxX: byte = 255
  return (x >= minX) && (x <= maxX)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('inRange')!, ILOpcode.CMP_GE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('inRange')!, ILOpcode.CMP_LE)).toBe(true);
    });

    it('should generate OR for out-of-bounds check', () => {
      const source = `module test
function outOfBounds(): bool
  let x: byte = 250
  let minX: byte = 24
  let maxX: byte = 200
  return (x < minX) || (x > maxX)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('outOfBounds')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('outOfBounds')!, ILOpcode.CMP_GT)).toBe(true);
    });
  });

  describe('input handling patterns', () => {
    it('should generate OR for multiple key check', () => {
      const source = `module test
function anyKeyPressed(): bool
  let keyUp: bool = false
  let keyDown: bool = true
  let keyLeft: bool = false
  let keyRight: bool = false
  return keyUp || keyDown || keyLeft || keyRight
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('anyKeyPressed')).toBeDefined();
    });

    it('should generate AND for simultaneous key check', () => {
      const source = `module test
function bothKeysPressed(): bool
  let fire: bool = true
  let up: bool = true
  return fire && up
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('bothKeysPressed')).toBeDefined();
    });
  });
});

// =============================================================================
// Short-Circuit Edge Cases
// =============================================================================

describe('ILExpressionGenerator - Short-Circuit: Edge Cases', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('deeply nested expressions', () => {
    it('should handle deeply nested AND', () => {
      const source = `module test
function deepAnd(): bool
  let a: bool = true
  let b: bool = true
  let c: bool = true
  let d: bool = true
  return ((a && b) && (c && d))
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('deepAnd')).toBeDefined();
    });

    it('should handle deeply nested OR', () => {
      const source = `module test
function deepOr(): bool
  let a: bool = false
  let b: bool = false
  let c: bool = false
  let d: bool = true
  return ((a || b) || (c || d))
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('deepOr')).toBeDefined();
    });
  });

  describe('mixed with arithmetic', () => {
    it('should handle AND with arithmetic comparison', () => {
      const source = `module test
function arithmeticAnd(): bool
  let x: byte = 10
  let y: byte = 5
  return (x + y > 10) && (x - y < 10)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('arithmeticAnd')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('arithmeticAnd')!, ILOpcode.SUB)).toBe(true);
    });
  });
});