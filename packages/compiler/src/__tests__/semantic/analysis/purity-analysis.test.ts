/**
 * Tests for Purity Analysis (Task 8.9)
 *
 * Verifies that the analyzer correctly:
 * - Detects pure functions (no side effects, deterministic)
 * - Detects read-only functions (reads global/I/O state)
 * - Detects functions with local effects only
 * - Detects impure functions (observable side effects)
 * - Propagates impurity through call graph
 * - Sets metadata for optimization
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { OptimizationMetadataKey, PurityLevel } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

/**
 * Helper to parse and analyze code
 */
function analyzeCode(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  return {
    ast,
    analyzer,
    diagnostics: analyzer.getDiagnostics(),
    errors: analyzer.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR),
    warnings: analyzer.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.WARNING),
  };
}

describe('PurityAnalyzer', () => {
  describe('Pure Functions', () => {
    it('should mark simple math function as pure', () => {
      const source = `
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Pure);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityIsPure)).toBe(true);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(false);
    });

    it('should mark function with only local variables as pure', () => {
      const source = `
        function calculate(x: byte): byte {
          let temp: byte = x * 2;
          let result: byte = temp + 10;
          return result;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Pure);
    });

    it('should mark function with conditionals as pure if no side effects', () => {
      const source = `
        function max(a: byte, b: byte): byte {
          if (a > b) {
            return a;
          } else {
            return b;
          }
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Pure);
    });

    it('should mark function with loops as pure if no side effects', () => {
      const source = `
        function sum(n: byte): byte {
          let result: byte = 0;
          let i: byte = 0;
          while (i < n) {
            result = result + i;
            i = i + 1;
          }
          return result;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      // This has local effects (modifies local variables) but no global effects
      const purityLevel = funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel);
      expect(purityLevel === PurityLevel.Pure || purityLevel === PurityLevel.LocalEffects).toBe(true);
    });
  });

  describe('Read-Only Functions', () => {
    it('should mark function reading global variable as read-only', () => {
      const source = `
        let globalCounter: byte = 0;

        function getCounter(): byte {
          return globalCounter;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.ReadOnly);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(false);
    });

    it('should mark function reading @map as read-only', () => {
      const source = `
        @map border at $D020: byte;

        function getBorder(): byte {
          return border;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.ReadOnly);
    });

    it('should mark function reading multiple globals as read-only', () => {
      const source = `
        let x: byte = 10;
        let y: byte = 20;

        function sum(): byte {
          return x + y;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[2];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.ReadOnly);
    });
  });

  describe('Local Effects Functions', () => {
    it('should mark function modifying local variable as local effects', () => {
      const source = `
        function process(x: byte): byte {
          let temp: byte = 0;
          temp = x + 1;
          return temp;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      const purityLevel = funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel);
      // Should be Pure or LocalEffects (both are acceptable for local mutations)
      expect(purityLevel === PurityLevel.Pure || purityLevel === PurityLevel.LocalEffects).toBe(true);
    });
  });

  describe('Impure Functions', () => {
    it('should mark function writing to global variable as impure', () => {
      const source = `
        let counter: byte = 0;

        function increment(): void {
          counter = counter + 1;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(true);
    });

    it('should mark function writing to @map as impure', () => {
      const source = `
        @map border at $D020: byte;

        function setBorder(color: byte): void {
          border = color;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(true);
    });

    it('should mark function writing to multiple globals as impure', () => {
      const source = `
        let x: byte = 0;
        let y: byte = 0;

        function reset(): void {
          x = 0;
          y = 0;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[2];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });

    it('should mark function with both reads and writes to globals as impure', () => {
      const source = `
        let counter: byte = 0;

        function incrementAndGet(): byte {
          counter = counter + 1;
          return counter;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });
  });

  describe('Call Graph Propagation', () => {
    it('should propagate purity through function calls', () => {
      const source = `
        function add(a: byte, b: byte): byte {
          return a + b;
        }

        function double(x: byte): byte {
          return add(x, x);
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Both functions should be pure
      const addDecl = ast.getDeclarations()[0];
      const doubleDecl = ast.getDeclarations()[1];

      expect(addDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Pure);
      expect(doubleDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Pure);
    });

    it('should propagate impurity through call chain', () => {
      const source = `
        let state: byte = 0;

        function mutate(): void {
          state = state + 1;
        }

        function wrapper(): void {
          mutate();
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Both functions should be impure
      const mutateDecl = ast.getDeclarations()[1];
      const wrapperDecl = ast.getDeclarations()[2];

      expect(mutateDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(wrapperDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });

    it('should propagate read-only status through calls', () => {
      const source = `
        let config: byte = 10;

        function getConfig(): byte {
          return config;
        }

        function calculateFromConfig(): byte {
          return getConfig() * 2;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Both should be read-only
      const getConfigDecl = ast.getDeclarations()[1];
      const calculateDecl = ast.getDeclarations()[2];

      expect(getConfigDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.ReadOnly);
      expect(calculateDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.ReadOnly);
    });

    it('should handle transitive impurity propagation', () => {
      const source = `
        let counter: byte = 0;

        function leaf(): void {
          counter = counter + 1;
        }

        function middle(): void {
          leaf();
        }

        function top(): void {
          middle();
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // All three should be impure
      const leafDecl = ast.getDeclarations()[1];
      const middleDecl = ast.getDeclarations()[2];
      const topDecl = ast.getDeclarations()[3];

      expect(leafDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(middleDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(topDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });
  });

  describe('Metadata Generation', () => {
    it('should store written locations for impure functions', () => {
      const source = `
        let x: byte = 0;
        let y: byte = 0;

        function update(): void {
          x = 1;
          y = 2;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[2];
      const writtenLocs = funcDecl.metadata?.get(OptimizationMetadataKey.PurityWrittenLocations);

      expect(writtenLocs).toBeDefined();
      if (writtenLocs instanceof Set) {
        expect(writtenLocs.has('x')).toBe(true);
        expect(writtenLocs.has('y')).toBe(true);
      }
    });

    it('should store called functions', () => {
      const source = `
        function helper(x: byte): byte {
          return x + 1;
        }

        function caller(y: byte): byte {
          return helper(y);
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const callerDecl = ast.getDeclarations()[1];
      const calledFuncs = callerDecl.metadata?.get(OptimizationMetadataKey.PurityCalledFunctions);

      expect(calledFuncs).toBeDefined();
      if (calledFuncs instanceof Set) {
        expect(calledFuncs.has('helper')).toBe(true);
      }
    });

    it('should set pure flag for pure functions', () => {
      const source = `
        function pure(x: byte): byte {
          return x * 2;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityIsPure)).toBe(true);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(false);
    });

    it('should set side effects flag for impure functions', () => {
      const source = `
        let global: byte = 0;

        function impure(): void {
          global = 1;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityIsPure)).toBe(false);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle function with mixed operations', () => {
      const source = `
        let state: byte = 0;

        function complex(x: byte): byte {
          let local: byte = x + 1;
          state = state + 1;
          return local + state;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects)).toBe(true);
    });

    it('should handle functions with conditional side effects', () => {
      const source = `
        let flag: byte = 0;

        function conditionalWrite(condition: boolean): void {
          if (condition) {
            flag = 1;
          }
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });

    it('should handle functions with loop-based side effects', () => {
      const source = `
        let accumulator: byte = 0;

        function accumulate(n: byte): void {
          let i: byte = 0;
          while (i < n) {
            accumulator = accumulator + 1;
            i = i + 1;
          }
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });

    it('should handle @map reads and writes correctly', () => {
      const source = `
        @map input at $D800: byte;
        @map output at $D801: byte;

        function copyIO(): void {
          output = input;
          let x: byte = 10;
        }
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[2];
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.PurityLevel)).toBe(PurityLevel.Impure);
    });
  });
});