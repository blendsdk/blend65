/**
 * IL Expression Generator Tests - Ternary Expressions
 *
 * Tests for ternary (conditional) expression generation including:
 * - Basic ternary: condition ? thenBranch : elseBranch
 * - Ternary with different types (byte, word, bool)
 * - Nested ternary expressions
 * - Ternary with complex conditions
 * - C64-specific ternary patterns (max, min, clamp, etc.)
 *
 * Ternary expressions generate SSA pattern: BRANCH + PHI
 *
 * @module __tests__/il/generator-expressions-ternary.test
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

function countBlocks(ilFunc: { getBlocks(): readonly unknown[] }): number {
  return ilFunc.getBlocks().length;
}

// =============================================================================
// Basic Ternary Expressions
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Basic', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('simple ternary with identifiers', () => {
    it('should generate BRANCH for ternary condition', () => {
      const source = `module test\nfunction select(): byte { let cond: boolean = true; let a: byte = 10; let b: byte = 20; return cond ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.BRANCH)).toBe(true);
    });

    it('should generate PHI for ternary merge', () => {
      const source = `module test\nfunction select(): byte { let cond: boolean = true; let a: byte = 10; let b: byte = 20; return cond ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.PHI)).toBe(true);
    });

    it('should create at least 4 blocks (entry, then, else, merge)', () => {
      const source = `module test\nfunction select(): byte { let cond: boolean = true; let a: byte = 10; let b: byte = 20; return cond ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // At least: entry (variables), ternary.then, ternary.else, ternary.merge
      expect(countBlocks(result.module.getFunction('select')!)).toBeGreaterThanOrEqual(4);
    });
  });

  describe('ternary with literals', () => {
    it('should generate ternary with literal branches', () => {
      const source = `module test\nfunction select(): byte { let flag: boolean = true; return flag ? 42 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.PHI)).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.CONST)).toBe(true);
    });

    it('should generate ternary with hex literals', () => {
      const source = `module test\nfunction select(): byte { let enabled: boolean = false; return enabled ? $FF : $00; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('ternary with boolean result', () => {
    it('should generate ternary with boolean branches', () => {
      const source = `module test\nfunction toggle(): boolean { let state: boolean = true; return state ? false : true; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('toggle')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('toggle')!, ILOpcode.PHI)).toBe(true);
    });
  });
});

// =============================================================================
// Ternary with Type Promotion
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Type Promotion', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('byte + word promotion', () => {
    it('should generate ternary with byte and word branches (promoted to word)', () => {
      const source = `module test\nfunction select(): word { let big: boolean = true; let small: byte = 10; let large: word = 1000; return big ? large : small; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.PHI)).toBe(true);
    });

    it('should handle word result from byte branches', () => {
      const source = `module test\nfunction select(): word { let flag: boolean = false; return flag ? 255 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('select')!, ILOpcode.PHI)).toBe(true);
    });
  });
});

// =============================================================================
// Ternary with Comparison Conditions
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Comparison Conditions', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('less than condition', () => {
    it('should generate CMP_LT and BRANCH for (x < y) ? a : b', () => {
      const source = `module test\nfunction minVal(): byte { let x: byte = 5; let y: byte = 10; return (x < y) ? x : y; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('minVal')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('minVal')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('minVal')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('greater than condition', () => {
    it('should generate CMP_GT and BRANCH for (x > y) ? a : b', () => {
      const source = `module test\nfunction maxVal(): byte { let x: byte = 5; let y: byte = 10; return (x > y) ? x : y; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('maxVal')!, ILOpcode.CMP_GT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('maxVal')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('maxVal')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('equality condition', () => {
    it('should generate CMP_EQ and BRANCH for (x == y) ? a : b', () => {
      const source = `module test\nfunction checkEq(): byte { let x: byte = 5; let y: byte = 5; return (x == y) ? 1 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkEq')!, ILOpcode.CMP_EQ)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkEq')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkEq')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('not-equal condition', () => {
    it('should generate CMP_NE and BRANCH for (x != y) ? a : b', () => {
      const source = `module test\nfunction checkNe(): byte { let x: byte = 5; let y: byte = 10; return (x != y) ? 1 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkNe')!, ILOpcode.CMP_NE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkNe')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('checkNe')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('greater-equal condition', () => {
    it('should generate CMP_GE and BRANCH for (x >= 0) ? x : -x', () => {
      const source = `module test\nfunction absVal(): byte { let x: byte = 10; return (x >= 0) ? x : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('absVal')!, ILOpcode.CMP_GE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('absVal')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('less-equal condition', () => {
    it('should generate CMP_LE and BRANCH for (x <= max) ? x : max', () => {
      const source = `module test\nfunction clamp(): byte { let x: byte = 150; let max: byte = 100; return (x <= max) ? x : max; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clamp')!, ILOpcode.CMP_LE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clamp')!, ILOpcode.BRANCH)).toBe(true);
    });
  });
});

// =============================================================================
// Ternary with Arithmetic Expressions
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Arithmetic', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('arithmetic in branches', () => {
    it('should generate ternary with addition in branches', () => {
      const source = `module test\nfunction compute(): byte { let flag: boolean = true; let a: byte = 5; let b: byte = 10; return flag ? a + b : a - b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('compute')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('compute')!, ILOpcode.SUB)).toBe(true);
      expect(hasInstruction(result.module.getFunction('compute')!, ILOpcode.PHI)).toBe(true);
    });

    it('should generate ternary with multiplication in branches', () => {
      const source = `module test\nfunction scale(): byte { let doubleIt: boolean = true; let x: byte = 10; return doubleIt ? x * 2 : x / 2; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('scale')!, ILOpcode.MUL)).toBe(true);
      expect(hasInstruction(result.module.getFunction('scale')!, ILOpcode.DIV)).toBe(true);
    });
  });

  describe('arithmetic in condition', () => {
    it('should generate arithmetic for (a + b > c) ? x : y', () => {
      const source = `module test\nfunction check(): byte { let a: byte = 5; let b: byte = 10; let c: byte = 12; return (a + b > c) ? 1 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('check')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('check')!, ILOpcode.CMP_GT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('check')!, ILOpcode.BRANCH)).toBe(true);
    });
  });
});

// =============================================================================
// Nested Ternary Expressions
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Nested', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('nested in else branch (right-associative)', () => {
    it('should generate nested ternary: a ? b : c ? d : e', () => {
      const source = `module test\nfunction nested(): byte { let a: boolean = true; let b: byte = 1; let c: boolean = false; let d: byte = 2; let e: byte = 3; return a ? b : c ? d : e; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Should have 2 BRANCH instructions (one for each ternary)
      expect(findInstructions(result.module.getFunction('nested')!, ILOpcode.BRANCH).length).toBeGreaterThanOrEqual(2);
      // Should have 2 PHI instructions (one for each ternary merge)
      expect(findInstructions(result.module.getFunction('nested')!, ILOpcode.PHI).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('nested in then branch (explicit parentheses)', () => {
    it('should generate nested ternary: a ? (b ? c : d) : e', () => {
      const source = `module test\nfunction nested(): byte { let a: boolean = true; let b: boolean = true; let c: byte = 1; let d: byte = 2; let e: byte = 3; return a ? (b ? c : d) : e; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('nested')!, ILOpcode.BRANCH).length).toBeGreaterThanOrEqual(2);
      expect(findInstructions(result.module.getFunction('nested')!, ILOpcode.PHI).length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =============================================================================
// C64-Specific Ternary Patterns
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('max value idiom', () => {
    it('should generate max: (a > b) ? a : b', () => {
      const source = `module test\nfunction max(): byte { let a: byte = 100; let b: byte = 50; return (a > b) ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('max')!, ILOpcode.CMP_GT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('max')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('max')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('min value idiom', () => {
    it('should generate min: (a < b) ? a : b', () => {
      const source = `module test\nfunction min(): byte { let a: byte = 50; let b: byte = 100; return (a < b) ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('min')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('min')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('min')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('clamp value idiom', () => {
    it('should generate clamp: (x > max) ? max : x', () => {
      const source = `module test\nfunction clampHigh(): byte { let x: byte = 150; let max: byte = 100; return (x > max) ? max : x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clampHigh')!, ILOpcode.CMP_GT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clampHigh')!, ILOpcode.BRANCH)).toBe(true);
    });

    it('should generate clamp: (x < min) ? min : x', () => {
      const source = `module test\nfunction clampLow(): byte { let x: byte = 5; let min: byte = 10; return (x < min) ? min : x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('clampLow')!, ILOpcode.CMP_LT)).toBe(true);
      expect(hasInstruction(result.module.getFunction('clampLow')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('direction toggle idiom', () => {
    it('should generate direction: movingRight ? 1 : -1', () => {
      // Note: Blend doesn't have signed byte, so we use byte and 255 for -1
      const source = `module test\nfunction direction(): byte { let movingRight: boolean = true; return movingRight ? 1 : 255; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('direction')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('direction')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('sprite enable toggle idiom', () => {
    it('should generate enable: enabled ? $FF : $00', () => {
      const source = `module test\nfunction spriteEnable(): byte { let enabled: boolean = true; return enabled ? $FF : $00; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('spriteEnable')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('spriteEnable')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('boundary wrap idiom', () => {
    it('should generate wrap: (x >= width) ? 0 : x', () => {
      const source = `module test\nfunction wrap(): byte { let x: byte = 45; let width: byte = 40; return (x >= width) ? 0 : x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('wrap')!, ILOpcode.CMP_GE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('wrap')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('collision detection idiom', () => {
    it('should generate collision check with ternary result', () => {
      const source = `module test\nfunction checkCollision(): byte { let playerX: byte = 100; let enemyX: byte = 105; let threshold: byte = 10; return ((playerX > enemyX) ? playerX - enemyX : enemyX - playerX) < threshold ? 1 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Should have nested ternary pattern
      expect(findInstructions(result.module.getFunction('checkCollision')!, ILOpcode.BRANCH).length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =============================================================================
// Ternary with Bitwise Operations
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Bitwise', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('bitwise in branches', () => {
    it('should generate ternary with bitwise AND/OR in branches', () => {
      const source = `module test\nfunction bitSelect(): byte { let flag: boolean = true; let mask: byte = $0F; let val: byte = $FF; return flag ? val & mask : val | mask; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitSelect')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitSelect')!, ILOpcode.OR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitSelect')!, ILOpcode.PHI)).toBe(true);
    });
  });

  describe('bitwise in condition', () => {
    it('should generate ternary with bitwise AND condition', () => {
      const source = `module test\nfunction bitCheck(): byte { let flags: byte = $0A; return (flags & $02) != 0 ? 1 : 0; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitCheck')!, ILOpcode.AND)).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitCheck')!, ILOpcode.CMP_NE)).toBe(true);
      expect(hasInstruction(result.module.getFunction('bitCheck')!, ILOpcode.BRANCH)).toBe(true);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('ILExpressionGenerator - Ternary Expressions: Edge Cases', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('ternary with same value in both branches', () => {
    it('should generate ternary even when branches are identical', () => {
      const source = `module test\nfunction same(): byte { let flag: boolean = true; let x: byte = 42; return flag ? x : x; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Still generates ternary pattern (optimizer would simplify this)
      expect(hasInstruction(result.module.getFunction('same')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('ternary with literal true condition', () => {
    it('should generate ternary for true ? a : b', () => {
      const source = `module test\nfunction constTrue(): byte { let a: byte = 1; let b: byte = 0; return true ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Still generates ternary (optimizer would eliminate dead branch)
      expect(hasInstruction(result.module.getFunction('constTrue')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('ternary with literal false condition', () => {
    it('should generate ternary for false ? a : b', () => {
      const source = `module test\nfunction constFalse(): byte { let a: byte = 1; let b: byte = 0; return false ? a : b; }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Still generates ternary (optimizer would eliminate dead branch)
      expect(hasInstruction(result.module.getFunction('constFalse')!, ILOpcode.BRANCH)).toBe(true);
    });
  });

  describe('ternary inside function call argument', () => {
    it('should generate ternary for function argument', () => {
      const source = `module test\nfunction identity(x: byte): byte { return x; }\nfunction test(): byte { let flag: boolean = true; return identity(flag ? 10 : 20); }`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.BRANCH)).toBe(true);
      expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL)).toBe(true);
    });
  });
});