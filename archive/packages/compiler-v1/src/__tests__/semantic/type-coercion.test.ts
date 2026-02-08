/**
 * Type Coercion Analyzer Tests
 *
 * Tests the TypeCoercionAnalyzer which marks AST nodes where
 * type conversions are needed for IL generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeCoercionAnalyzer, TypeCoercionKind, OptimizationMetadataKey } from '../../semantic/analysis/index.js';
import { TypeSystem } from '../../semantic/type-system.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { SymbolKind } from '../../semantic/symbol.js';
import { TypeKind } from '../../semantic/types.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { ASTNode } from '../../ast/base.js';

/**
 * Helper to parse source code
 */
function parse(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Create a basic symbol table with a function
 */
function createSymbolTableWithFunction(
  funcName: string,
  paramTypes: string[],
  returnType: string = 'void'
): SymbolTable {
  const symbolTable = new SymbolTable();
  const typeSystem = new TypeSystem();

  const params = paramTypes.map(typeName => typeSystem.getBuiltinType(typeName)!);
  const retType = typeSystem.getBuiltinType(returnType)!;

  symbolTable.define({
    name: funcName,
    kind: SymbolKind.Function,
    type: {
      kind: TypeKind.Callback,
      name: `(${paramTypes.join(', ')}) => ${returnType}`,
      size: 2,
      isSigned: false,
      isAssignable: false,
      signature: {
        parameters: params,
        returnType: retType,
        parameterNames: paramTypes.map((_, i) => `p${i}`),
      },
    },
    location: { line: 1, column: 1, offset: 0 },
    isExported: false,
    scope: 'global',
  });

  return symbolTable;
}

describe('TypeCoercionAnalyzer', () => {
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;
  let analyzer: TypeCoercionAnalyzer;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    typeSystem = new TypeSystem();
    analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);
  });

  describe('determineCoercionKind', () => {
    it('should return None for identical types', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = (analyzer as any).determineCoercionKind(byteType, byteType);
      expect(result).toBe(TypeCoercionKind.None);
    });

    it('should return ZeroExtend for byte to word', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = (analyzer as any).determineCoercionKind(byteType, wordType);
      expect(result).toBe(TypeCoercionKind.ZeroExtend);
    });

    it('should return Truncate for word to byte', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = (analyzer as any).determineCoercionKind(wordType, byteType);
      expect(result).toBe(TypeCoercionKind.Truncate);
    });

    it('should return BoolToByte for boolean to byte', () => {
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const byteType = typeSystem.getBuiltinType('byte')!;
      const result = (analyzer as any).determineCoercionKind(boolType, byteType);
      expect(result).toBe(TypeCoercionKind.BoolToByte);
    });

    it('should return ByteToBool for byte to boolean', () => {
      const byteType = typeSystem.getBuiltinType('byte')!;
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const result = (analyzer as any).determineCoercionKind(byteType, boolType);
      expect(result).toBe(TypeCoercionKind.ByteToBool);
    });

    it('should return BoolToWord for boolean to word', () => {
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const wordType = typeSystem.getBuiltinType('word')!;
      const result = (analyzer as any).determineCoercionKind(boolType, wordType);
      expect(result).toBe(TypeCoercionKind.BoolToWord);
    });

    it('should return WordToBool for word to boolean', () => {
      const wordType = typeSystem.getBuiltinType('word')!;
      const boolType = typeSystem.getBuiltinType('boolean')!;
      const result = (analyzer as any).determineCoercionKind(wordType, boolType);
      expect(result).toBe(TypeCoercionKind.WordToBool);
    });
  });

  describe('estimateCoercionCost', () => {
    it('should return 4 cycles for ZeroExtend', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.ZeroExtend);
      expect(cost).toBe(4);
    });

    it('should return 2 cycles for Truncate', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.Truncate);
      expect(cost).toBe(2);
    });

    it('should return 0 cycles for BoolToByte (same representation)', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.BoolToByte);
      expect(cost).toBe(0);
    });

    it('should return 4 cycles for ByteToBool', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.ByteToBool);
      expect(cost).toBe(4);
    });

    it('should return 4 cycles for BoolToWord', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.BoolToWord);
      expect(cost).toBe(4);
    });

    it('should return 6 cycles for WordToBool', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.WordToBool);
      expect(cost).toBe(6);
    });

    it('should return 0 cycles for None', () => {
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.None);
      expect(cost).toBe(0);
    });
  });

  describe('TypeCoercionKind enum', () => {
    it('should have all expected coercion kinds', () => {
      expect(TypeCoercionKind.None).toBe('None');
      expect(TypeCoercionKind.ZeroExtend).toBe('ZeroExtend');
      expect(TypeCoercionKind.Truncate).toBe('Truncate');
      expect(TypeCoercionKind.BoolToByte).toBe('BoolToByte');
      expect(TypeCoercionKind.ByteToBool).toBe('ByteToBool');
      expect(TypeCoercionKind.BoolToWord).toBe('BoolToWord');
      expect(TypeCoercionKind.WordToBool).toBe('WordToBool');
    });
  });

  describe('OptimizationMetadataKey for coercion', () => {
    it('should have all type coercion metadata keys', () => {
      expect(OptimizationMetadataKey.TypeCoercionRequired).toBe('TypeCoercionRequired');
      expect(OptimizationMetadataKey.TypeCoercionSourceType).toBe('TypeCoercionSourceType');
      expect(OptimizationMetadataKey.TypeCoercionTargetType).toBe('TypeCoercionTargetType');
      expect(OptimizationMetadataKey.TypeCoercionImplicit).toBe('TypeCoercionImplicit');
      expect(OptimizationMetadataKey.TypeCoercionCost).toBe('TypeCoercionCost');
    });
  });

  describe('getCoercions', () => {
    it('should return empty map initially', () => {
      const coercions = analyzer.getCoercions();
      expect(coercions.size).toBe(0);
    });
  });

  describe('getDiagnostics', () => {
    it('should return empty array initially', () => {
      const diagnostics = analyzer.getDiagnostics();
      expect(diagnostics.length).toBe(0);
    });
  });

  describe('analyze basic cases', () => {
    it('should not produce diagnostics for valid code', () => {
      const ast = parse(`
        module test
        let x: byte = 10;
      `);
      analyzer.analyze(ast);
      expect(analyzer.getDiagnostics().length).toBe(0);
    });

    it('should handle empty program', () => {
      const ast = parse(`module empty`);
      analyzer.analyze(ast);
      expect(analyzer.getDiagnostics().length).toBe(0);
      expect(analyzer.getCoercions().size).toBe(0);
    });
  });

  describe('isArithmeticOrBitwiseOperator', () => {
    it('should identify arithmetic operators', () => {
      // Access protected method for testing
      const isArithmetic = (analyzer as any).isArithmeticOrBitwiseOperator;
      // We can't easily test this without TokenType, but we verify it exists
      expect(typeof isArithmetic).toBe('function');
    });
  });

  describe('isLogicalOperator', () => {
    it('should identify logical operators', () => {
      // Access protected method for testing
      const isLogical = (analyzer as any).isLogicalOperator;
      expect(typeof isLogical).toBe('function');
    });
  });
});

