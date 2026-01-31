/**
 * Type Guard Utilities for AST Nodes - Blend65 Compiler v2
 *
 * This module provides type guard functions for all AST node types.
 * Type guards enable TypeScript's type narrowing, allowing safe type-specific
 * operations without using 'any' casts.
 *
 * Pattern: function isXxxNode(node: ASTNode): node is XxxNode
 *
 * v2 Changes: Removed @map declaration type guards
 *
 * @example
 * ```typescript
 * if (isVariableDecl(node)) {
 *   // TypeScript knows node is VariableDecl here
 *   const name = node.getName();
 * }
 * ```
 */

import { ASTNode, Expression, Statement, Declaration } from './base.js';

import {
  ArrayLiteralExpression,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  IdentifierExpression,
  IndexExpression,
  LiteralExpression,
  MemberExpression,
  TernaryExpression,
  UnaryExpression,
} from './expressions.js';

import {
  BlockStatement,
  BreakStatement,
  ContinueStatement,
  DoWhileStatement,
  ExpressionStatement,
  ForStatement,
  IfStatement,
  MatchStatement,
  ReturnStatement,
  SwitchStatement,
  WhileStatement,
} from './statements.js';

import { EnumDecl, FunctionDecl, TypeDecl, VariableDecl } from './declarations.js';

import { ExportDecl, ImportDecl, ModuleDecl, Program } from './program.js';

// ============================================
// BASE TYPE GUARDS
// ============================================

/**
 * Type guard for Expression base class
 */
export function isExpression(node: ASTNode | null | undefined): node is Expression {
  return node instanceof Expression;
}

/**
 * Type guard for Statement base class
 */
export function isStatement(node: ASTNode | null | undefined): node is Statement {
  return node instanceof Statement;
}

/**
 * Type guard for Declaration base class
 */
export function isDeclaration(node: ASTNode | null | undefined): node is Declaration {
  return node instanceof Declaration;
}

// ============================================
// PROGRAM STRUCTURE TYPE GUARDS
// ============================================

/**
 * Type guard for Program nodes
 */
export function isProgram(node: ASTNode | null | undefined): node is Program {
  return node instanceof Program;
}

/**
 * Type guard for ModuleDecl nodes
 */
export function isModuleDecl(node: ASTNode | null | undefined): node is ModuleDecl {
  return node instanceof ModuleDecl;
}

// ============================================
// IMPORT/EXPORT TYPE GUARDS
// ============================================

/**
 * Type guard for ImportDecl nodes
 */
export function isImportDecl(node: ASTNode | null | undefined): node is ImportDecl {
  return node instanceof ImportDecl;
}

/**
 * Type guard for ExportDecl nodes
 */
export function isExportDecl(node: ASTNode | null | undefined): node is ExportDecl {
  return node instanceof ExportDecl;
}

// ============================================
// DECLARATION TYPE GUARDS
// ============================================

/**
 * Type guard for FunctionDecl nodes
 */
export function isFunctionDecl(node: ASTNode | null | undefined): node is FunctionDecl {
  return node instanceof FunctionDecl;
}

/**
 * Type guard for VariableDecl nodes
 */
export function isVariableDecl(node: ASTNode | null | undefined): node is VariableDecl {
  return node instanceof VariableDecl;
}

/**
 * Type guard for TypeDecl nodes
 */
export function isTypeDecl(node: ASTNode | null | undefined): node is TypeDecl {
  return node instanceof TypeDecl;
}

/**
 * Type guard for EnumDecl nodes
 */
export function isEnumDecl(node: ASTNode | null | undefined): node is EnumDecl {
  return node instanceof EnumDecl;
}

// ============================================
// EXPRESSION TYPE GUARDS
// ============================================

/**
 * Type guard for BinaryExpression nodes
 */
export function isBinaryExpression(node: ASTNode | null | undefined): node is BinaryExpression {
  return node instanceof BinaryExpression;
}

/**
 * Type guard for UnaryExpression nodes
 */
export function isUnaryExpression(node: ASTNode | null | undefined): node is UnaryExpression {
  return node instanceof UnaryExpression;
}

