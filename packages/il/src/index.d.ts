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
export type { ILProgram, ILModule, ILFunction, ProgramSourceInfo, CompilationOptions, } from './il-types.js';
export type { ILInstruction, ILInstructionMetadata, InstructionPerformanceInfo, InstructionDebugInfo, } from './il-types.js';
export { ILInstructionType } from './il-types.js';
import type { ILInstructionType, AddressingMode6502 } from './il-types.js';
export type { ILValue, ILConstant, ILVariable, ILRegister, ILTemporary, ILMemoryLocation, ILLabel, ILOperand, ILParameterReference, ILReturnReference, } from './il-types.js';
export type { ConstantRepresentation, VariableScope, Register6502, TemporaryScope, TemporaryLifetimeInfo, AddressingMode6502, MemoryBank6502, } from './il-types.js';
export type { ILParameter, ILLocalVariable, ILGlobalData, ILModuleData, ILImport, ILExport, } from './il-types.js';
export type { ParameterPassingMethod, LocalVariableAllocation, ImportType, ExportType, } from './il-types.js';
export type { IL6502OptimizationHints, Instruction6502OptimizationOpportunity, Instruction6502OptimizationOpportunityType, } from './il-types.js';
export type { ProgramOptimizationMetadata, ModuleOptimizationMetadata, ILFunctionOptimizationMetadata, HotPathInfo, } from './il-types.js';
export type { ControlFlowGraph, ControlFlowBlock, ControlFlowEdge, BasicBlock, LoopInfo, DataFlowAnalysis, LiveVariableInfo, LiveRange, } from './il-types.js';
export type { RegisterUsageAnalysis, RegisterConflict, ReachingDefinitionInfo, AvailableExpressionInfo, } from './il-types.js';
export type { MemoryAllocationInfo, ParameterOptimizationHints, LocalVariableOptimizationHints, GlobalOptimizationOpportunity, ProgramResourceUsage, InterFunctionOptimization, ModuleResourceUsage, } from './il-types.js';
export { isILConstant, isILVariable, isILRegister, isILTemporary, isILMemoryLocation, isILLabel, isILParameterReference, isILReturnReference, } from './il-types.js';
export { createILConstant, createILVariable, createILRegister, createILTemporary, createILLabel, createILInstruction, createILProgram, createILModule, createILFunction, } from './il-types.js';
export { ilValueToString, ilInstructionToString } from './il-types.js';
export { createLoadImmediate, createLoadMemory, createStoreMemory, createCopy, createAdd, createSub, createMul, createDiv, createMod, createNeg, createAnd, createOr, createNot, createBitwiseAnd, createBitwiseOr, createBitwiseXor, createBitwiseNot, createShiftLeft, createShiftRight, createCompareEq, createCompareNe, createCompareLt, createCompareLe, createCompareGt, createCompareGe, createBranch, createBranchIfTrue, createBranchIfFalse, createBranchIfZero, createBranchIfNotZero, createCall, createReturn, createDeclareLocal, createLoadVariable, createStoreVariable, createLoadArray, createStoreArray, createArrayAddress, createLabel, createNop, createComment, createPeek, createPoke, createRegisterOp, createSetFlags, createClearFlags, ILInstructionFactory, ILInstructionError, InstructionCreationContext, createInstructionContext, resetGlobalInstructionContext, validateILInstruction, } from './instructions.js';
/**
 * IL package version information.
 */
export declare const IL_VERSION = "0.1.0";
/**
 * Supported target platforms for IL generation.
 */
export declare const SUPPORTED_PLATFORMS: readonly ["c64", "vic20", "x16"];
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
/**
 * IL instruction categories for optimization and analysis.
 */
