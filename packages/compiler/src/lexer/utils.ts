import { Lexer, LexerOptions } from './lexer.js';
import { Token } from './types.js';

/**
 * Convenience function to tokenize Blend65 source code
 */
export function tokenize(source: string, options?: LexerOptions): Token[] {
  const lexer = new Lexer(source, options);
  return lexer.tokenize();
}
