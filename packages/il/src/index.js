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
export { ILInstructionType } from './il-types.js';
// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================
export { isILConstant, isILVariable, isILRegister, isILTemporary, isILMemoryLocation, isILLabel, isILParameterReference, isILReturnReference, } from './il-types.js';
// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================
export { createILConstant, createILVariable, createILRegister, createILTemporary, createILLabel, createILInstruction, createILProgram, createILModule, createILFunction, } from './il-types.js';
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
export { ilValueToString, ilInstructionToString } from './il-types.js';
// ============================================================================
// TASK 2.2: IL INSTRUCTION CREATION
// ============================================================================
// Instruction creation functions
export { createLoadImmediate, createLoadMemory, createStoreMemory, createCopy, createAdd, createSub, createMul, createDiv, createMod, createNeg, createAnd, createOr, createNot, createBitwiseAnd, createBitwiseOr, createBitwiseXor, createBitwiseNot, createShiftLeft, createShiftRight, createCompareEq, createCompareNe, createCompareLt, createCompareLe, createCompareGt, createCompareGe, createBranch, createBranchIfTrue, createBranchIfFalse, createBranchIfZero, createBranchIfNotZero, createCall, createReturn, createDeclareLocal, createLoadVariable, createStoreVariable, createLoadArray, createStoreArray, createArrayAddress, createLabel, createNop, createComment, createPeek, createPoke, createRegisterOp, createSetFlags, createClearFlags, ILInstructionFactory, ILInstructionError, InstructionCreationContext, createInstructionContext, resetGlobalInstructionContext, validateILInstruction, } from './instructions.js';
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
export const SUPPORTED_PLATFORMS = ['c64', 'vic20', 'x16'];
/**
 * IL instruction categories for optimization and analysis.
 */
export const INSTRUCTION_CATEGORIES = {
    MEMORY: ['LOAD_IMMEDIATE', 'LOAD_MEMORY', 'STORE_MEMORY', 'COPY'],
    ARITHMETIC: ['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'NEG'],
    LOGICAL: ['AND', 'OR', 'NOT'],
    BITWISE: ['BITWISE_AND', 'BITWISE_OR', 'BITWISE_XOR', 'BITWISE_NOT', 'SHIFT_LEFT', 'SHIFT_RIGHT'],
    COMPARISON: ['COMPARE_EQ', 'COMPARE_NE', 'COMPARE_LT', 'COMPARE_LE', 'COMPARE_GT', 'COMPARE_GE'],
    CONTROL_FLOW: [
        'BRANCH',
        'BRANCH_IF_TRUE',
        'BRANCH_IF_FALSE',
        'BRANCH_IF_ZERO',
        'BRANCH_IF_NOT_ZERO',
    ],
    FUNCTION: ['CALL', 'RETURN'],
    VARIABLE: ['DECLARE_LOCAL', 'LOAD_VARIABLE', 'STORE_VARIABLE'],
    ARRAY: ['LOAD_ARRAY', 'STORE_ARRAY', 'ARRAY_ADDRESS'],
    UTILITY: ['LABEL', 'NOP', 'COMMENT'],
    HARDWARE: ['REGISTER_OP', 'PEEK', 'POKE', 'SET_FLAGS', 'CLEAR_FLAGS'],
};
/**
 * Get the category for a given IL instruction type.
 */
export function getInstructionCategory(instructionType) {
    for (const [category, instructions] of Object.entries(INSTRUCTION_CATEGORIES)) {
        if (instructions.includes(instructionType)) {
            return category;
        }
    }
    return null;
}
/**
 * Check if an instruction type is in a specific category.
 */
export function isInstructionInCategory(instructionType, category) {
    const categoryInstructions = INSTRUCTION_CATEGORIES[category];
    return categoryInstructions.includes(instructionType);
}
/**
 * Get estimated cycle cost for common 6502 operations.
 * These are baseline estimates that can be refined by optimization passes.
 */
export function getEstimatedCycles(instructionType, addressingMode = 'absolute') {
    // Base cycle costs for different operation types
    const baseCycles = {
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
        CLEAR_FLAGS: 2,
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
export { ASTToILTransformer, createASTToILTransformer, transformProgramToIL } from './ast-to-il.js';
// ============================================================================
// TASK 2.4: IL VALIDATION SYSTEM
// ============================================================================
// IL validation functionality
export { ILValidator, createILValidator, validateILProgram, validateILModule, validateILFunction, ILValidationErrorType, ILValidationSeverity, } from './il-validator.js';
// ============================================================================
// TASK 2.4.1: ADVANCED CONTROL FLOW GRAPH ANALYTICS
// ============================================================================
// CFG analytics functionality
export { ControlFlowAnalyzer, analyzeCFG } from './analysis/control-flow-analyzer.js';
// ============================================================================
// TASK 2.4.2: 6502-SPECIFIC DEEP VALIDATION SYSTEM
// ============================================================================
// 6502-specific analysis functionality
export { SixtyTwo6502Analyzer, analyze6502 } from './analysis/6502-analyzer.js';
// 6502 processor variant analyzers
export { Base6502Analyzer, VIC20_6502Analyzer, C64_6510Analyzer, X16_65C02Analyzer, } from './analysis/6502-variants/index.js';
// ============================================================================
// TASK 2.4.3: IL QUALITY METRICS AND ANALYTICS FRAMEWORK
// ============================================================================
// IL quality metrics and analytics functionality
export { ILMetricsAnalyzer, analyzeILQuality } from './analysis/il-metrics-analyzer.js';
// ============================================================================
// TASK 2.4.4: PATTERN-READINESS ANALYTICS INTEGRATION
// ============================================================================
// Pattern-readiness analytics functionality
export { PatternReadinessAnalyzer } from './analysis/pattern-readiness-analyzer.js';
// ============================================================================
// TASK 2.5: IL OPTIMIZATION FRAMEWORK
// ============================================================================
// Optimization framework functionality
export { ILOptimizationFramework, optimizeIL, optimizeFunction, } from './optimization/optimization-framework.js';
// Pattern registry functionality
export { OptimizationPatternRegistryImpl, createDefaultPatternRegistry, PatternBuilder, createPattern, } from './optimization/pattern-registry.js';
export { OptimizationLevel as ILOptimizationLevel, OptimizationCategory as ILOptimizationCategory, OptimizationPriority, OptimizationSafety, OptimizationErrorType, OptimizationWarningType, DEFAULT_OPTIMIZATION_CONFIG, } from './optimization/types.js';
// ============================================================================
// TASK 2.4.5: COMPREHENSIVE IL ANALYTICS TESTING AND INTEGRATION
// ============================================================================
// Complete IL analytics suite functionality
export { ILAnalyticsSuite } from './analysis/il-analytics-suite.js';
// ============================================================================
// TASK 2.6: IL BUILDER HELPER FUNCTIONS
// ============================================================================
// IL Builder functionality for convenient IL construction
export { ILProgramBuilder, ILModuleBuilder, ILFunctionBuilder, createILBuilderContext, quickProgram, quickFunction, createArithmeticExpression, createIfThenElse, createAssignment, createFunctionPrologue, createFunctionEpilogue, } from './il-builder.js';
//# sourceMappingURL=index.js.map