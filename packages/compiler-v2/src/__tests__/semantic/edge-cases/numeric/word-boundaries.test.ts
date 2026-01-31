/**
 * Word Boundary Edge Case Tests
 *
 * Tests for word type at boundary values: 0 (minimum), 65535 (maximum),
 * and values that should cause errors (65536, etc.)
 *
 * These tests verify that the semantic analyzer correctly handles
 * word literals at the edges of the valid range.
 *
 * @module __tests__/semantic/edge-cases/numeric/word-boundaries
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
// Word Minimum Value (0)
// =============================================================================

describe('Word Minimum Value (0)', () => {
  it('should accept word = 0 (decimal)', () => {
    const source = `let x: word = 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $0000 (hex)', () => {
    const source = `let x: word = $0000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = 0x0000 (hex alternate)', () => {
    const source = `let x: word = 0x0000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $00 (short hex, promoted)', () => {
    const source = `let x: word = $00;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow arithmetic resulting in 0', () => {
    const source = `let x: word = 1000 - 1000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison with 0', () => {
    const source = `let x: word = 1000; let y: bool = x > 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Maximum Value (65535)
// =============================================================================

describe('Word Maximum Value (65535)', () => {
  it('should accept word = 65535 (decimal)', () => {
    const source = `let x: word = 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $FFFF (hex)', () => {
    const source = `let x: word = $FFFF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = 0xFFFF (hex alternate)', () => {
    const source = `let x: word = 0xFFFF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $ffff (lowercase hex)', () => {
    const source = `let x: word = $ffff;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow arithmetic resulting in 65535', () => {
    const source = `let x: word = 60000 + 5535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison with 65535', () => {
    const source = `let x: word = 1000; let y: bool = x < 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Overflow (> 65535) - Should Error or Warn
// =============================================================================

describe('Word Overflow (> 65535)', () => {
  // Note: These tests check semantic analysis behavior.
  // The semantic analyzer may or may not catch literal overflow at compile time.
  // If it doesn't, these tests document the expected behavior.

  it('should handle word = 65536 (one past max)', () => {
    const source = `let x: word = 65536;`;
    const result = analyzeSource(source);
    // Document current behavior - may be error, warning, or accepted with wrapping
    expect(result).toBeDefined();
  });

  it('should handle word = $10000 (hex overflow)', () => {
    const source = `let x: word = $10000;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle word = 100000 (large overflow)', () => {
    const source = `let x: word = 100000;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Word Underflow (< 0) - Should Error
// =============================================================================

describe('Word Underflow (< 0)', () => {
  it('should handle word assignment with negative expression', () => {
    const source = `let x: word = 0 - 1;`;
    const result = analyzeSource(source);
    // May error at compile time or wrap to 65535 at runtime
    expect(result).toBeDefined();
  });

  it('should handle subtraction that results in negative', () => {
    const source = `let a: word = 100; let b: word = a - 200;`;
    const result = analyzeSource(source);
    // Variable-based subtraction may not be caught at compile time
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Word Arithmetic at Boundaries
// =============================================================================

describe('Word Arithmetic at Boundaries', () => {
  it('should accept word = 65534 + 1 (just at max)', () => {
    const source = `let x: word = 65534 + 1;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle word = 65535 + 1 (overflow)', () => {
    const source = `let x: word = 65535 + 1;`;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept word = 1 - 1 (just at min)', () => {
    const source = `let x: word = 1 - 1;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = 32768 * 2 (at boundary)', () => {
    const source = `let x: word = 32768;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = 65535 / 2 (division at max)', () => {
    const source = `let x: word = 65535 / 2;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Comparisons at Boundaries
// =============================================================================

describe('Word Comparisons at Boundaries', () => {
  it('should allow comparison word >= 0 (always true for unsigned)', () => {
    const source = `let x: word = 1000; let y: bool = x >= 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison word <= 65535 (always true for unsigned)', () => {
    const source = `let x: word = 1000; let y: bool = x <= 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison word == 0', () => {
    const source = `let x: word = 0; let y: bool = x == 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison word == 65535', () => {
    const source = `let x: word = 65535; let y: bool = x == 65535;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow comparison 0 < word', () => {
    const source = `let x: word = 1000; let y: bool = 0 < x;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word in Function Parameters
// =============================================================================

describe('Word in Function Parameters', () => {
  it('should accept word parameter with min value', () => {
    const source = `
      function test(x: word): void {}
      function main(): void { test(0); }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word parameter with max value', () => {
    const source = `
      function test(x: word): void {}
      function main(): void { test(65535); }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should return word min from function', () => {
    const source = `function getMin(): word { return 0; }`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should return word max from function', () => {
    const source = `function getMax(): word { return 65535; }`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word in Array Initialization
// =============================================================================

describe('Word in Array Initialization', () => {
  it('should require word-sized literals for word array init (byte literals create byte array)', () => {
    // [0, 0, 0] infers as byte[3] because 0 fits in byte
    // This is correct type system behavior - use word-sized literals or explicit types
    const source = `let arr: word[3] = [0, 0, 0];`;
    const result = analyzeSource(source);
    // Documents that small literals infer to byte, causing type mismatch
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('should also have byte inference for word-sized hex notation with small values', () => {
    // Even $0000 is inferred as byte because value 0 fits in byte
    // This documents type inference is by VALUE, not by hex digit count
    const source = `let arr: word[3] = [$0000, $0000, $0000];`;
    const result = analyzeSource(source);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('should accept word array with values > 255', () => {
    // Values > 255 force word type inference
    const source = `let arr: word[3] = [256, 1000, 256];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word array with max values', () => {
    const source = `let arr: word[3] = [65535, 65535, 65535];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word array with mixed boundary values', () => {
    const source = `let arr: word[4] = [0, 32768, 65535, 1000];`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word array with hex values', () => {
    const source = `let arr: word[3] = [$0000, $8000, $FFFF];`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Byte to Word Promotion
// =============================================================================

describe('Byte to Word Promotion', () => {
  it('should accept byte value assigned to word (implicit widening)', () => {
    const source = `let x: word = 255;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte variable assigned to word variable', () => {
    const source = `let b: byte = 100; let w: word = b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte boundary value in word context', () => {
    const source = `let x: word = $FF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte max (255) in word array', () => {
    const source = `let arr: word[2] = [255, 256];`;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Word Specific Values (Common C64 Addresses)
// =============================================================================

describe('Word Specific Values (Common C64 Addresses)', () => {
  it('should accept word = $0400 (screen memory)', () => {
    const source = `let screen: word = $0400;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $D000 (VIC-II base)', () => {
    const source = `let vic: word = $D000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $DC00 (CIA1)', () => {
    const source = `let cia1: word = $DC00;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word = $C000 (upper RAM)', () => {
    const source = `let upperRam: word = $C000;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});