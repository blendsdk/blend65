/**
 * Semantic Analysis Infrastructure - Core Types and Interfaces
 * Task 1.1: Create Semantic Analysis Infrastructure
 *
 * This file defines the foundational types for the Blend65 semantic analyzer:
 * - Symbol system for tracking variables, functions, modules, types, enums
 * - Type system with Blend65's unique storage classes
 * - Scope hierarchy for lexical scoping
 * - Error reporting with rich source location information
 * - Type compatibility checking utilities
 *
 * Educational Focus:
 * - How compilers represent program symbols internally
 * - Type system design for 6502 development
 * - Lexical scoping and symbol resolution
 * - Compiler error reporting best practices
 */
import { SourcePosition } from '@blend65/lexer';
import type { Expression } from '@blend65/ast';
/**
 * Base interface for all symbols in the Blend65 symbol table.
 * Every symbol (variable, function, type, etc.) implements this interface.
 *
 * Educational Note:
 * - Symbols are the compiler's internal representation of named entities
 * - Source location tracking enables precise error reporting
 * - Scope tracking enables proper variable resolution
 */
export interface Symbol {
    /** The name of the symbol (e.g., "playerX", "updatePlayer") */
    name: string;
    /** What kind of symbol this is (variable, function, etc.) */
    symbolType: SymbolType;
    /** Where this symbol was defined in the source code */
    sourceLocation: SourcePosition;
    /** Which scope owns this symbol */
    scope: Scope;
    /** Whether this symbol is exported from its module */
    isExported: boolean;
}
/**
 * Discriminator for different symbol types.
 * Used for TypeScript discriminated unions and type checking.
 */
export type SymbolType = 'Variable' | 'Function' | 'Module' | 'Type' | 'Enum';
/**
 * Variable symbol - represents Blend65 variable declarations.
 *
 * Examples:
 * - var counter: byte = 0
 * - zp var playerX: byte
 * - data var palette: byte[16] = [...]
 *
 * Educational Note:
 * - Storage classes are unique to Blend65 for 6502 memory management
 * - Initial values must be compile-time constants for 'data' and 'const'
 * - Task 1.8: Enhanced with optimization metadata for 6502 code generation
 */
export interface VariableSymbol extends Symbol {
    symbolType: 'Variable';
    /** The type of the variable (byte, word, boolean, array, etc.) */
    varType: Blend65Type;
    /** Storage class for memory allocation (zp, ram, data, const, io) */
    storageClass: StorageClass | null;
    /** Initial value expression (if provided) */
    initialValue: Expression | null;
    /** Whether this is a local variable (function parameter or local declaration) */
    isLocal: boolean;
    /** Task 1.8: Optimization metadata for 6502 code generation */
    optimizationMetadata?: VariableOptimizationMetadata;
}
/**
 * Function symbol - represents Blend65 function declarations.
 *
 * Examples:
 * - function add(a: byte, b: byte): byte
 * - callback function onInterrupt(): void
 *
 * Educational Note:
 * - Callback functions can be assigned to callback variables
 * - Parameter types enable function call validation
 * - Task 1.9: Enhanced with optimization metadata for inlining and call optimization
 */
export interface FunctionSymbol extends Symbol {
    symbolType: 'Function';
    /** Function parameters with names and types */
    parameters: ParameterInfo[];
    /** Return type (void for no return) */
    returnType: Blend65Type;
    /** Whether this is a callback function */
    isCallback: boolean;
    /** Task 1.9: Optimization metadata for function inlining and call optimization */
    optimizationMetadata?: FunctionOptimizationMetadata;
}
/**
 * Module symbol - represents Blend65 module declarations.
 *
 * Examples:
 * - module Game.Main
 * - module c64.sprites
 *
 * Educational Note:
 * - Modules organize code and provide namespace isolation
 * - Qualified names enable hierarchical organization
 */
export interface ModuleSymbol extends Symbol {
    symbolType: 'Module';
    /** Qualified module name parts (e.g., ["Game", "Main"]) */
    qualifiedName: string[];
    /** Symbols exported by this module */
    exports: Map<string, Symbol>;
    /** Modules imported by this module */
    imports: Map<string, ImportInfo>;
}
/**
 * Type symbol - represents Blend65 type declarations.
 *
 * Examples:
 * - type Player extends HasPos ... end type
 * - type Color ... end type
 *
 * Educational Note:
 * - User-defined types for structured data
 * - Inheritance through 'extends' keyword
 */
export interface TypeSymbol extends Symbol {
    symbolType: 'Type';
    /** The actual type definition */
    typeDefinition: Blend65Type;
    /** Base types this type extends */
    extends: Blend65Type[];
    /** Fields in this type */
    fields: TypeFieldInfo[];
}
/**
 * Enum symbol - represents Blend65 enum declarations.
 *
 * Examples:
 * - enum GameState MENU = 1, PLAYING, PAUSED end enum
 * - enum Color RED = 2, GREEN, BLUE = 8 end enum
 *
 * Educational Note:
 * - Enums provide named constants with auto-increment
 * - Useful for state machines and configuration
 */
export interface EnumSymbol extends Symbol {
    symbolType: 'Enum';
    /** Enum members with names and values */
    members: Map<string, EnumMemberInfo>;
    /** The underlying type (usually byte) */
    underlyingType: Blend65Type;
}
/**
 * Union type for all types in the Blend65 type system.
 *
 * Educational Note:
 * - Type systems enable compile-time error detection
 * - Different type kinds require different validation rules
 */
export type Blend65Type = PrimitiveType | ArrayType | NamedType | CallbackType;
/**
 * Primitive types built into Blend65.
 *
 * Educational Note:
 * - byte: 8-bit value (0-255), most common 6502 type
 * - word: 16-bit value (0-65535), for addresses and larger values
 * - boolean: true/false, stored as byte
 * - void: no value, only valid for function returns
 * - callback: function pointer type
 */
export interface PrimitiveType {
    kind: 'primitive';
    name: 'byte' | 'word' | 'boolean' | 'void' | 'callback';
}
/**
 * Array type with compile-time size.
 *
 * Examples:
 * - byte[256] (256-byte array)
 * - word[100] (100-word array)
 *
 * Educational Note:
 * - Array sizes must be compile-time constants for 6502
 * - No dynamic arrays in v0.1 (planned for future versions)
 */
export interface ArrayType {
    kind: 'array';
    elementType: Blend65Type;
    size: number;
}
/**
 * Named type reference (user-defined types).
 *
 * Examples:
 * - Player (references a type declaration)
 * - Color (references an enum)
 *
 * Educational Note:
 * - References are resolved during semantic analysis
 * - Enables forward declarations and recursive types
 */
export interface NamedType {
    kind: 'named';
    name: string;
    resolvedType?: Blend65Type;
}
/**
 * Callback type for function pointers.
 *
 * Examples:
 * - callback: void (no parameters, no return)
 * - callback(byte, byte): word (two byte params, word return)
 *
 * Educational Note:
 * - Enables function pointers and interrupt handlers
 * - Type-safe function assignments
 */
export interface CallbackType {
    kind: 'callback';
    parameterTypes: Blend65Type[];
    returnType: Blend65Type;
}
/**
 * Storage classes for Blend65 variables.
 * Each class maps to different 6502 memory regions.
 *
 * Educational Note:
 * - zp: Zero page ($00-$FF), fastest access, limited space
 * - ram: General RAM, normal access speed
 * - data: Pre-initialized data, compile-time constants
 * - const: Read-only constants, often in ROM
 * - io: Memory-mapped I/O, hardware registers
 */
