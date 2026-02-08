/**
 * Type Resolver Tests for Blend65 Compiler v2
 *
 * Tests Pass 2 of semantic analysis: resolving type annotations
 * to TypeInfo objects.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeResolver, TypeResolutionResult } from '../../../semantic/visitors/type-resolver.js';
import { SymbolTableBuilder } from '../../../semantic/visitors/symbol-table-builder.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import type { Program } from '../../../ast/index.js';
import { TypeKind } from '../../../semantic/types.js';
import { SymbolKind } from '../../../semantic/symbol.js';

/**
 * Helper: parses Blend65 code and returns the Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper: runs Pass 1 (SymbolTableBuilder) and Pass 2 (TypeResolver)
 */
function resolveTypes(source: string): {
  result: TypeResolutionResult;
  resolver: TypeResolver;
  symbolTable: ReturnType<SymbolTableBuilder['getSymbolTable']>;
} {
  const program = parse(source);

  // Pass 1: Build symbol table
  const builder = new SymbolTableBuilder();
  const buildResult = builder.build(program);
  expect(buildResult.success).toBe(true);

  // Pass 2: Resolve types
  const resolver = new TypeResolver();
  const result = resolver.resolve(buildResult.symbolTable, program);

  return {
    result,
    resolver,
    symbolTable: buildResult.symbolTable,
  };
}

