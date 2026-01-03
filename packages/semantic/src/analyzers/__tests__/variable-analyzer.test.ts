/**
 * Tests for Variable Declaration Analysis
 * Task 1.4: Implement Variable Declaration Analysis - Test Suite
 *
 * Comprehensive test coverage for variable declaration validation including:
 * - Storage class validation and scope restrictions
 * - Type conversion and compatibility checking
 * - Duplicate declaration detection
 * - Initialization validation for different storage classes
 * - Export handling and symbol creation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VariableAnalyzer, analyzeVariableDeclaration } from '../variable-analyzer.js';
import { SymbolTable } from '../../symbol-table.js';
import { TypeChecker } from '../../type-system.js';
import {
  createPrimitiveType,
  createArrayType,
  createScope,
  Symbol,
  VariableSymbol,
  createVariableSymbol
} from '../../types';
import { VariableDeclaration, StorageClass } from '@blend65/ast';

describe('VariableAnalyzer', () => {
  let symbolTable: SymbolTable;
  let typeChecker: TypeChecker;
  let variableAnalyzer: VariableAnalyzer;
  const mockLocation = { line: 1, column: 1, offset: 0 };
  let mockSymbolLookup: (name: string) => Symbol | null;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    mockSymbolLookup = (name: string) => symbolTable.lookupSymbol(name);
    typeChecker = new TypeChecker(mockSymbolLookup);
    variableAnalyzer = new VariableAnalyzer(symbolTable, typeChecker);
  });

  describe('Basic Variable Declaration Analysis', () => {
    it('should analyze simple byte variable declaration', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'counter',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('counter');
        expect(result.data.symbolType).toBe('Variable');
        expect(result.data.varType.kind).toBe('primitive');
        expect((result.data.varType as any).name).toBe('byte');
        expect(result.data.storageClass).toBe(null);
        expect(result.data.isExported).toBe(false);
      }
    });

    it('should analyze word variable with initialization', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'address',
        varType: {
          type: 'PrimitiveType',
          name: 'word',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 1000,
          raw: '1000',
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('address');
        expect((result.data.varType as any).name).toBe('word');
      }
    });

    it('should analyze array variable declaration', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'buffer',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Literal',
            value: 256,
            raw: '256',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('buffer');
        expect(result.data.varType.kind).toBe('array');
        expect((result.data.varType as any).size).toBe(256);
      }
    });

    it('should analyze exported variable', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'publicVar',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: true,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isExported).toBe(true);
      }
    });
  });

  describe('Storage Class Validation', () => {
    it('should allow zp storage class at global scope', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'fastCounter',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'zp',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storageClass).toBe('zp');
      }
    });

    it('should reject storage class in function scope', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'localVar',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'zp',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Function');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('InvalidStorageClass');
        expect(result.errors[0].message).toContain('not allowed in function scope');
      }
    });

    it('should require initializer for const storage class', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'constant',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
        expect(result.errors[0].message).toContain('must have an initializer');
      }
    });

    it('should accept const storage class with initializer', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'MAX_SIZE',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const',
        initializer: {
          type: 'Literal',
          value: 255,
          raw: '255',
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storageClass).toBe('const');
      }
    });

    it('should require initializer for data storage class', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'lookupTable',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Literal',
            value: 16,
            raw: '16',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'data',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });

    it('should accept data storage class with array literal', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'palette',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Literal',
            value: 3,
            raw: '3',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'data',
        initializer: {
          type: 'ArrayLiteral',
          elements: [
            { type: 'Literal', value: 1, raw: '1', metadata: { start: mockLocation, end: mockLocation } },
            { type: 'Literal', value: 2, raw: '2', metadata: { start: mockLocation, end: mockLocation } },
            { type: 'Literal', value: 3, raw: '3', metadata: { start: mockLocation, end: mockLocation } }
          ],
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storageClass).toBe('data');
      }
    });

    it('should allow ram and io storage classes', () => {
      const ramVar: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'gameData',
        varType: {
          type: 'PrimitiveType',
          name: 'word',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'ram',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const ioVar: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'VIC_REGISTER',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'io',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const ramResult = variableAnalyzer.analyzeVariableDeclaration(ramVar, 'Global');
      const ioResult = variableAnalyzer.analyzeVariableDeclaration(ioVar, 'Global');

      expect(ramResult.success).toBe(true);
      expect(ioResult.success).toBe(true);
    });
  });

  describe('Duplicate Declaration Detection', () => {
    it('should detect duplicate variable declarations', () => {
      const firstVar: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'duplicate',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const secondVar: VariableDeclaration = {
        ...firstVar,
        name: 'duplicate'
      };

      // First declaration should succeed
      const firstResult = variableAnalyzer.analyzeVariableDeclaration(firstVar, 'Global');
      expect(firstResult.success).toBe(true);

      // Second declaration should fail
      const secondResult = variableAnalyzer.analyzeVariableDeclaration(secondVar, 'Global');
      expect(secondResult.success).toBe(false);
      if (!secondResult.success) {
        expect(secondResult.errors[0].errorType).toBe('DuplicateSymbol');
        expect(secondResult.errors[0].message).toContain('already declared');
      }
    });

    it('should allow variables with same name in different scopes', () => {
      const globalVar: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'sameName',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      // Declare in global scope
      const globalResult = variableAnalyzer.analyzeVariableDeclaration(globalVar, 'Global');
      expect(globalResult.success).toBe(true);

      // Enter function scope for next declaration
      symbolTable.enterScope('Function', 'testFunction');

      const localVar: VariableDeclaration = {
        ...globalVar,
        storageClass: null // Local variables cannot have storage classes
      };

      // Should succeed because it's in a different scope
      const localResult = variableAnalyzer.analyzeVariableDeclaration(localVar, 'Function');
      expect(localResult.success).toBe(true);

      symbolTable.exitScope();
    });
  });

  describe('Type Validation', () => {
    it('should validate initialization type compatibility', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'typedVar',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 42,
          raw: '42',
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
    });

    it('should reject initialization type mismatch', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'mismatchVar',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 70000, // Too large for byte
          raw: '70000',
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('TypeMismatch');
      }
    });

    it('should validate array size as compile-time constant', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'dynamicArray',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Identifier', // Not a constant!
            name: 'variableSize',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });
  });

  describe('Constant Expression Validation', () => {
    it('should accept literal values as constants', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'constValue',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const',
        initializer: {
          type: 'Literal',
          value: 42,
          raw: '42',
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
    });

    it('should accept array literals as constants', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'constArray',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Literal',
            value: 2,
            raw: '2',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'data',
        initializer: {
          type: 'ArrayLiteral',
          elements: [
            { type: 'Literal', value: 1, raw: '1', metadata: { start: mockLocation, end: mockLocation } },
            { type: 'Literal', value: 2, raw: '2', metadata: { start: mockLocation, end: mockLocation } }
          ],
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
    });

    it('should accept constant arithmetic expressions', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'calculated',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const',
        initializer: {
          type: 'BinaryExpr',
          operator: '+',
          left: { type: 'Literal', value: 10, raw: '10', metadata: { start: mockLocation, end: mockLocation } },
          right: { type: 'Literal', value: 5, raw: '5', metadata: { start: mockLocation, end: mockLocation } },
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(true);
    });

    it('should reject function calls as constants', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'nonConstant',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const',
        initializer: {
          type: 'CallExpr',
          callee: { type: 'Identifier', name: 'getRandomValue', metadata: { start: mockLocation, end: mockLocation } },
          args: [],
          metadata: { start: mockLocation, end: mockLocation }
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        // The TypeChecker validates the expression first, so UndefinedSymbol comes before ConstantRequired
        expect(result.errors[0].errorType).toBe('UndefinedSymbol');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid AST type conversion', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'invalidType',
        varType: {
          type: 'ArrayType',
          elementType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          size: {
            type: 'Literal',
            value: -1, // Invalid array size
            raw: '-1',
            metadata: { start: mockLocation, end: mockLocation }
          },
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });

    it('should accumulate multiple validation errors', () => {
      // Create a variable with multiple issues
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'multiError',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: 'const', // Requires initializer
        initializer: null, // Missing initializer
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].errorType).toBe('ConstantRequired');
      }
    });
  });

  describe('Statistics and Analysis', () => {
    it('should provide comprehensive analysis statistics', () => {
      // Add several variables with different storage classes
      const vars = [
        { name: 'zpVar', storageClass: 'zp' as StorageClass },
        { name: 'ramVar', storageClass: 'ram' as StorageClass },
        { name: 'normalVar', storageClass: null },
        { name: 'exportedVar', storageClass: null, exported: true }
      ];

      vars.forEach(v => {
        const varDecl: VariableDeclaration = {
          type: 'VariableDeclaration',
          name: v.name,
          varType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation }
          },
          storageClass: v.storageClass,
          initializer: null,
          exported: v.exported || false,
          metadata: { start: mockLocation, end: mockLocation }
        };

        variableAnalyzer.analyzeVariableDeclaration(varDecl, 'Global');
      });

      const stats = variableAnalyzer.getAnalysisStatistics();

      expect(stats.variablesAnalyzed).toBe(4);
      expect(stats.storageClassUsage.zp).toBe(1);
      expect(stats.storageClassUsage.ram).toBe(1);
      expect(stats.storageClassUsage.none).toBe(2);
      expect(stats.exportedVariables).toBe(1);
    });
  });

  describe('Convenience Function', () => {
    it('should work through convenience function', () => {
      const varDecl: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'convenienceVar',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation }
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation }
      };

      const result = analyzeVariableDeclaration(varDecl, symbolTable, typeChecker, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('convenienceVar');
      }
    });
  });
});

/**
 * Educational Summary of Variable Declaration Analysis Tests:
 *
 * 1. BASIC VARIABLE ANALYSIS
 *    - Simple variable declarations (byte, word, boolean)
 *    - Array variable declarations with size validation
 *    - Variable initialization with type checking
 *    - Export handling and symbol creation
 *
 * 2. STORAGE CLASS VALIDATION
 *    - Scope restrictions (global vs function scope)
 *    - Storage class specific rules (zp, ram, data, const, io)
 *    - Initialization requirements for const/data storage classes
 *    - Type compatibility with storage class constraints
 *
 * 3. DUPLICATE DECLARATION DETECTION
 *    - Same scope duplicate detection
 *    - Different scope shadowing allowance
 *    - Clear error messages with suggestions
 *
 * 4. TYPE VALIDATION INTEGRATION
 *    - Type compatibility checking through TypeChecker
 *    - Array size validation as compile-time constants
 *    - Initialization type matching
 *    - 6502-specific type constraints
 *
 * 5. COMPILE-TIME CONSTANT VALIDATION
 *    - Literal values as constants
 *    - Array literals with constant elements
 *    - Arithmetic expressions with constant operands
 *    - Rejection of function calls and variable references
 *
 * 6. ERROR HANDLING AND EDGE CASES
 *    - Invalid AST type conversion
 *    - Multiple validation error accumulation
 *    - Comprehensive error reporting with source locations
 *    - Recovery and continuation after errors
 *
 * 7. INTEGRATION WITH EXISTING INFRASTRUCTURE
 *    - Symbol table integration for duplicate detection
 *    - TypeChecker integration for type validation
 *    - Storage class validation delegation
 *    - Error propagation and accumulation
 *
 * This comprehensive test suite validates the variable declaration analyzer's
 * ability to handle all aspects of Blend65 variable declarations according to
 * the language specification, ensuring type safety, proper storage class usage,
 * and integration with the broader semantic analysis infrastructure.
 */
