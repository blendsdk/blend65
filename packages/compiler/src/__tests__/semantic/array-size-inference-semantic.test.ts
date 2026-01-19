/**
 * Array Size Inference Tests - Semantic Analysis
 *
 * Comprehensive tests for array size inference feature
 * Tests semantic analyzer's ability to infer array dimensions from initializers
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeKind } from '../../semantic/types.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';

/**
 * Helper to parse source and resolve types
 */
function parseAndResolveTypes(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Phase 1: Build symbol table
  const builder = new SymbolTableBuilder();
  builder.walk(program);
  const symbolTable = builder.getSymbolTable();

  // Phase 2: Resolve types
  const resolver = new TypeResolver(symbolTable);
  resolver.walk(program);

  return {
    program,
    symbolTable,
    typeSystem: resolver.getTypeSystem(),
    diagnostics: resolver.getDiagnostics(),
  };
}

describe('Array Size Inference - Basic Cases', () => {
  it('should infer size from single element array', () => {
    const source = 'let value: byte[] = [42];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('value');
    expect(symbol).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.arraySize).toBe(1);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
  });

  it('should infer size from multiple element array', () => {
    const source = 'let colors: byte[] = [2, 5, 6, 14];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('colors');
    expect(symbol!.type!.arraySize).toBe(4);
  });

  it('should infer size from word array', () => {
    const source = 'let addresses: word[] = [$D000, $D020, $D021];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('addresses');
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.arraySize).toBe(3);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Word);
  });

  it('should infer size from boolean array', () => {
    const source = 'let flags: boolean[] = [true, false, true, true, false];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('flags');
    expect(symbol!.type!.arraySize).toBe(5);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Boolean);
  });

  it('should infer size from large array', () => {
    const source = `
      let lookupTable: byte[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('lookupTable');
    expect(symbol!.type!.arraySize).toBe(30);
  });
});

describe('Array Size Inference - Storage Classes', () => {
  it('should infer size with @zp storage class', () => {
    const source = '@zp let fastBuffer: byte[] = [1, 2, 3, 4, 5];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('fastBuffer');
    expect(symbol!.type!.arraySize).toBe(5);
  });

  it('should infer size with @data storage class', () => {
    const source = '@data let romData: byte[] = [0xFF, 0xAA, 0x55, 0x00];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('romData');
    expect(symbol!.type!.arraySize).toBe(4);
  });

  it('should infer size with @ram storage class', () => {
    const source = '@ram let buffer: byte[] = [10, 20, 30];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('buffer');
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should infer size with combined @data and const', () => {
    const source = '@data const spriteColors: byte[] = [1, 2, 3, 4, 5, 6, 7, 8];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('spriteColors');
    expect(symbol!.type!.arraySize).toBe(8);
  });
});

describe('Array Size Inference - Const vs Let', () => {
  it('should infer size for const arrays', () => {
    const source = 'const palette: byte[] = [0, 1, 2, 3, 4, 5, 6, 7];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('palette');
    expect(symbol!.type!.arraySize).toBe(8);
  });

  it('should infer size for let arrays', () => {
    const source = 'let mutableBuffer: byte[] = [100, 101, 102];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('mutableBuffer');
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should infer size for exported const arrays', () => {
    const source = 'export const sharedData: word[] = [1000, 2000, 3000, 4000];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('sharedData');
    expect(symbol!.type!.arraySize).toBe(4);
  });
});

describe('Array Size Inference - Expressions in Arrays', () => {
  it('should infer size from array with variable expressions', () => {
    const source = `
      let x: byte = 10;
      let y: byte = 20;
      let coords: byte[] = [x, y];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('coords');
    expect(symbol!.type!.arraySize).toBe(2);
  });

  it('should infer size from array with binary expressions', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 10;
      let results: byte[] = [a + b, a - b, a * 2];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('results');
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should infer size from array with function call expressions', () => {
    const source = `
      function getValue(): byte
        return 42;
      end function

      let values: byte[] = [getValue(), getValue(), getValue()];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('values');
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should infer size from array with mixed literal and expression values', () => {
    const source = `
      let x: byte = 100;
      let mixed: byte[] = [10, x, 20 + 5, x * 2];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('mixed');
    expect(symbol!.type!.arraySize).toBe(4);
  });
});

describe('Array Size Inference - Error Cases', () => {
  it('should error when empty brackets with no initializer', () => {
    const source = 'let buffer: byte[];';
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    const error = diagnostics.find(
      (d) => d.severity === DiagnosticSeverity.ERROR && d.message.includes('Cannot infer array size')
    );
    expect(error).toBeDefined();
    expect(error!.message).toContain('no initializer provided');
  });

  it('should error when trying to infer from non-literal initializer', () => {
    const source = `
      let source: byte[] = [1, 2, 3];
      let target: byte[] = source;
    `;
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    const error = diagnostics.find(
      (d) => d.message.includes('Cannot infer array size from non-literal initializer')
    );
    expect(error).toBeDefined();
  });

  it('should error when trying to infer from empty array literal', () => {
    const source = 'let empty: byte[] = [];';
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    const error = diagnostics.find((d) => d.message.includes('Cannot infer size from empty array literal'));
    expect(error).toBeDefined();
  });

  it('should error when trying to infer from function call initializer', () => {
    const source = `
      function getArray(): byte[3]
        return [1, 2, 3];
      end function

      let result: byte[] = getArray();
    `;
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    const error = diagnostics.find((d) => d.message.includes('non-literal initializer'));
    expect(error).toBeDefined();
  });
});