export type StorageClass = 'zp' | 'ram' | 'data' | 'const' | 'io';
/**
 * Represents a lexical scope in the Blend65 program.
 * Scopes form a tree structure with nested visibility rules.
 *
 * Educational Note:
 * - Lexical scoping: inner scopes can access outer scope symbols
 * - Symbol resolution walks up the scope chain
 * - Each scope type has different rules
 */
export interface Scope {
    /** What kind of scope this is */
    scopeType: ScopeType;
    /** Parent scope (null for global scope) */
    parent: Scope | null;
    /** Symbols defined directly in this scope */
    symbols: Map<string, Symbol>;
    /** Child scopes contained within this scope */
    children: Scope[];
    /** Optional name for debugging (function name, module name, etc.) */
    name?: string;
}
/**
 * Different types of scopes in Blend65.
 *
 * Educational Note:
 * - Global: Top-level scope, contains all modules
 * - Module: Module scope, contains module's declarations
 * - Function: Function scope, contains parameters and local variables
 * - Block: Block scope, contains local variables within blocks
 */
export type ScopeType = 'Global' | 'Module' | 'Function' | 'Block';
/**
 * Represents a semantic error found during analysis.
 *
 * Educational Note:
 * - Rich error information helps developers fix problems quickly
 * - Source location enables IDE integration and precise error highlighting
 * - Suggestions provide actionable guidance
 */
export interface SemanticError {
    /** What category of error this is */
    errorType: SemanticErrorType;
    /** Human-readable error message */
    message: string;
    /** Where the error occurred in the source code */
    location: SourcePosition;
    /** Optional suggestions for fixing the error */
    suggestions?: string[];
    /** Related errors (for complex multi-part errors) */
    relatedErrors?: SemanticError[];
}
/**
 * Categories of semantic errors.
 *
 * Educational Note:
 * - Different error types enable different error recovery strategies
 * - IDE tooling can provide different icons/colors per error type
 * - Error categories help with compiler debugging
 */
export type SemanticErrorType = 'UndefinedSymbol' | 'DuplicateSymbol' | 'DuplicateIdentifier' | 'TypeMismatch' | 'InvalidStorageClass' | 'ImportNotFound' | 'ExportNotFound' | 'ModuleNotFound' | 'InvalidScope' | 'ConstantRequired' | 'CallbackMismatch' | 'ArrayBounds' | 'InvalidOperation' | 'CircularDependency';
/**
 * Result type for operations that can fail with semantic errors.
 *
 * Educational Note:
 * - Result types make error handling explicit and type-safe
 * - Prevents accidentally ignoring errors
 * - Enables compiler phases to continue after non-fatal errors
 */
export type SemanticResult<T> = {
    success: true;
    data: T;
    warnings?: SemanticError[];
} | {
    success: false;
    errors: SemanticError[];
    warnings?: SemanticError[];
};
/**
 * Comprehensive optimization metadata for variables.
 * Collects all information needed for zero page promotion, register allocation,
 * and 6502-specific memory layout optimization.
 *
 * Educational Note:
 * - Zero page promotion: Move frequently accessed variables to fast zero page memory
 * - Register allocation: Assign short-lived variables to A/X/Y registers
 * - Lifetime analysis: Determine when variables are live for interference detection
 * - Usage patterns: Optimize based on access frequency and loop usage
 */
export interface VariableOptimizationMetadata {
    /** Usage pattern analysis */
    usageStatistics: VariableUsageStatistics;
    /** Zero page promotion analysis */
    zeroPageCandidate: ZeroPageCandidateInfo;
    /** Register allocation analysis */
    registerCandidate: RegisterCandidateInfo;
    /** Variable lifetime analysis */
    lifetimeInfo: VariableLifetimeInfo;
    /** 6502-specific optimization hints */
    sixtyTwoHints: Variable6502OptimizationHints;
    /** Memory layout preferences */
    memoryLayout: VariableMemoryLayoutInfo;
}
/**
 * Usage pattern statistics for a variable.
 */
export interface VariableUsageStatistics {
    /** Total number of times this variable is accessed */
    accessCount: number;
    /** Number of read accesses */
    readCount: number;
    /** Number of write accesses */
    writeCount: number;
    /** Number of read-modify-write accesses (++, +=, etc.) */
    modifyCount: number;
    /** Loop nesting levels where this variable is used */
    loopUsage: LoopUsageInfo[];
    /** Hot path usage (frequently executed code) */
    hotPathUsage: number;
    /** Average access frequency estimate */
    estimatedAccessFrequency: AccessFrequency;
    /** Access pattern type */
    accessPattern: VariableAccessPattern;
}
/**
 * Information about variable usage within loops.
 */
export interface LoopUsageInfo {
    /** Nesting level of the loop (1 = outermost, 2 = nested, etc.) */
    loopLevel: number;
    /** Number of accesses within this loop level */
    accessesInLoop: number;
    /** Whether the variable is loop-invariant at this level */
    isLoopInvariant: boolean;
    /** Whether this might be an induction variable */
    isInductionVariable: boolean;
    /** Estimated loop iteration count */
    estimatedIterations: number;
}
/**
 * Access frequency classification.
 */
export type AccessFrequency = 'rare' | 'normal' | 'frequent' | 'very_frequent' | 'hot';
/**
 * Variable access pattern classification.
 */
export type VariableAccessPattern = 'single_use' | 'multiple_read' | 'read_write' | 'loop_dependent' | 'sequential_array' | 'random_array' | 'hot_path' | 'induction_variable' | 'accumulator';
/**
 * Zero page promotion candidate information.
 */
export interface ZeroPageCandidateInfo {
    /** Whether this variable is a good zero page candidate */
    isCandidate: boolean;
    /** Zero page promotion priority score (0-100, higher is better) */
    promotionScore: number;
    /** Estimated benefit of zero page promotion (cycle savings) */
    estimatedBenefit: number;
    /** Size requirement in zero page (bytes) */
    sizeRequirement: number;
    /** Factors contributing to promotion decision */
    promotionFactors: ZeroPagePromotionFactor[];
    /** Factors against promotion */
    antiPromotionFactors: ZeroPageAntiPromotionFactor[];
    /** Final recommendation */
    recommendation: ZeroPageRecommendation;
}
/**
 * Factors that favor zero page promotion.
 */
export interface ZeroPagePromotionFactor {
    factor: ZeroPagePromotionFactorType;
    weight: number;
    description: string;
}
export type ZeroPagePromotionFactorType = 'high_access_frequency' | 'loop_usage' | 'hot_path_usage' | 'small_size' | 'arithmetic_operations' | 'index_operations' | 'no_storage_class' | 'short_lifetime';
/**
 * Factors that discourage zero page promotion.
 */
export interface ZeroPageAntiPromotionFactor {
    factor: ZeroPageAntiPromotionFactorType;
    weight: number;
    description: string;
}
export type ZeroPageAntiPromotionFactorType = 'already_zp' | 'large_size' | 'io_access' | 'const_data' | 'low_frequency' | 'single_use' | 'zero_page_pressure';
/**
 * Zero page promotion recommendation.
 */
export type ZeroPageRecommendation = 'strongly_recommended' | 'recommended' | 'neutral' | 'not_recommended' | 'strongly_discouraged';
/**
 * Register allocation candidate information.
 */
export interface RegisterCandidateInfo {
    /** Whether this variable is suitable for register allocation */
    isCandidate: boolean;
    /** Preferred register for allocation */
    preferredRegister: PreferredRegister;
    /** Alternative registers that could be used */
    alternativeRegisters: PreferredRegister[];
    /** Register allocation benefit score (0-100) */
    allocationScore: number;
    /** Estimated benefit of register allocation (cycle savings) */
    estimatedBenefit: number;
    /** Variable's interference with other register candidates */
    interferenceInfo: RegisterInterferenceInfo;
    /** Register usage patterns */
    usagePatterns: RegisterUsagePattern[];
    /** Final allocation recommendation */
    recommendation: RegisterAllocationRecommendation;
}
/**
 * Preferred register types for 6502.
 */
