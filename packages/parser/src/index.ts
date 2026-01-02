/**
 * Blend65 Parser Package
 *
 * Provides parsing functionality for the Blend65 language.
 * Exports core parser classes, strategies, and utilities.
 */

// Core parser infrastructure
export { BaseParser, type ParserOptions } from './core/base-parser.js';
export { TokenStream } from './core/token-stream.js';
export {
  ErrorRecoveryStrategy,
  ErrorReporter,
  ParseError,
  SynchronizationRecovery,
  UnexpectedTokenError,
} from './core/error.js';

// Parsing strategies
export {
  RecursiveDescentParser,
  Precedence,
  type OperatorInfo,
} from './strategies/recursive-descent.js';

// Blend65 Parser Implementation
export { Blend65Parser } from './blend65/blend65-parser.js';

// Re-export commonly used types from dependencies
export type { Token, TokenType } from '@blend65/lexer';
export type { ASTNode } from '@blend65/ast';