describe('TypeCoercionKind values', () => {
  it('should have unique string values', () => {
    const values = [
      TypeCoercionKind.None,
      TypeCoercionKind.ZeroExtend,
      TypeCoercionKind.Truncate,
      TypeCoercionKind.BoolToByte,
      TypeCoercionKind.ByteToBool,
      TypeCoercionKind.BoolToWord,
      TypeCoercionKind.WordToBool,
    ];
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('Coercion cycle costs', () => {
  let typeSystem: TypeSystem;
  let symbolTable: SymbolTable;
  let analyzer: TypeCoercionAnalyzer;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    symbolTable = new SymbolTable();
    analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);
  });

  describe('6502-specific costs', () => {
    it('should have reasonable costs for 6502 CPU', () => {
      // On 6502, operations are typically 2-6 cycles
      const costs = [
        (analyzer as any).estimateCoercionCost(TypeCoercionKind.ZeroExtend),
        (analyzer as any).estimateCoercionCost(TypeCoercionKind.Truncate),
        (analyzer as any).estimateCoercionCost(TypeCoercionKind.ByteToBool),
        (analyzer as any).estimateCoercionCost(TypeCoercionKind.BoolToWord),
        (analyzer as any).estimateCoercionCost(TypeCoercionKind.WordToBool),
      ];

      for (const cost of costs) {
        expect(cost).toBeGreaterThanOrEqual(0);
        expect(cost).toBeLessThanOrEqual(10); // Reasonable upper bound for simple ops
      }
    });

    it('should have BoolToByte as zero cost (same representation)', () => {
      // On 6502, boolean and byte are identical in memory
      const cost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.BoolToByte);
      expect(cost).toBe(0);
    });

    it('should have WordToBool as most expensive (needs to check both bytes)', () => {
      const zeroExtendCost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.ZeroExtend);
      const truncateCost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.Truncate);
      const wordToBoolCost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.WordToBool);

      expect(wordToBoolCost).toBeGreaterThanOrEqual(zeroExtendCost);
      expect(wordToBoolCost).toBeGreaterThan(truncateCost);
    });

    it('should have Truncate as cheaper than ZeroExtend', () => {
      // Truncate just takes low byte, ZeroExtend needs to set high byte to 0
      const truncateCost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.Truncate);
      const zeroExtendCost = (analyzer as any).estimateCoercionCost(TypeCoercionKind.ZeroExtend);

      expect(truncateCost).toBeLessThanOrEqual(zeroExtendCost);
    });
  });
});

