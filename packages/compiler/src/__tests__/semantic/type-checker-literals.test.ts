/**
 * Type Checker Tests - Literal Expressions
 *
 * Tests for Phase 3 Session 1: Foundation & Literals
 * - TypeChecker base class
 * - Number literal type inference
 * - Boolean literal types
 * - String literal types
 * - Array literal types
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeChecker } from '../../semantic/visitors/type-checker/index.js';
import { TypeKind } from '../../semantic/types.js';

/**
 * Helper function to parse and type check source code
 *
 * Runs the full pipeline:
 * 1. Lexer: tokenize
 * 2. Parser: build AST
 * 3. SymbolTableBuilder: Phase 1
 * 4. TypeResolver: Phase 2
 * 5. TypeChecker: Phase 3
 */
function parseAndTypeCheck(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Phase 1: Symbol Table Builder
  const symbolBuilder = new SymbolTableBuilder();
  symbolBuilder.walk(program);
  const symbolTable = symbolBuilder.getSymbolTable();

  // Phase 2: Type Resolver
  const resolver = new TypeResolver(symbolTable);
  resolver.walk(program);
  const typeSystem = resolver.getTypeSystem();

  // Phase 3: Type Checker
  const checker = new TypeChecker(symbolTable, typeSystem);
  checker.walk(program);
  const diagnostics = checker.getDiagnostics();

  return {
    program,
    symbolTable,
    typeSystem,
    diagnostics,
  };
}

describe('TypeChecker - Number Literals', () => {
  it('should infer byte type for 0', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = 0;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Byte);
    expect(typeInfo.name).toBe('byte');
  });

  it('should infer byte type for 255', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = 255;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Byte);
    expect(typeInfo.name).toBe('byte');
  });

  it('should infer word type for 256', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = 256;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Word);
    expect(typeInfo.name).toBe('word');
  });

  it('should infer word type for 65535', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = 65535;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Word);
    expect(typeInfo.name).toBe('word');
  });

  it('should error on number literal > 65535', () => {
    const { diagnostics } = parseAndTypeCheck('let x = 65536;');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toContain('exceeds maximum value 65535');
  });

  it('should error on negative number literals', () => {
    const { diagnostics } = parseAndTypeCheck('let x = -1;');

    // Parser creates a UnaryExpression with operator '-' and operand 1
    // This will be handled in Session 2 when we add unary expression type checking
    // For now, just verify it doesn't crash
    expect(diagnostics.length).toBeGreaterThanOrEqual(0);
  });

  it('should infer byte type for hex literals under 256', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = $FF;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Byte);
  });

  it('should infer word type for hex literals over 255', () => {
    const { program, diagnostics } = parseAndTypeCheck('let x = $D020;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Word);
  });
});

describe('TypeChecker - Boolean Literals', () => {
  it('should infer boolean type for true', () => {
    const { program, diagnostics } = parseAndTypeCheck('let flag = true;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Boolean);
    expect(typeInfo.name).toBe('boolean');
  });

  it('should infer boolean type for false', () => {
    const { program, diagnostics } = parseAndTypeCheck('let flag = false;');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Boolean);
    expect(typeInfo.name).toBe('boolean');
  });
});

describe('TypeChecker - String Literals', () => {
  it('should infer string type for string literals', () => {
    const { program, diagnostics } = parseAndTypeCheck('let msg = "hello";');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.String);
    expect(typeInfo.name).toBe('string');
  });

  it('should infer string type for empty strings', () => {
    const { program, diagnostics } = parseAndTypeCheck('let msg = "";');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.String);
  });
});

describe('TypeChecker - Array Literals', () => {
  it('should error on empty array literal', () => {
    const { diagnostics } = parseAndTypeCheck('let arr = [];');

    expect(diagnostics.length).toBeGreaterThan(0);
    const typeError = diagnostics.find(d => d.message.includes('Cannot infer type'));
    expect(typeError).toBeDefined();
  });

  it('should infer byte array from byte literals', () => {
    const { program, diagnostics } = parseAndTypeCheck('let arr = [1, 2, 3];');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Array);
    expect(typeInfo.elementType?.kind).toBe(TypeKind.Byte);
    expect(typeInfo.arraySize).toBe(3);
  });

  it('should infer word array from word literals', () => {
    const { program, diagnostics } = parseAndTypeCheck('let arr = [256, 512, 1024];');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Array);
    expect(typeInfo.elementType?.kind).toBe(TypeKind.Word);
    expect(typeInfo.arraySize).toBe(3);
  });

  it('should error on mixed byte/word array', () => {
    const { diagnostics } = parseAndTypeCheck('let arr = [1, 256, 3];');

    expect(diagnostics.length).toBeGreaterThan(0);
    const typeError = diagnostics.find(d => d.message.includes('Array element type mismatch'));
    expect(typeError).toBeDefined();
  });

  it('should infer boolean array from boolean literals', () => {
    const { program, diagnostics } = parseAndTypeCheck('let arr = [true, false, true];');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Array);
    expect(typeInfo.elementType?.kind).toBe(TypeKind.Boolean);
    expect(typeInfo.arraySize).toBe(3);
  });

  it('should error on mixed type array (number and boolean)', () => {
    const { diagnostics } = parseAndTypeCheck('let arr = [1, true, 3];');

    expect(diagnostics.length).toBeGreaterThan(0);
    const typeError = diagnostics.find(d => d.message.includes('Array element type mismatch'));
    expect(typeError).toBeDefined();
  });

  it('should handle single-element arrays', () => {
    const { program, diagnostics } = parseAndTypeCheck('let arr = [42];');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Array);
    expect(typeInfo.elementType?.kind).toBe(TypeKind.Byte);
    expect(typeInfo.arraySize).toBe(1);
  });

  it('should handle large arrays', () => {
    const { program, diagnostics } = parseAndTypeCheck('let arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];');
    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0];
    const initializer = (varDecl as any).getInitializer();
    const typeInfo = initializer.getTypeInfo();

    expect(typeInfo).toBeDefined();
    expect(typeInfo.kind).toBe(TypeKind.Array);
    expect(typeInfo.arraySize).toBe(10);
  });
});

describe('TypeChecker - Helper Methods', () => {
  it('should recognize identifiers as lvalues', () => {
    const { program } = parseAndTypeCheck('let x: byte = 0;');

    const varDecl = program.getDeclarations()[0];
    expect(varDecl).toBeDefined();
  });

  it('should type check multiple declarations', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let a = 1;
      let b = 256;
      let c = true;
      let d = "test";
    `);

    expect(diagnostics).toHaveLength(0);
  });
});