describe('TypeResolver', () => {
  // ===========================================
  // BASIC SETUP AND CONSTRUCTION
  // ===========================================

  describe('construction', () => {
    it('should create a TypeResolver with default TypeSystem', () => {
      const resolver = new TypeResolver();
      expect(resolver).toBeDefined();
      expect(resolver.getTypeSystem()).toBeInstanceOf(TypeSystem);
    });

    it('should create a TypeResolver with custom TypeSystem', () => {
      const typeSystem = new TypeSystem();
      const resolver = new TypeResolver(typeSystem);
      expect(resolver.getTypeSystem()).toBe(typeSystem);
    });
  });

  // ===========================================
  // BUILT-IN TYPE RESOLUTION
  // ===========================================

  describe('built-in type resolution', () => {
    it('should resolve byte type for variable', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let x: byte = 0
      `);

      expect(result.success).toBe(true);
      expect(result.resolvedCount).toBeGreaterThan(0);

      const xSymbol = symbolTable.lookup('x');
      expect(xSymbol).toBeDefined();
      expect(xSymbol!.type).toBeDefined();
      expect(xSymbol!.type!.kind).toBe(TypeKind.Byte);
      expect(xSymbol!.type!.name).toBe('byte');
    });

    it('should resolve word type for variable', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let addr: word = 0
      `);

      expect(result.success).toBe(true);

      const addrSymbol = symbolTable.lookup('addr');
      expect(addrSymbol).toBeDefined();
      expect(addrSymbol!.type).toBeDefined();
      expect(addrSymbol!.type!.kind).toBe(TypeKind.Word);
      expect(addrSymbol!.type!.name).toBe('word');
    });

    it('should resolve bool type for variable', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let flag: bool = true
      `);

      expect(result.success).toBe(true);

      const flagSymbol = symbolTable.lookup('flag');
      expect(flagSymbol).toBeDefined();
      expect(flagSymbol!.type).toBeDefined();
      expect(flagSymbol!.type!.kind).toBe(TypeKind.Bool);
    });

    it('should resolve multiple variables with different types', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let a: byte = 0
        let b: word = 0
        let c: bool = false
      `);

      expect(result.success).toBe(true);
      expect(result.resolvedCount).toBeGreaterThanOrEqual(3);

      expect(symbolTable.lookup('a')!.type!.kind).toBe(TypeKind.Byte);
      expect(symbolTable.lookup('b')!.type!.kind).toBe(TypeKind.Word);
      expect(symbolTable.lookup('c')!.type!.kind).toBe(TypeKind.Bool);
    });
  });

  // ===========================================
  // CONSTANT TYPE RESOLUTION
  // ===========================================

  describe('constant type resolution', () => {
    it('should resolve byte type for constant', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        const MAX: byte = 255
      `);

      expect(result.success).toBe(true);

      const maxSymbol = symbolTable.lookup('MAX');
      expect(maxSymbol).toBeDefined();
      expect(maxSymbol!.type).toBeDefined();
      expect(maxSymbol!.type!.kind).toBe(TypeKind.Byte);
      expect(maxSymbol!.isConst).toBe(true);
    });

    it('should resolve word type for constant', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        const SCREEN: word = $0400
      `);

      expect(result.success).toBe(true);

      const screenSymbol = symbolTable.lookup('SCREEN');
      expect(screenSymbol).toBeDefined();
      expect(screenSymbol!.type!.kind).toBe(TypeKind.Word);
    });
  });

  // ===========================================
  // ARRAY TYPE RESOLUTION
  // ===========================================

  describe('array type resolution', () => {
    it('should resolve fixed-size byte array', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let buffer: byte[10] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      `);

      expect(result.success).toBe(true);

      const bufferSymbol = symbolTable.lookup('buffer');
      expect(bufferSymbol).toBeDefined();
      expect(bufferSymbol!.type).toBeDefined();
      expect(bufferSymbol!.type!.kind).toBe(TypeKind.Array);
      expect(bufferSymbol!.type!.elementType).toBeDefined();
      expect(bufferSymbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
      expect(bufferSymbol!.type!.elementCount).toBe(10);
    });

    it('should resolve fixed-size word array', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let addresses: word[5] = [0, 0, 0, 0, 0]
      `);

      expect(result.success).toBe(true);

      const addrSymbol = symbolTable.lookup('addresses');
      expect(addrSymbol).toBeDefined();
      expect(addrSymbol!.type!.kind).toBe(TypeKind.Array);
      expect(addrSymbol!.type!.elementType!.kind).toBe(TypeKind.Word);
      expect(addrSymbol!.type!.elementCount).toBe(5);
    });

    it('should resolve unsized array type', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let data: byte[] = [1, 2, 3]
      `);

      expect(result.success).toBe(true);

      const dataSymbol = symbolTable.lookup('data');
      expect(dataSymbol).toBeDefined();
      expect(dataSymbol!.type!.kind).toBe(TypeKind.Array);
      expect(dataSymbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
      expect(dataSymbol!.type!.elementCount).toBeUndefined();
    });

    it('should calculate correct array size', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let buffer: byte[10] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      `);

      expect(result.success).toBe(true);

      const bufferSymbol = symbolTable.lookup('buffer');
      // byte[10] = 10 bytes
      expect(bufferSymbol!.type!.size).toBe(10);
    });

    it('should calculate word array size correctly', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        let addresses: word[5] = [0, 0, 0, 0, 0]
      `);

      expect(result.success).toBe(true);

      const addrSymbol = symbolTable.lookup('addresses');
      // word[5] = 5 * 2 = 10 bytes
      expect(addrSymbol!.type!.size).toBe(10);
    });
  });

  // ===========================================
  // FUNCTION TYPE RESOLUTION
  // ===========================================

  describe('function type resolution', () => {
    it('should resolve function with void return type', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function main(): void {
        }
      `);

      expect(result.success).toBe(true);

      const mainSymbol = symbolTable.lookup('main');
      expect(mainSymbol).toBeDefined();
      expect(mainSymbol!.type).toBeDefined();
      expect(mainSymbol!.type!.kind).toBe(TypeKind.Function);
      expect(mainSymbol!.type!.returnType).toBeDefined();
      expect(mainSymbol!.type!.returnType!.kind).toBe(TypeKind.Void);
      expect(mainSymbol!.type!.parameterTypes).toEqual([]);
    });

    it('should resolve function with byte return type', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function getValue(): byte {
          return 42
        }
      `);

      expect(result.success).toBe(true);

      const funcSymbol = symbolTable.lookup('getValue');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.type!.kind).toBe(TypeKind.Function);
      expect(funcSymbol!.type!.returnType!.kind).toBe(TypeKind.Byte);
    });

    it('should resolve function with word return type', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function getAddress(): word {
          return $0400
        }
      `);

      expect(result.success).toBe(true);

      const funcSymbol = symbolTable.lookup('getAddress');
      expect(funcSymbol!.type!.returnType!.kind).toBe(TypeKind.Word);
    });

    it('should resolve function with parameters', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function add(a: byte, b: byte): byte {
          return a + b
        }
      `);

      expect(result.success).toBe(true);

      const funcSymbol = symbolTable.lookup('add');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.type!.kind).toBe(TypeKind.Function);
      expect(funcSymbol!.type!.parameterTypes).toHaveLength(2);
      expect(funcSymbol!.type!.parameterTypes![0].kind).toBe(TypeKind.Byte);
      expect(funcSymbol!.type!.parameterTypes![1].kind).toBe(TypeKind.Byte);
      expect(funcSymbol!.type!.returnType!.kind).toBe(TypeKind.Byte);
    });

    it('should resolve function with mixed parameter types', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function process(value: byte, addr: word): bool {
          return true
        }
      `);

      expect(result.success).toBe(true);

      const funcSymbol = symbolTable.lookup('process');
      expect(funcSymbol!.type!.parameterTypes![0].kind).toBe(TypeKind.Byte);
      expect(funcSymbol!.type!.parameterTypes![1].kind).toBe(TypeKind.Word);
      expect(funcSymbol!.type!.returnType!.kind).toBe(TypeKind.Bool);
    });

    it('should resolve parameter symbols with types', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function add(a: byte, b: byte): byte {
          return a + b
        }
      `);

      expect(result.success).toBe(true);

      const funcSymbol = symbolTable.lookup('add');
      expect(funcSymbol!.parameters).toHaveLength(2);

      // Parameter symbols should have their types resolved
      expect(funcSymbol!.parameters![0].type).toBeDefined();
      expect(funcSymbol!.parameters![0].type!.kind).toBe(TypeKind.Byte);
      expect(funcSymbol!.parameters![1].type).toBeDefined();
      expect(funcSymbol!.parameters![1].type!.kind).toBe(TypeKind.Byte);
    });
  });

  // ===========================================
  // FUNCTION WITH LOCAL VARIABLES
  // ===========================================

  describe('function with local variables', () => {
    it('should resolve local variable types', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function compute(): byte {
          let temp: byte = 0
          return temp
        }
      `);

      expect(result.success).toBe(true);

      // The function should be resolved
      const funcSymbol = symbolTable.lookup('compute');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.type!.kind).toBe(TypeKind.Function);
    });
  });

  // ===========================================
  // UNKNOWN TYPE ERRORS
  // ===========================================

  describe('unknown type errors', () => {
    it('should report error for unknown type', () => {
      const { result } = resolveTypes(`
        module Test
        let x: unknown_type = 0
      `);

      expect(result.success).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain('Unknown type');
      expect(result.diagnostics[0].message).toContain('unknown_type');
    });

    it('should report error for unknown array element type', () => {
      const { result } = resolveTypes(`
        module Test
        let arr: invalid[10] = [0]
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('Unknown type'))).toBe(true);
    });

    it('should report error for unknown parameter type', () => {
      const { result } = resolveTypes(`
        module Test
        function foo(x: invalid): void {
        }
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('Unknown type'))).toBe(true);
    });

    it('should report error for unknown return type', () => {
      const { result } = resolveTypes(`
        module Test
        function foo(): invalid {
          return 0
        }
      `);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('Unknown type'))).toBe(true);
    });
  });

  // ===========================================
  // RESOLUTION STATISTICS
  // ===========================================

  describe('resolution statistics', () => {
    it('should track resolved count', () => {
      const { result } = resolveTypes(`
        module Test
        let a: byte = 0
        let b: word = 0
        function foo(): void {
        }
      `);

      expect(result.success).toBe(true);
      expect(result.resolvedCount).toBeGreaterThanOrEqual(3);
    });

    it('should track failed count on errors', () => {
      const { result } = resolveTypes(`
        module Test
        let x: invalid = 0
        let y: also_invalid = 0
      `);

      expect(result.success).toBe(false);
      expect(result.failedCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================
  // COMPLEX PROGRAMS
  // ===========================================

  describe('complex programs', () => {
    it('should resolve types in a program with multiple functions and variables', () => {
      const { result, symbolTable } = resolveTypes(`
        module Game
        
        let score: word = 0
        let lives: byte = 3
        let gameOver: bool = false
        
        function addScore(points: byte): void {
          score = score + points
        }
        
        function isGameOver(): bool {
          return gameOver
        }
      `);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // Check module-level variables
      expect(symbolTable.lookup('score')!.type!.kind).toBe(TypeKind.Word);
      expect(symbolTable.lookup('lives')!.type!.kind).toBe(TypeKind.Byte);
      expect(symbolTable.lookup('gameOver')!.type!.kind).toBe(TypeKind.Bool);

      // Check functions
      const addScore = symbolTable.lookup('addScore');
      expect(addScore!.type!.kind).toBe(TypeKind.Function);
      expect(addScore!.type!.returnType!.kind).toBe(TypeKind.Void);

      const isGameOver = symbolTable.lookup('isGameOver');
      expect(isGameOver!.type!.kind).toBe(TypeKind.Function);
      expect(isGameOver!.type!.returnType!.kind).toBe(TypeKind.Bool);
    });

    it('should resolve types with arrays', () => {
      const { result, symbolTable } = resolveTypes(`
        module SpriteDemo
        
        let spriteX: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0]
        let spriteY: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0]
        
        function moveSprite(index: byte, x: byte, y: byte): void {
          spriteX[index] = x
          spriteY[index] = y
        }
      `);

      expect(result.success).toBe(true);

      const spriteX = symbolTable.lookup('spriteX');
      expect(spriteX!.type!.kind).toBe(TypeKind.Array);
      expect(spriteX!.type!.elementType!.kind).toBe(TypeKind.Byte);
      expect(spriteX!.type!.elementCount).toBe(8);
    });
  });

  // ===========================================
  // EDGE CASES
  // ===========================================

  describe('edge cases', () => {
    it('should handle empty module', () => {
      const { result } = resolveTypes(`
        module Empty
      `);

      expect(result.success).toBe(true);
      expect(result.resolvedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('should handle module with only function stubs', () => {
      const { result, symbolTable } = resolveTypes(`
        module Stubs
        function stub1(): void;
        function stub2(x: byte): byte;
      `);

      expect(result.success).toBe(true);

      const stub1 = symbolTable.lookup('stub1');
      expect(stub1!.type!.kind).toBe(TypeKind.Function);

      const stub2 = symbolTable.lookup('stub2');
      expect(stub2!.type!.kind).toBe(TypeKind.Function);
      expect(stub2!.type!.parameterTypes).toHaveLength(1);
    });

    it('should handle function without explicit return type (defaults to void)', () => {
      const { result, symbolTable } = resolveTypes(`
        module Test
        function noReturn(): void {
        }
      `);

      expect(result.success).toBe(true);

      const func = symbolTable.lookup('noReturn');
      expect(func!.type!.returnType!.kind).toBe(TypeKind.Void);
    });
  });

  // ===========================================
  // TYPE SYSTEM INTEGRATION
  // ===========================================

  describe('type system integration', () => {
    it('should use shared TypeSystem instance', () => {
      const typeSystem = new TypeSystem();
      const resolver = new TypeResolver(typeSystem);

      const program = parse(`
        module Test
        let x: byte = 0
      `);

      const builder = new SymbolTableBuilder();
      const buildResult = builder.build(program);

      const result = resolver.resolve(buildResult.symbolTable, program);

      expect(result.success).toBe(true);
      expect(resolver.getTypeSystem()).toBe(typeSystem);
    });

    it('should resolve types consistently across multiple resolutions', () => {
      const source1 = `
        module Test1
        let x: byte = 0
      `;

      const source2 = `
        module Test2
        let y: byte = 0
      `;

      const resolver = new TypeResolver();

      const { symbolTable: st1 } = resolveTypes(source1);
      const { symbolTable: st2 } = resolveTypes(source2);

      // Both should resolve to the same built-in byte type kind
      expect(st1.lookup('x')!.type!.kind).toBe(TypeKind.Byte);
      expect(st2.lookup('y')!.type!.kind).toBe(TypeKind.Byte);
    });
  });
});