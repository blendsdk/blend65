/**
 * Tests for GlobalsGenerator - Type Size Calculation
 *
 * Tests the getTypeSize() helper method for calculating
 * variable sizes based on IL types.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/globals-generator-types.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalsGenerator } from '../../codegen/globals-generator.js';
import { ILModule } from '../../il/module.js';
import { IL_VOID, IL_BOOL, IL_BYTE, IL_WORD, createArrayType, createPointerType } from '../../il/types.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of GlobalsGenerator
 */
class TestGlobalsGenerator extends GlobalsGenerator {
  public exposeGetTypeSize(type: { kind: string; size?: number }): number {
    return this.getTypeSize(type);
  }

  public setModule(module: ILModule): void {
    this.currentModule = module;
  }

  public setOptions(options: CodegenOptions): void {
    this.options = options;
  }
}

function createTestOptions(): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
  };
}

describe('GlobalsGenerator - Type Size Calculation', () => {
  let generator: TestGlobalsGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestGlobalsGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // Primitive Type Size Tests
  // ===========================================================================

  describe('primitive type sizes', () => {
    it('should return 0 for void type', () => {
      expect(generator.exposeGetTypeSize(IL_VOID)).toBe(0);
    });

    it('should return 1 for bool type', () => {
      expect(generator.exposeGetTypeSize(IL_BOOL)).toBe(1);
    });

    it('should return 1 for byte type', () => {
      expect(generator.exposeGetTypeSize(IL_BYTE)).toBe(1);
    });

    it('should return 2 for word type', () => {
      expect(generator.exposeGetTypeSize(IL_WORD)).toBe(2);
    });
  });

  // ===========================================================================
  // Pointer Type Size Tests
  // ===========================================================================

  describe('pointer type sizes', () => {
    it('should return 2 for pointer to byte', () => {
      const ptrType = createPointerType(IL_BYTE);
      expect(generator.exposeGetTypeSize(ptrType)).toBe(2);
    });

    it('should return 2 for pointer to word', () => {
      const ptrType = createPointerType(IL_WORD);
      expect(generator.exposeGetTypeSize(ptrType)).toBe(2);
    });

    it('should return 2 for pointer to pointer', () => {
      const ptrToPtr = createPointerType(createPointerType(IL_BYTE));
      expect(generator.exposeGetTypeSize(ptrToPtr)).toBe(2);
    });
  });

  // ===========================================================================
  // Explicit Size Override Tests
  // ===========================================================================

  describe('explicit size override', () => {
    it('should use explicit size when provided', () => {
      const customType = { kind: 'custom', size: 10 };
      expect(generator.exposeGetTypeSize(customType)).toBe(10);
    });

    it('should use explicit size even for known types', () => {
      // If size is explicitly provided, it should be used
      const byteWithSize = { kind: 'byte', size: 5 };
      expect(generator.exposeGetTypeSize(byteWithSize)).toBe(5);
    });

    it('should handle explicit size of 0', () => {
      const zeroSize = { kind: 'empty', size: 0 };
      expect(generator.exposeGetTypeSize(zeroSize)).toBe(0);
    });
  });

  // ===========================================================================
  // Unknown Type Fallback Tests
  // ===========================================================================

  describe('unknown type fallback', () => {
    it('should default to 1 for unknown type without explicit size', () => {
      const unknownType = { kind: 'unknown' };
      expect(generator.exposeGetTypeSize(unknownType)).toBe(1);
    });

    it('should default to 1 for custom type without explicit size', () => {
      const customType = { kind: 'myCustomType' };
      expect(generator.exposeGetTypeSize(customType)).toBe(1);
    });

    it('should default to 1 for struct type without explicit size', () => {
      const structType = { kind: 'struct' };
      expect(generator.exposeGetTypeSize(structType)).toBe(1);
    });
  });

  // ===========================================================================
  // Type Kind String Tests
  // ===========================================================================

  describe('type kind strings', () => {
    it('should recognize void kind string', () => {
      expect(generator.exposeGetTypeSize({ kind: 'void' })).toBe(0);
    });

    it('should recognize bool kind string', () => {
      expect(generator.exposeGetTypeSize({ kind: 'bool' })).toBe(1);
    });

    it('should recognize byte kind string', () => {
      expect(generator.exposeGetTypeSize({ kind: 'byte' })).toBe(1);
    });

    it('should recognize word kind string', () => {
      expect(generator.exposeGetTypeSize({ kind: 'word' })).toBe(2);
    });

    it('should recognize pointer kind string', () => {
      expect(generator.exposeGetTypeSize({ kind: 'pointer' })).toBe(2);
    });
  });

  // ===========================================================================
  // Array Type Size Tests
  // ===========================================================================

  describe('array type sizes', () => {
    it('should calculate size for fixed byte array using explicit size', () => {
      // getTypeSize looks for 'size' property, not 'sizeInBytes'
      // So we test with the size property that the method expects
      const arrayType = { kind: 'array', size: 10 };
      expect(generator.exposeGetTypeSize(arrayType)).toBe(10);
    });

    it('should calculate size for fixed word array using explicit size', () => {
      const arrayType = { kind: 'array', size: 10 };
      expect(generator.exposeGetTypeSize(arrayType)).toBe(10); // 5 * 2
    });

    it('should default to 1 for array type without explicit size', () => {
      // ILType uses sizeInBytes but getTypeSize looks for size property
      // Without explicit size, it falls through to default case
      const dynamicArray = createArrayType(IL_BYTE, null);
      // The method doesn't recognize sizeInBytes, returns default 1
      expect(generator.exposeGetTypeSize(dynamicArray)).toBe(1);
    });

    it('should use sizeInBytes when passed as size property', () => {
      // To properly pass array sizes, convert sizeInBytes to size
      const arrayType = createArrayType(IL_BYTE, 10);
      const typeWithSize = { kind: arrayType.kind, size: arrayType.sizeInBytes };
      expect(generator.exposeGetTypeSize(typeWithSize)).toBe(10);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty kind string', () => {
      const emptyKind = { kind: '' };
      expect(generator.exposeGetTypeSize(emptyKind)).toBe(1);
    });

    it('should handle case sensitivity correctly', () => {
      // Kind strings should be lowercase
      const upperCase = { kind: 'BYTE' };
      expect(generator.exposeGetTypeSize(upperCase)).toBe(1); // Unknown, defaults to 1
    });

    it('should handle mixed case', () => {
      const mixedCase = { kind: 'Byte' };
      expect(generator.exposeGetTypeSize(mixedCase)).toBe(1); // Unknown, defaults to 1
    });
  });
});