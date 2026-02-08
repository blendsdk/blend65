/**
 * Utility functions for the Blend65 lexer
 * Provides convenient helper functions for tokenizing source code
 */

import { Lexer, LexerOptions } from './lexer.js';
import { Token } from './types.js';

/**
 * Convenience function to tokenize Blend65 source code
 * Creates a lexer instance, tokenizes the source, and returns all tokens
 *
 * @param source - The Blend65 source code to tokenize
 * @param options - Optional lexer configuration options
 * @returns Array of all tokens found in the source code, including EOF token
 *
 * @example
 * ```typescript
 * const tokens = tokenize('let x: byte = 10');
 * // Returns tokens for: LET, IDENTIFIER, COLON, BYTE, ASSIGN, NUMBER, EOF
 * ```
 */
export function tokenize(source: string, options?: LexerOptions): Token[] {
  const lexer = new Lexer(source, options);
  return lexer.tokenize();
}
