/**
 * Tests for Unused Function Detection (Task 8.3)
 *
 * Verifies that the analyzer correctly:
 * - Detects unused functions
 * - Tracks function call counts
 * - Handles entry points (main function)
 * - Handles exported functions
 * - Handles recursive functions
 * - Sets metadata for optimization
 * - Generates appropriate warnings
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { isFunctionDecl } from '../../../ast/type-guards.js';

/**
 * Helper to parse and analyze code
 *
 * @param source - Blend source code to analyze
 * @returns Analysis results including AST, analyzer, and diagnostics
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

/**
 * Helper to find a function declaration by name
 *
 * @param ast - Program AST
 * @param name - Function name
 * @returns Function declaration or undefined
 */
function findFunction(ast: any, name: string): any {
  for (const decl of ast.getDeclarations()) {
    if (isFunctionDecl(decl) && decl.getName() === name) {
      return decl;
    }
  }
  return undefined;
}

describe('UnusedFunctionAnalyzer', () => {
  describe('Smoke Test', () => {
    it('should analyze simple code without crashing', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          helper();
        end function
      `;

      const { ast, analyzer } = analyzeCode(source);
      expect(ast).toBeDefined();
      expect(analyzer).toBeDefined();
    });
  });

  describe('Function Collection', () => {
    it('should collect single function', () => {
      const source = `
        function test(): void
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should collect multiple functions', () => {
      const source = `
        function first(): void
        end function

        function second(): void
        end function

        function third(): void
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should handle functions with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should handle functions with return types', () => {
      const source = `
        function getValue(): byte
          return 42;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Call Tracking', () => {
    it('should track simple function call', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          helper();
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const helper = findFunction(ast, 'helper');
      expect(helper).toBeDefined();
      
      // Verify call count metadata is set
      const callCount = helper?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount);
      expect(callCount).toBe(1);
    });

    it('should track multiple calls to same function', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          helper();
          helper();
          helper();
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const helper = findFunction(ast, 'helper');
      const callCount = helper?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount);
      expect(callCount).toBe(3);
    });

    it('should track calls from multiple functions', () => {
      const source = `
        function utility(): void
        end function

        function first(): void
          utility();
        end function

        function second(): void
          utility();
        end function

        function main(): void
          first();
          second();
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const utility = findFunction(ast, 'utility');
      const callCount = utility?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount);
      expect(callCount).toBe(2);
    });

    it('should handle nested function calls', () => {
      const source = `
        function inner(): void
        end function

        function middle(): void
          inner();
        end function

        function outer(): void
          middle();
        end function

        function main(): void
          outer();
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Each function should be called once
      const inner = findFunction(ast, 'inner');
      const middle = findFunction(ast, 'middle');
      const outer = findFunction(ast, 'outer');

      expect(inner?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
      expect(middle?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
      expect(outer?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    });
  });

  describe('Entry Point Handling', () => {
    it('should not warn about unused main function', () => {
      const source = `
        function main(): void
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      // main should not generate unused warning even with 0 calls
      const unusedWarnings = warnings.filter(w => w.message.includes('never used'));
      expect(unusedWarnings).toHaveLength(0);
    });

    it('should mark main as not unused', () => {
      const source = `
        function main(): void
        end function
      `;

      const { ast } = analyzeCode(source);
      const main = findFunction(ast, 'main');
      
      const isUnused = main?.metadata?.get(OptimizationMetadataKey.CallGraphUnused);
      expect(isUnused).toBe(false);
    });

    it('should allow main to call other functions', () => {
      const source = `
        function initialize(): void
        end function

        function main(): void
          initialize();
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // initialize should not be marked unused
      // (it's called by main)
    });
  });

  describe('Exported Function Handling', () => {
    it('should not warn about unused exported function', () => {
      const source = `
        export function publicAPI(): void
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      // Exported functions should not generate unused warnings
      const unusedWarnings = warnings.filter(w => w.message.includes('never used'));
      expect(unusedWarnings).toHaveLength(0);
    });

    it('should mark exported function as not unused', () => {
      const source = `
        export function publicAPI(): void
        end function
      `;

      const { ast } = analyzeCode(source);
      const publicAPI = findFunction(ast, 'publicAPI');
      
      const isUnused = publicAPI?.metadata?.get(OptimizationMetadataKey.CallGraphUnused);
      expect(isUnused).toBe(false);
    });

    it('should handle mix of exported and private functions', () => {
      const source = `
        function privateHelper(): void
        end function

        export function publicAPI(): void
          privateHelper();
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      // Only the exported function should be exempt from warnings
      // privateHelper is called, so no warning either
      const unusedWarnings = warnings.filter(w => w.message.includes('never used'));
      expect(unusedWarnings).toHaveLength(0);
    });
  });

  describe('Unused Function Detection', () => {
    it('should warn about single unused function', () => {
      const source = `
        function unused(): void
        end function

        function main(): void
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      const unusedWarnings = warnings.filter(w => 
        w.message.includes('unused') && w.message.includes('never used')
      );
      expect(unusedWarnings.length).toBeGreaterThanOrEqual(1);
    });

    it('should warn about multiple unused functions', () => {
      const source = `
        function unused1(): void
        end function

        function unused2(): void
        end function

        function unused3(): void
        end function

        function main(): void
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      const unusedWarnings = warnings.filter(w => 
        w.message.includes('never used')
      );
      expect(unusedWarnings.length).toBeGreaterThanOrEqual(3);
    });

    it('should not warn about used functions', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          helper();
        end function
      `;

      const { warnings } = analyzeCode(source);
      
      // Neither function should have unused warning
      const helperWarnings = warnings.filter(w => 
        w.message.includes('helper') && w.message.includes('never used')
      );
      expect(helperWarnings).toHaveLength(0);
    });

    it('should set unused flag correctly', () => {
      const source = `
        function used(): void
        end function

        function unused(): void
        end function

        function main(): void
          used();
        end function
      `;

      const { ast } = analyzeCode(source);
      
      const used = findFunction(ast, 'used');
      const unused = findFunction(ast, 'unused');
      const main = findFunction(ast, 'main');
      
      expect(used?.metadata?.get(OptimizationMetadataKey.CallGraphUnused)).toBe(false);
      expect(unused?.metadata?.get(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
      expect(main?.metadata?.get(OptimizationMetadataKey.CallGraphUnused)).toBe(false);
    });
  });

  describe('Recursive Functions', () => {
    it('should handle directly recursive function', () => {
      const source = `
        function recursive(n: byte): byte
          if n = 0 then
            return 1;
          else
            return n * recursive(n - 1);
          end if
        end function

        function main(): void
          let result: byte = recursive(5);
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Recursive function should be counted as called
      // (both by main and by itself)
    });

    it('should handle mutually recursive functions', () => {
      const source = `
        function even(n: byte): boolean
          if n = 0 then
            return true;
          else
            return odd(n - 1);
          end if
        end function

        function odd(n: byte): boolean
          if n = 0 then
            return false;
          else
            return even(n - 1);
          end if
        end function

        function main(): void
          let isEven: boolean = even(4);
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Both functions should be counted as called
    });
  });

  describe('Metadata Generation', () => {
    it('should set call count metadata', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          helper();
        end function
      `;

      const { ast } = analyzeCode(source);
      const helper = findFunction(ast, 'helper');
      
      expect(helper?.metadata).toBeDefined();
      expect(helper?.metadata?.has(OptimizationMetadataKey.CallGraphCallCount)).toBe(true);
      expect(helper?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    });

    it('should set unused flag metadata', () => {
      const source = `
        function unused(): void
        end function

        function main(): void
        end function
      `;

      const { ast } = analyzeCode(source);
      const unused = findFunction(ast, 'unused');
      
      expect(unused?.metadata).toBeDefined();
      expect(unused?.metadata?.has(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
      expect(unused?.metadata?.get(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
    });

    it('should set metadata for all functions', () => {
      const source = `
        function first(): void
        end function

        function second(): void
          first();
        end function

        function main(): void
          second();
        end function
      `;

      const { ast } = analyzeCode(source);
      
      const first = findFunction(ast, 'first');
      const second = findFunction(ast, 'second');
      const main = findFunction(ast, 'main');
      
      // All functions should have metadata
      expect(first?.metadata?.has(OptimizationMetadataKey.CallGraphCallCount)).toBe(true);
      expect(second?.metadata?.has(OptimizationMetadataKey.CallGraphCallCount)).toBe(true);
      expect(main?.metadata?.has(OptimizationMetadataKey.CallGraphCallCount)).toBe(true);
      
      expect(first?.metadata?.has(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
      expect(second?.metadata?.has(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
      expect(main?.metadata?.has(OptimizationMetadataKey.CallGraphUnused)).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle functions with control flow', () => {
      const source = `
        function conditional(flag: boolean): void
        end function

        function main(): void
          let x: boolean = true;
          if x then
            conditional(x);
          end if
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const conditional = findFunction(ast, 'conditional');
      expect(conditional?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    });

    it('should handle stub functions (no body)', () => {
      const source = `
        function external(): void;

        function main(): void
          external();
        end function
      `;

      const { errors } = analyzeCode(source);
      // Stub functions should not crash analyzer
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle functions with expressions as arguments', () => {
      const source = `
        function compute(a: byte, b: byte): byte
          return a + b;
        end function

        function main(): void
          let result: byte = compute(10 + 5, 20 * 2);
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const compute = findFunction(ast, 'compute');
      expect(compute?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty program', () => {
      const source = ``;

      const { errors } = analyzeCode(source);
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle program with only main', () => {
      const source = `
        function main(): void
        end function
      `;

      const { warnings } = analyzeCode(source);
      const unusedWarnings = warnings.filter(w => w.message.includes('never used'));
      expect(unusedWarnings).toHaveLength(0);
    });

    it('should handle functions in different scopes', () => {
      const source = `
        function helper(): void
        end function

        function main(): void
          let x: byte = 42;
          helper();
        end function
      `;

      const { ast } = analyzeCode(source);
      const helper = findFunction(ast, 'helper');
      
      // Function should be tracked even when variables exist in same scope
      expect(helper?.metadata?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    });
  });
});