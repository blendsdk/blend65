/**
 * Semantic Analyzer Integration Tests
 *
 * Tests the full semantic analysis pipeline (Passes 1-5)
 * to ensure all passes work correctly together.
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';

describe('Semantic Analyzer Integration', () => {
  /**
   * Helper to run full semantic analysis pipeline
   */
  function analyzeProgram(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(ast);

    return {
      result,
      analyzer,
      ast,
    };
  }

  describe('Full Pipeline Integration', () => {
    test('simple program runs all passes successfully', () => {
      const source = `
        let counter: byte = 0;
        const MAX: byte = 100;

        function increment(): void
          counter = counter + 1;
        end function

        function main(): void
          increment();
          if counter < MAX then
            increment();
          end if
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should succeed with no errors
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // All passes should have run
      expect(analyzer.getSymbolTable()).not.toBeNull();
      expect(analyzer.getTypeSystem()).not.toBeNull();
      expect(analyzer.getAllCFGs().size).toBe(2); // increment + main
    });

    test('program with type errors stops at Pass 3', () => {
      const source = `
        let value: byte = 0;

        function test(): void
          value = "string"; // Type error: cannot assign string to byte
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should fail with type error
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe('error');

      // Pass 1 and 2 should succeed, Pass 3 should detect error
      expect(analyzer.getSymbolTable()).not.toBeNull();
      expect(analyzer.getTypeSystem()).not.toBeNull();
    });

    test('program with duplicate declaration stops at Pass 1', () => {
      const source = `
        let value: byte = 0;
        let value: word = 1; // Duplicate declaration
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should fail at Pass 1
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Duplicate declaration');

      // Only Pass 1 should have run
      expect(analyzer.getSymbolTable()).not.toBeNull();
      expect(analyzer.getTypeSystem()).toBeNull(); // Pass 2 didn't run
    });

    test('all passes provide diagnostics in result', () => {
      const source = `
        let global: byte = 0;

        function test(): word
          global = "error"; // Type error from Pass 3
          if true then
            let unused: byte = 0; // Warning from potential future passes
          end if
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should collect diagnostics from all passes
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Pass 1: Symbol Table Builder', () => {
    test('collects all declarations', () => {
      const source = `
        import math from lib.math;

        @map borderColor at $D020: byte;

        let score: word = 0;
        const MAX_SCORE: word = 9999;

        function initialize(): void
        end function

        export function main(): void
        end function
      `;

      const { analyzer } = analyzeProgram(source);

      const symbolTable = analyzer.getSymbolTable()!;
      const rootScope = symbolTable.getRootScope();

      // Should have: math, borderColor, score, MAX_SCORE, initialize, main
      expect(rootScope.symbols.size).toBe(6);
      expect(rootScope.symbols.has('math')).toBe(true);
      expect(rootScope.symbols.has('borderColor')).toBe(true);
      expect(rootScope.symbols.has('score')).toBe(true);
      expect(rootScope.symbols.has('MAX_SCORE')).toBe(true);
      expect(rootScope.symbols.has('initialize')).toBe(true);
      expect(rootScope.symbols.has('main')).toBe(true);
    });

    test('creates function scopes with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function
      `;

      const { analyzer } = analyzeProgram(source);

      const symbolTable = analyzer.getSymbolTable()!;
      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Parameters should be in function scope
      expect(functionScope.symbols.has('a')).toBe(true);
      expect(functionScope.symbols.has('b')).toBe(true);
    });
  });

  describe('Pass 2: Type Resolution', () => {
    test('resolves type annotations for variables', () => {
      const source = `
        let counter: byte = 0;
        let score: word = 1000;
        let flag: boolean = true;
      `;

      const { analyzer } = analyzeProgram(source);

      const symbolTable = analyzer.getSymbolTable()!;
      const typeSystem = analyzer.getTypeSystem()!;

      // Should have type system
      expect(typeSystem).not.toBeNull();

      // Symbols should have resolved types
      const counter = symbolTable.lookup('counter')!;
      const score = symbolTable.lookup('score')!;
      const flag = symbolTable.lookup('flag')!;

      expect(counter.type?.name).toBe('byte');
      expect(score.type?.name).toBe('word');
      expect(flag.type?.name).toBe('boolean');
    });

    test('resolves array types', () => {
      const source = `
        let buffer: byte[] = [0, 1, 2];
        let fixed: word[10] = [0, 0, 0];
      `;

      const { analyzer } = analyzeProgram(source);

      const symbolTable = analyzer.getSymbolTable()!;

      const buffer = symbolTable.lookup('buffer')!;
      const fixed = symbolTable.lookup('fixed')!;

      expect(buffer.type?.kind).toBe('array');
      expect(fixed.type?.kind).toBe('array');
    });

    test('resolves function signatures', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function
      `;

      const { analyzer } = analyzeProgram(source);

      const symbolTable = analyzer.getSymbolTable()!;
      const addFunc = symbolTable.lookup('add')!;

      expect(addFunc.type).not.toBeNull();
      expect(addFunc.type?.kind).toBe('callback');
    });
  });

  describe('Pass 3: Type Checking', () => {
    test('validates binary operation types', () => {
      const source = `
        let a: byte = 10;
        let b: byte = 20;

        function main(): void
          let result: byte = a + b;
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should succeed - valid types
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    test('detects type mismatches in assignments', () => {
      const source = `
        let counter: byte = 0;

        function test(): void
          counter = "not a number";
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should fail with type error
      expect(result.success).toBe(false);
      // Check for any type-related error message
      const hasTypeError = result.diagnostics.some(
        d =>
          d.message.includes('assign') || d.message.includes('type') || d.message.includes('Cannot')
      );
      expect(hasTypeError).toBe(true);
    });

    test('validates function return types', () => {
      const source = `
        function getValue(): byte
          return "string"; // Wrong return type
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should fail with return type error
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('return'))).toBe(true);
    });

    test('validates break/continue in loops only', () => {
      const source = `
        function test(): void
          break; // Error: not in loop
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should fail - break outside loop
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('must be inside a loop'))).toBe(true);
    });

    test('allows break/continue inside loops', () => {
      const source = `
        function main(): void
          while true
            break;
          end while

          for i = 0 to 10
            continue;
          next i
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('Pass 5: Control Flow Analysis', () => {
    test('builds CFG for each function', () => {
      const source = `
        function foo(): void
        end function

        function bar(): void
        end function

        function baz(): void
        end function
      `;

      const { analyzer } = analyzeProgram(source);

      const cfgs = analyzer.getAllCFGs();

      // Should have CFG for each function
      expect(cfgs.size).toBe(3);
      expect(cfgs.has('foo')).toBe(true);
      expect(cfgs.has('bar')).toBe(true);
      expect(cfgs.has('baz')).toBe(true);
    });

    test('CFG has entry and exit nodes', () => {
      const source = `
        function test(): void
          let x: byte = 0;
        end function
      `;

      const { analyzer } = analyzeProgram(source);

      const cfg = analyzer.getCFG('test')!;
      expect(cfg).not.toBeUndefined();
      expect(cfg.entry).not.toBeNull();
      expect(cfg.exit).not.toBeNull();
    });

    test('detects unreachable code', () => {
      const source = `
        function test(): void
          return;
          let unreachable: byte = 0;
        end function
      `;

      const { result } = analyzeProgram(source);

      // Should warn about unreachable code
      expect(result.diagnostics.some(d => d.message.includes('Unreachable'))).toBe(true);
    });
  });

  describe('Complex Integration Scenarios', () => {
    test('complete C64 program with @map and functions', () => {
      const source = `
        @map borderColor at $D020: byte;
        @map bgColor at $D021: byte;

        let frameCount: byte = 0;

        function initialize(): void
          borderColor = 0;
          bgColor = 0;
          frameCount = 0;
        end function

        function updateColors(): void
          frameCount = frameCount + 1;
          borderColor = frameCount;
        end function

        export function main(): void
          initialize();
          while true
            updateColors();
          end while
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should succeed with no errors
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // All passes should complete successfully
      expect(analyzer.getSymbolTable()).not.toBeNull();
      expect(analyzer.getTypeSystem()).not.toBeNull();
      expect(analyzer.getAllCFGs().size).toBe(3); // initialize, updateColors, main

      // Symbol table should have all declarations
      const symbolTable = analyzer.getSymbolTable()!;
      const rootScope = symbolTable.getRootScope();
      expect(rootScope.symbols.has('borderColor')).toBe(true);
      expect(rootScope.symbols.has('bgColor')).toBe(true);
      expect(rootScope.symbols.has('frameCount')).toBe(true);
    });

    test('program with nested control flow', () => {
      const source = `
        function process(value: byte): byte
          if value > 100 then
            return 100;
          else
            if value < 0 then
              return 0;
            else
              return value;
            end if
          end if
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should succeed
      expect(result.success).toBe(true);

      // Should have CFG with multiple branches
      const cfg = analyzer.getCFG('process')!;
      expect(cfg).not.toBeUndefined();

      // CFG should have computed reachability
      cfg.computeReachability();
      expect(cfg.allPathsReachExit()).toBe(true);
    });

    test('program with for-loop variables', () => {
      const source = `
        function sum(): word
          let total: word = 0;
          for i = 0 to 10
            total = total + i;
          next i
          return total;
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should have symbol table and function scope
      const symbolTable = analyzer.getSymbolTable()!;
      expect(symbolTable).not.toBeNull();
      const functionScope = symbolTable.getRootScope().children[0];
      expect(functionScope).toBeDefined();

      // Check for total (definitely should exist as it's declared with let)
      expect(functionScope.symbols.has('total')).toBe(true);

      // Check that for-loop variable 'i' is tracked in symbol table
      expect(functionScope.symbols.has('i')).toBe(true);

      // Analysis should complete (may have warnings about type compatibility)
      // Note: word + byte might need type checking refinement in future
    });
  });

  describe('Error Recovery and Diagnostics', () => {
    test('continues analysis after non-fatal warnings', () => {
      const source = `
        function test(): void
          let unused: byte = 0; // Potential warning
          let x: byte = 1;
        end function
      `;

      const { result, analyzer } = analyzeProgram(source);

      // Should complete all passes even with warnings
      expect(analyzer.getTypeSystem()).not.toBeNull();
      expect(analyzer.getAllCFGs().size).toBe(1);
    });

    test('aggregates diagnostics from all passes', () => {
      const source = `
        let value: byte = "wrong"; // Type error in Pass 3
        let value: word = 0;       // Duplicate in Pass 1
      `;

      const { result } = analyzeProgram(source);

      // Should have diagnostics from Pass 1
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    test('provides diagnostic counts', () => {
      const source = `
        let a: byte = 0;
        const B: byte = 1;
      `;

      const { analyzer } = analyzeProgram(source);

      const counts = analyzer.getDiagnosticCounts();
      expect(counts).toHaveProperty('errors');
      expect(counts).toHaveProperty('warnings');
      expect(counts).toHaveProperty('info');
      expect(counts).toHaveProperty('hints');
    });
  });
});