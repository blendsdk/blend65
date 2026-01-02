/**
 * AST Node Factory for Blend65
 *
 * Provides factory methods for creating AST nodes with proper metadata.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */

import { SourcePosition } from '@blend65/lexer';
import {
  ASTNode,
  Program,
  ModuleDeclaration,
  QualifiedName,
  Expression,
  Statement,
  Declaration,
  BinaryExpr,
  UnaryExpr,
  AssignmentExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  Identifier,
  Literal,
  ArrayLiteral,
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
  MatchCase,
  ReturnStatement,
  ExpressionStatement,
  FunctionDeclaration,
  VariableDeclaration,
  Parameter,
  ImportDeclaration,
  ImportSpecifier,
  ExportDeclaration,
  PrimitiveType,
  ArrayType,
  MemoryPlacement,
  StorageClass,
  TypeAnnotation
} from './ast-types/core.js';

/**
 * Metadata for AST node creation
 */
export interface NodeMetadata {
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * Factory class for creating AST nodes
 */
export class ASTNodeFactory {

  /**
   * Helper method to conditionally add metadata to nodes
   */
  private addMetadata<T extends ASTNode>(node: T, metadata?: NodeMetadata): T {
    if (metadata) {
      node.metadata = metadata;
    }
    return node;
  }

  // ============================================================================
  // Program and Module
  // ============================================================================

  createProgram(
    module: ModuleDeclaration,
    imports: ImportDeclaration[] = [],
    exports: ExportDeclaration[] = [],
    body: Declaration[] = [],
    metadata?: NodeMetadata
  ): Program {
    const node: Program = {
      type: 'Program',
      module,
      imports,
      exports,
      body
    };
    if (metadata) {
      node.metadata = metadata;
    }
    return node;
  }

  createModuleDeclaration(name: QualifiedName, metadata?: NodeMetadata): ModuleDeclaration {
    return this.addMetadata({
      type: 'ModuleDeclaration',
      name
    }, metadata);
  }

  createQualifiedName(parts: string[], metadata?: NodeMetadata): QualifiedName {
    return this.addMetadata({
      type: 'QualifiedName',
      parts
    }, metadata);
  }

  // ============================================================================
  // Expressions
  // ============================================================================

  createBinaryExpr(
    operator: string,
    left: Expression,
    right: Expression,
    metadata?: NodeMetadata
  ): BinaryExpr {
    return this.addMetadata({
      type: 'BinaryExpr',
      operator,
      left,
      right
    }, metadata);
  }

  createUnaryExpr(
    operator: string,
    operand: Expression,
    metadata?: NodeMetadata
  ): UnaryExpr {
    return this.addMetadata({
      type: 'UnaryExpr',
      operator,
      operand
    }, metadata);
  }

  createAssignmentExpr(
    operator: string,
    left: Expression,
    right: Expression,
    metadata?: NodeMetadata
  ): AssignmentExpr {
    return this.addMetadata({
      type: 'AssignmentExpr',
      operator,
      left,
      right
    }, metadata);
  }

  createCallExpr(
    callee: Expression,
    args: Expression[],
    metadata?: NodeMetadata
  ): CallExpr {
    return this.addMetadata({
      type: 'CallExpr',
      callee,
      args
    }, metadata);
  }

  createMemberExpr(
    object: Expression,
    property: string,
    metadata?: NodeMetadata
  ): MemberExpr {
    return this.addMetadata({
      type: 'MemberExpr',
      object,
      property
    }, metadata);
  }

  createIndexExpr(
    object: Expression,
    index: Expression,
    metadata?: NodeMetadata
  ): IndexExpr {
    return this.addMetadata({
      type: 'IndexExpr',
      object,
      index
    }, metadata);
  }

  createIdentifier(name: string, metadata?: NodeMetadata): Identifier {
    return this.addMetadata({
      type: 'Identifier',
      name
    }, metadata);
  }

  createLiteral(
    value: string | number | boolean,
    raw: string,
    metadata?: NodeMetadata
  ): Literal {
    return this.addMetadata({
      type: 'Literal',
      value,
      raw
    }, metadata);
  }

  createArrayLiteral(elements: Expression[], metadata?: NodeMetadata): ArrayLiteral {
    return this.addMetadata({
      type: 'ArrayLiteral',
      elements
    }, metadata);
  }

  // ============================================================================
  // Statements
  // ============================================================================

  createExpressionStatement(
    expression: Expression,
    metadata?: NodeMetadata
  ): ExpressionStatement {
    return this.addMetadata({
      type: 'ExpressionStatement',
      expression
    }, metadata);
  }

