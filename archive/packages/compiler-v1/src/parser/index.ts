/**
 * Parser Module Public API
 *
 * This module exports all parser-related types, classes, and utilities
 * for use throughout the compiler.
 *
 * Architecture: Inheritance Chain
 * BaseParser → ExpressionParser → DeclarationParser → ModuleParser → StatementParser → Parser
 */

// Parser configuration
export * from './config.js';

// Operator precedence
export * from './precedence.js';

// Error messages
export * from './error-messages.js';

// Scope management
export { ScopeManager, ScopeType, ErrorReporter } from './scope-manager.js';

// Export classes in dependency order to avoid circular import issues
export { BaseParser, ParseError } from './base.js';
export { ExpressionParser } from './expressions.js';
export { DeclarationParser } from './declarations.js';
export { ModuleParser } from './modules.js';
export { StatementParser } from './statements.js';
export { Parser } from './parser.js';
