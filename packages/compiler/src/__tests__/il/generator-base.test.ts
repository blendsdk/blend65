/**
 * IL Generator Base Tests
 *
 * Tests for the ILGeneratorBase class which provides:
 * - Type conversion from semantic types to IL types
 * - Type annotation parsing
 * - Storage class conversion
 * - Error handling utilities
 * - Numeric type utilities
 *
 * @module __tests__/il/generator-base.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ILGeneratorBase,
  ILErrorSeverity,
  type ILGeneratorError,
} from '../../il/generator/base.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { TypeKind, type TypeInfo } from '../../semantic/types.js';
import { StorageClass } from '../../semantic/symbol.js';
import {
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  ILTypeKind,
} from '../../il/types.js';
import { ILStorageClass } from '../../il/function.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a minimal TypeInfo for testing.
 *
 * @param kind - Type kind
 * @param options - Additional type options
 * @returns TypeInfo object
 */
function createTypeInfo(
  kind: TypeKind,
  options: Partial<TypeInfo> = {},
): TypeInfo {
  return {
    kind,
    name: kind.toString(),
    size: 1,
    isSigned: false,
    isAssignable: true,
    ...options,
  };
}

// =============================================================================
// Type Conversion Tests
// =============================================================================

describe('ILGeneratorBase', () => {
  let generator: ILGeneratorBase;
  let symbolTable: GlobalSymbolTable;

  beforeEach(() => {
    symbolTable = new GlobalSymbolTable();
    generator = new ILGeneratorBase(symbolTable);
  });

  describe('convertType()', () => {
    describe('primitive types', () => {
      it('should convert Void type to IL_VOID', () => {
        const typeInfo = createTypeInfo(TypeKind.Void);
        const result = generator.convertType(typeInfo);
        expect(result).toBe(IL_VOID);
        expect(result.kind).toBe(ILTypeKind.Void);
      });

      it('should convert Boolean type to IL_BOOL', () => {
        const typeInfo = createTypeInfo(TypeKind.Boolean);
        const result = generator.convertType(typeInfo);
        expect(result).toBe(IL_BOOL);
        expect(result.kind).toBe(ILTypeKind.Bool);
      });

      it('should convert Byte type to IL_BYTE', () => {
        const typeInfo = createTypeInfo(TypeKind.Byte);
        const result = generator.convertType(typeInfo);
        expect(result).toBe(IL_BYTE);
        expect(result.kind).toBe(ILTypeKind.Byte);
      });

      it('should convert Word type to IL_WORD', () => {
        const typeInfo = createTypeInfo(TypeKind.Word);
        const result = generator.convertType(typeInfo);
        expect(result).toBe(IL_WORD);
        expect(result.kind).toBe(ILTypeKind.Word);
      });
    });

    describe('string type', () => {
      it('should convert String type to pointer to byte', () => {
        const typeInfo = createTypeInfo(TypeKind.String);
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Pointer);
        expect(result.sizeInBytes).toBe(2); // Pointer is 2 bytes
      });
    });

    describe('array types', () => {
      it('should convert array type with element type and size', () => {
        const typeInfo = createTypeInfo(TypeKind.Array, {
          elementType: createTypeInfo(TypeKind.Byte),
          arraySize: 10,
        });
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Array);
        expect(result.sizeInBytes).toBe(10); // byte[10] = 10 bytes
      });

      it('should convert array type with word elements', () => {
        const typeInfo = createTypeInfo(TypeKind.Array, {
          elementType: createTypeInfo(TypeKind.Word),
          arraySize: 5,
        });
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Array);
        expect(result.sizeInBytes).toBe(10); // word[5] = 10 bytes
      });

      it('should convert dynamic array type (null size)', () => {
        const typeInfo = createTypeInfo(TypeKind.Array, {
          elementType: createTypeInfo(TypeKind.Byte),
          arraySize: undefined,
        });
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Array);
      });

      it('should handle array type without element type (fallback)', () => {
        const typeInfo = createTypeInfo(TypeKind.Array, {
          elementType: undefined,
          arraySize: 10,
        });
        const result = generator.convertType(typeInfo);
        // Should fallback to byte array and add error
        expect(result.kind).toBe(ILTypeKind.Array);
        expect(generator.hasErrors()).toBe(true);
      });
    });

    describe('callback types', () => {
      it('should convert callback type with signature', () => {
        const typeInfo = createTypeInfo(TypeKind.Callback, {
          signature: {
            parameters: [createTypeInfo(TypeKind.Byte)],
            returnType: createTypeInfo(TypeKind.Word),
          },
        });
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Function);
        expect(result.sizeInBytes).toBe(2); // Function pointer
      });

      it('should convert callback type without parameters', () => {
        const typeInfo = createTypeInfo(TypeKind.Callback, {
          signature: {
            parameters: [],
            returnType: createTypeInfo(TypeKind.Void),
          },
        });
        const result = generator.convertType(typeInfo);
        expect(result.kind).toBe(ILTypeKind.Function);
      });

      it('should handle callback type without signature (fallback)', () => {
        const typeInfo = createTypeInfo(TypeKind.Callback, {
          signature: undefined,
        });
        const result = generator.convertType(typeInfo);
        // Should fallback to void function and add error
        expect(result.kind).toBe(ILTypeKind.Function);
        expect(generator.hasErrors()).toBe(true);
      });
    });

    describe('unknown types', () => {
      it('should convert Unknown type to IL_VOID with warning', () => {
        const typeInfo = createTypeInfo(TypeKind.Unknown);
        const result = generator.convertType(typeInfo);
        expect(result).toBe(IL_VOID);
        // Should add a warning
        const errors = generator.getErrors();
        expect(errors.some((e) => e.severity === ILErrorSeverity.Warning)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Type Annotation Conversion Tests
  // ===========================================================================

  describe('convertTypeAnnotation()', () => {
    describe('primitive type annotations', () => {
      it('should convert "void" annotation', () => {
        const result = generator.convertTypeAnnotation('void');
        expect(result).toBe(IL_VOID);
      });

      it('should convert "bool" annotation', () => {
        const result = generator.convertTypeAnnotation('bool');
        expect(result).toBe(IL_BOOL);
      });

      it('should convert "boolean" annotation', () => {
        const result = generator.convertTypeAnnotation('boolean');
        expect(result).toBe(IL_BOOL);
      });

      it('should convert "byte" annotation', () => {
        const result = generator.convertTypeAnnotation('byte');
        expect(result).toBe(IL_BYTE);
      });

      it('should convert "u8" annotation', () => {
        const result = generator.convertTypeAnnotation('u8');
        expect(result).toBe(IL_BYTE);
      });

      it('should convert "word" annotation', () => {
        const result = generator.convertTypeAnnotation('word');
        expect(result).toBe(IL_WORD);
      });

      it('should convert "u16" annotation', () => {
        const result = generator.convertTypeAnnotation('u16');
        expect(result).toBe(IL_WORD);
      });

      it('should handle case insensitivity', () => {
        expect(generator.convertTypeAnnotation('BYTE')).toBe(IL_BYTE);
        expect(generator.convertTypeAnnotation('Word')).toBe(IL_WORD);
        expect(generator.convertTypeAnnotation('BOOL')).toBe(IL_BOOL);
      });
    });

    describe('array type annotations', () => {
      it('should convert "byte[10]" annotation', () => {
        const result = generator.convertTypeAnnotation('byte[10]');
        expect(result.kind).toBe(ILTypeKind.Array);
        expect(result.sizeInBytes).toBe(10);
      });

      it('should convert "word[5]" annotation', () => {
        const result = generator.convertTypeAnnotation('word[5]');
        expect(result.kind).toBe(ILTypeKind.Array);
        expect(result.sizeInBytes).toBe(10); // 5 * 2 bytes
      });

      it('should convert "byte[]" annotation (dynamic array)', () => {
        const result = generator.convertTypeAnnotation('byte[]');
        expect(result.kind).toBe(ILTypeKind.Array);
      });

      it('should convert "word[]" annotation (dynamic array)', () => {
        const result = generator.convertTypeAnnotation('word[]');
        expect(result.kind).toBe(ILTypeKind.Array);
      });
    });

    describe('unknown type annotations', () => {
      it('should default unknown annotations to byte', () => {
        const result = generator.convertTypeAnnotation('unknown_type');
        expect(result).toBe(IL_BYTE);
      });
    });
  });

  // ===========================================================================
  // Storage Class Conversion Tests
  // ===========================================================================

  describe('convertStorageClass()', () => {
    it('should convert ZeroPage storage class', () => {
      const result = generator.convertStorageClass(StorageClass.ZeroPage);
      expect(result).toBe(ILStorageClass.ZeroPage);
    });

    it('should convert RAM storage class', () => {
      const result = generator.convertStorageClass(StorageClass.RAM);
      expect(result).toBe(ILStorageClass.Ram);
    });

    it('should convert Data storage class', () => {
      const result = generator.convertStorageClass(StorageClass.Data);
      expect(result).toBe(ILStorageClass.Data);
    });

    it('should convert Map storage class', () => {
      const result = generator.convertStorageClass(StorageClass.Map);
      expect(result).toBe(ILStorageClass.Map);
    });

    it('should default undefined storage class to RAM', () => {
      const result = generator.convertStorageClass(undefined);
      expect(result).toBe(ILStorageClass.Ram);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should start with no errors', () => {
      expect(generator.getErrors()).toHaveLength(0);
      expect(generator.hasErrors()).toBe(false);
    });

    it('should collect errors', () => {
      // Trigger an error by converting a malformed type
      generator.convertType(createTypeInfo(TypeKind.Array, {
        elementType: undefined,
        arraySize: 10,
      }));

      expect(generator.hasErrors()).toBe(true);
      expect(generator.getErrorsOnly()).toHaveLength(1);
    });

    it('should collect warnings separately from errors', () => {
      // Trigger a warning by converting unknown type
      generator.convertType(createTypeInfo(TypeKind.Unknown));

      const allErrors = generator.getErrors();
      const errorsOnly = generator.getErrorsOnly();

      expect(allErrors.length).toBeGreaterThan(0);
      expect(errorsOnly).toHaveLength(0);
      expect(generator.hasErrors()).toBe(false);
    });

    it('should include error codes when provided', () => {
      // Trigger an error with code
      generator.convertType(createTypeInfo(TypeKind.Array, {
        elementType: undefined,
        arraySize: 10,
      }));

      const errors = generator.getErrors();
      expect(errors[0].code).toBe('E_MALFORMED_TYPE');
    });

    it('should include error severity', () => {
      // Trigger both error and warning
      generator.convertType(createTypeInfo(TypeKind.Array, {
        elementType: undefined,
      }));
      generator.convertType(createTypeInfo(TypeKind.Unknown));

      const errors = generator.getErrors();
      const hasError = errors.some((e) => e.severity === ILErrorSeverity.Error);
      const hasWarning = errors.some((e) => e.severity === ILErrorSeverity.Warning);

      expect(hasError).toBe(true);
      expect(hasWarning).toBe(true);
    });
  });

  // ===========================================================================
  // ILErrorSeverity Enum Tests
  // ===========================================================================

  describe('ILErrorSeverity', () => {
    it('should have Info severity', () => {
      expect(ILErrorSeverity.Info).toBe('info');
    });

    it('should have Warning severity', () => {
      expect(ILErrorSeverity.Warning).toBe('warning');
    });

    it('should have Error severity', () => {
      expect(ILErrorSeverity.Error).toBe('error');
    });
  });
});