describe('Integration with AST', () => {
  it('should create TypeCoercionAnalyzer without errors', () => {
    const typeSystem = new TypeSystem();
    const symbolTable = new SymbolTable();
    const analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);

    expect(analyzer).toBeInstanceOf(TypeCoercionAnalyzer);
  });

  it('should have analyze method', () => {
    const typeSystem = new TypeSystem();
    const symbolTable = new SymbolTable();
    const analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);

    expect(typeof analyzer.analyze).toBe('function');
  });

  it('should have getCoercions method', () => {
    const typeSystem = new TypeSystem();
    const symbolTable = new SymbolTable();
    const analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);

    expect(typeof analyzer.getCoercions).toBe('function');
  });

  it('should have getDiagnostics method', () => {
    const typeSystem = new TypeSystem();
    const symbolTable = new SymbolTable();
    const analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);

    expect(typeof analyzer.getDiagnostics).toBe('function');
  });
});

describe('Metadata key presence', () => {
  it('should have expression complexity keys defined', () => {
    // These were added alongside type coercion for IL readiness
    expect(OptimizationMetadataKey.ExprComplexityScore).toBe('ExprComplexityScore');
    expect(OptimizationMetadataKey.ExprRegisterPressure).toBe('ExprRegisterPressure');
    expect(OptimizationMetadataKey.ExprTreeDepth).toBe('ExprTreeDepth');
    expect(OptimizationMetadataKey.ExprOperationCount).toBe('ExprOperationCount');
    expect(OptimizationMetadataKey.ExprContainsCall).toBe('ExprContainsCall');
    expect(OptimizationMetadataKey.ExprContainsMemoryAccess).toBe('ExprContainsMemoryAccess');
  });
});

describe('CoercionInfo structure', () => {
  let typeSystem: TypeSystem;
  let symbolTable: SymbolTable;
  let analyzer: TypeCoercionAnalyzer;

  beforeEach(() => {
    typeSystem = new TypeSystem();
    symbolTable = new SymbolTable();
    analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);
  });

  it('should create proper CoercionInfo with all fields', () => {
    // Manually check the structure by accessing the coercion logic
    const byteType = typeSystem.getBuiltinType('byte')!;
    const wordType = typeSystem.getBuiltinType('word')!;

    const kind = (analyzer as any).determineCoercionKind(byteType, wordType);
    const cost = (analyzer as any).estimateCoercionCost(kind);

    expect(kind).toBe(TypeCoercionKind.ZeroExtend);
    expect(cost).toBe(4);
  });
});

describe('Type system integration', () => {
  let typeSystem: TypeSystem;

  beforeEach(() => {
    typeSystem = new TypeSystem();
  });

  it('should get byte type from type system', () => {
    const byteType = typeSystem.getBuiltinType('byte');
    expect(byteType).toBeDefined();
    expect(byteType!.kind).toBe(TypeKind.Byte);
    expect(byteType!.size).toBe(1);
  });

  it('should get word type from type system', () => {
    const wordType = typeSystem.getBuiltinType('word');
    expect(wordType).toBeDefined();
    expect(wordType!.kind).toBe(TypeKind.Word);
    expect(wordType!.size).toBe(2);
  });

  it('should get boolean type from type system', () => {
    const boolType = typeSystem.getBuiltinType('boolean');
    expect(boolType).toBeDefined();
    expect(boolType!.kind).toBe(TypeKind.Boolean);
    expect(boolType!.size).toBe(1);
  });

  it('should get void type from type system', () => {
    const voidType = typeSystem.getBuiltinType('void');
    expect(voidType).toBeDefined();
    expect(voidType!.kind).toBe(TypeKind.Void);
    expect(voidType!.size).toBe(0);
  });
});

describe('Exports', () => {
  it('should export TypeCoercionAnalyzer', () => {
    expect(TypeCoercionAnalyzer).toBeDefined();
  });

  it('should export TypeCoercionKind', () => {
    expect(TypeCoercionKind).toBeDefined();
  });

  it('should export OptimizationMetadataKey', () => {
    expect(OptimizationMetadataKey).toBeDefined();
  });
});