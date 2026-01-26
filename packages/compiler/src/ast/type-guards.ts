/**
 * Type Guard Utilities for AST Nodes
 *
 * This module provides type guard functions for all AST node types.
 * Type guards enable TypeScript's type narrowing, allowing safe type-specific
 * operations without using 'any' casts.
 *
 * Pattern: function isXxxNode(node: ASTNode): node is XxxNode
 *
 * Usage:
 * ```typescript
 * if (isVariableDecl(node)) {
 *   // TypeScript knows node is VariableDecl here
 *   const name = node.getName();
 * }
 * ```
 *
 * @module ast/type-guards
 */

import { ASTNode, Expression, Statement, Declaration } from './base.js';

import {
  ArrayLiteralExpression,
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
  TernaryExpression,
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
  DoWhileStatement,
  MatchStatement,
  SwitchStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from './nodes.js';

// ============================================
// BASE TYPE GUARDS
// ============================================

/**
 * Type guard for Expression base class
 *
 * @param node - AST node to check
 * @returns True if node is an Expression
 */
export function isExpression(node: ASTNode | null | undefined): node is Expression {
  return node instanceof Expression;
}

/**
 * Type guard for Statement base class
 *
 * @param node - AST node to check
 * @returns True if node is a Statement
 */
export function isStatement(node: ASTNode | null | undefined): node is Statement {
  return node instanceof Statement;
}

/**
 * Type guard for Declaration base class
 *
 * @param node - AST node to check
 * @returns True if node is a Declaration
 */
export function isDeclaration(node: ASTNode | null | undefined): node is Declaration {
  return node instanceof Declaration;
}

// ============================================
// PROGRAM STRUCTURE TYPE GUARDS
// ============================================

/**
 * Type guard for Program nodes
 *
 * @param node - AST node to check
 * @returns True if node is a Program
 */
export function isProgram(node: ASTNode | null | undefined): node is Program {
  return node instanceof Program;
}

/**
 * Type guard for ModuleDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a ModuleDecl
 */
export function isModuleDecl(node: ASTNode | null | undefined): node is ModuleDecl {
  return node instanceof ModuleDecl;
}

// ============================================
// IMPORT/EXPORT TYPE GUARDS
// ============================================

/**
 * Type guard for ImportDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is an ImportDecl
 */
export function isImportDecl(node: ASTNode | null | undefined): node is ImportDecl {
  return node instanceof ImportDecl;
}

/**
 * Type guard for ExportDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is an ExportDecl
 */
export function isExportDecl(node: ASTNode | null | undefined): node is ExportDecl {
  return node instanceof ExportDecl;
}

// ============================================
// DECLARATION TYPE GUARDS
// ============================================

/**
 * Type guard for FunctionDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a FunctionDecl
 */
export function isFunctionDecl(node: ASTNode | null | undefined): node is FunctionDecl {
  return node instanceof FunctionDecl;
}

/**
 * Type guard for VariableDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a VariableDecl
 */
export function isVariableDecl(node: ASTNode | null | undefined): node is VariableDecl {
  return node instanceof VariableDecl;
}

/**
 * Type guard for TypeDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a TypeDecl
 */
export function isTypeDecl(node: ASTNode | null | undefined): node is TypeDecl {
  return node instanceof TypeDecl;
}

/**
 * Type guard for EnumDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is an EnumDecl
 */
export function isEnumDecl(node: ASTNode | null | undefined): node is EnumDecl {
  return node instanceof EnumDecl;
}

// ============================================
// EXPRESSION TYPE GUARDS
// ============================================

/**
 * Type guard for BinaryExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is a BinaryExpression
 */
export function isBinaryExpression(node: ASTNode | null | undefined): node is BinaryExpression {
  return node instanceof BinaryExpression;
}

/**
 * Type guard for UnaryExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is a UnaryExpression
 */
export function isUnaryExpression(node: ASTNode | null | undefined): node is UnaryExpression {
  return node instanceof UnaryExpression;
}

/**
 * Type guard for TernaryExpression nodes (condition ? then : else)
 *
 * @param node - AST node to check
 * @returns True if node is a TernaryExpression
 */
export function isTernaryExpression(node: ASTNode | null | undefined): node is TernaryExpression {
  return node instanceof TernaryExpression;
}

/**
 * Type guard for LiteralExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is a LiteralExpression
 */
export function isLiteralExpression(node: ASTNode | null | undefined): node is LiteralExpression {
  return node instanceof LiteralExpression;
}

/**
 * Type guard for IdentifierExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is an IdentifierExpression
 */
export function isIdentifierExpression(
  node: ASTNode | null | undefined
): node is IdentifierExpression {
  return node instanceof IdentifierExpression;
}

/**
 * Type guard for CallExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is a CallExpression
 */
export function isCallExpression(node: ASTNode | null | undefined): node is CallExpression {
  return node instanceof CallExpression;
}

/**
 * Type guard for IndexExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is an IndexExpression
 */
export function isIndexExpression(node: ASTNode | null | undefined): node is IndexExpression {
  return node instanceof IndexExpression;
}

/**
 * Type guard for MemberExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is a MemberExpression
 */
export function isMemberExpression(node: ASTNode | null | undefined): node is MemberExpression {
  return node instanceof MemberExpression;
}

/**
 * Type guard for AssignmentExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is an AssignmentExpression
 */
export function isAssignmentExpression(
  node: ASTNode | null | undefined
): node is AssignmentExpression {
  return node instanceof AssignmentExpression;
}

/**
 * Type guard for ArrayLiteralExpression nodes
 *
 * @param node - AST node to check
 * @returns True if node is an ArrayLiteralExpression
 */
export function isArrayLiteralExpression(
  node: ASTNode | null | undefined
): node is ArrayLiteralExpression {
  return node instanceof ArrayLiteralExpression;
}

// ============================================
// STATEMENT TYPE GUARDS
// ============================================

/**
 * Type guard for ReturnStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a ReturnStatement
 */
export function isReturnStatement(node: ASTNode | null | undefined): node is ReturnStatement {
  return node instanceof ReturnStatement;
}

/**
 * Type guard for IfStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is an IfStatement
 */
export function isIfStatement(node: ASTNode | null | undefined): node is IfStatement {
  return node instanceof IfStatement;
}

/**
 * Type guard for WhileStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a WhileStatement
 */
export function isWhileStatement(node: ASTNode | null | undefined): node is WhileStatement {
  return node instanceof WhileStatement;
}

/**
 * Type guard for ForStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a ForStatement
 */
export function isForStatement(node: ASTNode | null | undefined): node is ForStatement {
  return node instanceof ForStatement;
}

/**
 * Type guard for MatchStatement nodes (deprecated - use isSwitchStatement)
 *
 * @param node - AST node to check
 * @returns True if node is a MatchStatement
 * @deprecated Use isSwitchStatement instead
 */
export function isMatchStatement(node: ASTNode | null | undefined): node is MatchStatement {
  return node instanceof MatchStatement;
}

/**
 * Type guard for SwitchStatement nodes (C-style switch/case)
 *
 * @param node - AST node to check
 * @returns True if node is a SwitchStatement
 */
export function isSwitchStatement(node: ASTNode | null | undefined): node is SwitchStatement {
  return node instanceof SwitchStatement;
}

/**
 * Type guard for DoWhileStatement nodes (C-style do { } while)
 *
 * @param node - AST node to check
 * @returns True if node is a DoWhileStatement
 */
export function isDoWhileStatement(node: ASTNode | null | undefined): node is DoWhileStatement {
  return node instanceof DoWhileStatement;
}

/**
 * Type guard for BreakStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a BreakStatement
 */
export function isBreakStatement(node: ASTNode | null | undefined): node is BreakStatement {
  return node instanceof BreakStatement;
}

/**
 * Type guard for ContinueStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a ContinueStatement
 */
export function isContinueStatement(node: ASTNode | null | undefined): node is ContinueStatement {
  return node instanceof ContinueStatement;
}

/**
 * Type guard for ExpressionStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is an ExpressionStatement
 */
export function isExpressionStatement(
  node: ASTNode | null | undefined
): node is ExpressionStatement {
  return node instanceof ExpressionStatement;
}

/**
 * Type guard for BlockStatement nodes
 *
 * @param node - AST node to check
 * @returns True if node is a BlockStatement
 */
export function isBlockStatement(node: ASTNode | null | undefined): node is BlockStatement {
  return node instanceof BlockStatement;
}

// ============================================
// MEMORY-MAPPED DECLARATION TYPE GUARDS
// ============================================

/**
 * Type guard for SimpleMapDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a SimpleMapDecl
 */
export function isSimpleMapDecl(node: ASTNode | null | undefined): node is SimpleMapDecl {
  return node instanceof SimpleMapDecl;
}

/**
 * Type guard for RangeMapDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a RangeMapDecl
 */
export function isRangeMapDecl(node: ASTNode | null | undefined): node is RangeMapDecl {
  return node instanceof RangeMapDecl;
}

/**
 * Type guard for SequentialStructMapDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is a SequentialStructMapDecl
 */
export function isSequentialStructMapDecl(
  node: ASTNode | null | undefined
): node is SequentialStructMapDecl {
  return node instanceof SequentialStructMapDecl;
}

/**
 * Type guard for ExplicitStructMapDecl nodes
 *
 * @param node - AST node to check
 * @returns True if node is an ExplicitStructMapDecl
 */
export function isExplicitStructMapDecl(
  node: ASTNode | null | undefined
): node is ExplicitStructMapDecl {
  return node instanceof ExplicitStructMapDecl;
}

// ============================================
// CONVENIENCE TYPE GUARD GROUPS
// ============================================

/**
 * Type guard for any @map declaration node
 *
 * Convenience function to check if a node is any type of @map declaration.
 *
 * @param node - AST node to check
 * @returns True if node is any @map declaration type
 */
export function isMapDecl(
  node: ASTNode | null | undefined
): node is SimpleMapDecl | RangeMapDecl | SequentialStructMapDecl | ExplicitStructMapDecl {
  return (
    isSimpleMapDecl(node) ||
    isRangeMapDecl(node) ||
    isSequentialStructMapDecl(node) ||
    isExplicitStructMapDecl(node)
  );
}

/**
 * Type guard for loop statements (for/while/do-while)
 *
 * Convenience function to check if a node is any loop statement type.
 *
 * @param node - AST node to check
 * @returns True if node is a loop statement
 */
export function isLoopStatement(
  node: ASTNode | null | undefined
): node is WhileStatement | ForStatement | DoWhileStatement {
  return isWhileStatement(node) || isForStatement(node) || isDoWhileStatement(node);
}