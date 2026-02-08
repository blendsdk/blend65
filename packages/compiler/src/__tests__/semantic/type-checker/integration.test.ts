/**
 * @file Type Checker Integration Tests
 *
 * Integration tests for the complete TypeChecker class, testing the full
 * type checking pipeline from source code to diagnostics.
 *
 * NOTE: These tests now use the full SemanticAnalyzer pipeline which includes:
 * - Pass 1: Symbol Table Building
 * - Pass 2: Type Resolution
 * - Pass 3: Type Checking
 * - Pass 4+: Control Flow, Call Graph, Advanced Analysis
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program } from '../../../ast/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeChecker, TypeCheckPassResult } from '../../../semantic/visitors/type-checker/index.js';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/analyzer.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parses source code and returns the Program AST
 */
function parseProgram(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Type checks a program using only the TypeChecker (for simple tests)
 * @deprecated Use analyzeProgram() for full pipeline testing
 */
function checkProgram(source: string): TypeCheckPassResult {
  const typeSystem = new TypeSystem();
  const checker = new TypeChecker(typeSystem);
  const symbolTable = new SymbolTable();
  const program = parseProgram(source);
  return checker.check(symbolTable, program);
}

/**
 * Analyzes a program using the full SemanticAnalyzer pipeline
 *
 * This runs all semantic passes:
 * 1. Symbol Table Building
 * 2. Type Resolution
 * 3. Type Checking
 * 4. Control Flow Analysis
 * 5. Call Graph & Recursion Detection
 * 6. Advanced Analysis
 */
function analyzeProgram(source: string): AnalysisResult {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: false, // Skip advanced for faster tests
  });
  return analyzer.analyze(program);
}

// ============================================
// TEST SUITES
// ============================================

