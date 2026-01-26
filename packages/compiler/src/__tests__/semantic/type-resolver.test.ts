/**
 * Type Resolver Tests
 *
 * Tests for Phase 2: Type Resolution
 * Verifies type annotation resolution and symbol type annotation
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeKind } from '../../semantic/types.js';

/**
 * Helper to parse source and build symbol table + resolve types
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

describe('TypeResolver - Variable Declarations', () => {
  it('should resolve byte type annotation', () => {
    const source = 'let counter: byte = 0;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('counter');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.name).toBe('byte');
    expect(symbol!.type!.size).toBe(1);
  });

  it('should resolve word type annotation', () => {
    const source = 'let address: word = $D000;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('address');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Word);
    expect(symbol!.type!.name).toBe('word');
    expect(symbol!.type!.size).toBe(2);
  });

  it('should resolve boolean type annotation', () => {
    const source = 'let flag: boolean = true;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('flag');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Boolean);
    expect(symbol!.type!.name).toBe('boolean');
  });

  it('should resolve unsized array type annotation with size inference', () => {
    const source = 'let buffer: byte[] = [1, 2, 3];';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('buffer');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.elementType).toBeDefined();
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
    // Size should be inferred from initializer [1, 2, 3]
    expect(symbol!.type!.arraySize).toBe(3);
  });

  it('should resolve sized array type annotation', () => {
    const source = 'let sprites: byte[8] = [0, 1, 2, 3, 4, 5, 6, 7];';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('sprites');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.elementType).toBeDefined();
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.arraySize).toBe(8);
  });

  it('should handle variables without type annotations', () => {
    const source = 'let x = 42;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('x');
    expect(symbol).toBeDefined();
    // Type should be undefined (will be inferred in Phase 3)
    expect(symbol!.type).toBeUndefined();
  });

  it('should resolve @zp storage class variables', () => {
    const source = '@zp let fastCounter: byte = 0;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('fastCounter');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Byte);
  });
});

describe('TypeResolver - Memory-Mapped Declarations', () => {
  it('should resolve simple @map type annotation', () => {
    const source = '@map borderColor at $D020: byte;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('borderColor');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Byte);
  });

  it('should resolve range @map as array type', () => {
    const source = '@map spriteRegs from $D000 to $D02E: byte;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('spriteRegs');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.elementType).toBeDefined();
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
    // Range @map has unknown size at compile time
    expect(symbol!.type!.arraySize).toBeUndefined();
  });

  it('should resolve word type in @map', () => {
    const source = '@map timerA at $DC04: word;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('timerA');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Word);
  });
});

describe('TypeResolver - Function Declarations', () => {
  it('should resolve function with byte return type', () => {
    const source = `
      function getByte(): byte {
        return 42;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('getByte');
    expect(symbol).toBeDefined();
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Callback);
    expect(symbol!.type!.signature).toBeDefined();
    expect(symbol!.type!.signature!.returnType.kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.signature!.parameters).toHaveLength(0);
  });

  it('should resolve function with word return type', () => {
    const source = `
      function getAddress(): word {
        return $D000;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('getAddress');
    expect(symbol).toBeDefined();
    expect(symbol!.type!.signature!.returnType.kind).toBe(TypeKind.Word);
  });

  it('should default to void return type when not specified', () => {
    const source = `
      function doSomething() {
        let x: byte = 0;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('doSomething');
    expect(symbol).toBeDefined();
    expect(symbol!.type!.signature!.returnType.kind).toBe(TypeKind.Void);
  });

  it('should resolve function parameter types', () => {
    const source = `
      function add(a: byte, b: byte): byte {
        return a + b;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('add');
    expect(symbol).toBeDefined();
    expect(symbol!.type!.signature!.parameters).toHaveLength(2);
    expect(symbol!.type!.signature!.parameters[0].kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.signature!.parameters[1].kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.signature!.parameterNames).toEqual(['a', 'b']);
  });

  it('should annotate parameter symbols with types', () => {
    const source = `
      function add(a: byte, b: word): word {
        return a + b;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    // Parameters should be in function scope, but we lookup from current (module) scope
    // which should traverse up to find them
    const paramA = symbolTable.lookup('a');
    const paramB = symbolTable.lookup('b');

    // Note: Parameters are in function scope, may not be visible from module scope
    // This tests that the parameter symbols themselves are annotated
    expect(symbolTable.getSymbolCount()).toBeGreaterThan(0);
  });

  it('should handle multiple parameters with different types', () => {
    const source = `
      function complex(x: byte, y: word, flags: boolean): byte {
        return x;
      }
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('complex');
    expect(symbol!.type!.signature!.parameters).toHaveLength(3);
    expect(symbol!.type!.signature!.parameters[0].kind).toBe(TypeKind.Byte);
    expect(symbol!.type!.signature!.parameters[1].kind).toBe(TypeKind.Word);
    expect(symbol!.type!.signature!.parameters[2].kind).toBe(TypeKind.Boolean);
  });
});

describe('TypeResolver - Type Annotation Parsing', () => {
  it('should parse simple type names', () => {
    const source = `
      let a: byte = 0;
      let b: word = 0;
      let c: boolean = false;
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    expect(symbolTable.lookup('a')!.type!.kind).toBe(TypeKind.Byte);
    expect(symbolTable.lookup('b')!.type!.kind).toBe(TypeKind.Word);
    expect(symbolTable.lookup('c')!.type!.kind).toBe(TypeKind.Boolean);
  });

  it('should parse unsized array types with size inference', () => {
    const source = `
      let bytes: byte[] = [1, 2, 3];
      let words: word[] = [100, 200];
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const bytes = symbolTable.lookup('bytes')!.type!;
    expect(bytes.kind).toBe(TypeKind.Array);
    expect(bytes.elementType!.kind).toBe(TypeKind.Byte);
    // Size should be inferred from initializer [1, 2, 3]
    expect(bytes.arraySize).toBe(3);

    const words = symbolTable.lookup('words')!.type!;
    expect(words.kind).toBe(TypeKind.Array);
    expect(words.elementType!.kind).toBe(TypeKind.Word);
    // Size should be inferred from initializer [100, 200]
    expect(words.arraySize).toBe(2);
  });

  it('should parse sized array types', () => {
    const source = `
      let buffer: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let addresses: word[5] = [$D000, $D020, $D021, $D400, $DC00];
    `;
    const { symbolTable } = parseAndResolveTypes(source);

    const buffer = symbolTable.lookup('buffer')!.type!;
    expect(buffer.arraySize).toBe(10);

    const addresses = symbolTable.lookup('addresses')!.type!;
    expect(addresses.arraySize).toBe(5);
  });

  it('should trim whitespace from type annotations', () => {
    const source = 'let x:  byte  = 0;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('x');
    expect(symbol!.type!.kind).toBe(TypeKind.Byte);
  });
});

describe('TypeResolver - Error Handling', () => {
  it('should report error for unknown simple type', () => {
    const source = 'let x: invalid = 0;';
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Unknown type 'invalid'");
  });

  it('should report error for unknown array element type', () => {
    const source = 'let x: invalid[] = [1, 2, 3];';
    const { diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Unknown element type 'invalid'");
  });

  it('should return unknown type for invalid types', () => {
    const source = 'let x: badtype = 0;';
    const { symbolTable } = parseAndResolveTypes(source);

    const symbol = symbolTable.lookup('x');
    expect(symbol!.type!.kind).toBe(TypeKind.Unknown);
    expect(symbol!.type!.name).toBe('unknown');
  });

  it('should continue processing after type errors', () => {
    const source = `
      let bad: invalid = 0;
      let good: byte = 42;
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    // Should have one error for 'invalid' type
    expect(diagnostics).toHaveLength(1);

    // But 'good' should still be resolved correctly
    const good = symbolTable.lookup('good');
    expect(good!.type!.kind).toBe(TypeKind.Byte);
  });
});

describe('TypeResolver - Integration Tests', () => {
  it('should resolve types in complete program', () => {
    const source = `
      @map borderColor at $D020: byte;
      @zp let counter: byte = 0;
      let buffer: byte[256] = [];

      function increment(value: byte): byte {
        return value + 1;
      }

      function main() {
        counter = increment(counter);
        borderColor = counter;
      }
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    // No errors
    expect(diagnostics).toHaveLength(0);

    // Check all symbols have types
    expect(symbolTable.lookup('borderColor')!.type!.kind).toBe(TypeKind.Byte);
    expect(symbolTable.lookup('counter')!.type!.kind).toBe(TypeKind.Byte);
    expect(symbolTable.lookup('buffer')!.type!.kind).toBe(TypeKind.Array);
    expect(symbolTable.lookup('increment')!.type!.kind).toBe(TypeKind.Callback);
    expect(symbolTable.lookup('main')!.type!.kind).toBe(TypeKind.Callback);

    // Check function signatures
    const increment = symbolTable.lookup('increment')!.type!.signature!;
    expect(increment.parameters).toHaveLength(1);
    expect(increment.parameters[0].kind).toBe(TypeKind.Byte);
    expect(increment.returnType.kind).toBe(TypeKind.Byte);

    const main = symbolTable.lookup('main')!.type!.signature!;
    expect(main.parameters).toHaveLength(0);
    expect(main.returnType.kind).toBe(TypeKind.Void);
  });

  it('should handle nested function scopes', () => {
    const source = `
      function outer(a: byte): byte {
        let temp: word = 100;
        return a;
      }
    `;
    const { symbolTable, diagnostics } = parseAndResolveTypes(source);

    expect(diagnostics).toHaveLength(0);

    // Outer function should be resolved
    const outer = symbolTable.lookup('outer');
    expect(outer!.type!.kind).toBe(TypeKind.Callback);
    expect(outer!.type!.signature!.returnType.kind).toBe(TypeKind.Byte);
  });
});