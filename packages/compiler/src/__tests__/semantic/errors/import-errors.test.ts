/**
 * Import Error Tests for SemanticAnalyzer
 *
 * Tests that the semantic analyzer correctly detects and reports
 * errors related to imports and exports in multi-module scenarios.
 *
 * @module __tests__/semantic/errors/import-errors
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import type { Program } from '../../../ast/index.js';

/**
 * Helper function to parse a single module
 * IMPORTANT: Always tokenize first, then parse!
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper function to analyze multiple modules together
 */
function analyzeMultiple(sources: string[]) {
  const programs = sources.map(source => parseSource(source));
  
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyzeMultiple(programs);
}

/**
 * Gets error messages from multi-module analysis result
 */
function getMultiModuleErrors(sources: string[]): string[] {
  const result = analyzeMultiple(sources);
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.ERROR)
    .map(d => d.message);
}

/**
 * Checks if analysis has an error containing the given text
 */
function hasErrorContaining(sources: string[], text: string): boolean {
  const errors = getMultiModuleErrors(sources);
  return errors.some(e => e.toLowerCase().includes(text.toLowerCase()));
}

describe('Module Not Found Errors', () => {
  it('should report error for importing non-existent module', () => {
    const sources = [
      `module main; import { foo } from nonexistent;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(sources, 'not found') || hasErrorContaining(sources, 'module')).toBe(true);
  });

  it('should accept import from existing module', () => {
    const sources = [
      `module utils; export function helper(): void { }`,
      `module main; import { helper } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // Filter out errors not related to modules/imports
    const importErrors = errors.filter(e => 
      e.toLowerCase().includes('module') || 
      e.toLowerCase().includes('import')
    );
    expect(importErrors.length).toBe(0);
  });
});

describe('Symbol Not Exported Errors', () => {
  it('should report error for importing non-exported symbol', () => {
    const sources = [
      `module utils; function privateFunc(): void { }`,
      `module main; import { privateFunc } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(
      hasErrorContaining(sources, 'not exported') || 
      hasErrorContaining(sources, 'export')
    ).toBe(true);
  });

  it('should accept import of exported symbol', () => {
    const sources = [
      `module utils; export function publicFunc(): void { }`,
      `module main; import { publicFunc } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // Filter out errors related to exports
    const exportErrors = errors.filter(e => 
      e.toLowerCase().includes('export')
    );
    expect(exportErrors.length).toBe(0);
  });
});

describe('Symbol Not Found Errors', () => {
  it('should report error for importing non-existent symbol from module', () => {
    const sources = [
      `module utils; export function helper(): void { }`,
      `module main; import { nonExistent } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(
      hasErrorContaining(sources, 'not found') || 
      hasErrorContaining(sources, 'does not exist')
    ).toBe(true);
  });

  it('should accept import of existing exported symbol', () => {
    const sources = [
      `module math; export function add(a: byte, b: byte): byte { return a + b; }`,
      `module main; import { add } from math;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // Should not have symbol-not-found errors
    const symbolErrors = errors.filter(e => 
      e.toLowerCase().includes('not found') && 
      e.toLowerCase().includes('add')
    );
    expect(symbolErrors.length).toBe(0);
  });
});

describe('Circular Import Errors', () => {
  it('should detect circular dependency between two modules', () => {
    const sources = [
      `module a; import { funcB } from b; export function funcA(): void { }`,
      `module b; import { funcA } from a; export function funcB(): void { }`
    ];
    const errors = getMultiModuleErrors(sources);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(hasErrorContaining(sources, 'circular')).toBe(true);
  });

  it('should accept linear dependency chain', () => {
    const sources = [
      `module utils; export function helper(): void { }`,
      `module main; import { helper } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // Should not have circular errors
    const circularErrors = errors.filter(e => 
      e.toLowerCase().includes('circular')
    );
    expect(circularErrors.length).toBe(0);
  });
});

describe('Aliased Import Errors', () => {
  it('should accept renamed imports', () => {
    const sources = [
      `module math; export function add(a: byte, b: byte): byte { return a + b; }`,
      `module main; import { add as sum } from math;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // No import-specific errors expected
    const importErrors = errors.filter(e => 
      e.toLowerCase().includes('import') || 
      e.toLowerCase().includes('alias')
    );
    expect(importErrors.length).toBe(0);
  });
});

describe('Multiple Imports', () => {
  it('should handle multiple imports from same module', () => {
    const sources = [
      `module math; 
       export function add(a: byte, b: byte): byte { return a + b; }
       export function sub(a: byte, b: byte): byte { return a - b; }`,
      `module main; import { add, sub } from math;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // No import-specific errors expected
    const importErrors = errors.filter(e => 
      e.toLowerCase().includes('import')
    );
    expect(importErrors.length).toBe(0);
  });

  it('should handle imports from multiple modules', () => {
    const sources = [
      `module math; export function add(a: byte, b: byte): byte { return a + b; }`,
      `module utils; export function helper(): void { }`,
      `module main; 
       import { add } from math;
       import { helper } from utils;`
    ];
    const errors = getMultiModuleErrors(sources);
    
    // No import-specific errors expected
    const importErrors = errors.filter(e => 
      e.toLowerCase().includes('import')
    );
    expect(importErrors.length).toBe(0);
  });
});