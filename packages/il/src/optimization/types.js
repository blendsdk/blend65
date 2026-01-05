/**
 * @fileoverview IL Optimization Framework Types
 *
 * Defines types for the IL optimization system that intelligently applies
 * 470+ optimization patterns using analytics intelligence.
 */
/**
 * Optimization pass levels following GCC-style conventions
 */
export var OptimizationLevel;
(function (OptimizationLevel) {
    /** No optimization */
    OptimizationLevel["O0"] = "O0";
    /** Basic optimization - dead code elimination, constant folding */
    OptimizationLevel["O1"] = "O1";
    /** Standard optimization - includes O1 + function inlining, loop optimization */
    OptimizationLevel["O2"] = "O2";
    /** Aggressive optimization - includes O2 + 6502-specific patterns, size optimization */
    OptimizationLevel["O3"] = "O3";
    /** Size optimization - prioritize code size over speed */
    OptimizationLevel["Os"] = "Os";
    /** Debug optimization - minimal optimization for debugging */
    OptimizationLevel["Og"] = "Og";
})(OptimizationLevel || (OptimizationLevel = {}));
/**
 * Optimization pattern categories matching the 470+ pattern system
 */
export var OptimizationCategory;
(function (OptimizationCategory) {
    /** Dead code elimination, unreachable code removal */
    OptimizationCategory["DEAD_CODE"] = "dead_code";
    /** Constant folding, constant propagation */
    OptimizationCategory["CONSTANTS"] = "constants";
    /** Function inlining, tail call optimization */
    OptimizationCategory["FUNCTIONS"] = "functions";
    /** Loop unrolling, loop invariant code motion */
    OptimizationCategory["LOOPS"] = "loops";
    /** Register allocation, register coalescing */
    OptimizationCategory["REGISTERS"] = "registers";
    /** Zero page optimization, memory layout */
    OptimizationCategory["MEMORY"] = "memory";
    /** 6502-specific peephole optimizations */
    OptimizationCategory["PEEPHOLE"] = "peephole";
    /** Control flow optimization, branch elimination */
    OptimizationCategory["CONTROL_FLOW"] = "control_flow";
    /** Arithmetic optimization, strength reduction */
    OptimizationCategory["ARITHMETIC"] = "arithmetic";
    /** Hardware-specific optimizations (VIC-II, SID, CIA) */
    OptimizationCategory["HARDWARE"] = "hardware";
    /** Size optimization patterns */
    OptimizationCategory["SIZE"] = "size";
    /** Speed optimization patterns */
    OptimizationCategory["SPEED"] = "speed";
})(OptimizationCategory || (OptimizationCategory = {}));
/**
 * Priority levels for optimization pattern application
 */
export var OptimizationPriority;
(function (OptimizationPriority) {
    /** Critical optimizations that must be applied */
    OptimizationPriority["CRITICAL"] = "critical";
    /** High priority optimizations with significant impact */
    OptimizationPriority["HIGH"] = "high";
    /** Medium priority optimizations with moderate impact */
    OptimizationPriority["MEDIUM"] = "medium";
    /** Low priority optimizations with minimal impact */
    OptimizationPriority["LOW"] = "low";
    /** Optional optimizations that may or may not help */
    OptimizationPriority["OPTIONAL"] = "optional";
})(OptimizationPriority || (OptimizationPriority = {}));
/**
 * Optimization transformation safety levels
 */
export var OptimizationSafety;
(function (OptimizationSafety) {
    /** Always safe to apply */
    OptimizationSafety["SAFE"] = "safe";
    /** Safe with conditions - requires validation */
    OptimizationSafety["CONDITIONAL"] = "conditional";
    /** Potentially unsafe - careful analysis required */
    OptimizationSafety["RISKY"] = "risky";
    /** Unsafe - may break semantics */
    OptimizationSafety["UNSAFE"] = "unsafe";
})(OptimizationSafety || (OptimizationSafety = {}));
/**
 * Types of optimization errors
 */
export var OptimizationErrorType;
(function (OptimizationErrorType) {
    /** Pattern application failed */
    OptimizationErrorType["PATTERN_APPLICATION_FAILED"] = "pattern_application_failed";
    /** Pattern conflicts detected */
    OptimizationErrorType["PATTERN_CONFLICT"] = "pattern_conflict";
    /** Invalid optimization configuration */
    OptimizationErrorType["INVALID_CONFIG"] = "invalid_config";
    /** Optimization time limit exceeded */
    OptimizationErrorType["TIME_LIMIT_EXCEEDED"] = "time_limit_exceeded";
    /** Memory limit exceeded during optimization */
    OptimizationErrorType["MEMORY_LIMIT_EXCEEDED"] = "memory_limit_exceeded";
    /** Semantic correctness validation failed */
    OptimizationErrorType["CORRECTNESS_VALIDATION_FAILED"] = "correctness_validation_failed";
    /** Unknown pattern referenced */
    OptimizationErrorType["UNKNOWN_PATTERN"] = "unknown_pattern";
    /** Circular pattern dependency */
    OptimizationErrorType["CIRCULAR_DEPENDENCY"] = "circular_dependency";
})(OptimizationErrorType || (OptimizationErrorType = {}));
/**
 * Types of optimization warnings
 */
export var OptimizationWarningType;
(function (OptimizationWarningType) {
    /** Pattern skipped due to safety concerns */
    OptimizationWarningType["PATTERN_SKIPPED_UNSAFE"] = "pattern_skipped_unsafe";
    /** Pattern had minimal impact */
    OptimizationWarningType["MINIMAL_IMPACT"] = "minimal_impact";
    /** Pattern may affect debugging */
    OptimizationWarningType["DEBUGGING_IMPACT"] = "debugging_impact";
    /** Pattern may affect timing */
    OptimizationWarningType["TIMING_IMPACT"] = "timing_impact";
    /** Pattern uses experimental features */
    OptimizationWarningType["EXPERIMENTAL_FEATURE"] = "experimental_feature";
})(OptimizationWarningType || (OptimizationWarningType = {}));
/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG = {
    level: OptimizationLevel.O2,
    targetVariant: 'c64-6510',
    maxPasses: 10,
    timeLimit: 30000, // 30 seconds
    enabledCategories: new Set([
        OptimizationCategory.DEAD_CODE,
        OptimizationCategory.CONSTANTS,
        OptimizationCategory.FUNCTIONS,
        OptimizationCategory.LOOPS,
        OptimizationCategory.REGISTERS,
        OptimizationCategory.MEMORY,
        OptimizationCategory.PEEPHOLE,
        OptimizationCategory.CONTROL_FLOW,
        OptimizationCategory.ARITHMETIC,
    ]),
    disabledPatterns: new Set(),
    sizeSpeedTradeoff: 0.7, // Slightly favor speed
    enableExperimental: false,
    debug: {
        logDecisions: false,
        generateReports: true,
        validateCorrectness: true,
    },
};
//# sourceMappingURL=types.js.map