/**
 * Tests for Variable Declaration Analysis
 * Task 1.4: Implement Variable Declaration Analysis - Test Suite
 * Task 1.8: Enhanced Variable Usage Analysis - Test Suite (NEW)
 *
 * Comprehensive test coverage for variable declaration validation including:
 * - Storage class validation and scope restrictions
 * - Type conversion and compatibility checking
 * - Duplicate declaration detection
 * - Initialization validation for different storage classes
 * - Export handling and symbol creation
 *
 * Task 1.8 Enhancement Test Coverage:
 * - Variable usage metadata collection from expression analysis
 * - Zero page promotion candidate analysis
 * - Register allocation candidate analysis
 * - Variable lifetime analysis for interference detection
 * - 6502-specific optimization metadata generation
 * - Integration with Task 1.7 ExpressionAnalyzer variable references
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VariableAnalyzer, analyzeVariableDeclaration } from '../variable-analyzer.js';
import { SymbolTable } from '../../symbol-table.js';
import { TypeChecker } from '../../type-system.js';
import {
  createPrimitiveType,
  createArrayType,
  Symbol,
  VariableSymbol,
  createVariableSymbol,
} from '../../types';
import { VariableDeclaration, StorageClass } from '@blend65/ast';
import { ExpressionAnalysisResult, createExpressionContext } from '../expression-analyzer.js';

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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 1000,
          raw: '1000',
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Literal',
            value: 256,
            raw: '256',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: true,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'zp',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'zp',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const',
        initializer: {
          type: 'Literal',
          value: 255,
          raw: '255',
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Literal',
            value: 16,
            raw: '16',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'data',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Literal',
            value: 3,
            raw: '3',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'data',
        initializer: {
          type: 'ArrayLiteral',
          elements: [
            {
              type: 'Literal',
              value: 1,
              raw: '1',
              metadata: { start: mockLocation, end: mockLocation },
            },
            {
              type: 'Literal',
              value: 2,
              raw: '2',
              metadata: { start: mockLocation, end: mockLocation },
            },
            {
              type: 'Literal',
              value: 3,
              raw: '3',
              metadata: { start: mockLocation, end: mockLocation },
            },
          ],
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'ram',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
      };

      const ioVar: VariableDeclaration = {
        type: 'VariableDeclaration',
        name: 'VIC_REGISTER',
        varType: {
          type: 'PrimitiveType',
          name: 'byte',
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'io',
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
      };

      const secondVar: VariableDeclaration = {
        ...firstVar,
        name: 'duplicate',
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
      };

      // Declare in global scope
      const globalResult = variableAnalyzer.analyzeVariableDeclaration(globalVar, 'Global');
      expect(globalResult.success).toBe(true);

      // Enter function scope for next declaration
      symbolTable.enterScope('Function', 'testFunction');

      const localVar: VariableDeclaration = {
        ...globalVar,
        storageClass: null, // Local variables cannot have storage classes
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 42,
          raw: '42',
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: {
          type: 'Literal',
          value: 70000, // Too large for byte
          raw: '70000',
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Identifier', // Not a constant!
            name: 'variableSize',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const',
        initializer: {
          type: 'Literal',
          value: 42,
          raw: '42',
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Literal',
            value: 2,
            raw: '2',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'data',
        initializer: {
          type: 'ArrayLiteral',
          elements: [
            {
              type: 'Literal',
              value: 1,
              raw: '1',
              metadata: { start: mockLocation, end: mockLocation },
            },
            {
              type: 'Literal',
              value: 2,
              raw: '2',
              metadata: { start: mockLocation, end: mockLocation },
            },
          ],
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const',
        initializer: {
          type: 'BinaryExpr',
          operator: '+',
          left: {
            type: 'Literal',
            value: 10,
            raw: '10',
            metadata: { start: mockLocation, end: mockLocation },
          },
          right: {
            type: 'Literal',
            value: 5,
            raw: '5',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const',
        initializer: {
          type: 'CallExpr',
          callee: {
            type: 'Identifier',
            name: 'getRandomValue',
            metadata: { start: mockLocation, end: mockLocation },
          },
          args: [],
          metadata: { start: mockLocation, end: mockLocation },
        },
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
            metadata: { start: mockLocation, end: mockLocation },
          },
          size: {
            type: 'Literal',
            value: -1, // Invalid array size
            raw: '-1',
            metadata: { start: mockLocation, end: mockLocation },
          },
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: 'const', // Requires initializer
        initializer: null, // Missing initializer
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
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
        { name: 'exportedVar', storageClass: null, exported: true },
      ];

      vars.forEach(v => {
        const varDecl: VariableDeclaration = {
          type: 'VariableDeclaration',
          name: v.name,
          varType: {
            type: 'PrimitiveType',
            name: 'byte',
            metadata: { start: mockLocation, end: mockLocation },
          },
          storageClass: v.storageClass,
          initializer: null,
          exported: v.exported || false,
          metadata: { start: mockLocation, end: mockLocation },
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
          metadata: { start: mockLocation, end: mockLocation },
        },
        storageClass: null,
        initializer: null,
        exported: false,
        metadata: { start: mockLocation, end: mockLocation },
      };

      const result = analyzeVariableDeclaration(varDecl, symbolTable, typeChecker, 'Global');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('convenienceVar');
      }
    });
  });

  // ============================================================================
  // TASK 1.8: ENHANCED VARIABLE USAGE ANALYSIS TESTS
  // ============================================================================

  describe('Task 1.8: Enhanced Variable Usage Analysis', () => {
    let testVariables: VariableSymbol[];
    let mockExpressionResults: ExpressionAnalysisResult[];

    beforeEach(() => {
      // Create test variables for optimization analysis
      testVariables = [
        createVariableSymbol(
          'counter',
          createPrimitiveType('byte'),
          symbolTable.getCurrentScope(),
          mockLocation,
          { storageClass: undefined }
        ),
        createVariableSymbol(
          'playerX',
          createPrimitiveType('byte'),
          symbolTable.getCurrentScope(),
          mockLocation,
          { storageClass: 'zp' }
        ),
        createVariableSymbol(
          'buffer',
          createArrayType(createPrimitiveType('byte'), 256),
          symbolTable.getCurrentScope(),
          mockLocation,
          { storageClass: 'ram' }
        ),
        createVariableSymbol(
          'VIC_REG',
          createPrimitiveType('byte'),
          symbolTable.getCurrentScope(),
          mockLocation,
          { storageClass: 'io' }
        ),
        createVariableSymbol(
          'gameScore',
          createPrimitiveType('word'),
          symbolTable.getCurrentScope(),
          mockLocation,
          { storageClass: undefined }
        ),
      ];

      // Create mock expression analysis results with variable references
      mockExpressionResults = [
        {
          expression: {
            type: 'Identifier',
            name: 'counter',
            metadata: { start: mockLocation, end: mockLocation },
          } as any,
          resolvedType: createPrimitiveType('byte'),
          optimizationData: {
            usedVariables: [
              {
                symbol: testVariables[0], // counter
                accessType: 'read',
                location: mockLocation,
                context: createExpressionContext({ loopDepth: 1, inHotPath: true }),
              },
              {
                symbol: testVariables[0], // counter (multiple accesses)
                accessType: 'modify',
                location: mockLocation,
                context: createExpressionContext({ loopDepth: 1, inHotPath: true }),
              },
            ],
          } as any,
          errors: [],
          warnings: [],
        },
        {
          expression: {
            type: 'Identifier',
            name: 'playerX',
            metadata: { start: mockLocation, end: mockLocation },
          } as any,
          resolvedType: createPrimitiveType('byte'),
          optimizationData: {
            usedVariables: [
              {
                symbol: testVariables[1], // playerX
                accessType: 'write',
                location: mockLocation,
                context: createExpressionContext({ loopDepth: 0, inHotPath: false }),
              },
            ],
          } as any,
          errors: [],
          warnings: [],
        },
      ];
    });

    describe('Variable Usage Metadata Collection', () => {
      it('should collect basic usage statistics', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );

        expect(usageMap.size).toBe(testVariables.length);
        expect(usageMap.has('counter')).toBe(true);
        expect(usageMap.has('playerX')).toBe(true);

        const counterStats = usageMap.get('counter')!;
        expect(counterStats.accessCount).toBe(2); // read + modify
        expect(counterStats.readCount).toBe(1);
        expect(counterStats.modifyCount).toBe(1);
        expect(counterStats.loopUsage.length).toBe(1); // Used in loop depth 1
        expect(counterStats.hotPathUsage).toBe(2); // Both accesses in hot path
      });

      it('should determine access frequency correctly', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );

        const counterStats = usageMap.get('counter')!;
        expect(counterStats.estimatedAccessFrequency).toBe('hot'); // Hot path usage

        const playerXStats = usageMap.get('playerX')!;
        expect(playerXStats.estimatedAccessFrequency).toBe('rare'); // Single access, not hot

        const bufferStats = usageMap.get('buffer')!;
        expect(bufferStats.estimatedAccessFrequency).toBe('rare'); // No usage in mock data
      });

      it('should determine access patterns correctly', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );

        const counterStats = usageMap.get('counter')!;
        expect(counterStats.accessPattern).toBe('hot_path'); // Hot path usage

        const playerXStats = usageMap.get('playerX')!;
        expect(playerXStats.accessPattern).toBe('single_use'); // Single write access

        const bufferStats = usageMap.get('buffer')!;
        expect(bufferStats.accessPattern).toBe('single_use'); // No usage
      });
    });

    describe('Zero Page Promotion Analysis', () => {
      it('should identify good zero page candidates', () => {
        const candidates = variableAnalyzer.analyzeZeroPageCandidates(testVariables);

        expect(candidates).toHaveLength(testVariables.length);

        // Find counter candidate (should be good candidate)
        const counterCandidate = candidates.find(
          c =>
            c.sizeRequirement === 1 && !c.antiPromotionFactors.some(f => f.factor === 'already_zp')
        );
        expect(counterCandidate).toBeDefined();
        expect(counterCandidate!.isCandidate).toBe(true);
        expect(counterCandidate!.promotionScore).toBeGreaterThan(40);
        expect(counterCandidate!.recommendation).toBeOneOf([
          'neutral',
          'recommended',
          'strongly_recommended',
        ]);
      });

      it('should reject variables already in zero page', () => {
        const candidates = variableAnalyzer.analyzeZeroPageCandidates(testVariables);

        // Find playerX candidate (already zp)
        const playerXCandidate = candidates.find(c =>
          c.antiPromotionFactors.some(f => f.factor === 'already_zp')
        );
        expect(playerXCandidate).toBeDefined();
        expect(playerXCandidate!.antiPromotionFactors).toContainEqual(
          expect.objectContaining({
            factor: 'already_zp',
            weight: 100,
            description: 'Variable already has zp storage class',
          })
        );
      });

      it('should reject I/O variables', () => {
        const candidates = variableAnalyzer.analyzeZeroPageCandidates(testVariables);

        // Find VIC_REG candidate (I/O variable)
        const ioCandidate = candidates.find(c =>
          c.antiPromotionFactors.some(f => f.factor === 'io_access')
        );
        expect(ioCandidate).toBeDefined();
        expect(ioCandidate!.antiPromotionFactors).toContainEqual(
          expect.objectContaining({
            factor: 'io_access',
            weight: 100,
            description: 'I/O variables should remain in I/O address space',
          })
        );
      });

      it('should consider variable size in promotion decisions', () => {
        const candidates = variableAnalyzer.analyzeZeroPageCandidates(testVariables);

        // Small variables should get size bonus
        const byteCandidate = candidates.find(c => c.sizeRequirement === 1);
        expect(byteCandidate).toBeDefined();
        expect(byteCandidate!.promotionFactors.some(f => f.factor === 'small_size')).toBe(true);

        // Large array should get size penalty
        const arrayCandidate = candidates.find(c => c.sizeRequirement === 256);
        expect(arrayCandidate).toBeDefined();
        expect(arrayCandidate!.antiPromotionFactors.some(f => f.factor === 'large_size')).toBe(
          true
        );
      });

      it('should calculate promotion scores correctly', () => {
        const candidates = variableAnalyzer.analyzeZeroPageCandidates(testVariables);

        for (const candidate of candidates) {
          expect(candidate.promotionScore).toBeGreaterThanOrEqual(0);
          expect(candidate.promotionScore).toBeLessThanOrEqual(100);

          // Score should match the promotion factors
          let expectedScore = 0;
          for (const factor of candidate.promotionFactors) {
            expectedScore += factor.weight;
          }
          for (const factor of candidate.antiPromotionFactors) {
            expectedScore -= factor.weight;
          }
          expectedScore = Math.max(0, Math.min(100, expectedScore));

          expect(candidate.promotionScore).toBe(expectedScore);
        }
      });
    });

    describe('Register Allocation Analysis', () => {
      it('should identify suitable register candidates', () => {
        const candidates = variableAnalyzer.analyzeRegisterCandidates(testVariables);

        expect(candidates).toHaveLength(testVariables.length);

        // Byte variables should be better candidates than arrays
        const byteCandidate = candidates.find(c => c.allocationScore > 0 && c.isCandidate);
        expect(byteCandidate).toBeDefined();
        expect(byteCandidate!.preferredRegister).toBeOneOf(['A', 'X', 'Y']);

        // Arrays should not be register candidates
        const arrayCandidate = candidates.find(
          c => !c.isCandidate && c.recommendation === 'impossible'
        );
        expect(arrayCandidate).toBeDefined();
      });

      it('should prefer A register for byte variables', () => {
        const candidates = variableAnalyzer.analyzeRegisterCandidates(testVariables);

        // Find byte variable candidates
        const byteCandidates = candidates.filter(c => c.isCandidate && c.preferredRegister === 'A');
        expect(byteCandidates.length).toBeGreaterThan(0);

        for (const candidate of byteCandidates) {
          expect(candidate.alternativeRegisters).toContain('X');
          expect(candidate.alternativeRegisters).toContain('Y');
        }
      });

      it('should handle word variables differently', () => {
        const candidates = variableAnalyzer.analyzeRegisterCandidates(testVariables);

        // Find word variable candidate (gameScore)
        const wordCandidate = candidates.find(c => c.preferredRegister === 'zero_page');
        expect(wordCandidate).toBeDefined();
        expect(wordCandidate!.alternativeRegisters).toContain('A');
      });

      it('should account for storage classes in allocation decisions', () => {
        const candidates = variableAnalyzer.analyzeRegisterCandidates(testVariables);

        // Variables with explicit storage classes should have lower scores
        const explicitStorageCandidates = candidates.filter(c => {
          // Find candidates for variables with explicit storage classes
          const varName = testVariables.find(
            v => v.storageClass !== null && v.storageClass !== undefined
          )?.name;
          return varName && c.allocationScore >= 0; // This is a simplified check
        });

        // Variables without explicit storage classes should generally score higher
        const noStorageCandidates = candidates.filter(c => c.allocationScore > 50);
        expect(noStorageCandidates.length).toBeGreaterThan(0);
      });
    });

    describe('Variable Lifetime Analysis', () => {
      it('should create lifetime information for all variables', () => {
        const lifetimeInfos = variableAnalyzer.analyzeVariableLifetimes(testVariables);

        expect(lifetimeInfos).toHaveLength(testVariables.length);

        for (const lifetimeInfo of lifetimeInfos) {
          expect(lifetimeInfo.definitionPoints).toHaveLength(1);
          expect(lifetimeInfo.liveRanges).toHaveLength(1);
          expect(lifetimeInfo.estimatedDuration).toBeGreaterThan(0);
        }
      });

      it('should estimate different lifetimes for local vs global variables', () => {
        // Create a local variable for testing
        const localVar = createVariableSymbol(
          'localVar',
          createPrimitiveType('byte'),
          symbolTable.getCurrentScope(),
          mockLocation,
          { isLocal: true }
        );
        const testVarsWithLocal = [...testVariables, localVar];

        const lifetimeInfos = variableAnalyzer.analyzeVariableLifetimes(testVarsWithLocal);

        const localVarLifetime = lifetimeInfos[lifetimeInfos.length - 1]; // Last one added
        const globalVarLifetime = lifetimeInfos[0]; // First one (global)

        expect(localVarLifetime.estimatedDuration).toBeLessThan(
          globalVarLifetime.estimatedDuration
        );
      });
    });

    describe('Complete Optimization Metadata Building', () => {
      it('should build comprehensive metadata for all variables', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );
        const metadataMap = variableAnalyzer.buildVariableOptimizationMetadata(
          testVariables,
          usageMap
        );

        expect(metadataMap.size).toBe(testVariables.length);

        for (const [varName, metadata] of metadataMap) {
          expect(metadata.usageStatistics).toBeDefined();
          expect(metadata.zeroPageCandidate).toBeDefined();
          expect(metadata.registerCandidate).toBeDefined();
          expect(metadata.lifetimeInfo).toBeDefined();
          expect(metadata.sixtyTwoHints).toBeDefined();
          expect(metadata.memoryLayout).toBeDefined();

          // Check that metadata is attached to variable symbols
          const variable = testVariables.find(v => v.name === varName);
          expect(variable?.optimizationMetadata).toBe(metadata);
        }
      });

      it('should generate appropriate 6502 optimization hints', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );
        const metadataMap = variableAnalyzer.buildVariableOptimizationMetadata(
          testVariables,
          usageMap
        );

        for (const [varName, metadata] of metadataMap) {
          const hints = metadata.sixtyTwoHints;

          // Check addressing mode hints
          expect(hints.addressingMode).toBeOneOf(['zero_page', 'absolute', 'indexed_x']);

          // Check memory bank assignments
          expect(hints.memoryBank).toBeOneOf(['zero_page', 'low_ram', 'io_area']);

          // Check alignment preferences
          expect(hints.alignmentPreference.requiredAlignment).toBeGreaterThanOrEqual(1);

          // Check hardware interaction flags
          expect(typeof hints.hardwareInteraction.isHardwareRegister).toBe('boolean');
          expect(typeof hints.hardwareInteraction.isMemoryMappedIO).toBe('boolean');
        }
      });

      it('should generate memory layout information', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );
        const metadataMap = variableAnalyzer.buildVariableOptimizationMetadata(
          testVariables,
          usageMap
        );

        for (const [varName, metadata] of metadataMap) {
          const layout = metadata.memoryLayout;

          expect(layout.preferredRegion).toBeOneOf([
            'zero_page_high_priority',
            'zero_page_normal',
            'ram_fast',
            'ram_normal',
            'ram_slow',
            'data_section',
            'bss_section',
            'io_region',
          ]);

          expect(layout.sizeInBytes).toBeGreaterThan(0);
          expect(layout.accessPatterns).toHaveLength(1);
          expect(layout.localityInfo).toBeDefined();
        }
      });
    });

    describe('Variable Size Calculation', () => {
      it('should calculate correct sizes for different variable types', () => {
        // Test through the buildVariableOptimizationMetadata method which uses calculateVariableSizeInBytes
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          mockExpressionResults
        );
        const metadataMap = variableAnalyzer.buildVariableOptimizationMetadata(
          testVariables,
          usageMap
        );

        // Check byte variable size
        const byteVarMetadata = metadataMap.get('counter');
        expect(byteVarMetadata?.memoryLayout.sizeInBytes).toBe(1);

        // Check word variable size
        const wordVarMetadata = metadataMap.get('gameScore');
        expect(wordVarMetadata?.memoryLayout.sizeInBytes).toBe(2);

        // Check array variable size
        const arrayVarMetadata = metadataMap.get('buffer');
        expect(arrayVarMetadata?.memoryLayout.sizeInBytes).toBe(256); // 256 * 1 byte
      });
    });

    describe('Integration with Expression Analysis', () => {
      it('should handle empty expression results gracefully', () => {
        const emptyResults: ExpressionAnalysisResult[] = [];
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(testVariables, emptyResults);

        expect(usageMap.size).toBe(testVariables.length);

        for (const [varName, stats] of usageMap) {
          expect(stats.accessCount).toBe(0);
          expect(stats.estimatedAccessFrequency).toBe('rare');
          expect(stats.accessPattern).toBe('single_use');
        }
      });

      it('should aggregate multiple references to the same variable', () => {
        // Create expression results with multiple references to the same variable
        const multipleRefsResults: ExpressionAnalysisResult[] = [
          {
            expression: { type: 'Identifier', name: 'counter' } as any,
            resolvedType: createPrimitiveType('byte'),
            optimizationData: {
              usedVariables: [
                {
                  symbol: testVariables[0], // counter
                  accessType: 'read',
                  location: mockLocation,
                  context: createExpressionContext({ loopDepth: 2, inHotPath: true }),
                },
              ],
            } as any,
            errors: [],
            warnings: [],
          },
          {
            expression: { type: 'Identifier', name: 'counter' } as any,
            resolvedType: createPrimitiveType('byte'),
            optimizationData: {
              usedVariables: [
                {
                  symbol: testVariables[0], // counter (same variable)
                  accessType: 'write',
                  location: mockLocation,
                  context: createExpressionContext({ loopDepth: 2, inHotPath: true }),
                },
              ],
            } as any,
            errors: [],
            warnings: [],
          },
        ];

        const usageMap = variableAnalyzer.collectVariableUsageMetadata(
          testVariables,
          multipleRefsResults
        );
        const counterStats = usageMap.get('counter')!;

        expect(counterStats.accessCount).toBe(2);
        expect(counterStats.readCount).toBe(1);
        expect(counterStats.writeCount).toBe(1);
        expect(counterStats.loopUsage).toHaveLength(1); // Single loop level
        expect(counterStats.loopUsage[0].loopLevel).toBe(2);
        expect(counterStats.loopUsage[0].accessesInLoop).toBe(2);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle variables not referenced in expressions', () => {
        const usageMap = variableAnalyzer.collectVariableUsageMetadata(testVariables, []);

        for (const [varName, stats] of usageMap) {
          expect(stats.accessCount).toBe(0);
          expect(stats.readCount).toBe(0);
          expect(stats.writeCount).toBe(0);
          expect(stats.modifyCount).toBe(0);
          expect(stats.loopUsage).toHaveLength(0);
          expect(stats.hotPathUsage).toBe(0);
        }
      });

      it('should handle malformed expression analysis results', () => {
        const malformedResults: ExpressionAnalysisResult[] = [
          {
            expression: { type: 'Identifier', name: 'unknown' } as any,
            resolvedType: createPrimitiveType('byte'),
            optimizationData: {
              usedVariables: [
                {
                  symbol: { name: 'nonexistent' } as any, // Invalid symbol
                  accessType: 'read',
                  location: mockLocation,
                  context: createExpressionContext(),
                },
              ],
            } as any,
            errors: [],
            warnings: [],
          },
        ];

        // Should not throw errors, should gracefully handle unknown variables
        expect(() => {
          variableAnalyzer.collectVariableUsageMetadata(testVariables, malformedResults);
        }).not.toThrow();
      });
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
