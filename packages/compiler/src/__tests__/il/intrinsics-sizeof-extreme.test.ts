/**
 * IL sizeof Intrinsic - Extreme Tests
 *
 * Extreme edge case tests for the sizeof compile-time intrinsic.
 * These tests verify compile-time evaluation of type sizes for:
 * - Primitive types (void, bool, byte, word)
 * - Array types (fixed-size, dynamic, nested)
 * - Pointer types (single, double, to complex types)
 * - Function types (various signatures)
 * - Edge cases (maximum sizes, boundary conditions)
 *
 * sizeof is a compile-time intrinsic that returns the size of a type in bytes.
 * It has no runtime cost and is evaluated during compilation.
 *
 * @module il/intrinsics-sizeof-extreme.test
 */

import { describe, expect, it } from 'vitest';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import {
  ILTypeKind,
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  createArrayType,
  createPointerType,
  createFunctionType,
  typeToString,
} from '../../il/types.js';

// =============================================================================
// Extreme Test Category: sizeof Registry Definition
// =============================================================================

describe('sizeof Intrinsic Extreme Tests', () => {
  describe('sizeof Registry Definition', () => {
    /**
     * Verify sizeof is registered as a compile-time intrinsic.
     * sizeof is evaluated at compile time, not at runtime.
     */
    it('should be registered as a compile-time intrinsic', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def).toBeDefined();
      expect(def!.isCompileTime).toBe(true);
      expect(def!.category).toBe(IntrinsicCategory.CompileTime);
    });

    /**
     * Verify sizeof has null opcode since it's compile-time only.
     * No IL instruction is generated for sizeof.
     */
    it('should have null opcode (no runtime IL generated)', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.opcode).toBeNull();
    });

    /**
     * Verify sizeof returns a byte type.
     * Type sizes on 6502 fit in a byte (max 255 bytes for practical types).
     */
    it('should return byte type', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.returnType).toBe(IL_BYTE);
      expect(def!.returnType.kind).toBe(ILTypeKind.Byte);
    });

    /**
     * Verify sizeof has no side effects.
     * It's a pure compile-time calculation.
     */
    it('should have no side effects', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.hasSideEffects).toBe(false);
    });

    /**
     * Verify sizeof has no cycle count (no runtime cost).
     */
    it('should have null cycle count', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.cycleCount).toBeNull();
    });

    /**
     * Verify sizeof is not an optimization barrier.
     */
    it('should not be an optimization barrier', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.isBarrier).toBe(false);
    });

    /**
     * Verify sizeof is not volatile.
     */
    it('should not be volatile', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.isVolatile).toBe(false);
    });

    /**
     * Verify sizeof parameter types are empty (takes type, not value).
     * sizeof takes a type parameter, not a regular IL value.
     */
    it('should have empty parameter types (type parameter, not value)', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.parameterTypes.length).toBe(0);
    });

    /**
     * Verify sizeof has a meaningful description.
     */
    it('should have a non-empty description', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.description.length).toBeGreaterThan(0);
      expect(def!.description).toContain('size');
    });
  });

  // ===========================================================================
  // Extreme Test Category: Primitive Type Sizes
  // ===========================================================================

  describe('Primitive Type Sizes', () => {
    /**
     * Verify void type has size 0.
     * Void represents no value.
     */
    it('should return 0 for void type', () => {
      expect(IL_VOID.sizeInBytes).toBe(0);
    });

    /**
     * Verify bool type has size 1.
     * Boolean is 1 byte (0 = false, non-zero = true).
     */
    it('should return 1 for bool type', () => {
      expect(IL_BOOL.sizeInBytes).toBe(1);
    });

    /**
     * Verify byte type has size 1.
     * 8-bit unsigned integer.
     */
    it('should return 1 for byte type', () => {
      expect(IL_BYTE.sizeInBytes).toBe(1);
    });

    /**
     * Verify word type has size 2.
     * 16-bit unsigned integer.
     */
    it('should return 2 for word type', () => {
      expect(IL_WORD.sizeInBytes).toBe(2);
    });

    /**
     * Verify type kind consistency with size for primitives.
     */
    it('should have consistent kind/size relationship for primitives', () => {
      // All 1-byte types
      const oneByteTypes = [IL_BOOL, IL_BYTE];
      for (const t of oneByteTypes) {
        expect(t.sizeInBytes).toBe(1);
      }

      // All 2-byte types
      const twoByteTypes = [IL_WORD];
      for (const t of twoByteTypes) {
        expect(t.sizeInBytes).toBe(2);
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Array Type Sizes
  // ===========================================================================

  describe('Array Type Sizes', () => {
    /**
     * Verify byte array size equals element count.
     * byte[n] = n bytes.
     */
    it('should calculate byte array size correctly', () => {
      const arr5 = createArrayType(IL_BYTE, 5);
      const arr10 = createArrayType(IL_BYTE, 10);
      const arr100 = createArrayType(IL_BYTE, 100);

      expect(arr5.sizeInBytes).toBe(5);
      expect(arr10.sizeInBytes).toBe(10);
      expect(arr100.sizeInBytes).toBe(100);
    });

    /**
     * Verify word array size is element count * 2.
     * word[n] = n * 2 bytes.
     */
    it('should calculate word array size correctly', () => {
      const arr5 = createArrayType(IL_WORD, 5);
      const arr10 = createArrayType(IL_WORD, 10);
      const arr50 = createArrayType(IL_WORD, 50);

      expect(arr5.sizeInBytes).toBe(10); // 5 * 2
      expect(arr10.sizeInBytes).toBe(20); // 10 * 2
      expect(arr50.sizeInBytes).toBe(100); // 50 * 2
    });

    /**
     * Verify empty array (length 0) has size 0.
     */
    it('should return 0 for empty array (length 0)', () => {
      const emptyByteArr = createArrayType(IL_BYTE, 0);
      const emptyWordArr = createArrayType(IL_WORD, 0);

      expect(emptyByteArr.sizeInBytes).toBe(0);
      expect(emptyWordArr.sizeInBytes).toBe(0);
    });

    /**
     * Verify single-element array has element size.
     */
    it('should return element size for single-element array', () => {
      const singleByte = createArrayType(IL_BYTE, 1);
      const singleWord = createArrayType(IL_WORD, 1);

      expect(singleByte.sizeInBytes).toBe(1);
      expect(singleWord.sizeInBytes).toBe(2);
    });

    /**
     * Verify dynamic array has pointer size (2 bytes).
     * Dynamic arrays are represented as pointers.
     */
    it('should return pointer size for dynamic arrays', () => {
      const dynamicByte = createArrayType(IL_BYTE, null);
      const dynamicWord = createArrayType(IL_WORD, null);

      expect(dynamicByte.sizeInBytes).toBe(2); // Pointer size
      expect(dynamicWord.sizeInBytes).toBe(2); // Pointer size
    });

    /**
     * Verify maximum byte-indexable array size (255 elements).
     */
    it('should handle max byte-indexable array size (255)', () => {
      const maxByteArr = createArrayType(IL_BYTE, 255);
      const maxWordArr = createArrayType(IL_WORD, 255);

      expect(maxByteArr.sizeInBytes).toBe(255);
      expect(maxWordArr.sizeInBytes).toBe(510); // 255 * 2
    });

    /**
     * Verify arrays requiring word indexing (256+ elements).
     */
    it('should handle arrays requiring word index (256+ elements)', () => {
      const largeByteArr = createArrayType(IL_BYTE, 256);
      const largeWordArr = createArrayType(IL_WORD, 256);

      expect(largeByteArr.sizeInBytes).toBe(256);
      expect(largeWordArr.sizeInBytes).toBe(512); // 256 * 2
    });

    /**
     * Verify nested array size calculation.
     * byte[10][5] = 50 bytes total.
     */
    it('should calculate nested array sizes correctly', () => {
      const innerArr = createArrayType(IL_BYTE, 10);
      const outerArr = createArrayType(innerArr, 5);

      expect(innerArr.sizeInBytes).toBe(10);
      expect(outerArr.sizeInBytes).toBe(50); // 5 * 10
    });

    /**
     * Verify deeply nested arrays.
     * byte[2][3][4] = 24 bytes.
     */
    it('should calculate deeply nested array sizes', () => {
      const level1 = createArrayType(IL_BYTE, 2);
      const level2 = createArrayType(level1, 3);
      const level3 = createArrayType(level2, 4);

      expect(level1.sizeInBytes).toBe(2);
      expect(level2.sizeInBytes).toBe(6); // 3 * 2
      expect(level3.sizeInBytes).toBe(24); // 4 * 6
    });
  });

  // ===========================================================================
  // Extreme Test Category: Pointer Type Sizes
  // ===========================================================================

  describe('Pointer Type Sizes', () => {
    /**
     * Verify pointer to byte has size 2 (16-bit address).
     */
    it('should return 2 for pointer to byte', () => {
      const ptrByte = createPointerType(IL_BYTE);
      expect(ptrByte.sizeInBytes).toBe(2);
    });

    /**
     * Verify pointer to word has size 2.
     */
    it('should return 2 for pointer to word', () => {
      const ptrWord = createPointerType(IL_WORD);
      expect(ptrWord.sizeInBytes).toBe(2);
    });

    /**
     * Verify pointer to void has size 2.
     */
    it('should return 2 for pointer to void', () => {
      const ptrVoid = createPointerType(IL_VOID);
      expect(ptrVoid.sizeInBytes).toBe(2);
    });

    /**
     * Verify double pointer (pointer to pointer) has size 2.
     * All pointers are 16-bit addresses.
     */
    it('should return 2 for double pointer', () => {
      const ptrByte = createPointerType(IL_BYTE);
      const ptrPtrByte = createPointerType(ptrByte);

      expect(ptrPtrByte.sizeInBytes).toBe(2);
    });

    /**
     * Verify pointer to array has size 2.
     * The pointed-to array can be any size.
     */
    it('should return 2 for pointer to array', () => {
      const arr100 = createArrayType(IL_BYTE, 100);
      const ptrArr = createPointerType(arr100);

      expect(ptrArr.sizeInBytes).toBe(2);
    });

    /**
     * Verify all pointer types have consistent size.
     * On 6502, all pointers are 16-bit (2 bytes).
     */
    it('should have consistent 2-byte size for all pointer types', () => {
      const pointerTargets = [
        IL_VOID,
        IL_BOOL,
        IL_BYTE,
        IL_WORD,
        createArrayType(IL_BYTE, 100),
        createFunctionType([], IL_VOID),
      ];

      for (const target of pointerTargets) {
        const ptr = createPointerType(target);
        expect(ptr.sizeInBytes).toBe(2);
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Function Type Sizes
  // ===========================================================================

  describe('Function Type Sizes', () => {
    /**
     * Verify void function has size 2 (function pointer).
     */
    it('should return 2 for no-arg void function', () => {
      const func = createFunctionType([], IL_VOID);
      expect(func.sizeInBytes).toBe(2);
    });

    /**
     * Verify function with parameters has size 2.
     * Function type size is always pointer size.
     */
    it('should return 2 for function with parameters', () => {
      const func = createFunctionType([IL_BYTE, IL_WORD], IL_WORD);
      expect(func.sizeInBytes).toBe(2);
    });

    /**
     * Verify function with many parameters has size 2.
     */
    it('should return 2 for function with many parameters', () => {
      const manyParams = [IL_BYTE, IL_BYTE, IL_WORD, IL_WORD, IL_BYTE];
      const func = createFunctionType(manyParams, IL_BYTE);
      expect(func.sizeInBytes).toBe(2);
    });

    /**
     * Verify complex function type has size 2.
     * Function taking and returning arrays.
     */
    it('should return 2 for complex function type', () => {
      const arrParam = createArrayType(IL_BYTE, 10);
      const arrReturn = createArrayType(IL_WORD, 5);
      const func = createFunctionType([arrParam], arrReturn);

      expect(func.sizeInBytes).toBe(2);
    });

    /**
     * Verify all function types have consistent size.
     */
    it('should have consistent 2-byte size for all function types', () => {
      const functions = [
        createFunctionType([], IL_VOID),
        createFunctionType([], IL_BYTE),
        createFunctionType([IL_BYTE], IL_VOID),
        createFunctionType([IL_BYTE, IL_WORD], IL_WORD),
        createFunctionType([IL_WORD, IL_WORD, IL_WORD], IL_BYTE),
      ];

      for (const func of functions) {
        expect(func.sizeInBytes).toBe(2);
      }
    });
  });

  // ===========================================================================
  // Extreme Test Category: Size Boundary Conditions
  // ===========================================================================

  describe('Size Boundary Conditions', () => {
    /**
     * Verify maximum single-page array (256 bytes).
     */
    it('should handle 256-byte array (one 6502 page)', () => {
      const pageArr = createArrayType(IL_BYTE, 256);
      expect(pageArr.sizeInBytes).toBe(256);
    });

    /**
     * Verify multi-page array sizes.
     */
    it('should handle multi-page arrays', () => {
      const twoPages = createArrayType(IL_BYTE, 512);
      const fourPages = createArrayType(IL_BYTE, 1024);

      expect(twoPages.sizeInBytes).toBe(512);
      expect(fourPages.sizeInBytes).toBe(1024);
    });

    /**
     * Verify C64 screen memory size (1000 bytes for 40x25 chars).
     */
    it('should handle C64 screen memory size (1000 bytes)', () => {
      const screenMem = createArrayType(IL_BYTE, 1000);
      expect(screenMem.sizeInBytes).toBe(1000);
    });

    /**
     * Verify C64 color RAM size (1000 bytes).
     */
    it('should handle C64 color RAM size (1000 bytes)', () => {
      const colorRam = createArrayType(IL_BYTE, 1000);
      expect(colorRam.sizeInBytes).toBe(1000);
    });

    /**
     * Verify SID register array (29 registers at $D400-$D41C).
     */
    it('should handle SID register array size', () => {
      const sidRegs = createArrayType(IL_BYTE, 29);
      expect(sidRegs.sizeInBytes).toBe(29);
    });

    /**
     * Verify VIC-II register array (47 registers at $D000-$D02E).
     */
    it('should handle VIC-II register array size', () => {
      const vicRegs = createArrayType(IL_BYTE, 47);
      expect(vicRegs.sizeInBytes).toBe(47);
    });

    /**
     * Verify sprite block size (64 bytes per sprite).
     */
    it('should handle sprite block size (64 bytes)', () => {
      const spriteBlock = createArrayType(IL_BYTE, 64);
      expect(spriteBlock.sizeInBytes).toBe(64);
    });

    /**
     * Verify 8 sprites worth of data (512 bytes).
     */
    it('should handle 8-sprite array (512 bytes)', () => {
      const spriteBlock = createArrayType(IL_BYTE, 64);
      const allSprites = createArrayType(spriteBlock, 8);
      expect(allSprites.sizeInBytes).toBe(512);
    });
  });

  // ===========================================================================
  // Extreme Test Category: sizeof in Compile-Time Context
  // ===========================================================================

  describe('sizeof in Compile-Time Context', () => {
    /**
     * Verify sizeof is correctly identified as compile-time in registry.
     */
    it('should be in CompileTime category', () => {
      const compileTimeIntrinsics = INTRINSIC_REGISTRY.getCompileTimeIntrinsics();
      const sizeofDef = compileTimeIntrinsics.find((i) => i.name === 'sizeof');

      expect(sizeofDef).toBeDefined();
      expect(sizeofDef!.category).toBe(IntrinsicCategory.CompileTime);
    });

    /**
     * Verify sizeof is listed alongside other compile-time intrinsics.
     */
    it('should be listed with length in compile-time intrinsics', () => {
      const compileTimeIntrinsics = INTRINSIC_REGISTRY.getCompileTimeIntrinsics();
      const names = compileTimeIntrinsics.map((i) => i.name);

      expect(names).toContain('sizeof');
      expect(names).toContain('length');
    });

    /**
     * Verify sizeof has proper documentation for compile-time usage.
     */
    it('should have description mentioning compile-time', () => {
      const def = INTRINSIC_REGISTRY.get('sizeof');
      expect(def!.description.toLowerCase()).toContain('compile-time');
    });
  });

  // ===========================================================================
  // Extreme Test Category: Type String Representation with Sizes
  // ===========================================================================

  describe('Type String Representation with Sizes', () => {
    /**
     * Verify type string matches expected format for primitives.
     */
    it('should have correct string representation for primitives', () => {
      expect(typeToString(IL_VOID)).toBe('void');
      expect(typeToString(IL_BOOL)).toBe('bool');
      expect(typeToString(IL_BYTE)).toBe('byte');
      expect(typeToString(IL_WORD)).toBe('word');
    });

    /**
     * Verify array type string includes length.
     */
    it('should format array type with length', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(typeToString(arr)).toBe('byte[10]');
      expect(arr.sizeInBytes).toBe(10);
    });

    /**
     * Verify dynamic array string format.
     */
    it('should format dynamic array correctly', () => {
      const dynArr = createArrayType(IL_BYTE, null);
      expect(typeToString(dynArr)).toBe('byte[]');
      expect(dynArr.sizeInBytes).toBe(2); // Pointer size
    });

    /**
     * Verify pointer type string format.
     */
    it('should format pointer type correctly', () => {
      const ptr = createPointerType(IL_BYTE);
      expect(typeToString(ptr)).toBe('*byte');
      expect(ptr.sizeInBytes).toBe(2);
    });

    /**
     * Verify function type string format.
     */
    it('should format function type correctly', () => {
      const func = createFunctionType([IL_BYTE, IL_WORD], IL_BYTE);
      expect(typeToString(func)).toBe('(byte, word) -> byte');
      expect(func.sizeInBytes).toBe(2);
    });
  });
});