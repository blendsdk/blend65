/**
 * Type System Tests - Type Predicates and Utilities
 *
 * Tests for type predicates (isNumericType, isArrayType, etc.)
 * and type utility methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind } from '../../../semantic/types.js';

describe('TypeSystem - Type Predicates and Utilities', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  // ==========================================================================
  // isNumericType
  // ==========================================================================

  describe('isNumericType', () => {
    it('should return true for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isNumericType(byte)).toBe(true);
    });

    it('should return true for word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.isNumericType(word)).toBe(true);
    });

    it('should return false for bool', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      expect(typeSystem.isNumericType(bool)).toBe(false);
    });

    it('should return false for void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.isNumericType(voidType)).toBe(false);
    });

    it('should return false for string', () => {
      const str = typeSystem.getBuiltinType('string')!;
      expect(typeSystem.isNumericType(str)).toBe(false);
    });

    it('should return false for array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      expect(typeSystem.isNumericType(array)).toBe(false);
    });

    it('should return false for function', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([], voidType);
      expect(typeSystem.isNumericType(func)).toBe(false);
    });
  });

  // ==========================================================================
  // isIntegerType
  // ==========================================================================

  describe('isIntegerType', () => {
    it('should return true for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isIntegerType(byte)).toBe(true);
    });

    it('should return true for word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.isIntegerType(word)).toBe(true);
    });

    it('should return true for bool', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      expect(typeSystem.isIntegerType(bool)).toBe(true);
    });

    it('should return false for void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.isIntegerType(voidType)).toBe(false);
    });

    it('should return false for string', () => {
      const str = typeSystem.getBuiltinType('string')!;
      expect(typeSystem.isIntegerType(str)).toBe(false);
    });
  });

  // ==========================================================================
  // isArrayType
  // ==========================================================================

  describe('isArrayType', () => {
    it('should return true for array type', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      expect(typeSystem.isArrayType(array)).toBe(true);
    });

    it('should return true for unsized array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte);
      expect(typeSystem.isArrayType(array)).toBe(true);
    });

    it('should return false for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isArrayType(byte)).toBe(false);
    });

    it('should return false for word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.isArrayType(word)).toBe(false);
    });

    it('should return false for function', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([], voidType);
      expect(typeSystem.isArrayType(func)).toBe(false);
    });
  });

  // ==========================================================================
  // isFunctionType
  // ==========================================================================

  describe('isFunctionType', () => {
    it('should return true for function type', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([], voidType);
      expect(typeSystem.isFunctionType(func)).toBe(true);
    });

    it('should return true for function with parameters', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const func = typeSystem.createFunctionType([byte, byte], byte);
      expect(typeSystem.isFunctionType(func)).toBe(true);
    });

    it('should return false for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isFunctionType(byte)).toBe(false);
    });

    it('should return false for array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      expect(typeSystem.isFunctionType(array)).toBe(false);
    });
  });

  // ==========================================================================
  // isVoidType
  // ==========================================================================

  describe('isVoidType', () => {
    it('should return true for void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.isVoidType(voidType)).toBe(true);
    });

    it('should return false for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isVoidType(byte)).toBe(false);
    });

    it('should return false for word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.isVoidType(word)).toBe(false);
    });
  });

  // ==========================================================================
  // isUnknownType
  // ==========================================================================

  describe('isUnknownType', () => {
    it('should return true for unknown type', () => {
      const unknownType = { kind: TypeKind.Unknown, name: 'unknown', size: 0 };
      expect(typeSystem.isUnknownType(unknownType)).toBe(true);
    });

    it('should return false for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.isUnknownType(byte)).toBe(false);
    });

    it('should return false for void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.isUnknownType(voidType)).toBe(false);
    });
  });

  // ==========================================================================
  // Array Utility Methods
  // ==========================================================================

  describe('getArrayElementType', () => {
    it('should return element type for array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);

      const elementType = typeSystem.getArrayElementType(array);
      expect(elementType).toBe(byte);
    });

    it('should return undefined for non-array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getArrayElementType(byte)).toBeUndefined();
    });
  });

  describe('getArraySize', () => {
    it('should return size for fixed array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);

      expect(typeSystem.getArraySize(array)).toBe(10);
    });

    it('should return undefined for unsized array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte);

      expect(typeSystem.getArraySize(array)).toBeUndefined();
    });

    it('should return undefined for non-array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getArraySize(byte)).toBeUndefined();
    });
  });

  // ==========================================================================
  // Function Utility Methods
  // ==========================================================================

  describe('getFunctionReturnType', () => {
    it('should return return type for function', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const func = typeSystem.createFunctionType([], byte);

      expect(typeSystem.getFunctionReturnType(func)).toBe(byte);
    });

    it('should return undefined for non-function', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getFunctionReturnType(byte)).toBeUndefined();
    });
  });

  describe('getFunctionParameterTypes', () => {
    it('should return parameter types for function', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([byte, word], voidType);

      const params = typeSystem.getFunctionParameterTypes(func);
      expect(params).toHaveLength(2);
      expect(params![0]).toBe(byte);
      expect(params![1]).toBe(word);
    });

    it('should return empty array for no-param function', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([], voidType);

      const params = typeSystem.getFunctionParameterTypes(func);
      expect(params).toHaveLength(0);
    });

    it('should return undefined for non-function', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getFunctionParameterTypes(byte)).toBeUndefined();
    });
  });

  // ==========================================================================
  // General Utility Methods
  // ==========================================================================

  describe('getTypeDescription', () => {
    it('should return name for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getTypeDescription(byte)).toBe('byte');
    });

    it('should return name for array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      expect(typeSystem.getTypeDescription(array)).toBe('byte[10]');
    });

    it('should return name for function', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([byte], voidType);
      expect(typeSystem.getTypeDescription(func)).toBe('(byte) => void');
    });
  });

  describe('getTypeSize', () => {
    it('should return 1 for byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.getTypeSize(byte)).toBe(1);
    });

    it('should return 2 for word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.getTypeSize(word)).toBe(2);
    });

    it('should return 0 for void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.getTypeSize(voidType)).toBe(0);
    });

    it('should return total size for array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      expect(typeSystem.getTypeSize(array)).toBe(10);
    });

    it('should return 2 for function (pointer)', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const func = typeSystem.createFunctionType([], voidType);
      expect(typeSystem.getTypeSize(func)).toBe(2);
    });
  });
});