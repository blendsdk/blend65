/**
 * Parser module for Blend65 v2
 *
 * Responsible for parsing tokens into an Abstract Syntax Tree (AST).
 * This is a migration from v1 with @map parsing removed.
 *
 * **Parser Inheritance Chain:**
 * - BaseParser: Core utilities, token consumption, error handling
 * - ExpressionParser: Expression parsing (Pratt parser)
 * - DeclarationParser: Variable declaration parsing (no @map in v2)
 * - ModuleParser: Module/import/export parsing
 * - StatementParser: Statement parsing (control flow, etc.)
 * - Parser: Final concrete class - main entry point
 *
 * **V2 Changes:**
 * - No @map declarations (removed in v2)
 * - Memory-mapped I/O uses peek/poke intrinsics instead
 * - Simplified storage classes (handled by frame allocator)
 *
 * @module parser
 */

// Parser configuration and presets
export * from './config.js';

// Error messages for parser diagnostics
export * from './error-messages.js';

// Operator precedence definitions
export * from './precedence.js';

// Scope manager for function/loop tracking
export * from './scope-manager.js';

// Parser inheritance chain (order matters for dependencies)
export * from './base.js';
export * from './expressions.js';
export * from './declarations.js';
export * from './modules.js';
export * from './statements.js';
export * from './parser.js';