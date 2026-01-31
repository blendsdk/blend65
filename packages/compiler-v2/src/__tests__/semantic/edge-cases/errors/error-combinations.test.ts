/**
 * Error Combination Edge Case Tests
 *
 * Tests for handling multiple errors in the same program:
 * - Multiple type errors in same function
 * - Type error + undefined variable
 * - Multiple undefined variables
 * - Errors across function boundaries
 * - Errors in nested structures
 * - Error count and aggregation
 *
 * @module __tests__/semantic/edge-cases/errors/error-combinations
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
 * Gets all diagnostic messages from analysis result
 */
function getAllDiagnostics(source: string) {
  const result = analyzeSource(source);
  return result.diagnostics;
}

/**
 * Gets error count from analysis
 */
function getErrorCount(source: string): number {
  return getErrors(source).length;
}

// =============================================================================
// Multiple Type Errors in Same Function
// =============================================================================

describe('Multiple Type Errors in Same Function', () => {
  it('should report multiple type mismatches', () => {
    const source = `
      function test(): void {
        let b: byte = 256;
        let w: word = "hello";
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors for each incorrect assignment', () => {
    const source = `
      function test(): void {
        let a: byte = true;
        let b: bool = 100;
        let c: word = false;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should report errors for multiple bad function calls', () => {
    const source = `
      function acceptByte(b: byte): void { }
      function acceptBool(b: bool): void { }
      function main(): void {
        acceptByte("hello");
        acceptBool(100);
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors for multiple bad return statements', () => {
    const source = `
      function getByte(): byte {
        let w: word = 1000;
        if (true) {
          return w;
        }
        return "hello";
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in multiple expressions', () => {
    const source = `
      function test(): void {
        let a: byte = 100;
        let b: bool = a + true;
        let c: word = "x" + 5;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Type Error + Undefined Variable
// =============================================================================

describe('Type Error + Undefined Variable', () => {
  it('should report both undefined var and type error', () => {
    const source = `
      function test(): void {
        let x: byte = undefinedVar;
        let y: byte = 256;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some(e => e.toLowerCase().includes('undefined') || e.toLowerCase().includes('not defined'))).toBe(true);
  });

  it('should report undefined and type mismatch in same statement', () => {
    const source = `
      function test(): void {
        let x: bool = undefinedVar + 5;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.toLowerCase().includes('undefined') || e.toLowerCase().includes('not defined'))).toBe(true);
  });

  it('should report undefined in type mismatch context', () => {
    const source = `
      function acceptByte(b: byte): void { }
      function main(): void {
        acceptByte(noSuchVar);
        let x: byte = 1000;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report undefined function and type error', () => {
    const source = `
      function test(): void {
        let x: byte = undefinedFunc();
        let y: bool = 100;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Multiple Undefined Variables
// =============================================================================

describe('Multiple Undefined Variables', () => {
  it('should report multiple undefined variables', () => {
    const source = `
      function test(): void {
        let x: byte = a + b + c;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should report each undefined variable separately', () => {
    const source = `
      function test(): void {
        let x: byte = foo;
        let y: byte = bar;
        let z: byte = baz;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should report undefined in multiple contexts', () => {
    const source = `
      function acceptByte(b: byte): void { }
      function main(): void {
        let x: byte = undefinedA;
        acceptByte(undefinedB);
        let arr: byte[2] = [undefinedC, undefinedD];
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('should report undefined in nested expressions', () => {
    const source = `
      function test(): void {
        let x: byte = (a + (b * c)) - d;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('should report undefined functions', () => {
    const source = `
      function test(): void {
        let x: byte = foo();
        let y: byte = bar();
        let z: byte = baz();
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// Errors Across Function Boundaries
// =============================================================================

describe('Errors Across Function Boundaries', () => {
  it('should report errors in multiple functions', () => {
    const source = `
      function funcA(): void {
        let x: byte = 256;
      }
      function funcB(): void {
        let y: byte = 257;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in caller and callee', () => {
    const source = `
      function callee(): byte {
        return 1000;
      }
      function caller(): void {
        let x: bool = callee();
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in nested function calls', () => {
    const source = `
      function inner(): byte { return 256; }
      function middle(): byte { return inner(); }
      function outer(): void {
        let x: bool = middle();
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in multiple independent functions', () => {
    const source = `
      function func1(): void { let a: byte = undefinedA; }
      function func2(): void { let b: byte = undefinedB; }
      function func3(): void { let c: byte = undefinedC; }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// Errors in Nested Structures
// =============================================================================

describe('Errors in Nested Structures', () => {
  it('should report errors in nested if statements', () => {
    const source = `
      function test(): void {
        if (true) {
          let x: byte = 256;
          if (false) {
            let y: byte = 257;
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in nested loops', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          let x: byte = 256;
          for (j = 0 to 5) {
            let y: byte = 257;
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in while with nested if', () => {
    const source = `
      function test(): void {
        let cond: bool = true;
        while (cond) {
          let x: byte = 256;
          if (true) {
            let y: bool = 100;
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report errors in deeply nested structures', () => {
    const source = `
      function test(): void {
        if (true) {
          for (i = 0 to 5) {
            while (true) {
              let x: byte = 256;
              let y: bool = 100;
              let z: word = "hello";
            }
          }
        }
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// Error Count and Aggregation
// =============================================================================

describe('Error Count and Aggregation', () => {
  it('should count errors correctly', () => {
    const source = `
      function test(): void {
        let a: byte = 256;
        let b: byte = 257;
        let c: byte = 258;
      }
    `;
    const count = getErrorCount(source);
    expect(count).toBe(3);
  });

  it('should aggregate errors from all sources', () => {
    const source = `
      function test(): void {
        let x: byte = undefined1;
        let y: byte = 256;
        let z: bool = 100 + undefined2;
      }
    `;
    const count = getErrorCount(source);
    // Expecting at least: undefined1, 256 overflow, undefined2
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('should have consistent error counts', () => {
    const source = `
      function test(): void {
        let a: byte = 256;
        let b: byte = 257;
      }
    `;
    const count1 = getErrorCount(source);
    const count2 = getErrorCount(source);
    expect(count1).toBe(count2);
  });

  it('should include all errors in diagnostics', () => {
    const source = `
      function test(): void {
        let x: byte = 256;
        let y: byte = undefinedVar;
      }
    `;
    const diagnostics = getAllDiagnostics(source);
    const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should preserve error details', () => {
    const source = `
      function test(): void {
        let x: byte = 256;
      }
    `;
    const diagnostics = getAllDiagnostics(source);
    const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Each error should have a message
    errors.forEach(e => {
      expect(e.message).toBeTruthy();
    });
  });
});

// =============================================================================
// Mixed Error Types
// =============================================================================

describe('Mixed Error Types', () => {
  it('should report type errors and undefined together', () => {
    const source = `
      function test(): void {
        let x: byte = undefinedVar;
        let y: bool = 100;
        let z: word = "hello";
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should report parameter errors and body errors', () => {
    const source = `
      function test(a: byte, b: byte): void {
        let x: byte = a + undefinedVar;
        let y: bool = b;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should report return type and body errors', () => {
    const source = `
      function test(): byte {
        let x: bool = 100;
        let y: byte = undefinedVar;
        return "hello";
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should report array and scalar errors together', () => {
    const source = `
      function test(): void {
        let arr: byte[3] = [256, 257, 258];
        let x: byte = 300;
      }
    `;
    const errors = getErrors(source);
    // Array might report 1 error for the whole initializer, plus scalar error
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});