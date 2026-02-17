/**
 * IL Module - Intermediate Language for Blend65 Compiler
 *
 * This module provides the complete IL type system with slot-centric
 * operands for optimal 6502 code generation.
 *
 * Key Features:
 * - Slot-centric operands that carry full SFA context
 * - Optimization hints for peephole optimizer
 * - Loop structure preservation for loop-aware optimization
 * - Cost model for instruction selection
 *
 * @module il
 */

// ============================================================================
// Enums
// ============================================================================

export { ILOpcode, AddressingModeHint } from './enums.js';

// ============================================================================
// Operand Types
// ============================================================================

export type {
  SlotOperand,
  ImmediateOperand,
  LabelOperand,
  FunctionOperand,
  AddressOperand,
  AsmRawOperand,
  ILOperand,
} from './operands.js';

// ============================================================================
// Instruction Types
// ============================================================================

export type { InstructionCost, DefUse, OptimizationHints, ILInstruction } from './instruction.js';

// ============================================================================
// Program Structures
// ============================================================================

export type { ILLoop, ILFunction, ILProgram } from './structures.js';

// ============================================================================
// Factory Functions
// ============================================================================

export {
  // Operand factories
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
  createAddressOperand,
  createIndexedAddressOperand,
  // Instruction factories
  createInstruction,
  createInstructionCost,
  createDefUse,
  createOptimizationHints,
  // Structure factories
  createILLoop,
  createILFunction,
  createILProgram,
} from './factories.js';

// ============================================================================
// Type Guards
// ============================================================================

export {
  // Operand guards
  isSlotOperand,
  isImmediateOperand,
  isLabelOperand,
  isFunctionOperand,
  isAddressOperand,
  // Instruction classification guards
  isZeroPageInstruction,
  isLoadInstruction,
  isStoreInstruction,
  isArithmeticInstruction,
  isBitwiseInstruction,
  isComparisonInstruction,
  isControlFlowInstruction,
  isConditionalJumpInstruction,
  isFunctionInstruction,
  isRegisterTransferInstruction,
  isStackInstruction,
  isIntrinsicInstruction,
  isLabelInstruction,
  isInlineContinuationLabel,
  hasSideEffects,
} from './guards.js';

// ============================================================================
// Builder
// ============================================================================

export { ILBuilder, computeInstructionCost, computeDefUse } from './builder/index.js';

// ============================================================================
// Generator
// ============================================================================

export { ILGenerator, ILGeneratorBase, ILGeneratorExpressions } from './generator/index.js';

// ============================================================================
// Analysis
// ============================================================================

export {
  // Live range analysis
  computeLiveRanges,
  // Dead store detection
  isDeadStore,
  // Optimization hints
  hasHotSlotAccess,
  hasFrequentSlotAccess,
  canCoalesce,
  computeHints,
  // Full analysis passes
  runAnalysisPasses,
  runAnalysisPassesWithLoops,
  // Statistics
  getAnalysisStats,
} from './analysis.js';

export type { AnalysisStats } from './analysis.js';

// ASM function name parsing utilities
export {
  isAsmFunction,
  parseAsmFunctionName,
  addressingModeRequiresOperand,
  getExpectedArgCount,
  getValidAddressingModeSuffixes,
  getValidMnemonics,
} from './asm-utils.js';
export type { AsmParseResult } from './asm-utils.js';
