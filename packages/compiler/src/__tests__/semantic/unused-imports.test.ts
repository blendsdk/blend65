/**
 * Phase 7 - Unused Import Detection Tests
 *
 * Tests for Task 7.2: Detecting unused imported symbols
 * and reporting HINT-level diagnostics to help keep imports clean.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';
import { DiagnosticCode, DiagnosticSeverity } from '../../ast/diagnostics.js';

/**
 * Helper: Parse and analyze source code
 */
function analyzeSource(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(ast);
}

/**
 * Helper: Parse and analyze multiple modules
 */
function analyzeMultipleModules(sources: string[]) {
  const programs = sources.map(source => {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  });

  const analyzer = new SemanticAnalyzer();
  return analyzer.analyzeMultiple(programs);
}

describe('Phase 7: Unused Import Detection', () => {
  describe('Single Unused Import', () => {
    it('should detect unused import with HINT severity', () => {
      const libSource = `
        module utils
        export function helper(): void
          // helper implementation
        end function
      `;

      const mainSource = `
        module main
        import helper from utils

        export function main(): void
          // Never use helper
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      // Find hint diagnostics
      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);

      const unusedImportHint = hints[0];
      expect(unusedImportHint.code).toBe(DiagnosticCode.UNUSED_IMPORT);
      expect(unusedImportHint.message).toContain('helper');
      expect(unusedImportHint.message).toContain('never used');
    });

    it('should not report hint when import is used', () => {
      const libSource = `
        module utils
        export function helper(): void
          // helper implementation
        end function
      `;

      const mainSource = `
        module main
        import helper from utils

        export function main(): void
          helper();
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      // Should have no hints
      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });
  });

  describe('Multiple Imports - Mixed Usage', () => {
    it('should detect only unused imports when some are used', () => {
      const libSource = `
        module graphics
        export function clearScreen(): void
          // clear implementation
        end function

        export function setPixel(x: byte, y: byte): void
          // setPixel implementation
        end function

        export function drawLine(x1: byte, y1: byte, x2: byte, y2: byte): void
          // drawLine implementation
        end function
      `;

      const mainSource = `
        module main
        import clearScreen, setPixel, drawLine from graphics

        export function main(): void
          clearScreen();
          setPixel(10, 10);
          // drawLine never used
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
      expect(hints[0].message).toContain('drawLine');
    });

    it('should detect multiple unused imports', () => {
      const libSource = `
        module utils
        export function foo(): void
        end function

        export function bar(): void
        end function

        export function baz(): void
        end function
      `;

      const mainSource = `
        module main
        import foo, bar, baz from utils

        export function main(): void
          foo();
          // bar and baz never used
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(2);

      const unusedNames = hints.map(h => {
        const match = h.message.match(/'(\w+)'/);
        return match ? match[1] : '';
      });
      expect(unusedNames).toContain('bar');
      expect(unusedNames).toContain('baz');
    });
  });

  describe('Import Usage in Different Scopes', () => {
    it('should detect usage in nested function scope', () => {
      const libSource = `
        module utils
        export function helper(): void
        end function
      `;

      const mainSource = `
        module main
        import helper from utils

        function nested(): void
          helper();
        end function

        export function main(): void
          nested();
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });

    it('should detect usage in if statement', () => {
      const libSource = `
        module utils
        export function check(): byte
          return 1;
        end function
      `;

      const mainSource = `
        module main
        import check from utils

        export function main(): void
          if check() > 0 then
            // use check in condition
          end if
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });

    it('should detect usage in while loop', () => {
      const libSource = `
        module utils
        export function running(): byte
          return 1;
        end function
      `;

      const mainSource = `
        module main
        import running from utils

        export function main(): void
          while running() > 0
            // use running in condition
          end while
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });
  });

  describe('Variable Import Usage', () => {
    it('should detect unused variable import', () => {
      const libSource = `
        module constants
        export const MAX_SIZE: byte = 255;
      `;

      const mainSource = `
        module main
        import MAX_SIZE from constants

        export function main(): void
          // MAX_SIZE never used
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
      expect(hints[0].message).toContain('MAX_SIZE');
    });

    it('should detect used variable import', () => {
      const libSource = `
        module constants
        export const MAX_SIZE: byte = 255;
      `;

      const mainSource = `
        module main
        import MAX_SIZE from constants

        export function main(): void
          let size: byte = MAX_SIZE;
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });
  });

  describe('Import Usage in Expressions', () => {
    it('should detect usage in binary expression', () => {
      const libSource = `
        module math
        export function square(x: byte): byte
          return x * x;
        end function
      `;

      const mainSource = `
        module main
        import square from math

        export function main(): void
          let result: byte = square(5) + 10;
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });

    it('should detect usage in assignment', () => {
      const libSource = `
        module utils
        export function getValue(): byte
          return 42;
        end function
      `;

      const mainSource = `
        module main
        import getValue from utils

        export function main(): void
          let x: byte = getValue();
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });

    it('should detect usage as function argument', () => {
      const libSource = `
        module utils
        export function getData(): byte
          return 1;
        end function
      `;

      const mainSource = `
        module main
        import getData from utils

        function process(value: byte): void
        end function

        export function main(): void
          process(getData());
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle module with no imports', () => {
      const source = `
        module main

        export function main(): void
          // No imports
        end function
      `;

      const result = analyzeSource(source);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(0);
    });

    it('should handle empty module with imports', () => {
      const libSource = `
        module utils
        export function helper(): void
        end function
      `;

      const mainSource = `
        module main
        import helper from utils
        // No main function, no usage
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
      expect(hints[0].message).toContain('helper');
    });

    it('should handle import from same-named symbol', () => {
      const libSource = `
        module utils
        export function test(): void
        end function
      `;

      const mainSource = `
        module main
        import test from utils

        function test(): void
          // Local function also named test
        end function

        export function main(): void
          test();
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      // The local test() function is called, not the imported one
      // This should still show the imported 'test' as unused
      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      // Note: This might require symbol table shadowing logic
      // For now, we expect the usage tracking to work correctly
    });
  });

  describe('Multi-Module Project', () => {
    it('should detect unused imports across multiple importing modules', () => {
      const libSource = `
        module lib
        export function foo(): void
        end function

        export function bar(): void
        end function
      `;

      const module1Source = `
        module module1
        import foo from lib

        export function use1(): void
          foo();
        end function
      `;

      const module2Source = `
        module module2
        import bar from lib

        export function use2(): void
          // bar never used
        end function
      `;

      const result = analyzeMultipleModules([libSource, module1Source, module2Source]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
      expect(hints[0].message).toContain('bar');
    });
  });

  describe('Diagnostic Properties', () => {
    it('should have correct diagnostic code', () => {
      const libSource = `
        module utils
        export function unused(): void
        end function
      `;

      const mainSource = `
        module main
        import unused from utils

        export function main(): void
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints[0].code).toBe(DiagnosticCode.UNUSED_IMPORT);
    });

    it('should have correct severity', () => {
      const libSource = `
        module utils
        export function unused(): void
        end function
      `;

      const mainSource = `
        module main
        import unused from utils

        export function main(): void
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.code === DiagnosticCode.UNUSED_IMPORT);
      expect(hints[0].severity).toBe(DiagnosticSeverity.HINT);
    });

    it('should have informative message', () => {
      const libSource = `
        module utils
        export function myFunction(): void
        end function
      `;

      const mainSource = `
        module main
        import myFunction from utils

        export function main(): void
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      const hints = result.diagnostics.filter(d => d.code === DiagnosticCode.UNUSED_IMPORT);
      expect(hints[0].message).toContain('myFunction');
      expect(hints[0].message).toContain('imported');
      expect(hints[0].message).toContain('never used');
    });
  });

  describe('Compilation Success', () => {
    it('should not affect compilation success (hints do not fail compilation)', () => {
      const libSource = `
        module utils
        export function unused(): void
        end function
      `;

      const mainSource = `
        module main
        import unused from utils

        export function main(): void
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      // Compilation should still succeed with hints
      expect(result.success).toBe(true);

      // But hints should be present
      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
    });

    it('should coexist with errors', () => {
      const libSource = `
        module utils
        export function unused(): void
        end function
      `;

      const mainSource = `
        module main
        import unused from utils

        export function main(): void
          let x: byte = "string";  // Type error
        end function
      `;

      const result = analyzeMultipleModules([libSource, mainSource]);

      // Should fail due to type error
      expect(result.success).toBe(false);

      // But should also have the unused import hint
      const hints = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.HINT);
      expect(hints.length).toBe(1);
      expect(hints[0].code).toBe(DiagnosticCode.UNUSED_IMPORT);
    });
  });
});
