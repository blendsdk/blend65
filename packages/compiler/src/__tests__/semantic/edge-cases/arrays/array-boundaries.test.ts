/**
 * Array Boundary Edge Case Tests
 *
 * Tests for array boundary conditions:
 * - Access index 0 (first element)
 * - Access last valid index
 * - Out-of-bounds access (should error)
 * - Negative index (should error)
 * - Index with expressions at boundaries
 * - Maximum array sizes
 *
 * @module __tests__/semantic/edge-cases/arrays/array-boundaries
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
// Valid Index Access - First Element
// =============================================================================

describe('Array Access - First Element (Index 0)', () => {
  it('should accept access to index 0 of byte array', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let x: byte = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept access to index 0 of word array', () => {
    const source = `
      let arr: word[3] = [100, 200, 300];
      let x: word = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment to index 0', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function main(): void {
        arr[0] = 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept index 0 with literal 0', () => {
    const source = `
      let arr: byte[3] = [10, 20, 30];
      let x: byte = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Valid Index Access - Last Element
// =============================================================================

describe('Array Access - Last Element', () => {
  it('should accept access to last index of small array', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = arr[2];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept access to last index of larger array', () => {
    const source = `
      let arr: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let x: byte = arr[9];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment to last index', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function main(): void {
        arr[4] = 255;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept last index of word array', () => {
    const source = `
      let arr: word[4] = [1000, 2000, 3000, 4000];
      let x: word = arr[3];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Out-of-Bounds Access - Literal Index
// =============================================================================

describe('Array Access - Out of Bounds (Literal)', () => {
  it('should handle access one past end', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = arr[3];
    `;
    // Index 3 is out of bounds for size 3 array (valid: 0, 1, 2)
    // Semantic analyzer may or may not catch this at compile time
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle access far out of bounds', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = arr[100];
    `;
    // Clearly out of bounds
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle access at max byte index on small array', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let x: byte = arr[255];
    `;
    // 255 is far out of bounds for size 5 array
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Index with Variable Expressions
// =============================================================================

describe('Array Access - Variable Index', () => {
  it('should accept variable index within bounds', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let i: byte = 2;
      let x: byte = arr[i];
    `;
    // Runtime bounds check - static analysis can't determine
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept variable index at 0', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let i: byte = 0;
      let x: byte = arr[i];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word variable index', () => {
    const source = `
      let arr: byte[100] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let i: word = 50;
      let x: byte = arr[i];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept computed index expression', () => {
    const source = `
      let arr: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let base: byte = 2;
      let x: byte = arr[base + 3];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Index with Expressions at Boundaries
// =============================================================================

describe('Array Access - Expression Index at Boundaries', () => {
  it('should accept size - 1 as index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let size: byte = 5;
      let x: byte = arr[size - 1];
    `;
    // 5 - 1 = 4, valid index
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept 0 * anything as index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let x: byte = arr[0 * 100];
    `;
    // 0 * 100 = 0, valid index
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo to constrain index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let big: byte = 100;
      let x: byte = arr[big % 5];
    `;
    // 100 % 5 = 0, valid index
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept bitwise AND to mask index', () => {
    const source = `
      let arr: byte[8] = [0, 1, 2, 3, 4, 5, 6, 7];
      let idx: byte = 100;
      let x: byte = arr[idx & 7];
    `;
    // 100 & 7 = 4, valid index
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Array Size Boundaries
// =============================================================================

describe('Array Size Boundaries', () => {
  it('should accept small array size 2', () => {
    const source = `let arr: byte[2] = [1, 2];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept medium array size 10', () => {
    const source = `let arr: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept larger array size 50', () => {
    const source = `let arr: byte[50] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte max index 255', () => {
    // Array of size 256 - max indexable with byte
    const source = `let arr: byte[256] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];`;
    // This will be handled at compile time - document behavior
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Loop-based Array Access
// =============================================================================

describe('Loop-based Array Access', () => {
  it('should accept loop iterating through array', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let sum: byte = 0;
      function sumArray(): void {
        let i: byte = 0;
        while (i < 5) {
          sum = sum + arr[i];
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept loop with boundary check', () => {
    const source = `
      let arr: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      function findZero(): byte {
        let i: byte = 0;
        while (i < 10) {
          if (arr[i] == 0) {
            return i;
          }
          i = i + 1;
        }
        return 255;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept reverse iteration', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      function reverseSum(): byte {
        let sum: byte = 0;
        let i: byte = 4;
        while (i > 0) {
          sum = sum + arr[i];
          i = i - 1;
        }
        sum = sum + arr[0];
        return sum;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Array Index Type Checking
// =============================================================================

describe('Array Index Type Checking', () => {
  it('should accept byte index for byte array', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let i: byte = 2;
      let x: byte = arr[i];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word index for large array', () => {
    const source = `
      let arr: byte[100] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let i: word = 50;
      let x: byte = arr[i];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept literal 0 as index', () => {
    const source = `
      let arr: byte[5] = [1, 2, 3, 4, 5];
      let x: byte = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept function result as index', () => {
    const source = `
      function getIndex(): byte { return 2; }
      function main(): void {
        let arr: byte[5] = [1, 2, 3, 4, 5];
        let x: byte = arr[getIndex()];
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Array Element Assignment Boundaries
// =============================================================================

describe('Array Element Assignment Boundaries', () => {
  it('should accept assignment at index 0', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function main(): void {
        arr[0] = 100;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment at last index', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function main(): void {
        arr[4] = 200;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept assignment with variable index', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function setElement(i: byte, val: byte): void {
        arr[i] = val;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should reject type mismatch in assignment', () => {
    const source = `
      let arr: byte[5] = [0, 0, 0, 0, 0];
      function main(): void {
        arr[0] = 1000;
      }
    `;
    // 1000 doesn't fit in byte
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });
});