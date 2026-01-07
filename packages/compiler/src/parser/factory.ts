/**
 * Node factory helpers to keep AST construction DRY and thoroughly documented.
 *
 * Each helper is intentionally tiny so junior contributors can reason about the
 * AST shapes they produce. The shared utilities (like `withSpan`) keep optional
 * metadata merging consistent across every builder.
 */

import type { LiteralValue } from './ast.js';
import {
  AstNodeKind,
  createNode,
  type BlockStatementNode,
  type DeclarationNode,
  type DecoratorNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type IdentifierNode,
  type LiteralNode,
  type NodeFactoryOptions,
  type ProgramNode,
  type StatementNode,
} from './ast.js';
import type { SourceSpan } from './source.js';

/**
 * Extended options bag for `createProgram` so callers can supply an initial body.
 */
export interface ProgramFactoryOptions extends NodeFactoryOptions {
  /** Optional list of declarations/statements included in the module body. */
  body?: Array<DeclarationNode | StatementNode>;
}

/**
 * Builds a `Program` node that owns the top-level declaration/statement list.
 *
 * @param body - Statements and declarations that make up the module body.
 * @param options - Optional metadata such as span, docs, or decorators.
 */
export function createProgram(
  body: Array<DeclarationNode | StatementNode> = [],
  options: ProgramFactoryOptions = {}
): ProgramNode {
  // Defers to the low-level `createNode` helper so optional metadata is merged
  // consistently across every factory function.
  return createNode(
    AstNodeKind.Program,
    {
      body,
    },
    options
  );
}

/**
 * Creates an identifier node representing a symbol name in source.
 *
 * @param name - Symbol text exactly as it appeared in the source file.
 * @param options - Optional metadata forwarded to `createNode`.
 */
export function createIdentifier(name: string, options: NodeFactoryOptions = {}): IdentifierNode {
  return createNode(
    AstNodeKind.Identifier,
    {
      name,
    },
    options
  );
}

/**
 * Wraps literal values (number/string/boolean) in an AST node for downstream passes.
 *
 * @param value - Runtime literal value parsed from source.
 * @param literalType - Categorization used by consumers (number|string|boolean).
 * @param options - Optional metadata forwarded to `createNode`.
 */
export function createLiteral(
  value: LiteralValue,
  literalType: LiteralNode['literalType'],
  options: NodeFactoryOptions = {}
): LiteralNode {
  return createNode(
    AstNodeKind.Literal,
    {
      value,
      literalType,
    },
    options
  );
}

/**
 * Produces a block statement node that groups a list of statements.
 *
 * @param statements - Child statements contained in the block.
 * @param options - Optional metadata forwarded to `createNode`.
 */
export function createBlock(
  statements: StatementNode[] = [],
  options: NodeFactoryOptions = {}
): BlockStatementNode {
  return createNode(
    AstNodeKind.BlockStatement,
    {
      statements,
    },
    options
  );
}

/**
 * Converts any expression node into an expression statement wrapper.
 *
 * @param expression - Expression evaluated for side effects.
 * @param options - Optional metadata forwarded to `createNode`.
 */
export function createExpressionStatement(
  expression: ExpressionNode,
  options: NodeFactoryOptions = {}
): ExpressionStatementNode {
  return createNode(
    AstNodeKind.ExpressionStatement,
    {
      expression,
    },
    options
  );
}

/**
 * Convenience helper for attaching a span to builder options.
 *
 * @param options - Existing options object to extend (defaults to empty).
 * @param span - Span to associate with the eventual node.
 */
export function withSpan(options: NodeFactoryOptions = {}, span: SourceSpan): NodeFactoryOptions {
  // Spreading ensures we do not mutate caller-owned option objects.
  return {
    ...options,
    span,
  };
}

/**
 * Convenience helper for attaching decorators to builder options.
 *
 * @param options - Existing options object to extend (defaults to empty).
 * @param decorators - Decorators to associate with the eventual node.
 */
export function withDecorators(
  options: NodeFactoryOptions = {},
  decorators: DecoratorNode[]
): NodeFactoryOptions {
  // Decorators are optional, so callers can keep reusing the same base options
  // object without worrying about stale metadata.
  return {
    ...options,
    decorators,
  };
}
