/**
 * IL Generator Exports
 *
 * This module exports all IL generator components for use
 * by other parts of the compiler.
 *
 * The generator uses an inheritance chain architecture:
 * - ILGeneratorBase: Foundation with type conversion and utilities
 * - ILModuleGenerator: Module-level generation (imports, globals, functions)
 * - ILDeclarationGenerator: Function body setup, parameter mapping, intrinsics
 * - ILStatementGenerator: Statement generation (if/while/for/return/break/continue)
 * - ILExpressionGenerator: Expression generation (literals, binary, unary, calls)
 * - ILGenerator: Final generator with SSA construction integration
 *
 * Usage:
 * ```typescript
 * import { ILGenerator } from '@blend65/compiler/il/generator';
 *
 * const generator = new ILGenerator(symbolTable, targetConfig, {
 *   enableSSA: true,      // Convert IL to SSA form (default: true)
 *   verifySSA: true,      // Verify SSA invariants (default: true)
 * });
 *
 * const result = generator.generateModule(program);
 *
 * if (result.success && result.ssaEnabled) {
 *   console.log(`SSA: ${result.ssaSuccessCount} functions converted`);
 * }
 * ```
 *
 * @module il/generator
 */

// =============================================================================
// Base Generator
// =============================================================================

export {
  // Base class
  ILGeneratorBase,
  // Error types
  ILErrorSeverity,
  type ILGeneratorError,
  // Context types
  type GenerationContext,
  type VariableMapping,
} from './base.js';

// =============================================================================
// Module Generator
// =============================================================================

export {
  // Module generator class
  ILModuleGenerator,
  // Result type
  type ModuleGenerationResult,
} from './modules.js';

// =============================================================================
// Declaration Generator
// =============================================================================

export {
  // Declaration generator class
  ILDeclarationGenerator,
  // Type exports
  type IntrinsicInfo,
  type LocalVariableInfo,
} from './declarations.js';

// =============================================================================
// Statement Generator
// =============================================================================

export {
  // Statement generator class
  ILStatementGenerator,
  // Type exports
  type LoopInfo,
} from './statements.js';

// =============================================================================
// Expression Generator
// =============================================================================

export {
  // Expression generator class
  ILExpressionGenerator,
} from './expressions.js';

// =============================================================================
// Final Generator with SSA Integration
// =============================================================================

export {
  // Final generator class with SSA construction
  ILGenerator,
  // Options type
  type ILGeneratorOptions,
  // Result type with SSA info
  type ILGenerationResult,
} from './generator.js';