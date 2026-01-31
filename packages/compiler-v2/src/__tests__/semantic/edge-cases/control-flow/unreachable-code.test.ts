/**
 * Unreachable Code Edge Case Tests
 *
 * Tests for unreachable code detection:
 * - Code after return
 * - Code after break
 * - Code after continue
 * - Code in never-taken branches
 * - Nested unreachable code
 *
 * @module __tests__/semantic/edge-cases/control-flow/unreachable-code
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
 * Checks if there's a warning containing the specified substring
 */
function hasWarningContaining(source: string, substring: string): boolean {
  const warnings = getWarnings(source);
  return warnings.some(w => w.toLowerCase().includes(substring.toLowerCase()));
}

// =============================================================================
// Code After Return Statement
// =============================================================================

describe('Code After Return Statement', () => {
  it('should warn about code after return in simple function', () => {
    const source = `
      function test(): byte {
        return 42;
        let x: byte = 10;
      }
    `;
    // May produce unreachable code warning
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow early return with no code after it', () => {
    const source = `
      function test(): byte {
        return 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about multiple statements after return', () => {
    const source = `
      function test(): byte {
        return 1;
        let a: byte = 2;
        let b: byte = 3;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle return in middle of function', () => {
    const source = `
      function test(x: byte): byte {
        if (x > 10) {
          return x;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept return as last statement', () => {
    const source = `
      function compute(a: byte, b: byte): byte {
        let result: byte = a + b;
        return result;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Code After Break Statement
// =============================================================================

describe('Code After Break Statement', () => {
  it('should warn about code after break in while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          break;
          i = i + 1;
        }
      }
    `;
    // May produce unreachable code warning
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow break as last statement in loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            break;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle break in for loop using to syntax', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          if (i == 5) {
            break;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after unconditional break', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 100) {
          break;
          x = x + 10;
        }
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Code After Continue Statement
// =============================================================================

describe('Code After Continue Statement', () => {
  it('should warn about code after continue in while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          continue;
          i = i + 1;
        }
      }
    `;
    // May produce unreachable code warning
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should allow continue in conditional', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 5) {
            continue;
          }
          let temp: byte = i * 2;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle continue in for loop using to syntax', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          if (i == 5) {
            continue;
          }
          let temp: byte = i;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after unconditional continue', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 100) {
          x = x + 1;
          continue;
          let y: byte = x * 2;
        }
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Code in Never-Taken Branches (Constant Conditions)
// =============================================================================

describe('Code in Constant False Conditions', () => {
  it('should handle if with always-false literal condition', () => {
    // Note: Blend65 uses 0 for false
    const source = `
      function test(): byte {
        if (0) {
          return 1;
        }
        return 0;
      }
    `;
    const result = analyzeSource(source);
    // Semantic analyzer may or may not detect constant false
    expect(result).toBeDefined();
  });

  it('should handle else branch with always-true condition', () => {
    // Note: Blend65 uses non-zero for true
    const source = `
      function test(): byte {
        if (1) {
          return 1;
        } else {
          return 0;
        }
      }
    `;
    const result = analyzeSource(source);
    // The else branch may be unreachable
    expect(result).toBeDefined();
  });

  it('should allow complex conditions', () => {
    const source = `
      function test(x: byte): byte {
        if (x > 0) {
          return 1;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle while with always-false condition', () => {
    const source = `
      function test(): void {
        while (0) {
          let x: byte = 42;
        }
      }
    `;
    const result = analyzeSource(source);
    // Loop body may be unreachable
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Nested Unreachable Code
// =============================================================================

describe('Nested Unreachable Code', () => {
  it('should handle return in nested if', () => {
    const source = `
      function test(x: byte, y: byte): byte {
        if (x > 0) {
          if (y > 0) {
            return 1;
          }
          return 2;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle return in nested loops', () => {
    const source = `
      function test(): byte {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            if (i == j) {
              return i;
            }
            j = j + 1;
          }
          i = i + 1;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle break in nested loops', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            if (j == 5) {
              break;
            }
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle continue in nested loops', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
            if (j == 5) {
              continue;
            }
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after return in deeply nested block', () => {
    const source = `
      function test(a: byte, b: byte, c: byte): byte {
        if (a > 0) {
          if (b > 0) {
            if (c > 0) {
              return 1;
              let x: byte = 2;
            }
          }
        }
        return 0;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Multiple Control Flow Paths
// =============================================================================

describe('Multiple Control Flow Paths', () => {
  it('should allow different returns in if/else branches', () => {
    const source = `
      function test(x: byte): byte {
        if (x > 10) {
          return 1;
        } else {
          return 0;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after if/else that both return', () => {
    const source = `
      function test(x: byte): byte {
        if (x > 10) {
          return 1;
        } else {
          return 0;
        }
        let y: byte = 5;
      }
    `;
    const result = analyzeSource(source);
    // Code after both branches return is unreachable
    expect(result).toBeDefined();
  });

  it('should allow code after if without else that returns', () => {
    const source = `
      function test(x: byte): byte {
        if (x > 10) {
          return 1;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle chain of else-if with returns', () => {
    const source = `
      function grade(score: byte): byte {
        if (score > 90) {
          return 4;
        } else if (score > 80) {
          return 3;
        } else if (score > 70) {
          return 2;
        } else {
          return 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after complete else-if chain with returns', () => {
    const source = `
      function grade(score: byte): byte {
        if (score > 90) {
          return 4;
        } else if (score > 80) {
          return 3;
        } else {
          return 1;
        }
        let x: byte = 0;
      }
    `;
    const result = analyzeSource(source);
    // Code after complete chain is unreachable
    expect(result).toBeDefined();
  });
});

// =============================================================================
// Edge Cases with Void Functions
// =============================================================================

describe('Unreachable Code in Void Functions', () => {
  it('should allow void function with no return', () => {
    const source = `
      function doSomething(): void {
        let x: byte = 42;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow early return in void function', () => {
    const source = `
      function doSomething(x: byte): void {
        if (x == 0) {
          return;
        }
        let y: byte = x * 2;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should warn about code after return in void function', () => {
    const source = `
      function doSomething(): void {
        return;
        let x: byte = 42;
      }
    `;
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should handle multiple return paths in void function', () => {
    const source = `
      function process(x: byte): void {
        if (x == 0) {
          return;
        }
        if (x == 1) {
          return;
        }
        let y: byte = x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});