export type PreferredRegister = 'A' | 'X' | 'Y' | 'zero_page' | 'memory';
/**
 * Register interference information.
 */
export interface RegisterInterferenceInfo {
    /** Other variables that interfere with this one */
    interferingVariables: string[];
    /** Register pressure at allocation sites */
    registerPressure: RegisterPressureLevel[];
    /** Whether allocation would require spilling other variables */
    requiresSpilling: boolean;
    /** Cost of potential spilling */
    spillingCost: number;
}
/**
 * Register pressure level information.
 */
export interface RegisterPressureLevel {
    location: SourcePosition;
    pressure: 'low' | 'medium' | 'high' | 'critical';
    availableRegisters: PreferredRegister[];
}
/**
 * Register usage patterns.
 */
export interface RegisterUsagePattern {
    pattern: RegisterUsagePatternType;
    frequency: number;
    benefit: number;
}
export type RegisterUsagePatternType = 'arithmetic_accumulator' | 'array_index' | 'loop_counter' | 'temporary_storage' | 'function_parameter' | 'function_return' | 'address_calculation';
/**
 * Register allocation recommendation.
 */
export type RegisterAllocationRecommendation = 'strongly_recommended' | 'recommended' | 'conditional' | 'not_recommended' | 'impossible';
/**
 * Variable lifetime information for interference analysis.
 */
export interface VariableLifetimeInfo {
    /** Program points where variable is defined */
    definitionPoints: SourcePosition[];
    /** Program points where variable is used */
    usePoints: SourcePosition[];
    /** Program points where variable is live */
    liveRanges: LiveRange[];
    /** Whether variable lifetime spans function calls */
    spansFunctionCalls: boolean;
    /** Whether variable lifetime spans loops */
    spansLoops: boolean;
    /** Estimated lifetime duration (in basic blocks) */
    estimatedDuration: number;
    /** Variables that interfere with this one */
    interferingVariables: string[];
}
/**
 * Live range information for a variable.
 */
export interface LiveRange {
    /** Start of live range */
    start: SourcePosition;
    /** End of live range */
    end: SourcePosition;
    /** Whether this range spans a loop */
    spansLoop: boolean;
    /** Whether this range is in a hot path */
    isHotPath: boolean;
}
/**
 * 6502-specific optimization hints for variables.
 */
export interface Variable6502OptimizationHints {
    /** Preferred addressing mode for this variable */
    addressingMode: AddressingModeHint;
    /** Memory bank preference */
    memoryBank: MemoryBank;
    /** Whether variable should be aligned */
    alignmentPreference: AlignmentPreference;
    /** Hardware interaction hints */
    hardwareInteraction: HardwareInteractionHint;
    /** Optimization opportunities */
    optimizationOpportunities: VariableOptimizationOpportunity[];
    /** Performance characteristics */
    performanceHints: VariablePerformanceHint[];
}
/**
 * Addressing mode hints for 6502.
 */
export type AddressingModeHint = 'zero_page' | 'absolute' | 'zero_page_x' | 'zero_page_y' | 'absolute_x' | 'absolute_y' | 'indirect' | 'indexed_indirect' | 'indirect_indexed';
/**
 * Memory bank preferences for 6502.
 */
export type MemoryBank = 'zero_page' | 'stack' | 'low_ram' | 'high_ram' | 'io_area' | 'rom_area' | 'cartridge';
/**
 * Variable alignment preferences.
 */
export interface AlignmentPreference {
    /** Required alignment (1, 2, 4, 8, etc.) */
    requiredAlignment: number;
    /** Preferred alignment for performance */
    preferredAlignment: number;
    /** Whether variable benefits from page boundary alignment */
    preferPageBoundary: boolean;
    /** Reason for alignment requirement */
    reason: AlignmentReason;
}
export type AlignmentReason = 'none' | 'word_access' | 'array_optimization' | 'hardware_requirement' | 'performance' | 'cache_line';
/**
 * Hardware interaction hints.
 */
export interface HardwareInteractionHint {
    /** Whether variable interacts with hardware registers */
    isHardwareRegister: boolean;
    /** Whether variable is memory-mapped I/O */
    isMemoryMappedIO: boolean;
    /** Whether variable is timing-critical */
    isTimingCritical: boolean;
    /** Whether variable is used in interrupt handlers */
    usedInInterrupts: boolean;
    /** Hardware components this variable interacts with */
    hardwareComponents: HardwareComponent[];
}
export type HardwareComponent = 'vic_ii' | 'sid' | 'cia1' | 'cia2' | 'color_ram' | 'sprite_data' | 'character_rom' | 'kernel_rom' | 'basic_rom';
/**
 * Variable optimization opportunities.
 */
export interface VariableOptimizationOpportunity {
    opportunity: VariableOptimizationOpportunityType;
    benefit: number;
    complexity: OptimizationComplexity;
    description: string;
}
export type VariableOptimizationOpportunityType = 'constant_propagation' | 'dead_store_elimination' | 'common_subexpression' | 'loop_invariant_motion' | 'strength_reduction' | 'induction_variable' | 'register_promotion' | 'memory_layout' | 'addressing_mode';
export type OptimizationComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';
/**
 * Variable performance hints.
 */
export interface VariablePerformanceHint {
    hint: VariablePerformanceHintType;
    impact: PerformanceImpact;
    description: string;
}
export type VariablePerformanceHintType = 'hot_variable' | 'cold_variable' | 'cache_friendly' | 'cache_unfriendly' | 'memory_bandwidth' | 'critical_path' | 'spill_candidate' | 'prefetch_candidate';
export type PerformanceImpact = 'low' | 'medium' | 'high' | 'critical';
/**
 * Comprehensive optimization metadata for functions.
 * Collects all information needed for function inlining decisions, call optimization,
 * and callback function performance analysis.
 *
 * Educational Note:
 * - Function inlining: Replace function calls with function body for performance
 * - Call optimization: Optimize parameter passing and return value handling
 * - Callback optimization: Optimize function pointer calls and interrupt handlers
 * - 6502-specific: Consider JSR/RTS costs, register usage patterns, stack management
 */
export interface FunctionOptimizationMetadata {
    /** Function call pattern analysis */
    callStatistics: FunctionCallStatistics;
    /** Function inlining candidate analysis */
    inliningCandidate: InliningCandidateInfo;
    /** Function call optimization analysis */
    callOptimization: CallOptimizationInfo;
    /** Callback function optimization analysis */
    callbackOptimization: CallbackOptimizationInfo;
    /** 6502-specific function optimization hints */
    sixtyTwoHints: Function6502OptimizationHints;
    /** Function performance characteristics */
    performanceProfile: FunctionPerformanceProfile;
}
/**
 * Function call pattern statistics.
 */
export interface FunctionCallStatistics {
    /** Total number of times this function is called */
    callCount: number;
    /** Number of direct calls (function name) */
    directCallCount: number;
    /** Number of indirect calls (through callback variables) */
    indirectCallCount: number;
    /** Call sites information */
    callSites: FunctionCallSite[];
    /** Call frequency distribution */
    callFrequency: CallFrequency;
    /** Whether function is called in hot paths */
    hotPathCalls: number;
    /** Whether function is called in loops */
    loopCalls: FunctionLoopCallInfo[];
    /** Call context information */
    callContexts: FunctionCallContext[];
}
/**
 * Information about a function call site.
 */
