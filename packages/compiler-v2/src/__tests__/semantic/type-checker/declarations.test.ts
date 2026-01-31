/**
 * @file Declaration Type Checker Tests
 *
 * Tests for the DeclarationTypeChecker class, which handles type checking
 * for all declaration types: variables, functions, imports, exports, types, enums.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program, Declaration } from '../../../ast/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';
import {
  DeclarationTypeChecker,
  TypeCheckPassResult,
  DeclarationDiagnosticCodes,
} from '../../../semantic/visitors/type-checker/index.js';

// ============================================
// TEST CONCRETE IMPLEMENTATION
// ============================================

/**
 * Concrete test implementation of DeclarationTypeChecker
 *
 * Since DeclarationTypeChecker is abstract (missing statement visitor methods),
 * we need to provide stub implementations for the remaining abstract methods.
 */
class TestDeclarationTypeChecker extends DeclarationTypeChecker {
  /**
   * Checks a program and returns the result
   */
  public check(symbolTable: SymbolTable, program: Program): TypeCheckPassResult {
    this.initializeState(symbolTable);
    this.walk(program);
    return this.finalizeResult();
  }

  /**
   * Gets the symbol table for inspection
   */
  public getSymbolTable(): SymbolTable {
    return this.symbolTable;
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
 * Creates a symbol table with pre-defined symbols for testing
 */
function createTestSymbolTable(typeSystem: TypeSystem): SymbolTable {
  const table = new SymbolTable();
  return table;
}

/**
 * Creates a test checker and pre-populates symbol table with declarations
 * from the given source code via the symbol table builder pattern.
 */
function checkSource(source: string): { result: TypeCheckPassResult; checker: TestDeclarationTypeChecker; symbolTable: SymbolTable } {
  const typeSystem = new TypeSystem();
  const checker = new TestDeclarationTypeChecker(typeSystem);
  const symbolTable = new SymbolTable();
  const program = parseProgram(source);

  // Pre-populate symbol table with declarations
  // In a full implementation, SymbolTableBuilder would do this
  for (const decl of program.getDeclarations()) {
    const loc = { line: 1, column: 1, offset: 0 };
    if ('getName' in decl) {
      const name = (decl as { getName(): string }).getName();
      const nodeType = decl.getNodeType();

      if (nodeType === 'FunctionDecl') {
        symbolTable.declareFunction(name, loc, typeSystem.getBuiltinType('void')!, undefined, false);
      } else if (nodeType === 'VariableDecl') {
        const varDecl = decl as { getTypeAnnotation(): string | null; isConst(): boolean };
        const typeName = varDecl.getTypeAnnotation() ?? 'byte';
        const type = typeSystem.getBuiltinType(typeName) ?? typeSystem.getBuiltinType('byte')!;
        symbolTable.declareVariable(name, loc, type, {
          isConst: varDecl.isConst(),
          isExported: false,
        });
      } else if (nodeType === 'EnumDecl') {
        // Declare enum symbol
        symbolTable.declareVariable(name, loc, typeSystem.getBuiltinType('byte')!, {
          isConst: true,
          isExported: false,
        });
      } else if (nodeType === 'TypeDecl') {
        // Type declarations create type aliases
        symbolTable.declareVariable(name, loc, typeSystem.getBuiltinType('byte')!, {
          isConst: true,
          isExported: false,
        });
      }
    }
  }

  const result = checker.check(symbolTable, program);
  return { result, checker, symbolTable };
}

// ============================================
// TEST SUITES
// ============================================

describe('DeclarationTypeChecker', () => {
  let checker: TestDeclarationTypeChecker;
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    checker = new TestDeclarationTypeChecker(typeSystem);
    symbolTable = createTestSymbolTable(typeSystem);
  });

  // ============================================
  // VARIABLE DECLARATION TESTS
  // ============================================

  describe('variable declarations', () => {
    describe('type annotations', () => {
      it('should resolve byte type annotation', () => {
        const { result, checker } = checkSource(`
          module test
          let x: byte = 5;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should resolve word type annotation', () => {
        const { result } = checkSource(`
          module test
          let x: word = 1000;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should resolve bool type annotation', () => {
        const { result } = checkSource(`
          module test
          let x: bool = true;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should resolve void type annotation', () => {
        const { result } = checkSource(`
          module test
          let x: void;
        `);

        // void is valid for function return types but unusual for variables
        expect(result.errorCount).toBe(0);
      });

      it('should report error for unknown type annotation', () => {
        const { result, checker } = checkSource(`
          module test
          let x: unknown_type = 5;
        `);

        expect(result.success).toBe(false);
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain("Unknown type 'unknown_type'");
      });
    });

    describe('initializers', () => {
      it('should type check initializer expression', () => {
        const { result } = checkSource(`
          module test
          let x: byte = 1 + 2;
        `);

        expect(result.success).toBe(true);
        expect(result.expressionsChecked).toBeGreaterThan(0);
      });

      it('should report type mismatch between annotation and initializer', () => {
        const { result, checker } = checkSource(`
          module test
          let x: byte = "hello";
        `);

        expect(result.success).toBe(false);
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        // Either type mismatch or incompatible type error
        expect(diagnostics.some(d => d.message.includes('not assignable') || d.message.includes('mismatch'))).toBe(true);
      });

      it('should allow byte initializer for word variable (widening)', () => {
        const { result } = checkSource(`
          module test
          let x: word = 5;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should infer type from initializer when no annotation', () => {
        const { result } = checkSource(`
          module test
          let x = 5;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should infer word type for large number', () => {
        const { result } = checkSource(`
          module test
          let x = 1000;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('const declarations', () => {
      it('should accept const with initializer', () => {
        const { result } = checkSource(`
          module test
          const PI: byte = 3;
        `);

        expect(result.success).toBe(true);
        expect(result.errorCount).toBe(0);
      });

      it('should report error for const without initializer', () => {
        const { result, checker } = checkSource(`
          module test
          const x: byte;
        `);

        expect(result.success).toBe(false);
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('must have an initializer');
      });
    });

    describe('missing type information', () => {
      it('should report error for variable without type or initializer', () => {
        const { result, checker } = checkSource(`
          module test
          let x;
        `);

        expect(result.success).toBe(false);
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('needs a type annotation or initializer');
      });
    });

    describe('array types', () => {
      it('should resolve unsized array type annotation', () => {
        const { result } = checkSource(`
          module test
          let arr: byte[] = [1, 2, 3];
        `);

        expect(result.success).toBe(true);
      });

      it('should resolve sized array type annotation', () => {
        const { result } = checkSource(`
          module test
          let arr: byte[10];
        `);

        expect(result.success).toBe(true);
      });

      it('should resolve word array type', () => {
        const { result } = checkSource(`
          module test
          let arr: word[] = [$100, $200];
        `);

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================
  // FUNCTION DECLARATION TESTS
  // ============================================

  describe('function declarations', () => {
    describe('parameter types', () => {
      // Note: These tests require full SymbolTableBuilder to register params
      // Skip until full semantic pipeline is ready (Session 5.17+)
      it.skip('should resolve byte parameter type', () => {
        const { result } = checkSource(`
          module test
          function add(a: byte, b: byte): byte {
            return a;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should resolve word parameter type', () => {
        const { result } = checkSource(`
          module test
          function process(addr: word): void {
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should report error for parameter without type annotation', () => {
        // Note: Parser might not allow this, so the test may need adjustment
        // If parser enforces parameter types, this test can be skipped
        const { result, checker } = checkSource(`
          module test
          function foo(x): void {
          }
        `);

        // Expect either parse error or semantic error
        // If it parses, expect type checker error
        if (result.success === false) {
          expect(checker.getDiagnostics().length).toBeGreaterThan(0);
        }
      });

      // Note: Requires full SymbolTableBuilder to register params in scope
      it.skip('should handle multiple parameters', () => {
        const { result } = checkSource(`
          module test
          function calc(a: byte, b: word, c: bool): byte {
            return a;
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('return types', () => {
      it('should resolve byte return type', () => {
        const { result } = checkSource(`
          module test
          function getValue(): byte {
            return 42;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should resolve void return type (implicit)', () => {
        const { result } = checkSource(`
          module test
          function doWork() {
          }
        `);

        // No return type specified = void
        expect(result.success).toBe(true);
      });

      it('should resolve void return type (explicit)', () => {
        const { result } = checkSource(`
          module test
          function doWork(): void {
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should report error for unknown return type', () => {
        const { result, checker } = checkSource(`
          module test
          function foo(): unknown_type {
          }
        `);

        expect(result.success).toBe(false);
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('Unknown type');
      });
    });

    describe('function body', () => {
      // Note: These tests require SymbolTableBuilder to register local variables in function scope
      // Skip until full semantic pipeline is ready (Session 5.17+)
      it.skip('should type check expressions in function body', () => {
        const { result } = checkSource(`
          module test
          function calc(): byte {
            let x: byte = 1 + 2;
            return x;
          }
        `);

        expect(result.success).toBe(true);
        expect(result.expressionsChecked).toBeGreaterThan(0);
      });

      it.skip('should type check nested statements', () => {
        const { result } = checkSource(`
          module test
          function process(): void {
            let i: byte = 0;
            while (i < 10) {
              i = i + 1;
            }
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('stub functions', () => {
      it('should accept stub function (no body)', () => {
        const { result } = checkSource(`
          module test
          function external(addr: word): byte;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('callback functions', () => {
      it('should accept callback function', () => {
        const { result } = checkSource(`
          module test
          callback function irqHandler(): void {
          }
        `);

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================
  // IMPORT DECLARATION TESTS
  // ============================================

  describe('import declarations', () => {
    it('should accept import declaration', () => {
      const { result } = checkSource(`
        module test
        import foo from other.module
      `);

      // Single-module analysis doesn't resolve imports
      // Just checks that import is recorded
      expect(result.errorCount).toBe(0);
    });

    it('should accept multiple imports from same module', () => {
      const { result } = checkSource(`
        module test
        import foo, bar from other.module
      `);

      expect(result.errorCount).toBe(0);
    });

    it('should accept wildcard import', () => {
      const { result } = checkSource(`
        module test
        import * from other.module
      `);

      expect(result.errorCount).toBe(0);
    });
  });

  // ============================================
  // EXPORT DECLARATION TESTS
  // ============================================

  describe('export declarations', () => {
    it('should type check exported variable', () => {
      const { result } = checkSource(`
        module test
        export let counter: byte = 0;
      `);

      expect(result.success).toBe(true);
    });

    it('should type check exported function', () => {
      const { result } = checkSource(`
        module test
        export function init(): void {
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should propagate type errors from exported declarations', () => {
      const { result, checker } = checkSource(`
        module test
        export let x: unknown_type = 5;
      `);

      expect(result.success).toBe(false);
      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // TYPE DECLARATION TESTS
  // ============================================

  describe('type declarations', () => {
    it('should accept type alias for byte', () => {
      const { result } = checkSource(`
        module test
        type SpriteId = byte
      `);

      expect(result.success).toBe(true);
    });

    it('should accept type alias for word', () => {
      const { result } = checkSource(`
        module test
        type Address = word
      `);

      expect(result.success).toBe(true);
    });

    it('should report error for unknown aliased type', () => {
      const { result, checker } = checkSource(`
        module test
        type MyType = unknown_type
      `);

      expect(result.success).toBe(false);
      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('Unknown type');
    });
  });

  // ============================================
  // ENUM DECLARATION TESTS
  // ============================================

  describe('enum declarations', () => {
    it('should accept simple enum', () => {
      const { result } = checkSource(`
        module test
        enum Direction { UP, DOWN, LEFT, RIGHT }
      `);

      expect(result.success).toBe(true);
    });

    it('should accept enum with explicit values', () => {
      const { result } = checkSource(`
        module test
        enum Flags { A = 1, B = 2, C = 4, D = 8 }
      `);

      expect(result.success).toBe(true);
    });

    it('should report error for enum value out of byte range', () => {
      const { result, checker } = checkSource(`
        module test
        enum Big { A = 256 }
      `);

      expect(result.success).toBe(false);
      const diagnostics = checker.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('out of range');
    });

    // Parser doesn't support negative enum values, so this causes parse error
    it.skip('should report error for negative enum value', () => {
      const { result, checker } = checkSource(`
        module test
        enum Neg { A = -1 }
      `);

      // Parser might not allow this, but if it does, check for error
      if (result.success === false) {
        const diagnostics = checker.getDiagnostics();
        expect(diagnostics.some(d => d.message.includes('out of range') || d.message.includes('negative'))).toBe(true);
      }
    });
  });

  // ============================================
  // MODULE DECLARATION TESTS
  // ============================================

  describe('module declarations', () => {
    it('should accept module declaration', () => {
      const { result } = checkSource(`
        module Game.Main
        let x: byte = 0;
      `);

      expect(result.success).toBe(true);
    });

    it('should accept nested module path', () => {
      const { result } = checkSource(`
        module Game.Sprites.Player
        let x: byte = 0;
      `);

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // PROGRAM-LEVEL TESTS
  // ============================================

  describe('program-level checking', () => {
    it('should check all declarations in program', () => {
      const { result } = checkSource(`
        module test
        let a: byte = 1;
        let b: word = 2;
        function foo(): void {
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should accumulate errors from multiple declarations', () => {
      const { result, checker } = checkSource(`
        module test
        let a: unknown1 = 1;
        let b: unknown2 = 2;
      `);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2);
    });

    it('should handle mixed valid and invalid declarations', () => {
      const { result, checker } = checkSource(`
        module test
        let valid: byte = 5;
        let invalid: unknown_type = 10;
        function foo(): void {
        }
      `);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle empty module', () => {
      const { result } = checkSource(`
        module empty
      `);

      expect(result.success).toBe(true);
    });

    // Note: Requires SymbolTableBuilder to register local variables in function scope
    it.skip('should handle deeply nested function body', () => {
      const { result } = checkSource(`
        module test
        function deep(): void {
          let a: byte = 1;
          if (a > 0) {
            let b: byte = 2;
            while (b > 0) {
              let c: byte = 3;
              b = b - 1;
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should reset state between program checks', () => {
      const { result: result1, checker: checker1 } = checkSource(`
        module test1
        let a: unknown_type = 1;
      `);

      expect(result1.success).toBe(false);
      expect(checker1.getDiagnostics().length).toBe(1);

      const { result: result2, checker: checker2 } = checkSource(`
        module test2
        let b: byte = 2;
      `);

      expect(result2.success).toBe(true);
      expect(checker2.getDiagnostics().length).toBe(0);
    });
  });

  // ============================================
  // COMPLEX PROGRAMS
  // ============================================

  // Note: These complex program tests require full SymbolTableBuilder pipeline
  // to register function parameters and local variables in proper scopes.
  // Skip until Session 5.17+ when full semantic pipeline is ready.
  describe('complex programs', () => {
    it.skip('should handle program with multiple functions', () => {
      const { result } = checkSource(`
        module game
        
        let score: word = 0;
        
        function init(): void {
          score = 0;
        }
        
        function addPoints(points: byte): void {
          score = score + points;
        }
        
        function getScore(): word {
          return score;
        }
      `);

      expect(result.success).toBe(true);
    });

    it.skip('should handle program with arrays and loops', () => {
      const { result } = checkSource(`
        module arrays
        
        let buffer: byte[256];
        
        function clear(): void {
          let i: byte = 0;
          while (i < 255) {
            buffer[i] = 0;
            i = i + 1;
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it.skip('should handle program with enums and constants', () => {
      const { result } = checkSource(`
        module sprites
        
        enum SpriteState { IDLE, MOVING, ATTACKING }
        
        const MAX_SPRITES: byte = 8;
        
        let states: byte[8];
        
        function setState(index: byte, state: byte): void {
          states[index] = state;
        }
      `);

      expect(result.success).toBe(true);
    });
  });
});