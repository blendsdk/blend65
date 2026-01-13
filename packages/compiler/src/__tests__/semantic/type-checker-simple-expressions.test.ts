/**
 * Type Checker Tests - Session 2: Simple Expressions
 *
 * Tests for identifier, binary, and unary expression type checking.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeChecker } from '../../semantic/visitors/type-checker.js';
import { TypeKind } from '../../semantic/types.js';

/**
 * Helper function to parse and type check source code
 *
 * Runs the full compiler pipeline:
 * - Lexer: Tokenize source
 * - Parser: Build AST
 * - Phase 1: Build symbol table
 * - Phase 2: Resolve types
 * - Phase 3: Type check expressions
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

  return { program, symbolTable, typeSystem, diagnostics };
}

// ============================================
// IDENTIFIER EXPRESSIONS
// ============================================

describe('TypeChecker - Identifier Expressions', () => {
  it('should get type from symbol table for defined variable', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let x: byte = 42;
      let y = x;
    `);

    expect(diagnostics).toHaveLength(0);

    const declarations = program.getDeclarations();
    const secondVar = declarations[1] as any;
    const initializer = secondVar.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
    expect(initializer.getTypeInfo().name).toBe('byte');
  });

  it('should report error for undefined identifier', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let x = undefinedVar;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Undefined identifier');
    expect(diagnostics[0].message).toContain('undefinedVar');
  });

  it('should handle word type identifiers', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let counter: word = 1000;
      let value = counter;
    `);

    expect(diagnostics).toHaveLength(0);

    const declarations = program.getDeclarations();
    const secondVar = declarations[1] as any;
    const initializer = secondVar.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should handle boolean type identifiers', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let flag: boolean = true;
      let state = flag;
    `);

    expect(diagnostics).toHaveLength(0);

    const declarations = program.getDeclarations();
    const secondVar = declarations[1] as any;
    const initializer = secondVar.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });
});

// ============================================
// BINARY EXPRESSIONS - ARITHMETIC
// ============================================

describe('TypeChecker - Binary Expressions (Arithmetic)', () => {
  it('should type check byte + byte = byte', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 5 + 10;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should type check word + word = word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 1000 + 2000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should type check byte + word = word (type promotion)', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 + 1000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should report error for boolean + byte', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = true + 10;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Arithmetic operator');
    expect(diagnostics[0].message).toContain('requires numeric operand');
  });

  it('should handle subtraction', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 100 - 50;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle multiplication', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 * 20;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle division', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 100 / 5;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle modulo', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 100 % 7;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });
});

// ============================================
// BINARY EXPRESSIONS - COMPARISON
// ============================================

describe('TypeChecker - Binary Expressions (Comparison)', () => {
  it('should type check byte < byte = boolean', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 5 < 10;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle <= operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 5 <= 10;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle > operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 > 5;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle >= operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 >= 5;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle == operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 == 10;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle != operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 != 5;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should allow byte < word comparison', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 < 1000;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });
});

// ============================================
// BINARY EXPRESSIONS - LOGICAL
// ============================================

describe('TypeChecker - Binary Expressions (Logical)', () => {
  it('should type check boolean && boolean = boolean', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true && false;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should type check boolean || boolean = boolean', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true || false;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should report error for byte && byte', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = 10 && 20;
    `);

    expect(diagnostics).toHaveLength(2); // Both operands are errors
    expect(diagnostics[0].message).toContain('Logical operator');
    expect(diagnostics[0].message).toContain('requires boolean operand');
  });

  it('should report error for boolean && byte', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = true && 10;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('requires boolean operand');
  });
});

// ============================================
// BINARY EXPRESSIONS - BITWISE
// ============================================

describe('TypeChecker - Binary Expressions (Bitwise)', () => {
  it('should type check byte & byte = byte', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 15 & 7;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should type check word & word = word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 1000 & 2000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should type check byte & word = word (promotion)', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 15 & 1000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should handle | operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 8 | 4;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle ^ operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 15 ^ 7;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle << operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 1 << 3;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle >> operator', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 16 >> 2;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should report error for boolean & byte', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = true & 10;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Bitwise operator');
    expect(diagnostics[0].message).toContain('requires numeric operand');
  });
});

// ============================================
// UNARY EXPRESSIONS
// ============================================

describe('TypeChecker - Unary Expressions', () => {
  it('should type check -byte = byte', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = -42;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should type check -word = word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = -1000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should report error for -boolean', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = -true;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Unary minus');
    expect(diagnostics[0].message).toContain('requires numeric operand');
  });

  it('should type check !boolean = boolean', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = !true;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should report error for !byte', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = !42;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Logical NOT');
    expect(diagnostics[0].message).toContain('requires boolean operand');
  });

  it('should type check ~byte = byte', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = ~42;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should type check ~word = word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = ~1000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should report error for ~boolean', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = ~true;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Bitwise NOT');
    expect(diagnostics[0].message).toContain('requires numeric operand');
  });
});

// ============================================
// COMPLEX EXPRESSIONS
// ============================================

describe('TypeChecker - Complex Expressions', () => {
  it('should handle chained arithmetic', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 + 20 * 3;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle comparison of arithmetic results', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = (10 + 20) < (30 + 40);
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle logical combinations', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = (10 < 20) && (30 > 25);
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle nested unary expressions', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = !!true;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should handle mixed byte and word operations', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = 10 + 1000 + 20;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[0] as any;
    // Result should be word because of 1000
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should handle variables in expressions', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let x: byte = 10;
      let y: byte = 20;
      let result = x + y;
    `);

    expect(diagnostics).toHaveLength(0);
    const varDecl = program.getDeclarations()[2] as any;
    expect(varDecl.getInitializer().getTypeInfo().kind).toBe(TypeKind.Byte);
  });
});
