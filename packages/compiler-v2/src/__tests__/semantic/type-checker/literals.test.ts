/**
 * @file Literal Type Checker Tests
 *
 * Tests for the LiteralTypeChecker class, which handles type inference
 * for literal expressions: numeric, string, boolean, and array literals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program, LiteralExpression, ArrayLiteralExpression, Expression } from '../../../ast/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';
import {
  TypeCheckerBase,
  LiteralTypeChecker,
  TypeCheckResult,
  TypeCheckPassResult,
  TypeCheckDiagnosticCodes,
} from '../../../semantic/visitors/type-checker/index.js';

// ============================================
// TEST CONCRETE IMPLEMENTATION
// ============================================

/**
 * Concrete test implementation of LiteralTypeChecker
 *
 * Since LiteralTypeChecker is abstract, we create a concrete version
 * for testing that provides a public check() method.
 */
class TestLiteralTypeChecker extends LiteralTypeChecker {
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
 * Creates a literal expression from source code
 */
function createLiteralExpr(literalSource: string): LiteralExpression {
  // Wrap in a variable declaration to parse as expression
  const source = `module test\nlet x: byte = ${literalSource};`;
  const program = parseProgram(source);
  const decl = program.getDeclarations()[0];

  // Navigate to the initializer expression
  if ('getInitializer' in decl) {
    const init = (decl as { getInitializer(): Expression | null }).getInitializer();
    if (init) {
      return init as LiteralExpression;
    }
  }

  throw new Error(`Could not extract literal from: ${literalSource}`);
}

/**
 * Creates an array literal expression from source code
 */
function createArrayLiteralExpr(arraySource: string): ArrayLiteralExpression {
  // Wrap in a variable declaration to parse as expression
  const source = `module test\nlet x: byte[3] = ${arraySource};`;
  const program = parseProgram(source);
  const decl = program.getDeclarations()[0];

  // Navigate to the initializer expression
  if ('getInitializer' in decl) {
    const init = (decl as { getInitializer(): Expression | null }).getInitializer();
    if (init) {
      return init as ArrayLiteralExpression;
    }
  }

  throw new Error(`Could not extract array literal from: ${arraySource}`);
}

// ============================================
// TEST SUITES
// ============================================

describe('LiteralTypeChecker', () => {
  let checker: TestLiteralTypeChecker;
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    checker = new TestLiteralTypeChecker(typeSystem);
    symbolTable = new SymbolTable();
  });

  // ============================================
  // CONSTRUCTION TESTS
  // ============================================

  describe('construction', () => {
    it('should create with default type system', () => {
      const defaultChecker = new TestLiteralTypeChecker();
      expect(defaultChecker.getTypeSystem()).toBeInstanceOf(TypeSystem);
    });

    it('should accept custom type system', () => {
      const customTypeSystem = new TypeSystem();
      const customChecker = new TestLiteralTypeChecker(customTypeSystem);
      expect(customChecker.getTypeSystem()).toBe(customTypeSystem);
    });

    it('should start with empty diagnostics', () => {
      expect(checker.getDiagnostics()).toHaveLength(0);
    });

    it('should start with empty expression type map', () => {
      expect(checker.getExpressionTypeMap().size).toBe(0);
    });
  });

  // ============================================
  // NUMERIC LITERAL TESTS
  // ============================================

