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
 * - Future: ILExpressionGenerator and final ILGenerator class
 *
 * Current usage (until expression generator is implemented):
 * ```typescript
 * import { ILStatementGenerator } from '@blend65/compiler/il/generator';
 * 
 * const generator = new ILStatementGenerator(symbolTable, targetConfig);
 * const result = generator.generateModule(program);
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
  // Expression generator class - the most complete generator in the chain
  ILExpressionGenerator,
} from './expressions.js';