  createReturnStatement(
    value: Expression | null,
    metadata?: NodeMetadata
  ): ReturnStatement {
    return this.addMetadata({
      type: 'ReturnStatement',
      value
    }, metadata);
  }

  createIfStatement(
    condition: Expression,
    thenBody: Statement[],
    elseBody: Statement[] | null = null,
    metadata?: NodeMetadata
  ): IfStatement {
    return this.addMetadata({
      type: 'IfStatement',
      condition,
      thenBody,
      elseBody
    }, metadata);
  }

  createWhileStatement(
    condition: Expression,
    body: Statement[],
    metadata?: NodeMetadata
  ): WhileStatement {
    return this.addMetadata({
      type: 'WhileStatement',
      condition,
      body
    }, metadata);
  }

  createForStatement(
    variable: string,
    start: Expression,
    end: Expression,
    step: Expression | null,
    body: Statement[],
    metadata?: NodeMetadata
  ): ForStatement {
    return this.addMetadata({
      type: 'ForStatement',
      variable,
      start,
      end,
      step,
      body
    }, metadata);
  }

  createMatchStatement(
    discriminant: Expression,
    cases: MatchCase[],
    defaultCase: MatchCase | null = null,
    metadata?: NodeMetadata
  ): MatchStatement {
    return this.addMetadata({
      type: 'MatchStatement',
      discriminant,
      cases,
      defaultCase
    }, metadata);
  }

  createMatchCase(
    test: Expression | null,
    consequent: Statement[],
    metadata?: NodeMetadata
  ): MatchCase {
    return this.addMetadata({
      type: 'MatchCase',
      test,
      consequent
    }, metadata);
  }

  // ============================================================================
  // Declarations
  // ============================================================================

  createFunctionDeclaration(
    name: string,
    params: Parameter[],
    returnType: TypeAnnotation,
    body: Statement[],
    exported: boolean = false,
    metadata?: NodeMetadata
  ): FunctionDeclaration {
    return this.addMetadata({
      type: 'FunctionDeclaration',
      name,
      params,
      returnType,
      body,
      exported
    }, metadata);
  }

  createParameter(
    name: string,
    paramType: TypeAnnotation,
    optional: boolean = false,
    defaultValue: Expression | null = null,
    metadata?: NodeMetadata
  ): Parameter {
    return this.addMetadata({
      type: 'Parameter',
      name,
      paramType,
      optional,
      defaultValue
    }, metadata);
  }

  createVariableDeclaration(
    name: string,
    varType: TypeAnnotation,
    initializer: Expression | null = null,
    storageClass: StorageClass | null = null,
    placement: MemoryPlacement | null = null,
    exported: boolean = false,
    metadata?: NodeMetadata
  ): VariableDeclaration {
    return this.addMetadata({
      type: 'VariableDeclaration',
      storageClass,
      name,
      varType,
      initializer,
      placement,
      exported
    }, metadata);
  }

  createMemoryPlacement(address: Expression, metadata?: NodeMetadata): MemoryPlacement {
    return this.addMetadata({
      type: 'MemoryPlacement',
      address
    }, metadata);
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  createImportDeclaration(
    specifiers: ImportSpecifier[],
    source: QualifiedName,
    metadata?: NodeMetadata
  ): ImportDeclaration {
    return this.addMetadata({
      type: 'ImportDeclaration',
      specifiers,
      source
    }, metadata);
  }

  createImportSpecifier(
    imported: string,
    local: string | null = null,
    metadata?: NodeMetadata
  ): ImportSpecifier {
    return this.addMetadata({
      type: 'ImportSpecifier',
      imported,
      local
    }, metadata);
  }

  createExportDeclaration(
    declaration: Declaration,
    metadata?: NodeMetadata
  ): ExportDeclaration {
    return this.addMetadata({
      type: 'ExportDeclaration',
      declaration
    }, metadata);
  }

  // ============================================================================
  // Type System
  // ============================================================================

  createPrimitiveType(
    name: 'byte' | 'word' | 'boolean' | 'void',
    metadata?: NodeMetadata
  ): PrimitiveType {
    return this.addMetadata({
      type: 'PrimitiveType',
      name
    }, metadata);
  }

  createArrayType(
    elementType: TypeAnnotation,
    size: Expression,
    metadata?: NodeMetadata
  ): ArrayType {
    return this.addMetadata({
      type: 'ArrayType',
      elementType,
      size
    }, metadata);
  }

  // ============================================================================
  // Generic Node Creation
  // ============================================================================

  /**
   * Generic method for creating any AST node
   */
  create(type: string, props: any = {}): ASTNode {
    return {
      type,
      ...props
    };
  }
}

// Export a default instance
export const factory = new ASTNodeFactory();
