/**
 * Type Error Tests for SemanticAnalyzer
 *
 * Tests that the semantic analyzer produces correct and helpful error messages
 * for type-related errors: type mismatches, invalid operators, etc.
 *
 * @module __tests__/semantic/errors/type-errors
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

/**
 * Helper function to analyze source code and get diagnostics
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
 * Checks if analysis has an error containing the given text
 */
function hasErrorContaining(source: string, text: string): boolean {
  const errors = getErrors(source);
  return errors.some(e => e.toLowerCase().includes(text.toLowerCase()));
}

describe('Type Mismatch Errors', () => {
  it('should report error for string assigned to byte variable', () => {
    const source = `let x: byte = "hello";`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'type')).toBe(true);
  });

  it('should report error for boolean assigned to byte variable', () => {
    const source = `let x: byte = true;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for string assigned to word variable', () => {
    const source = `let x: word = "test";`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for byte assigned to boolean variable', () => {
    const source = `let x: boolean = 5;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept valid byte literal', () => {
    const source = `let x: byte = 42;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });

  it('should accept valid word literal', () => {
    const source = `let x: word = 1000;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });

  it('should accept valid boolean literal', () => {
    const source = `let x: boolean = true;`;
    const errors = getErrors(source);
    
    // Filter for type mismatch errors specifically
    const typeMismatchErrors = errors.filter(e => 
      e.toLowerCase().includes('type mismatch') ||
      (e.toLowerCase().includes('cannot assign') && e.toLowerCase().includes('boolean'))
    );
    expect(typeMismatchErrors.length).toBe(0);
  });
});

describe('Undefined Variable Errors', () => {
  it('should report error for undefined variable in assignment', () => {
    const source = `let x: byte = y;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    // Check for any error related to undefined/unknown/not found symbol
    const hasUndefinedError = errors.some(e => 
      e.toLowerCase().includes('undefined') || 
      e.toLowerCase().includes('not found') ||
      e.toLowerCase().includes('unknown') ||
      e.toLowerCase().includes('undeclared') ||
      e.toLowerCase().includes('cannot find')
    );
    expect(hasUndefinedError).toBe(true);
  });

  it('should report error for undefined variable in expression', () => {
    const source = `let x: byte = 5; let y: byte = x + z;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept defined variable', () => {
    const source = `let x: byte = 5; let y: byte = x;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });
});

describe('Invalid Operator Errors', () => {
  it('should report error for arithmetic on boolean', () => {
    const source = `let x: boolean = true; let y: byte = x + 5;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for string in arithmetic', () => {
    const source = `function test(): byte { return 5 + "hello"; }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept valid arithmetic operators', () => {
    const source = `let x: byte = 5 + 3 - 2;`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });

  it('should accept valid comparison operators', () => {
    const source = `let x: boolean = 5 > 3;`;
    const errors = getErrors(source);
    
    // Filter for operator-specific errors only
    const operatorErrors = errors.filter(e => 
      e.toLowerCase().includes('operator') ||
      e.toLowerCase().includes('comparison') ||
      e.toLowerCase().includes('cannot compare')
    );
    expect(operatorErrors.length).toBe(0);
  });
});

describe('Function Return Type Errors', () => {
  it('should report error for void function returning value', () => {
    const source = `function test(): void { return 5; }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for function returning wrong type', () => {
    const source = `function test(): byte { return "hello"; }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept correct return type', () => {
    const source = `function test(): byte { return 42; }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });

  it('should accept void function with no return', () => {
    const source = `function test(): void { let x: byte = 5; }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });
});

describe('Function Call Errors', () => {
  it('should report error for calling undefined function', () => {
    const source = `function main(): void { undefinedFunc(); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for wrong number of arguments', () => {
    const source = `function add(a: byte, b: byte): byte { return a + b; } function main(): void { add(1); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for wrong argument type', () => {
    const source = `function test(x: byte): void { } function main(): void { test("hello"); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept correct function call', () => {
    const source = `function add(a: byte, b: byte): byte { return a + b; } function main(): void { let x: byte = add(1, 2); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });
});

describe('Array Type Errors', () => {
  it('should report error for wrong element type in array literal', () => {
    const source = `let arr: byte[3] = ["a", "b", "c"];`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should report error for array index with non-numeric type', () => {
    const source = `let arr: byte[3] = [1, 2, 3]; let x: byte = arr["hello"];`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept valid array literal', () => {
    const source = `let arr: byte[3] = [1, 2, 3];`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });

  it('should accept valid array index', () => {
    const source = `let arr: byte[3] = [1, 2, 3]; let x: byte = arr[0];`;
    const errors = getErrors(source);
    
    expect(errors.length).toBe(0);
  });
});