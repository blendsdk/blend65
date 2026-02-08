/**
 * @file Statement Type Checker Tests
 *
 * Tests for the StatementTypeChecker class, which handles type checking
 * for all statement types including control flow, loops, and jumps.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
 * Creates a symbol table with pre-defined symbols for testing
 */
function createTestSymbolTable(typeSystem: TypeSystem): SymbolTable {
  const table = new SymbolTable();
  const loc = { line: 1, column: 1, offset: 0 };

  // Add test variables
  table.declareVariable('counter', loc, typeSystem.getBuiltinType('byte')!, {
    isConst: false,
    isExported: false,
  });

  table.declareVariable('total', loc, typeSystem.getBuiltinType('word')!, {
    isConst: false,
    isExported: false,
  });

  table.declareVariable('flag', loc, typeSystem.getBuiltinType('bool')!, {
    isConst: false,
    isExported: false,
  });

  table.declareVariable('text', loc, typeSystem.getBuiltinType('string')!, {
    isConst: false,
    isExported: false,
  });

  // Add test array
  table.declareVariable('buffer', loc, typeSystem.createArrayType(typeSystem.getBuiltinType('byte')!, 10), {
    isConst: false,
    isExported: false,
  });

  return table;
}

/**
 * Type checks a program and returns the result
 */
function checkProgram(source: string): TypeCheckPassResult {
  const typeSystem = new TypeSystem();
  const checker = new TypeChecker(typeSystem);
  const symbolTable = createTestSymbolTable(typeSystem);
  const program = parseProgram(source);
  return checker.check(symbolTable, program);
}

/**
 * Analyzes a program using the full SemanticAnalyzer pipeline
 */
function analyzeProgram(source: string): AnalysisResult {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer({
    runAdvancedAnalysis: false,
  });
  return analyzer.analyze(program);
}

// ============================================
// TEST SUITES
// ============================================

