/**
 * Type System Tests - Type Compatibility
 *
 * Tests for type compatibility checking methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSystem } from '../../../semantic/type-system.js';
import { TypeKind, TypeCompatibility, BUILTIN_TYPES } from '../../../semantic/types.js';

describe('TypeSystem - Type Compatibility', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    typeSystem.clearCache(); // Ensure fresh cache for each test
  });

  // ==========================================================================
  // Identical Types
  // ==========================================================================

  describe('identical types', () => {
    it('should return Identical for byte to byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.checkCompatibility(byte, byte)).toBe(TypeCompatibility.Identical);
    });

    it('should return Identical for word to word', () => {
      const word = typeSystem.getBuiltinType('word')!;
      expect(typeSystem.checkCompatibility(word, word)).toBe(TypeCompatibility.Identical);
    });

    it('should return Identical for bool to bool', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      expect(typeSystem.checkCompatibility(bool, bool)).toBe(TypeCompatibility.Identical);
    });

    it('should return Identical for void to void', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      expect(typeSystem.checkCompatibility(voidType, voidType)).toBe(TypeCompatibility.Identical);
    });

    it('should return Identical for string to string', () => {
      const str = typeSystem.getBuiltinType('string')!;
      expect(typeSystem.checkCompatibility(str, str)).toBe(TypeCompatibility.Identical);
    });

    it('should return Compatible for same array types', () => {
      // Note: Different instances with same structure return Compatible, not Identical
      const byte = typeSystem.getBuiltinType('byte')!;
      const arr1 = typeSystem.createArrayType(byte, 10);
      const arr2 = typeSystem.createArrayType(byte, 10);

      // These are different TypeInfo instances, so they're Compatible (structurally equal)
      const result = typeSystem.checkCompatibility(arr1, arr2);
      expect([TypeCompatibility.Identical, TypeCompatibility.Compatible]).toContain(result);
    });
  });

  // ==========================================================================
  // Widening Conversions (Compatible)
  // ==========================================================================

  describe('widening conversions', () => {
    it('should return Compatible for byte to word (widening)', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      expect(typeSystem.checkCompatibility(byte, word)).toBe(TypeCompatibility.Compatible);
    });

    it('should return Compatible for bool to byte', () => {
      const bool = typeSystem.getBuiltinType('bool')!;
      const byte = typeSystem.getBuiltinType('byte')!;

      expect(typeSystem.checkCompatibility(bool, byte)).toBe(TypeCompatibility.Compatible);
    });

    it('should return Compatible for byte to bool', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const bool = typeSystem.getBuiltinType('bool')!;

      expect(typeSystem.checkCompatibility(byte, bool)).toBe(TypeCompatibility.Compatible);
    });
  });

  // ==========================================================================
  // Narrowing Conversions (Requires Conversion)
  // ==========================================================================

  describe('narrowing conversions', () => {
    it('should return RequiresConversion for word to byte (narrowing)', () => {
      const word = typeSystem.getBuiltinType('word')!;
      const byte = typeSystem.getBuiltinType('byte')!;

      expect(typeSystem.checkCompatibility(word, byte)).toBe(TypeCompatibility.RequiresConversion);
    });
  });

  // ==========================================================================
  // Incompatible Types
  // ==========================================================================

  describe('incompatible types', () => {
    it('should return Incompatible for byte to string', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const str = typeSystem.getBuiltinType('string')!;

      expect(typeSystem.checkCompatibility(byte, str)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for string to byte', () => {
      const str = typeSystem.getBuiltinType('string')!;
      const byte = typeSystem.getBuiltinType('byte')!;

      expect(typeSystem.checkCompatibility(str, byte)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for void to byte', () => {
      const voidType = typeSystem.getBuiltinType('void')!;
      const byte = typeSystem.getBuiltinType('byte')!;

      expect(typeSystem.checkCompatibility(voidType, byte)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for byte to void', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      expect(typeSystem.checkCompatibility(byte, voidType)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for array to byte', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);

      expect(typeSystem.checkCompatibility(array, byte)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for byte to array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);

      expect(typeSystem.checkCompatibility(byte, array)).toBe(TypeCompatibility.Incompatible);
    });
  });

  // ==========================================================================
  // Array Type Compatibility
  // ==========================================================================

  describe('array type compatibility', () => {
    it('should return Identical for same element type and size', () => {
      // Arrays with same element type and size have identical type names
      // e.g., both are "byte[10]", so they're structurally identical
      const byte = typeSystem.getBuiltinType('byte')!;
      const arr1 = typeSystem.createArrayType(byte, 10);
      const arr2 = typeSystem.createArrayType(byte, 10);

      expect(typeSystem.checkCompatibility(arr1, arr2)).toBe(TypeCompatibility.Identical);
    });

    it('should return Incompatible for different element types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;
      const byteArr = typeSystem.createArrayType(byte, 10);
      const wordArr = typeSystem.createArrayType(word, 10);

      expect(typeSystem.checkCompatibility(byteArr, wordArr)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Incompatible for different sizes', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const arr1 = typeSystem.createArrayType(byte, 10);
      const arr2 = typeSystem.createArrayType(byte, 20);

      expect(typeSystem.checkCompatibility(arr1, arr2)).toBe(TypeCompatibility.Incompatible);
    });

    it('should return Compatible for sized array to unsized array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const sizedArr = typeSystem.createArrayType(byte, 10);
      const unsizedArr = typeSystem.createArrayType(byte);

      expect(typeSystem.checkCompatibility(sizedArr, unsizedArr)).toBe(TypeCompatibility.Compatible);
    });

    it('should return Incompatible for unsized array to sized array', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const unsizedArr = typeSystem.createArrayType(byte);
      const sizedArr = typeSystem.createArrayType(byte, 10);

      // Unsized to sized requires knowing the size at compile time
      expect(typeSystem.checkCompatibility(unsizedArr, sizedArr)).toBe(TypeCompatibility.Incompatible);
    });
  });

  // ==========================================================================
  // Function Type Compatibility
  // ==========================================================================

  describe('function type compatibility', () => {
    it('should return Identical for identical function signatures', () => {
      // Functions with same signature have same type name, so they're Identical
      const byte = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const func1 = typeSystem.createFunctionType([byte], voidType);
      const func2 = typeSystem.createFunctionType([byte], voidType);

      // Both have name "(byte) => void", so they're structurally identical
      expect(typeSystem.checkCompatibility(func1, func2)).toBe(TypeCompatibility.Identical);
    });

    it('should return Incompatible for different parameter counts', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const voidType = typeSystem.getBuiltinType('void')!;

      const func1 = typeSystem.createFunctionType([byte], voidType);
      const func2 = typeSystem.createFunctionType([byte, byte], voidType);

      expect(typeSystem.checkCompatibility(func1, func2)).toBe(TypeCompatibility.Incompatible);
    });

    it('should allow covariant return types for compatible returns', () => {
      // () => byte can be assigned to () => word (widening is allowed)
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      const func1 = typeSystem.createFunctionType([], byte);
      const func2 = typeSystem.createFunctionType([], word);

      // byte can be widened to word, so this is compatible (covariant return)
      expect(typeSystem.checkCompatibility(func1, func2)).toBe(TypeCompatibility.Compatible);
    });

    it('should return Identical for () => void to () => void', () => {
      // Functions with identical signatures have the same type name
      const voidType = typeSystem.getBuiltinType('void')!;

      const func1 = typeSystem.createFunctionType([], voidType);
      const func2 = typeSystem.createFunctionType([], voidType);

      // Both have name "() => void", so they're structurally identical
      expect(typeSystem.checkCompatibility(func1, func2)).toBe(TypeCompatibility.Identical);
    });

    it('should handle covariant return types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      // () => byte can be assigned to () => word (byte widens to word)
      const funcReturningByte = typeSystem.createFunctionType([], byte);
      const funcReturningWord = typeSystem.createFunctionType([], word);

      expect(typeSystem.checkCompatibility(funcReturningByte, funcReturningWord))
        .toBe(TypeCompatibility.Compatible);
    });
  });

  // ==========================================================================
  // Special Case: Any Type
  // ==========================================================================

  describe('any type (special case)', () => {
    it('should return Compatible when target is any type', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const anyType = { kind: TypeKind.Unknown, name: 'any', size: 0 };

      expect(typeSystem.checkCompatibility(byte, anyType)).toBe(TypeCompatibility.Compatible);
    });

    it('should accept arrays when target is any type', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const array = typeSystem.createArrayType(byte, 10);
      const anyType = { kind: TypeKind.Unknown, name: 'any', size: 0 };

      expect(typeSystem.checkCompatibility(array, anyType)).toBe(TypeCompatibility.Compatible);
    });
  });

  // ==========================================================================
  // canAssign Method
  // ==========================================================================

  describe('canAssign', () => {
    it('should return true for identical types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.canAssign(byte, byte)).toBe(true);
    });

    it('should return true for compatible types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      expect(typeSystem.canAssign(byte, word)).toBe(true);
    });

    it('should return false for types requiring conversion', () => {
      const word = typeSystem.getBuiltinType('word')!;
      const byte = typeSystem.getBuiltinType('byte')!;

      expect(typeSystem.canAssign(word, byte)).toBe(false);
    });

    it('should return false for incompatible types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const str = typeSystem.getBuiltinType('string')!;

      expect(typeSystem.canAssign(byte, str)).toBe(false);
    });
  });

  // ==========================================================================
  // areTypesEqual Method
  // ==========================================================================

  describe('areTypesEqual', () => {
    it('should return true for identical types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      expect(typeSystem.areTypesEqual(byte, byte)).toBe(true);
    });

    it('should return false for compatible but not identical types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      expect(typeSystem.areTypesEqual(byte, word)).toBe(false);
    });

    it('should return false for incompatible types', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const str = typeSystem.getBuiltinType('string')!;

      expect(typeSystem.areTypesEqual(byte, str)).toBe(false);
    });
  });

  // ==========================================================================
  // Cache Behavior
  // ==========================================================================

  describe('cache behavior', () => {
    it('should cache compatibility results', () => {
      const byte = typeSystem.getBuiltinType('byte')!;
      const word = typeSystem.getBuiltinType('word')!;

      // First call - computes and caches
      const result1 = typeSystem.checkCompatibility(byte, word);

      // Second call - should return same result (from cache)
      const result2 = typeSystem.checkCompatibility(byte, word);

      expect(result1).toBe(result2);
      expect(result1).toBe(TypeCompatibility.Compatible);
    });

    it('should clear cache on clearCache()', () => {
      const byte = typeSystem.getBuiltinType('byte')!;

      // Populate cache
      typeSystem.checkCompatibility(byte, byte);

      // Clear cache
      typeSystem.clearCache();

      // Should still work (recomputes)
      const result = typeSystem.checkCompatibility(byte, byte);
      expect(result).toBe(TypeCompatibility.Identical);
    });
  });
});