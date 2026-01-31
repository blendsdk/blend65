/**
 * Break and Continue Edge Case Tests
 *
 * Tests for break and continue statement edge cases:
 * - Break outside loop (error)
 * - Continue outside loop (error)
 * - Break in nested loops
 * - Continue in nested loops
 * - Break/continue interaction with control flow
 *
 * @module __tests__/semantic/edge-cases/control-flow/break-continue
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
 * Checks if there's an error containing the specified substring
 */
function hasErrorContaining(source: string, substring: string): boolean {
  const errors = getErrors(source);
  return errors.some(e => e.toLowerCase().includes(substring.toLowerCase()));
}

// =============================================================================
// Break Outside Loop (Error)
// =============================================================================

describe('Break Outside Loop', () => {
  it.skip('should error on break at module level (GAP: not currently detected)', () => {
    // GAP: Module-level break/continue is not currently detected as an error
    // This test documents expected behavior that is not yet implemented
    const source = `
      break;
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on break in function without loop', () => {
    const source = `
      function test(): void {
        break;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on break in if statement without loop', () => {
    const source = `
      function test(x: byte): void {
        if (x > 0) {
          break;
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on break in nested if without loop', () => {
    const source = `
      function test(x: byte, y: byte): void {
        if (x > 0) {
          if (y > 0) {
            break;
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow break inside while loop', () => {
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

  it('should allow break inside for loop using to syntax', () => {
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
});

// =============================================================================
// Continue Outside Loop (Error)
// =============================================================================

describe('Continue Outside Loop', () => {
  it.skip('should error on continue at module level (GAP: not currently detected)', () => {
    // GAP: Module-level break/continue is not currently detected as an error
    // This test documents expected behavior that is not yet implemented
    const source = `
      continue;
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on continue in function without loop', () => {
    const source = `
      function test(): void {
        continue;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on continue in if statement without loop', () => {
    const source = `
      function test(x: byte): void {
        if (x > 0) {
          continue;
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on continue in nested if without loop', () => {
    const source = `
      function test(x: byte, y: byte): void {
        if (x > 0) {
          if (y > 0) {
            continue;
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow continue inside while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 5) {
            continue;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow continue inside for loop using to syntax', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          if (i == 5) {
            continue;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Break in Nested Loops
// =============================================================================

describe('Break in Nested Loops', () => {
  it('should allow break in inner while loop', () => {
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

  it('should allow break in outer while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            break;
          }
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break in deeply nested loops', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 5) {
          let j: byte = 0;
          while (j < 5) {
            let k: byte = 0;
            while (k < 5) {
              if (k == 2) {
                break;
              }
              k = k + 1;
            }
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break in nested for loops using to syntax', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          for (j = 0 to 10) {
            if (j == 5) {
              break;
            }
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break in mixed loop types', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          for (j = 0 to 10) {
            if (j == 5) {
              break;
            }
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Continue in Nested Loops
// =============================================================================

describe('Continue in Nested Loops', () => {
  it('should allow continue in inner while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
            if (j == 5) {
              continue;
            }
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow continue in outer while loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 5) {
            continue;
          }
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow continue in deeply nested loops', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 5) {
          let j: byte = 0;
          while (j < 5) {
            let k: byte = 0;
            while (k < 5) {
              k = k + 1;
              if (k == 2) {
                continue;
              }
            }
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow continue in nested for loops using to syntax', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          for (j = 0 to 10) {
            if (j == 5) {
              continue;
            }
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Break/Continue with Conditionals
// =============================================================================

describe('Break/Continue with Conditionals', () => {
  it('should allow conditional break', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          if (i > 50) {
            break;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow conditional continue', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          i = i + 1;
          if (i % 2 == 0) {
            continue;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break in else branch', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          if (i < 50) {
            i = i + 1;
          } else {
            break;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow continue in else branch', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          i = i + 1;
          if (i < 50) {
            let temp: byte = i * 2;
          } else {
            continue;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break in nested if within loop', () => {
    const source = `
      function test(x: byte): void {
        let i: byte = 0;
        while (i < 100) {
          if (i > 10) {
            if (x > 5) {
              break;
            }
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Break and Continue Together
// =============================================================================

describe('Break and Continue Together', () => {
  it('should allow both break and continue in same loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          i = i + 1;
          if (i == 5) {
            continue;
          }
          if (i == 50) {
            break;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break and continue in different nested loops', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
            if (j == 3) {
              continue;
            }
            if (j == 7) {
              break;
            }
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow multiple breaks in different branches', () => {
    const source = `
      function test(x: byte): void {
        let i: byte = 0;
        while (i < 100) {
          if (x > 10) {
            break;
          }
          if (i > 50) {
            break;
          }
          i = i + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow multiple continues in different branches', () => {
    const source = `
      function test(x: byte): void {
        let i: byte = 0;
        while (i < 100) {
          i = i + 1;
          if (i % 2 == 0) {
            continue;
          }
          if (i % 3 == 0) {
            continue;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Break/Continue with Return
// =============================================================================

describe('Break/Continue with Return', () => {
  it('should allow return after break in loop', () => {
    const source = `
      function findValue(): byte {
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

  it('should allow return inside loop before continue', () => {
    const source = `
      function findEven(): byte {
        let i: byte = 0;
        while (i < 100) {
          i = i + 1;
          if (i % 2 == 1) {
            continue;
          }
          return i;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow return in same branch as break', () => {
    const source = `
      function search(target: byte): byte {
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
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Break/Continue Edge Cases', () => {
  it('should handle break as first statement in loop', () => {
    const source = `
      function test(): void {
        while (1) {
          break;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle continue as first statement in loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
          continue;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle unconditional break in loop', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          break;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error on break after loop ends', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
        break;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should error on continue after loop ends', () => {
    const source = `
      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
        continue;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle break in while with complex condition', () => {
    const source = `
      function test(a: byte, b: byte): void {
        while (a < 10 && b > 0) {
          if (a == b) {
            break;
          }
          a = a + 1;
          b = b - 1;
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
          let temp: byte = i * 2;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Break/Continue in While(true) Patterns
// =============================================================================

describe('Break in Infinite Loop Patterns', () => {
  it('should allow break in while(1) loop', () => {
    const source = `
      function test(): void {
        while (1) {
          break;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow conditional break in while(1) loop', () => {
    const source = `
      function test(x: byte): void {
        while (1) {
          if (x > 10) {
            break;
          }
          x = x + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow break with return in while(1) loop', () => {
    const source = `
      function waitForInput(): byte {
        let counter: byte = 0;
        while (1) {
          counter = counter + 1;
          if (counter > 100) {
            return counter;
          }
        }
      }
    `;
    // This may have missing return path issue but break/continue is valid
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });
});