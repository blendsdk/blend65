/**
 * IL (Intermediate Language) Generator
 *
 * This module provides the infrastructure for generating intermediate
 * language code from the Blend65 AST. The IL is designed for:
 *
 * 1. SSA Form - Every variable assigned exactly once for clean dataflow analysis
 * 2. Three-Address Code - Max 2 operands + 1 result per instruction
 * 3. Virtual Registers - Unlimited registers, code generator allocates to A/X/Y
 * 4. Rich Metadata - Preserves semantic analysis info (addressing modes, hints, etc.)
 * 5. Target-Agnostic Core - Generic IL with target-specific info in metadata
 *
 * @module il
 */

// =============================================================================
// Types
// =============================================================================

export {
  // Type kind enum
  ILTypeKind,
  // Type interfaces
  type ILType,
  type ILArrayType,
  type ILPointerType,
  type ILFunctionType,
  // Singleton type instances
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  // Type factory functions
  createArrayType,
  createPointerType,
  createFunctionType,
  // Type utility functions
  typesEqual,
  isPrimitiveType,
  isNumericType,
  isArrayType,
  isPointerType,
  isFunctionType,
  typeToString,
} from './types.js';

// =============================================================================
// Values
// =============================================================================

export {
  // Virtual register class
  VirtualRegister,
  // Value interfaces
  type ILConstant,
  type ILLabel,
  type ILValue,
  // Type guards
  isVirtualRegister,
  isILConstant,
  isILLabel,
  // Value factory
  ILValueFactory,
  // Utility functions
  valueToString,
  getValueType,
} from './values.js';

// =============================================================================
// Instructions
// =============================================================================

export {
  // Opcode enum
  ILOpcode,
  // Metadata interface
  type ILMetadata,
  // Base class
  ILInstruction,
  // Arithmetic/Logic instructions
  ILBinaryInstruction,
  ILUnaryInstruction,
  ILConstInstruction,
  ILUndefInstruction,
  ILConvertInstruction,
  // Control flow instructions
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
  // Memory instructions
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILLoadArrayInstruction,
  ILStoreArrayInstruction,
  // Call instructions
  ILCallInstruction,
  ILCallVoidInstruction,
  // SSA instructions
  ILPhiInstruction,
  // Intrinsic instructions
  ILPeekInstruction,
  ILPokeInstruction,
  // Hardware instructions
  ILHardwareReadInstruction,
  ILHardwareWriteInstruction,
  // Optimization control
  ILOptBarrierInstruction,
} from './instructions.js';

// =============================================================================
// Basic Blocks & CFG (Phase 2)
// =============================================================================

export { BasicBlock } from './basic-block.js';

export {
  ILFunction,
  ILStorageClass,
  type ILParameter,
} from './function.js';

export {
  ILModule,
  type ILGlobalVariable,
  type ILImport,
  type ILExport,
  type ILModuleStats,
} from './module.js';

export { ILBuilder } from './builder.js';

export {
  ILPrinter,
  type ILPrinterOptions,
  printModule,
  printFunction,
  printBlock,
  printInstruction,
} from './printer.js';

export {
  ILValidator,
  type ValidationError,
  type ValidationResult,
  type ValidatorOptions,
  validateModule,
  validateFunction,
  formatValidationErrors,
} from './validator.js';

// =============================================================================
// Generator (Phase 3) - COMPLETE with SSA Integration
// =============================================================================

export {
  // Base generator
  ILGeneratorBase,
  ILErrorSeverity,
  type ILGeneratorError,
  type GenerationContext,
  type VariableMapping,
  // Module generator
  ILModuleGenerator,
  type ModuleGenerationResult,
  // Final generator with SSA integration
  ILGenerator,
  type ILGeneratorOptions,
  type ILGenerationResult,
} from './generator/index.js';

// =============================================================================
// SSA Construction (Phase 6) - COMPLETE
// =============================================================================

// Dominator Tree (Sessions 2-4)
export {
  type DominatorInfo,
  DominatorTree,
  computeDominators,
  computeIntersection,
} from './ssa/index.js';

// Dominance Frontiers (Sessions 5-6)
export { DominanceFrontier, computeFrontiers } from './ssa/index.js';

// Phi Placement (Sessions 7-9)
export {
  type VariableDefInfo,
  type PhiPlacementInfo,
  type PhiPlacementResult,
  type PhiPlacementStats,
  PhiPlacer,
} from './ssa/index.js';

// Variable Renaming (Session 10)
export {
  type SSAName,
  type RenamedInstruction,
  type SSAPhiOperand,
  type RenamedPhi,
  type SSARenamingResult,
  type SSARenamingStats,
  VersionStackManager,
  SSARenamer,
  formatSSAName,
  parseSSAName,
  renameVariables,
} from './ssa/index.js';

// SSA Verification (Session 11)
export {
  SSAVerificationErrorCode,
  type SSAVerificationError,
  type SSAVerificationResult,
  type SSAVerificationStats,
  SSAVerifier,
  verifySSA,
} from './ssa/index.js';

// SSA Constructor (Session 12)
export {
  SSAConstructionPhase,
  type SSAConstructionError,
  type SSAConstructionStats,
  type SSAConstructionResult,
  type SSAConstructionOptions,
  SSAConstructor,
  constructSSA,
} from './ssa/index.js';