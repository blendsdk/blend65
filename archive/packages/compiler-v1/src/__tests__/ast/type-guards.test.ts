/**
 * Type Guard Tests
 *
 * Comprehensive tests for all AST node type guards.
 * Verifies correct type narrowing and handles edge cases (null, undefined, wrong types).
 */

import { describe, expect, it } from 'vitest';
import {
  isExpression,
  isStatement,
  isDeclaration,
  isProgram,
  isModuleDecl,
  isImportDecl,
  isExportDecl,
  isFunctionDecl,
  isVariableDecl,
  isTypeDecl,
  isEnumDecl,
  isBinaryExpression,
  isUnaryExpression,
  isLiteralExpression,
  isIdentifierExpression,
  isCallExpression,
  isIndexExpression,
  isMemberExpression,
  isAssignmentExpression,
  isReturnStatement,
  isIfStatement,
  isWhileStatement,
  isForStatement,
  isMatchStatement,
  isBreakStatement,
  isContinueStatement,
  isExpressionStatement,
  isBlockStatement,
  isSimpleMapDecl,
  isRangeMapDecl,
  isSequentialStructMapDecl,
  isExplicitStructMapDecl,
  isMapDecl,
  isLoopStatement,
} from '../../ast/type-guards.js';

import {
  Program,
  ModuleDecl,
  ImportDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  TypeDecl,
  EnumDecl,
  BinaryExpression,
  UnaryExpression,
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from '../../ast/nodes.js';

import { TokenType } from '../../lexer/types.js';

// Helper to create minimal source locations
const mockLocation = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

describe('Type Guards - Base Classes', () => {
  it('isExpression returns true for expressions', () => {
    const literal = new LiteralExpression(42, mockLocation);
    const identifier = new IdentifierExpression('x', mockLocation);

    expect(isExpression(literal)).toBe(true);
    expect(isExpression(identifier)).toBe(true);
  });

  it('isExpression returns false for non-expressions', () => {
    const returnStmt = new ReturnStatement(null, mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isExpression(returnStmt)).toBe(false);
    expect(isExpression(varDecl)).toBe(false);
  });

  it('isStatement returns true for statements', () => {
    const returnStmt = new ReturnStatement(null, mockLocation);
    const breakStmt = new BreakStatement(mockLocation);

    expect(isStatement(returnStmt)).toBe(true);
    expect(isStatement(breakStmt)).toBe(true);
  });

  it('isStatement returns false for non-statements', () => {
    const literal = new LiteralExpression(42, mockLocation);

    expect(isStatement(literal)).toBe(false);
  });

  it('isStatement returns true for declarations (declarations are statements)', () => {
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);
    const funcDecl = new FunctionDecl('foo', [], null, [], mockLocation);

    // Declarations extend Statement, so they ARE statements
    expect(isStatement(varDecl)).toBe(true);
    expect(isStatement(funcDecl)).toBe(true);
  });

  it('isDeclaration returns true for declarations', () => {
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);
    const funcDecl = new FunctionDecl('foo', [], null, [], mockLocation);

    expect(isDeclaration(varDecl)).toBe(true);
    expect(isDeclaration(funcDecl)).toBe(true);
  });

  it('isDeclaration returns false for non-declarations', () => {
    const literal = new LiteralExpression(42, mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isDeclaration(literal)).toBe(false);
    expect(isDeclaration(returnStmt)).toBe(false);
  });
});

describe('Type Guards - Program Structure', () => {
  it('isProgram correctly identifies Program nodes', () => {
    const module = new ModuleDecl(['test'], mockLocation);
    const program = new Program(module, [], mockLocation);

    expect(isProgram(program)).toBe(true);
    expect(isProgram(module)).toBe(false);
  });

  it('isModuleDecl correctly identifies ModuleDecl nodes', () => {
    const module = new ModuleDecl(['test'], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isModuleDecl(module)).toBe(true);
    expect(isModuleDecl(varDecl)).toBe(false);
  });
});

