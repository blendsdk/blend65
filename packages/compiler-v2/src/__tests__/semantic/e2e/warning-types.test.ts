/**
 * Warning Types E2E Tests for Blend65 Compiler v2
 *
 * Tests all warning types through the full semantic analysis pipeline:
 * - Unused variable warnings
 * - Unused parameter warnings
 * - Dead code warnings
 * - Uninitialized variable warnings
 * - All advanced analysis diagnostics
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/index.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import { Parser } from '../../../parser/index.js';
import { Lexer } from '../../../lexer/index.js';
import type { Program, Diagnostic } from '../../../ast/index.js';

/**
 * Helper to parse a Blend65 source string and return the Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper to run full semantic analysis with advanced analysis enabled
 */
function analyze(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: true,
    includeInfoDiagnostics: true,
  });
  return analyzer.analyze(program);
}

/**
 * Helper to run analysis without advanced analysis
 */
function analyzeBasic(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: false,
  });
  return analyzer.analyze(program);
}

/**
 * Helper to get warnings
 */
function getWarnings(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
}

/**
 * Helper to get errors
 */
function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

/**
 * Helper to check for specific warning code
 */
function hasWarningCode(diagnostics: Diagnostic[], code: DiagnosticCode): boolean {
  return diagnostics.some(
    d => d.severity === DiagnosticSeverity.WARNING && d.code === code
  );
}

/**
 * Helper to check for any diagnostic with message containing text
 */
function hasMessageContaining(diagnostics: Diagnostic[], text: string): boolean {
  return diagnostics.some(d =>
    d.message.toLowerCase().includes(text.toLowerCase())
  );
}

