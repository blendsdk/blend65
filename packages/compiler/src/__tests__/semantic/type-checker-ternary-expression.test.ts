/**
 * Type Checker Tests - Ternary Expression
 *
 * Tests for ternary (conditional) expression type checking.
 * Syntax: condition ? thenBranch : elseBranch
 *
 * Type rules:
 * - Condition must be boolean
 * - Then and else branches must have compatible types
 * - Result type is the common/unified type of both branches
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
// BASIC TERNARY EXPRESSIONS
// ============================================

describe('TypeChecker - Ternary Expressions (Basic)', () => {
  it('should type check ternary with byte branches = byte', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 10 : 20;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should type check ternary with word branches = word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 1000 : 2000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should type check ternary with boolean branches = boolean', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? true : false;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Boolean);
  });

  it('should type check ternary with false condition', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = false ? 10 : 20;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });
});

// ============================================
// TYPE PROMOTION IN TERNARY
// ============================================

describe('TypeChecker - Ternary Expressions (Type Promotion)', () => {
  it('should promote byte + word branches to word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 10 : 1000;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    // Mixed byte/word should promote to word
    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });

  it('should promote word + byte branches to word', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 1000 : 10;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });
});

// ============================================
// CONDITION TYPE ERRORS
// ============================================

describe('TypeChecker - Ternary Expressions (Condition Errors)', () => {
  it('should report error for byte condition', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = 42 ? 10 : 20;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Ternary condition must be boolean');
    expect(diagnostics[0].message).toContain('byte');
  });

  it('should report error for word condition', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = 1000 ? 10 : 20;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Ternary condition must be boolean');
    expect(diagnostics[0].message).toContain('word');
  });
});

// ============================================
// BRANCH TYPE ERRORS
// ============================================

describe('TypeChecker - Ternary Expressions (Branch Errors)', () => {
  it('should report error for incompatible branch types (boolean vs byte)', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = true ? true : 10;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Ternary branches have incompatible types');
    expect(diagnostics[0].message).toContain('boolean');
    expect(diagnostics[0].message).toContain('byte');
  });

  it('should report error for incompatible branch types (byte vs boolean)', () => {
    const { diagnostics } = parseAndTypeCheck(`
      let result = true ? 10 : false;
    `);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Ternary branches have incompatible types');
  });
});

// ============================================
// TERNARY WITH EXPRESSIONS
// ============================================

describe('TypeChecker - Ternary Expressions (With Expressions)', () => {
  it('should handle comparison as condition', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let x: byte = 10;
      let result = x > 5 ? 1 : 0;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[1] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle logical AND as condition', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let a: boolean = true;
      let b: boolean = false;
      let result = a && b ? 100 : 200;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[2] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle logical OR as condition', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let a: boolean = true;
      let b: boolean = false;
      let result = a || b ? 100 : 200;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[2] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle arithmetic in branches', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 10 + 20 : 5 * 6;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle variables in branches', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let x: byte = 10;
      let y: byte = 20;
      let result = true ? x : y;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[2] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });
});

// ============================================
// NESTED TERNARY EXPRESSIONS
// ============================================

describe('TypeChecker - Ternary Expressions (Nested)', () => {
  it('should handle nested ternary in else branch (right-associative)', () => {
    // a ? b : c ? d : e parses as a ? b : (c ? d : e)
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 1 : false ? 2 : 3;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle nested ternary in then branch', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? (false ? 1 : 2) : 3;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle deeply nested ternary', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let result = true ? 1 : true ? 2 : true ? 3 : 4;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[0] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });
});

// ============================================
// C64 IDIOM PATTERNS
// ============================================

describe('TypeChecker - Ternary Expressions (C64 Idioms)', () => {
  it('should handle sprite visibility pattern', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let spriteEnabled: boolean = true;
      let visibility: byte = spriteEnabled ? 1 : 0;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[1] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle color selection pattern', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let isCollision: boolean = false;
      let color: byte = isCollision ? 2 : 14;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[1] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle direction selection pattern', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let goingRight: boolean = true;
      let dx: byte = goingRight ? 1 : 255;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[1] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Byte);
  });

  it('should handle address selection pattern', () => {
    const { program, diagnostics } = parseAndTypeCheck(`
      let useHighMem: boolean = true;
      let screenAddr: word = useHighMem ? $0800 : $0400;
    `);

    expect(diagnostics).toHaveLength(0);

    const varDecl = program.getDeclarations()[1] as any;
    const initializer = varDecl.getInitializer();

    expect(initializer.getTypeInfo().kind).toBe(TypeKind.Word);
  });
});