export interface FunctionCallSite {
    /** Location of the call */
    location: SourcePosition;
    /** Type of call (direct, indirect, recursive) */
    callType: FunctionCallType;
    /** Arguments passed at this call site */
    argumentTypes: Blend65Type[];
    /** Whether this call is in a hot path */
    isHotPath: boolean;
    /** Whether this call is in a loop */
    loopNesting: number;
    /** Estimated call frequency at this site */
    estimatedFrequency: number;
    /** Call context (function or global) */
    callingContext: string;
}
/**
 * Type of function call.
 */
export type FunctionCallType = 'direct' | 'indirect' | 'recursive' | 'tail_call' | 'cross_module';
/**
 * Function call frequency classification.
 */
export type CallFrequency = 'never' | 'rare' | 'occasional' | 'frequent' | 'very_frequent' | 'hot';
/**
 * Information about function calls within loops.
 */
export interface FunctionLoopCallInfo {
    /** Nesting level of the loop */
    loopLevel: number;
    /** Number of calls within this loop level */
    callsInLoop: number;
    /** Estimated loop iterations */
    estimatedIterations: number;
    /** Whether the call is loop-invariant */
    isLoopInvariant: boolean;
    /** Cost of the call in this loop context */
    loopCallCost: number;
}
/**
 * Function call context information.
 */
export interface FunctionCallContext {
    /** Name of the calling function (or 'global' for module level) */
    callingFunction: string;
    /** Number of calls from this context */
    callsFromContext: number;
    /** Whether this context is performance-critical */
    isCriticalPath: boolean;
    /** Call depth from this context */
    callDepth: number;
}
/**
 * Function inlining candidate information.
 */
export interface InliningCandidateInfo {
    /** Whether this function is a good inlining candidate */
    isCandidate: boolean;
    /** Inlining priority score (0-100, higher is better) */
    inliningScore: number;
    /** Estimated benefit of inlining (cycle savings) */
    estimatedBenefit: number;
    /** Estimated cost of inlining (code size increase) */
    estimatedCost: number;
    /** Function complexity metrics */
    complexityMetrics: FunctionComplexityMetrics;
    /** Factors favoring inlining */
    inliningFactors: InliningFactor[];
    /** Factors against inlining */
    antiInliningFactors: AntiInliningFactor[];
    /** Final inlining recommendation */
    recommendation: InliningRecommendation;
    /** Call sites that would benefit most from inlining */
    highValueCallSites: SourcePosition[];
}
/**
 * Function complexity metrics for inlining decisions.
 */
export interface FunctionComplexityMetrics {
    /** Number of AST nodes in function body */
    astNodeCount: number;
    /** Estimated code size in 6502 bytes */
    estimatedCodeSize: number;
    /** Number of local variables */
    localVariableCount: number;
    /** Number of function calls within this function */
    internalCallCount: number;
    /** Maximum nesting depth of control structures */
    maxNestingDepth: number;
    /** Number of return statements */
    returnStatementCount: number;
    /** Whether function has loops */
    hasLoops: boolean;
    /** Whether function has complex control flow */
    hasComplexControlFlow: boolean;
    /** Cyclomatic complexity estimate */
    cyclomaticComplexity: number;
}
/**
 * Factors that favor function inlining.
 */
export interface InliningFactor {
    factor: InliningFactorType;
    weight: number;
    description: string;
}
export type InliningFactorType = 'small_function' | 'frequent_calls' | 'hot_path_calls' | 'simple_logic' | 'no_recursion' | 'few_parameters' | 'single_return' | 'no_side_effects' | 'constant_parameters' | 'tail_call_elimination';
/**
 * Factors that discourage function inlining.
 */
export interface AntiInliningFactor {
    factor: AntiInliningFactorType;
    weight: number;
    description: string;
}
export type AntiInliningFactorType = 'large_function' | 'rare_calls' | 'complex_logic' | 'many_parameters' | 'recursive_function' | 'multiple_returns' | 'side_effects' | 'code_bloat' | 'callback_function' | 'exported_function';
/**
 * Function inlining recommendation.
 */
export type InliningRecommendation = 'strongly_recommended' | 'recommended' | 'conditional' | 'not_recommended' | 'strongly_discouraged' | 'impossible';
/**
 * Function call optimization information.
 */
export interface CallOptimizationInfo {
    /** Parameter passing optimization */
    parameterOptimization: ParameterOptimizationInfo;
    /** Return value optimization */
    returnOptimization: ReturnOptimizationInfo;
    /** Register usage optimization */
    registerOptimization: FunctionRegisterOptimizationInfo;
    /** Stack usage optimization */
    stackOptimization: StackOptimizationInfo;
    /** 6502-specific call optimizations */
    callConventionOptimization: CallConventionOptimizationInfo;
}
/**
 * Parameter passing optimization information.
 */
export interface ParameterOptimizationInfo {
    /** Total number of parameters */
    parameterCount: number;
    /** Parameters that can be passed in registers */
    registerParameters: RegisterParameterInfo[];
    /** Parameters that must be passed on stack */
    stackParameters: StackParameterInfo[];
    /** Parameter passing cost analysis */
    passingCost: ParameterPassingCost;
    /** Optimization opportunities for parameters */
    optimizationOpportunities: ParameterOptimizationOpportunity[];
}
/**
 * Information about parameters passed in registers.
 */
export interface RegisterParameterInfo {
    parameterName: string;
    parameterType: Blend65Type;
    preferredRegister: PreferredRegister;
    passingCost: number;
}
/**
 * Information about parameters passed on stack.
 */
export interface StackParameterInfo {
    parameterName: string;
    parameterType: Blend65Type;
    stackOffset: number;
    passingCost: number;
}
/**
 * Parameter passing cost analysis.
 */
export interface ParameterPassingCost {
    /** Total cost in cycles to pass all parameters */
    totalCycles: number;
    /** Cost breakdown by parameter */
    costBreakdown: ParameterCostBreakdown[];
    /** Whether parameter passing is efficient */
    isEfficient: boolean;
    /** Suggestions for optimization */
    optimizationSuggestions: string[];
}
/**
 * Cost breakdown for individual parameters.
 */
export interface ParameterCostBreakdown {
    parameterName: string;
    cycles: number;
    method: ParameterPassingMethod;
    efficiency: ParameterPassingEfficiency;
}
export type ParameterPassingMethod = 'register_A' | 'register_X' | 'register_Y' | 'zero_page' | 'stack' | 'global_variable';
export type ParameterPassingEfficiency = 'optimal' | 'good' | 'acceptable' | 'poor';
/**
 * Parameter optimization opportunities.
 */
export interface ParameterOptimizationOpportunity {
    opportunity: ParameterOptimizationOpportunityType;
    parameterName: string;
    benefit: number;
    description: string;
}
export type ParameterOptimizationOpportunityType = 'register_allocation' | 'constant_parameter' | 'unused_parameter' | 'parameter_combining' | 'zero_page_passing' | 'elimination';
/**
 * Return value optimization information.
 */
export interface ReturnOptimizationInfo {
    /** Return type analysis */
    returnType: Blend65Type;
    /** How return value is passed back */
    returnMethod: ReturnValueMethod;
    /** Cost of returning the value */
    returnCost: number;
    /** Whether return can be optimized */
    canOptimize: boolean;
    /** Optimization opportunities */
    optimizationOpportunities: ReturnOptimizationOpportunity[];
}
export type ReturnValueMethod = 'register_A' | 'register_AX' | 'register_XY' | 'zero_page' | 'global_variable' | 'stack' | 'void';
/**
 * Return value optimization opportunities.
 */
export interface ReturnOptimizationOpportunity {
    opportunity: ReturnOptimizationOpportunityType;
    benefit: number;
    description: string;
}
export type ReturnOptimizationOpportunityType = 'register_return' | 'void_return' | 'constant_return' | 'elimination' | 'direct_use';
/**
 * Function register usage optimization information.
 */
