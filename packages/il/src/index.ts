/**
 * Intermediate Language (IL) Package Entry Point
 * Task 2.1: Create IL Type System
 *
 * This package provides the Intermediate Language (IL) system for the Blend65 compiler.
 * The IL serves as an optimization-friendly representation between the AST and target
 * 6502 assembly code.
 *
 * Main Exports:
 * - IL type definitions and interfaces
 * - Factory functions for creating IL structures
 * - Type guards and utility functions
 * - 6502-specific optimization hint types
 *
 * Educational Purpose:
 * The IL system demonstrates how modern compilers use intermediate representations
 * to enable powerful optimizations while maintaining clean separation between
 * language features and target architecture specifics.
 */

// ============================================================================
// CORE IL TYPE SYSTEM
// ============================================================================

// Main IL program structures
export type {
  ILProgram,
  ILModule,
  ILFunction,
  ProgramSourceInfo,
  CompilationOptions
} from './il-types.js';

// IL instruction system
export type {
  ILInstruction,
  ILInstructionMetadata,
  InstructionPerformanceInfo,
  InstructionDebugInfo
} from './il-types.js';

export {
  ILInstructionType
} from './il-types.js';

// Import types needed for utility functions
import type { ILInstructionType, AddressingMode6502 } from './il-types.js';

// IL value system
export type {
  ILValue,
  ILConstant,
  ILVariable,
  ILRegister,
  ILTemporary,
  ILMemoryLocation,
  ILLabel,
  ILOperand,
  ILParameterReference,
  ILReturnReference
} from './il-types.js';

export type {
  ConstantRepresentation,
  VariableScope,
  Register6502,
  TemporaryScope,
  TemporaryLifetimeInfo,
  AddressingMode6502,
  MemoryBank6502
} from './il-types.js';

// ============================================================================
// IL DATA STRUCTURES
// ============================================================================

export type {
  ILParameter,
  ILLocalVariable,
  ILGlobalData,
  ILModuleData,
  ILImport,
  ILExport
} from './il-types.js';

export type {
  ParameterPassingMethod,
  LocalVariableAllocation,
  ImportType,
  ExportType
} from './il-types.js';

// ============================================================================
// 6502-SPECIFIC OPTIMIZATION SYSTEM
// ============================================================================

export type {
  IL6502OptimizationHints,
  Instruction6502OptimizationOpportunity,
  Instruction6502OptimizationOpportunityType
} from './il-types.js';

// ============================================================================
// OPTIMIZATION METADATA
// ============================================================================

export type {
  ProgramOptimizationMetadata,
  ModuleOptimizationMetadata,
  ILFunctionOptimizationMetadata,
  HotPathInfo
} from './il-types.js';

export type {
  ControlFlowGraph,
  ControlFlowBlock,
  ControlFlowEdge,
  BasicBlock,
  LoopInfo,
  DataFlowAnalysis,
  LiveVariableInfo,
  LiveRange
} from './il-types.js';

export type {
  RegisterUsageAnalysis,
  RegisterConflict,
  ReachingDefinitionInfo,
  AvailableExpressionInfo
} from './il-types.js';

// ============================================================================
// HELPER TYPES AND METADATA
// ============================================================================

export type {
  MemoryAllocationInfo,
  ParameterOptimizationHints,
  LocalVariableOptimizationHints,
  GlobalOptimizationOpportunity,
  ProgramResourceUsage,
  InterFunctionOptimization,
  ModuleResourceUsage
} from './il-types.js';

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

export {
  isILConstant,
  isILVariable,
  isILRegister,
  isILTemporary,
  isILMemoryLocation,
  isILLabel,
  isILParameterReference,
  isILReturnReference
} from './il-types.js';

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export {
  createILConstant,
  createILVariable,
  createILRegister,
  createILTemporary,
  createILLabel,
  createILInstruction,
  createILProgram,
  createILModule,
  createILFunction
} from './il-types.js';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  ilValueToString,
  ilInstructionToString
} from './il-types.js';