describe('Array Size Inference - Explicit vs Inferred', () => {
  it('should not override explicit size with inference', () => {
    const source = 'let buffer: byte[10] = [1, 2, 3];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('buffer');
    // Explicit size should be preserved (size mismatch checking happens in type checking phase)
    expect(symbol!.type!.arraySize).toBe(10);
  });

  it('should infer size only when brackets are empty', () => {
    const source = `
      let inferred: byte[] = [1, 2, 3, 4];
      let explicit: byte[5] = [1, 2, 3, 4, 5];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    expect(symbolTable.lookup('inferred')!.type!.arraySize).toBe(4);
    expect(symbolTable.lookup('explicit')!.type!.arraySize).toBe(5);
  });

  it('should handle multiple arrays with mix of explicit and inferred sizes', () => {
    const source = `
      let a: byte[] = [1, 2];
      let b: byte[3] = [1, 2, 3];
      let c: byte[] = [1, 2, 3, 4];
      let d: byte[5] = [1, 2, 3, 4, 5];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    expect(symbolTable.lookup('a')!.type!.arraySize).toBe(2);
    expect(symbolTable.lookup('b')!.type!.arraySize).toBe(3);
    expect(symbolTable.lookup('c')!.type!.arraySize).toBe(4);
    expect(symbolTable.lookup('d')!.type!.arraySize).toBe(5);
  });
});

describe('Array Size Inference - C64-Specific Use Cases', () => {
  it('should infer size for sprite data arrays', () => {
    const source = `
      @data const spriteArrow: byte[] = [
        0b00000001,
        0b00000011,
        0b00000111,
        0b00001111,
        0b00011111,
        0b00001111,
        0b00000111,
        0b00000011
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('spriteArrow');
    expect(symbol!.type!.arraySize).toBe(8);
  });

  it('should infer size for color palette arrays', () => {
    const source = `
      const c64Palette: byte[] = [
        0,   1,   2,   3,   4,   5,   6,   7,
        8,   9,   10,  11,  12,  13,  14,  15
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('c64Palette');
    expect(symbol!.type!.arraySize).toBe(16);
  });

  it('should infer size for SID register value arrays', () => {
    const source = `
      @data const sidInitValues: byte[] = [
        0x00, 0x00, 0x00,  // Voice 1
        0x00, 0x00, 0x00,  // Voice 2
        0x00, 0x00, 0x00   // Voice 3
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('sidInitValues');
    expect(symbol!.type!.arraySize).toBe(9);
  });

  it('should infer size for address lookup tables', () => {
    const source = `
      const screenLineAddresses: word[] = [
        $0400, $0428, $0450, $0478,
        $04A0, $04C8, $04F0, $0518
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('screenLineAddresses');
    expect(symbol!.type!.arraySize).toBe(8);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Word);
  });
});

describe('Array Size Inference - Edge Cases', () => {
  it('should infer size with trailing comma in array', () => {
    const source = 'let values: byte[] = [1, 2, 3,];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('values');
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should infer size with multiline array literal', () => {
    const source = `
      let matrix: byte[] = [
        1,
        2,
        3,
        4,
        5
      ];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('matrix');
    expect(symbol!.type!.arraySize).toBe(5);
  });

  it('should infer size with single element and trailing comma', () => {
    const source = 'let single: byte[] = [42,];';
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('single');
    expect(symbol!.type!.arraySize).toBe(1);
  });

  it('should handle inference in multiple variable declarations', () => {
    const source = `
      let a: byte[] = [1];
      let b: byte[] = [1, 2];
      let c: byte[] = [1, 2, 3];
      let d: byte[] = [1, 2, 3, 4];
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    expect(symbolTable.lookup('a')!.type!.arraySize).toBe(1);
    expect(symbolTable.lookup('b')!.type!.arraySize).toBe(2);
    expect(symbolTable.lookup('c')!.type!.arraySize).toBe(3);
    expect(symbolTable.lookup('d')!.type!.arraySize).toBe(4);
  });
});

describe('Array Size Inference - Integration with Scopes', () => {
  it('should infer size in function scope', () => {
    const source = `
      function initialize()
        let localBuffer: byte[] = [10, 20, 30, 40];
      end function
    `;
    const { diagnostics } = parseAndResolveTypes(source);

    // Should not error - inference works in function scope
    expect(diagnostics).toHaveLength(0);
  });

  it('should infer size at module level', () => {
    const source = `
      let moduleBuffer: byte[] = [1, 2, 3, 4, 5];

      function useBuffer()
        let value: byte = moduleBuffer[0];
      end function
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);
    const symbol = symbolTable.lookup('moduleBuffer');
    expect(symbol!.type!.arraySize).toBe(5);
  });

  it('should infer size in multiple separate function scopes', () => {
    const source = `
      function first()
        let firstArray: byte[] = [1, 2];
      end function
      
      function second()
        let secondArray: byte[] = [10, 20, 30];
      end function
    `;
    const { diagnostics } = parseAndResolveTypes(source);

    // Should handle multiple function scopes without errors
    expect(diagnostics).toHaveLength(0);
  });
});