export interface FunctionRegisterOptimizationInfo {
    /** Registers used by this function */
    registersUsed: PreferredRegister[];
    /** Registers that must be preserved */
    registersToPreserve: PreferredRegister[];
    /** Register allocation conflicts */
    registerConflicts: RegisterConflictInfo[];
    /** Register optimization opportunities */
    optimizationOpportunities: FunctionRegisterOptimizationOpportunity[];
}
/**
 * Register conflict information.
 */
export interface RegisterConflictInfo {
    register: PreferredRegister;
    conflictType: RegisterConflictType;
    conflictSeverity: ConflictSeverity;
    resolutionCost: number;
}
export type RegisterConflictType = 'parameter_conflict' | 'return_conflict' | 'caller_save' | 'callee_save' | 'cross_call_conflict';
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Function register optimization opportunities.
 */
export interface FunctionRegisterOptimizationOpportunity {
    opportunity: FunctionRegisterOptimizationOpportunityType;
    register: PreferredRegister;
    benefit: number;
    description: string;
}
export type FunctionRegisterOptimizationOpportunityType = 'register_reuse' | 'eliminate_save_restore' | 'parameter_register' | 'return_register' | 'local_allocation' | 'cross_function_allocation';
/**
 * Stack usage optimization information.
 */
export interface StackOptimizationInfo {
    /** Stack space required by function */
    stackSpaceRequired: number;
    /** Stack usage breakdown */
    stackUsageBreakdown: StackUsageItem[];
    /** Whether stack usage is efficient */
    isStackUsageEfficient: boolean;
    /** Stack optimization opportunities */
    optimizationOpportunities: StackOptimizationOpportunity[];
}
/**
 * Individual stack usage item.
 */
export interface StackUsageItem {
    purpose: StackUsagePurpose;
    size: number;
    frequency: StackUsageFrequency;
    canOptimize: boolean;
}
export type StackUsagePurpose = 'local_variables' | 'parameter_passing' | 'return_address' | 'register_save' | 'temporary_storage';
export type StackUsageFrequency = 'always' | 'conditional' | 'rare';
/**
 * Stack optimization opportunities.
 */
export interface StackOptimizationOpportunity {
    opportunity: StackOptimizationOpportunityType;
    benefit: number;
    description: string;
}
export type StackOptimizationOpportunityType = 'eliminate_locals' | 'register_locals' | 'reduce_parameters' | 'eliminate_saves' | 'stack_reuse' | 'tail_call' | 'leaf_function';
/**
 * 6502-specific calling convention optimization.
 */
export interface CallConventionOptimizationInfo {
    /** Whether function follows standard calling convention */
    followsStandardConvention: boolean;
    /** Optimized calling convention for this function */
    optimizedConvention: CallingConvention;
    /** Benefits of optimized convention */
    optimizationBenefits: CallConventionBenefit[];
    /** Constraints preventing optimization */
    constraints: CallConventionConstraint[];
}
/**
 * Calling convention types.
 */
export type CallingConvention = 'standard' | 'register_only' | 'zero_page' | 'global_variables' | 'inline_expanded' | 'tail_call' | 'custom_optimized';
/**
 * Benefits of calling convention optimization.
 */
export interface CallConventionBenefit {
    benefit: CallConventionBenefitType;
    cycleSavings: number;
    codeSizeDelta: number;
}
export type CallConventionBenefitType = 'faster_calls' | 'smaller_code' | 'better_register_use' | 'eliminated_stack_ops' | 'parameter_optimization' | 'return_optimization';
/**
 * Constraints preventing calling convention optimization.
 */
export interface CallConventionConstraint {
    constraint: CallConventionConstraintType;
    severity: ConflictSeverity;
    description: string;
}
export type CallConventionConstraintType = 'exported_function' | 'recursive_function' | 'callback_function' | 'variable_parameters' | 'complex_return' | 'cross_module_calls' | 'interrupt_handler';
/**
 * Callback function optimization information.
 */
export interface CallbackOptimizationInfo {
    /** Whether this is a callback function */
    isCallbackFunction: boolean;
    /** Callback usage patterns */
    callbackUsage: CallbackUsagePattern[];
    /** Callback performance analysis */
    performanceAnalysis: CallbackPerformanceAnalysis;
    /** Callback optimization opportunities */
    optimizationOpportunities: CallbackOptimizationOpportunity[];
    /** Interrupt handler specific optimizations */
    interruptOptimization?: InterruptHandlerOptimizationInfo;
}
/**
 * Callback usage patterns.
 */
export interface CallbackUsagePattern {
    pattern: CallbackUsagePatternType;
    frequency: number;
    performance: CallbackPerformanceImpact;
}
export type CallbackUsagePatternType = 'single_assignment' | 'multiple_assignment' | 'array_dispatch' | 'conditional_call' | 'loop_call' | 'interrupt_handler' | 'event_handler' | 'state_machine';
export type CallbackPerformanceImpact = 'low' | 'medium' | 'high' | 'critical';
/**
 * Callback performance analysis.
 */
export interface CallbackPerformanceAnalysis {
    /** Indirect call overhead */
    indirectCallOverhead: number;
    /** Function pointer setup cost */
    setupCost: number;
    /** Whether callback benefits from optimization */
    benefitsFromOptimization: boolean;
    /** Performance bottlenecks */
    bottlenecks: CallbackBottleneck[];
}
/**
 * Callback performance bottlenecks.
 */
export interface CallbackBottleneck {
    bottleneck: CallbackBottleneckType;
    impact: CallbackPerformanceImpact;
    description: string;
}
export type CallbackBottleneckType = 'indirect_call_overhead' | 'function_pointer_setup' | 'parameter_passing' | 'register_conflicts' | 'memory_access' | 'call_frequency';
/**
 * Callback optimization opportunities.
 */
export interface CallbackOptimizationOpportunity {
    opportunity: CallbackOptimizationOpportunityType;
    benefit: number;
    applicability: OptimizationApplicability;
    description: string;
}
export type CallbackOptimizationOpportunityType = 'direct_call_conversion' | 'inline_expansion' | 'dispatch_optimization' | 'register_optimization' | 'call_site_optimization' | 'function_pointer_caching';
export type OptimizationApplicability = 'always' | 'conditional' | 'specific_cases' | 'never';
/**
 * Interrupt handler specific optimization information.
 */
export interface InterruptHandlerOptimizationInfo {
    /** Type of interrupt handler */
    interruptType: InterruptType;
    /** Interrupt frequency estimate */
    interruptFrequency: InterruptFrequency;
    /** Register preservation requirements */
    registerPreservation: InterruptRegisterPreservation;
    /** Timing constraints */
    timingConstraints: InterruptTimingConstraints;
    /** Interrupt-specific optimizations */
    optimizations: InterruptOptimization[];
}
export type InterruptType = 'raster' | 'timer' | 'serial' | 'user' | 'nmi' | 'irq';
export type InterruptFrequency = 'very_rare' | 'rare' | 'occasional' | 'frequent' | 'very_frequent';
/**
 * Interrupt register preservation requirements.
 */
export interface InterruptRegisterPreservation {
    /** Registers that must be preserved */
    registersToPreserve: PreferredRegister[];
    /** Registers that can be modified */
    modifiableRegisters: PreferredRegister[];
    /** Cost of register preservation */
    preservationCost: number;
}
/**
 * Interrupt timing constraints.
 */
