/**
 * Blend65 v2 Lexer Module
 *
 * This module exports the lexical analyzer for the Blend65 v2 language.
 * It provides the Lexer class for tokenizing source code, type definitions
 * for tokens and keywords, and utility functions for convenient tokenization.
 *
 * NOTE: v2 removes @map syntax - memory-mapped I/O uses peek/poke intrinsics instead.
 *
 * @module @blend65/compiler-v2/lexer
 */

export * from './lexer.js';
export * from './types.js';
export * from './utils.js';