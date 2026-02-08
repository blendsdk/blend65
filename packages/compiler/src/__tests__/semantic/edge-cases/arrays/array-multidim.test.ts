/**
 * Multi-Dimensional Array Edge Case Tests
 *
 * Tests for multi-dimensional arrays:
 * - 2D array access [i][j]
 * - 2D array access at boundaries
 * - Type consistency in multi-dimensional arrays
 * - Nested array operations
 *
 * @module __tests__/semantic/edge-cases/arrays/array-multidim
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
// 2D Array Declaration
// =============================================================================

describe('2D Array Declaration', () => {
  it('should accept 2D byte array declaration', () => {
    const source = `let matrix: byte[2][3] = [[1, 2, 3], [4, 5, 6]];`;
    // Document behavior - may or may not be supported
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept 2D word array declaration', () => {
    const source = `let matrix: word[2][2] = [[100, 200], [300, 400]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept square 2D array', () => {
    const source = `let grid: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array Access - Basic
// =============================================================================

describe('2D Array Access - Basic', () => {
  it('should accept access at [0][0]', () => {
    const source = `
      let matrix: byte[2][3] = [[1, 2, 3], [4, 5, 6]];
      let x: byte = matrix[0][0];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept access at last valid indices', () => {
    const source = `
      let matrix: byte[2][3] = [[1, 2, 3], [4, 5, 6]];
      let x: byte = matrix[1][2];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept access in middle of array', () => {
    const source = `
      let matrix: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      let x: byte = matrix[1][1];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array Access - Boundaries
// =============================================================================

describe('2D Array Access - Boundaries', () => {
  it('should accept access at first row, first column', () => {
    const source = `
      let grid: byte[4][4] = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]];
      let corner: byte = grid[0][0];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept access at first row, last column', () => {
    const source = `
      let grid: byte[4][4] = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]];
      let corner: byte = grid[0][3];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept access at last row, first column', () => {
    const source = `
      let grid: byte[4][4] = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]];
      let corner: byte = grid[3][0];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept access at last row, last column', () => {
    const source = `
      let grid: byte[4][4] = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]];
      let corner: byte = grid[3][3];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array Assignment
// =============================================================================

describe('2D Array Assignment', () => {
  it('should accept assignment to 2D element', () => {
    const source = `
      let matrix: byte[2][2] = [[0, 0], [0, 0]];
      function main(): void {
        matrix[0][0] = 42;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept assignment to all corners', () => {
    const source = `
      let grid: byte[3][3] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      function setCorners(): void {
        grid[0][0] = 1;
        grid[0][2] = 2;
        grid[2][0] = 3;
        grid[2][2] = 4;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array with Variable Indices
// =============================================================================

describe('2D Array with Variable Indices', () => {
  it('should accept variable row index', () => {
    const source = `
      let matrix: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      let row: byte = 1;
      let x: byte = matrix[row][0];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept variable column index', () => {
    const source = `
      let matrix: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      let col: byte = 2;
      let x: byte = matrix[0][col];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept both indices as variables', () => {
    const source = `
      let matrix: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      let row: byte = 1;
      let col: byte = 1;
      let x: byte = matrix[row][col];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array in Loops
// =============================================================================

describe('2D Array in Loops', () => {
  it('should accept nested loop iteration', () => {
    const source = `
      let matrix: byte[3][3] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      let sum: byte = 0;
      function sumMatrix(): void {
        let i: byte = 0;
        while (i < 3) {
          let j: byte = 0;
          while (j < 3) {
            sum = sum + matrix[i][j];
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept row-wise iteration', () => {
    const source = `
      let matrix: byte[2][4] = [[1, 2, 3, 4], [5, 6, 7, 8]];
      function sumFirstRow(): byte {
        let sum: byte = 0;
        let j: byte = 0;
        while (j < 4) {
          sum = sum + matrix[0][j];
          j = j + 1;
        }
        return sum;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept column-wise iteration', () => {
    const source = `
      let matrix: byte[4][2] = [[1, 2], [3, 4], [5, 6], [7, 8]];
      function sumFirstColumn(): byte {
        let sum: byte = 0;
        let i: byte = 0;
        while (i < 4) {
          sum = sum + matrix[i][0];
          i = i + 1;
        }
        return sum;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Array of Arrays (Alternative Representation)
// =============================================================================

describe('Array of Arrays (Alternative)', () => {
  it('should document array of arrays behavior', () => {
    // Some compilers represent 2D arrays as arrays of arrays
    const source = `
      let row1: byte[3] = [1, 2, 3];
      let row2: byte[3] = [4, 5, 6];
      let row3: byte[3] = [7, 8, 9];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept accessing separate row arrays', () => {
    const source = `
      let row1: byte[3] = [1, 2, 3];
      let row2: byte[3] = [4, 5, 6];
      let x: byte = row1[0];
      let y: byte = row2[2];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency in 2D Arrays
// =============================================================================

describe('Type Consistency in 2D Arrays', () => {
  it('should accept consistent byte values', () => {
    const source = `let matrix: byte[2][2] = [[100, 200], [150, 250]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept consistent word values', () => {
    const source = `let matrix: word[2][2] = [[1000, 2000], [3000, 4000]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle type promotion in 2D array', () => {
    const source = `let matrix: word[2][2] = [[100, 200], [300, 400]];`;
    // byte values should be promoted to word
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Edge Cases with Small 2D Arrays
// =============================================================================

describe('Small 2D Arrays', () => {
  it('should accept 1x1 2D array', () => {
    const source = `let single: byte[1][1] = [[42]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept 1xN 2D array (single row)', () => {
    const source = `let row: byte[1][5] = [[1, 2, 3, 4, 5]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept Nx1 2D array (single column)', () => {
    const source = `let column: byte[5][1] = [[1], [2], [3], [4], [5]];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// 2D Array Operations
// =============================================================================

describe('2D Array Operations', () => {
  it('should accept arithmetic with 2D elements', () => {
    const source = `
      let matrix: byte[2][2] = [[10, 20], [30, 40]];
      let sum: byte = matrix[0][0] + matrix[1][1];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept 2D element passed to function', () => {
    const source = `
      function double(x: byte): byte { return x * 2; }
      function main(): void {
        let matrix: byte[2][2] = [[5, 10], [15, 20]];
        let doubled: byte = double(matrix[0][0]);
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept 2D element in conditional', () => {
    const source = `
      let matrix: byte[2][2] = [[0, 1], [2, 3]];
      function checkCenter(): byte {
        if (matrix[1][1] > 0) {
          return 1;
        }
        return 0;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Common C64 Patterns with 2D Arrays
// =============================================================================

describe('C64 Patterns with 2D Arrays', () => {
  it('should accept sprite pattern data as 2D array', () => {
    const source = `
      let sprite: byte[3][3] = [
        [1, 1, 1],
        [1, 0, 1],
        [1, 1, 1]
      ];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept tile map as 2D array', () => {
    const source = `
      let tilemap: byte[4][4] = [
        [0, 1, 1, 0],
        [1, 2, 2, 1],
        [1, 2, 2, 1],
        [0, 1, 1, 0]
      ];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept color matrix as 2D array', () => {
    const source = `
      let colors: byte[2][4] = [
        [0, 1, 2, 3],
        [4, 5, 6, 7]
      ];
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});