/**
 * Blend65 Lexer Package
 * Export all lexer functionality for Blend65 language
 */
import { Blend65Lexer } from './blend65-lexer.js';
export { Blend65Lexer } from './blend65-lexer.js';
export { TokenType } from './types.js';
export { KEYWORDS, STORAGE_CLASSES, PRIMITIVE_TYPES, CONTROL_FLOW_KEYWORDS } from './types.js';
/**
 * Convenience function to tokenize Blend65 source code
 */
export function tokenize(source, options) {
    const lexer = new Blend65Lexer(source, options);
    return lexer.tokenize();
}
/**
 * Convenience function to create a lexer instance
 */
export function createLexer(source, options) {
    return new Blend65Lexer(source, options);
}
//# sourceMappingURL=index.js.map