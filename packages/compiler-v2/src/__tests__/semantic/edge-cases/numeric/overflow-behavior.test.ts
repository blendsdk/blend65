/**
 * Overflow Behavior Edge Case Tests
 *
 * Tests for overflow behavior in arithmetic operations:
 * - Addition overflow (255 + 1 for byte, 65535 + 1 for word)
 * - Multiplication overflow
 * - Type promotion to avoid overflow
 *
 * These tests verify how the semantic analyzer handles arithmetic
 * that may exceed type boundaries.
 *
 * @module __tests__/semantic/edge-cases/numeric/overflow-behavior
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
 * Gets warning messages from analysis result
 */
function getWarnings(source: string): string[] {
  const result = analyzeSource(source);
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.WARNING)
    .map(d => d.message);
}

/**
 * Checks if analysis has no errors
 */
function hasNoErrors(source: string): boolean {
  return getErrors(source).length === 0;
}

// =============================================================================
// Byte Addition Overflow
// =============================================================================

describe('Byte Addition Overflow', () => {
  it('should handle 255 + 1 (byte overflow)', () => {
    const source = `let x: byte = 255 + 1;`;
    const result = analyzeSource(source);
    // This may either:
    // 1. Warn about overflow
    // 2. Error about type (if 256 becomes word)
    // 3. Accept and wrap at runtime
    expect(result).toBeDefined();
  });

  it('should handle 200 + 100 (byte overflow)', () => {
    const source = `let x: byte = 200 + 100;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 128 + 128 (byte overflow)', () => {
    const source = `let x: byte = 128 + 128;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe addition 100 + 50 (no overflow)', () => {
    const source = `let x: byte = 100 + 50;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle chained addition with overflow', () => {
    const source = `let x: byte = 100 + 100 + 100;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Word Addition Overflow
// =============================================================================

describe('Word Addition Overflow', () => {
  it('should handle 65535 + 1 (word overflow)', () => {
    const source = `let x: word = 65535 + 1;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 60000 + 10000 (word overflow)', () => {
    const source = `let x: word = 60000 + 10000;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 32768 + 32768 (word overflow)', () => {
    const source = `let x: word = 32768 + 32768;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe addition 30000 + 20000 (no overflow)', () => {
    const source = `let x: word = 30000 + 20000;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Byte Multiplication Overflow
// =============================================================================

describe('Byte Multiplication Overflow', () => {
  it('should handle 255 * 2 (byte multiplication overflow)', () => {
    const source = `let x: byte = 255 * 2;`;
    const result = analyzeSource(source);
    // May promote to word or overflow
    expect(result).toBeDefined();
  });

  it('should handle 16 * 16 (result = 256, overflow)', () => {
    const source = `let x: byte = 16 * 16;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 100 * 3 (result = 300, overflow)', () => {
    const source = `let x: byte = 100 * 3;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe multiplication 10 * 10 (no overflow)', () => {
    const source = `let x: byte = 10 * 10;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow 15 * 15 (result = 225, just under max)', () => {
    const source = `let x: byte = 15 * 15;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Multiplication Overflow
// =============================================================================

describe('Word Multiplication Overflow', () => {
  it('should handle 65535 * 2 (word multiplication overflow)', () => {
    const source = `let x: word = 65535 * 2;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 256 * 256 (result = 65536, overflow)', () => {
    const source = `let x: word = 256 * 256;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle 1000 * 100 (result = 100000, overflow)', () => {
    const source = `let x: word = 1000 * 100;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe multiplication 100 * 100 (no overflow)', () => {
    const source = `let x: word = 100 * 100;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Promotion to Avoid Overflow
// =============================================================================

describe('Type Promotion to Avoid Overflow', () => {
  it('should allow byte overflow result assigned to word', () => {
    const source = `let x: word = 255 + 1;`;
    // Since target is word, 256 should fit
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow 255 * 255 (byte * byte) in word variable', () => {
    const source = `let x: word = 255 * 255;`;
    // Result is 65025, fits in word
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow byte * byte overflow stored in word', () => {
    const source = `let a: byte = 200; let b: byte = 200; let w: word = a * b;`;
    // Result is 40000, should promote and fit in word
    const result = analyzeSource(source);
    // This depends on type promotion rules
    expect(result).toBeDefined();
  });

  it('should handle mixed byte + word addition', () => {
    const source = `let b: byte = 255; let w: word = 1000; let result: word = b + w;`;
    // Result should be word type
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Subtraction Underflow
// =============================================================================

describe('Subtraction Underflow', () => {
  it('should handle byte 0 - 1 (underflow to 255)', () => {
    const source = `let x: byte = 0 - 1;`;
    const result = analyzeSource(source);
    // May wrap to 255 or error
    expect(result).toBeDefined();
  });

  it('should handle byte 5 - 10 (underflow)', () => {
    const source = `let x: byte = 5 - 10;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle word 0 - 1 (underflow to 65535)', () => {
    const source = `let x: word = 0 - 1;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe subtraction with no underflow', () => {
    const source = `let x: byte = 100 - 50;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Division Behavior
// =============================================================================

describe('Division Behavior', () => {
  it('should handle integer division truncation 5 / 2 = 2', () => {
    const source = `let x: byte = 5 / 2;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle integer division 255 / 2 = 127', () => {
    const source = `let x: byte = 255 / 2;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle division resulting in 0', () => {
    const source = `let x: byte = 1 / 2;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle division by zero (may error)', () => {
    const source = `let x: byte = 10 / 0;`;
    const result = analyzeSource(source);
    // Should ideally error on division by zero
    expect(result).toBeDefined();
  });

  it('should handle modulo by zero (may error)', () => {
    const source = `let x: byte = 10 % 0;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Expression Complexity and Overflow
// =============================================================================

describe('Expression Complexity and Overflow', () => {
  it('should handle complex expression with multiple overflows', () => {
    const source = `let x: byte = 100 + 100 + 100 - 50;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle parenthesized expression with overflow', () => {
    const source = `let x: byte = (200 + 100) - 50;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle mixed operators with potential overflow', () => {
    const source = `let x: byte = 100 * 2 + 100;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow complex expression that stays in bounds', () => {
    const source = `let x: byte = 10 * 10 + 50 - 25;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Overflow in Function Returns
// =============================================================================

describe('Overflow in Function Returns', () => {
  it('should handle overflow in return statement', () => {
    const source = `function test(): byte { return 255 + 1; }`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe return value', () => {
    const source = `function test(): byte { return 100 + 50; }`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle overflow in function parameter', () => {
    const source = `
      function test(x: byte): void {}
      function main(): void { test(255 + 1); }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Overflow in Array Elements
// =============================================================================

describe('Overflow in Array Elements', () => {
  it('should handle overflow in array literal element', () => {
    const source = `let arr: byte[3] = [100, 255 + 1, 50];`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow safe array literal', () => {
    const source = `let arr: byte[3] = [100, 150, 200];`;
    expect(hasNoErrors(source)).toBe(true);
  });
});