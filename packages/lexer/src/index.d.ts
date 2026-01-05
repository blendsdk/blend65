/**
 * Blend65 Lexer Package
 * Export all lexer functionality for Blend65 language
 */
import { Blend65Lexer } from './blend65-lexer.js';
import type { LexerOptions } from './blend65-lexer.js';
import type { Token } from './types.js';
export { Blend65Lexer } from './blend65-lexer.js';
export type { LexerOptions } from './blend65-lexer.js';
export { TokenType } from './types.js';
export type { Token, SourcePosition } from './types.js';
export { KEYWORDS, STORAGE_CLASSES, PRIMITIVE_TYPES, CONTROL_FLOW_KEYWORDS } from './types.js';
/**
 * Convenience function to tokenize Blend65 source code
 */
export declare function tokenize(source: string, options?: LexerOptions): Token[];
/**
 * Convenience function to create a lexer instance
 */
export declare function createLexer(source: string, options?: LexerOptions): Blend65Lexer;
//# sourceMappingURL=index.d.ts.map