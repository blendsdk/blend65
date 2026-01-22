/**
 * Extreme Edge Case Tests for the length Compile-Time Intrinsic
 *
 * Tests the length() intrinsic which returns the number of elements in an array.
 * This is a compile-time intrinsic - arrays in Blend65 have fixed, known sizes.
 *
 * @module __tests__/il/intrinsics-length-extreme
 */

import { describe, it, expect } from 'vitest';
import {
  IntrinsicRegistry,
  IntrinsicCategory,
  INTRINSIC_REGISTRY,
} from '../../il/intrinsics/registry.js';
import {
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  ILTypeKind,
  createArrayType,
  createPointerType,
  typeToString,
  type ILArrayType,
} from '../../il/types.js';

describe('Intrinsics: length Compile-Time Intrinsic - Extreme Tests', () => {
  // ===========================================================================
  // Registry Definition Tests
  // ===========================================================================

  describe('length Registry Definition', () => {
    it('should be registered in the global registry', () => {
      // Verify length is a recognized intrinsic
      expect(INTRINSIC_REGISTRY.isIntrinsic('length')).toBe(true);
    });

    it('should have CompileTime category', () => {
      // length is evaluated at compile time - no runtime cost
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.category).toBe(IntrinsicCategory.CompileTime);
    });

    it('should have IL_WORD return type for large array support', () => {
      // Returns word (16-bit) to support arrays up to 65535 elements
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.returnType).toBe(IL_WORD);
      expect(def.returnType.kind).toBe(ILTypeKind.Word);
      expect(def.returnType.sizeInBytes).toBe(2);
    });

    it('should have null opcode (compile-time only)', () => {
      // No runtime IL instruction - resolved at compile time
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.opcode).toBeNull();
    });

    it('should be marked as compile-time intrinsic', () => {
      // isCompileTime must be true
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.isCompileTime).toBe(true);
    });

    it('should have no side effects', () => {
      // Pure compile-time computation
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.hasSideEffects).toBe(false);
    });

    it('should not be an optimization barrier', () => {
      // Does not prevent optimizations
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.isBarrier).toBe(false);
    });

    it('should not be volatile', () => {
      // Compile-time constant - never changes
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.isVolatile).toBe(false);
    });

    it('should have null cycle count (no runtime cost)', () => {
      // Completely resolved at compile time
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.cycleCount).toBeNull();
    });

    it('should have empty parameterTypes (array type varies)', () => {
      // Array parameter type is not a regular IL value
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.parameterTypes).toHaveLength(0);
    });

    it('should have "array" as parameter name', () => {
      // Documentation parameter name
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.parameterNames).toEqual(['array']);
    });

    it('should have descriptive description', () => {
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.description).toContain('length');
      expect(def.description.toLowerCase()).toContain('array');
    });
  });

  // ===========================================================================
  // Fixed Array Length Tests
  // ===========================================================================

  describe('Fixed Array Lengths', () => {
    it('should support single-element byte array', () => {
      // Smallest meaningful array: 1 element
      const arr = createArrayType(IL_BYTE, 1);
      expect(arr.length).toBe(1);
      expect(arr.sizeInBytes).toBe(1); // 1 * 1
    });

    it('should support single-element word array', () => {
      const arr = createArrayType(IL_WORD, 1);
      expect(arr.length).toBe(1);
      expect(arr.sizeInBytes).toBe(2); // 1 * 2
    });

    it('should support 10-element byte array', () => {
      const arr = createArrayType(IL_BYTE, 10);
      expect(arr.length).toBe(10);
      expect(arr.sizeInBytes).toBe(10);
    });

    it('should support 100-element byte array', () => {
      const arr = createArrayType(IL_BYTE, 100);
      expect(arr.length).toBe(100);
      expect(arr.sizeInBytes).toBe(100);
    });

    it('should support 10-element word array', () => {
      const arr = createArrayType(IL_WORD, 10);
      expect(arr.length).toBe(10);
      expect(arr.sizeInBytes).toBe(20); // 10 * 2
    });

    it('should support bool array', () => {
      const arr = createArrayType(IL_BOOL, 8);
      expect(arr.length).toBe(8);
      expect(arr.sizeInBytes).toBe(8); // 8 * 1 byte
    });
  });

  // ===========================================================================
  // Boundary Condition Tests
  // ===========================================================================

  describe('Array Length Boundaries', () => {
    it('should support max byte-indexable array (255 elements)', () => {
      // Maximum array that can be indexed with a single byte
      const arr = createArrayType(IL_BYTE, 255);
      expect(arr.length).toBe(255);
      expect(arr.sizeInBytes).toBe(255);
    });

    it('should support 256-element array (requires word index)', () => {
      // First array that requires word indexing
      const arr = createArrayType(IL_BYTE, 256);
      expect(arr.length).toBe(256);
      expect(arr.sizeInBytes).toBe(256);
    });

    it('should support page-boundary array (256 bytes)', () => {
      // Exactly one 6502 memory page
      const arr = createArrayType(IL_BYTE, 256);
      expect(arr.length).toBe(256);
      expect(arr.sizeInBytes).toBe(256);
    });

    it('should support multi-page array (512 elements)', () => {
      // Two 6502 memory pages
      const arr = createArrayType(IL_BYTE, 512);
      expect(arr.length).toBe(512);
      expect(arr.sizeInBytes).toBe(512);
    });

    it('should support 1000-element array', () => {
      // Common C64 screen-sized buffer
      const arr = createArrayType(IL_BYTE, 1000);
      expect(arr.length).toBe(1000);
      expect(arr.sizeInBytes).toBe(1000);
    });

    it('should support max word value array (65535 elements)', () => {
      // Maximum possible array length (word return type)
      const arr = createArrayType(IL_BYTE, 65535);
      expect(arr.length).toBe(65535);
      expect(arr.sizeInBytes).toBe(65535);
    });

    it('should support large word array within 64K', () => {
      // Large word array: 32767 words = 65534 bytes
      const arr = createArrayType(IL_WORD, 32767);
      expect(arr.length).toBe(32767);
      expect(arr.sizeInBytes).toBe(65534);
    });
  });

  // ===========================================================================
  // C64 Hardware-Specific Array Lengths
  // ===========================================================================

  describe('C64 Hardware Array Lengths', () => {
    it('should support screen buffer (1000 characters)', () => {
      // C64 screen: 40 columns × 25 rows = 1000 bytes
      const screenBuffer = createArrayType(IL_BYTE, 1000);
      expect(screenBuffer.length).toBe(1000);
      expect(screenBuffer.sizeInBytes).toBe(1000);
    });

    it('should support color RAM buffer (1000 colors)', () => {
      // C64 color RAM: 40 × 25 = 1000 nibbles (stored as bytes)
      const colorBuffer = createArrayType(IL_BYTE, 1000);
      expect(colorBuffer.length).toBe(1000);
    });

    it('should support sprite block (64 bytes)', () => {
      // One sprite definition: 63 bytes data + 1 byte padding
      const spriteBlock = createArrayType(IL_BYTE, 64);
      expect(spriteBlock.length).toBe(64);
      expect(spriteBlock.sizeInBytes).toBe(64);
    });

    it('should support 8-sprite buffer (512 bytes)', () => {
      // All 8 sprites: 8 × 64 = 512 bytes
      const allSprites = createArrayType(IL_BYTE, 512);
      expect(allSprites.length).toBe(512);
      expect(allSprites.sizeInBytes).toBe(512);
    });

    it('should support SID register array (29 registers)', () => {
      // SID: 29 registers
      const sidRegs = createArrayType(IL_BYTE, 29);
      expect(sidRegs.length).toBe(29);
    });

    it('should support VIC-II register array (47 registers)', () => {
      // VIC-II: 47 registers
      const vicRegs = createArrayType(IL_BYTE, 47);
      expect(vicRegs.length).toBe(47);
    });

    it('should support CIA register array (16 registers per CIA)', () => {
      // Each CIA: 16 registers
      const ciaRegs = createArrayType(IL_BYTE, 16);
      expect(ciaRegs.length).toBe(16);
    });

    it('should support character set (2048 bytes)', () => {
      // Full character set: 256 chars × 8 bytes each
      const charset = createArrayType(IL_BYTE, 2048);
      expect(charset.length).toBe(2048);
      expect(charset.sizeInBytes).toBe(2048);
    });

    it('should support bitmap graphics (8000 bytes)', () => {
      // Full hi-res bitmap: 320 × 200 / 8 = 8000 bytes
      const bitmap = createArrayType(IL_BYTE, 8000);
      expect(bitmap.length).toBe(8000);
      expect(bitmap.sizeInBytes).toBe(8000);
    });
  });

  // ===========================================================================
  // Dynamic Array Tests
  // ===========================================================================

  describe('Dynamic Array Lengths', () => {
    it('should have null length for dynamic byte array', () => {
      // Dynamic arrays have unknown length at compile time
      const dynamicArr = createArrayType(IL_BYTE, null);
      expect(dynamicArr.length).toBeNull();
      // Dynamic arrays are represented as pointers (2 bytes)
      expect(dynamicArr.sizeInBytes).toBe(2);
    });

    it('should have null length for dynamic word array', () => {
      const dynamicArr = createArrayType(IL_WORD, null);
      expect(dynamicArr.length).toBeNull();
      expect(dynamicArr.sizeInBytes).toBe(2);
    });

    it('should have null length for dynamic bool array', () => {
      const dynamicArr = createArrayType(IL_BOOL, null);
      expect(dynamicArr.length).toBeNull();
      expect(dynamicArr.sizeInBytes).toBe(2);
    });
  });

  // ===========================================================================
  // Nested Array Length Tests
  // ===========================================================================

  describe('Nested Array Lengths', () => {
    it('should track outer array length for 2D arrays', () => {
      // 10 rows of 40-byte arrays (screen row)
      const innerRow = createArrayType(IL_BYTE, 40);
      const rows = createArrayType(innerRow, 10);

      expect(rows.length).toBe(10); // 10 outer elements
      expect(innerRow.length).toBe(40); // Each inner array has 40 elements
    });

    it('should calculate correct size for 2D arrays', () => {
      // 25 rows × 40 columns = C64 screen
      const row = createArrayType(IL_BYTE, 40);
      const screen = createArrayType(row, 25);

      expect(screen.length).toBe(25);
      expect(row.sizeInBytes).toBe(40);
      expect(screen.sizeInBytes).toBe(40 * 25); // 1000 bytes
    });

    it('should track length for 3D arrays', () => {
      // 3D: 8 frames × 25 rows × 40 columns (animation buffer)
      const col = createArrayType(IL_BYTE, 40);
      const row = createArrayType(col, 25);
      const frames = createArrayType(row, 8);

      expect(frames.length).toBe(8);
      expect(row.length).toBe(25);
      expect(col.length).toBe(40);
      expect(frames.sizeInBytes).toBe(8 * 25 * 40); // 8000 bytes
    });

    it('should handle deeply nested word arrays', () => {
      // 2D word array: 10 × 5
      const inner = createArrayType(IL_WORD, 5);
      const outer = createArrayType(inner, 10);

      expect(outer.length).toBe(10);
      expect(inner.length).toBe(5);
      expect(inner.sizeInBytes).toBe(10); // 5 words × 2 bytes
      expect(outer.sizeInBytes).toBe(100); // 10 × 10 bytes
    });
  });

  // ===========================================================================
  // Array of Pointers Length Tests
  // ===========================================================================

  describe('Array of Pointers Lengths', () => {
    it('should track length for array of byte pointers', () => {
      const bytePtr = createPointerType(IL_BYTE);
      const ptrArray = createArrayType(bytePtr, 10);

      expect(ptrArray.length).toBe(10);
      expect(ptrArray.sizeInBytes).toBe(20); // 10 × 2-byte pointers
    });

    it('should track length for sprite pointer table', () => {
      // 8 sprite pointers (common C64 pattern)
      const bytePtr = createPointerType(IL_BYTE);
      const spriteTable = createArrayType(bytePtr, 8);

      expect(spriteTable.length).toBe(8);
      expect(spriteTable.sizeInBytes).toBe(16);
    });

    it('should track length for screen line pointer table', () => {
      // 25 pointers to screen lines
      const bytePtr = createPointerType(IL_BYTE);
      const lineTable = createArrayType(bytePtr, 25);

      expect(lineTable.length).toBe(25);
      expect(lineTable.sizeInBytes).toBe(50); // 25 × 2-byte pointers
    });
  });

  // ===========================================================================
  // Type String Representation
  // ===========================================================================

  describe('Array Type String Representation', () => {
    it('should format fixed byte array with length', () => {
      const arr = createArrayType(IL_BYTE, 100);
      expect(typeToString(arr)).toBe('byte[100]');
    });

    it('should format fixed word array with length', () => {
      const arr = createArrayType(IL_WORD, 50);
      expect(typeToString(arr)).toBe('word[50]');
    });

    it('should format dynamic array without length', () => {
      const arr = createArrayType(IL_BYTE, null);
      expect(typeToString(arr)).toBe('byte[]');
    });

    it('should format nested array with lengths', () => {
      const inner = createArrayType(IL_BYTE, 40);
      const outer = createArrayType(inner, 25);
      expect(typeToString(outer)).toBe('byte[40][25]');
    });
  });

  // ===========================================================================
  // Compile-Time Intrinsic Category Tests
  // ===========================================================================

  describe('Compile-Time Intrinsic Category', () => {
    it('should be listed with sizeof in compile-time intrinsics', () => {
      const compileTimeIntrinsics = INTRINSIC_REGISTRY.getCompileTimeIntrinsics();
      const names = compileTimeIntrinsics.map(def => def.name);

      expect(names).toContain('length');
      expect(names).toContain('sizeof');
    });

    it('should be in CompileTime category with getByCategory', () => {
      const compileTimeIntrinsics = INTRINSIC_REGISTRY.getByCategory(
        IntrinsicCategory.CompileTime,
      );
      const names = compileTimeIntrinsics.map(def => def.name);

      expect(names).toContain('length');
    });

    it('should have consistent compile-time properties with sizeof', () => {
      const lengthDef = INTRINSIC_REGISTRY.get('length')!;
      const sizeofDef = INTRINSIC_REGISTRY.get('sizeof')!;

      // Both are compile-time
      expect(lengthDef.isCompileTime).toBe(true);
      expect(sizeofDef.isCompileTime).toBe(true);

      // Both have null opcode
      expect(lengthDef.opcode).toBeNull();
      expect(sizeofDef.opcode).toBeNull();

      // Both have null cycle count
      expect(lengthDef.cycleCount).toBeNull();
      expect(sizeofDef.cycleCount).toBeNull();

      // Both have no side effects
      expect(lengthDef.hasSideEffects).toBe(false);
      expect(sizeofDef.hasSideEffects).toBe(false);

      // Both are in CompileTime category
      expect(lengthDef.category).toBe(IntrinsicCategory.CompileTime);
      expect(sizeofDef.category).toBe(IntrinsicCategory.CompileTime);
    });
  });

  // ===========================================================================
  // Word Return Type Justification Tests
  // ===========================================================================

  describe('Word Return Type Justification', () => {
    it('should return word to support arrays > 255 elements', () => {
      // Byte can only represent 0-255, but we need larger arrays
      const def = INTRINSIC_REGISTRY.get('length')!;
      expect(def.returnType).toBe(IL_WORD);

      // Example: screen buffer has 1000 elements
      const screen = createArrayType(IL_BYTE, 1000);
      expect(screen.length).toBe(1000);
      expect(1000).toBeGreaterThan(255); // Justifies word return type
    });

    it('should support bitmap-sized arrays (8000 elements)', () => {
      // Hi-res bitmap: 8000 bytes - well beyond byte range
      const bitmap = createArrayType(IL_BYTE, 8000);
      expect(bitmap.length).toBe(8000);
      expect(8000).toBeGreaterThan(255);
    });

    it('should support max addressable memory arrays', () => {
      // Maximum array in 64K address space
      const maxArr = createArrayType(IL_BYTE, 65535);
      expect(maxArr.length).toBe(65535);
      expect(65535).toBe(0xffff); // Max word value
    });
  });
});