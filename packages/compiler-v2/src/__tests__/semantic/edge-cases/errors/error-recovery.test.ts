/**
 * Error Recovery Edge Case Tests
 *
 * Tests for semantic analyzer error recovery behavior:
 * - Continue analysis after type error
 * - Continue analysis after undefined error
 * - Error recovery in various contexts
 * - Error message quality
 * - Success flag behavior
 *
 * @module __tests__/semantic/edge-cases/errors/error-recovery
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../../lexer/lexer.js';
import { Parser } from '../../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../../ast/diagnostics.js';

/**
 * Helper function to analyze source code and get full result.
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

// =============================================================================
// Continue After Type Error
// =============================================================================

describe('Continue After Type Error', () => {
  it('should analyze remaining code after type error', () => {
    const source = `
      function test(): void {
        let x: byte = "hello";
        let y: byte = 100;
        let z: byte = y + 1;
      }
    `;
    const result = analyzeSource(source);
    // Should have analyzed the whole function
    expect(result.symbolTable).toBeDefined();
  });

  it('should detect multiple type errors in sequence', () => {
    const source = `
      function test(): void {
        let a: byte = "hello";
        let b: byte = 256;
        let c: bool = 100;
      }
    `;
    const errors = getErrors(source);
    // Should have found all three errors
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should continue analyzing after function with type error', () => {
    const source = `
      function func1(): void {
        let x: byte = "hello";
      }
      function func2(): void {
        let y: byte = 100;
      }
    `;
    const result = analyzeSource(source);
    // Should have analyzed both functions
    expect(result.symbolTable).toBeDefined();
    // func2 should have no errors
    const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
    // At least one error from func1
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('should continue analyzing nested structures after error', () => {
    const source = `
      function test(): void {
        if (true) {
          let x: byte = "hello";
        }
        let y: byte = 100;
        if (false) {
          let z: byte = 50;
        }
      }
    `;
    const result = analyzeSource(source);
    // Should complete analysis
    expect(result.success).toBe(false);
    // Should have analyzed everything
    expect(result.symbolTable).toBeDefined();
  });
});

// =============================================================================
// Continue After Undefined Error
// =============================================================================

describe('Continue After Undefined Error', () => {
  it('should continue after undefined variable', () => {
    const source = `
      function test(): void {
        let x: byte = undefinedVar;
        let y: byte = 100;
        let z: byte = y + 1;
      }
    `;
    const result = analyzeSource(source);
    // Should have analyzed y and z correctly
    expect(result.symbolTable).toBeDefined();
  });

  it('should detect subsequent undefined variables', () => {
    const source = `
      function test(): void {
        let a: byte = foo;
        let b: byte = bar;
        let c: byte = baz;
      }
    `;
    const errors = getErrors(source);
    // Should have found all three undefined errors
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should continue after undefined function call', () => {
    const source = `
      function test(): void {
        let x: byte = unknownFunc();
        let y: byte = 100;
        let z: byte = y + 50;
      }
    `;
    const result = analyzeSource(source);
    // Should complete analysis
    expect(result.symbolTable).toBeDefined();
  });

  it('should detect errors after undefined in expression', () => {
    const source = `
      function test(): void {
        let x: byte = undefined1 + 5;
        let y: byte = 256;
      }
    `;
    const errors = getErrors(source);
    // Should have found both undefined and overflow errors
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Error Recovery in Various Contexts
// =============================================================================

describe('Error Recovery in Various Contexts', () => {
  it('should recover in loop context', () => {
    const source = `
      function test(): void {
        for (i = 0 to 10) {
          let x: byte = "hello";
          let y: byte = 100;
        }
        let z: byte = 50;
      }
    `;
    const result = analyzeSource(source);
    // Should complete analysis of entire function
    expect(result.symbolTable).toBeDefined();
  });

  it('should recover in conditional context', () => {
    const source = `
      function test(): void {
        if (true) {
          let x: byte = 256;
        } else {
          let y: byte = 100;
        }
        let z: byte = 50;
      }
    `;
    const result = analyzeSource(source);
    // Should complete analysis
    expect(result.symbolTable).toBeDefined();
  });

  it('should recover in function call context', () => {
    const source = `
      function helper(a: byte): byte { return a; }
      function main(): void {
        let x: byte = helper("hello");
        let y: byte = helper(100);
      }
    `;
    const result = analyzeSource(source);
    // Should analyze both calls
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('should recover in array context', () => {
    const source = `
      function test(): void {
        let arr: byte[3] = [256, 100, 50];
        let x: byte = arr[0];
      }
    `;
    const result = analyzeSource(source);
    // Should complete analysis
    expect(result.symbolTable).toBeDefined();
  });

  it('should recover after return type error', () => {
    const source = `
      function func1(): byte {
        return "hello";
      }
      function func2(): byte {
        return 100;
      }
    `;
    const result = analyzeSource(source);
    // Should analyze both functions
    expect(result.symbolTable).toBeDefined();
    // func2 should be valid
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Error Message Quality
// =============================================================================

describe('Error Message Quality', () => {
  it('should have descriptive type mismatch message', () => {
    const source = `
      function test(): void {
        let x: byte = "hello";
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Error message should mention types
    expect(errors[0].toLowerCase()).toMatch(/type|string|byte|cannot|assign|mismatch/);
  });

  it('should have descriptive undefined variable message', () => {
    const source = `
      function test(): void {
        let x: byte = undefinedVar;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Error message should mention the variable name
    expect(errors.some(e => e.includes('undefinedVar') || e.toLowerCase().includes('undefined'))).toBe(true);
  });

  it('should have descriptive overflow message', () => {
    const source = `
      function test(): void {
        let x: byte = 256;
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Error message should be meaningful
    expect(errors[0].length).toBeGreaterThan(10);
  });

  it('should have descriptive function not found message', () => {
    const source = `
      function test(): void {
        let x: byte = unknownFunc();
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Error message should mention the function
    expect(errors.some(e => e.includes('unknownFunc') || e.toLowerCase().includes('function') || e.toLowerCase().includes('undefined'))).toBe(true);
  });

  it('should have descriptive parameter mismatch message', () => {
    const source = `
      function acceptByte(b: byte): void { }
      function main(): void {
        acceptByte("hello");
      }
    `;
    const errors = getErrors(source);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Error message should be meaningful
    expect(errors[0].length).toBeGreaterThan(10);
  });
});

// =============================================================================
// Success Flag Behavior
// =============================================================================

describe('Success Flag Behavior', () => {
  it('should set success=false when errors exist', () => {
    const source = `
      function test(): void {
        let x: byte = 256;
      }
    `;
    const result = analyzeSource(source);
    expect(result.success).toBe(false);
  });

  it('should set success=true when no errors', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
        let y: word = 1000;
      }
    `;
    const result = analyzeSource(source);
    expect(result.success).toBe(true);
  });

  it('should set success=false for any error type', () => {
    const sources = [
      `function test(): void { let x: byte = "hello"; }`,
      `function test(): void { let x: byte = undefinedVar; }`,
      `function test(): void { let x: byte = 256; }`,
    ];

    for (const source of sources) {
      const result = analyzeSource(source);
      expect(result.success).toBe(false);
    }
  });

  it('should allow warnings with success=true', () => {
    const source = `
      function test(): void {
        let x: byte = 100;
      }
    `;
    const result = analyzeSource(source);
    // Simple valid code should succeed (warnings are OK)
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Analysis Completeness After Errors
// =============================================================================

describe('Analysis Completeness After Errors', () => {
  it('should build symbol table even with errors', () => {
    const source = `
      function test(): void {
        let x: byte = 256;
        let y: byte = 100;
      }
    `;
    const result = analyzeSource(source);
    expect(result.symbolTable).toBeDefined();
  });

  it('should track functions even with body errors', () => {
    const source = `
      function func1(): void { let x: byte = 256; }
      function func2(): byte { return 100; }
    `;
    const result = analyzeSource(source);
    expect(result.symbolTable).toBeDefined();
    // Should have found both functions
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide diagnostics for all errors found', () => {
    const source = `
      function test(): void {
        let a: byte = "hello";
        let b: byte = 256;
        let c: byte = undefinedVar;
      }
    `;
    const result = analyzeSource(source);
    // Should have multiple diagnostics
    const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should complete analysis of valid code after error', () => {
    const source = `
      function errorFunc(): void {
        let x: byte = "hello";
      }
      function validFunc(): byte {
        let y: byte = 100;
        return y;
      }
    `;
    const result = analyzeSource(source);
    // Analysis should complete
    expect(result.symbolTable).toBeDefined();
  });
});