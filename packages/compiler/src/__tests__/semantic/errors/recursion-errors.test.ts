/**
 * Recursion Error Tests for SemanticAnalyzer
 *
 * Tests that the semantic analyzer correctly detects and reports
 * recursion errors. SFA (Static Frame Allocation) does NOT support
 * recursion - both direct and indirect recursion are compile-time errors.
 *
 * @module __tests__/semantic/errors/recursion-errors
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

describe('Direct Recursion Detection', () => {
  it('should report error for direct recursion', () => {
    const source = `function foo(): void { foo(); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should report error for direct recursion with return value', () => {
    const source = `function factorial(n: byte): byte { return n * factorial(n - 1); }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should report error for direct recursion in conditional', () => {
    const source = `function countdown(n: byte): void { if (n > 0) { countdown(n - 1); } }`;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should accept non-recursive function', () => {
    const source = `function foo(): void { let x: byte = 5; }`;
    const errors = getErrors(source);
    
    // Should have no recursion errors (may have other errors)
    const recursionErrors = errors.filter(e => e.toLowerCase().includes('recursion'));
    expect(recursionErrors.length).toBe(0);
  });
});

describe('Indirect Recursion Detection', () => {
  it('should report error for A->B->A indirect recursion', () => {
    const source = `
      function a(): void { b(); }
      function b(): void { a(); }
    `;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should report error for A->B->C->A indirect recursion', () => {
    const source = `
      function a(): void { b(); }
      function b(): void { c(); }
      function c(): void { a(); }
    `;
    const errors = getErrors(source);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should accept linear call chain without recursion', () => {
    const source = `
      function a(): void { b(); }
      function b(): void { c(); }
      function c(): void { let x: byte = 5; }
    `;
    const errors = getErrors(source);
    
    // Should have no recursion errors
    const recursionErrors = errors.filter(e => e.toLowerCase().includes('recursion'));
    expect(recursionErrors.length).toBe(0);
  });

  it('should accept tree-shaped call graph without recursion', () => {
    const source = `
      function main(): void { helper1(); helper2(); }
      function helper1(): void { leaf1(); }
      function helper2(): void { leaf2(); }
      function leaf1(): void { let x: byte = 1; }
      function leaf2(): void { let y: byte = 2; }
    `;
    const errors = getErrors(source);
    
    // Should have no recursion errors
    const recursionErrors = errors.filter(e => e.toLowerCase().includes('recursion'));
    expect(recursionErrors.length).toBe(0);
  });
});

describe('Recursion Error Messages', () => {
  it('should include function name in direct recursion error', () => {
    const source = `function countdown(): void { countdown(); }`;
    const errors = getErrors(source);
    
    expect(errors.some(e => e.includes('countdown'))).toBe(true);
  });

  it('should include function names in indirect recursion error', () => {
    const source = `
      function ping(): void { pong(); }
      function pong(): void { ping(); }
    `;
    const errors = getErrors(source);
    
    // Should mention at least one of the functions in the cycle
    expect(errors.some(e => e.includes('ping') || e.includes('pong'))).toBe(true);
  });
});

describe('Complex Recursion Scenarios', () => {
  it('should detect recursion through multiple paths', () => {
    const source = `
      function main(): void { path1(); path2(); }
      function path1(): void { target(); }
      function path2(): void { target(); }
      function target(): void { main(); }
    `;
    const errors = getErrors(source);
    
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });

  it('should detect mutual recursion with shared helper', () => {
    const source = `
      function even(n: byte): boolean { return n == 0 || odd(n - 1); }
      function odd(n: byte): boolean { return n != 0 && even(n - 1); }
    `;
    const errors = getErrors(source);
    
    expect(hasErrorContaining(source, 'recursion')).toBe(true);
  });
});