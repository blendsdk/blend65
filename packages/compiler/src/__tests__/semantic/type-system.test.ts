/**
 * Type System Tests
 *
 * Tests for the TypeSystem class including:
 * - Built-in type definitions
 * - Type creation (arrays, callbacks)
 * - Type compatibility checking
 * - Binary and unary operation types
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../semantic/type-system.js';
import { TypeKind, TypeCompatibility } from '../../semantic/types.js';

describe('TypeSystem', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  describe('Built-in Types', () => {
    test('provides byte type (8-bit unsigned)', () => {
      const byteType = typeSystem.getBuiltinType('byte');

      expect(byteType).toBeDefined();
      expect(byteType!.kind).toBe(TypeKind.Byte);
      expect(byteType!.name).toBe('byte');
      expect(byteType!.size).toBe(1);
      expect(byteType!.isSigned).toBe(false);
      expect(byteType!.isAssignable).toBe(true);
    });

    test('provides word type (16-bit unsigned)', () => {
      const wordType = typeSystem.getBuiltinType('word');

      expect(wordType).toBeDefined();
      expect(wordType!.kind).toBe(TypeKind.Word);
      expect(wordType!.name).toBe('word');
      expect(wordType!.size).toBe(2);
      expect(wordType!.isSigned).toBe(false);
      expect(wordType!.isAssignable).toBe(true);
    });

    test('provides boolean type', () => {
      const boolType = typeSystem.getBuiltinType('boolean');

      expect(boolType).toBeDefined();
      expect(boolType!.kind).toBe(TypeKind.Boolean);
      expect(boolType!.name).toBe('boolean');
      expect(boolType!.size).toBe(1);
      expect(boolType!.isAssignable).toBe(true);
    });

    test('provides void type', () => {
      const voidType = typeSystem.getBuiltinType('void');

      expect(voidType).toBeDefined();
      expect(voidType!.kind).toBe(TypeKind.Void);
      expect(voidType!.name).toBe('void');
      expect(voidType!.size).toBe(0);
      expect(voidType!.isAssignable).toBe(false);
    });

    test('provides string type', () => {
      const stringType = typeSystem.getBuiltinType('string');

      expect(stringType).toBeDefined();
      expect(stringType!.kind).toBe(TypeKind.String);
      expect(stringType!.name).toBe('string');
      expect(stringType!.isAssignable).toBe(false);
    });

    test('returns undefined for unknown type name', () => {
      const unknownType = typeSystem.getBuiltinType('unknown');
      expect(unknownType).toBeUndefined();
    });

    test('identifies built-in type names', () => {
      expect(typeSystem.isBuiltinType('byte')).toBe(true);
      expect(typeSystem.isBuiltinType('word')).toBe(true);
      expect(typeSystem.isBuiltinType('boolean')).toBe(true);
      expect(typeSystem.isBuiltinType('void')).toBe(true);
      expect(typeSystem.isBuiltinType('string')).toBe(true);
      expect(typeSystem.isBuiltinType('custom')).toBe(false);
    });
  });

  describe('Array Type Creation', () => {
    test('creates fixed-size array type', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const arrayType = typeSystem.createArrayType(byteType, 10);

      expect(arrayType.kind).toBe(TypeKind.Array);
      expect(arrayType.name).toBe('byte[10]');
      expect(arrayType.size).toBe(10); // 10 * 1 byte
      expect(arrayType.isAssignable).toBe(true);
      expect(arrayType.elementType).toBe(byteType);
      expect(arrayType.arraySize).toBe(10);
    });

    test('creates unsized array type', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const arrayType = typeSystem.createArrayType(wordType);

      expect(arrayType.kind).toBe(TypeKind.Array);
      expect(arrayType.name).toBe('word[]');
      expect(arrayType.size).toBe(0); // Unsized
      expect(arrayType.elementType).toBe(wordType);
      expect(arrayType.arraySize).toBeUndefined();
    });

    test('creates array of word type with correct size', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const arrayType = typeSystem.createArrayType(wordType, 5);

      expect(arrayType.size).toBe(10); // 5 * 2 bytes
    });
  });

  describe('Callback Type Creation', () => {
    test('creates callback type with parameters', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const callbackType = typeSystem.createCallbackType({
        parameters: [byteType, wordType],
        returnType: voidType,
        parameterNames: ['a', 'b'],
      });

      expect(callbackType.kind).toBe(TypeKind.Callback);
      expect(callbackType.name).toBe('(byte, word) => void');
      expect(callbackType.size).toBe(2); // Function pointer is 16-bit
      expect(callbackType.isAssignable).toBe(true);
      expect(callbackType.signature).toBeDefined();
      expect(callbackType.signature!.parameters).toHaveLength(2);
      expect(callbackType.signature!.returnType).toBe(voidType);
    });

    test('creates callback type with no parameters', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;

      const callbackType = typeSystem.createCallbackType({
        parameters: [],
        returnType: byteType,
      });

      expect(callbackType.name).toBe('() => byte');
      expect(callbackType.signature!.parameters).toHaveLength(0);
    });
  });

  describe('Type Compatibility - Identical Types', () => {
    test('same type is identical', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const compat = typeSystem.checkCompatibility(byteType, byteType);

      expect(compat).toBe(TypeCompatibility.Identical);
    });

    test('canAssign returns true for identical types', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.canAssign(wordType, wordType)).toBe(true);
    });
  });

  describe('Type Compatibility - Widening Conversions', () => {
    test('byte to word is compatible (widening)', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const compat = typeSystem.checkCompatibility(byteType, wordType);

      expect(compat).toBe(TypeCompatibility.Compatible);
      expect(typeSystem.canAssign(byteType, wordType)).toBe(true);
    });
  });

  describe('Type Compatibility - Narrowing Conversions', () => {
    test('word to byte requires explicit conversion', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const compat = typeSystem.checkCompatibility(wordType, byteType);

      expect(compat).toBe(TypeCompatibility.RequiresConversion);
      expect(typeSystem.canAssign(wordType, byteType)).toBe(false);
    });
  });

  describe('Type Compatibility - Boolean and Byte', () => {
    test('boolean to byte is compatible', () => {
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const byteType = typeSystem.getBuiltinType('byte')!;
      const compat = typeSystem.checkCompatibility(boolType, byteType);

      expect(compat).toBe(TypeCompatibility.Compatible);
      expect(typeSystem.canAssign(boolType, byteType)).toBe(true);
    });

    test('byte to boolean is compatible', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const compat = typeSystem.checkCompatibility(byteType, boolType);

      expect(compat).toBe(TypeCompatibility.Compatible);
      expect(typeSystem.canAssign(byteType, boolType)).toBe(true);
    });
  });

  describe('Type Compatibility - Incompatible Types', () => {
    test('void is incompatible with byte', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const byteType = typeSystem.getBuiltinType('byte')!;
      const compat = typeSystem.checkCompatibility(voidType, byteType);

      expect(compat).toBe(TypeCompatibility.Incompatible);
      expect(typeSystem.canAssign(voidType, byteType)).toBe(false);
    });

    test('string is incompatible with byte', () => {
      const stringType = typeSystem.getBuiltinType('string')!;
      const byteType = typeSystem.getBuiltinType('byte')!;
      const compat = typeSystem.checkCompatibility(stringType, byteType);

      expect(compat).toBe(TypeCompatibility.Incompatible);
    });
  });

  describe('Type Compatibility - Arrays', () => {
    test('arrays with same element type and size are identical', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const array1 = typeSystem.createArrayType(byteType, 10);
      const array2 = typeSystem.createArrayType(byteType, 10);

      const compat = typeSystem.checkCompatibility(array1, array2);
      expect(compat).toBe(TypeCompatibility.Identical);
    });

    test('arrays with different sizes are incompatible', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const array1 = typeSystem.createArrayType(byteType, 10);
      const array2 = typeSystem.createArrayType(byteType, 5);

      const compat = typeSystem.checkCompatibility(array1, array2);
      expect(compat).toBe(TypeCompatibility.Incompatible);
    });

    test('sized array can assign to unsized array', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const sizedArray = typeSystem.createArrayType(byteType, 10);
      const unsizedArray = typeSystem.createArrayType(byteType);

      const compat = typeSystem.checkCompatibility(sizedArray, unsizedArray);
      expect(compat).toBe(TypeCompatibility.Compatible);
    });

    test('arrays with different element types are incompatible', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const byteArray = typeSystem.createArrayType(byteType, 10);
      const wordArray = typeSystem.createArrayType(wordType, 10);

      const compat = typeSystem.checkCompatibility(byteArray, wordArray);
      expect(compat).toBe(TypeCompatibility.Incompatible);
    });
  });

  describe('Type Compatibility - Callbacks', () => {
    test('callbacks with same signature are identical', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const callback1 = typeSystem.createCallbackType({
        parameters: [byteType],
        returnType: voidType,
      });

      const callback2 = typeSystem.createCallbackType({
        parameters: [byteType],
        returnType: voidType,
      });

      const compat = typeSystem.checkCompatibility(callback1, callback2);
      expect(compat).toBe(TypeCompatibility.Identical);
    });

    test('callbacks with different parameter counts are incompatible', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const callback1 = typeSystem.createCallbackType({
        parameters: [byteType],
        returnType: voidType,
      });

      const callback2 = typeSystem.createCallbackType({
        parameters: [byteType, byteType],
        returnType: voidType,
      });

      const compat = typeSystem.checkCompatibility(callback1, callback2);
      expect(compat).toBe(TypeCompatibility.Incompatible);
    });

    test('callbacks with different return types are incompatible', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const callback1 = typeSystem.createCallbackType({
        parameters: [byteType],
        returnType: voidType,
      });

      const callback2 = typeSystem.createCallbackType({
        parameters: [byteType],
        returnType: wordType,
      });

      const compat = typeSystem.checkCompatibility(callback1, callback2);
      expect(compat).toBe(TypeCompatibility.Incompatible);
    });
  });

  describe('Binary Operation Types - Arithmetic', () => {
    test('byte + byte = byte', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byteType, byteType, '+');

      expect(result.kind).toBe(TypeKind.Byte);
    });

    test('word + word = word', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(wordType, wordType, '+');

      expect(result.kind).toBe(TypeKind.Word);
    });

    test('byte + word = word (promotion)', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(byteType, wordType, '+');

      expect(result.kind).toBe(TypeKind.Word);
    });

    test('all arithmetic operators return numeric types', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const operators = ['+', '-', '*', '/', '%'];

      operators.forEach(op => {
        const result = typeSystem.getBinaryOperationType(byteType, byteType, op);
        expect(result.kind).toBe(TypeKind.Byte);
      });
    });
  });

  describe('Binary Operation Types - Comparison', () => {
    test('comparison operators return boolean', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const operators = ['==', '!=', '<', '>', '<=', '>='];

      operators.forEach(op => {
        const result = typeSystem.getBinaryOperationType(byteType, byteType, op);
        expect(result.kind).toBe(TypeKind.Boolean);
      });
    });
  });

  describe('Binary Operation Types - Logical', () => {
    test('logical operators return boolean', () => {
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const operators = ['&&', '||'];

      operators.forEach(op => {
        const result = typeSystem.getBinaryOperationType(boolType, boolType, op);
        expect(result.kind).toBe(TypeKind.Boolean);
      });
    });
  });

  describe('Binary Operation Types - Bitwise', () => {
    test('byte & byte = byte', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getBinaryOperationType(byteType, byteType, '&');

      expect(result.kind).toBe(TypeKind.Byte);
    });

    test('word & word = word', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(wordType, wordType, '&');

      expect(result.kind).toBe(TypeKind.Word);
    });

    test('byte & word = word (promotion)', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getBinaryOperationType(byteType, wordType, '&');

      expect(result.kind).toBe(TypeKind.Word);
    });

    test('all bitwise operators follow promotion rules', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const operators = ['&', '|', '^', '<<', '>>'];

      operators.forEach(op => {
        const result = typeSystem.getBinaryOperationType(byteType, wordType, op);
        expect(result.kind).toBe(TypeKind.Word);
      });
    });
  });

  describe('Unary Operation Types', () => {
    test('logical NOT returns boolean', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getUnaryOperationType(byteType, '!');

      expect(result.kind).toBe(TypeKind.Boolean);
    });

    test('bitwise NOT preserves type', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getUnaryOperationType(byteType, '~');

      expect(result.kind).toBe(TypeKind.Byte);
    });

    test('negation preserves type', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = typeSystem.getUnaryOperationType(wordType, '-');

      expect(result.kind).toBe(TypeKind.Word);
    });

    test('address-of returns word (16-bit address)', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getUnaryOperationType(byteType, '@');

      expect(result.kind).toBe(TypeKind.Word);
      expect(result.size).toBe(2);
    });

    test('unknown operator returns unknown type', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = typeSystem.getUnaryOperationType(byteType, '??');

      expect(result.kind).toBe(TypeKind.Unknown);
    });
  });

  describe('Compatibility Caching', () => {
    test('caches compatibility results', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;

      // First call
      const result1 = typeSystem.checkCompatibility(byteType, wordType);

      // Second call should use cache
      const result2 = typeSystem.checkCompatibility(byteType, wordType);

      expect(result1).toBe(result2);
      expect(result1).toBe(TypeCompatibility.Compatible);
    });

    test('clearCache clears the cache', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;

      typeSystem.checkCompatibility(byteType, wordType);
      typeSystem.clearCache();

      // Should still work after cache clear
      const result = typeSystem.checkCompatibility(byteType, wordType);
      expect(result).toBe(TypeCompatibility.Compatible);
    });
  });
});