export declare const INSTRUCTION_CATEGORIES: {
    readonly MEMORY: readonly ["LOAD_IMMEDIATE", "LOAD_MEMORY", "STORE_MEMORY", "COPY"];
    readonly ARITHMETIC: readonly ["ADD", "SUB", "MUL", "DIV", "MOD", "NEG"];
    readonly LOGICAL: readonly ["AND", "OR", "NOT"];
    readonly BITWISE: readonly ["BITWISE_AND", "BITWISE_OR", "BITWISE_XOR", "BITWISE_NOT", "SHIFT_LEFT", "SHIFT_RIGHT"];
    readonly COMPARISON: readonly ["COMPARE_EQ", "COMPARE_NE", "COMPARE_LT", "COMPARE_LE", "COMPARE_GT", "COMPARE_GE"];
    readonly CONTROL_FLOW: readonly ["BRANCH", "BRANCH_IF_TRUE", "BRANCH_IF_FALSE", "BRANCH_IF_ZERO", "BRANCH_IF_NOT_ZERO"];
    readonly FUNCTION: readonly ["CALL", "RETURN"];
    readonly VARIABLE: readonly ["DECLARE_LOCAL", "LOAD_VARIABLE", "STORE_VARIABLE"];
    readonly ARRAY: readonly ["LOAD_ARRAY", "STORE_ARRAY", "ARRAY_ADDRESS"];
    readonly UTILITY: readonly ["LABEL", "NOP", "COMMENT"];
    readonly HARDWARE: readonly ["REGISTER_OP", "PEEK", "POKE", "SET_FLAGS", "CLEAR_FLAGS"];
};
export type InstructionCategory = keyof typeof INSTRUCTION_CATEGORIES;
/**
 * Get the category for a given IL instruction type.
 */
export declare function getInstructionCategory(instructionType: ILInstructionType): InstructionCategory | null;
/**
 * Check if an instruction type is in a specific category.
 */
export declare function isInstructionInCategory(instructionType: ILInstructionType, category: InstructionCategory): boolean;
/**
 * Get estimated cycle cost for common 6502 operations.
 * These are baseline estimates that can be refined by optimization passes.
 */