describe('TypeChecker Integration', () => {
  // ============================================
  // FULL PROGRAM TESTS
  // ============================================

  describe('full program type checking', () => {
    it('should type check simple hello world program', () => {
      const source = `
        module test
        function main(): void {
          let x: byte = 42;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    // These tests use the full SemanticAnalyzer pipeline (all passes)
    it('should type check program with multiple functions', () => {
      const source = `
        module test
        
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        
        function main(): void {
          let result: byte = add(5, 3);
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check program with global and local variables', () => {
      const source = `
        module test
        
        let globalCounter: word = 0;
        
        function increment(): void {
          let local: byte = 1;
          globalCounter = globalCounter + local;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check program with arrays', () => {
      const source = `
        module test
        
        let buffer: byte[10];
        
        function fillBuffer(): void {
          for (i = 0 to 10) {
            buffer[i] = i;
          }
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });
  });

  // ============================================
  // OPTION TESTS
  // ============================================

  describe('type checker options', () => {
    it('should stop on first error when option is set', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem, { stopOnFirstError: true });
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function main(): void {
          let a: byte = "invalid1";
          let b: byte = "invalid2";
          let c: byte = "invalid3";
        }
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
    });

    it('should suppress warnings when option is set', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem, { reportWarnings: false });
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function getValue(): byte {
          return 5;
        }
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.warningCount).toBe(0);
    });

    it('should respect max errors limit', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem, { maxErrors: 2 });
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function main(): void {
          let a: byte = "invalid1";
          let b: byte = "invalid2";
          let c: byte = "invalid3";
          let d: byte = "invalid4";
        }
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2);
    });
  });

  // ============================================
  // ACCESSOR TESTS
  // ============================================

  describe('type checker accessors', () => {
    it('should get and set options', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem);

      const options = checker.getOptions();
      expect(options.stopOnFirstError).toBe(false);
      expect(options.reportWarnings).toBe(true);
      expect(options.maxErrors).toBe(100);

      checker.setOptions({ stopOnFirstError: true });
      expect(checker.getOptions().stopOnFirstError).toBe(true);
    });

    it('should return errors and warnings separately', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem);
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function main(): void {
          let x: byte = "invalid";
        }
      `;
      const program = parseProgram(source);
      checker.check(symbolTable, program);

      expect(checker.getErrors().length).toBeGreaterThan(0);
      expect(checker.hasErrors()).toBe(true);
    });

    it('should track expressions checked count', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem);
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function main(): void {
          let x: byte = 1 + 2 + 3;
        }
      `;
      const program = parseProgram(source);
      checker.check(symbolTable, program);

      expect(checker.getExpressionsCheckedCount()).toBeGreaterThan(0);
    });
  });

  // ============================================
  // ERROR SCENARIOS
  // ============================================

  describe('error scenarios', () => {
    it('should report type mismatches', () => {
      const source = `
        module test
        function main(): void {
          let x: byte = "hello";
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("not assignable");
    });

    it('should report undefined variables', () => {
      const source = `
        module test
        function main(): void {
          let x: byte = undefined_var;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should report invalid operator usage', () => {
      const source = `
        module test
        function main(): void {
          let x: byte = "hello" + 5;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should report break outside loop', () => {
      const source = `
        module test
        function main(): void {
          break;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should report continue outside loop', () => {
      const source = `
        module test
        function main(): void {
          continue;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // C64 PROGRAMMING PATTERNS
  // ============================================

  describe('C64 programming patterns', () => {
    it('should type check memory access pattern', () => {
      const source = `
        module test
        
        let screenBase: word = $0400;
        
        function clearScreen(): void {
          for (i = 0 to 255) {
            let offset: word = screenBase + i;
          }
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check sprite setup pattern', () => {
      const source = `
        module test
        
        let spriteEnabled: byte = 0;
        let spriteX: byte = 100;
        let spriteY: byte = 100;
        
        function enableSprite(num: byte): void {
          spriteEnabled = spriteEnabled | (1 << num);
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check color cycling pattern', () => {
      const source = `
        module test
        
        let currentColor: byte = 0;
        
        function cycleColor(): void {
          currentColor = currentColor + 1;
          if (currentColor > 15) {
            currentColor = 0;
          }
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check game loop pattern', () => {
      const source = `
        module test
        
        let running: bool = true;
        
        function gameLoop(): void {
          while (running) {
            if (false) {
              running = false;
            }
          }
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });
  });

  // ============================================
  // REAL WORLD PATTERNS
  // ============================================

  describe('real world patterns', () => {
    it('should type check counter with overflow check', () => {
      const source = `
        module test
        
        let counter: byte = 0;
        
        function incrementWithWrap(): byte {
          counter = counter + 1;
          if (counter == 0) {
            counter = 1;
          }
          return counter;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check state machine pattern', () => {
      const source = `
        module test
        
        let state: byte = 0;
        
        function processState(): void {
          if (state == 0) {
            state = 1;
          } else {
            if (state == 1) {
              state = 2;
            } else {
              state = 0;
            }
          }
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check buffer processing pattern', () => {
      const source = `
        module test
        
        let buffer: byte[256];
        let bufferIndex: byte = 0;
        
        function addToBuffer(value: byte): void {
          buffer[bufferIndex] = value;
          bufferIndex = bufferIndex + 1;
        }
        
        function getFromBuffer(): byte {
          bufferIndex = bufferIndex - 1;
          return buffer[bufferIndex];
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });
  });

  // ============================================
  // DEBUG OUTPUT
  // ============================================

  describe('debug output', () => {
    it('should produce readable toString output', () => {
      const typeSystem = new TypeSystem();
      const checker = new TypeChecker(typeSystem);
      const symbolTable = new SymbolTable();

      const source = `
        module test
        function main(): void {
          let x: byte = 5;
        }
      `;
      const program = parseProgram(source);
      checker.check(symbolTable, program);

      const output = checker.toString();
      expect(output).toContain('Type Checking Result');
      expect(output).toContain('Expressions checked');
      expect(output).toContain('Errors');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle empty module', () => {
      const source = `
        module test
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle module with only variable', () => {
      const source = `
        module test
        let x: byte = 5;
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle deeply nested expressions', () => {
      const source = `
        module test
        function main(): void {
          let x: byte = (((1 + 2) * 3) - 4) / 2;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle complex control flow nesting', () => {
      const source = `
        module test
        function complex(): byte {
          let result: byte = 0;
          for (i = 0 to 10) {
            while (result < 50) {
              if (i == 5) {
                break;
              }
              result = result + i;
            }
            if (result > 100) {
              return result;
            }
          }
          return result;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });
  });
});