describe('Type Guards - Import/Export', () => {
  it('isImportDecl correctly identifies ImportDecl nodes', () => {
    const importDecl = new ImportDecl(['foo'], ['bar'], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isImportDecl(importDecl)).toBe(true);
    expect(isImportDecl(varDecl)).toBe(false);
  });

  it('isExportDecl correctly identifies ExportDecl nodes', () => {
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);
    const exportDecl = new ExportDecl(varDecl, mockLocation);

    expect(isExportDecl(exportDecl)).toBe(true);
    expect(isExportDecl(varDecl)).toBe(false);
  });
});

describe('Type Guards - Declarations', () => {
  it('isFunctionDecl correctly identifies FunctionDecl nodes', () => {
    const funcDecl = new FunctionDecl('foo', [], null, [], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isFunctionDecl(funcDecl)).toBe(true);
    expect(isFunctionDecl(varDecl)).toBe(false);
  });

  it('isVariableDecl correctly identifies VariableDecl nodes', () => {
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);
    const funcDecl = new FunctionDecl('foo', [], null, [], mockLocation);

    expect(isVariableDecl(varDecl)).toBe(true);
    expect(isVariableDecl(funcDecl)).toBe(false);
  });

  it('isTypeDecl correctly identifies TypeDecl nodes', () => {
    const typeDecl = new TypeDecl('MyType', 'byte', mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isTypeDecl(typeDecl)).toBe(true);
    expect(isTypeDecl(varDecl)).toBe(false);
  });

  it('isEnumDecl correctly identifies EnumDecl nodes', () => {
    const enumDecl = new EnumDecl('Direction', [], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isEnumDecl(enumDecl)).toBe(true);
    expect(isEnumDecl(varDecl)).toBe(false);
  });
});

describe('Type Guards - Expressions', () => {
  it('isBinaryExpression correctly identifies BinaryExpression nodes', () => {
    const left = new LiteralExpression(1, mockLocation);
    const right = new LiteralExpression(2, mockLocation);
    const binary = new BinaryExpression(left, TokenType.PLUS, right, mockLocation);

    expect(isBinaryExpression(binary)).toBe(true);
    expect(isBinaryExpression(left)).toBe(false);
  });

  it('isUnaryExpression correctly identifies UnaryExpression nodes', () => {
    const operand = new LiteralExpression(42, mockLocation);
    const unary = new UnaryExpression(TokenType.MINUS, operand, mockLocation);

    expect(isUnaryExpression(unary)).toBe(true);
    expect(isUnaryExpression(operand)).toBe(false);
  });

  it('isLiteralExpression correctly identifies LiteralExpression nodes', () => {
    const literal = new LiteralExpression(42, mockLocation);
    const identifier = new IdentifierExpression('x', mockLocation);

    expect(isLiteralExpression(literal)).toBe(true);
    expect(isLiteralExpression(identifier)).toBe(false);
  });

  it('isIdentifierExpression correctly identifies IdentifierExpression nodes', () => {
    const identifier = new IdentifierExpression('x', mockLocation);
    const literal = new LiteralExpression(42, mockLocation);

    expect(isIdentifierExpression(identifier)).toBe(true);
    expect(isIdentifierExpression(literal)).toBe(false);
  });

  it('isCallExpression correctly identifies CallExpression nodes', () => {
    const callee = new IdentifierExpression('foo', mockLocation);
    const callExpr = new CallExpression(callee, [], mockLocation);

    expect(isCallExpression(callExpr)).toBe(true);
    expect(isCallExpression(callee)).toBe(false);
  });

  it('isIndexExpression correctly identifies IndexExpression nodes', () => {
    const array = new IdentifierExpression('arr', mockLocation);
    const index = new LiteralExpression(0, mockLocation);
    const indexExpr = new IndexExpression(array, index, mockLocation);

    expect(isIndexExpression(indexExpr)).toBe(true);
    expect(isIndexExpression(array)).toBe(false);
  });

  it('isMemberExpression correctly identifies MemberExpression nodes', () => {
    const object = new IdentifierExpression('obj', mockLocation);
    const memberExpr = new MemberExpression(object, 'prop', mockLocation);

    expect(isMemberExpression(memberExpr)).toBe(true);
    expect(isMemberExpression(object)).toBe(false);
  });

  it('isAssignmentExpression correctly identifies AssignmentExpression nodes', () => {
    const target = new IdentifierExpression('x', mockLocation);
    const value = new LiteralExpression(42, mockLocation);
    const assignExpr = new AssignmentExpression(target, TokenType.ASSIGN, value, mockLocation);

    expect(isAssignmentExpression(assignExpr)).toBe(true);
    expect(isAssignmentExpression(target)).toBe(false);
  });
});

