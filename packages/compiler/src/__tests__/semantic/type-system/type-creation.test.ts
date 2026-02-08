/**
 * Type System Tests - Type Creation
 *
 * Tests for array, function, and enum type creation methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';

describe('TypeSystem - Type Creation', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  // ==========================================================================
  // Array Type Creation
  // ==========================================================================

  describe('createArrayType', () => {
    describe('fixed-size arrays', () => {
      it('should create byte[10] array type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.kind).toBe(TypeKind.Array);
        expect(arrayType.name).toBe('byte[10]');
      });

      it('should have correct element type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.elementType).toBe(byteType);
      });

      it('should have correct element count', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.elementCount).toBe(10);
      });

      it('should calculate correct total size for byte array', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.size).toBe(10); // 10 * 1 byte
      });

      it('should calculate correct total size for word array', () => {
        const wordType = typeSystem.getBuiltinType('word')!;
        const arrayType = typeSystem.createArrayType(wordType, 5);

        expect(arrayType.size).toBe(10); // 5 * 2 bytes
      });

      it('should be assignable', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.isAssignable).toBe(true);
      });

      it('should be unsigned', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        expect(arrayType.isSigned).toBe(false);
      });
    });

    describe('unsized arrays', () => {
      it('should create byte[] unsized array type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType);

        expect(arrayType.kind).toBe(TypeKind.Array);
        expect(arrayType.name).toBe('byte[]');
      });

      it('should have undefined element count', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType);

        expect(arrayType.elementCount).toBeUndefined();
      });

      it('should have zero size for unsized array', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType);

        expect(arrayType.size).toBe(0);
      });
    });

    describe('nested arrays', () => {
      it('should create byte[5][10] nested array type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const innerArray = typeSystem.createArrayType(byteType, 5);
        const outerArray = typeSystem.createArrayType(innerArray, 10);

        expect(outerArray.kind).toBe(TypeKind.Array);
        expect(outerArray.name).toBe('byte[5][10]');
      });

      it('should have nested element type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const innerArray = typeSystem.createArrayType(byteType, 5);
        const outerArray = typeSystem.createArrayType(innerArray, 10);

        expect(outerArray.elementType).toBe(innerArray);
        expect(outerArray.elementType!.elementType).toBe(byteType);
      });

      it('should calculate correct size for nested array', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const innerArray = typeSystem.createArrayType(byteType, 5);
        const outerArray = typeSystem.createArrayType(innerArray, 10);

        expect(outerArray.size).toBe(50); // 10 * 5 * 1 byte
      });
    });

    describe('edge cases', () => {
      it('should handle size of 0', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 0);

        expect(arrayType.name).toBe('byte[0]');
        expect(arrayType.size).toBe(0);
        expect(arrayType.elementCount).toBe(0);
      });

      it('should handle size of 1', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 1);

        expect(arrayType.name).toBe('byte[1]');
        expect(arrayType.size).toBe(1);
        expect(arrayType.elementCount).toBe(1);
      });

      it('should handle large size', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 65535);

        expect(arrayType.name).toBe('byte[65535]');
        expect(arrayType.size).toBe(65535);
      });
    });
  });

  // ==========================================================================
  // Function Type Creation
  // ==========================================================================

  describe('createFunctionType', () => {
    describe('basic function types', () => {
      it('should create () => void function type', () => {
        const voidType = typeSystem.getBuiltinType('void')!;
        const funcType = typeSystem.createFunctionType([], voidType);

        expect(funcType.kind).toBe(TypeKind.Function);
        expect(funcType.name).toBe('() => void');
      });

      it('should create (byte) => byte function type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const funcType = typeSystem.createFunctionType([byteType], byteType);

        expect(funcType.name).toBe('(byte) => byte');
      });

      it('should create (byte, word) => bool function type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const wordType = typeSystem.getBuiltinType('word')!;
        const boolType = typeSystem.getBuiltinType('bool')!;

        const funcType = typeSystem.createFunctionType(
          [byteType, wordType],
          boolType
        );

        expect(funcType.name).toBe('(byte, word) => bool');
      });
    });

    describe('function type properties', () => {
      it('should have correct parameter types', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const wordType = typeSystem.getBuiltinType('word')!;
        const voidType = typeSystem.getBuiltinType('void')!;

        const funcType = typeSystem.createFunctionType(
          [byteType, wordType],
          voidType
        );

        expect(funcType.parameterTypes).toHaveLength(2);
        expect(funcType.parameterTypes![0]).toBe(byteType);
        expect(funcType.parameterTypes![1]).toBe(wordType);
      });

      it('should have correct return type', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const funcType = typeSystem.createFunctionType([], byteType);

        expect(funcType.returnType).toBe(byteType);
      });

      it('should have size of 2 (function pointer)', () => {
        const voidType = typeSystem.getBuiltinType('void')!;
        const funcType = typeSystem.createFunctionType([], voidType);

        expect(funcType.size).toBe(2);
      });

      it('should be assignable', () => {
        const voidType = typeSystem.getBuiltinType('void')!;
        const funcType = typeSystem.createFunctionType([], voidType);

        expect(funcType.isAssignable).toBe(true);
      });

      it('should be unsigned', () => {
        const voidType = typeSystem.getBuiltinType('void')!;
        const funcType = typeSystem.createFunctionType([], voidType);

        expect(funcType.isSigned).toBe(false);
      });
    });

    describe('complex function types', () => {
      it('should create function type with array parameter', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const voidType = typeSystem.getBuiltinType('void')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        const funcType = typeSystem.createFunctionType([arrayType], voidType);

        expect(funcType.name).toBe('(byte[10]) => void');
        expect(funcType.parameterTypes![0]).toBe(arrayType);
      });

      it('should create function type with array return', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const arrayType = typeSystem.createArrayType(byteType, 10);

        const funcType = typeSystem.createFunctionType([], arrayType);

        expect(funcType.name).toBe('() => byte[10]');
        expect(funcType.returnType).toBe(arrayType);
      });

      it('should create function type with many parameters', () => {
        const byteType = typeSystem.getBuiltinType('byte')!;
        const wordType = typeSystem.getBuiltinType('word')!;
        const boolType = typeSystem.getBuiltinType('bool')!;
        const voidType = typeSystem.getBuiltinType('void')!;

        const funcType = typeSystem.createFunctionType(
          [byteType, wordType, boolType, byteType, wordType],
          voidType
        );

        expect(funcType.parameterTypes).toHaveLength(5);
        expect(funcType.name).toBe('(byte, word, bool, byte, word) => void');
      });
    });
  });

  // ==========================================================================
  // Enum Type Creation
  // ==========================================================================

  describe('createEnumType', () => {
    it('should create enum type with members', () => {
      const members = new Map([
        ['Red', 0],
        ['Green', 1],
        ['Blue', 2],
      ]);
      const enumType = typeSystem.createEnumType('Color', members);

      expect(enumType.kind).toBe(TypeKind.Enum);
      expect(enumType.name).toBe('Color');
    });

    it('should have correct enum members', () => {
      const members = new Map([
        ['Red', 0],
        ['Green', 1],
        ['Blue', 2],
      ]);
      const enumType = typeSystem.createEnumType('Color', members);

      expect(enumType.enumMembers).toBeDefined();
      expect(enumType.enumMembers!.get('Red')).toBe(0);
      expect(enumType.enumMembers!.get('Green')).toBe(1);
      expect(enumType.enumMembers!.get('Blue')).toBe(2);
    });

    it('should have size of 1 byte', () => {
      const members = new Map([['A', 0]]);
      const enumType = typeSystem.createEnumType('Letter', members);

      expect(enumType.size).toBe(1);
    });

    it('should be assignable', () => {
      const members = new Map([['A', 0]]);
      const enumType = typeSystem.createEnumType('Letter', members);

      expect(enumType.isAssignable).toBe(true);
    });

    it('should handle empty enum', () => {
      const members = new Map<string, number>();
      const enumType = typeSystem.createEnumType('Empty', members);

      expect(enumType.enumMembers!.size).toBe(0);
    });

    it('should handle non-sequential values', () => {
      const members = new Map([
        ['First', 1],
        ['Second', 10],
        ['Third', 100],
      ]);
      const enumType = typeSystem.createEnumType('Sparse', members);

      expect(enumType.enumMembers!.get('First')).toBe(1);
      expect(enumType.enumMembers!.get('Second')).toBe(10);
      expect(enumType.enumMembers!.get('Third')).toBe(100);
    });
  });
});