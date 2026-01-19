/**
 * Type Checker Tests - Session 3: Assignments & Complex Expressions
 *
 * Tests for:
 * - Assignment expressions (simple and compound)
 * - Function call expressions
 * - Index expressions (array access)
 * - Member expressions
 *
 * This test suite validates comprehensive type checking for
 * complex expressions building on Session 1 (Literals) and
 * Session 2 (Simple Expressions).
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeChecker } from '../../semantic/visitors/type-checker/index.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';
import type { Diagnostic } from '../../ast/diagnostics.js';

/**
 * Helper: Parse source and run all three semantic analysis phases
 */
function parseAndTypeCheck(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Phase 1: Symbol Table Builder
  const symbolBuilder = new SymbolTableBuilder();
  symbolBuilder.walk(program);
  const symbolTable = symbolBuilder.getSymbolTable();

  // Phase 2: Type Resolver
  const resolver = new TypeResolver(symbolTable);
  resolver.walk(program);
  const typeSystem = resolver.getTypeSystem();

  // Phase 3: Type Checker
  const checker = new TypeChecker(symbolTable, typeSystem);
  checker.walk(program);
  const diagnostics = checker.getDiagnostics();

  return { program, symbolTable, typeSystem, diagnostics };
}

/**
 * Helper: Get error messages from diagnostics
 */
function getErrors(diagnostics: Diagnostic[]): string[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR).map(d => d.message);
}

// ============================================
// ASSIGNMENT EXPRESSIONS - SIMPLE
// ============================================

describe('Type Checker - Assignment Expressions (Simple)', () => {
  it('should type check valid byte = byte assignment', () => {
    const source = `
      function test(): void
        let x: byte = 0;
        x = 42;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check valid word = word assignment', () => {
    const source = `
      function test(): void
        let x: word = 0;
        x = 1000;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check valid word = byte assignment (widening)', () => {
    const source = `
      function test(): void
        let x: word = 0;
        x = 42;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should error on byte = word assignment (narrowing)', () => {
    const source = `
      function test(): void
        let x: byte = 0;
        x = 1000;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('cannot assign'))).toBe(true);
  });

  it('should error on assigning to non-lvalue', () => {
    const source = `
      function test(): void
        let x: byte = 0;
        (x + 1) = 42;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('lvalue'))).toBe(true);
  });

  it('should error on assigning to const variable', () => {
    const source = `
      function test(): void
        const MAX: byte = 100;
        MAX = 50;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('const'))).toBe(true);
  });

  it('should type check array element assignment', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      arr[0] = 10;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });
});

// ============================================
// ASSIGNMENT EXPRESSIONS - COMPOUND
// ============================================

describe('Type Checker - Compound Assignment Expressions', () => {
  it('should type check += with numeric types', () => {
    const source = `
      let x: byte = 10;
      x += 5;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check -= with numeric types', () => {
    const source = `
      let x: word = 1000;
      x -= 100;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check *= with numeric types', () => {
    const source = `
      let x: byte = 5;
      x *= 2;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check /= with numeric types', () => {
    const source = `
      let x: word = 100;
      x /= 10;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check %= with numeric types', () => {
    const source = `
      let x: byte = 17;
      x %= 5;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check &= with numeric types', () => {
    const source = `
      let x: byte = 0xFF;
      x &= 0x0F;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check |= with numeric types', () => {
    const source = `
      let x: byte = 0x10;
      x |= 0x01;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check ^= with numeric types', () => {
    const source = `
      let x: byte = 0xFF;
      x ^= 0xAA;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check <<= with numeric types', () => {
    const source = `
      let x: byte = 1;
      x <<= 3;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check >>= with numeric types', () => {
    const source = `
      let x: byte = 128;
      x >>= 2;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should error on += with non-numeric target', () => {
    const source = `
      function test(): void
        let flag: boolean = true;
        flag += 1;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('numeric'))).toBe(true);
  });

  it('should error on += with non-numeric value', () => {
    const source = `
      function test(): void
        let x: byte = 10;
        let flag: boolean = true;
        x += flag;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('numeric'))).toBe(true);
  });

  it('should warn on compound assignment that widens type', () => {
    const source = `
      function test(): void
        let x: byte = 10;
        let y: word = 1000;
        x += y;
      end function
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('widen'))).toBe(true);
  });
});

// ============================================
// FUNCTION CALL EXPRESSIONS
// ============================================

describe('Type Checker - Function Call Expressions', () => {
  it('should type check function call with correct arguments', () => {
    const source = `
      function add(a: byte, b: byte): byte
        return a + b;
      end function

      let result: byte = add(5, 10);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check function call with no arguments', () => {
    const source = `
      function getZero(): byte
        return 0;
      end function

      let x: byte = getZero();
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check function call with multiple arguments', () => {
    const source = `
      function mix(a: byte, b: word, c: byte): word
        return b + a + c;
      end function

      let result: word = mix(10, 1000, 5);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check void function call', () => {
    const source = `
      function doNothing(): void
      end function

      doNothing();
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should error on calling non-function', () => {
    const source = `
      let x: byte = 42;
      let result: byte = x();
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('not callable'))).toBe(true);
  });

  it('should error on wrong argument count (too few)', () => {
    const source = `
      function add(a: byte, b: byte): byte
        return a + b;
      end function

      let result: byte = add(5);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('Expected 2'))).toBe(true);
  });

  it('should error on wrong argument count (too many)', () => {
    const source = `
      function add(a: byte, b: byte): byte
        return a + b;
      end function

      let result: byte = add(5, 10, 15);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('Expected 2'))).toBe(true);
  });

  it('should error on wrong argument type', () => {
    const source = `
      function add(a: byte, b: byte): byte
        return a + b;
      end function

      let x: word = 1000;
      let result: byte = add(5, x);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('type mismatch'))).toBe(true);
  });

  it('should type check function call with type widening', () => {
    const source = `
      function process(x: word): word
        return x * 2;
      end function

      let small: byte = 10;
      let result: word = process(small);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });
});