export interface InterruptTimingConstraints {
    /** Maximum execution time allowed */
    maxExecutionTime: number;
    /** Whether timing is critical */
    isCriticalTiming: boolean;
    /** Jitter tolerance */
    jitterTolerance: number;
    /** Real-time requirements */
    realTimeRequirements: RealTimeRequirement[];
}
/**
 * Real-time requirements for interrupt handlers.
 */
export interface RealTimeRequirement {
    requirement: RealTimeRequirementType;
    constraint: number;
    criticality: ConflictSeverity;
}
export type RealTimeRequirementType = 'max_latency' | 'max_execution_time' | 'min_frequency' | 'max_jitter' | 'real_time_deadline';
/**
 * Interrupt-specific optimizations.
 */
export interface InterruptOptimization {
    optimization: InterruptOptimizationType;
    benefit: number;
    description: string;
}
export type InterruptOptimizationType = 'minimal_preserve' | 'fast_entry_exit' | 'inline_critical_path' | 'reduce_complexity' | 'defer_processing' | 'optimize_nesting';
/**
 * 6502-specific function optimization hints.
 */
export interface Function6502OptimizationHints {
    /** Whether function is suitable for zero page optimization */
    zeroPageOptimization: ZeroPageFunctionOptimization;
    /** Register allocation strategy for this function */
    registerStrategy: FunctionRegisterStrategy;
    /** Memory layout preferences */
    memoryLayout: FunctionMemoryLayout;
    /** Performance characteristics */
    performanceCharacteristics: FunctionPerformanceCharacteristics;
    /** 6502-specific optimization opportunities */
    optimizationOpportunities: Function6502OptimizationOpportunity[];
}
/**
 * Zero page optimization for functions.
 */
export interface ZeroPageFunctionOptimization {
    /** Whether function benefits from zero page usage */
    benefitsFromZeroPage: boolean;
    /** Local variables that should be in zero page */
    zeroPageLocalVariables: string[];
    /** Parameters that should use zero page */
    zeroPageParameters: string[];
    /** Estimated benefit of zero page usage */
    estimatedBenefit: number;
}
/**
 * Register allocation strategy for functions.
 */
export interface FunctionRegisterStrategy {
    /** Primary register allocation strategy */
    strategy: RegisterAllocationStrategy;
    /** Register assignment preferences */
    registerAssignments: FunctionRegisterAssignment[];
    /** Register pressure analysis */
    registerPressure: FunctionRegisterPressure;
}
export type RegisterAllocationStrategy = 'minimal' | 'aggressive' | 'balanced' | 'specialized' | 'none';
/**
 * Function register assignments.
 */
export interface FunctionRegisterAssignment {
    register: PreferredRegister;
    purpose: RegisterAssignmentPurpose;
    variable: string | null;
    benefit: number;
}
export type RegisterAssignmentPurpose = 'parameter' | 'return_value' | 'local_variable' | 'loop_counter' | 'temporary' | 'address_calculation';
/**
 * Function register pressure analysis.
 */
export interface FunctionRegisterPressure {
    /** Overall register pressure level */
    overallPressure: ConflictSeverity;
    /** Pressure at specific program points */
    pressurePoints: FunctionRegisterPressurePoint[];
    /** Whether function needs register spilling */
    needsSpilling: boolean;
    /** Cost of register spilling */
    spillingCost: number;
}
/**
 * Register pressure at specific points.
 */
export interface FunctionRegisterPressurePoint {
    location: SourcePosition;
    pressure: ConflictSeverity;
    availableRegisters: PreferredRegister[];
    demandedRegisters: PreferredRegister[];
}
/**
 * Function memory layout preferences.
 */
export interface FunctionMemoryLayout {
    /** Preferred code section */
    codeSection: CodeSection;
    /** Local variable layout */
    localVariableLayout: FunctionLocalVariableLayout;
    /** Whether function should be aligned */
    alignmentPreference: FunctionAlignmentPreference;
}
export type CodeSection = 'hot_code' | 'warm_code' | 'cold_code' | 'initialization' | 'interrupt_code' | 'utility_code';
/**
 * Local variable layout within function.
 */
export interface FunctionLocalVariableLayout {
    /** Layout strategy */
    strategy: LocalVariableLayoutStrategy;
    /** Variable groupings */
    variableGroups: LocalVariableGroup[];
    /** Stack frame optimization */
    stackFrameOptimization: StackFrameOptimization;
}
export type LocalVariableLayoutStrategy = 'stack_based' | 'register_based' | 'zero_page_based' | 'mixed' | 'minimal';
/**
 * Group of related local variables.
 */
export interface LocalVariableGroup {
    variables: string[];
    groupType: LocalVariableGroupType;
    layout: GroupLayoutPreference;
}
export type LocalVariableGroupType = 'frequently_accessed' | 'same_type' | 'loop_variables' | 'temporary_calculations' | 'state_variables';
/**
 * Stack frame optimization information.
 */
export interface StackFrameOptimization {
    /** Whether stack frame can be optimized */
    canOptimize: boolean;
    /** Stack frame size reduction potential */
    sizeReduction: number;
    /** Optimization strategies */
    strategies: StackFrameOptimizationStrategy[];
}
export type StackFrameOptimizationStrategy = 'eliminate_frame_pointer' | 'reuse_parameter_space' | 'minimize_alignment' | 'combine_variables' | 'register_spill_opt';
/**
 * Function alignment preferences.
 */
export interface FunctionAlignmentPreference {
    /** Required function alignment */
    requiredAlignment: number;
    /** Preferred alignment for performance */
    preferredAlignment: number;
    /** Whether function benefits from page alignment */
    preferPageAlignment: boolean;
    /** Alignment reason */
    reason: FunctionAlignmentReason;
}
export type FunctionAlignmentReason = 'none' | 'performance' | 'branch_target' | 'interrupt_vector' | 'page_boundary';
/**
 * Function performance characteristics.
 */
export interface FunctionPerformanceCharacteristics {
    /** Execution frequency classification */
    executionFrequency: FunctionExecutionFrequency;
    /** Performance hotspots within function */
    hotspots: FunctionHotspot[];
    /** Critical path analysis */
    criticalPath: FunctionCriticalPath;
    /** Performance bottlenecks */
    bottlenecks: FunctionBottleneck[];
    /** Optimization potential */
    optimizationPotential: FunctionOptimizationPotential;
}
export type FunctionExecutionFrequency = 'never' | 'rare' | 'occasional' | 'frequent' | 'very_frequent' | 'hot';
/**
 * Performance hotspot within a function.
 */
export interface FunctionHotspot {
    /** Location of hotspot */
    location: SourcePosition;
    /** Type of hotspot */
    hotspotType: FunctionHotspotType;
    /** Performance impact */
    impact: PerformanceImpact;
    /** Description of hotspot */
    description: string;
}
export type FunctionHotspotType = 'loop' | 'memory_access' | 'arithmetic' | 'function_call' | 'branch' | 'register_pressure';
/**
 * Critical path information for function.
 */
export interface FunctionCriticalPath {
    /** Whether function is on critical path */
    isOnCriticalPath: boolean;
    /** Critical path percentage */
    criticalPathPercentage: number;
    /** Operations on critical path */
    criticalOperations: CriticalOperation[];
}
/**
 * Critical operation within function.
 */
export interface CriticalOperation {
    location: SourcePosition;
    operation: CriticalOperationType;
    cycles: number;
    impact: PerformanceImpact;
}
export type CriticalOperationType = 'memory_load' | 'memory_store' | 'arithmetic' | 'branch' | 'function_call' | 'register_transfer';
/**
 * Performance bottleneck within function.
 */