/**
 * Type guard for TernaryExpression nodes
 */
export function isTernaryExpression(node: ASTNode | null | undefined): node is TernaryExpression {
  return node instanceof TernaryExpression;
}

/**
 * Type guard for LiteralExpression nodes
 */
export function isLiteralExpression(node: ASTNode | null | undefined): node is LiteralExpression {
  return node instanceof LiteralExpression;
}

/**
 * Type guard for IdentifierExpression nodes
 */
export function isIdentifierExpression(
  node: ASTNode | null | undefined
): node is IdentifierExpression {
  return node instanceof IdentifierExpression;
}

/**
 * Type guard for CallExpression nodes
 */
export function isCallExpression(node: ASTNode | null | undefined): node is CallExpression {
  return node instanceof CallExpression;
}

/**
 * Type guard for IndexExpression nodes
 */
export function isIndexExpression(node: ASTNode | null | undefined): node is IndexExpression {
  return node instanceof IndexExpression;
}

/**
 * Type guard for MemberExpression nodes
 */
export function isMemberExpression(node: ASTNode | null | undefined): node is MemberExpression {
  return node instanceof MemberExpression;
}

/**
 * Type guard for AssignmentExpression nodes
 */
export function isAssignmentExpression(
  node: ASTNode | null | undefined
): node is AssignmentExpression {
  return node instanceof AssignmentExpression;
}

/**
 * Type guard for ArrayLiteralExpression nodes
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
 */
export function isReturnStatement(node: ASTNode | null | undefined): node is ReturnStatement {
  return node instanceof ReturnStatement;
}

/**
 * Type guard for IfStatement nodes
 */
export function isIfStatement(node: ASTNode | null | undefined): node is IfStatement {
  return node instanceof IfStatement;
}

/**
 * Type guard for WhileStatement nodes
 */
export function isWhileStatement(node: ASTNode | null | undefined): node is WhileStatement {
  return node instanceof WhileStatement;
}

/**
 * Type guard for ForStatement nodes
 */
export function isForStatement(node: ASTNode | null | undefined): node is ForStatement {
  return node instanceof ForStatement;
}

/**
 * Type guard for MatchStatement nodes (deprecated - use isSwitchStatement)
 * @deprecated Use isSwitchStatement instead
 */
export function isMatchStatement(node: ASTNode | null | undefined): node is MatchStatement {
  return node instanceof MatchStatement;
}

/**
 * Type guard for SwitchStatement nodes
 */
export function isSwitchStatement(node: ASTNode | null | undefined): node is SwitchStatement {
  return node instanceof SwitchStatement;
}

/**
 * Type guard for DoWhileStatement nodes
 */
export function isDoWhileStatement(node: ASTNode | null | undefined): node is DoWhileStatement {
  return node instanceof DoWhileStatement;
}

/**
 * Type guard for BreakStatement nodes
 */
export function isBreakStatement(node: ASTNode | null | undefined): node is BreakStatement {
  return node instanceof BreakStatement;
}

/**
 * Type guard for ContinueStatement nodes
 */
export function isContinueStatement(node: ASTNode | null | undefined): node is ContinueStatement {
  return node instanceof ContinueStatement;
}

/**
 * Type guard for ExpressionStatement nodes
 */
export function isExpressionStatement(
  node: ASTNode | null | undefined
): node is ExpressionStatement {
  return node instanceof ExpressionStatement;
}

/**
 * Type guard for BlockStatement nodes
 */
export function isBlockStatement(node: ASTNode | null | undefined): node is BlockStatement {
  return node instanceof BlockStatement;
}

// ============================================
// CONVENIENCE TYPE GUARD GROUPS
// ============================================

/**
 * Type guard for loop statements (for/while/do-while)
 *
 * Convenience function to check if a node is any loop statement type.
 */
export function isLoopStatement(
  node: ASTNode | null | undefined
): node is WhileStatement | ForStatement | DoWhileStatement {
  return isWhileStatement(node) || isForStatement(node) || isDoWhileStatement(node);
}