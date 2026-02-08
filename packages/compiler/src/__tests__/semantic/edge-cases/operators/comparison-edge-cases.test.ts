/**
 * Comparison Operator Edge Case Tests
 *
 * Tests for comparison operators at edge cases:
 * - Compare byte to byte at boundaries
 * - Compare word to word at boundaries
 * - Compare byte to word (type promotion)
 * - Compare bool values
 * - Equality vs inequality checks
 *
 * @module __tests__/semantic/edge-cases/operators/comparison-edge-cases
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
// Byte Boundary Comparisons
// =============================================================================

describe('Byte Boundary Comparisons', () => {
  it('should compare byte == 0 (min)', () => {
    const source = `let x: byte = 0; let y: bool = x == 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte == 255 (max)', () => {
    const source = `let x: byte = 255; let y: bool = x == 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte != 0', () => {
    const source = `let x: byte = 100; let y: bool = x != 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte != 255', () => {
    const source = `let x: byte = 0; let y: bool = x != 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte < 255', () => {
    const source = `let x: byte = 100; let y: bool = x < 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte > 0', () => {
    const source = `let x: byte = 100; let y: bool = x > 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte <= 255 (always true for byte)', () => {
    const source = `let x: byte = 255; let y: bool = x <= 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte >= 0 (always true for unsigned)', () => {
    const source = `let x: byte = 0; let y: bool = x >= 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare 0 < byte', () => {
    const source = `let x: byte = 100; let y: bool = 0 < x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare 255 > byte', () => {
    const source = `let x: byte = 100; let y: bool = 255 > x;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Boundary Comparisons
// =============================================================================

describe('Word Boundary Comparisons', () => {
  it('should compare word == 0 (min)', () => {
    const source = `let x: word = 0; let y: bool = x == 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word == 65535 (max)', () => {
    const source = `let x: word = 65535; let y: bool = x == 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word != 0', () => {
    const source = `let x: word = 1000; let y: bool = x != 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word != 65535', () => {
    const source = `let x: word = 0; let y: bool = x != 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word < 65535', () => {
    const source = `let x: word = 1000; let y: bool = x < 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word > 0', () => {
    const source = `let x: word = 1000; let y: bool = x > 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word <= 65535 (always true)', () => {
    const source = `let x: word = 65535; let y: bool = x <= 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word >= 0 (always true for unsigned)', () => {
    const source = `let x: word = 0; let y: bool = x >= 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Mixed Type Comparisons (Byte vs Word)
// =============================================================================

describe('Mixed Type Comparisons (Byte vs Word)', () => {
  it('should compare byte to word (promotion)', () => {
    const source = `let a: byte = 100; let b: word = 1000; let c: bool = a < b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word to byte (promotion)', () => {
    const source = `let a: word = 1000; let b: byte = 100; let c: bool = a > b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte == word', () => {
    const source = `let a: byte = 100; let b: word = 100; let c: bool = a == b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte != word', () => {
    const source = `let a: byte = 100; let b: word = 1000; let c: bool = a != b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare byte literal to word variable', () => {
    const source = `let w: word = 1000; let r: bool = 255 < w;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare word literal to byte variable', () => {
    const source = `let b: byte = 100; let r: bool = 1000 > b;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bool Comparisons
// =============================================================================

describe('Bool Comparisons', () => {
  it('should compare bool == true', () => {
    const source = `let x: bool = true; let y: bool = x == true;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare bool == false', () => {
    const source = `let x: bool = false; let y: bool = x == false;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare bool != true', () => {
    const source = `let x: bool = false; let y: bool = x != true;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare bool != false', () => {
    const source = `let x: bool = true; let y: bool = x != false;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare two bool variables', () => {
    const source = `let a: bool = true; let b: bool = false; let c: bool = a == b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare bool to bool literal', () => {
    const source = `let a: bool = true; let b: bool = a == true;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Chained Comparisons
// =============================================================================

describe('Chained Comparisons', () => {
  it('should handle comparison result in expression', () => {
    const source = `let a: byte = 10; let b: byte = 20; let c: bool = (a < b) == true;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle multiple comparisons with logical operators', () => {
    const source = `let a: byte = 10; let b: byte = 20; let c: byte = 15; let r: bool = a < c && c < b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle nested comparisons in ternary', () => {
    const source = `let a: byte = 10; let b: byte = 20; let r: byte = a < b ? 1 : 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Comparisons with Expressions
// =============================================================================

describe('Comparisons with Expressions', () => {
  it('should compare arithmetic result to value', () => {
    const source = `let a: byte = 10; let r: bool = a + 5 > 10;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare function result', () => {
    const source = `
      function getValue(): byte { return 50; }
      function main(): void {
        let r: bool = getValue() > 25;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare array element', () => {
    const source = `
      let arr: byte[3] = [10, 20, 30];
      let r: bool = arr[1] > arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should compare with parenthesized expression', () => {
    const source = `let a: byte = 10; let b: byte = 5; let r: bool = (a + b) == 15;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Edge Case: Comparing Same Value
// =============================================================================

describe('Comparing Same Value', () => {
  it('should allow x == x (always true)', () => {
    const source = `let x: byte = 100; let r: bool = x == x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow x != x (always false)', () => {
    const source = `let x: byte = 100; let r: bool = x != x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow x < x (always false)', () => {
    const source = `let x: byte = 100; let r: bool = x < x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow x <= x (always true)', () => {
    const source = `let x: byte = 100; let r: bool = x <= x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow x > x (always false)', () => {
    const source = `let x: byte = 100; let r: bool = x > x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow x >= x (always true)', () => {
    const source = `let x: byte = 100; let r: bool = x >= x;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Comparison Result Type
// =============================================================================

describe('Comparison Result Type', () => {
  it('should produce bool from byte comparison', () => {
    const source = `let a: byte = 10; let b: byte = 20; let r: bool = a < b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should produce bool from word comparison', () => {
    const source = `let a: word = 1000; let b: word = 2000; let r: bool = a < b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should produce bool from equality comparison', () => {
    const source = `let a: byte = 10; let b: byte = 10; let r: bool = a == b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should produce bool from inequality comparison', () => {
    const source = `let a: byte = 10; let b: byte = 20; let r: bool = a != b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should use comparison result in if condition', () => {
    const source = `
      function test(): void {
        let a: byte = 10;
        let b: byte = 20;
        if (a < b) {
          let x: byte = 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should use comparison result in while condition', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});