/**
 * Type Narrowing Edge Case Tests
 *
 * Tests for type narrowing and type inference in different contexts:
 * - Type consistency after type guard-like patterns
 * - Type in if/else branches
 * - Type in loop contexts
 * - Type inference from usage patterns
 * - Type preservation through control flow
 *
 * Note: Blend65 is statically typed without type guards like TypeScript,
 * but we test that types are properly tracked through control flow.
 *
 * @module __tests__/semantic/edge-cases/types/type-narrowing
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

/**
 * Checks if analysis has errors
 */
function hasErrors(source: string): boolean {
  return getErrors(source).length > 0;
}

// =============================================================================
// Type Consistency in If Branches
// =============================================================================

describe('Type Consistency in If Branches', () => {
  it('should maintain type in if branch', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
        if (x > 50) {
          let y: byte = x;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should maintain type in else branch', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
        if (x > 50) {
          let y: byte = 1;
        } else {
          let z: byte = x;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should maintain type across if-else', () => {
    const source = `
      function test(): byte {
        let x: byte = 100;
        if (x > 50) {
          return x;
        } else {
          return x;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track variable assignment in if branch', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        let flag: bool = true;
        if (flag) {
          x = 100;
        }
        let y: byte = x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error if using wrong type in branch', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
        if (x > 50) {
          let w: word = 1000;
          x = w;
        }
      }
    `;
    expect(hasErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency in Nested If Branches
// =============================================================================

describe('Type Consistency in Nested If Branches', () => {
  it('should maintain type in nested if', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
        if (x > 50) {
          if (x > 75) {
            let y: byte = x;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should maintain type through multiple levels', () => {
    const source = `
      function test(): byte {
        let x: byte = 100;
        let y: byte = 50;
        if (x > 50) {
          if (y > 25) {
            return x;
          }
          return y;
        }
        return 0;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should maintain multiple variable types in nested branches', () => {
    const source = `
      function test(): void {
        let a: byte = 10;
        let b: word = 1000;
        if (a > 5) {
          if (b > 500) {
            let c: byte = a;
            let d: word = b;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency in While Loops
// =============================================================================

describe('Type Consistency in While Loops', () => {
  it('should maintain type in while loop body', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 100) {
          let y: byte = x;
          x = x + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track modifications inside loop', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 10) {
          x = x + 1;
        }
        let final: byte = x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error on type mismatch in loop', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 10) {
          let w: word = 1000;
          x = w;
        }
      }
    `;
    expect(hasErrors(source)).toBe(true);
  });

  it('should maintain type with nested control flow in loop', () => {
    const source = `
      function test(): void {
        let x: byte = 0;
        while (x < 10) {
          if (x > 5) {
            let y: byte = x;
          }
          x = x + 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency in For Loops
// =============================================================================

describe('Type Consistency in For Loops', () => {
  it('should maintain loop variable type', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          let x: byte = i;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should maintain external variable type in for loop', () => {
    const source = `
      function test(): void {
        let sum: word = 0;
        for (i = 0 to 10) {
          sum = sum + i;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle nested for loops with different variables', () => {
    const source = `
      function test(): void {
        for (i = 0 to 5) {
          for (j = 0 to 5) {
            let product: byte = i;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should allow array access with loop index', () => {
    const source = `
      function test(): void {
        let arr: byte[5] = [1, 2, 3, 4, 5];
        for (i = 0 to 5) {
          let val: byte = arr[i];
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Inference from Initialization
// =============================================================================

describe('Type Inference from Initialization', () => {
  it('should use declared type for variable', () => {
    const source = `let x: byte = 100; let y: byte = x;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error if initialization type mismatches declaration', () => {
    const source = `let x: byte = 256;`;
    expect(hasErrors(source)).toBe(true);
  });

  it('should track type from function return', () => {
    const source = `
      function getByte(): byte { return 100; }
      function main(): void {
        let x: byte = getByte();
        let y: byte = x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track type from array element', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = arr[0];
      let y: byte = x;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track word type correctly', () => {
    const source = `
      let w: word = 1000;
      let x: word = w;
      let y: word = x;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency Through Function Calls
// =============================================================================

describe('Type Consistency Through Function Calls', () => {
  it('should maintain type after function call', () => {
    const source = `
      function process(x: byte): byte { return x; }
      function main(): void {
        let a: byte = 100;
        let b: byte = process(a);
        let c: byte = b;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle type promotion in function call', () => {
    const source = `
      function processWord(w: word): word { return w; }
      function main(): void {
        let b: byte = 100;
        let w: word = processWord(b);
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error on wrong return type usage', () => {
    const source = `
      function getWord(): word { return 1000; }
      function main(): void {
        let b: byte = getWord();
      }
    `;
    expect(hasErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency with Ternary Expressions
// =============================================================================

describe('Type Consistency with Ternary Expressions', () => {
  it('should maintain type from ternary result', () => {
    const source = `
      let flag: bool = true;
      let a: byte = 100;
      let b: byte = 200;
      let r: byte = flag ? a : b;
      let s: byte = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle word result from ternary', () => {
    const source = `
      let flag: bool = true;
      let b: byte = 100;
      let w: word = 1000;
      let r: word = flag ? b : w;
      let s: word = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error when using word ternary result as byte', () => {
    const source = `
      let flag: bool = true;
      let b: byte = 100;
      let w: word = 1000;
      let r: byte = flag ? b : w;
    `;
    expect(hasErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency with Arithmetic Expressions
// =============================================================================

describe('Type Consistency with Arithmetic Expressions', () => {
  it('should track byte + byte = byte', () => {
    const source = `
      let a: byte = 100;
      let b: byte = 50;
      let r: byte = a + b;
      let s: byte = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track byte + word = word', () => {
    const source = `
      let a: byte = 100;
      let b: word = 1000;
      let r: word = a + b;
      let s: word = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error when storing word expression in byte', () => {
    const source = `
      let a: byte = 100;
      let b: word = 1000;
      let r: byte = a + b;
    `;
    expect(hasErrors(source)).toBe(true);
  });

  it('should maintain type through chained expressions', () => {
    const source = `
      let a: byte = 10;
      let b: byte = 20;
      let c: byte = 30;
      let r: byte = a + b;
      let s: byte = r + c;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency with Array Operations
// =============================================================================

describe('Type Consistency with Array Operations', () => {
  it('should track array element type', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = arr[0];
      let y: byte = x;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track word array element type', () => {
    const source = `
      let arr: word[3] = [100, 200, 300];
      let x: word = arr[0];
      let y: word = x;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error on type mismatch with array element', () => {
    const source = `
      let arr: word[3] = [100, 200, 300];
      let x: byte = arr[0];
    `;
    expect(hasErrors(source)).toBe(true);
  });

  it('should maintain type when assigning to array element', () => {
    const source = `
      let arr: byte[3] = [1, 2, 3];
      let x: byte = 100;
      arr[0] = x;
      let y: byte = arr[0];
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Type Consistency with Boolean Expressions
// =============================================================================

describe('Type Consistency with Boolean Expressions', () => {
  it('should track comparison result as bool', () => {
    const source = `
      let a: byte = 100;
      let b: byte = 200;
      let r: bool = a < b;
      let s: bool = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track logical operation result as bool', () => {
    const source = `
      let a: bool = true;
      let b: bool = false;
      let r: bool = a && b;
      let s: bool = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error when using bool result as numeric', () => {
    const source = `
      let a: byte = 100;
      let b: byte = 200;
      let r: byte = a < b;
    `;
    expect(hasErrors(source)).toBe(true);
  });

  it('should track negation result as bool', () => {
    const source = `
      let a: bool = true;
      let r: bool = !a;
      let s: bool = r;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Complex Control Flow Type Tracking
// =============================================================================

describe('Complex Control Flow Type Tracking', () => {
  it('should track type through complex nested control flow', () => {
    const source = `
      function complex(): byte {
        let x: byte = 0;
        let flag: bool = true;
        if (flag) {
          while (x < 10) {
            x = x + 1;
            if (x > 5) {
              return x;
            }
          }
        }
        return x;
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should track multiple variables through control flow', () => {
    const source = `
      function multi(): void {
        let a: byte = 10;
        let b: word = 1000;
        let c: bool = true;
        if (c) {
          a = a + 1;
          b = b + 1;
          while (a < 20) {
            let d: byte = a;
            let e: word = b;
            a = a + 1;
          }
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should error on type mismatch in complex flow', () => {
    const source = `
      function complex(): byte {
        let x: byte = 0;
        let w: word = 1000;
        if (x < 100) {
          while (x < 50) {
            x = w;
          }
        }
        return x;
      }
    `;
    expect(hasErrors(source)).toBe(true);
  });
});