export interface FunctionBottleneck {
    bottleneck: FunctionBottleneckType;
    location: SourcePosition;
    impact: PerformanceImpact;
    description: string;
}
export type FunctionBottleneckType = 'memory_bandwidth' | 'register_pressure' | 'branch_misprediction' | 'data_dependency' | 'function_call_overhead' | 'stack_operations';
/**
 * Function optimization potential analysis.
 */
export interface FunctionOptimizationPotential {
    /** Overall optimization potential score (0-100) */
    overallScore: number;
    /** Potential optimizations */
    potentialOptimizations: PotentialOptimization[];
    /** Estimated total benefit */
    estimatedTotalBenefit: number;
    /** Implementation complexity */
    implementationComplexity: OptimizationComplexity;
}
/**
 * Potential optimization for function.
 */
export interface PotentialOptimization {
    optimization: FunctionOptimizationType;
    benefit: number;
    complexity: OptimizationComplexity;
    description: string;
}
export type FunctionOptimizationType = 'inlining' | 'loop_unrolling' | 'register_allocation' | 'dead_code_elimination' | 'constant_propagation' | 'strength_reduction' | 'tail_call_optimization' | 'parameter_optimization';
/**
 * 6502-specific function optimization opportunities.
 */
export interface Function6502OptimizationOpportunity {
    opportunity: Function6502OptimizationOpportunityType;
    benefit: number;
    complexity: OptimizationComplexity;
    description: string;
}
export type Function6502OptimizationOpportunityType = 'zero_page_usage' | 'register_optimization' | 'addressing_mode' | 'branch_optimization' | 'memory_layout' | 'stack_optimization' | 'interrupt_optimization' | 'hardware_acceleration';
/**
 * Function performance profile.
 */
export interface FunctionPerformanceProfile {
    /** Execution statistics */
    executionStats: FunctionExecutionStats;
    /** Resource usage */
    resourceUsage: FunctionResourceUsage;
    /** Performance metrics */
    performanceMetrics: FunctionPerformanceMetrics;
    /** Optimization recommendations */
    optimizationRecommendations: FunctionOptimizationRecommendation[];
}
/**
 * Function execution statistics.
 */
export interface FunctionExecutionStats {
    /** Estimated execution cycles */
    estimatedCycles: number;
    /** Call frequency */
    callFrequency: CallFrequency;
    /** Execution time distribution */
    executionTimeDistribution: ExecutionTimeDistribution;
    /** Performance variability */
    performanceVariability: PerformanceVariability;
}
/**
 * Execution time distribution.
 */
export interface ExecutionTimeDistribution {
    minimum: number;
    maximum: number;
    average: number;
    standardDeviation: number;
}
/**
 * Performance variability information.
 */
export interface PerformanceVariability {
    variability: PerformanceVariabilityLevel;
    causes: VariabilityCause[];
}
export type PerformanceVariabilityLevel = 'low' | 'medium' | 'high';
/**
 * Cause of performance variability.
 */
export interface VariabilityCause {
    cause: VariabilityCauseType;
    impact: PerformanceImpact;
    description: string;
}
export type VariabilityCauseType = 'input_dependent' | 'branch_dependent' | 'memory_dependent' | 'register_pressure' | 'call_context';
/**
 * Function resource usage.
 */
export interface FunctionResourceUsage {
    /** Register usage */
    registerUsage: FunctionRegisterUsage;
    /** Memory usage */
    memoryUsage: FunctionMemoryUsage;
    /** Stack usage */
    stackUsage: FunctionStackUsage;
    /** Zero page usage */
    zeroPageUsage: FunctionZeroPageUsage;
}
/**
 * Function register usage details.
 */
export interface FunctionRegisterUsage {
    /** Registers used by function */
    registersUsed: RegisterUsageDetail[];
    /** Register pressure level */
    registerPressure: ConflictSeverity;
    /** Register conflicts */
    registerConflicts: RegisterConflictInfo[];
}
/**
 * Register usage detail.
 */
export interface RegisterUsageDetail {
    register: PreferredRegister;
    usage: RegisterUsageType;
    frequency: number;
    benefit: number;
}
export type RegisterUsageType = 'parameter' | 'return_value' | 'local_variable' | 'temporary' | 'address_calculation' | 'loop_counter';
/**
 * Function memory usage details.
 */
export interface FunctionMemoryUsage {
    /** Total memory used */
    totalMemoryUsed: number;
    /** Memory usage breakdown */
    memoryBreakdown: MemoryUsageBreakdown[];
    /** Memory access patterns */
    accessPatterns: FunctionMemoryAccessPattern[];
}
/**
 * Memory usage breakdown.
 */
export interface MemoryUsageBreakdown {
    purpose: MemoryUsagePurpose;
    size: number;
    location: MemoryLocation;
}
export type MemoryUsagePurpose = 'code' | 'local_variables' | 'constants' | 'temporary_storage';
export type MemoryLocation = 'zero_page' | 'ram' | 'rom' | 'stack';
/**
 * Function memory access pattern.
 */
export interface FunctionMemoryAccessPattern {
    pattern: MemoryAccessPatternType;
    frequency: number;
    efficiency: MemoryAccessEfficiency;
}
export type MemoryAccessEfficiency = 'optimal' | 'good' | 'acceptable' | 'poor';
/**
 * Function stack usage details.
 */
export interface FunctionStackUsage {
    /** Maximum stack depth */
    maxStackDepth: number;
    /** Stack usage breakdown */
    stackBreakdown: StackUsageItem[];
    /** Stack efficiency */
    stackEfficiency: StackUsageEfficiency;
}
export type StackUsageEfficiency = 'optimal' | 'good' | 'acceptable' | 'poor';
/**
 * Function zero page usage details.
 */
export interface FunctionZeroPageUsage {
    /** Zero page bytes used */
    zeroPageBytesUsed: number;
    /** Zero page usage efficiency */
    zeroPageEfficiency: ZeroPageUsageEfficiency;
    /** Zero page allocation details */
    zeroPageAllocations: ZeroPageAllocation[];
}
export type ZeroPageUsageEfficiency = 'optimal' | 'good' | 'acceptable' | 'poor';
/**
 * Zero page allocation detail.
 */
export interface ZeroPageAllocation {
    purpose: ZeroPageUsagePurpose;
    size: number;
    benefit: number;
}
export type ZeroPageUsagePurpose = 'parameter' | 'local_variable' | 'temporary' | 'address_pointer';
/**
 * Function performance metrics.
 */
export interface FunctionPerformanceMetrics {
    /** Cycles per call */
    cyclesPerCall: number;
    /** Instructions per call */
    instructionsPerCall: number;
    /** Memory accesses per call */
    memoryAccessesPerCall: number;
    /** Branch instructions per call */
    branchInstructionsPerCall: number;
    /** Performance efficiency rating */
    efficiencyRating: PerformanceEfficiencyRating;
}
export type PerformanceEfficiencyRating = 'excellent' | 'good' | 'acceptable' | 'poor';
/**
 * Function optimization recommendation.
 */
export interface FunctionOptimizationRecommendation {
    recommendation: FunctionOptimizationRecommendationType;
    priority: OptimizationPriority;
    estimatedBenefit: number;
    implementationEffort: ImplementationEffort;
    description: string;
}
export type FunctionOptimizationRecommendationType = 'inline_function' | 'optimize_registers' | 'reduce_parameters' | 'eliminate_recursion' | 'optimize_loops' | 'improve_memory_layout' | 'use_zero_page' | 'optimize_branches';
export type OptimizationPriority = 'low' | 'medium' | 'high' | 'critical';
export type ImplementationEffort = 'trivial' | 'low' | 'medium' | 'high' | 'very_high';
/**
 * Variable memory layout information.
 */
