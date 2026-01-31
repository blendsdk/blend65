/**
 * @file Expression Type Checker Tests
 *
 * Tests for the ExpressionTypeChecker class, which handles type checking
 * for all expression types beyond literals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program, Expression } from '../../../ast/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';
import {
  ExpressionTypeChecker,
  TypeCheckResult,
  TypeCheckPassResult,
} from '../../../semantic/visitors/type-checker/index.js';

// ============================================
// TEST CONCRETE IMPLEMENTATION
// ============================================

/**
 * Concrete test implementation of ExpressionTypeChecker
 */
class TestExpressionTypeChecker extends ExpressionTypeChecker {
  /**
   * Checks type of a single expression for testing
   */
  public checkExpression(expr: Expression, symbolTable: SymbolTable): TypeCheckResult | null {
    this.initializeState(symbolTable);
    expr.accept(this);
    return this.getExpressionType(expr);
  }

  /**
   * Checks a program and returns the result
   */
  public check(symbolTable: SymbolTable, program: Program): TypeCheckPassResult {
    this.initializeState(symbolTable);
    this.walk(program);
    return this.finalizeResult();
  }
}

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
 * Creates an expression from source code wrapped in a variable declaration
 */
function createExpr(exprSource: string): Expression {
  const source = `module test\nlet x: byte = ${exprSource};`;
  const program = parseProgram(source);
  const decl = program.getDeclarations()[0];

  if ('getInitializer' in decl) {
    const init = (decl as { getInitializer(): Expression | null }).getInitializer();
    if (init) return init;
  }

  throw new Error(`Could not extract expression from: ${exprSource}`);
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

  // Add test array
  table.declareVariable('buffer', loc, typeSystem.createArrayType(typeSystem.getBuiltinType('byte')!, 10), {
    isConst: false,
    isExported: false,
  });

  // Add test function - declare the function and manually set its type
  const addResult = table.declareFunction('add', loc, typeSystem.getBuiltinType('byte')!, undefined, false);
  if (addResult.symbol) {
    addResult.symbol.type = typeSystem.createFunctionType(
      [typeSystem.getBuiltinType('byte')!, typeSystem.getBuiltinType('byte')!],
      typeSystem.getBuiltinType('byte')!
    );
  }

  // Add void function
  const doSomethingResult = table.declareFunction('doSomething', loc, typeSystem.getBuiltinType('void')!, undefined, false);
  if (doSomethingResult.symbol) {
    doSomethingResult.symbol.type = typeSystem.createFunctionType([], typeSystem.getBuiltinType('void')!);
  }

  return table;
}

// ============================================
// TEST SUITES
// ============================================

