/**
 * Tests for Constant Propagation Analysis (Task 8.7)
 *
 * Tests the lattice-based optimistic data flow analysis that tracks
 * compile-time constant values through the program.
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { ConstantPropagationAnalyzer } from '../../../semantic/analysis/constant-propagation.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { isVariableDecl } from '../../../ast/type-guards.js';

/**
 * Helper to parse and analyze source code
 */
function analyzeConstantPropagation(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  const symbolTable = analyzer.getSymbolTable();
  const cfgs = analyzer.getAllCFGs();

  const constAnalyzer = new ConstantPropagationAnalyzer(symbolTable, cfgs);
  constAnalyzer.analyze(ast);

  return {
    ast,
    analyzer: constAnalyzer,
    symbolTable,
    cfgs,
    diagnostics: constAnalyzer.getDiagnostics(),
  };
}

describe('ConstantPropagationAnalyzer (Task 8.7)', () => {
  describe('Simple Constant Propagation', () => {
    it('should identify constant literals', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('x')).toEqual({
        kind: 'CONSTANT',
        value: 10,
      });
    });

    it('should propagate constant through assignment', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 42
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('x')).toEqual({
        kind: 'CONSTANT',
        value: 42,
      });
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: 42,
      });
    });

    it('should handle boolean constants', () => {
      const source = `
        module Test

        function test(): void
          let flag: boolean = true
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('flag')).toEqual({
        kind: 'CONSTANT',
        value: true,
      });
    });

    it('should handle zero constants', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 0
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('x')).toEqual({
        kind: 'CONSTANT',
        value: 0,
      });
    });
  });

  describe('Arithmetic Constant Folding', () => {
    it('should fold simple addition', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 30,
      });
      expect(info!.foldableExpressions.size).toBeGreaterThan(0);
    });

    it('should fold subtraction', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 100
          let y: byte = 30
          let z: byte = x - y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 70,
      });
    });

    it('should fold multiplication', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 5
          let y: byte = 6
          let z: byte = x * y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 30,
      });
    });

    it('should fold division', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 20
          let y: byte = 4
          let z: byte = x / y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 5,
      });
    });

    it('should fold complex arithmetic expressions', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 2
          let b: byte = 3
          let c: byte = 4
          let result: byte = a + b * c
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      // Should fold: 2 + (3 * 4) = 14
      expect(info!.constantValues.get('result')).toEqual({
        kind: 'CONSTANT',
        value: 14,
      });
    });
  });

  describe('Bitwise Constant Folding', () => {
    it('should fold bitwise AND', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 15
          let y: byte = 7
          let z: byte = x & y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 7,
      });
    });

    it('should fold bitwise OR', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 8
          let y: byte = 4
          let z: byte = x | y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 12,
      });
    });

    it('should fold bitwise XOR', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 15
          let y: byte = 10
          let z: byte = x ^ y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('z')).toEqual({
        kind: 'CONSTANT',
        value: 5,
      });
    });

    it('should fold left shift', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 3
          let y: byte = x << 2
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: 12,
      });
    });

    it('should fold right shift', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 16
          let y: byte = x >> 2
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: 4,
      });
    });
  });

  describe('Comparison Constant Folding', () => {
    it('should fold equality comparison', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 10
          let result: boolean = x == y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('result')).toEqual({
        kind: 'CONSTANT',
        value: true,
      });
    });

    it('should fold less than comparison', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 5
          let y: byte = 10
          let result: boolean = x < y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('result')).toEqual({
        kind: 'CONSTANT',
        value: true,
      });
    });

    it('should fold greater than comparison', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 20
          let y: byte = 10
          let result: boolean = x > y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('result')).toEqual({
        kind: 'CONSTANT',
        value: true,
      });
    });
  });

  describe('Unary Expression Folding', () => {
    it('should fold negation', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = -x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: -10,
      });
    });

    it('should fold bitwise NOT', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = ~x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: ~10,
      });
    });

    it('should fold logical NOT', () => {
      const source = `
        module Test

        function test(): void
          let x: boolean = true
          let y: boolean = !x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('y')).toEqual({
        kind: 'CONSTANT',
        value: false,
      });
    });
  });

  describe('Constant Branch Conditions', () => {
    it('should detect constant true condition', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          if x > 5 then
            let y: byte = 1
          end if
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantBranches.size).toBeGreaterThan(0);
      
      // Check if any branch condition is constant true
      const hasConstantTrue = Array.from(info!.constantBranches.values()).includes(true);
      expect(hasConstantTrue).toBe(true);
    });

    it('should detect constant false condition', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 3
          if x > 10 then
            let y: byte = 1
          end if
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantBranches.size).toBeGreaterThan(0);
      
      // Check if any branch condition is constant false
      const hasConstantFalse = Array.from(info!.constantBranches.values()).includes(false);
      expect(hasConstantFalse).toBe(true);
    });

    it('should detect constant while loop condition', () => {
      const source = `
        module Test

        function test(): void
          let flag: boolean = false
          while flag
            let x: byte = 1
          end while
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantBranches.size).toBeGreaterThan(0);
    });
  });

  describe('Effectively Constant Variables', () => {
    it('should identify single-assignment constant variables', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 100
          let y: byte = x
          let z: byte = x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.effectivelyConst.has('x')).toBe(true);
    });

    it('should not mark reassigned variables as effectively const', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          x = 20
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.effectivelyConst.has('x')).toBe(false);
    });

    it('should identify multiple effectively const variables', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 10
          let b: byte = 20
          let c: byte = 30
          let sum: byte = a + b + c
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.effectivelyConst.has('a')).toBe(true);
      expect(info!.effectivelyConst.has('b')).toBe(true);
      expect(info!.effectivelyConst.has('c')).toBe(true);
    });
  });

  describe('Non-Constant Detection (BOTTOM)', () => {
    it('should detect non-constant variables without initializers', () => {
      const source = `
        module Test

        function test(): void
          let x: byte
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('x')).toEqual({ kind: 'BOTTOM' });
      expect(info!.constantValues.get('y')).toEqual({ kind: 'BOTTOM' });
    });

    it('should detect non-constant from parameter', () => {
      const source = `
        module Test

        function test(param: byte): void
          let x: byte = param
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      // param is non-constant (comes from caller)
      expect(info!.constantValues.get('x')).toEqual({ kind: 'BOTTOM' });
    });

    it('should detect non-constant from reassignment with different values', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte
          if flag then
            x = 10
          else
            x = 20
          end if
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      // x has different values in different paths: BOTTOM
      expect(info!.constantValues.get('x')).toEqual({ kind: 'BOTTOM' });
    });
  });

  describe('Multi-Level Constant Propagation', () => {
    it('should propagate through multiple assignment levels', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 5
          let b: byte = a
          let c: byte = b
          let d: byte = c
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('a')).toEqual({ kind: 'CONSTANT', value: 5 });
      expect(info!.constantValues.get('b')).toEqual({ kind: 'CONSTANT', value: 5 });
      expect(info!.constantValues.get('c')).toEqual({ kind: 'CONSTANT', value: 5 });
      expect(info!.constantValues.get('d')).toEqual({ kind: 'CONSTANT', value: 5 });
    });

    it('should propagate through arithmetic chains', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 2
          let b: byte = a * 3
          let c: byte = b + 4
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('a')).toEqual({ kind: 'CONSTANT', value: 2 });
      expect(info!.constantValues.get('b')).toEqual({ kind: 'CONSTANT', value: 6 });
      expect(info!.constantValues.get('c')).toEqual({ kind: 'CONSTANT', value: 10 });
    });
  });

  describe('Constant Folding Metadata', () => {
    it('should mark foldable expressions in metadata', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { ast, analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.foldableExpressions.size).toBeGreaterThan(0);

      // Check that some expression has ConstantFoldable metadata
      let hasMetadata = false;
      const checkNode = (node: any): void => {
        if (!node) return;
        
        if (node.metadata) {
          const foldable = node.metadata.get(OptimizationMetadataKey.ConstantFoldable);
          const foldResult = node.metadata.get(OptimizationMetadataKey.ConstantFoldResult);
          
          if (foldable === true && foldResult === 30) {
            hasMetadata = true;
          }
        }

        // Recursively check children
        if (typeof node === 'object') {
          for (const key of Object.keys(node)) {
            const child = (node as any)[key];
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                child.forEach(checkNode);
              } else {
                checkNode(child);
              }
            }
          }
        }
      };

      checkNode(ast);
      expect(hasMetadata).toBe(true);
    });

    it('should store constant values in variable declarations', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 42
        end function
      `;

      const { ast } = analyzeConstantPropagation(source);

      // Check that variable declaration has ConstantValue metadata
      let hasConstantValue = false;
      const checkNode = (node: any): void => {
        if (!node) return;
        
        if (isVariableDecl(node)) {
          if (node.metadata) {
            const constValue = node.metadata.get(OptimizationMetadataKey.ConstantValue);
            if (constValue === 42) {
              hasConstantValue = true;
            }
          }
        }

        // Recursively check children
        if (typeof node === 'object') {
          for (const key of Object.keys(node)) {
            const child = (node as any)[key];
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                child.forEach(checkNode);
              } else {
                checkNode(child);
              }
            }
          }
        }
      };

      checkNode(ast);
      expect(hasConstantValue).toBe(true);
    });

    it('should mark effectively const variables in metadata', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 100
          let y: byte = x
        end function
      `;

      const { ast } = analyzeConstantPropagation(source);

      // Check that variable has ConstantEffectivelyConst metadata
      let hasEffectivelyConst = false;
      const checkNode = (node: any): void => {
        if (!node) return;
        
        if (isVariableDecl(node)) {
          if (node.metadata) {
            const effectivelyConst = node.metadata.get(
              OptimizationMetadataKey.ConstantEffectivelyConst
            );
            if (effectivelyConst === true) {
              hasEffectivelyConst = true;
            }
          }
        }

        // Recursively check children
        if (typeof node === 'object') {
          for (const key of Object.keys(node)) {
            const child = (node as any)[key];
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                child.forEach(checkNode);
              } else {
                checkNode(child);
              }
            }
          }
        }
      };

      checkNode(ast);
      expect(hasEffectivelyConst).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty function', () => {
      const source = `
        module Test

        function test(): void
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.size).toBe(0);
    });

    it('should handle division by zero safely', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 0
          let z: byte = x / y
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      // Division by zero should result in BOTTOM (cannot evaluate)
      const zValue = info!.constantValues.get('z');
      expect(zValue).toBeDefined();
    });

    it('should handle complex nested expressions', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 2
          let b: byte = 3
          let c: byte = 4
          let result: byte = (a + b) * (c - 1)
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      // Should fold: (2 + 3) * (4 - 1) = 5 * 3 = 15
      expect(info!.constantValues.get('result')).toEqual({
        kind: 'CONSTANT',
        value: 15,
      });
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

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      // Should complete without infinite loop
      expect(info).toBeDefined();
    });

    it('should handle large number of constants', () => {
      const source = `
        module Test

        function test(): void
          let c1: byte = 1
          let c2: byte = 2
          let c3: byte = 3
          let c4: byte = 4
          let c5: byte = 5
          let sum: byte = c1 + c2 + c3 + c4 + c5
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('sum')).toEqual({
        kind: 'CONSTANT',
        value: 15,
      });
    });

    it('should handle deeply nested constant expressions', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 1
          let b: byte = a + 1
          let c: byte = b + 1
          let d: byte = c + 1
          let e: byte = d + 1
        end function
      `;

      const { analyzer } = analyzeConstantPropagation(source);
      const info = analyzer.getConstantPropagation('test');

      expect(info).toBeDefined();
      expect(info!.constantValues.get('a')).toEqual({ kind: 'CONSTANT', value: 1 });
      expect(info!.constantValues.get('b')).toEqual({ kind: 'CONSTANT', value: 2 });
      expect(info!.constantValues.get('c')).toEqual({ kind: 'CONSTANT', value: 3 });
      expect(info!.constantValues.get('d')).toEqual({ kind: 'CONSTANT', value: 4 });
      expect(info!.constantValues.get('e')).toEqual({ kind: 'CONSTANT', value: 5 });
    });
  });
});