export interface VariableMemoryLayoutInfo {
    /** Preferred memory region */
    preferredRegion: MemoryRegion;
    /** Size in bytes */
    sizeInBytes: number;
    /** Alignment requirements */
    alignment: AlignmentPreference;
    /** Whether variable should be grouped with related variables */
    groupingPreference: VariableGroupingInfo;
    /** Memory access patterns */
    accessPatterns: MemoryAccessPattern[];
    /** Locality characteristics */
    localityInfo: MemoryLocalityInfo;
}
/**
 * Memory regions for variable placement.
 */
export type MemoryRegion = 'zero_page_high_priority' | 'zero_page_normal' | 'ram_fast' | 'ram_normal' | 'ram_slow' | 'data_section' | 'bss_section' | 'io_region';
/**
 * Variable grouping preferences.
 */
export interface VariableGroupingInfo {
    /** Whether this variable should be grouped */
    shouldGroup: boolean;
    /** Variables that should be grouped together */
    groupWith: string[];
    /** Reason for grouping */
    groupingReason: VariableGroupingReason;
    /** Preferred group layout */
    layoutPreference: GroupLayoutPreference;
}
export type VariableGroupingReason = 'cache_locality' | 'struct_members' | 'array_elements' | 'related_state' | 'hardware_registers' | 'function_locals';
export type GroupLayoutPreference = 'sequential' | 'interleaved' | 'aligned' | 'packed' | 'scattered';
/**
 * Memory access patterns for variables.
 */
export interface MemoryAccessPattern {
    pattern: MemoryAccessPatternType;
    frequency: number;
    spatialLocality: SpatialLocality;
    temporalLocality: TemporalLocality;
}
export type MemoryAccessPatternType = 'sequential' | 'random' | 'strided' | 'clustered' | 'sparse' | 'single_shot';
export type SpatialLocality = 'none' | 'low' | 'medium' | 'high';
export type TemporalLocality = 'none' | 'low' | 'medium' | 'high';
/**
 * Memory locality characteristics.
 */
export interface MemoryLocalityInfo {
    /** Spatial locality (nearby addresses accessed together) */
    spatialLocality: SpatialLocality;
    /** Temporal locality (same address accessed again soon) */
    temporalLocality: TemporalLocality;
    /** Variables frequently accessed together */
    coAccessedVariables: string[];
    /** Working set size estimate */
    workingSetSize: number;
    /** Whether variable is part of hot data structures */
    isHotData: boolean;
}
/**
 * Information about a function parameter.
 */
export interface ParameterInfo {
    name: string;
    type: Blend65Type;
    optional: boolean;
    defaultValue: Expression | null;
}
/**
 * Information about a type field.
 */
export interface TypeFieldInfo {
    name: string;
    type: Blend65Type;
    optional: boolean;
}
/**
 * Information about an enum member.
 */
export interface EnumMemberInfo {
    name: string;
    value: number;
    explicitValue: Expression | null;
}
/**
 * Information about an import.
 */
export interface ImportInfo {
    /** Name imported from the module */
    importedName: string;
    /** Local name (same as imported if no alias) */
    localName: string;
    /** Source module qualified name */
    sourceModule: string[];
    /** Resolved symbol (filled during analysis) */
    resolvedSymbol?: Symbol;
}
/**
 * Type guard functions for symbol types.
 * Enables safe type narrowing in TypeScript.
 */
export declare function isVariableSymbol(symbol: Symbol): symbol is VariableSymbol;
export declare function isFunctionSymbol(symbol: Symbol): symbol is FunctionSymbol;
export declare function isModuleSymbol(symbol: Symbol): symbol is ModuleSymbol;
export declare function isTypeSymbol(symbol: Symbol): symbol is TypeSymbol;
export declare function isEnumSymbol(symbol: Symbol): symbol is EnumSymbol;
/**
 * Type guard functions for Blend65 types.
 */
export declare function isPrimitiveType(type: Blend65Type): type is PrimitiveType;
export declare function isArrayType(type: Blend65Type): type is ArrayType;
export declare function isNamedType(type: Blend65Type): type is NamedType;
export declare function isCallbackType(type: Blend65Type): type is CallbackType;
/**
 * Helper functions for creating common types.
 *
 * Educational Note:
 * - Factory functions provide consistent type creation
 * - Reduces boilerplate and potential errors
 * - Centralized type creation for easy modification
 */
export declare function createPrimitiveType(name: PrimitiveType['name']): PrimitiveType;
export declare function createArrayType(elementType: Blend65Type, size: number): ArrayType;
export declare function createNamedType(name: string): NamedType;
export declare function createCallbackType(parameterTypes: Blend65Type[], returnType: Blend65Type): CallbackType;
/**
 * Type compatibility checking functions.
 *
 * Educational Note:
 * - Assignment compatibility: can we assign source to target?
 * - Type equality: are two types exactly the same?
 * - Implicit conversion: can we automatically convert between types?
 */
/**
 * Check if a source type can be assigned to a target type.
 *
 * Rules:
 * - Same types are always compatible
 * - byte/word are NOT implicitly compatible (explicit in 6502 code)
 * - Arrays must have same element type and size
 * - Callbacks must have same signature
 * - Named types require resolution
 */
export declare function isAssignmentCompatible(target: Blend65Type, source: Blend65Type): boolean;
/**
 * Check if two types are exactly equal.
 */
export declare function areTypesEqual(type1: Blend65Type, type2: Blend65Type): boolean;
/**
 * Check if two callback types are compatible.
 * Callback types are compatible if they have the same signature.
 */
export declare function areCallbackTypesCompatible(callback1: CallbackType, callback2: CallbackType): boolean;
/**
 * Get a human-readable string representation of a type.
 * Useful for error messages and debugging.
 */
export declare function typeToString(type: Blend65Type): string;
/**
 * Validate storage class usage.
 * Different storage classes have different constraints.
 */
export declare function validateStorageClassUsage(storageClass: StorageClass, scope: ScopeType, hasInitializer: boolean): SemanticResult<void>;
/**
 * Helper functions for creating symbols with proper defaults.
 * These will be used by the semantic analyzer to create symbols consistently.
 */
export declare function createVariableSymbol(name: string, varType: Blend65Type, scope: Scope, location: SourcePosition, options?: {
    storageClass?: StorageClass;
    initialValue?: Expression;
    isExported?: boolean;
    isLocal?: boolean;
}): VariableSymbol;
export declare function createFunctionSymbol(name: string, parameters: ParameterInfo[], returnType: Blend65Type, scope: Scope, location: SourcePosition, options?: {
    isCallback?: boolean;
    isExported?: boolean;
}): FunctionSymbol;
export declare function createModuleSymbol(name: string, qualifiedName: string[], scope: Scope, location: SourcePosition): ModuleSymbol;
export declare function createScope(scopeType: ScopeType, parent?: Scope | null, name?: string): Scope;
/**
 * Main exports for use by other packages.
 * This is the public API of the semantic analysis infrastructure.
 *
 * Note: All types are already exported individually where they are defined.
 * This section serves as documentation of the complete API.
 */
/**
 * Summary of what we've built:
 *
 * 1. Complete symbol system for all Blend65 constructs
 * 2. Rich type system with 6502-specific storage classes
 * 3. Hierarchical scope management for lexical scoping
 * 4. Comprehensive error reporting with source locations
 * 5. Type compatibility checking for safe operations
 * 6. Helper functions and factory methods for consistent usage
 *
 * This foundation enables:
 * - Task 1.2: Symbol table implementation
 * - Task 1.3: Type system implementation
 * - Task 1.4+: All semantic analysis phases
 * - Eventually: Complete compilation to 6502 assembly
 *
 * The educational journey continues with implementing the semantic analyzer
 * that uses these types to validate real Blend65 programs!
 */
//# sourceMappingURL=types.d.ts.map