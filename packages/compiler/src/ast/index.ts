/**
 * AST Module Public API - Blend65 Compiler v2
 *
 * This module exports all AST-related types, classes, and utilities
 * for use throughout the compiler.
 *
 * Multi-file architecture for manageability:
 * - base.ts: Base classes, enums, visitor interface
 * - expressions.ts: All expression node classes
 * - statements.ts: All statement node classes
 * - declarations.ts: Function, variable, type, enum declarations
 * - program.ts: Program, module, import, export declarations
 * - type-guards.ts: Type narrowing utilities
 * - diagnostics.ts: Error reporting system
 */

// Base types and classes
export * from './base.js';

// Expression node implementations
export * from './expressions.js';

// Statement node implementations
export * from './statements.js';

// Declaration node implementations
export * from './declarations.js';

// Program structure nodes
export * from './program.js';

// Type guard utilities
export * from './type-guards.js';

// Diagnostic system
export * from './diagnostics.js';