// ============================================================================
// TASK 2.2: IL INSTRUCTION CREATION
// ============================================================================

// Instruction creation functions
export {
  createLoadImmediate,
  createLoadMemory,
  createStoreMemory,
  createCopy,
  createAdd,
  createSub,
  createMul,
  createDiv,
  createMod,
  createNeg,
  createAnd,
  createOr,
  createNot,
  createBitwiseAnd,
  createBitwiseOr,
  createBitwiseXor,
  createBitwiseNot,
  createShiftLeft,
  createShiftRight,
  createCompareEq,
  createCompareNe,
  createCompareLt,
  createCompareLe,
  createCompareGt,
  createCompareGe,
  createBranch,
  createBranchIfTrue,
  createBranchIfFalse,
  createBranchIfZero,
  createBranchIfNotZero,
  createCall,
  createReturn,
  createDeclareLocal,
  createLoadVariable,
  createStoreVariable,
  createLoadArray,
  createStoreArray,
  createArrayAddress,
  createLabel,
  createNop,
  createComment,
  createPeek,
  createPoke,
  createRegisterOp,
  createSetFlags,
  createClearFlags,
  ILInstructionFactory,
  ILInstructionError,
  InstructionCreationContext,
  createInstructionContext,
  resetGlobalInstructionContext,
  validateILInstruction
} from './instructions.js';

// ============================================================================
// VERSION AND METADATA
// ============================================================================

/**
 * IL package version information.
 */
export const IL_VERSION = '0.1.0';

/**
 * Supported target platforms for IL generation.
 */
export const SUPPORTED_PLATFORMS = ['c64', 'vic20', 'x16'] as const;

export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

/**
 * IL instruction categories for optimization and analysis.
 */
