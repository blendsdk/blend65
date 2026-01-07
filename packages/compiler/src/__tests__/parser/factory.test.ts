import { describe, expect, it } from 'vitest';
import {
  AstNodeKind,
  createBlock,
  createExpressionStatement,
  createIdentifier,
  createLiteral,
  createProgram,
  createSourceSpan,
  withDecorators,
  withSpan,
} from '../../parser/index.js';

import type { DecoratorNode, NodeFactoryOptions } from '../../parser/ast.js';
import { UNKNOWN_SOURCE_SPAN } from '../../parser/source.js';

describe('Node factories', () => {
  it('should create a program node with default body', () => {
    const program = createProgram();

    expect(program.kind).toBe(AstNodeKind.Program);
    expect(program.body).toEqual([]);
    expect(program.span).toEqual(UNKNOWN_SOURCE_SPAN);
  });

  it('should create identifier nodes with names', () => {
    const identifier = createIdentifier('snakeX');

    expect(identifier.kind).toBe(AstNodeKind.Identifier);
    expect(identifier.name).toBe('snakeX');
  });

  it('should create literal nodes with value metadata', () => {
    const literal = createLiteral(42, 'number');

    expect(literal.kind).toBe(AstNodeKind.Literal);
    expect(literal.value).toBe(42);
    expect(literal.literalType).toBe('number');
  });

  it('should honor provided metadata when creating programs', () => {
    const span = createSourceSpan(
      { line: 0, column: 0, offset: 0 },
      { line: 0, column: 5, offset: 5 }
    );
    const program = createProgram([], { span, docComment: 'module docs' });

    expect(program.span).toBe(span);
    expect(program.docComment).toBe('module docs');
  });

  it('should create block statements with nested statements', () => {
    const identifier = createIdentifier('counter');
    const literal = createLiteral(1, 'number');
    const expression = createExpressionStatement(identifier);
    const block = createBlock([expression]);

    expect(block.kind).toBe(AstNodeKind.BlockStatement);
    expect(block.statements).toHaveLength(1);
    expect(block.statements[0]).toBe(expression);
  });

  it('should extend options immutably when calling withSpan', () => {
    const baseOptions: NodeFactoryOptions = { docComment: 'hi' };
    const span = createSourceSpan(
      { line: 0, column: 0, offset: 0 },
      { line: 0, column: 2, offset: 2 }
    );
    const extended = withSpan(baseOptions, span);

    expect(extended).toEqual({ ...baseOptions, span });
    expect(baseOptions).toEqual({ docComment: 'hi' });
    expect(extended).not.toBe(baseOptions);
  });

  it('should attach decorators without mutating original options', () => {
    const baseOptions: NodeFactoryOptions = { docComment: 'hi' };
    const decorators: DecoratorNode[] = [];
    const extended = withDecorators(baseOptions, decorators);

    expect(extended).toEqual({ ...baseOptions, decorators });
    expect(baseOptions.decorators).toBeUndefined();
  });
});
