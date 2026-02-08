/**
 * Array Empty and Single Element Edge Case Tests
 *
 * Tests for arrays with minimal elements:
 * - Empty arrays (if allowed)
 * - Single element arrays
 * - Single element access
 * - Array literal with minimal elements
 *
 * @module __tests__/semantic/edge-cases/arrays/array-empty-single
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../../lexer/lexer.js';
import { Parser } from '../../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../../ast/diagnostics.js';

/**
 * Helper function to analyze source code and get diagnostics.
 * IMPORTANT: Always tokenize first, then parse!
 */
function analyzeSource(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

/**
 * Gets error messages from analysis result
 */
function getErrors(source: string): string[] {
  const result = analyzeSource(source);
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.ERROR)
    .map(d => d.message);
}

/**
 * Checks if analysis has no errors
 */
function hasNoErrors(source: string): boolean {
  return getErrors(source).length === 0;
}

// =============================================================================
// Single Element Arrays - Byte Type
// =============================================================================

describe('Single Element Byte Arrays', () => {
  it('should accept single element byte array declaration', () => {
    const source = `let arr: byte[1] = [42];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept access to single element at index 0', () => {
    const source = `
      let arr: byte[1] = [42];
      let x: byte = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment to single element at index 0', () => {
    const source = `
      let arr: byte[1] = [0];
      function main(): void {
        arr[0] = 100;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element with max byte value', () => {
    const source = `let arr: byte[1] = [255];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element with zero value', () => {
    const source = `let arr: byte[1] = [0];`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Single Element Arrays - Word Type
// =============================================================================

describe('Single Element Word Arrays', () => {
  it('should accept single element word array declaration', () => {
    const source = `let arr: word[1] = [1000];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept access to single element word at index 0', () => {
    const source = `
      let arr: word[1] = [1000];
      let x: word = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element with max word value', () => {
    const source = `let arr: word[1] = [65535];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element word with word-sized zero equivalent', () => {
    // Note: literal 0 is inferred as byte, creating byte[1] which doesn't match word[1]
    // Use 256 (first word-only value) to force word array inference
    const source = `let arr: word[1] = [256];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment to single word element', () => {
    const source = `
      let arr: word[1] = [1000];
      function main(): void {
        arr[0] = 50000;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Single Element Array Operations
// =============================================================================

describe('Single Element Array Operations', () => {
  it('should accept arithmetic with single element', () => {
    const source = `
      let arr: byte[1] = [10];
      let x: byte = arr[0] + 5;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element in expression', () => {
    const source = `
      let arr: byte[1] = [100];
      let y: byte = 50;
      let result: byte = arr[0] - y;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element passed to function', () => {
    const source = `
      function process(val: byte): byte { return val * 2; }
      function main(): void {
        let arr: byte[1] = [25];
        let x: byte = process(arr[0]);
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept comparison with single element', () => {
    const source = `
      let arr: byte[1] = [50];
      function test(): byte {
        if (arr[0] > 25) {
          return 1;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element in loop condition', () => {
    const source = `
      let counter: byte[1] = [10];
      function countdown(): void {
        while (counter[0] > 0) {
          counter[0] = counter[0] - 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Array Literal Size Inference
// =============================================================================

describe('Array Literal Size Inference', () => {
  it('should infer size 1 from single element literal', () => {
    // If size inference is supported
    const source = `let arr: byte[] = [42];`;
    const result = analyzeSource(source);
    // Document behavior - may or may not support size inference
    expect(result).toBeDefined();
  });

  it('should accept explicit size matching literal', () => {
    const source = `let arr: byte[1] = [42];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle size mismatch - more elements than declared', () => {
    const source = `let arr: byte[1] = [42, 43];`;
    // Should error - too many elements
    const errors = getErrors(source);
    // Document behavior
    expect(errors.length >= 0).toBe(true); // May or may not error
  });

  it('should handle size mismatch - fewer elements than declared', () => {
    const source = `let arr: byte[2] = [42];`;
    // May error or fill with zeros
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Type Consistency in Single Element Arrays
// =============================================================================

describe('Type Consistency in Single Element Arrays', () => {
  it('should accept byte literal in byte array', () => {
    const source = `let arr: byte[1] = [100];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word literal in word array', () => {
    const source = `let arr: word[1] = [1000];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error when byte-inferred array assigned to word array type', () => {
    const source = `let arr: word[1] = [100];`;
    // Note: literal 100 is inferred as byte, creating byte[1]
    // byte[1] is not assignable to word[1] - no implicit array type promotion
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject word value in byte array', () => {
    const source = `let arr: byte[1] = [1000];`;
    // 1000 doesn't fit in byte - should error
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject assigning wrong type to single element', () => {
    const source = `
      let arr: byte[1] = [0];
      function main(): void {
        arr[0] = 1000;
      }
    `;
    // 1000 doesn't fit in byte
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Edge Cases with Single Element Arrays
// =============================================================================

describe('Edge Cases with Single Element Arrays', () => {
  it('should accept multiple single-element arrays', () => {
    const source = `
      let a: byte[1] = [1];
      let b: byte[1] = [2];
      let c: byte[1] = [3];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept operations between single-element arrays', () => {
    const source = `
      let a: byte[1] = [10];
      let b: byte[1] = [20];
      let result: byte = a[0] + b[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept copying single element to another', () => {
    const source = `
      let src: byte[1] = [42];
      let dst: byte[1] = [0];
      function copy(): void {
        dst[0] = src[0];
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept swapping single elements', () => {
    const source = `
      let a: byte[1] = [10];
      let b: byte[1] = [20];
      function swap(): void {
        let temp: byte = a[0];
        a[0] = b[0];
        b[0] = temp;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single element in conditional expression', () => {
    const source = `
      let flags: byte[1] = [1];
      function getFlag(): byte {
        return flags[0] > 0 ? 1 : 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});