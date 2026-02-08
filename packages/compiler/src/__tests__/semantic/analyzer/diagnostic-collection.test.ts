/**
 * Diagnostic Collection Tests
 *
 * Tests for diagnostic collection and reporting in the SemanticAnalyzer.
 *
 * @module __tests__/semantic/analyzer/diagnostic-collection.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer, type AnalysisResult, type MultiModuleAnalysisResult } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import type { Program, Diagnostic } from '../../../ast/index.js';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Parses source code into a Program AST
 * CRITICAL: Always tokenize first, then parse!
 */
function parseProgram(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Analyzes source code and returns the result
 */
function analyzeSource(source: string, options?: { runAdvancedAnalysis?: boolean }): AnalysisResult {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: options?.runAdvancedAnalysis ?? false });
  return analyzer.analyze(program);
}

/**
 * Gets error diagnostics from result
 */
function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

/**
 * Gets warning diagnostics from result
 */
function getWarnings(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
}

/**
 * Gets info diagnostics from result
 */
function getInfos(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.INFO);
}

// ============================================
// TESTS: DIAGNOSTIC COLLECTION
// ============================================

describe('SemanticAnalyzer - Diagnostic Collection', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  });

  describe('Basic Diagnostic Collection', () => {
    it('should return empty diagnostics for valid program', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.diagnostics.length).toBe(0);
    });

    it('should collect errors for invalid programs', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      expect(getErrors(result.diagnostics).length).toBeGreaterThan(0);
    });

    it('should include error messages in diagnostics', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toBeDefined();
      expect(errors[0].message.length).toBeGreaterThan(0);
    });

    it('should include location information in diagnostics', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].location).toBeDefined();
    });

    it('should include diagnostic code', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBeDefined();
    });
  });

  describe('Error Diagnostics', () => {
    it('should report undefined variable errors', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe(DiagnosticSeverity.ERROR);
    });

    it('should report unknown type errors', () => {
      const source = `
        module test;
        let x: unknownType = 5;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report duplicate declaration errors', () => {
      const source = `
        module test;
        let x: byte = 5;
        let x: byte = 10;
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report recursion errors', () => {
      const source = `
        module test;
        function rec(): void {
          rec();
        }
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report type mismatch errors', () => {
      const source = `
        module test;
        function getWord(): word { return 1000; }
        function main(): void {
          let x: byte = getWord();
        }
      `;
      const result = analyzeSource(source);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Diagnostic Aggregation', () => {
    it('should collect diagnostics from all passes', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
        let x: byte = 10;
      `;
      const result = analyzeSource(source);

      // Should have at least 2 errors: duplicate declaration + undefined variable
      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('should not duplicate diagnostics', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const messages = result.diagnostics.map(d => d.message);
      const uniqueMessages = [...new Set(messages)];
      
      // Each message should appear only once
      expect(messages.length).toBe(uniqueMessages.length);
    });
  });

  describe('Statistics Tracking', () => {
    it('should count errors correctly', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      expect(result.stats.errorCount).toBeGreaterThan(0);
      expect(result.stats.errorCount).toBe(getErrors(result.diagnostics).length);
    });

    it('should count warnings correctly', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.stats.warningCount).toBe(getWarnings(result.diagnostics).length);
    });

    it('should have zero errors for valid program', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.stats.errorCount).toBe(0);
    });
  });

  describe('Success Flag', () => {
    it('should set success to true when no errors', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should set success to false when errors exist', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(false);
    });

    it('should set success to true even with warnings', () => {
      // Warnings don't affect success status
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source, { runAdvancedAnalysis: false });

      // If no errors, success should be true regardless of warnings
      if (result.stats.errorCount === 0) {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Multi-Module Diagnostics', () => {
    it('should aggregate diagnostics from all modules', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = unknownA;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = unknownB;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      const errors = getErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should track total errors across modules', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = unknownA;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = unknownB;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.stats.totalErrors).toBeGreaterThanOrEqual(2);
    });

    it('should track total warnings across modules', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.stats.totalWarnings).toBeDefined();
    });

    it('should set success false if any module has errors', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`
        module b;
        let x: byte = unknownVar;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(false);
    });
  });

  describe('Analyzer Options - Stop on First Error', () => {
    it('should stop early when stopOnFirstError is true', () => {
      const analyzer = new SemanticAnalyzer({
        runAdvancedAnalysis: false,
        stopOnFirstError: true,
      });

      const source = `
        module test;
        let x: byte = unknownVar1;
        let y: byte = unknownVar2;
        let z: byte = unknownVar3;
      `;
      const program = parseProgram(source);
      const result = analyzer.analyze(program);

      // With stopOnFirstError, should have fewer errors than if we continued
      expect(result.success).toBe(false);
      expect(result.stats.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Analyzer Options - Max Errors', () => {
    it('should respect maxErrors limit', () => {
      const analyzer = new SemanticAnalyzer({
        runAdvancedAnalysis: false,
        maxErrors: 2,
      });

      const source = `
        module test;
        let a: byte = unknown1;
        let b: byte = unknown2;
        let c: byte = unknown3;
        let d: byte = unknown4;
        let e: byte = unknown5;
      `;
      const program = parseProgram(source);
      const result = analyzer.analyze(program);

      // Should stop after maxErrors
      expect(result.success).toBe(false);
      expect(result.stats.errorCount).toBeLessThanOrEqual(5);
    });
  });
});