export declare function getEstimatedCycles(instructionType: ILInstructionType, addressingMode?: AddressingMode6502): number;
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
export { ASTToILTransformer, createASTToILTransformer, transformProgramToIL } from './ast-to-il.js';
export type { TransformationResult, TransformationError, TransformationWarning, ExpressionTransformResult, StatementTransformResult, TransformationContext, } from './ast-to-il.js';
export { ILValidator, createILValidator, validateILProgram, validateILModule, validateILFunction, ILValidationErrorType, ILValidationSeverity, } from './il-validator.js';
export type { ILValidationResult, ILValidationError, ILValidationStatistics, ValidationErrorContext, ControlFlowAnalysisResult, } from './il-validator.js';
export { ControlFlowAnalyzer, analyzeCFG } from './analysis/control-flow-analyzer.js';
export type { ControlFlowAnalysisResult as AdvancedControlFlowAnalysisResult, CFGAnalysisOptions, CFGAnalysisMetrics, } from './analysis/control-flow-analyzer.js';
export type { BasicBlock as CFGBasicBlock, ControlFlowGraph as AdvancedControlFlowGraph, CFGEdge, CFGEdgeType, DominanceAnalysis, DominanceTree, DominanceRelation, LoopAnalysis, NaturalLoop, BackEdge, LoopNestingTree, LoopType, LoopCharacteristics, InductionVariableInfo, InductionVariableUsage, DataDependencyAnalysis, VariableDefinition, VariableUse, DefinitionType, UsageType, VariableDependencyGraph, DataFlowEquation, DataFlowEquationType, MemoryDependency, MemoryDependencyType, MemoryLocation, LiveVariableAnalysis, InterferenceGraph, VariableInterference, InterferenceType, VariableLifetime, CriticalPathAnalysis, CriticalPath, HotBlock, PerformanceBottleneck, BottleneckType, OptimizationOpportunity, OptimizationOpportunityType, OptimizationComplexity, InstructionLocation, } from './analysis/types/control-flow-types.js';
export { SixtyTwo6502Analyzer, analyze6502 } from './analysis/6502-analyzer.js';
export type { SixtyTwo6502ValidationResult, SixtyTwo6502AnalysisOptions, ProcessorVariant, PlatformTarget, CycleTimingResult, MemoryLayoutValidationResult, RegisterAllocationAnalysis, PerformanceHotspotAnalysis, HardwareConstraintValidation, SixtyTwo6502Optimization, ValidationIssue, InstructionTimingInfo, TimingAccuracy, MemoryModelAccuracy, } from './analysis/types/6502-analysis-types.js';
export { Base6502Analyzer, VIC20_6502Analyzer, C64_6510Analyzer, X16_65C02Analyzer, } from './analysis/6502-variants/index.js';
export { ILMetricsAnalyzer, analyzeILQuality } from './analysis/il-metrics-analyzer.js';
export type { ILQualityAnalysisResult, QualityAnalysisOptions, QualityAnalysisMetrics, ILComplexityMetrics, PerformancePredictionModel, OptimizationReadinessAnalysis, QualityGateAnalysis, QualityAnalysisSummary, ImprovementRecommendation, ComplexityLevel, PerformanceLevel, OptimizationPotential, InstructionComplexityScore, ControlFlowComplexityScore, DataFlowComplexityScore, CycleEstimate, MemoryUsageEstimate, RegisterPressureAnalysis, PerformanceBottleneck as QualityPerformanceBottleneck, PlatformSpecificFactors, OptimizationCategory, ReadinessScore, PatternApplicabilityScore, OptimizationImpactEstimate, TransformationSafetyAnalysis, QualityGate, QualityGateStatus, QualityThresholdSet, QualityGateType, QualityThreshold, ThresholdDirection, GateImportance, RecommendationType, RecommendationPriority, ImplementationEffort, ExpertiseLevel, BottleneckLocation, BottleneckSeverity, MemorySegmentUsage, RegisterPressureMetric, PressureRegion, MemoryTimingFactors, ProcessorFeatureFactors, PlatformConstraintFactors, UncertaintyFactor, OptimizationBlocker, BlockerType, BlockerSeverity, OptimizationOpportunity as QualityOptimizationOpportunity, OpportunityType, SafetyLevel, PatternPrerequisite, PrerequisiteType, ImpactMetric, SemanticSafetyAnalysis, PerformanceSafetyAnalysis, PlatformSafetyAnalysis, RiskFactor, RiskType, RiskSeverity, OptimizationLevel, AnalysisDepth, } from './analysis/types/metrics-types.js';
export { PatternReadinessAnalyzer } from './analysis/pattern-readiness-analyzer.js';
export { ILOptimizationFramework, optimizeIL, optimizeFunction, } from './optimization/optimization-framework.js';
export { OptimizationPatternRegistryImpl, createDefaultPatternRegistry, PatternBuilder, createPattern, } from './optimization/pattern-registry.js';
export type * from './optimization/types.js';
export { OptimizationLevel as ILOptimizationLevel, OptimizationCategory as ILOptimizationCategory, OptimizationPriority, OptimizationSafety, OptimizationErrorType, OptimizationWarningType, DEFAULT_OPTIMIZATION_CONFIG, } from './optimization/types.js';
export { ILAnalyticsSuite } from './analysis/il-analytics-suite.js';
export type { ComprehensiveAnalyticsResult, AnalyticsSummary, OptimizationRecommendation, AnalyticsIssue, AnalyticsPerformanceMetrics, AnalyticsPerformanceBenchmarks, AnalyticsAccuracyStandards, } from './analysis/il-analytics-suite.js';
export type { PatternReadinessAnalysisResult, RankedPatternRecommendation, PatternConflictPrediction, OptimizationStrategy, PatternSelectionMetrics, PatternApplicationStep, PatternSafetyAssessment, PatternAnalysisMetadata, PatternConfidenceLevel, PatternPrerequisite as PatternAnalysisPrerequisite, PatternBenefitEstimate, BenefitConfidenceInterval, PatternApplicationContext, PatternRiskFactor, PatternRiskType, PatternConflictType, ConflictSeverity, ConflictImpactAssessment, ConflictResolutionStrategy, ResolutionComplexity, ConflictResolutionOutcome, OptimizationStrategyType, StrategyBenefitEstimate, StrategyRiskProfile, StrategyResourceRequirements, AlternativeStrategy, StrategyTradeoffs, SelectionPerformanceMetrics, RollbackStrategy, RollbackStrategyType, RollbackComplexity, SuccessCriterion, CriterionPriority, SafetyRecommendation, SafetyImportance, ValidationRequirement, ValidationType, PatternAnalysisOptions, RiskTolerance, OptimizationGoals, PlatformConstraints, MemoryConstraints, TimingConstraints, HardwareConstraints, PerformanceContextInfo, ExecutionFrequency, SafetyContextInfo, SafetyRequirement, ValidationLevel, ExpertiseRequirement, RiskLevel, } from './analysis/pattern-readiness-analyzer.js';
export { ILProgramBuilder, ILModuleBuilder, ILFunctionBuilder, createILBuilderContext, quickProgram, quickFunction, createArithmeticExpression, createIfThenElse, createAssignment, createFunctionPrologue, createFunctionEpilogue, } from './il-builder.js';
export type { ILBuilderContext } from './il-builder.js';
//# sourceMappingURL=index.d.ts.map