export const INSTRUCTION_CATEGORIES = {
  MEMORY: ['LOAD_IMMEDIATE', 'LOAD_MEMORY', 'STORE_MEMORY', 'COPY'],
  ARITHMETIC: ['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'NEG'],
  LOGICAL: ['AND', 'OR', 'NOT'],
  BITWISE: ['BITWISE_AND', 'BITWISE_OR', 'BITWISE_XOR', 'BITWISE_NOT', 'SHIFT_LEFT', 'SHIFT_RIGHT'],
  COMPARISON: ['COMPARE_EQ', 'COMPARE_NE', 'COMPARE_LT', 'COMPARE_LE', 'COMPARE_GT', 'COMPARE_GE'],
  CONTROL_FLOW: ['BRANCH', 'BRANCH_IF_TRUE', 'BRANCH_IF_FALSE', 'BRANCH_IF_ZERO', 'BRANCH_IF_NOT_ZERO'],
  FUNCTION: ['CALL', 'RETURN'],
  VARIABLE: ['DECLARE_LOCAL', 'LOAD_VARIABLE', 'STORE_VARIABLE'],
  ARRAY: ['LOAD_ARRAY', 'STORE_ARRAY', 'ARRAY_ADDRESS'],
  UTILITY: ['LABEL', 'NOP', 'COMMENT'],
  HARDWARE: ['REGISTER_OP', 'PEEK', 'POKE', 'SET_FLAGS', 'CLEAR_FLAGS']
} as const;

export type InstructionCategory = keyof typeof INSTRUCTION_CATEGORIES;

/**
 * Get the category for a given IL instruction type.
 */
export function getInstructionCategory(instructionType: ILInstructionType): InstructionCategory | null {
  for (const [category, instructions] of Object.entries(INSTRUCTION_CATEGORIES)) {
    if ((instructions as readonly string[]).includes(instructionType)) {
      return category as InstructionCategory;
    }
  }
  return null;
}

/**
 * Check if an instruction type is in a specific category.
 */
export function isInstructionInCategory(instructionType: ILInstructionType, category: InstructionCategory): boolean {
  const categoryInstructions = INSTRUCTION_CATEGORIES[category] as readonly string[];
  return categoryInstructions.includes(instructionType);
}

/**
 * Get estimated cycle cost for common 6502 operations.
 * These are baseline estimates that can be refined by optimization passes.
 */
export function getEstimatedCycles(
  instructionType: ILInstructionType,
  addressingMode: AddressingMode6502 = 'absolute'
): number {
  // Base cycle costs for different operation types
  const baseCycles: Record<string, number> = {
    // Memory operations
    LOAD_IMMEDIATE: 2,
    LOAD_MEMORY: addressingMode === 'zero_page' ? 3 : 4,
    STORE_MEMORY: addressingMode === 'zero_page' ? 3 : 4,
    COPY: 4, // Estimated for register to register

    // Arithmetic operations (assuming 6502 limitations)
    ADD: 2, // ADC immediate
    SUB: 2, // SBC immediate
    MUL: 20, // Estimated software multiplication
    DIV: 40, // Estimated software division
    MOD: 45, // Estimated software modulo
    NEG: 3, // EOR + clc + ADC

    // Logical operations
    AND: 2,
    OR: 2,
    NOT: 3, // EOR #$FF

    // Bitwise operations
    BITWISE_AND: 2,
    BITWISE_OR: 2,
    BITWISE_XOR: 2,
    BITWISE_NOT: 3,
    SHIFT_LEFT: 2, // ASL
    SHIFT_RIGHT: 2, // LSR

    // Comparison operations
    COMPARE_EQ: 4, // CMP + branch logic
    COMPARE_NE: 4,
    COMPARE_LT: 4,
    COMPARE_LE: 4,
    COMPARE_GT: 4,
    COMPARE_GE: 4,

    // Control flow
    BRANCH: 3, // JMP absolute
    BRANCH_IF_TRUE: 2, // Branch not taken, +1 if taken
    BRANCH_IF_FALSE: 2,
    BRANCH_IF_ZERO: 2,
    BRANCH_IF_NOT_ZERO: 2,

    // Function operations
    CALL: 6, // JSR
    RETURN: 4, // RTS

    // Variable operations
    DECLARE_LOCAL: 0, // No runtime cost
    LOAD_VARIABLE: addressingMode === 'zero_page' ? 3 : 4,
    STORE_VARIABLE: addressingMode === 'zero_page' ? 3 : 4,

    // Array operations
    LOAD_ARRAY: 6, // Address calculation + load
    STORE_ARRAY: 6, // Address calculation + store
    ARRAY_ADDRESS: 4, // Address calculation

    // Utility
    LABEL: 0,
    NOP: 2,
    COMMENT: 0,

    // Hardware operations
    REGISTER_OP: 2,
    PEEK: 4,
    POKE: 4,
    SET_FLAGS: 2,
    CLEAR_FLAGS: 2
  };

  return baseCycles[instructionType] || 4; // Default estimate
}

/**
 * Summary of IL System (Tasks 2.1 + 2.2 Complete):
 *
 * ✅ Task 2.1: Complete IL type definitions for 6502 operations and Blend65 constructs
 * ✅ Task 2.2: Complete IL instruction creation functions for all operations
 * ✅ Rich instruction set covering all language features and target operations
 * ✅ 6502-aware value types with registers, addressing modes, memory banks
 * ✅ Comprehensive optimization metadata integration from semantic analysis
 * ✅ Control flow graph and data flow analysis support
 * ✅ Factory functions for easy IL construction and instruction creation
 * ✅ Type guards and utility functions for IL manipulation
 * ✅ Platform-aware compilation metadata
 * ✅ Performance estimation utilities for 6502 code generation
 * ✅ Clean integration with existing semantic analysis infrastructure
 * ✅ Instruction validation and error handling system
 * ✅ 6502-specific optimization hints for all instructions
 *
 * Ready for next tasks:
 * - Task 2.3: Create AST to IL Transformer
 * - Task 2.4: Implement IL Validation
 * - Task 2.5: Add IL Serialization and Debugging
 * - Task 2.6: IL Integration and Testing
 *
 * The IL system now provides complete infrastructure for:
 * - AST transformation to optimizable IL representation
 * - 6502-aware instruction creation with performance hints
 * - Comprehensive validation and error reporting
 * - Foundation for optimization passes and code generation
 */

// ============================================================================
// TASK 2.3: AST TO IL TRANSFORMATION
// ============================================================================

// AST to IL transformation functionality
export {
  ASTToILTransformer,
  createASTToILTransformer,
  transformProgramToIL
} from './ast-to-il.js';

export type {
  TransformationResult,
  TransformationError,
  TransformationWarning,
  ExpressionTransformResult,
  StatementTransformResult,
  TransformationContext
} from './ast-to-il.js';

// ============================================================================
// TASK 2.4: IL VALIDATION SYSTEM
// ============================================================================

// IL validation functionality
export {
  ILValidator,
  createILValidator,
  validateILProgram,
  validateILModule,
  validateILFunction,
  ILValidationErrorType,
  ILValidationSeverity
} from './il-validator.js';

export type {
  ILValidationResult,
  ILValidationError,
  ILValidationStatistics,
  ValidationErrorContext,
  ControlFlowAnalysisResult
} from './il-validator.js';

// ============================================================================
// TASK 2.4.1: ADVANCED CONTROL FLOW GRAPH ANALYTICS
// ============================================================================

// CFG analytics functionality
export {
  ControlFlowAnalyzer,
  analyzeCFG
} from './analysis/control-flow-analyzer.js';

export type {
  ControlFlowAnalysisResult as AdvancedControlFlowAnalysisResult,
  CFGAnalysisOptions,
  CFGAnalysisMetrics
} from './analysis/control-flow-analyzer.js';

// CFG analytics types
export type {
  BasicBlock as CFGBasicBlock,
  ControlFlowGraph as AdvancedControlFlowGraph,
  CFGEdge,
  CFGEdgeType,
  DominanceAnalysis,
  DominanceTree,
  DominanceRelation,
  LoopAnalysis,
  NaturalLoop,
  BackEdge,
  LoopNestingTree,
  LoopType,
  LoopCharacteristics,
  InductionVariableInfo,
  InductionVariableUsage,
  DataDependencyAnalysis,
  VariableDefinition,
  VariableUse,
  DefinitionType,
  UsageType,
  VariableDependencyGraph,
  DataFlowEquation,
  DataFlowEquationType,
  MemoryDependency,
  MemoryDependencyType,
  MemoryLocation,
  LiveVariableAnalysis,
  InterferenceGraph,
  VariableInterference,
  InterferenceType,
  VariableLifetime,
  CriticalPathAnalysis,
  CriticalPath,
  HotBlock,
  PerformanceBottleneck,
  BottleneckType,
  OptimizationOpportunity,
  OptimizationOpportunityType,
  OptimizationComplexity,
  InstructionLocation
} from './analysis/types/control-flow-types.js';

// ============================================================================
// TASK 2.4.2: 6502-SPECIFIC DEEP VALIDATION SYSTEM
// ============================================================================

// 6502-specific analysis functionality
export {
  SixtyTwo6502Analyzer,
  analyze6502
} from './analysis/6502-analyzer.js';

export type {
  SixtyTwo6502ValidationResult,
  SixtyTwo6502AnalysisOptions,
  ProcessorVariant,
  PlatformTarget,
  CycleTimingResult,
  MemoryLayoutValidationResult,
  RegisterAllocationAnalysis,
  PerformanceHotspotAnalysis,
  HardwareConstraintValidation,
  SixtyTwo6502Optimization,
  ValidationIssue,
  InstructionTimingInfo,
  TimingAccuracy,
  MemoryModelAccuracy
} from './analysis/types/6502-analysis-types.js';

// 6502 processor variant analyzers
export {
  Base6502Analyzer,
  VIC20_6502Analyzer,
  C64_6510Analyzer,
  X16_65C02Analyzer
} from './analysis/6502-variants/index.js';

// ============================================================================
// TASK 2.4.3: IL QUALITY METRICS AND ANALYTICS FRAMEWORK
// ============================================================================

// IL quality metrics and analytics functionality
export {
  ILMetricsAnalyzer,
  analyzeILQuality
} from './analysis/il-metrics-analyzer.js';

export type {
  ILQualityAnalysisResult,
  QualityAnalysisOptions,
  QualityAnalysisMetrics,
  ILComplexityMetrics,
  PerformancePredictionModel,
  OptimizationReadinessAnalysis,
  QualityGateAnalysis,
  QualityAnalysisSummary,
  ImprovementRecommendation,
  ComplexityLevel,
  PerformanceLevel,
  OptimizationPotential,
  InstructionComplexityScore,
  ControlFlowComplexityScore,
  DataFlowComplexityScore,
  CycleEstimate,
  MemoryUsageEstimate,
  RegisterPressureAnalysis,
  PerformanceBottleneck as QualityPerformanceBottleneck,
  PlatformSpecificFactors,
  OptimizationCategory,
  ReadinessScore,
  PatternApplicabilityScore,
  OptimizationImpactEstimate,
  TransformationSafetyAnalysis,
  QualityGate,
  QualityGateStatus,
  QualityThresholdSet,
  QualityGateType,
  QualityThreshold,
  ThresholdDirection,
  GateImportance,
  RecommendationType,
  RecommendationPriority,
  ImplementationEffort,
  ExpertiseLevel,
  BottleneckLocation,
  BottleneckSeverity,
  MemorySegmentUsage,
  RegisterPressureMetric,
  PressureRegion,
  MemoryTimingFactors,
  ProcessorFeatureFactors,
  PlatformConstraintFactors,
  UncertaintyFactor,
  OptimizationBlocker,
  BlockerType,
  BlockerSeverity,
  OptimizationOpportunity as QualityOptimizationOpportunity,
  OpportunityType,
  SafetyLevel,
  PatternPrerequisite,
  PrerequisiteType,
  ImpactMetric,
  SemanticSafetyAnalysis,
  PerformanceSafetyAnalysis,
  PlatformSafetyAnalysis,
  RiskFactor,
  RiskType,
  RiskSeverity,
  OptimizationLevel,
  AnalysisDepth
} from './analysis/types/metrics-types.js';

// ============================================================================
// TASK 2.4.4: PATTERN-READINESS ANALYTICS INTEGRATION
// ============================================================================

// Pattern-readiness analytics functionality
export {
  PatternReadinessAnalyzer
} from './analysis/pattern-readiness-analyzer.js';

export type {
  PatternReadinessAnalysisResult,
  RankedPatternRecommendation,
  PatternConflictPrediction,
  OptimizationStrategy,
  PatternSelectionMetrics,
  PatternApplicationStep,
  PatternSafetyAssessment,
  PatternAnalysisMetadata,
  PatternConfidenceLevel,
  PatternPrerequisite as PatternAnalysisPrerequisite,
  PatternBenefitEstimate,
  BenefitConfidenceInterval,
  PatternApplicationContext,
  PatternRiskFactor,
  PatternRiskType,
  PatternConflictType,
  ConflictSeverity,
  ConflictImpactAssessment,
  ConflictResolutionStrategy,
  ResolutionComplexity,
  ConflictResolutionOutcome,
  OptimizationStrategyType,
  StrategyBenefitEstimate,
  StrategyRiskProfile,
  StrategyResourceRequirements,
  AlternativeStrategy,
  StrategyTradeoffs,
  SelectionPerformanceMetrics,
  RollbackStrategy,
  RollbackStrategyType,
  RollbackComplexity,
  SuccessCriterion,
  CriterionPriority,
  SafetyRecommendation,
  SafetyImportance,
  ValidationRequirement,
  ValidationType,
  PatternAnalysisOptions,
  RiskTolerance,
  OptimizationGoals,
  PlatformConstraints,
  MemoryConstraints,
  TimingConstraints,
  HardwareConstraints,
  PerformanceContextInfo,
  ExecutionFrequency,
  SafetyContextInfo,
  SafetyRequirement,
  ValidationLevel,
  ExpertiseRequirement,
  RiskLevel
} from './analysis/pattern-readiness-analyzer.js';