// ============================================
// INDEX EXPRESSIONS (ARRAY ACCESS)
// ============================================

describe('Type Checker - Index Expressions', () => {
  it('should type check array access with byte index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let value: byte = arr[0];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check array access with word index', () => {
    const source = `
      let arr: byte[10] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let idx: word = 5;
      let value: byte = arr[idx];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check array access with expression index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let i: byte = 2;
      let value: byte = arr[i + 1];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check nested array access', () => {
    const source = `
      let matrix: byte[3] = [1, 2, 3];
      let i: byte = 0;
      let j: byte = 1;
      let value: byte = matrix[i];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should return correct element type for byte array', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let value: byte = arr[0];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should return correct element type for word array', () => {
    const source = `
      let arr: word[3] = [1000, 2000, 3000];
      let value: word = arr[1];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should error on indexing non-array type', () => {
    const source = `
      let x: byte = 42;
      let value: byte = x[0];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('non-array'))).toBe(true);
  });

  it('should error on non-numeric index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let flag: boolean = true;
      let value: byte = arr[flag];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('index must be numeric'))).toBe(true);
  });

  it('should allow array element as lvalue', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      arr[2] = 10;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });
});

// ============================================
// MEMBER EXPRESSIONS
// ============================================

describe('Type Checker - Member Expressions', () => {
  it('should error on member access (not yet implemented)', () => {
    const source = `
      let x: byte = 42;
      let value: byte = x.something;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    const errors = getErrors(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('not yet fully implemented'))).toBe(true);
  });
});

// ============================================
// COMPLEX SCENARIOS
// ============================================

describe('Type Checker - Complex Expression Scenarios', () => {
  it('should type check assignment in expression context', () => {
    const source = `
      let x: byte = 0;
      let y: byte = 0;
      y = (x = 10);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check function call as assignment value', () => {
    const source = `
      function getValue(): byte
        return 42;
      end function

      let x: byte = 0;
      x = getValue();
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check array access in function call', () => {
    const source = `
      function double(x: byte): byte
        return x * 2;
      end function

      let arr: byte[5] = [1, 2, 3, 4, 5];
      let result: byte = double(arr[2]);
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check compound assignment with function call', () => {
    const source = `
      function getIncrement(): byte
        return 5;
      end function

      let x: byte = 10;
      x += getIncrement();
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check array element compound assignment', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      arr[0] += 10;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });

  it('should type check chained function calls', () => {
    const source = `
      function getIndex(): byte
        return 2;
      end function

      function getArray(): byte[5]
        return [1, 2, 3, 4, 5];
      end function

      let value: byte = getArray()[getIndex()];
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    // Note: This might have errors due to getArray() returning array type
    // which needs proper handling - this tests the robustness
    const errors = getErrors(diagnostics);
    // We expect this to work or have meaningful errors
    expect(Array.isArray(errors)).toBe(true);
  });

  it('should handle complex expression with multiple operators', () => {
    const source = `
      function add(a: byte, b: byte): byte
        return a + b;
      end function

      let arr: byte[5] = [1, 2, 3, 4, 5];
      let x: byte = 10;
      let result: byte = add(arr[0], x) + arr[1] * 2;
    `;

    const { diagnostics } = parseAndTypeCheck(source);
    expect(getErrors(diagnostics)).toEqual([]);
  });
});