describe('StatementTypeChecker', () => {
  let checker: TypeChecker;
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    checker = new TypeChecker(typeSystem);
    symbolTable = createTestSymbolTable(typeSystem);
  });

  // ============================================
  // IF STATEMENT TESTS
  // ============================================

  describe('if statements', () => {
    it('should accept bool condition', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept byte condition (truthy)', () => {
      const source = `
        module test
        function main(): void {
          if (1) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept word condition (truthy)', () => {
      const source = `
        module test
        function main(): void {
          if ($100) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept comparison expression condition', () => {
      const source = `
        module test
        function main(): void {
          if (5 > 3) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept logical expression condition', () => {
      const source = `
        module test
        function main(): void {
          if (true && false) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for string condition', () => {
      const source = `
        module test
        function main(): void {
          if ("hello") {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("bool or numeric");
    });

    it('should type check then branch', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
            let x: byte = "invalid";
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should type check else branch', () => {
      const source = `
        module test
        function main(): void {
          if (false) {
            let x: byte = 1;
          } else {
            let y: byte = "invalid";
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // WHILE STATEMENT TESTS
  // ============================================

  describe('while statements', () => {
    it('should accept bool condition', () => {
      const source = `
        module test
        function main(): void {
          while (false) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept byte condition', () => {
      const source = `
        module test
        function main(): void {
          while (1) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept comparison condition', () => {
      const source = `
        module test
        function main(): void {
          while (5 < 10) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for string condition', () => {
      const source = `
        module test
        function main(): void {
          while ("loop") {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("bool or numeric");
    });

    it('should type check loop body', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            let x: byte = "invalid";
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should allow break inside while', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow continue inside while', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });

  // ============================================
  // FOR STATEMENT TESTS
  // ============================================

  describe('for statements', () => {
    it('should accept simple for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept downto for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 10 downto 0) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept for loop with step', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 100 step 10) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept for loop with explicit word type', () => {
      const source = `
        module test
        function main(): void {
          for (let i: word = 0 to 5000) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for non-numeric start', () => {
      const source = `
        module test
        function main(): void {
          for (i = "start" to 10) {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("numeric");
    });

    it('should report error for non-numeric end', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to "end") {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("numeric");
    });

    it('should report error for non-numeric step', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10 step "two") {
            let x: byte = 1;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("numeric");
    });

    it('should allow break inside for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow continue inside for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });

  // ============================================
  // RETURN STATEMENT TESTS
  // ============================================

  describe('return statements', () => {
    it('should accept void return in void function', () => {
      const source = `
        module test
        function main(): void {
          return;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept byte return in byte function', () => {
      const source = `
        module test
        function getValue(): byte {
          return 42;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept word return in word function', () => {
      const source = `
        module test
        function getAddress(): word {
          return $1000;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should accept bool return in bool function', () => {
      const source = `
        module test
        function isReady(): bool {
          return true;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for return value in void function', () => {
      const source = `
        module test
        function main(): void {
          return 42;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("void function");
    });

    it('should report error for missing return value in non-void function', () => {
      const source = `
        module test
        function getValue(): byte {
          return;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("return a value");
    });

    it('should report error for return type mismatch', () => {
      const source = `
        module test
        function getValue(): byte {
          return "hello";
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("not assignable");
    });

    it('should allow byte to word implicit conversion', () => {
      const source = `
        module test
        function getAddress(): word {
          return 5;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });

  // ============================================
  // BREAK STATEMENT TESTS
  // ============================================

  describe('break statements', () => {
    it('should allow break in while loop', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow break in for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow break in nested loop (inner)', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            for (i = 0 to 10) {
              break;
            }
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for break outside loop', () => {
      const source = `
        module test
        function main(): void {
          break;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("inside a loop");
    });

    it('should report error for break in if without loop', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // CONTINUE STATEMENT TESTS
  // ============================================

  describe('continue statements', () => {
    it('should allow continue in while loop', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow continue in for loop', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should allow continue in nested loop', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            for (i = 0 to 10) {
              continue;
            }
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for continue outside loop', () => {
      const source = `
        module test
        function main(): void {
          continue;
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("inside a loop");
    });

    it('should report error for continue in if without loop', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // EXPRESSION STATEMENT TESTS
  // ============================================

  describe('expression statements', () => {
    it('should check function call expression', () => {
      const source = `
        module test
        function helper(): void {
        }
        function main(): void {
          helper();
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should report error for undefined function call', () => {
      const source = `
        module test
        function main(): void {
          undefined_func();
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // BLOCK STATEMENT TESTS
  // ============================================

  describe('block statements', () => {
    it('should type check all statements in block', () => {
      const source = `
        module test
        function main(): void {
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = a + b;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should report multiple errors in block', () => {
      const source = `
        module test
        function main(): void {
          let a: byte = "invalid1";
          let b: byte = "invalid2";
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2);
    });
  });

  // ============================================
  // NESTED CONTROL FLOW TESTS
  // ============================================

  describe('nested control flow', () => {
    it('should handle nested if statements', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
            if (false) {
              let x: byte = 1;
            }
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle if inside while', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            if (false) {
              break;
            }
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle while inside for', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            while (true) {
              break;
            }
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should track loop depth correctly', () => {
      const source = `
        module test
        function main(): void {
          for (i = 0 to 10) {
            while (true) {
              break;
            }
            continue;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });

  // ============================================
  // COMPLEX SCENARIOS
  // ============================================

  describe('complex scenarios', () => {
    it('should handle function with multiple control flow', () => {
      const source = `
        module test
        function process(): byte {
          let result: byte = 0;
          
          for (i = 0 to 10) {
            if (i == 5) {
              continue;
            }
            result = result + 1;
          }
          
          return result;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should handle early return in loop', () => {
      const source = `
        module test
        function findValue(): byte {
          for (i = 0 to 10) {
            if (i == 5) {
              return i;
            }
          }
          return 0;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });

    it('should type check expression in all statement positions', () => {
      const source = `
        module test
        function test(): byte {
          let x: byte = 5 + 3;
          
          if (x > 5) {
            x = x + 1;
          }
          
          while (x < 20) {
            x = x * 2;
          }
          
          for (i = 0 to x) {
            x = x - 1;
          }
          
          return x;
        }
      `;
      const result = analyzeProgram(source);

      expect(result.success).toBe(true);
      expect(result.stats.errorCount).toBe(0);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle empty function body', () => {
      const source = `
        module test
        function empty(): void {
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle empty if body', () => {
      const source = `
        module test
        function main(): void {
          if (true) {
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle empty loop body', () => {
      const source = `
        module test
        function main(): void {
          while (false) {
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should handle single statement in loop', () => {
      const source = `
        module test
        function main(): void {
          while (true) {
            break;
          }
        }
      `;
      const result = checkProgram(source);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });
});