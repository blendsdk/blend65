/**
 * IL Types Test Suite
 *
 * Tests for the IL type system including:
 * - Primitive type singletons (IL_VOID, IL_BOOL, IL_BYTE, IL_WORD)
 * - Type factory functions (createArrayType, createPointerType, createFunctionType)
 * - Type equality checking (typesEqual)
 * - Type utility functions (isPrimitiveType, isNumericType, typeToString)
 *
 * @module il/types.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILTypeKind,
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  createArrayType,
  createPointerType,
  createFunctionType,
  typesEqual,
  isPrimitiveType,
  isNumericType,
  isArrayType,
  isPointerType,
  isFunctionType,
  typeToString,
} from '../../il/types.js';

// =============================================================================
// Primitive Type Singletons
// =============================================================================

describe('IL Primitive Type Singletons', () => {
  describe('IL_VOID', () => {
    it('should have Void kind', () => {
      expect(IL_VOID.kind).toBe(ILTypeKind.Void);
    });

    it('should have size of 0 bytes', () => {
      expect(IL_VOID.sizeInBytes).toBe(0);
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(IL_VOID)).toBe(true);
    });

    it('should be identical across references', () => {
      const ref1 = IL_VOID;
      const ref2 = IL_VOID;
      expect(ref1).toBe(ref2);
    });
  });

  describe('IL_BOOL', () => {
    it('should have Bool kind', () => {
      expect(IL_BOOL.kind).toBe(ILTypeKind.Bool);
    });

    it('should have size of 1 byte', () => {
      expect(IL_BOOL.sizeInBytes).toBe(1);
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(IL_BOOL)).toBe(true);
    });

    it('should be identical across references', () => {
      const ref1 = IL_BOOL;
      const ref2 = IL_BOOL;
      expect(ref1).toBe(ref2);
    });
  });

  describe('IL_BYTE', () => {
    it('should have Byte kind', () => {
      expect(IL_BYTE.kind).toBe(ILTypeKind.Byte);
    });

    it('should have size of 1 byte', () => {
      expect(IL_BYTE.sizeInBytes).toBe(1);
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(IL_BYTE)).toBe(true);
    });

    it('should be identical across references', () => {
      const ref1 = IL_BYTE;
      const ref2 = IL_BYTE;
      expect(ref1).toBe(ref2);
    });
  });

  describe('IL_WORD', () => {
    it('should have Word kind', () => {
      expect(IL_WORD.kind).toBe(ILTypeKind.Word);
    });

    it('should have size of 2 bytes', () => {
      expect(IL_WORD.sizeInBytes).toBe(2);
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(IL_WORD)).toBe(true);
    });

    it('should be identical across references', () => {
      const ref1 = IL_WORD;
      const ref2 = IL_WORD;
      expect(ref1).toBe(ref2);
    });
  });

  describe('ILTypeKind enum', () => {
    it('should have all expected values', () => {
      expect(ILTypeKind.Void).toBe('void');
      expect(ILTypeKind.Bool).toBe('bool');
      expect(ILTypeKind.Byte).toBe('byte');
      expect(ILTypeKind.Word).toBe('word');
      expect(ILTypeKind.Pointer).toBe('pointer');
      expect(ILTypeKind.Array).toBe('array');
      expect(ILTypeKind.Function).toBe('function');
    });

    it('should have 7 type kinds', () => {
      const enumKeys = Object.keys(ILTypeKind);
      expect(enumKeys.length).toBe(7);
    });
  });
});

// =============================================================================
// Array Type Factory
// =============================================================================

describe('createArrayType', () => {
  describe('fixed-size arrays', () => {
    it('should create a fixed-size byte array', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(arr.kind).toBe(ILTypeKind.Array);
      expect(arr.elementType).toBe(IL_BYTE);
      expect(arr.length).toBe(10);
      expect(arr.sizeInBytes).toBe(10);
    });

    it('should create a fixed-size word array', () => {
      const arr = createArrayType(IL_WORD, 5);
      expect(arr.kind).toBe(ILTypeKind.Array);
      expect(arr.elementType).toBe(IL_WORD);
      expect(arr.length).toBe(5);
      expect(arr.sizeInBytes).toBe(10); // 5 * 2 bytes
    });

    it('should create an array with 0 length', () => {
      const arr = createArrayType(IL_BYTE, 0);
      expect(arr.length).toBe(0);
      expect(arr.sizeInBytes).toBe(0);
    });

    it('should create an array with 1 element', () => {
      const arr = createArrayType(IL_BYTE, 1);
      expect(arr.length).toBe(1);
      expect(arr.sizeInBytes).toBe(1);
    });

    it('should create an array with 255 elements (max byte index)', () => {
      const arr = createArrayType(IL_BYTE, 255);
      expect(arr.length).toBe(255);
      expect(arr.sizeInBytes).toBe(255);
    });

    it('should create an array with 256 elements (needs word index)', () => {
      const arr = createArrayType(IL_BYTE, 256);
      expect(arr.length).toBe(256);
      expect(arr.sizeInBytes).toBe(256);
    });

    it('should create a large array with 65535 elements', () => {
      const arr = createArrayType(IL_BYTE, 65535);
      expect(arr.length).toBe(65535);
      expect(arr.sizeInBytes).toBe(65535);
    });

    it('should calculate size correctly for word array[100]', () => {
      const arr = createArrayType(IL_WORD, 100);
      expect(arr.sizeInBytes).toBe(200); // 100 * 2 bytes
    });
  });

  describe('dynamic arrays', () => {
    it('should create a dynamic byte array (null length)', () => {
      const arr = createArrayType(IL_BYTE, null);
      expect(arr.kind).toBe(ILTypeKind.Array);
      expect(arr.elementType).toBe(IL_BYTE);
      expect(arr.length).toBeNull();
      expect(arr.sizeInBytes).toBe(2); // Pointer size
    });

    it('should create a dynamic word array', () => {
      const arr = createArrayType(IL_WORD, null);
      expect(arr.elementType).toBe(IL_WORD);
      expect(arr.length).toBeNull();
      expect(arr.sizeInBytes).toBe(2); // Pointer size
    });
  });

  describe('nested arrays', () => {
    it('should create an array of arrays', () => {
      const innerArr = createArrayType(IL_BYTE, 10);
      const outerArr = createArrayType(innerArr, 5);
      expect(outerArr.elementType).toBe(innerArr);
      expect(outerArr.length).toBe(5);
      expect(outerArr.sizeInBytes).toBe(50); // 5 * 10 bytes
    });
  });

  describe('error handling', () => {
    it('should throw error for negative array length', () => {
      expect(() => createArrayType(IL_BYTE, -1)).toThrow('Array length cannot be negative');
    });

    it('should throw error for large negative array length', () => {
      expect(() => createArrayType(IL_BYTE, -100)).toThrow('Array length cannot be negative');
    });
  });

  describe('immutability', () => {
    it('should return frozen array type', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(Object.isFrozen(arr)).toBe(true);
    });
  });
});

// =============================================================================
// Pointer Type Factory
// =============================================================================

describe('createPointerType', () => {
  it('should create a pointer to byte', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(ptr.kind).toBe(ILTypeKind.Pointer);
    expect(ptr.pointeeType).toBe(IL_BYTE);
    expect(ptr.sizeInBytes).toBe(2); // 16-bit address
  });

  it('should create a pointer to word', () => {
    const ptr = createPointerType(IL_WORD);
    expect(ptr.pointeeType).toBe(IL_WORD);
    expect(ptr.sizeInBytes).toBe(2);
  });

  it('should create a pointer to bool', () => {
    const ptr = createPointerType(IL_BOOL);
    expect(ptr.pointeeType).toBe(IL_BOOL);
    expect(ptr.sizeInBytes).toBe(2);
  });

  it('should create a pointer to array', () => {
    const arr = createArrayType(IL_BYTE, 10);
    const ptr = createPointerType(arr);
    expect(ptr.pointeeType).toBe(arr);
    expect(ptr.sizeInBytes).toBe(2);
  });

  it('should create a double pointer (pointer to pointer)', () => {
    const ptr1 = createPointerType(IL_BYTE);
    const ptr2 = createPointerType(ptr1);
    expect(ptr2.pointeeType).toBe(ptr1);
    expect(ptr2.sizeInBytes).toBe(2);
  });

  it('should create a pointer to function type', () => {
    const funcType = createFunctionType([IL_BYTE], IL_VOID);
    const ptr = createPointerType(funcType);
    expect(ptr.pointeeType).toBe(funcType);
    expect(ptr.sizeInBytes).toBe(2);
  });

  it('should return frozen pointer type', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(Object.isFrozen(ptr)).toBe(true);
  });
});

// =============================================================================
// Function Type Factory
// =============================================================================

describe('createFunctionType', () => {
  it('should create a no-arg void function', () => {
    const func = createFunctionType([], IL_VOID);
    expect(func.kind).toBe(ILTypeKind.Function);
    expect(func.parameterTypes).toEqual([]);
    expect(func.returnType).toBe(IL_VOID);
    expect(func.sizeInBytes).toBe(2); // Function pointer size
  });

  it('should create a single param function with return', () => {
    const func = createFunctionType([IL_BYTE], IL_BYTE);
    expect(func.parameterTypes.length).toBe(1);
    expect(func.parameterTypes[0]).toBe(IL_BYTE);
    expect(func.returnType).toBe(IL_BYTE);
  });

  it('should create a multiple param function', () => {
    const func = createFunctionType([IL_BYTE, IL_WORD], IL_WORD);
    expect(func.parameterTypes.length).toBe(2);
    expect(func.parameterTypes[0]).toBe(IL_BYTE);
    expect(func.parameterTypes[1]).toBe(IL_WORD);
    expect(func.returnType).toBe(IL_WORD);
  });

  it('should create a function with array parameter', () => {
    const arr = createArrayType(IL_BYTE, 10);
    const func = createFunctionType([arr], IL_VOID);
    expect(func.parameterTypes[0]).toBe(arr);
  });

  it('should create a function with pointer parameter', () => {
    const ptr = createPointerType(IL_BYTE);
    const func = createFunctionType([ptr], IL_VOID);
    expect(func.parameterTypes[0]).toBe(ptr);
  });

  it('should create a function returning array', () => {
    const arr = createArrayType(IL_BYTE, 10);
    const func = createFunctionType([], arr);
    expect(func.returnType).toBe(arr);
  });

  it('should create a function returning pointer', () => {
    const ptr = createPointerType(IL_BYTE);
    const func = createFunctionType([], ptr);
    expect(func.returnType).toBe(ptr);
  });

  it('should freeze parameter types array', () => {
    const func = createFunctionType([IL_BYTE, IL_WORD], IL_VOID);
    expect(Object.isFrozen(func.parameterTypes)).toBe(true);
  });

  it('should return frozen function type', () => {
    const func = createFunctionType([IL_BYTE], IL_VOID);
    expect(Object.isFrozen(func)).toBe(true);
  });

  it('should copy parameter types (not share reference)', () => {
    const params = [IL_BYTE, IL_WORD];
    const func = createFunctionType(params, IL_VOID);
    // Check that modifying original doesn't affect function type
    expect(func.parameterTypes).not.toBe(params);
    expect(func.parameterTypes).toEqual(params);
  });
});

// =============================================================================
// Type Equality
// =============================================================================

describe('typesEqual', () => {
  describe('primitive types', () => {
    it('should return true for same primitive type (byte == byte)', () => {
      expect(typesEqual(IL_BYTE, IL_BYTE)).toBe(true);
    });

    it('should return true for same primitive type (word == word)', () => {
      expect(typesEqual(IL_WORD, IL_WORD)).toBe(true);
    });

    it('should return true for void == void', () => {
      expect(typesEqual(IL_VOID, IL_VOID)).toBe(true);
    });

    it('should return true for bool == bool', () => {
      expect(typesEqual(IL_BOOL, IL_BOOL)).toBe(true);
    });

    it('should return false for byte != word', () => {
      expect(typesEqual(IL_BYTE, IL_WORD)).toBe(false);
    });

    it('should return false for byte != bool', () => {
      expect(typesEqual(IL_BYTE, IL_BOOL)).toBe(false);
    });

    it('should return false for void != byte', () => {
      expect(typesEqual(IL_VOID, IL_BYTE)).toBe(false);
    });
  });

  describe('array types', () => {
    it('should return true for identical array types', () => {
      const arr1 = createArrayType(IL_BYTE, 10);
      const arr2 = createArrayType(IL_BYTE, 10);
      expect(typesEqual(arr1, arr2)).toBe(true);
    });

    it('should return false for different element types', () => {
      const arr1 = createArrayType(IL_BYTE, 10);
      const arr2 = createArrayType(IL_WORD, 10);
      expect(typesEqual(arr1, arr2)).toBe(false);
    });

    it('should return false for different lengths', () => {
      const arr1 = createArrayType(IL_BYTE, 10);
      const arr2 = createArrayType(IL_BYTE, 20);
      expect(typesEqual(arr1, arr2)).toBe(false);
    });

    it('should return false for dynamic vs fixed array', () => {
      const fixed = createArrayType(IL_BYTE, 10);
      const dynamic = createArrayType(IL_BYTE, null);
      expect(typesEqual(fixed, dynamic)).toBe(false);
    });

    it('should return true for identical dynamic arrays', () => {
      const arr1 = createArrayType(IL_BYTE, null);
      const arr2 = createArrayType(IL_BYTE, null);
      expect(typesEqual(arr1, arr2)).toBe(true);
    });
  });

  describe('pointer types', () => {
    it('should return true for same pointer types', () => {
      const ptr1 = createPointerType(IL_BYTE);
      const ptr2 = createPointerType(IL_BYTE);
      expect(typesEqual(ptr1, ptr2)).toBe(true);
    });

    it('should return false for different pointee types', () => {
      const ptr1 = createPointerType(IL_BYTE);
      const ptr2 = createPointerType(IL_WORD);
      expect(typesEqual(ptr1, ptr2)).toBe(false);
    });
  });

  describe('function types', () => {
    it('should return true for same function types', () => {
      const func1 = createFunctionType([IL_BYTE, IL_BYTE], IL_WORD);
      const func2 = createFunctionType([IL_BYTE, IL_BYTE], IL_WORD);
      expect(typesEqual(func1, func2)).toBe(true);
    });

    it('should return false for different return types', () => {
      const func1 = createFunctionType([IL_BYTE], IL_BYTE);
      const func2 = createFunctionType([IL_BYTE], IL_WORD);
      expect(typesEqual(func1, func2)).toBe(false);
    });

    it('should return false for different parameter count', () => {
      const func1 = createFunctionType([IL_BYTE], IL_VOID);
      const func2 = createFunctionType([IL_BYTE, IL_BYTE], IL_VOID);
      expect(typesEqual(func1, func2)).toBe(false);
    });

    it('should return false for different parameter types', () => {
      const func1 = createFunctionType([IL_BYTE], IL_VOID);
      const func2 = createFunctionType([IL_WORD], IL_VOID);
      expect(typesEqual(func1, func2)).toBe(false);
    });
  });

  describe('nested types', () => {
    it('should compare deep nested type equality (array of pointers)', () => {
      const ptr1 = createPointerType(IL_BYTE);
      const ptr2 = createPointerType(IL_BYTE);
      const arr1 = createArrayType(ptr1, 5);
      const arr2 = createArrayType(ptr2, 5);
      expect(typesEqual(arr1, arr2)).toBe(true);
    });

    it('should compare complex function type equality', () => {
      const ptr = createPointerType(IL_BYTE);
      const arr = createArrayType(IL_WORD, 10);
      const func1 = createFunctionType([ptr, arr], IL_BYTE);
      const func2 = createFunctionType([ptr, arr], IL_BYTE);
      expect(typesEqual(func1, func2)).toBe(true);
    });
  });

  describe('cross-kind comparison', () => {
    it('should return false for array vs pointer', () => {
      const arr = createArrayType(IL_BYTE, 10);
      const ptr = createPointerType(IL_BYTE);
      expect(typesEqual(arr, ptr)).toBe(false);
    });

    it('should return false for function vs array', () => {
      const func = createFunctionType([], IL_VOID);
      const arr = createArrayType(IL_BYTE, 10);
      expect(typesEqual(func, arr)).toBe(false);
    });

    it('should return false for primitive vs array', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(typesEqual(IL_BYTE, arr)).toBe(false);
    });
  });
});

// =============================================================================
// Type Utility Functions
// =============================================================================

describe('isPrimitiveType', () => {
  it('should return true for void', () => {
    expect(isPrimitiveType(IL_VOID)).toBe(true);
  });

  it('should return true for bool', () => {
    expect(isPrimitiveType(IL_BOOL)).toBe(true);
  });

  it('should return true for byte', () => {
    expect(isPrimitiveType(IL_BYTE)).toBe(true);
  });

  it('should return true for word', () => {
    expect(isPrimitiveType(IL_WORD)).toBe(true);
  });

  it('should return false for array', () => {
    const arr = createArrayType(IL_BYTE, 10);
    expect(isPrimitiveType(arr)).toBe(false);
  });

  it('should return false for pointer', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(isPrimitiveType(ptr)).toBe(false);
  });

  it('should return false for function', () => {
    const func = createFunctionType([], IL_VOID);
    expect(isPrimitiveType(func)).toBe(false);
  });
});

describe('isNumericType', () => {
  it('should return true for byte', () => {
    expect(isNumericType(IL_BYTE)).toBe(true);
  });

  it('should return true for word', () => {
    expect(isNumericType(IL_WORD)).toBe(true);
  });

  it('should return false for void', () => {
    expect(isNumericType(IL_VOID)).toBe(false);
  });

  it('should return false for bool', () => {
    expect(isNumericType(IL_BOOL)).toBe(false);
  });

  it('should return false for array', () => {
    const arr = createArrayType(IL_BYTE, 10);
    expect(isNumericType(arr)).toBe(false);
  });

  it('should return false for pointer', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(isNumericType(ptr)).toBe(false);
  });
});

describe('isArrayType', () => {
  it('should return true for array types', () => {
    const arr = createArrayType(IL_BYTE, 10);
    expect(isArrayType(arr)).toBe(true);
  });

  it('should return false for primitive types', () => {
    expect(isArrayType(IL_BYTE)).toBe(false);
  });

  it('should return false for pointer types', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(isArrayType(ptr)).toBe(false);
  });
});

describe('isPointerType', () => {
  it('should return true for pointer types', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(isPointerType(ptr)).toBe(true);
  });

  it('should return false for primitive types', () => {
    expect(isPointerType(IL_BYTE)).toBe(false);
  });

  it('should return false for array types', () => {
    const arr = createArrayType(IL_BYTE, 10);
    expect(isPointerType(arr)).toBe(false);
  });
});

describe('isFunctionType', () => {
  it('should return true for function types', () => {
    const func = createFunctionType([], IL_VOID);
    expect(isFunctionType(func)).toBe(true);
  });

  it('should return false for primitive types', () => {
    expect(isFunctionType(IL_BYTE)).toBe(false);
  });

  it('should return false for pointer types', () => {
    const ptr = createPointerType(IL_BYTE);
    expect(isFunctionType(ptr)).toBe(false);
  });
});

describe('typeToString', () => {
  describe('primitive types', () => {
    it('should return "void" for IL_VOID', () => {
      expect(typeToString(IL_VOID)).toBe('void');
    });

    it('should return "bool" for IL_BOOL', () => {
      expect(typeToString(IL_BOOL)).toBe('bool');
    });

    it('should return "byte" for IL_BYTE', () => {
      expect(typeToString(IL_BYTE)).toBe('byte');
    });

    it('should return "word" for IL_WORD', () => {
      expect(typeToString(IL_WORD)).toBe('word');
    });
  });

  describe('array types', () => {
    it('should format fixed-size array as "byte[10]"', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(typeToString(arr)).toBe('byte[10]');
    });

    it('should format dynamic array as "byte[]"', () => {
      const arr = createArrayType(IL_BYTE, null);
      expect(typeToString(arr)).toBe('byte[]');
    });

    it('should format word array as "word[5]"', () => {
      const arr = createArrayType(IL_WORD, 5);
      expect(typeToString(arr)).toBe('word[5]');
    });
  });

  describe('pointer types', () => {
    it('should format pointer to byte as "*byte"', () => {
      const ptr = createPointerType(IL_BYTE);
      expect(typeToString(ptr)).toBe('*byte');
    });

    it('should format pointer to word as "*word"', () => {
      const ptr = createPointerType(IL_WORD);
      expect(typeToString(ptr)).toBe('*word');
    });

    it('should format double pointer as "**byte"', () => {
      const ptr1 = createPointerType(IL_BYTE);
      const ptr2 = createPointerType(ptr1);
      expect(typeToString(ptr2)).toBe('**byte');
    });
  });

  describe('function types', () => {
    it('should format no-arg void function as "() -> void"', () => {
      const func = createFunctionType([], IL_VOID);
      expect(typeToString(func)).toBe('() -> void');
    });

    it('should format single param function as "(byte) -> byte"', () => {
      const func = createFunctionType([IL_BYTE], IL_BYTE);
      expect(typeToString(func)).toBe('(byte) -> byte');
    });

    it('should format multi-param function as "(byte, word) -> word"', () => {
      const func = createFunctionType([IL_BYTE, IL_WORD], IL_WORD);
      expect(typeToString(func)).toBe('(byte, word) -> word');
    });
  });

  describe('nested types', () => {
    it('should format pointer to array', () => {
      const arr = createArrayType(IL_BYTE, 10);
      const ptr = createPointerType(arr);
      expect(typeToString(ptr)).toBe('*byte[10]');
    });

    it('should format array of pointers', () => {
      const ptr = createPointerType(IL_BYTE);
      const arr = createArrayType(ptr, 5);
      expect(typeToString(arr)).toBe('*byte[5]');
    });
  });
});