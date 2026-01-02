/**
 * Blend65 AST Package
 *
 * Exports all AST types, factory, utilities, and visitor patterns
 * for the Blend65 multi-target 6502 language.
 */

// Core AST Types
export * from './ast-types/core.js';

// AST Factory
export * from './ast-factory.js';

// AST Utilities (to be added)
// export * from './ast-utils.js';

// AST Visitor (to be added)
// export * from './ast-visitor.js';

// Re-export commonly used types for convenience
export type {
  ASTNode,
  Program,
  Expression,
  Statement,
  Declaration,
  TypeAnnotation
} from './ast-types/core.js';

export { ASTNodeFactory, factory } from './ast-factory.js';
