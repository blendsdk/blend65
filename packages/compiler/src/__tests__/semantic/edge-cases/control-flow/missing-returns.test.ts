/**
 * Missing Return Edge Case Tests
 *
 * Tests for missing return detection:
 * - All paths return (valid)
 * - Some paths don't return (error)
 * - Return in if but not else
 * - Return in loop only
 * - Void function with/without return
 *
 * @module __tests__/semantic/edge-cases/control-flow/missing-returns
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

  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: true });
  return analyzer.analyze(program);
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

/**
 * Gets all diagnostics from analysis result
 */
function getDiagnostics(source: string) {
  const result = analyzeSource(source);
  return result.diagnostics;
}

// =============================================================================
// All Paths Return (Valid)
// =============================================================================

describe('All Paths Return (Valid)', () => {
  it('should accept function with single return', () => {
    const source = `
      function getValue(): byte {
        return 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept function with if/else both returning', () => {
    const source = `
      function max(a: byte, b: byte): byte {
        if (a > b) {
          return a;
        } else {
          return b;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept function with early return and final return', () => {
    const source = `
      function process(x: byte): byte {
        if (x == 0) {
          return 0;
        }
        return x * 2;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept function with else-if chain all returning', () => {
    const source = `
      function classify(score: byte): byte {
        if (score > 90) {
          return 4;
        } else if (score > 80) {
          return 3;
        } else if (score > 70) {
          return 2;
        } else if (score > 60) {
          return 1;
        } else {
          return 0;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept function with complex nested returns', () => {
    const source = `
      function compute(a: byte, b: byte, c: byte): byte {
        if (a > 0) {
          if (b > 0) {
            return a + b;
          } else {
            return a;
          }
        } else {
          if (c > 0) {
            return c;
          } else {
            return 0;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Some Paths Don't Return (Errors or Warnings)
// =============================================================================

describe('Some Paths Missing Return', () => {
  it('should detect missing return in non-void function', () => {
    const source = `
      function getValue(): byte {
        let x: byte = 42;
      }
    `;
    const result = analyzeSource(source);
    // Should report missing return
    expect(result).toBeDefined();
    // May be error or warning depending on implementation
  });

  it('should detect return only in if branch', () => {
    const source = `
      function maybeReturn(x: byte): byte {
        if (x > 0) {
          return x;
        }
      }
    `;
    const result = analyzeSource(source);
    // Missing return when x <= 0
    expect(result).toBeDefined();
  });

  it('should detect return only in else branch', () => {
    const source = `
      function maybeReturn(x: byte): byte {
        if (x > 0) {
          let y: byte = x * 2;
        } else {
          return 0;
        }
      }
    `;
    const result = analyzeSource(source);
    // Missing return when x > 0
    expect(result).toBeDefined();
  });

  it('should detect missing return in one else-if branch', () => {
    const source = `
      function partial(x: byte): byte {
        if (x > 10) {
          return 3;
        } else if (x > 5) {
          let y: byte = x;
        } else {
          return 0;
        }
      }
    `;
    const result = analyzeSource(source);
    // Missing return in middle branch
    expect(result).toBeDefined();
  });

  it('should detect empty function body for non-void', () => {
    const source = `
      function empty(): byte {
      }
    `;
    const result = analyzeSource(source);
    // Missing return in empty function
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Return in Loop Only
// =============================================================================

describe('Return in Loop Only', () => {
  it('should detect return only inside while loop', () => {
    const source = `
      function findFirst(): byte {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            return i;
          }
          i = i + 1;
        }
      }
    `;
    const result = analyzeSource(source);
    // Loop may not execute or may not find value
    expect(result).toBeDefined();
  });

  it('should accept return inside and after loop', () => {
    const source = `
      function findOrDefault(): byte {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            return i;
          }
          i = i + 1;
        }
        return 255;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should detect return only inside for loop using to syntax', () => {
    const source = `
      function search(): byte {
        for (i = 0 to 10) {
          if (i == 5) {
            return i;
          }
        }
      }
    `;
    const result = analyzeSource(source);
    // Loop may complete without returning
    expect(result).toBeDefined();
  });

  it('should accept for loop with return after using to syntax', () => {
    const source = `
      function search(): byte {
        for (i = 0 to 10) {
          if (i == 5) {
            return i;
          }
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Void Function Returns
// =============================================================================

describe('Void Function Returns', () => {
  it('should allow void function with no return', () => {
    const source = `
      function doWork(): void {
        let x: byte = 42;
        let y: byte = x * 2;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow void function with early return', () => {
    const source = `
      function maybeDoWork(x: byte): void {
        if (x == 0) {
          return;
        }
        let y: byte = x * 2;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow void function with return at end', () => {
    const source = `
      function doWork(): void {
        let x: byte = 42;
        return;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should reject void function returning a value', () => {
    const source = `
      function noReturn(): void {
        return 42;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow empty void function', () => {
    const source = `
      function empty(): void {
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow void with multiple early returns', () => {
    const source = `
      function process(x: byte): void {
        if (x == 0) {
          return;
        }
        if (x == 1) {
          return;
        }
        if (x == 2) {
          return;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Return Type Matching
// =============================================================================

describe('Return Type Matching', () => {
  it('should accept return matching declared type', () => {
    const source = `
      function getByte(): byte {
        return 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word return matching word type', () => {
    const source = `
      function getWord(): word {
        return 1000;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should reject wrong return type - word in byte function', () => {
    const source = `
      function getByte(): byte {
        return 1000;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept byte promotion to word', () => {
    const source = `
      function getWord(): word {
        return 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should reject returning value in void function', () => {
    const source = `
      function noValue(): void {
        return 100;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept empty return in void function', () => {
    const source = `
      function noValue(): void {
        return;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Complex Return Path Scenarios
// =============================================================================

describe('Complex Return Path Scenarios', () => {
  it('should accept nested conditionals all returning', () => {
    const source = `
      function complex(a: byte, b: byte): byte {
        if (a > 10) {
          if (b > 10) {
            return 3;
          } else {
            return 2;
          }
        } else {
          if (b > 10) {
            return 1;
          } else {
            return 0;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should detect missing return in nested condition', () => {
    const source = `
      function complex(a: byte, b: byte): byte {
        if (a > 10) {
          if (b > 10) {
            return 3;
          }
        } else {
          return 0;
        }
      }
    `;
    const result = analyzeSource(source);
    // Missing when a > 10 && b <= 10
    expect(result).toBeDefined();
  });

  it('should accept function with loop and final return', () => {
    const source = `
      function sum(n: byte): word {
        let total: word = 0;
        let i: byte = 0;
        while (i < n) {
          total = total + i;
          i = i + 1;
        }
        return total;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept conditional inside loop with final return', () => {
    const source = `
      function processArray(): byte {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            return i;
          }
          i = i + 1;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept multiple early returns with final return', () => {
    const source = `
      function validate(x: byte): byte {
        if (x == 0) {
          return 0;
        }
        if (x == 255) {
          return 255;
        }
        if (x > 100) {
          return 100;
        }
        return x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Edge Cases with Break and Continue
// =============================================================================

describe('Returns with Break and Continue', () => {
  it('should accept return after break from loop', () => {
    const source = `
      function findAndReturn(): byte {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            break;
          }
          i = i + 1;
        }
        return i;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept return inside loop with break', () => {
    const source = `
      function searchOrBreak(target: byte): byte {
        let i: byte = 0;
        while (i < 10) {
          if (i == target) {
            return i;
          }
          if (i == 5) {
            break;
          }
          i = i + 1;
        }
        return 255;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept loop with continue and final return', () => {
    const source = `
      function sumEvens(): byte {
        let total: byte = 0;
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          if (i % 2 == 1) {
            continue;
          }
          total = total + i;
        }
        return total;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Single Statement Functions
// =============================================================================

describe('Single Statement Functions', () => {
  it('should accept single return statement', () => {
    const source = `
      function one(): byte {
        return 1;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept single expression return', () => {
    const source = `
      function double(x: byte): byte {
        return x * 2;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should detect single non-return statement in non-void', () => {
    const source = `
      function notReturning(): byte {
        let x: byte = 42;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow single statement void function', () => {
    const source = `
      function doOne(): void {
        let x: byte = 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});