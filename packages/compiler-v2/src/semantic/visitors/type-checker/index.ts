/**
 * Type Checker Module for Blend65 Compiler v2
 *
 * This module exports the type checker inheritance chain:
 *
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker →
 * DeclarationTypeChecker → StatementTypeChecker → TypeChecker
 *
 * For most use cases, import and use the final `TypeChecker` class.
 * The intermediate classes are exported for extension and testing.
 *
 * @module semantic/visitors/type-checker
 */

// Base layer - common utilities and infrastructure
export {
  TypeCheckerBase,
  TypeCheckResult,
  TypeCheckPassResult,
  TypeCheckDiagnosticCodes,
} from './base.js';

// Literal type checking layer
export { LiteralTypeChecker } from './literals.js';

// Expression type checking layer
export { ExpressionTypeChecker } from './expressions.js';

// Declaration type checking layer
export { DeclarationTypeChecker, DeclarationDiagnosticCodes } from './declarations.js';

// Statement type checking layer
export { StatementTypeChecker, StatementDiagnosticCodes } from './statements.js';

// Final concrete TypeChecker class
export { TypeChecker, TypeCheckOptions } from './type-checker.js';