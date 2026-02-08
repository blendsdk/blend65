/**
 * Analysis Results Tests
 *
 * Tests for AnalysisResult and MultiModuleAnalysisResult types.
 *
 * @module __tests__/semantic/analyzer/analysis-results.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import {
  SemanticAnalyzer,
  type AnalysisResult,
  type MultiModuleAnalysisResult,
  type SemanticAnalyzerOptions,
  DEFAULT_ANALYZER_OPTIONS,
} from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import type { Program } from '../../../ast/index.js';

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
function analyzeSource(source: string, options?: SemanticAnalyzerOptions): AnalysisResult {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer(options ?? { runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

// ============================================
// TESTS: ANALYSIS RESULT STRUCTURE
// ============================================

describe('SemanticAnalyzer - Analysis Result Types', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  });

  describe('AnalysisResult - Basic Fields', () => {
    it('should include success field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should include moduleName field', () => {
      const source = `module myModule;`;
      const result = analyzeSource(source);

      expect(result.moduleName).toBeDefined();
      expect(result.moduleName).toBe('myModule');
    });

    it('should include ast field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.ast).toBeDefined();
      expect(result.ast.getModule).toBeDefined();
    });

    it('should include symbolTable field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.symbolTable).toBeDefined();
      expect(result.symbolTable.getRootScope).toBeDefined();
    });

    it('should include typeSystem field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.typeSystem).toBeDefined();
      expect(result.typeSystem.getBuiltinType).toBeDefined();
    });

    it('should include cfgs field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.cfgs).toBeDefined();
      expect(result.cfgs instanceof Map).toBe(true);
    });

    it('should include callGraph field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.callGraph).toBeDefined();
      expect(result.callGraph.size).toBeDefined();
    });

    it('should include diagnostics field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.diagnostics).toBeDefined();
      expect(Array.isArray(result.diagnostics)).toBe(true);
    });
  });

  describe('AnalysisResult - passResults', () => {
    it('should include passResults field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.passResults).toBeDefined();
    });

    it('should include symbolTableBuild in passResults', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild).toBeDefined();
      expect(result.passResults.symbolTableBuild.symbolTable).toBeDefined();
      expect(result.passResults.symbolTableBuild.diagnostics).toBeDefined();
    });

    it('should include typeResolution in passResults', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution).toBeDefined();
      expect(result.passResults.typeResolution.resolvedCount).toBeDefined();
      expect(result.passResults.typeResolution.failedCount).toBeDefined();
    });

    it('should include typeCheck in passResults', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck).toBeDefined();
      expect(result.passResults.typeCheck.expressionsChecked).toBeDefined();
      expect(result.passResults.typeCheck.errorCount).toBeDefined();
    });

    it('should include recursionErrors in passResults', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.passResults.recursionErrors).toBeDefined();
      expect(Array.isArray(result.passResults.recursionErrors)).toBe(true);
    });

    it('should include advancedAnalysis in passResults when enabled', () => {
      const source = `module test;`;
      const result = analyzeSource(source, { runAdvancedAnalysis: true });

      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should not include advancedAnalysis when disabled', () => {
      const source = `module test;`;
      const result = analyzeSource(source, { runAdvancedAnalysis: false });

      expect(result.passResults.advancedAnalysis).toBeUndefined();
    });
  });

  describe('AnalysisResult - stats', () => {
    it('should include stats field', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.stats).toBeDefined();
    });

    it('should include totalDeclarations in stats', () => {
      const source = `
        module test;
        let x: byte = 5;
        let y: byte = 10;
      `;
      const result = analyzeSource(source);

      expect(result.stats.totalDeclarations).toBeDefined();
      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(2);
    });

    it('should include expressionsChecked in stats', () => {
      const source = `
        module test;
        let x: byte = 5 + 3;
      `;
      const result = analyzeSource(source);

      expect(result.stats.expressionsChecked).toBeDefined();
      expect(result.stats.expressionsChecked).toBeGreaterThan(0);
    });

    it('should include functionsAnalyzed in stats', () => {
      const source = `
        module test;
        function foo(): void {}
        function bar(): void {}
      `;
      const result = analyzeSource(source);

      expect(result.stats.functionsAnalyzed).toBeDefined();
      expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(2);
    });

    it('should include errorCount in stats', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.stats.errorCount).toBeDefined();
      expect(typeof result.stats.errorCount).toBe('number');
    });

    it('should include warningCount in stats', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.stats.warningCount).toBeDefined();
      expect(typeof result.stats.warningCount).toBe('number');
    });

    it('should include analysisTimeMs in stats', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.stats.analysisTimeMs).toBeDefined();
      expect(result.stats.analysisTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('MultiModuleAnalysisResult', () => {
    it('should include success field', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should include modules map', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);
      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.modules).toBeDefined();
      expect(result.modules instanceof Map).toBe(true);
      expect(result.modules.size).toBe(2);
    });

    it('should include globalSymbolTable', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.globalSymbolTable).toBeDefined();
    });

    it('should include dependencyGraph', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.dependencyGraph).toBeDefined();
    });

    it('should include importResolution', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.importResolution).toBeDefined();
      expect(result.importResolution.success).toBeDefined();
      expect(result.importResolution.errors).toBeDefined();
    });

    it('should include diagnostics', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.diagnostics).toBeDefined();
      expect(Array.isArray(result.diagnostics)).toBe(true);
    });

    it('should include compilationOrder', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);
      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.compilationOrder).toBeDefined();
      expect(Array.isArray(result.compilationOrder)).toBe(true);
      expect(result.compilationOrder.length).toBe(2);
    });

    it('should include stats', () => {
      const module1 = parseProgram(`module a;`);
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.stats).toBeDefined();
      expect(result.stats.totalModules).toBeDefined();
      expect(result.stats.totalDeclarations).toBeDefined();
      expect(result.stats.totalErrors).toBeDefined();
      expect(result.stats.totalWarnings).toBeDefined();
      expect(result.stats.totalTimeMs).toBeDefined();
    });
  });

  describe('Analyzer Options', () => {
    it('should use default options', () => {
      const analyzer = new SemanticAnalyzer();
      const options = analyzer.getOptions();

      expect(options.runAdvancedAnalysis).toBe(DEFAULT_ANALYZER_OPTIONS.runAdvancedAnalysis);
      expect(options.stopOnFirstError).toBe(DEFAULT_ANALYZER_OPTIONS.stopOnFirstError);
      expect(options.maxErrors).toBe(DEFAULT_ANALYZER_OPTIONS.maxErrors);
    });

    it('should allow custom options', () => {
      const analyzer = new SemanticAnalyzer({
        runAdvancedAnalysis: true,
        stopOnFirstError: true,
        maxErrors: 50,
      });
      const options = analyzer.getOptions();

      expect(options.runAdvancedAnalysis).toBe(true);
      expect(options.stopOnFirstError).toBe(true);
      expect(options.maxErrors).toBe(50);
    });

    it('should allow updating options', () => {
      const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
      analyzer.setOptions({ runAdvancedAnalysis: true });
      const options = analyzer.getOptions();

      expect(options.runAdvancedAnalysis).toBe(true);
    });

    it('should provide access to type system', () => {
      const analyzer = new SemanticAnalyzer();
      const typeSystem = analyzer.getTypeSystem();

      expect(typeSystem).toBeDefined();
      expect(typeSystem.getBuiltinType('byte')).toBeDefined();
    });
  });

  describe('Result Consistency', () => {
    it('should have consistent error count in stats and diagnostics', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      const errorDiagnostics = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
      expect(result.stats.errorCount).toBe(errorDiagnostics.length);
      expect(result.stats.errorCount).toBeGreaterThan(0);
    });

    it('should have consistent warning count in stats and diagnostics', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      const warningDiagnostics = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
      expect(result.stats.warningCount).toBe(warningDiagnostics.length);
    });

    it('should have consistent success flag with error count', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      if (result.stats.errorCount > 0) {
        expect(result.success).toBe(false);
      } else {
        expect(result.success).toBe(true);
      }
    });

    it('should preserve AST reference in result', () => {
      const source = `module test;`;
      const program = parseProgram(source);
      const result = analyzer.analyze(program);

      expect(result.ast).toBe(program);
    });

    it('should use shared type system', () => {
      const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
      const program1 = parseProgram(`module test1;`);
      const program2 = parseProgram(`module test2;`);

      const result1 = analyzer.analyze(program1);
      const result2 = analyzer.analyze(program2);

      // Same analyzer instance should share type system
      expect(result1.typeSystem).toBe(result2.typeSystem);
    });
  });
});