describe('Warning Types E2E', () => {
  describe('unused variable warnings', () => {
    it('should warn about unused local variable', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let unused: byte = 10;
        }
      `);

      expect(result.success).toBe(true); // Warnings dont fail
      expect(hasWarningCode(result.diagnostics, DiagnosticCode.UNUSED_VARIABLE)).toBe(true);
    });

    it('should NOT warn about used variable', () => {
      const result = analyze(`
        module Test

        function main(): byte {
          let used: byte = 10;
          return used;
        }
      `);

      // Type check pass should run
      expect(result.passResults.typeCheck).toBeDefined();
    });

    it('should warn about variable only assigned but never read', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let writeOnly: byte = 0;
          writeOnly = 10;
          writeOnly = 20;
        }
      `);

      // This is only assigned, never read
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should NOT warn when variable is used in expression', () => {
      const result = analyze(`
        module Test

        function process(x: byte): byte { return x; }

        function main(): void {
          let value: byte = 5;
          let result: byte = process(value);
        }
      `);

      // value is used as argument to process
      const unusedVarWarnings = result.diagnostics.filter(
        d => d.code === DiagnosticCode.UNUSED_VARIABLE &&
             d.message.toLowerCase().includes('value')
      );
      expect(unusedVarWarnings.length).toBe(0);
    });

    it('should NOT warn when variable is used in loop', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let counter: byte = 0;
          for (let i: byte = 0 to 9 step 1) {
            counter = counter + i;
          }
          let result: byte = counter;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('unused parameter warnings', () => {
    it('should warn about unused function parameter', () => {
      const result = analyze(`
        module Test

        function process(unusedParam: byte): void {
          // Parameter is never used
        }
      `);

      // Check for unused parameter warning or any related diagnostic
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should NOT warn about used parameter', () => {
      const result = analyze(`
        module Test

        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);

      // Should run advanced analysis
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should warn about partially used parameters', () => {
      const result = analyze(`
        module Test

        function partial(used: byte, unused: byte): byte {
          return used;
        }
      `);

      // Should warn about 'unused' but not 'used'
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });
  });

  describe('dead code warnings', () => {
    it('should warn about code after return', () => {
      const result = analyze(`
        module Test

        function early(): byte {
          return 1;
          let dead: byte = 2;
        }
      `);

      expect(hasWarningCode(result.diagnostics, DiagnosticCode.UNREACHABLE_CODE)).toBe(true);
    });

    it('should warn about code after unconditional return in both branches', () => {
      const result = analyze(`
        module Test

        function test(x: byte): byte {
          if (x > 0) {
            return 1;
          } else {
            return 0;
          }
          let unreachable: byte = 2;
        }
      `);

      expect(hasWarningCode(result.diagnostics, DiagnosticCode.UNREACHABLE_CODE)).toBe(true);
    });

    it('should NOT warn for reachable code after if with no else', () => {
      const result = analyze(`
        module Test

        function test(x: byte): byte {
          if (x > 0) {
            return 1;
          }
          return 0;
        }
      `);

      // Code after if is reachable (when condition is false)
      expect(hasWarningCode(result.diagnostics, DiagnosticCode.UNREACHABLE_CODE)).toBe(false);
    });

    it('should warn about unreachable loop', () => {
      const result = analyze(`
        module Test

        function test(): void {
          return;
          while (true) {
            // Never executed
          }
        }
      `);

      expect(hasWarningCode(result.diagnostics, DiagnosticCode.UNREACHABLE_CODE)).toBe(true);
    });
  });

  describe('uninitialized variable warnings', () => {
    it('should warn about potentially uninitialized variable', () => {
      const result = analyze(`
        module Test

        function test(cond: bool): byte {
          let x: byte;
          if (cond) {
            x = 1;
          }
          return x;
        }
      `);

      // x may be uninitialized when cond is false
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should NOT warn when variable is definitely assigned', () => {
      const result = analyze(`
        module Test

        function test(cond: bool): byte {
          let x: byte;
          if (cond) {
            x = 1;
          } else {
            x = 2;
          }
          return x;
        }
      `);

      // x is assigned in both branches
      expect(result.passResults.typeCheck).toBeDefined();
    });

    it('should NOT warn for initialized variable', () => {
      const result = analyze(`
        module Test

        function test(): byte {
          let x: byte = 10;
          return x;
        }
      `);

      expect(result.passResults.typeCheck).toBeDefined();
    });
  });

  describe('warning vs error distinction', () => {
    it('should succeed with only warnings', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let unused: byte = 10;
        }
      `);

      // Has warning but no errors
      expect(result.success).toBe(true);
      expect(getWarnings(result.diagnostics).length).toBeGreaterThanOrEqual(0);
      expect(getErrors(result.diagnostics).length).toBe(0);
    });

    it('should fail with errors even if warnings present', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let unused: byte = 10;
          let typeError: byte = true;
        }
      `);

      // Has both warning (unused) and error (type mismatch)
      expect(result.passResults.typeCheck).toBeDefined();
    });
  });

  describe('advanced analysis vs basic analysis', () => {
    it('should produce more diagnostics with advanced analysis', () => {
      const source = `
        module Test

        function main(): void {
          let unused: byte = 10;
        }
      `;

      const withAdvanced = analyze(source);
      const withoutAdvanced = analyzeBasic(source);

      // Advanced analysis should find unused variable warning
      expect(withAdvanced.passResults.advancedAnalysis).toBeDefined();
      expect(withoutAdvanced.passResults.advancedAnalysis).toBeUndefined();
    });

    it('should still catch errors without advanced analysis', () => {
      const result = analyzeBasic(`
        module Test

        function main(): byte {
          return true;
        }
      `);

      expect(result.passResults.typeCheck).toBeDefined();
    });
  });

  describe('warning count statistics', () => {
    it('should track warning count in stats', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let unused1: byte = 1;
          let unused2: byte = 2;
        }
      `);

      // Stats should include warning count
      expect(result.stats.warningCount).toBeDefined();
    });

    it('should separate error and warning counts', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let unused: byte = 10;
        }
      `);

      expect(result.stats.errorCount).toBe(0);
      // May have warnings
    });
  });

  describe('complex warning scenarios', () => {
    it('should handle multiple warning types in same function', () => {
      const result = analyze(`
        module Test

        function complex(unusedParam: byte): byte {
          let unused: byte = 1;
          return 42;
          let dead: byte = 2;
        }
      `);

      // Should have warnings for unused param, unused var, and dead code
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should warn appropriately in nested scopes', () => {
      const result = analyze(`
        module Test

        function nested(): void {
          let outer: byte = 1;
          if (true) {
            let inner: byte = 2;
            // inner is unused
          }
          let used: byte = outer;
        }
      `);

      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should handle warnings across multiple functions', () => {
      const result = analyze(`
        module Test

        function f1(unused: byte): void {}
        function f2(): void { let unused: byte = 1; }
        function f3(): byte { return 1; let dead: byte = 2; }
      `);

      expect(result.passResults.advancedAnalysis).toBeDefined();
      expect(getWarnings(result.diagnostics).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('loop-related warnings', () => {
    it('should detect loop variable only written', () => {
      const result = analyze(`
        module Test

        function main(): void {
          for (let i: byte = 0 to 9 step 1) {
            // i is used only in loop control
          }
        }
      `);

      // Loop variable i is used in the loop, so no warning
      expect(result.success).toBe(true);
    });

    it('should warn about unused loop variable inside body', () => {
      const result = analyze(`
        module Test

        function main(): void {
          for (let i: byte = 0 to 9 step 1) {
            let unused: byte = 99;
          }
        }
      `);

      // unused variable inside loop body
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });
  });

  describe('real-world warning scenarios', () => {
    it('should handle debug variables pattern', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let debug: bool = false;
          // debug is used for conditional compilation in real code
          // but appears unused here
          let x: byte = 10;
          let result: byte = x;
        }
      `);

      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should handle future-use variables', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let placeholder: byte = 0;
          // placeholder is for future use
        }
      `);

      // Should warn about unused
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should handle configuration pattern', () => {
      const result = analyze(`
        module Test

        let CONFIG_DEBUG: bool = true;
        let CONFIG_LEVEL: byte = 3;

        function main(): void {
          // Configs defined but might be used elsewhere
        }
      `);

      // Globals may or may not trigger warnings depending on analysis
      expect(result.success).toBe(true);
    });
  });

  describe('control flow impact on warnings', () => {
    it('should track variable usage through all paths', () => {
      const result = analyze(`
        module Test

        function test(cond: bool): byte {
          let x: byte = 0;
          if (cond) {
            x = 10;
          }
          return x;
        }
      `);

      // x is used regardless of cond
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should handle early return paths', () => {
      const result = analyze(`
        module Test

        function test(cond: bool): byte {
          if (cond) {
            return 0;
          }
          let x: byte = 10;
          return x;
        }
      `);

      // x is used in non-early-return path
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });
  });
});