describe('Type Guards - Statements', () => {
  it('isReturnStatement correctly identifies ReturnStatement nodes', () => {
    const returnStmt = new ReturnStatement(null, mockLocation);
    const breakStmt = new BreakStatement(mockLocation);

    expect(isReturnStatement(returnStmt)).toBe(true);
    expect(isReturnStatement(breakStmt)).toBe(false);
  });

  it('isIfStatement correctly identifies IfStatement nodes', () => {
    const condition = new LiteralExpression(true, mockLocation);
    const ifStmt = new IfStatement(condition, [], null, mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isIfStatement(ifStmt)).toBe(true);
    expect(isIfStatement(returnStmt)).toBe(false);
  });

  it('isWhileStatement correctly identifies WhileStatement nodes', () => {
    const condition = new LiteralExpression(true, mockLocation);
    const whileStmt = new WhileStatement(condition, [], mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isWhileStatement(whileStmt)).toBe(true);
    expect(isWhileStatement(returnStmt)).toBe(false);
  });

  it('isForStatement correctly identifies ForStatement nodes', () => {
    const start = new LiteralExpression(0, mockLocation);
    const end = new LiteralExpression(10, mockLocation);
    const forStmt = new ForStatement('i', start, end, [], mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isForStatement(forStmt)).toBe(true);
    expect(isForStatement(returnStmt)).toBe(false);
  });

  it('isMatchStatement correctly identifies MatchStatement nodes', () => {
    const value = new IdentifierExpression('x', mockLocation);
    const matchStmt = new MatchStatement(value, [], null, mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isMatchStatement(matchStmt)).toBe(true);
    expect(isMatchStatement(returnStmt)).toBe(false);
  });

  it('isBreakStatement correctly identifies BreakStatement nodes', () => {
    const breakStmt = new BreakStatement(mockLocation);
    const continueStmt = new ContinueStatement(mockLocation);

    expect(isBreakStatement(breakStmt)).toBe(true);
    expect(isBreakStatement(continueStmt)).toBe(false);
  });

  it('isContinueStatement correctly identifies ContinueStatement nodes', () => {
    const continueStmt = new ContinueStatement(mockLocation);
    const breakStmt = new BreakStatement(mockLocation);

    expect(isContinueStatement(continueStmt)).toBe(true);
    expect(isContinueStatement(breakStmt)).toBe(false);
  });

  it('isExpressionStatement correctly identifies ExpressionStatement nodes', () => {
    const expr = new LiteralExpression(42, mockLocation);
    const exprStmt = new ExpressionStatement(expr, mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isExpressionStatement(exprStmt)).toBe(true);
    expect(isExpressionStatement(returnStmt)).toBe(false);
  });

  it('isBlockStatement correctly identifies BlockStatement nodes', () => {
    const blockStmt = new BlockStatement([], mockLocation);
    const returnStmt = new ReturnStatement(null, mockLocation);

    expect(isBlockStatement(blockStmt)).toBe(true);
    expect(isBlockStatement(returnStmt)).toBe(false);
  });
});

