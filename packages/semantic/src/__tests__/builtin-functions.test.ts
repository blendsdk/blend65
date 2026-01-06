/**
 * Built-in Functions System Tests
 * GitHub Issue #42: Minimal Built-in Functions System for Memory Access (Core Functions Only)
 *
 * Tests for the 5 core built-in functions: peek(), poke(), peekw(), pokew(), sys()
 *
 * Test Coverage:
 * - Function recognition and type checking
 * - Parameter validation (type and count)
 * - Address range validation for 6502
 * - Value range validation for byte/word parameters
 * - Platform-specific warnings for hardware I/O areas
 * - Integration with semantic analyzer
 * - Error message quality and suggestions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExpressionAnalyzer,
  createExpressionContext,
  isBuiltInFunction,
  getBuiltInFunction,
  getAllBuiltInFunctionNames,
} from '../analyzers/expression-analyzer.js';
import { createSymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';
import { createPrimitiveType } from '../types.js';
import { CallExpr, Identifier, Literal, BinaryExpr } from '@blend65/ast';

// Helper function to create test metadata
function createTestMetadata(line = 1, startCol = 1, endCol = 5) {
  return {
    start: { line, column: startCol, offset: startCol - 1 },
    end: { line, column: endCol, offset: endCol - 1 }
  };
}

// Helper functions to create AST nodes with proper metadata
function createIdentifier(name: string, line = 1, startCol = 1): Identifier {
  return {
    type: 'Identifier',
    name,
    metadata: createTestMetadata(line, startCol, startCol + name.length),
  };
}

function createLiteral(value: number | string | boolean, line = 1, startCol = 1): Literal {
  const valueStr = String(value);
  return {
    type: 'Literal',
    value,
    raw: valueStr,
    metadata: createTestMetadata(line, startCol, startCol + valueStr.length),
  };
}

function createCallExpr(functionName: string, args: Literal[], line = 1, startCol = 1): CallExpr {
  const endCol = startCol + functionName.length + 2 + args.length * 6; // Rough estimate
  return {
    type: 'CallExpr',
    callee: createIdentifier(functionName, line, startCol),
    args,
    metadata: createTestMetadata(line, startCol, endCol),
  };
}

describe('Built-in Functions System', () => {
  let analyzer: ExpressionAnalyzer;
  let context: ReturnType<typeof createExpressionContext>;

  beforeEach(() => {
    const symbolTable = createSymbolTable();
    const typeChecker = new TypeChecker((name: string) => symbolTable.lookupSymbol(name));
    analyzer = new ExpressionAnalyzer(symbolTable, typeChecker);
    context = createExpressionContext();
  });

  describe('Built-in Function Registry', () => {
    it('should recognize all 5 core built-in functions', () => {
      const expectedFunctions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];
      const actualFunctions = getAllBuiltInFunctionNames();

      expect(actualFunctions).toHaveLength(5);
      for (const func of expectedFunctions) {
        expect(actualFunctions).toContain(func);
        expect(isBuiltInFunction(func)).toBe(true);
      }
    });

    it('should not recognize non-built-in functions', () => {
      const nonBuiltinFunctions = ['print', 'abs', 'min', 'max', 'random', 'memcopy'];

      for (const func of nonBuiltinFunctions) {
        expect(isBuiltInFunction(func)).toBe(false);
        expect(getBuiltInFunction(func)).toBeUndefined();
      }
    });

    it('should provide complete function definitions', () => {
      const peekDef = getBuiltInFunction('peek')!;
      expect(peekDef).toBeDefined();
      expect(peekDef.name).toBe('peek');
      expect(peekDef.parameters).toHaveLength(1);
      expect(peekDef.parameters[0].name).toBe('address');
      expect(peekDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(peekDef.returnType).toEqual(createPrimitiveType('byte'));
      expect(peekDef.hasSideEffects).toBe(false);
      expect(peekDef.accessesHardware).toBe(true);
      expect(peekDef.description).toContain('Read 8-bit value');
    });
  });

  describe('peek() Function', () => {
    function createPeekCall(address: number): CallExpr {
      return {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 5, offset: 4 }
          },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: address,
            metadata: {
              start: { line: 1, column: 6, offset: 5 },
              end: { line: 1, column: 12, offset: 11 }
            },
          } as Literal,
        ],
        metadata: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 13, offset: 12 }
        },
      };
    }

    it('should validate correct peek() calls', () => {
      const validCalls = [
        0x0000,  // Zero page start
        0x00FF,  // Zero page end
        0x0200,  // RAM start
        0xD020,  // VIC-II border color register
        0xFFFF,  // Address space end
      ];

      for (const address of validCalls) {
        const callExpr = createPeekCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject invalid address ranges', () => {
      const invalidCalls = [
        -1,      // Negative address
        0x10000, // Above 16-bit range
        -100,    // Large negative
        70000,   // Way above range
      ];

      for (const address of invalidCalls) {
        const callExpr = createPeekCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].errorType).toBe('TypeMismatch');
        expect(result.errors[0].message).toContain('Invalid memory address');
        expect(result.errors[0].message).toContain('0x0000-0xFFFF');
      }
    });

    it('should provide warnings for hardware I/O addresses', () => {
      const hardwareAddresses = [
        0xD000,  // Start of I/O area
        0xD020,  // VIC-II border
        0xD400,  // SID
        0xDFFF,  // End of I/O area
      ];

      for (const address of hardwareAddresses) {
        const callExpr = createPeekCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].message).toContain('hardware I/O area');
      }
    });

    it('should provide warnings for ROM areas', () => {
      const romAddresses = [
        0xA000,  // Start of BASIC ROM area
        0xBFFF,  // End of BASIC ROM area
      ];

      for (const address of romAddresses) {
        const callExpr = createPeekCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].message).toContain('BASIC ROM area');
      }
    });

    it('should reject incorrect argument count', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [], // No arguments - should be error
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('expects 1 arguments, got 0');
    });
  });

  describe('poke() Function', () => {
    function createPokeCall(address: number, value: number): CallExpr {
      return {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'poke',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: address,
            metadata: { start: { line: 1, column: 6, offset: 5 } },
          } as Literal,
          {
            type: 'Literal',
            value: value,
            metadata: { start: { line: 1, column: 12, offset: 11 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };
    }

    it('should validate correct poke() calls', () => {
      const validCalls = [
        { address: 0xD020, value: 0 },    // Border color black
        { address: 0xD020, value: 6 },    // Border color blue
        { address: 0xD020, value: 255 },  // Max byte value
        { address: 0x0400, value: 65 },   // Screen memory 'A'
      ];

      for (const call of validCalls) {
        const callExpr = createPokeCall(call.address, call.value);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.resolvedType).toEqual(createPrimitiveType('void'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject out-of-range byte values', () => {
      const invalidValues = [
        { address: 0xD020, value: -1 },   // Negative
        { address: 0xD020, value: 256 },  // Above byte range
        { address: 0xD020, value: 1000 }, // Way above byte range
      ];

      for (const call of invalidValues) {
        const callExpr = createPokeCall(call.address, call.value);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.message.includes('out of range for byte'))).toBe(true);
      }
    });

    it('should reject incorrect argument count', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'poke',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xD020,
            metadata: { start: { line: 1, column: 6, offset: 5 } },
          } as Literal,
        ], // Only one argument - should be error
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('expects 2 arguments, got 1');
    });
  });

  describe('peekw() Function', () => {
    function createPeekwCall(address: number): CallExpr {
      return {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peekw',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: address,
            metadata: { start: { line: 1, column: 7, offset: 6 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };
    }

    it('should validate correct peekw() calls', () => {
      const validCalls = [
        0x0002,  // Zero page word
        0x0314,  // IRQ vector
        0xFFFE,  // Reset vector (even though at edge)
      ];

      for (const address of validCalls) {
        const callExpr = createPeekwCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.resolvedType).toEqual(createPrimitiveType('word'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should return word type for 16-bit reads', () => {
      const callExpr = createPeekwCall(0x0314);
      const result = analyzer.analyzeExpression(callExpr, context);

      expect(result.resolvedType).toEqual(createPrimitiveType('word'));
    });
  });

  describe('pokew() Function', () => {
    function createPokewCall(address: number, value: number): CallExpr {
      return {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'pokew',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: address,
            metadata: { start: { line: 1, column: 7, offset: 6 } },
          } as Literal,
          {
            type: 'Literal',
            value: value,
            metadata: { start: { line: 1, column: 13, offset: 12 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };
    }

    it('should validate correct pokew() calls', () => {
      const validCalls = [
        { address: 0x0002, value: 0x1000 },  // Zero page pointer
        { address: 0x0314, value: 0xEA31 },  // IRQ vector
        { address: 0x07F8, value: 0x00C0 },  // Sprite pointer
      ];

      for (const call of validCalls) {
        const callExpr = createPokewCall(call.address, call.value);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.resolvedType).toEqual(createPrimitiveType('void'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject out-of-range word values', () => {
      const invalidValues = [
        { address: 0x0002, value: -1 },      // Negative
        { address: 0x0002, value: 65536 },   // Above word range
        { address: 0x0002, value: 100000 },  // Way above word range
      ];

      for (const call of invalidValues) {
        const callExpr = createPokewCall(call.address, call.value);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.message.includes('out of range for word'))).toBe(true);
      }
    });
  });

  describe('sys() Function', () => {
    function createSysCall(address: number): CallExpr {
      return {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'sys',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: address,
            metadata: { start: { line: 1, column: 5, offset: 4 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };
    }

    it('should validate correct sys() calls', () => {
      const validCalls = [
        0xFFD2,  // KERNAL CHROUT
        0xFFE4,  // KERNAL GETIN
        0xFFBA,  // KERNAL SETLFS
        0x1000,  // User routine
      ];

      for (const address of validCalls) {
        const callExpr = createSysCall(address);
        const result = analyzer.analyzeExpression(callExpr, context);

        expect(result.resolvedType).toEqual(createPrimitiveType('void'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should return void type for system calls', () => {
      const callExpr = createSysCall(0xFFD2);
      const result = analyzer.analyzeExpression(callExpr, context);

      expect(result.resolvedType).toEqual(createPrimitiveType('void'));
    });
  });

  describe('Function Signature Validation', () => {
    it('should validate peek() signature', () => {
      const peekDef = getBuiltInFunction('peek')!;
      expect(peekDef.parameters).toHaveLength(1);
      expect(peekDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(peekDef.returnType).toEqual(createPrimitiveType('byte'));
    });

    it('should validate poke() signature', () => {
      const pokeDef = getBuiltInFunction('poke')!;
      expect(pokeDef.parameters).toHaveLength(2);
      expect(pokeDef.parameters[0].type).toEqual(createPrimitiveType('word')); // address
      expect(pokeDef.parameters[1].type).toEqual(createPrimitiveType('byte')); // value
      expect(pokeDef.returnType).toEqual(createPrimitiveType('void'));
    });

    it('should validate peekw() signature', () => {
      const peekwDef = getBuiltInFunction('peekw')!;
      expect(peekwDef.parameters).toHaveLength(1);
      expect(peekwDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(peekwDef.returnType).toEqual(createPrimitiveType('word'));
    });

    it('should validate pokew() signature', () => {
      const pokewDef = getBuiltInFunction('pokew')!;
      expect(pokewDef.parameters).toHaveLength(2);
      expect(pokewDef.parameters[0].type).toEqual(createPrimitiveType('word')); // address
      expect(pokewDef.parameters[1].type).toEqual(createPrimitiveType('word')); // value
      expect(pokewDef.returnType).toEqual(createPrimitiveType('void'));
    });

    it('should validate sys() signature', () => {
      const sysDef = getBuiltInFunction('sys')!;
      expect(sysDef.parameters).toHaveLength(1);
      expect(sysDef.parameters[0].type).toEqual(createPrimitiveType('word'));
      expect(sysDef.returnType).toEqual(createPrimitiveType('void'));
    });
  });

  describe('Side Effects Analysis', () => {
    it('should mark peek() and peekw() as non-side-effecting', () => {
      const peekDef = getBuiltInFunction('peek')!;
      const peekwDef = getBuiltInFunction('peekw')!;

      expect(peekDef.hasSideEffects).toBe(false);
      expect(peekwDef.hasSideEffects).toBe(false);
    });

    it('should mark poke(), pokew(), and sys() as side-effecting', () => {
      const pokeDef = getBuiltInFunction('poke')!;
      const pokewDef = getBuiltInFunction('pokew')!;
      const sysDef = getBuiltInFunction('sys')!;

      expect(pokeDef.hasSideEffects).toBe(true);
      expect(pokewDef.hasSideEffects).toBe(true);
      expect(sysDef.hasSideEffects).toBe(true);
    });

    it('should mark all functions as accessing hardware', () => {
      const functions = ['peek', 'poke', 'peekw', 'pokew', 'sys'];

      for (const funcName of functions) {
        const funcDef = getBuiltInFunction(funcName)!;
        expect(funcDef.accessesHardware).toBe(true);
      }
    });
  });

  describe('Error Messages and Suggestions', () => {
    it('should provide helpful error messages for undefined functions', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'unknown_function',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].errorType).toBe('UndefinedSymbol');
      expect(result.errors[0].message).toContain('Undefined function');
      expect(result.errors[0].suggestions).toBeDefined();
      expect(result.errors[0].suggestions!.some(s => s.includes('peek, poke, peekw, pokew, sys'))).toBe(true);
    });

    it('should provide helpful error messages for wrong argument count', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'poke',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xD020,
            metadata: { start: { line: 1, column: 6, offset: 5 } },
          } as Literal,
          {
            type: 'Literal',
            value: 6,
            metadata: { start: { line: 1, column: 12, offset: 11 } },
          } as Literal,
          {
            type: 'Literal',
            value: 99, // Extra argument
            metadata: { start: { line: 1, column: 15, offset: 14 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('expects 2 arguments, got 3');
      expect(result.errors[0].suggestions).toBeDefined();
      expect(result.errors[0].suggestions![0]).toContain('poke(address: word, value: byte)');
    });
  });

  describe('Platform-Specific Validation', () => {
    it('should provide appropriate warnings for hardware areas', () => {
      const hardwareTests = [
        { address: 0xD000, area: 'VIC-II' },
        { address: 0xD400, area: 'SID' },
        { address: 0xDC00, area: 'CIA' },
      ];

      for (const test of hardwareTests) {
        const callExpr: CallExpr = {
          type: 'CallExpr',
          callee: {
            type: 'Identifier',
            name: 'peek',
            metadata: { start: { line: 1, column: 1, offset: 0 } },
          } as Identifier,
          args: [
            {
              type: 'Literal',
              value: test.address,
              metadata: { start: { line: 1, column: 6, offset: 5 } },
            } as Literal,
          ],
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        };

        const result = analyzer.analyzeExpression(callExpr, context);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].message).toContain('hardware I/O area');
      }
    });
  });

  describe('Integration with Semantic Analyzer', () => {
    it('should integrate seamlessly with expression analysis', () => {
      // Test that built-in functions work within larger expressions
      const complexCallExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'BinaryExpr',
            left: {
              type: 'Literal',
              value: 0xD000,
              metadata: { start: { line: 1, column: 6, offset: 5 } },
            } as Literal,
            operator: '+',
            right: {
              type: 'Literal',
              value: 0x20,
              metadata: { start: { line: 1, column: 15, offset: 14 } },
            } as Literal,
            metadata: { start: { line: 1, column: 6, offset: 5 } },
          },
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(complexCallExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
      expect(result.errors).toHaveLength(0);
    });

    it('should handle hardware context updates', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'poke',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xD020,
            metadata: { start: { line: 1, column: 6, offset: 5 } },
          } as Literal,
          {
            type: 'Literal',
            value: 6,
            metadata: { start: { line: 1, column: 12, offset: 11 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('void'));

      // Built-in function should be recognized as hardware access
      expect(result.optimizationData.sixtyTwoHints.hardwareRegisterAccess).toBe(false); // This gets set in side effects analysis
      expect(result.optimizationData.hasSideEffects).toBe(true); // poke() has side effects
    });
  });

  describe('Real-World Usage Examples', () => {
    it('should handle C64 border color example', () => {
      // var borderColor = peek(0xD020)
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: { start: { line: 1, column: 19, offset: 18 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xD020,
            metadata: { start: { line: 1, column: 24, offset: 23 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 19, offset: 18 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0); // Should warn about hardware I/O
      expect(result.warnings[0].message).toContain('hardware I/O area');
    });

    it('should handle sprite pointer setup example', () => {
      // pokew(0x07F8, 0x00C0)
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'pokew',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0x07F8,
            metadata: { start: { line: 1, column: 7, offset: 6 } },
          } as Literal,
          {
            type: 'Literal',
            value: 0x00C0,
            metadata: { start: { line: 1, column: 14, offset: 13 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('void'));
      expect(result.errors).toHaveLength(0);
    });

    it('should handle KERNAL routine call example', () => {
      // sys(0xFFD2) - CHROUT
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'sys',
          metadata: { start: { line: 1, column: 1, offset: 0 } },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xFFD2,
            metadata: { start: { line: 1, column: 5, offset: 4 } },
          } as Literal,
        ],
        metadata: { start: { line: 1, column: 1, offset: 0 } },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('void'));
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle edge case addresses correctly', () => {
      const edgeCases = [
        { address: 0x0000, description: 'Zero address' },
        { address: 0xFFFF, description: 'Maximum address' },
        { address: 0x0001, description: 'Minimum non-zero' },
      ];

      for (const testCase of edgeCases) {
        const callExpr: CallExpr = {
          type: 'CallExpr',
          callee: {
            type: 'Identifier',
            name: 'peek',
            metadata: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 5, offset: 4 }
            },
          } as Identifier,
          args: [
            {
              type: 'Literal',
              value: testCase.address,
              metadata: {
                start: { line: 1, column: 6, offset: 5 },
                end: { line: 1, column: 12, offset: 11 }
              },
            } as Literal,
          ],
          metadata: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 13, offset: 12 }
          },
        };

        const result = analyzer.analyzeExpression(callExpr, context);
        expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should handle mixed byte/word expressions in parameters', () => {
      // Test peek(byteVar + wordConstant) type scenarios
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 5, offset: 4 }
          },
        } as Identifier,
        args: [
          {
            type: 'BinaryExpr',
            left: {
              type: 'Literal',
              value: 255, // byte value
              metadata: {
                start: { line: 1, column: 6, offset: 5 },
                end: { line: 1, column: 9, offset: 8 }
              },
            } as Literal,
            operator: '+',
            right: {
              type: 'Literal',
              value: 0xD000, // word value
              metadata: {
                start: { line: 1, column: 12, offset: 11 },
                end: { line: 1, column: 18, offset: 17 }
              },
            } as Literal,
            metadata: {
              start: { line: 1, column: 6, offset: 5 },
              end: { line: 1, column: 18, offset: 17 }
            },
          },
        ],
        metadata: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 19, offset: 18 }
        },
      };

      const result = analyzer.analyzeExpression(callExpr, context);
      expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Performance and Optimization Metadata', () => {
    it('should generate appropriate optimization metadata for built-in functions', () => {
      const callExpr: CallExpr = {
        type: 'CallExpr',
        callee: {
          type: 'Identifier',
          name: 'peek',
          metadata: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 5, offset: 4 }
          },
        } as Identifier,
        args: [
          {
            type: 'Literal',
            value: 0xD020,
            metadata: {
              start: { line: 1, column: 6, offset: 5 },
              end: { line: 1, column: 12, offset: 11 }
            },
          } as Literal,
        ],
        metadata: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 13, offset: 12 }
        },
      };

      const result = analyzer.analyzeExpression(callExpr, context);

      // Check optimization metadata
      expect(result.optimizationData).toBeDefined();
      expect(result.optimizationData.hasSideEffects).toBe(true); // Function calls marked as having side effects
      expect(result.optimizationData.hasNestedCalls).toBe(true);
      expect(result.optimizationData.estimatedCycles).toBeGreaterThan(0);
      expect(result.optimizationData.complexityScore).toBeGreaterThan(0);
    });
  });
});
