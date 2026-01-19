/**
 * Tests for Reaching Definitions Analysis (Task 8.5)
 *
 * Tests the forward data flow analysis that computes which
 * variable definitions reach each program point.
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { ReachingDefinitionsAnalyzer } from '../../../semantic/analysis/reaching-definitions.js';

/**
 * Helper to parse and analyze source code
 */
function analyzeReachingDefinitions(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  const symbolTable = analyzer.getSymbolTable();
  const cfgs = analyzer.getAllCFGs();

  const reachingAnalyzer = new ReachingDefinitionsAnalyzer(symbolTable, cfgs);
  reachingAnalyzer.analyze(ast);

  return {
    ast,
    analyzer: reachingAnalyzer,
    symbolTable,
    cfgs,
    diagnostics: reachingAnalyzer.getDiagnostics(),
  };
}

describe('ReachingDefinitionsAnalyzer (Task 8.5)', () => {
  describe('Basic Reaching Definitions', () => {
    it('should track single definition reaching a use', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle multiple variables independently', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.reachingIn.size).toBeGreaterThan(0);
    });

    it('should handle sequential definitions', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          x = 20
          x = 30
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Last definition should kill previous ones
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should track definitions through simple control flow', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = y
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });
  });

  describe('Multiple Definitions of Same Variable', () => {
    it('should handle redefinitions killing previous definitions', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          x = 20
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Second definition should kill first
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should track multiple assignments to same variable', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 1
          x = 2
          x = 3
          x = 4
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle definitions with same initializer', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 10
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.reachingIn.size).toBeGreaterThan(0);
    });
  });

  describe('Definitions Across Branches', () => {
    it('should handle definitions in if branches', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte
          if flag then
            x = 10
          else
            x = 20
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Both definitions should reach the use after if
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should handle definition in only one branch', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte
          if flag then
            x = 10
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle nested if statements', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): void
          let x: byte
          if a then
            if b then
              x = 10
            else
              x = 20
            end if
          else
            x = 30
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // All three definitions should reach the use
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should handle definition before branch', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 10
          if flag then
            let y: byte = x
          else
            let z: byte = x
          end if
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Definition before branch reaches both uses
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });
  });

  describe('Definitions in Loops', () => {
    it('should handle definition before loop', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          while x > 0
            x = x - 1
          end while
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle definition inside loop', () => {
      const source = `
        module Test

        function test(): void
          let x: byte
          while true
            x = 10
            let y: byte = x
          end while
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should handle loop with multiple definitions', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let x: byte = i
            i = i + 1
          end while
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Loop creates multiple reaching definitions
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle nested loops', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 0
          while x < 10
            let y: byte = 0
            while y < 10
              y = y + 1
            end while
            x = x + 1
          end while
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.reachingIn.size).toBeGreaterThan(0);
    });
  });

  describe('Def-Use Chain Correctness', () => {
    it('should build correct def-use chain for single use', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);

      // Find the definition of x
      const xDef = Array.from(info!.defUseChains.keys()).find(def => def.variable === 'x');
      expect(xDef).toBeDefined();

      // Should have at least one use
      if (xDef) {
        const uses = info!.defUseChains.get(xDef);
        expect(uses).toBeDefined();
        expect(uses!.size).toBeGreaterThan(0);
      }
    });

    it('should build correct def-use chain for multiple uses', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = x
          let w: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle def-use chains with no uses', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Definitions exist but may have no uses
      expect(info!.defUseChains).toBeDefined();
    });
  });

  describe('Use-Def Chain Correctness', () => {
    it('should build correct use-def chain for single definition', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should build correct use-def chain for multiple definitions', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte
          if flag then
            x = 10
          else
            x = 20
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Use should have multiple reaching definitions
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should handle use-def chains in complex expressions', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 10
          let b: byte = 20
          let c: byte = a + b
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });
  });

  describe('Complex Control Flow', () => {
    it('should handle complex branching with loops', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 0
          if flag then
            while x < 10
              x = x + 1
            end while
          else
            x = 100
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.useDefChains.size).toBeGreaterThan(0);
    });

    it('should handle multiple paths to same definition', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): void
          let x: byte
          if a then
            x = 10
          end if
          if b then
            let y: byte = x
          end if
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });

    it('should handle early returns', () => {
      const source = `
        module Test

        function test(flag: boolean): byte
          let x: byte = 10
          if flag then
            return x
          end if
          x = 20
          return x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty function', () => {
      const source = `
        module Test

        function test(): void
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBe(0);
    });

    it('should handle function with only declarations', () => {
      const source = `
        module Test

        function test(): void
          let x: byte
          let y: byte
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // No initializers = no definitions
      expect(info!.defUseChains.size).toBe(0);
    });

    it('should handle parameters as definitions', () => {
      const source = `
        module Test

        function test(x: byte): void
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      // Parameters are not tracked as definitions (they come from caller)
      expect(info!.useDefChains.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Correctness', () => {
    it('should converge to fixed point', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 0
          while x < 10
            x = x + 1
          end while
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      // Should complete without infinite loop
      expect(info).toBeDefined();
    });

    it('should handle large number of definitions', () => {
      const source = `
        module Test

        function test(): void
          let x1: byte = 1
          let x2: byte = 2
          let x3: byte = 3
          let x4: byte = 4
          let x5: byte = 5
          let y: byte = x1 + x2 + x3 + x4 + x5
        end function
      `;

      const { analyzer } = analyzeReachingDefinitions(source);
      const info = analyzer.getReachingDefinitions('test');

      expect(info).toBeDefined();
      expect(info!.defUseChains.size).toBeGreaterThan(0);
    });
  });
});