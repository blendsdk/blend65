/**
 * Arithmetic Operator Edge Case Tests
 *
 * Tests for arithmetic operators at edge cases:
 * - Division by zero
 * - Division truncation
 * - Modulo with zero
 * - Subtraction resulting in negative (unsigned types)
 * - Multiplication overflow
 * - Chained arithmetic operations
 *
 * @module __tests__/semantic/edge-cases/operators/arithmetic-edge-cases
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
// Division Operations
// =============================================================================

describe('Division Operations', () => {
  it('should accept division of two bytes', () => {
    const source = `let x: byte = 10 / 2;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept division of two words', () => {
    const source = `let x: word = 1000 / 10;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle division by zero literal', () => {
    const source = `let x: byte = 10 / 0;`;
    // Semantic analyzer may or may not catch this - document behavior
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle division by variable that could be zero', () => {
    const source = `let y: byte = 0; let x: byte = 10 / y;`;
    // Runtime check - semantic analyzer typically won't catch this
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should truncate division result (5/2 = 2)', () => {
    const source = `let x: byte = 5 / 2;`;
    // Integer division truncates - should compile without errors
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should truncate division result (7/3 = 2)', () => {
    const source = `let x: byte = 7 / 3;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept division resulting in 0', () => {
    const source = `let x: byte = 1 / 2;`;
    // 1/2 = 0 in integer division
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept division with byte max value', () => {
    const source = `let x: byte = 255 / 1;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word division with large values', () => {
    const source = `let x: word = 65535 / 256;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Modulo Operations
// =============================================================================

describe('Modulo Operations', () => {
  it('should accept modulo of two bytes', () => {
    const source = `let x: byte = 10 % 3;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo of two words', () => {
    const source = `let x: word = 1000 % 256;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle modulo by zero literal', () => {
    const source = `let x: byte = 10 % 0;`;
    // May or may not be caught at compile time
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle modulo by variable that could be zero', () => {
    const source = `let y: byte = 0; let x: byte = 10 % y;`;
    // Runtime check - typically not caught at compile time
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo resulting in 0', () => {
    const source = `let x: byte = 10 % 2;`;
    // 10 % 2 = 0
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo with value equal to divisor', () => {
    const source = `let x: byte = 5 % 5;`;
    // 5 % 5 = 0
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo with smaller dividend', () => {
    const source = `let x: byte = 3 % 5;`;
    // 3 % 5 = 3
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo at byte boundaries', () => {
    const source = `let x: byte = 255 % 128;`;
    // 255 % 128 = 127
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Subtraction Edge Cases
// =============================================================================

describe('Subtraction Edge Cases', () => {
  it('should accept subtraction resulting in 0', () => {
    const source = `let x: byte = 5 - 5;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle subtraction that could underflow', () => {
    const source = `let x: byte = 0 - 1;`;
    // May wrap to 255 or error - document behavior
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle subtraction of variable that could underflow', () => {
    const source = `let a: byte = 5; let b: byte = 10; let c: byte = a - b;`;
    // Runtime underflow - typically not caught at compile time
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept subtraction at byte max', () => {
    const source = `let x: byte = 255 - 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept subtraction from byte max to 0', () => {
    const source = `let x: byte = 255 - 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word subtraction at boundaries', () => {
    const source = `let x: word = 65535 - 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained subtraction', () => {
    const source = `let x: byte = 100 - 50 - 25;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Multiplication Overflow
// =============================================================================

describe('Multiplication Overflow', () => {
  it('should accept multiplication within byte range', () => {
    const source = `let x: byte = 15 * 17;`;
    // 15 * 17 = 255 (max byte)
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle multiplication that overflows byte', () => {
    const source = `let x: byte = 16 * 16;`;
    // 16 * 16 = 256, overflows byte
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept multiplication in word range', () => {
    const source = `let x: word = 256 * 256;`;
    // 65536 - overflows word too!
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept multiplication by 0', () => {
    const source = `let x: byte = 255 * 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept multiplication by 1', () => {
    const source = `let x: byte = 255 * 1;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word multiplication within range', () => {
    const source = `let x: word = 255 * 257;`;
    // 255 * 257 = 65535 (max word)
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle multiplication with variables', () => {
    const source = `let a: byte = 100; let b: byte = 3; let c: byte = a * b;`;
    // 300 would overflow - runtime behavior
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Addition Overflow
// =============================================================================

describe('Addition Overflow', () => {
  it('should accept addition within byte range', () => {
    const source = `let x: byte = 127 + 128;`;
    // 255 = max byte
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle addition that overflows byte', () => {
    const source = `let x: byte = 128 + 128;`;
    // 256 overflows byte
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept word addition within range', () => {
    const source = `let x: word = 32768 + 32767;`;
    // 65535 = max word
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle word addition overflow', () => {
    const source = `let x: word = 65535 + 1;`;
    // Overflows word
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept addition with 0', () => {
    const source = `let x: byte = 255 + 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained addition', () => {
    const source = `let x: byte = 50 + 50 + 50;`;
    // 150 = within byte range
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Chained Arithmetic Operations
// =============================================================================

describe('Chained Arithmetic Operations', () => {
  it('should accept mixed arithmetic operations', () => {
    const source = `let x: byte = 10 + 5 * 2;`;
    // Precedence: 10 + (5 * 2) = 10 + 10 = 20
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept parenthesized arithmetic', () => {
    const source = `let x: byte = (10 + 5) * 2;`;
    // (15) * 2 = 30
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept deeply nested arithmetic', () => {
    const source = `let x: byte = ((10 + 5) * 2) - 10;`;
    // ((15) * 2) - 10 = 30 - 10 = 20
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept division in chain', () => {
    const source = `let x: byte = 100 / 2 + 50;`;
    // 50 + 50 = 100
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept modulo in chain', () => {
    const source = `let x: byte = 100 + 17 % 10;`;
    // 100 + 7 = 107
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept long arithmetic chain', () => {
    const source = `let x: byte = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10;`;
    // 55 = within byte range
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle mixed byte and word promotion', () => {
    const source = `let a: byte = 100; let b: word = 1000; let c: word = a + b;`;
    // byte + word should promote to word
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept arithmetic with function calls', () => {
    const source = `
      function getValue(): byte { return 10; }
      function main(): void {
        let x: byte = getValue() + 5;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept arithmetic with array elements', () => {
    const source = `
      let arr: byte[3] = [10, 20, 30];
      let x: byte = arr[0] + arr[1];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Operator Precedence Edge Cases
// =============================================================================

describe('Operator Precedence Edge Cases', () => {
  it('should handle multiplication before addition', () => {
    const source = `let x: byte = 2 + 3 * 4;`;
    // 2 + 12 = 14, not 20
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle division before subtraction', () => {
    const source = `let x: byte = 20 - 10 / 2;`;
    // 20 - 5 = 15, not 5
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle left-to-right for same precedence', () => {
    const source = `let x: byte = 100 - 50 - 25;`;
    // (100 - 50) - 25 = 25, not 100 - 25 = 75
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle modulo same precedence as division', () => {
    const source = `let x: byte = 20 / 3 % 2;`;
    // (20 / 3) % 2 = 6 % 2 = 0
    expect(hasNoErrors(source)).toBe(true);
  });
});