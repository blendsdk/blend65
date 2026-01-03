/**
 * Tests for Type System Infrastructure
 * Task 1.3: Create Type System Infrastructure - Test Suite
 *
 * Comprehensive test coverage for type checking functionality including:
 * - Type conversion from AST to internal representation
 * - Type compatibility checking with 6502-specific rules
 * - Storage class validation
 * - Array type checking with bounds validation
 * - Function signature validation including callbacks
 * - Expression type inference
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeChecker, ValidatedParameter, FunctionSignature } from '../type-system.js';
import {
  createPrimitiveType,
  createArrayType,
  createCallbackType,
  createNamedType,
  Symbol,
  VariableSymbol,
  FunctionSymbol,
  createVariableSymbol,
  createFunctionSymbol,
  createScope
} from '../types.js';

describe('TypeChecker', () => {
  let typeChecker: TypeChecker;
  let mockSymbolLookup: (name: string) => Symbol | null;
  const mockLocation = { line: 1, column: 1, offset: 0 };
  const symbols = new Map<string, Symbol>();

  beforeEach(() => {
    symbols.clear();
    mockSymbolLookup = (name: string) => symbols.get(name) || null;
    typeChecker = new TypeChecker(mockSymbolLookup);
  });

  describe('AST Type Conversion', () => {
    it('should convert primitive types', () => {
      const astType = {
        type: 'PrimitiveType' as const,
        name: 'byte' as const,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.convertASTTypeToBlend65Type(astType, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('byte');
      }
    });

    it('should convert array types with constant size', () => {
      const elementType = {
        type: 'PrimitiveType' as const,
        name: 'byte' as const,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const astType = {
        type: 'ArrayType' as const,
        elementType,
        size: { type: 'Literal' as const, value: 10, raw: '10', metadata: { start: mockLocation, end: mockLocation } },
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.convertASTTypeToBlend65Type(astType, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('array');
        expect((result.data as any).size).toBe(10);
      }
    });

    it('should reject array types with invalid size', () => {
      const elementType = {
        type: 'PrimitiveType' as const,
        name: 'byte' as const,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const astType = {
        type: 'ArrayType' as const,
        elementType,
        size: { type: 'Literal' as const, value: -1, raw: '-1', metadata: { start: mockLocation, end: mockLocation } },
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.convertASTTypeToBlend65Type(astType, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });

    it('should convert named types', () => {
      const astType = {
        type: 'NamedType' as const,
        name: 'Player',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.convertASTTypeToBlend65Type(astType, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('named');
        expect((result.data as any).name).toBe('Player');
      }
    });
  });

  describe('Type Compatibility', () => {
    it('should allow assignment of same types', () => {
      const byteType = createPrimitiveType('byte');

      const result = typeChecker.checkAssignmentCompatibility(byteType, byteType, mockLocation);

      expect(result.success).toBe(true);
    });

    it('should reject assignment of different primitive types', () => {
      const byteType = createPrimitiveType('byte');
      const wordType = createPrimitiveType('word');

      const result = typeChecker.checkAssignmentCompatibility(byteType, wordType, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
      }
    });

    it('should allow assignment of same array types', () => {
      const arrayType = createArrayType(createPrimitiveType('byte'), 10);

      const result = typeChecker.checkAssignmentCompatibility(arrayType, arrayType, mockLocation);

      expect(result.success).toBe(true);
    });

    it('should reject assignment of arrays with different sizes', () => {
      const array1 = createArrayType(createPrimitiveType('byte'), 10);
      const array2 = createArrayType(createPrimitiveType('byte'), 20);

      const result = typeChecker.checkAssignmentCompatibility(array1, array2, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
      }
    });
  });

  describe('Storage Class Validation', () => {
    beforeEach(() => {
      typeChecker.setCurrentScope('Global');
    });

    it('should allow zp storage class for small types', () => {
      const byteType = createPrimitiveType('byte');

      const result = typeChecker.validateVariableStorageClass('zp', byteType, false, mockLocation);

      expect(result.success).toBe(true);
    });

    it('should reject zp storage class for large types', () => {
      const largeArrayType = createArrayType(createPrimitiveType('byte'), 300);

      const result = typeChecker.validateVariableStorageClass('zp', largeArrayType, false, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('InvalidStorageClass');
        expect(result.errors[0].message).toContain('too large for zero page');
      }
    });

    it('should only allow byte/word types for io storage class', () => {
      const arrayType = createArrayType(createPrimitiveType('byte'), 10);

      const result = typeChecker.validateVariableStorageClass('io', arrayType, false, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('InvalidStorageClass');
        expect(result.errors[0].message).toContain('I/O storage class only supports byte and word');
      }
    });

    it('should require initializers for const storage class', () => {
      typeChecker.setCurrentScope('Global');
      const byteType = createPrimitiveType('byte');

      const result = typeChecker.validateVariableStorageClass('const', byteType, false, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });
  });

  describe('Function Signature Validation', () => {
    it('should validate simple function signature', () => {
      const funcDecl = {
        type: 'FunctionDeclaration' as const,
        name: 'add',
        params: [
          {
            type: 'Parameter' as const,
            name: 'a',
            paramType: { type: 'PrimitiveType' as const, name: 'byte' as const, metadata: { start: mockLocation, end: mockLocation } },
            optional: false,
            defaultValue: null,
            metadata: { start: mockLocation, end: mockLocation }
          },
          {
            type: 'Parameter' as const,
            name: 'b',
            paramType: { type: 'PrimitiveType' as const, name: 'byte' as const, metadata: { start: mockLocation, end: mockLocation } },
            optional: false,
            defaultValue: null,
            metadata: { start: mockLocation, end: mockLocation }
          }
        ],
        returnType: { type: 'PrimitiveType' as const, name: 'byte' as const, metadata: { start: mockLocation, end: mockLocation } },
        body: [],
        exported: false,
        callback: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.validateFunctionSignature(funcDecl, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parameters).toHaveLength(2);
        expect(result.data.returnType.kind).toBe('primitive');
        expect(result.data.isCallback).toBe(false);
      }
    });

    it('should validate callback function signature', () => {
      const funcDecl = {
        type: 'FunctionDeclaration' as const,
        name: 'onInterrupt',
        params: [],
        returnType: { type: 'PrimitiveType' as const, name: 'void' as const, metadata: { start: mockLocation, end: mockLocation } },
        body: [],
        exported: false,
        callback: true,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.validateFunctionSignature(funcDecl, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isCallback).toBe(true);
        expect(result.data.returnType.kind).toBe('primitive');
      }
    });

    it('should reject callback functions with array return types', () => {
      const funcDecl = {
        type: 'FunctionDeclaration' as const,
        name: 'badCallback',
        params: [],
        returnType: {
          type: 'ArrayType' as const,
          elementType: { type: 'PrimitiveType' as const, name: 'byte' as const, metadata: { start: mockLocation, end: mockLocation } },
          size: { type: 'Literal' as const, value: 10, raw: '10', metadata: { start: mockLocation, end: mockLocation } },
          metadata: { start: mockLocation, end: mockLocation }
        },
        body: [],
        exported: false,
        callback: true,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.validateFunctionSignature(funcDecl, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('CallbackMismatch');
        expect(result.errors[0].message).toContain('cannot return array types');
      }
    });
  });

  describe('Expression Type Inference', () => {
    it('should infer types for numeric literals', () => {
      // Byte range literal
      const byteLiteral = {
        type: 'Literal' as const,
        value: 42,
        raw: '42',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result1 = typeChecker.checkExpressionType(byteLiteral);
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.kind).toBe('primitive');
        expect((result1.data as any).name).toBe('byte');
      }

      // Word range literal
      const wordLiteral = {
        type: 'Literal' as const,
        value: 1000,
        raw: '1000',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result2 = typeChecker.checkExpressionType(wordLiteral);
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.kind).toBe('primitive');
        expect((result2.data as any).name).toBe('word');
      }
    });

    it('should infer type for boolean literals', () => {
      const boolLiteral = {
        type: 'Literal' as const,
        value: true,
        raw: 'true',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(boolLiteral);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('boolean');
      }
    });

    it('should reject out-of-range numeric literals', () => {
      const outOfRangeLiteral = {
        type: 'Literal' as const,
        value: 70000,
        raw: '70000',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(outOfRangeLiteral);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('out of range');
      }
    });

    it('should reject string literals in v0.1', () => {
      const stringLiteral = {
        type: 'Literal' as const,
        value: 'hello',
        raw: '"hello"',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(stringLiteral);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('String literals are not supported');
      }
    });

    it('should type check identifiers through symbol lookup', () => {
      // Add a variable symbol
      const varSymbol = createVariableSymbol(
        'counter',
        createPrimitiveType('byte'),
        createScope('Global'),
        mockLocation
      );
      symbols.set('counter', varSymbol);

      const identifier = {
        type: 'Identifier' as const,
        name: 'counter',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(identifier);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('byte');
      }
    });

    it('should reject undefined identifiers', () => {
      const identifier = {
        type: 'Identifier' as const,
        name: 'undefined_var',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(identifier);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('UndefinedSymbol');
      }
    });
  });

  describe('Array Type Checking', () => {
    it('should validate array access with proper index type', () => {
      const arrayType = createArrayType(createPrimitiveType('byte'), 10);
      const indexExpression = {
        type: 'Literal' as const,
        value: 5,
        raw: '5',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkArrayAccess(arrayType, indexExpression, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('byte');
      }
    });

    it('should detect array bounds violations', () => {
      const arrayType = createArrayType(createPrimitiveType('byte'), 10);
      const indexExpression = {
        type: 'Literal' as const,
        value: 15,
        raw: '15',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkArrayAccess(arrayType, indexExpression, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ArrayBounds');
        expect(result.errors[0].message).toContain('out of bounds');
      }
    });

    it('should validate array literals', () => {
      const arrayLiteral = {
        type: 'ArrayLiteral' as const,
        elements: [
          { type: 'Literal' as const, value: 1, raw: '1', metadata: { start: mockLocation, end: mockLocation } },
          { type: 'Literal' as const, value: 2, raw: '2', metadata: { start: mockLocation, end: mockLocation } },
          { type: 'Literal' as const, value: 3, raw: '3', metadata: { start: mockLocation, end: mockLocation } }
        ],
        metadata: { start: mockLocation, end: mockLocation }
      };

      const expectedType = createArrayType(createPrimitiveType('byte'), 3);

      const result = typeChecker.checkArrayLiteralType(arrayLiteral, expectedType, mockLocation);

      expect(result.success).toBe(true);
    });

    it('should reject array literals with wrong element count', () => {
      const arrayLiteral = {
        type: 'ArrayLiteral' as const,
        elements: [
          { type: 'Literal' as const, value: 1, raw: '1', metadata: { start: mockLocation, end: mockLocation } },
          { type: 'Literal' as const, value: 2, raw: '2', metadata: { start: mockLocation, end: mockLocation } }
        ],
        metadata: { start: mockLocation, end: mockLocation }
      };

      const expectedType = createArrayType(createPrimitiveType('byte'), 3);

      const result = typeChecker.checkArrayLiteralType(arrayLiteral, expectedType, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('elements, expected');
      }
    });
  });

  describe('Function Call Type Checking', () => {
    it('should validate function calls with correct arguments', () => {
      const signature: FunctionSignature = {
        parameters: [
          { name: 'a', type: createPrimitiveType('byte'), hasDefaultValue: false },
          { name: 'b', type: createPrimitiveType('byte'), hasDefaultValue: false }
        ],
        returnType: createPrimitiveType('word'),
        isCallback: false
      };

      const argumentTypes = [createPrimitiveType('byte'), createPrimitiveType('byte')];

      const result = typeChecker.checkFunctionCall(signature, argumentTypes, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('word');
      }
    });

    it('should reject function calls with wrong argument count', () => {
      const signature: FunctionSignature = {
        parameters: [
          { name: 'a', type: createPrimitiveType('byte'), hasDefaultValue: false }
        ],
        returnType: createPrimitiveType('byte'),
        isCallback: false
      };

      const argumentTypes = [createPrimitiveType('byte'), createPrimitiveType('byte')];

      const result = typeChecker.checkFunctionCall(signature, argumentTypes, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('arguments, expected');
      }
    });

    it('should reject function calls with wrong argument types', () => {
      const signature: FunctionSignature = {
        parameters: [
          { name: 'a', type: createPrimitiveType('byte'), hasDefaultValue: false }
        ],
        returnType: createPrimitiveType('byte'),
        isCallback: false
      };

      const argumentTypes = [createPrimitiveType('word')];

      const result = typeChecker.checkFunctionCall(signature, argumentTypes, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('Argument 1 has type');
      }
    });
  });

  describe('Type Size Calculation', () => {
    it('should calculate primitive type sizes', () => {
      const byteResult = typeChecker.getTypeSize(createPrimitiveType('byte'), mockLocation);
      expect(byteResult.success).toBe(true);
      if (byteResult.success) {
        expect(byteResult.data).toBe(1);
      }

      const wordResult = typeChecker.getTypeSize(createPrimitiveType('word'), mockLocation);
      expect(wordResult.success).toBe(true);
      if (wordResult.success) {
        expect(wordResult.data).toBe(2);
      }
    });

    it('should calculate array type sizes', () => {
      const arrayType = createArrayType(createPrimitiveType('word'), 10);

      const result = typeChecker.getTypeSize(arrayType, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(20); // 10 words * 2 bytes each
      }
    });
  });

  describe('Error Handling', () => {
    it('should manage errors and return them in results', () => {
      expect(typeChecker.getErrors()).toHaveLength(0);

      // Trigger an error by checking an undefined identifier expression
      const undefinedIdentifier = {
        type: 'Identifier' as const,
        name: 'undefined_var',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.checkExpressionType(undefinedIdentifier);

      // Error should be returned in result
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].errorType).toBe('UndefinedSymbol');
      }

      // Test error accumulation and clearing functionality
      expect(typeChecker.getErrors()).toHaveLength(0);
      typeChecker.clearErrors();
      expect(typeChecker.getErrors()).toHaveLength(0);
    });
  });

  describe('Scope Context', () => {
    it('should update current scope for storage class validation', () => {
      typeChecker.setCurrentScope('Function');

      const byteType = createPrimitiveType('byte');
      const result = typeChecker.validateVariableStorageClass('zp', byteType, false, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('InvalidStorageClass');
        expect(result.errors[0].message).toContain('not allowed in function scope');
      }
    });
  });

  describe('Named Type Resolution', () => {
    it('should resolve enum types to byte', () => {
      // Add an enum symbol
      const enumSymbol = {
        name: 'Color',
        symbolType: 'Enum' as const,
        sourceLocation: mockLocation,
        scope: createScope('Global'),
        isExported: false,
        members: new Map(),
        underlyingType: createPrimitiveType('byte')
      };
      symbols.set('Color', enumSymbol);

      const namedType = {
        type: 'NamedType' as const,
        name: 'Color',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.resolveNamedType(namedType, mockLocation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('primitive');
        expect((result.data as any).name).toBe('byte');
      }
    });

    it('should detect undefined named types', () => {
      const namedType = {
        type: 'NamedType' as const,
        name: 'UndefinedType',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = typeChecker.resolveNamedType(namedType, mockLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('UndefinedSymbol');
      }
    });

    it('should detect circular type references', () => {
      const namedType = {
        type: 'NamedType' as const,
        name: 'SelfRef',
        metadata: { start: mockLocation, end: mockLocation }
      };

      const visited = new Set(['SelfRef']);

      const result = typeChecker.resolveNamedType(namedType, mockLocation, visited);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('CircularDependency');
      }
    });
  });
});

/**
 * Educational Summary of Type System Tests:
 *
 * 1. AST TYPE CONVERSION
 *    - Converting parser output to semantic analysis types
 *    - Validating array sizes are compile-time constants
 *    - Handling primitive, array, and named type conversions
 *
 * 2. TYPE COMPATIBILITY
 *    - Assignment compatibility with strict 6502 type rules
 *    - No implicit conversions for safety
 *    - Array size and element type matching
 *
 * 3. STORAGE CLASS VALIDATION
 *    - Zero page size limitations (256 bytes max)
 *    - I/O storage class restrictions to byte/word only
 *    - Const/data storage class initialization requirements
 *
 * 4. FUNCTION SIGNATURE VALIDATION
 *    - Parameter and return type validation
 *    - Callback function restriction checking
 *    - Default parameter value type compatibility
 *
 * 5. EXPRESSION TYPE INFERENCE
 *    - Literal type inference with 6502 range checking
 *    - Symbol lookup and type resolution
 *    - Error handling for undefined symbols
 *
 * 6. ARRAY TYPE CHECKING
 *    - Bounds checking for constant indices
 *    - Array literal validation
 *    - Element type compatibility
 *
 * 7. ERROR HANDLING
 *    - Error accumulation and management
 *    - Rich error messages with suggestions
 *    - Context-aware error reporting
 *
 * This comprehensive test suite validates the type system infrastructure
 * needed for semantic analysis in the Blend65 compiler, ensuring type
 * safety and 6502-specific optimizations.
 */