describe('Type Guards - Memory-Mapped Declarations', () => {
  it('isSimpleMapDecl correctly identifies SimpleMapDecl nodes', () => {
    const address = new LiteralExpression(0xd020, mockLocation);
    const simpleMap = new SimpleMapDecl('borderColor', address, 'byte', mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isSimpleMapDecl(simpleMap)).toBe(true);
    expect(isSimpleMapDecl(varDecl)).toBe(false);
  });

  it('isRangeMapDecl correctly identifies RangeMapDecl nodes', () => {
    const start = new LiteralExpression(0xd000, mockLocation);
    const end = new LiteralExpression(0xd02e, mockLocation);
    const rangeMap = new RangeMapDecl('sprites', start, end, 'byte', mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isRangeMapDecl(rangeMap)).toBe(true);
    expect(isRangeMapDecl(varDecl)).toBe(false);
  });

  it('isSequentialStructMapDecl correctly identifies SequentialStructMapDecl nodes', () => {
    const address = new LiteralExpression(0xd400, mockLocation);
    const seqMap = new SequentialStructMapDecl('sid', address, [], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isSequentialStructMapDecl(seqMap)).toBe(true);
    expect(isSequentialStructMapDecl(varDecl)).toBe(false);
  });

  it('isExplicitStructMapDecl correctly identifies ExplicitStructMapDecl nodes', () => {
    const address = new LiteralExpression(0xd000, mockLocation);
    const explicitMap = new ExplicitStructMapDecl('vic', address, [], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isExplicitStructMapDecl(explicitMap)).toBe(true);
    expect(isExplicitStructMapDecl(varDecl)).toBe(false);
  });
});

describe('Type Guards - Convenience Functions', () => {
  it('isMapDecl identifies all @map declaration types', () => {
    const address = new LiteralExpression(0xd020, mockLocation);
    const simpleMap = new SimpleMapDecl('borderColor', address, 'byte', mockLocation);
    const rangeMap = new RangeMapDecl('sprites', address, address, 'byte', mockLocation);
    const seqMap = new SequentialStructMapDecl('sid', address, [], mockLocation);
    const explicitMap = new ExplicitStructMapDecl('vic', address, [], mockLocation);
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);

    expect(isMapDecl(simpleMap)).toBe(true);
    expect(isMapDecl(rangeMap)).toBe(true);
    expect(isMapDecl(seqMap)).toBe(true);
    expect(isMapDecl(explicitMap)).toBe(true);
    expect(isMapDecl(varDecl)).toBe(false);
  });

  it('isLoopStatement identifies for and while statements', () => {
    const condition = new LiteralExpression(true, mockLocation);
    const start = new LiteralExpression(0, mockLocation);
    const end = new LiteralExpression(10, mockLocation);
    const whileStmt = new WhileStatement(condition, [], mockLocation);
    const forStmt = new ForStatement('i', start, end, [], mockLocation);
    const ifStmt = new IfStatement(condition, [], null, mockLocation);

    expect(isLoopStatement(whileStmt)).toBe(true);
    expect(isLoopStatement(forStmt)).toBe(true);
    expect(isLoopStatement(ifStmt)).toBe(false);
  });
});

describe('Type Guards - Edge Cases', () => {
  it('handles null correctly', () => {
    expect(isExpression(null)).toBe(false);
    expect(isStatement(null)).toBe(false);
    expect(isDeclaration(null)).toBe(false);
    expect(isVariableDecl(null)).toBe(false);
    expect(isLiteralExpression(null)).toBe(false);
  });

  it('handles undefined correctly', () => {
    expect(isExpression(undefined)).toBe(false);
    expect(isStatement(undefined)).toBe(false);
    expect(isDeclaration(undefined)).toBe(false);
    expect(isVariableDecl(undefined)).toBe(false);
    expect(isLiteralExpression(undefined)).toBe(false);
  });

  it('correctly distinguishes between similar node types', () => {
    const varDecl = new VariableDecl('x', 'byte', null, mockLocation);
    const funcDecl = new FunctionDecl('foo', [], null, [], mockLocation);

    // Both are declarations, but different types
    expect(isDeclaration(varDecl)).toBe(true);
    expect(isDeclaration(funcDecl)).toBe(true);
    expect(isVariableDecl(varDecl)).toBe(true);
    expect(isVariableDecl(funcDecl)).toBe(false);
    expect(isFunctionDecl(funcDecl)).toBe(true);
    expect(isFunctionDecl(varDecl)).toBe(false);
  });
});