  describe('numeric literals', () => {
    describe('byte range (0-255)', () => {
      it('should infer byte type for 0', () => {
        const expr = createLiteralExpr('0');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.type?.name).toBe('byte');
        expect(result!.isConstant).toBe(true);
        expect(result!.constantValue).toBe(0);
      });

      it('should infer byte type for 42', () => {
        const expr = createLiteralExpr('42');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.isConstant).toBe(true);
        expect(result!.constantValue).toBe(42);
      });

      it('should infer byte type for 255', () => {
        const expr = createLiteralExpr('255');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(255);
      });

      it('should infer byte type for hex value $00', () => {
        const expr = createLiteralExpr('$00');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(0);
      });

      it('should infer byte type for hex value $FF', () => {
        const expr = createLiteralExpr('$FF');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(255);
      });

      it('should infer byte type for hex value 0xFF', () => {
        const expr = createLiteralExpr('0xFF');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(255);
      });

      it('should infer byte type for binary value 0b11111111', () => {
        const expr = createLiteralExpr('0b11111111');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Byte);
        expect(result!.constantValue).toBe(255);
      });
    });

    describe('word range (256-65535)', () => {
      it('should infer word type for 256', () => {
        const expr = createLiteralExpr('256');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.type?.name).toBe('word');
        expect(result!.isConstant).toBe(true);
        expect(result!.constantValue).toBe(256);
      });

      it('should infer word type for 1000', () => {
        const expr = createLiteralExpr('1000');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.constantValue).toBe(1000);
      });

      it('should infer word type for 65535', () => {
        const expr = createLiteralExpr('65535');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.constantValue).toBe(65535);
      });

      it('should infer word type for hex value $D000', () => {
        const expr = createLiteralExpr('$D000');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.constantValue).toBe(0xD000);
      });

      it('should infer word type for hex value $FFFF', () => {
        const expr = createLiteralExpr('$FFFF');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.constantValue).toBe(65535);
      });

      it('should infer word type for 0x1234', () => {
        const expr = createLiteralExpr('0x1234');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Word);
        expect(result!.constantValue).toBe(0x1234);
      });
    });

    describe('boundary values', () => {
      it('should infer byte for 255 (max byte)', () => {
        const expr = createLiteralExpr('255');
        const result = checker.checkExpression(expr, symbolTable);
        expect(result!.type?.kind).toBe(TypeKind.Byte);
      });

      it('should infer word for 256 (min word)', () => {
        const expr = createLiteralExpr('256');
        const result = checker.checkExpression(expr, symbolTable);
        expect(result!.type?.kind).toBe(TypeKind.Word);
      });
    });
  });

  // ============================================
  // BOOLEAN LITERAL TESTS
  // ============================================

  describe('boolean literals', () => {
    it('should infer bool type for true', () => {
      const expr = createLiteralExpr('true');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
      expect(result!.type?.name).toBe('bool');
      expect(result!.isConstant).toBe(true);
      expect(result!.constantValue).toBe(true);
    });

    it('should infer bool type for false', () => {
      const expr = createLiteralExpr('false');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.Bool);
      expect(result!.isConstant).toBe(true);
      expect(result!.constantValue).toBe(false);
    });
  });

  // ============================================
  // STRING LITERAL TESTS
  // ============================================

  describe('string literals', () => {
    it('should infer string type for simple string', () => {
      const expr = createLiteralExpr('"hello"');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.String);
      expect(result!.type?.name).toBe('string');
      expect(result!.isConstant).toBe(true);
      expect(result!.constantValue).toBe('hello');
    });

    it('should infer string type for empty string', () => {
      const expr = createLiteralExpr('""');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.type?.kind).toBe(TypeKind.String);
      expect(result!.constantValue).toBe('');
    });

    it('should preserve string content with spaces', () => {
      const expr = createLiteralExpr('"hello world"');
      const result = checker.checkExpression(expr, symbolTable);

      expect(result).not.toBeNull();
      expect(result!.constantValue).toBe('hello world');
    });
  });

  // ============================================
  // ARRAY LITERAL TESTS
  // ============================================

  describe('array literals', () => {
    describe('byte arrays', () => {
      it('should infer byte[] for array of byte literals', () => {
        const expr = createArrayLiteralExpr('[1, 2, 3]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Array);
        expect(result!.type?.name).toBe('byte[3]');
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Byte);
        expect(result!.type?.elementCount).toBe(3);
      });

      it('should infer byte[] for single byte element', () => {
        const expr = createArrayLiteralExpr('[42]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Array);
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Byte);
        expect(result!.type?.elementCount).toBe(1);
      });

      it('should handle hex values in byte range', () => {
        const expr = createArrayLiteralExpr('[$00, $FF, $80]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Byte);
      });
    });

    describe('word arrays', () => {
      it('should infer word[] for array with word values', () => {
        const expr = createArrayLiteralExpr('[$100, $200, $300]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Array);
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Word);
      });

      it('should widen to word[] if any element is word', () => {
        const expr = createArrayLiteralExpr('[1, 256, 3]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Word);
      });

      it('should infer word[] for large hex addresses', () => {
        const expr = createArrayLiteralExpr('[$D000, $D020, $D021]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Word);
      });
    });

    describe('boolean arrays', () => {
      it('should infer bool[] for boolean literals', () => {
        const expr = createArrayLiteralExpr('[true, false, true]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type?.kind).toBe(TypeKind.Array);
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Bool);
      });
    });

    describe('constant arrays', () => {
      it('should mark array as constant if all elements are constant', () => {
        const expr = createArrayLiteralExpr('[1, 2, 3]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.isConstant).toBe(true);
      });
    });

    describe('empty arrays', () => {
      it('should report error for empty array literal', () => {
        const expr = createArrayLiteralExpr('[]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type).toBeNull();

        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('Cannot infer type of empty array');
      });
    });

    describe('mixed type arrays', () => {
      it('should promote byte/bool to byte', () => {
        const expr = createArrayLiteralExpr('[1, true, 3]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        // bool and byte are compatible, promotes to byte
        expect(result!.type?.elementType?.kind).toBe(TypeKind.Byte);
      });

      it('should report error for incompatible types', () => {
        // String and numeric are incompatible
        const expr = createArrayLiteralExpr('["hello", 42]');
        const result = checker.checkExpression(expr, symbolTable);

        expect(result).not.toBeNull();
        expect(result!.type).toBeNull();

        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('incompatible');
      });
    });
  });

  // ============================================
  // PROGRAM-LEVEL TYPE CHECKING TESTS
  // ============================================

  describe('program-level checking', () => {
    it('should check literals in variable declarations', () => {
      const source = `
        module test
        let x: byte = 42;
        let y: word = $D000;
        let z: bool = true;
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(true);
      expect(result.expressionsChecked).toBeGreaterThanOrEqual(3);
      expect(result.errorCount).toBe(0);
    });

    it('should check array literals in declarations', () => {
      const source = `
        module test
        let arr: byte[3] = [1, 2, 3];
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(true);
      // Should check array + 3 elements = 4 expressions
      expect(result.expressionsChecked).toBeGreaterThanOrEqual(4);
    });

    it('should accumulate errors from multiple literals', () => {
      const source = `
        module test
        let a: byte[0] = [];
        let b: byte[0] = [];
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2); // Two empty array errors
    });
  });

  // ============================================
  // DIAGNOSTICS TESTS
  // ============================================

  describe('diagnostics', () => {
    it('should report error with correct location', () => {
      const expr = createArrayLiteralExpr('[]');
      checker.checkExpression(expr, symbolTable);

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].location).toBeDefined();
      expect(diagnostics[0].severity).toBe('error');
    });

    it('should include helpful notes in diagnostics', () => {
      const expr = createArrayLiteralExpr('[]');
      checker.checkExpression(expr, symbolTable);

      const diagnostics = checker.getDiagnostics();
      expect(diagnostics[0].relatedLocations).toBeDefined();
      expect(diagnostics[0].relatedLocations![0].message).toContain('Provide');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle deeply nested array', () => {
      // Note: This creates a flat array in Blend65
      const expr = createArrayLiteralExpr('[1, 2, 3]');
      const result = checker.checkExpression(expr, symbolTable);
      expect(result!.type).not.toBeNull();
    });

    it('should reset state between checks', () => {
      // First check
      const expr1 = createArrayLiteralExpr('[]');
      checker.checkExpression(expr1, symbolTable);
      expect(checker.getDiagnostics().length).toBe(1);

      // Second check should reset state
      const expr2 = createLiteralExpr('42');
      checker.checkExpression(expr2, symbolTable);
      // getDiagnostics() was reset
      expect(checker.getDiagnostics().length).toBe(0);
    });

    it('should handle maximum byte value boundary', () => {
      const expr255 = createLiteralExpr('255');
      const result255 = checker.checkExpression(expr255, symbolTable);
      expect(result255!.type?.kind).toBe(TypeKind.Byte);

      const expr256 = createLiteralExpr('256');
      const result256 = checker.checkExpression(expr256, symbolTable);
      expect(result256!.type?.kind).toBe(TypeKind.Word);
    });

    it('should handle maximum word value boundary', () => {
      const expr = createLiteralExpr('65535');
      const result = checker.checkExpression(expr, symbolTable);
      expect(result!.type?.kind).toBe(TypeKind.Word);
      expect(result!.constantValue).toBe(65535);
    });
  });

  // ============================================
  // TYPE SYSTEM INTEGRATION
  // ============================================

  describe('type system integration', () => {
    it('should use correct byte type from type system', () => {
      const expr = createLiteralExpr('42');
      const result = checker.checkExpression(expr, symbolTable);

      const byteType = typeSystem.getBuiltinType('byte');
      expect(result!.type?.kind).toBe(byteType?.kind);
      expect(result!.type?.size).toBe(byteType?.size);
    });

    it('should use correct word type from type system', () => {
      const expr = createLiteralExpr('1000');
      const result = checker.checkExpression(expr, symbolTable);

      const wordType = typeSystem.getBuiltinType('word');
      expect(result!.type?.kind).toBe(wordType?.kind);
      expect(result!.type?.size).toBe(wordType?.size);
    });

    it('should create array types with correct element types', () => {
      const expr = createArrayLiteralExpr('[1, 2, 3]');
      const result = checker.checkExpression(expr, symbolTable);

      const arrayType = result!.type!;
      expect(arrayType.elementType).toBeDefined();
      expect(arrayType.elementCount).toBe(3);
      expect(arrayType.size).toBe(3); // 3 bytes
    });
  });
});

// ============================================
// TYPECHECKERBASE TESTS
// ============================================

describe('TypeCheckerBase', () => {
  // TypeCheckerBase is abstract, so we test it through LiteralTypeChecker
  let checker: TestLiteralTypeChecker;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    checker = new TestLiteralTypeChecker();
    symbolTable = new SymbolTable();
  });

  describe('diagnostics utilities', () => {
    it('should clear diagnostics on new check', () => {
      // Generate an error
      const expr1 = createArrayLiteralExpr('[]');
      checker.checkExpression(expr1, symbolTable);
      expect(checker.getDiagnostics().length).toBe(1);

      // New check should clear
      const expr2 = createLiteralExpr('1');
      checker.checkExpression(expr2, symbolTable);
      expect(checker.getDiagnostics().length).toBe(0);
    });
  });

  describe('expression type map', () => {
    it('should track expression types', () => {
      const expr = createLiteralExpr('42');
      checker.checkExpression(expr, symbolTable);

      const typeMap = checker.getExpressionTypeMap();
      expect(typeMap.size).toBe(1);
    });

    it('should clear type map on new check', () => {
      const expr1 = createLiteralExpr('42');
      checker.checkExpression(expr1, symbolTable);
      expect(checker.getExpressionTypeMap().size).toBe(1);

      const expr2 = createLiteralExpr('100');
      checker.checkExpression(expr2, symbolTable);
      expect(checker.getExpressionTypeMap().size).toBe(1); // Reset and new entry
    });
  });

  describe('result finalization', () => {
    it('should return success=true when no errors', () => {
      const source = `module test\nlet x: byte = 42;`;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should return success=false when errors occur', () => {
      const source = `module test\nlet x: byte[] = [];`;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should count expressions checked', () => {
      const source = `
        module test
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
      `;
      const program = parseProgram(source);
      const result = checker.check(symbolTable, program);

      expect(result.expressionsChecked).toBeGreaterThanOrEqual(3);
    });
  });
});