describe('ExpressionTypeChecker', () => {
  let checker: TestExpressionTypeChecker;
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    checker = new TestExpressionTypeChecker(typeSystem);
    symbolTable = createTestSymbolTable(typeSystem);
  });

  // ============================================
  // IDENTIFIER EXPRESSION TESTS
  // ============================================

  describe('identifier expressions', () => {
    it('should resolve byte variable type', () => {
      const expr = createExpr('counter');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.isConstant).toBe(false);
    });

    it('should resolve word variable type', () => {
      const expr = createExpr('total');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Word);
    });

    it('should resolve bool variable type', () => {
      const expr = createExpr('flag');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
    });

    it('should resolve array variable type', () => {
      const expr = createExpr('buffer');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Array);
      expect(result!.type?.elementType?.kind).toBe(TypeKind.Byte);
    });

    it('should resolve function variable type', () => {
      const expr = createExpr('add');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Function);
    });

    it('should report error for undefined variable', () => {
      const expr = createExpr('undefined_var');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type).toBeNull();

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].message).toContain("Cannot find name 'undefined_var'");
    });
  });

  // ============================================
  // BINARY EXPRESSION TESTS
  // ============================================

  describe('binary expressions', () => {
    describe('arithmetic operators', () => {
      it('should infer byte + byte = byte', () => {
        const expr = createExpr('5 + 3');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.isConstant).toBe(true);
        expect(result!.constantValue).toBe(8);
      });

      it('should infer byte - byte = byte', () => {
        const expr = createExpr('10 - 4');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(6);
      });

      it('should infer byte * byte = byte', () => {
        const expr = createExpr('6 * 7');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(42);
      });

      it('should infer byte / byte = byte', () => {
        const expr = createExpr('20 / 4');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(5);
      });

      it('should infer byte % byte = byte', () => {
        const expr = createExpr('17 % 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(2);
      });

      it('should infer word + byte = word', () => {
        const expr = createExpr('$100 + 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
      });

      it('should infer byte + word = word', () => {
        const expr = createExpr('5 + $100');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
      });

      it('should handle variable in arithmetic', () => {
        const expr = createExpr('counter + 1');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.isConstant).toBe(false); // Variable makes it non-constant
      });
    });

    describe('comparison operators', () => {
      it('should infer bool for == comparison', () => {
        const expr = createExpr('5 == 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.isConstant).toBe(true);
        expect(result!.constantValue).toBe(true);
      });

      it('should infer bool for != comparison', () => {
        const expr = createExpr('5 != 3');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.constantValue).toBe(true);
      });

      it('should infer bool for < comparison', () => {
        const expr = createExpr('3 < 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.constantValue).toBe(true);
      });

      it('should infer bool for <= comparison', () => {
        const expr = createExpr('5 <= 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.constantValue).toBe(true);
      });

      it('should infer bool for > comparison', () => {
        const expr = createExpr('10 > 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.constantValue).toBe(true);
      });

      it('should infer bool for >= comparison', () => {
        const expr = createExpr('5 >= 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
        expect(result!.constantValue).toBe(true);
      });
    });

    describe('logical operators', () => {
      it('should infer bool for && operation', () => {
        const expr = createExpr('true && false');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
      });

      it('should infer bool for || operation', () => {
        const expr = createExpr('true || false');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Bool);
      });
    });

    describe('bitwise operators', () => {
      it('should infer byte for byte & byte', () => {
        const expr = createExpr('$FF & $0F');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(0x0F);
      });

      it('should infer byte for byte | byte', () => {
        const expr = createExpr('$F0 | $0F');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(0xFF);
      });

      it('should infer byte for byte ^ byte', () => {
        const expr = createExpr('$FF ^ $0F');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(0xF0);
      });

      it('should infer byte for byte << byte', () => {
        const expr = createExpr('1 << 4');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(16);
      });

      it('should infer byte for byte >> byte', () => {
        const expr = createExpr('16 >> 2');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(4);
      });

      it('should infer word for word & word', () => {
        const expr = createExpr('$FFFF & $00FF');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
      });
    });

    describe('operator errors', () => {
      it('should report error for string + number', () => {
        const expr = createExpr('"hello" + 5');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type).toBeNull();

        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain("cannot be applied");
      });
    });
  });

  // ============================================
  // UNARY EXPRESSION TESTS
  // ============================================

  describe('unary expressions', () => {
    it('should infer byte for -byte', () => {
      const expr = createExpr('-5');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.isConstant).toBe(true);
    });

    it('should infer byte for +byte', () => {
      const expr = createExpr('+5');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
    });

    it('should infer bool for !bool', () => {
      const expr = createExpr('!true');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
      expect(result!.constantValue).toBe(false);
    });

    it('should infer bool for !false', () => {
      const expr = createExpr('!false');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
      expect(result!.constantValue).toBe(true);
    });

    it('should infer byte for ~byte', () => {
      const expr = createExpr('~$0F');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
    });

    it('should infer word for ~word', () => {
      const expr = createExpr('~$100');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Word);
    });

    it('should handle variable in unary', () => {
      const expr = createExpr('-counter');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.isConstant).toBe(false);
    });

    it('should report error for invalid unary operand', () => {
      const expr = createExpr('-"hello"');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type).toBeNull();

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("cannot be applied");
    });
  });

  // ============================================
  // INDEX EXPRESSION TESTS
  // ============================================

  describe('index expressions', () => {
    it('should infer element type for array index', () => {
      const expr = createExpr('buffer[0]');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
    });

    it('should accept byte index', () => {
      const expr = createExpr('buffer[5]');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(checker.getDiagnostics().length).toBe(0);
    });

    it('should report error for non-array indexing', () => {
      const expr = createExpr('counter[0]');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type).toBeNull();

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Cannot index non-array");
    });

    it('should report error for non-numeric index', () => {
      const expr = createExpr('buffer["key"]');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type).toBeNull();

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("index must be numeric");
    });
  });

  // ============================================
  // TERNARY EXPRESSION TESTS
  // ============================================

  describe('ternary expressions', () => {
    it('should infer type from matching branches', () => {
      const expr = createExpr('true ? 5 : 10');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
    });

    it('should constant fold ternary with true condition', () => {
      const expr = createExpr('true ? 5 : 10');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.isConstant).toBe(true);
      expect(result!.constantValue).toBe(5);
    });

    it('should constant fold ternary with false condition', () => {
      const expr = createExpr('false ? 5 : 10');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.isConstant).toBe(true);
      expect(result!.constantValue).toBe(10);
    });

    it('should widen to word for byte/word branches', () => {
      const expr = createExpr('true ? 5 : $100');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Word);
    });

    it('should accept byte as condition', () => {
      const expr = createExpr('1 ? 5 : 10');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(checker.getDiagnostics().length).toBe(0);
    });

    it('should handle variable condition', () => {
      const expr = createExpr('flag ? 1 : 0');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.isConstant).toBe(false);
    });

    it('should report error for incompatible branch types', () => {
      const expr = createExpr('true ? 5 : "hello"');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type).toBeNull();

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("incompatible types");
    });

    it('should report error for string condition', () => {
      const expr = createExpr('"test" ? 5 : 10');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      // String is not boolean-like
      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("boolean-like");
    });
  });

  // ============================================
  // COMPLEX EXPRESSION TESTS
  // ============================================

  describe('complex expressions', () => {
    it('should handle nested binary expressions', () => {
      const expr = createExpr('1 + 2 * 3');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
    });

    it('should handle parenthesized expressions', () => {
      const expr = createExpr('(1 + 2) * 3');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.constantValue).toBe(9);
    });

    it('should handle comparison chain', () => {
      const expr = createExpr('5 > 3 && 10 < 20');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
    });

    it('should handle variable with arithmetic', () => {
      const expr = createExpr('counter + total');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      // byte + word = word
      expect(result!.type?.kind).toBe(TypeKind.Word);
    });
  });

  // ============================================
  // PROGRAM-LEVEL TESTS
  // ============================================

  describe('program-level checking', () => {
    it('should check expressions in function bodies', () => {
      const source = `
        module test
        function calc(): byte {
          return 1 + 2;
        }
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(true);
      expect(result.expressionsChecked).toBeGreaterThan(0);
    });

    it('should accumulate errors from multiple expressions', () => {
      const source = `
        module test
        let a: byte = undefined_var;
        let b: byte = another_undefined;
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2);
    });

    it('should check array index expressions', () => {
      const source = `
        module test
        let arr: byte[3] = [1, 2, 3];
        let x: byte = arr[0];
      `;
      const program = parseProgram(source);
      // Note: 'arr' is not in the test symbol table, so this will fail
      const result = checker.check(symbolTable, program);
      // This is expected to have errors because 'arr' is not defined
      expect(result.expressionsChecked).toBeGreaterThan(0);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle deeply nested expression', () => {
      const expr = createExpr('((1 + 2) * (3 + 4))');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      expect(result!.constantValue).toBe(21);
    });

    it('should handle division by zero gracefully', () => {
      const expr = createExpr('10 / 0');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Byte);
      // Constant value should be undefined for div by zero
      expect(result!.constantValue).toBeUndefined();
    });

    it('should reset state between checks', () => {
      // First check with error
      const expr1 = createExpr('undefined_var');
      checker.checkExpression(expr1, symbolTable);
      expect(checker.getDiagnostics().length).toBe(1);

      // Second check should reset
      const expr2 = createExpr('5');
      checker.checkExpression(expr2, symbolTable);
      expect(checker.getDiagnostics().length).toBe(0);
    });

    it('should handle maximum value arithmetic', () => {
      const expr = createExpr('$FFFF + 1');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Word);
      // Should wrap around due to 16-bit clamping
      expect(result!.constantValue).toBe(0);
    });
  });
});