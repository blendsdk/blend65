/**
 * IL Expression Generator Tests - Assignment Expressions
 *
 * Tests for assignment expression generation including:
 * - Simple variable assignment
 * - Compound assignments (+=, -=, *=, /=, etc.)
 * - Array element assignment
 * - Assignment in expressions
 *
 * Part 7 of Phase 4 expression tests (~40 tests).
 *
 * @module __tests__/il/generator-expressions-assignment.test
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
// Simple Assignment Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: Simple Assignment', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('variable assignment with literal', () => {
    it('should generate STORE_VAR for byte literal assignment', () => {
      const source = `module test
function assign() {
  let x: byte = 0;
  x = 10;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate STORE_VAR for word literal assignment', () => {
      const source = `module test
function assign() {
  let addr: word = 0;
  addr = $1000;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate STORE_VAR for bool literal assignment', () => {
      const source = `module test
function assign() {
  let flag: bool = false;
  flag = true;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });

  describe('variable assignment with expression', () => {
    it('should generate ADD and STORE_VAR for expression assignment', () => {
      const source = `module test
function assign() {
  let x: byte = 0;
  let a: byte = 5;
  let b: byte = 10;
  x = a + b;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate MUL and STORE_VAR for multiplication result', () => {
      const source = `module test
function assign() {
  let result: byte = 0;
  let factor: byte = 5;
  result = factor * 3;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('assign')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });

  describe('variable assignment from other variable', () => {
    it('should generate LOAD_VAR and STORE_VAR for variable copy', () => {
      const source = `module test
function copy() {
  let x: byte = 10;
  let y: byte = 0;
  y = x;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('copy')!, ILOpcode.LOAD_VAR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('copy')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });
});

// =============================================================================
// Compound Assignment Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: Compound Assignment', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('arithmetic compound assignments', () => {
    it('should generate ADD and STORE_VAR for += assignment', () => {
      const source = `module test
function addAssign() {
  let x: byte = 10;
  x += 5;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('addAssign')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('addAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate SUB and STORE_VAR for -= assignment', () => {
      const source = `module test
function subAssign() {
  let x: byte = 10;
  x -= 3;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('subAssign')!, ILOpcode.SUB)).toBe(true);
      expect(hasInstruction(result.module.getFunction('subAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate MUL and STORE_VAR for *= assignment', () => {
      const source = `module test
function mulAssign() {
  let x: byte = 5;
  x *= 2;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('mulAssign')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('mulAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate DIV and STORE_VAR for /= assignment', () => {
      const source = `module test
function divAssign() {
  let x: byte = 100;
  x /= 10;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('divAssign')!, ILOpcode.DIV)).toBe(true);
      expect(hasInstruction(result.module.getFunction('divAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate MOD and STORE_VAR for %= assignment', () => {
      const source = `module test
function modAssign() {
  let x: byte = 17;
  x %= 5;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('modAssign')!, ILOpcode.MOD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('modAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });

  describe('bitwise compound assignments', () => {
    it('should generate AND and STORE_VAR for &= assignment', () => {
      const source = `module test
function andAssign() {
  let x: byte = $FF;
  x &= $0F;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('andAssign')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('andAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate OR and STORE_VAR for |= assignment', () => {
      const source = `module test
function orAssign() {
  let x: byte = $F0;
  x |= $0F;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('orAssign')!, ILOpcode.OR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('orAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate XOR and STORE_VAR for ^= assignment', () => {
      const source = `module test
function xorAssign() {
  let x: byte = $AA;
  x ^= $FF;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('xorAssign')!, ILOpcode.XOR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('xorAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate SHL and STORE_VAR for <<= assignment', () => {
      const source = `module test
function shlAssign() {
  let x: byte = 1;
  x <<= 4;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shlAssign')!, ILOpcode.SHL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('shlAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate SHR and STORE_VAR for >>= assignment', () => {
      const source = `module test
function shrAssign() {
  let x: byte = $80;
  x >>= 4;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('shrAssign')!, ILOpcode.SHR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('shrAssign')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });
});

// =============================================================================
// Array Element Assignment Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: Array Assignment', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('array element assignment with literal index', () => {
    it('should generate STORE_ARRAY for byte array element', () => {
      const source = `module test
function arrayAssign() {
  let data: byte[5];
  data[2] = 42;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('arrayAssign')!, ILOpcode.STORE_ARRAY)).toBe(true);
    });

    it('should generate STORE_ARRAY for first element', () => {
      const source = `module test
function assignFirst() {
  let arr: byte[3];
  arr[0] = 100;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignFirst')!, ILOpcode.STORE_ARRAY)).toBe(true);
    });

    it('should generate STORE_ARRAY for last element', () => {
      const source = `module test
function assignLast() {
  let arr: byte[3];
  arr[2] = 99;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignLast')!, ILOpcode.STORE_ARRAY)).toBe(true);
    });
  });

  describe('array element assignment with variable index', () => {
    it('should generate STORE_ARRAY with variable index', () => {
      const source = `module test
function assignDynamic() {
  let data: byte[10];
  let i: byte = 5;
  data[i] = 42;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignDynamic')!, ILOpcode.LOAD_VAR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignDynamic')!, ILOpcode.STORE_ARRAY)).toBe(true);
    });
  });

  describe('array element assignment with expression index', () => {
    it('should generate computed index and STORE_ARRAY', () => {
      const source = `module test
function assignComputed() {
  let data: byte[10];
  let base: byte = 2;
  data[base + 3] = 42;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignComputed')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('assignComputed')!, ILOpcode.STORE_ARRAY)).toBe(true);
    });
  });
});

// =============================================================================
// Assignment in Loops Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: Loop Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('assignment patterns (simplified - no while loop)', () => {
    it('should generate STORE_VAR for counter increment', () => {
      const source = `module test
function loopIncrement() {
  let i: byte = 0;
  i = i + 1;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('loopIncrement')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('loopIncrement')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate STORE_VAR for accumulator', () => {
      const source = `module test
function accumulatorPattern() {
  let sum: byte = 0;
  let i: byte = 5;
  sum = sum + i;
  i = i + 1;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Multiple ADD and STORE_VAR for sum and i updates
      expect(findInstructions(result.module.getFunction('accumulatorPattern')!, ILOpcode.ADD).length).toBeGreaterThanOrEqual(2);
      expect(findInstructions(result.module.getFunction('accumulatorPattern')!, ILOpcode.STORE_VAR).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('array assignment patterns (simplified)', () => {
    it('should generate STORE_ARRAY with computed value', () => {
      const source = `module test
function fillElement() {
  let data: byte[5];
  let i: byte = 2;
  data[i] = i * 2;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('fillElement')!, ILOpcode.STORE_ARRAY)).toBe(true);
      expect(hasInstruction(result.module.getFunction('fillElement')!, ILOpcode.MUL)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Assignment Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('C64 hardware patterns', () => {
    it('should generate STORE_VAR for sprite position update', () => {
      const source = `module test
function updateSpriteX() {
  let spriteX: byte = 100;
  spriteX = spriteX + 1;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('updateSpriteX')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('updateSpriteX')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate bitwise assignment for sprite enable', () => {
      const source = `module test
function enableSprite() {
  let spriteEnable: byte = 0;
  spriteEnable |= $01;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('enableSprite')!, ILOpcode.OR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('enableSprite')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate bitwise assignment for sprite disable', () => {
      const source = `module test
function disableSprite() {
  let spriteEnable: byte = $FF;
  spriteEnable &= $FE;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('disableSprite')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('disableSprite')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate XOR assignment for toggle', () => {
      const source = `module test
function toggleBit() {
  let flags: byte = $AA;
  flags ^= $01;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('toggleBit')!, ILOpcode.XOR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('toggleBit')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });

  describe('game state patterns', () => {
    it('should generate STORE_VAR for score update', () => {
      const source = `module test
function addScore() {
  let score: word = 0;
  score += 100;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('addScore')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('addScore')!, ILOpcode.STORE_VAR)).toBe(true);
    });

    it('should generate STORE_VAR for lives decrement', () => {
      const source = `module test
function loseLife() {
  let lives: byte = 3;
  lives -= 1;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('loseLife')!, ILOpcode.SUB)).toBe(true);
      expect(hasInstruction(result.module.getFunction('loseLife')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });
});

// =============================================================================
// Multiple Assignment Tests
// =============================================================================

describe('ILExpressionGenerator - Assignment Expressions: Multiple Assignments', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('sequential assignments', () => {
    it('should generate multiple STORE_VAR for sequential assignments', () => {
      const source = `module test
function multiAssign() {
  let a: byte = 0;
  let b: byte = 0;
  let c: byte = 0;
  a = 1;
  b = 2;
  c = 3;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('multiAssign')!, ILOpcode.STORE_VAR).length).toBeGreaterThanOrEqual(3);
    });

    it('should generate dependent assignments correctly', () => {
      const source = `module test
function chainAssign() {
  let a: byte = 5;
  let b: byte = 0;
  let c: byte = 0;
  b = a + 1;
  c = b + 1;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('chainAssign')!, ILOpcode.ADD).length).toBe(2);
      expect(findInstructions(result.module.getFunction('chainAssign')!, ILOpcode.STORE_VAR).length).toBeGreaterThanOrEqual(2);
    });
  });
});