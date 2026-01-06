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

// ============================================================================
// PHASE 1: CORE SYMBOL SYSTEM
// ============================================================================

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

  /** Storage class for memory allocation (zp, ram, data, const) */
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

// ============================================================================
// PHASE 2: BLEND65 TYPE SYSTEM
// ============================================================================

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
  size: number; // Must be compile-time constant
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
  resolvedType?: Blend65Type; // Filled in during analysis
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
 * Note: Hardware I/O is now accessed via peek()/poke() functions with imported constants
 */
export type StorageClass = 'zp' | 'ram' | 'data' | 'const';

// ============================================================================
// PHASE 3: SCOPE HIERARCHY SYSTEM
// ============================================================================

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

// ============================================================================
// PHASE 4: ERROR REPORTING SYSTEM
// ============================================================================

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
export type SemanticErrorType =
  | 'UndefinedSymbol' // Using a symbol that doesn't exist
  | 'DuplicateSymbol' // Defining a symbol that already exists
  | 'DuplicateIdentifier' // Identifier conflicts with existing symbol
  | 'TypeMismatch' // Type incompatibility (e.g., assigning string to byte)
  | 'InvalidStorageClass' // Invalid storage class usage
  | 'ImportNotFound' // Imported symbol doesn't exist
  | 'ExportNotFound' // Exported symbol doesn't exist
  | 'ModuleNotFound' // Module doesn't exist
  | 'InvalidScope' // Symbol used in wrong scope
  | 'ConstantRequired' // Compile-time constant required
  | 'CallbackMismatch' // Callback function signature mismatch
  | 'ArrayBounds' // Array access out of bounds
  | 'InvalidOperation' // Invalid operation for type
  | 'CircularDependency'; // Circular module dependencies

/**
 * Result type for operations that can fail with semantic errors.
 *
 * Educational Note:
 * - Result types make error handling explicit and type-safe
 * - Prevents accidentally ignoring errors
 * - Enables compiler phases to continue after non-fatal errors
 */
export type SemanticResult<T> =
  | {
      success: true;
      data: T;
      warnings?: SemanticError[];
    }
  | {
      success: false;
      errors: SemanticError[];
      warnings?: SemanticError[];
    };

// ============================================================================
// TASK 1.8: VARIABLE OPTIMIZATION METADATA
// ============================================================================

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
export type VariableAccessPattern =
  | 'single_use' // Used only once
  | 'multiple_read' // Read multiple times
  | 'read_write' // Both read and written
  | 'loop_dependent' // Access depends on loop variables
  | 'sequential_array' // Sequential array access pattern
  | 'random_array' // Random array access pattern
  | 'hot_path' // Frequently accessed in hot paths
  | 'induction_variable' // Loop induction variable
  | 'accumulator'; // Accumulator pattern (frequent read-modify-write)

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

export type ZeroPagePromotionFactorType =
  | 'high_access_frequency' // Variable accessed very frequently
  | 'loop_usage' // Variable used inside loops
  | 'hot_path_usage' // Variable used in hot execution paths
  | 'small_size' // Variable fits easily in zero page
  | 'arithmetic_operations' // Variable used in arithmetic (A register operations)
  | 'index_operations' // Variable used for array indexing
  | 'no_storage_class' // Variable has no explicit storage class
  | 'short_lifetime'; // Variable has short lifetime

/**
 * Factors that discourage zero page promotion.
 */
export interface ZeroPageAntiPromotionFactor {
  factor: ZeroPageAntiPromotionFactorType;
  weight: number;
  description: string;
}

export type ZeroPageAntiPromotionFactorType =
  | 'already_zp' // Variable already has 'zp' storage class
  | 'large_size' // Variable is too large for efficient zero page use
  | 'hardware_access' // Variable accesses hardware (should use peek/poke)
  | 'const_data' // Variable is constant data (should use 'data'/'const')
  | 'low_frequency' // Variable accessed infrequently
  | 'single_use' // Variable used only once
  | 'zero_page_pressure'; // Too many other zero page candidates

/**
 * Zero page promotion recommendation.
 */
export type ZeroPageRecommendation =
  | 'strongly_recommended' // High benefit, should definitely promote
  | 'recommended' // Good candidate for promotion
  | 'neutral' // No strong preference
  | 'not_recommended' // Better left in normal memory
  | 'strongly_discouraged'; // Should not be promoted

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

export type RegisterUsagePatternType =
  | 'arithmetic_accumulator' // Used in arithmetic operations (A register)
  | 'array_index' // Used for array indexing (X/Y registers)
  | 'loop_counter' // Used as loop counter (X/Y registers)
  | 'temporary_storage' // Short-term temporary storage
  | 'function_parameter' // Function parameter passing
  | 'function_return' // Function return value
  | 'address_calculation'; // Address calculation (X/Y registers)

/**
 * Register allocation recommendation.
 */
export type RegisterAllocationRecommendation =
  | 'strongly_recommended' // High benefit, allocate to preferred register
  | 'recommended' // Good candidate, consider for allocation
  | 'conditional' // Allocate only if registers available
  | 'not_recommended' // Better left in memory
  | 'impossible'; // Cannot be allocated due to constraints

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
export type AddressingModeHint =
  | 'zero_page' // $00-$FF (3 cycles)
  | 'absolute' // $0000-$FFFF (4 cycles)
  | 'zero_page_x' // $00,X (4 cycles)
  | 'zero_page_y' // $00,Y (4 cycles)
  | 'absolute_x' // $0000,X (4+ cycles)
  | 'absolute_y' // $0000,Y (4+ cycles)
  | 'indirect' // ($00) (5 cycles)
  | 'indexed_indirect' // ($00,X) (6 cycles)
  | 'indirect_indexed'; // ($00),Y (5+ cycles)

/**
 * Memory bank preferences for 6502.
 */
export type MemoryBank =
  | 'zero_page' // $00-$FF
  | 'stack' // $0100-$01FF
  | 'low_ram' // $0200-$7FFF
  | 'high_ram' // $8000-$BFFF
  | 'hardware_io' // $D000-$DFFF (accessed via peek/poke)
  | 'rom_area' // $E000-$FFFF
  | 'cartridge'; // External cartridge space

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

export type AlignmentReason =
  | 'none' // No special alignment needed
  | 'word_access' // 16-bit access benefits from even alignment
  | 'array_optimization' // Array access optimization
  | 'hardware_requirement' // Hardware register requires specific alignment
  | 'performance' // General performance benefit
  | 'cache_line'; // Cache line alignment (future 65816 support)

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

export type HardwareComponent =
  | 'vic_ii' // VIC-II graphics chip
  | 'sid' // SID sound chip
  | 'cia1' // CIA1 (keyboard, joystick)
  | 'cia2' // CIA2 (serial, user port)
  | 'color_ram' // Color RAM
  | 'sprite_data' // Sprite data area
  | 'character_rom' // Character ROM
  | 'kernel_rom' // KERNAL ROM
  | 'basic_rom'; // BASIC ROM

/**
 * Variable optimization opportunities.
 */
export interface VariableOptimizationOpportunity {
  opportunity: VariableOptimizationOpportunityType;
  benefit: number; // Estimated cycle savings
  complexity: OptimizationComplexity;
  description: string;
}

export type VariableOptimizationOpportunityType =
  | 'constant_propagation' // Variable has constant value
  | 'dead_store_elimination' // Stores that are never read
  | 'common_subexpression' // Variable involved in repeated calculations
  | 'loop_invariant_motion' // Variable calculation can be moved out of loop
  | 'strength_reduction' // Expensive operations can be reduced
  | 'induction_variable' // Loop induction variable optimization
  | 'register_promotion' // Variable should be kept in register
  | 'memory_layout' // Variable placement optimization
  | 'addressing_mode'; // Better addressing mode available

export type OptimizationComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';

/**
 * Variable performance hints.
 */
export interface VariablePerformanceHint {
  hint: VariablePerformanceHintType;
  impact: PerformanceImpact;
  description: string;
}

export type VariablePerformanceHintType =
  | 'hot_variable' // Variable accessed very frequently
  | 'cold_variable' // Variable accessed infrequently
  | 'cache_friendly' // Variable access pattern is cache-friendly
  | 'cache_unfriendly' // Variable access pattern hurts cache
  | 'memory_bandwidth' // Variable access affects memory bandwidth
  | 'critical_path' // Variable is on performance critical path
  | 'spill_candidate' // Variable likely to be spilled from registers
  | 'prefetch_candidate'; // Variable could benefit from prefetching

export type PerformanceImpact = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// TASK 1.9: FUNCTION OPTIMIZATION METADATA
// ============================================================================

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
export type FunctionCallType =
  | 'direct' // Direct function call
  | 'indirect' // Call through callback variable
  | 'recursive' // Recursive call
  | 'tail_call' // Tail call (could be optimized)
  | 'cross_module'; // Call to function in different module

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

export type InliningFactorType =
  | 'small_function' // Function is small enough for inlining
  | 'frequent_calls' // Function called frequently
  | 'hot_path_calls' // Function called in hot execution paths
  | 'simple_logic' // Function has simple, linear logic
  | 'no_recursion' // Function is not recursive
  | 'few_parameters' // Function has few parameters (easier to inline)
  | 'single_return' // Function has single return point
  | 'no_side_effects' // Function has no global side effects
  | 'constant_parameters' // Some parameters are compile-time constants
  | 'tail_call_elimination'; // Function only makes tail calls

/**
 * Factors that discourage function inlining.
 */
export interface AntiInliningFactor {
  factor: AntiInliningFactorType;
  weight: number;
  description: string;
}

export type AntiInliningFactorType =
  | 'large_function' // Function too large for efficient inlining
  | 'rare_calls' // Function called infrequently
  | 'complex_logic' // Function has complex control flow
  | 'many_parameters' // Function has many parameters
  | 'recursive_function' // Function is recursive
  | 'multiple_returns' // Function has multiple return points
  | 'side_effects' // Function has significant side effects
  | 'code_bloat' // Inlining would cause excessive code bloat
  | 'callback_function' // Function is used as callback (address needed)
  | 'exported_function'; // Function is exported (external visibility)

/**
 * Function inlining recommendation.
 */
export type InliningRecommendation =
  | 'strongly_recommended' // High benefit, should definitely inline
  | 'recommended' // Good candidate for inlining
  | 'conditional' // Inline only in specific hot call sites
  | 'not_recommended' // Better left as function call
  | 'strongly_discouraged' // Should never be inlined
  | 'impossible'; // Cannot be inlined due to constraints

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
  passingCost: number; // Cycles to pass this parameter
}

/**
 * Information about parameters passed on stack.
 */
export interface StackParameterInfo {
  parameterName: string;
  parameterType: Blend65Type;
  stackOffset: number;
  passingCost: number; // Cycles to pass this parameter
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

export type ParameterPassingMethod =
  | 'register_A' // Pass in A register
  | 'register_X' // Pass in X register
  | 'register_Y' // Pass in Y register
  | 'zero_page' // Pass through zero page location
  | 'stack' // Pass on stack
  | 'global_variable'; // Pass through global variable

export type ParameterPassingEfficiency = 'optimal' | 'good' | 'acceptable' | 'poor';

/**
 * Parameter optimization opportunities.
 */
export interface ParameterOptimizationOpportunity {
  opportunity: ParameterOptimizationOpportunityType;
  parameterName: string;
  benefit: number; // Estimated cycle savings
  description: string;
}

export type ParameterOptimizationOpportunityType =
  | 'register_allocation' // Parameter can be passed in register
  | 'constant_parameter' // Parameter is constant, can be inlined
  | 'unused_parameter' // Parameter is unused, can be eliminated
  | 'parameter_combining' // Multiple parameters can be combined
  | 'zero_page_passing' // Use zero page for parameter passing
  | 'elimination'; // Parameter can be eliminated through optimization

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

export type ReturnValueMethod =
  | 'register_A' // Return in A register
  | 'register_AX' // Return 16-bit value in A/X
  | 'register_XY' // Return 16-bit value in X/Y
  | 'zero_page' // Return through zero page
  | 'global_variable' // Return through global variable
  | 'stack' // Return on stack
  | 'void'; // No return value

/**
 * Return value optimization opportunities.
 */
export interface ReturnOptimizationOpportunity {
  opportunity: ReturnOptimizationOpportunityType;
  benefit: number; // Estimated cycle savings
  description: string;
}

export type ReturnOptimizationOpportunityType =
  | 'register_return' // Return through register instead of memory
  | 'void_return' // Function doesn't need to return value
  | 'constant_return' // Function always returns same constant
  | 'elimination' // Return value can be eliminated
  | 'direct_use'; // Return value used directly, no temporary needed

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
  resolutionCost: number; // Cycles to resolve conflict
}

export type RegisterConflictType =
  | 'parameter_conflict' // Parameter passing conflicts with internal use
  | 'return_conflict' // Return value conflicts with internal use
  | 'caller_save' // Caller must save register
  | 'callee_save' // Function must save/restore register
  | 'cross_call_conflict'; // Register live across function calls

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Function register optimization opportunities.
 */
export interface FunctionRegisterOptimizationOpportunity {
  opportunity: FunctionRegisterOptimizationOpportunityType;
  register: PreferredRegister;
  benefit: number; // Estimated cycle savings
  description: string;
}

export type FunctionRegisterOptimizationOpportunityType =
  | 'register_reuse' // Reuse register for multiple purposes
  | 'eliminate_save_restore' // Eliminate unnecessary save/restore
  | 'parameter_register' // Use register for parameter passing
  | 'return_register' // Use register for return value
  | 'local_allocation' // Allocate local variable to register
  | 'cross_function_allocation'; // Allocate across function boundaries

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
  size: number; // Bytes
  frequency: StackUsageFrequency;
  canOptimize: boolean;
}

export type StackUsagePurpose =
  | 'local_variables' // Local variable storage
  | 'parameter_passing' // Parameter passing
  | 'return_address' // Return address storage
  | 'register_save' // Register save/restore
  | 'temporary_storage'; // Temporary calculations

export type StackUsageFrequency = 'always' | 'conditional' | 'rare';

/**
 * Stack optimization opportunities.
 */
export interface StackOptimizationOpportunity {
  opportunity: StackOptimizationOpportunityType;
  benefit: number; // Bytes or cycles saved
  description: string;
}

export type StackOptimizationOpportunityType =
  | 'eliminate_locals' // Eliminate local variables
  | 'register_locals' // Move locals to registers
  | 'reduce_parameters' // Reduce parameter count
  | 'eliminate_saves' // Eliminate register saves
  | 'stack_reuse' // Reuse stack space
  | 'tail_call' // Use tail call optimization
  | 'leaf_function'; // Function doesn't call others (no save needed)

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
export type CallingConvention =
  | 'standard' // Standard JSR/RTS with stack
  | 'register_only' // Parameters and return in registers only
  | 'zero_page' // Use zero page for parameter passing
  | 'global_variables' // Use global variables for parameters
  | 'inline_expanded' // Function should be inlined
  | 'tail_call' // Use tail call optimization
  | 'custom_optimized'; // Custom optimized convention

/**
 * Benefits of calling convention optimization.
 */
export interface CallConventionBenefit {
  benefit: CallConventionBenefitType;
  cycleSavings: number;
  codeSizeDelta: number; // Can be negative (savings) or positive (increase)
}

export type CallConventionBenefitType =
  | 'faster_calls' // Reduced call overhead
  | 'smaller_code' // Reduced code size
  | 'better_register_use' // More efficient register usage
  | 'eliminated_stack_ops' // Eliminated stack operations
  | 'parameter_optimization' // Optimized parameter passing
  | 'return_optimization'; // Optimized return handling

/**
 * Constraints preventing calling convention optimization.
 */
export interface CallConventionConstraint {
  constraint: CallConventionConstraintType;
  severity: ConflictSeverity;
  description: string;
}

export type CallConventionConstraintType =
  | 'exported_function' // Function is exported (fixed interface)
  | 'recursive_function' // Function is recursive
  | 'callback_function' // Function used as callback
  | 'variable_parameters' // Function has variable parameters
  | 'complex_return' // Complex return type
  | 'cross_module_calls' // Called from multiple modules
  | 'interrupt_handler'; // Function is interrupt handler

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

export type CallbackUsagePatternType =
  | 'single_assignment' // Callback assigned to single variable
  | 'multiple_assignment' // Callback assigned to multiple variables
  | 'array_dispatch' // Callback used in dispatch array
  | 'conditional_call' // Callback called conditionally
  | 'loop_call' // Callback called in loop
  | 'interrupt_handler' // Used as interrupt handler
  | 'event_handler' // Used as event handler
  | 'state_machine'; // Used in state machine

export type CallbackPerformanceImpact = 'low' | 'medium' | 'high' | 'critical';

/**
 * Callback performance analysis.
 */
export interface CallbackPerformanceAnalysis {
  /** Indirect call overhead */
  indirectCallOverhead: number; // Additional cycles vs direct call

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

export type CallbackBottleneckType =
  | 'indirect_call_overhead' // Overhead of indirect calls
  | 'function_pointer_setup' // Setting up function pointer
  | 'parameter_passing' // Parameter passing inefficiency
  | 'register_conflicts' // Register usage conflicts
  | 'memory_access' // Memory access for function pointer
  | 'call_frequency'; // High frequency of callback calls

/**
 * Callback optimization opportunities.
 */
export interface CallbackOptimizationOpportunity {
  opportunity: CallbackOptimizationOpportunityType;
  benefit: number; // Estimated cycle savings
  applicability: OptimizationApplicability;
  description: string;
}

export type CallbackOptimizationOpportunityType =
  | 'direct_call_conversion' // Convert indirect to direct calls
  | 'inline_expansion' // Inline callback at call site
  | 'dispatch_optimization' // Optimize dispatch table
  | 'register_optimization' // Optimize register usage
  | 'call_site_optimization' // Optimize specific call sites
  | 'function_pointer_caching'; // Cache function pointers

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
  preservationCost: number; // Cycles
}

/**
 * Interrupt timing constraints.
 */
export interface InterruptTimingConstraints {
  /** Maximum execution time allowed */
  maxExecutionTime: number; // Cycles

  /** Whether timing is critical */
  isCriticalTiming: boolean;

  /** Jitter tolerance */
  jitterTolerance: number; // Cycles

  /** Real-time requirements */
  realTimeRequirements: RealTimeRequirement[];
}

/**
 * Real-time requirements for interrupt handlers.
 */
export interface RealTimeRequirement {
  requirement: RealTimeRequirementType;
  constraint: number; // Cycles or other unit
  criticality: ConflictSeverity;
}

export type RealTimeRequirementType =
  | 'max_latency' // Maximum interrupt latency
  | 'max_execution_time' // Maximum execution time
  | 'min_frequency' // Minimum interrupt frequency
  | 'max_jitter' // Maximum timing jitter
  | 'real_time_deadline'; // Hard real-time deadline

/**
 * Interrupt-specific optimizations.
 */
export interface InterruptOptimization {
  optimization: InterruptOptimizationType;
  benefit: number; // Cycle savings or latency reduction
  description: string;
}

export type InterruptOptimizationType =
  | 'minimal_preserve' // Preserve only necessary registers
  | 'fast_entry_exit' // Optimize interrupt entry/exit
  | 'inline_critical_path' // Inline critical code sections
  | 'reduce_complexity' // Reduce interrupt handler complexity
  | 'defer_processing' // Defer non-critical processing
  | 'optimize_nesting'; // Optimize interrupt nesting

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
  estimatedBenefit: number; // Cycle savings
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

export type RegisterAllocationStrategy =
  | 'minimal' // Use as few registers as possible
  | 'aggressive' // Use all available registers
  | 'balanced' // Balance between usage and spilling
  | 'specialized' // Specialized for specific patterns
  | 'none'; // No register allocation

/**
 * Function register assignments.
 */
export interface FunctionRegisterAssignment {
  register: PreferredRegister;
  purpose: RegisterAssignmentPurpose;
  variable: string | null; // Variable name if assigned to variable
  benefit: number; // Estimated benefit
}

export type RegisterAssignmentPurpose =
  | 'parameter' // Function parameter
  | 'return_value' // Function return value
  | 'local_variable' // Local variable
  | 'loop_counter' // Loop counter
  | 'temporary' // Temporary calculation
  | 'address_calculation'; // Address calculation

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
  spillingCost: number; // Cycles
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

export type CodeSection =
  | 'hot_code' // Frequently executed code section
  | 'warm_code' // Occasionally executed code
  | 'cold_code' // Rarely executed code
  | 'initialization' // Initialization code
  | 'interrupt_code' // Interrupt handler code
  | 'utility_code'; // Utility function code

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

export type LocalVariableLayoutStrategy =
  | 'stack_based' // Use stack for local variables
  | 'register_based' // Use registers for local variables
  | 'zero_page_based' // Use zero page for local variables
  | 'mixed' // Mixed approach
  | 'minimal'; // Minimal local variable usage

/**
 * Group of related local variables.
 */
export interface LocalVariableGroup {
  variables: string[];
  groupType: LocalVariableGroupType;
  layout: GroupLayoutPreference;
}

export type LocalVariableGroupType =
  | 'frequently_accessed' // Variables accessed together frequently
  | 'same_type' // Variables of same type
  | 'loop_variables' // Variables used in same loop
  | 'temporary_calculations' // Temporary calculation variables
  | 'state_variables'; // Variables representing related state

/**
 * Stack frame optimization information.
 */
export interface StackFrameOptimization {
  /** Whether stack frame can be optimized */
  canOptimize: boolean;

  /** Stack frame size reduction potential */
  sizeReduction: number; // Bytes

  /** Optimization strategies */
  strategies: StackFrameOptimizationStrategy[];
}

export type StackFrameOptimizationStrategy =
  | 'eliminate_frame_pointer' // Don't use frame pointer
  | 'reuse_parameter_space' // Reuse parameter space for locals
  | 'minimize_alignment' // Minimize alignment requirements
  | 'combine_variables' // Combine related variables
  | 'register_spill_opt'; // Optimize register spill locations

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

export type FunctionAlignmentReason =
  | 'none' // No special alignment needed
  | 'performance' // General performance benefit
  | 'branch_target' // Function is frequent branch target
  | 'interrupt_vector' // Function is interrupt vector
  | 'page_boundary'; // Avoid page boundary crossings

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

export type FunctionExecutionFrequency =
  | 'never'
  | 'rare'
  | 'occasional'
  | 'frequent'
  | 'very_frequent'
  | 'hot';

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

export type FunctionHotspotType =
  | 'loop' // Loop hotspot
  | 'memory_access' // Memory access hotspot
  | 'arithmetic' // Arithmetic operation hotspot
  | 'function_call' // Function call hotspot
  | 'branch' // Branching hotspot
  | 'register_pressure'; // Register pressure hotspot

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
  cycles: number; // Estimated cycles
  impact: PerformanceImpact;
}

export type CriticalOperationType =
  | 'memory_load' // Memory load operation
  | 'memory_store' // Memory store operation
  | 'arithmetic' // Arithmetic operation
  | 'branch' // Branch operation
  | 'function_call' // Function call
  | 'register_transfer'; // Register transfer

/**
 * Performance bottleneck within function.
 */
export interface FunctionBottleneck {
  bottleneck: FunctionBottleneckType;
  location: SourcePosition;
  impact: PerformanceImpact;
  description: string;
}

export type FunctionBottleneckType =
  | 'memory_bandwidth' // Memory bandwidth limitation
  | 'register_pressure' // Register pressure limitation
  | 'branch_misprediction' // Branch misprediction penalty
  | 'data_dependency' // Data dependency stall
  | 'function_call_overhead' // Function call overhead
  | 'stack_operations'; // Stack operation overhead

/**
 * Function optimization potential analysis.
 */
export interface FunctionOptimizationPotential {
  /** Overall optimization potential score (0-100) */
  overallScore: number;

  /** Potential optimizations */
  potentialOptimizations: PotentialOptimization[];

  /** Estimated total benefit */
  estimatedTotalBenefit: number; // Cycle savings

  /** Implementation complexity */
  implementationComplexity: OptimizationComplexity;
}

/**
 * Potential optimization for function.
 */
export interface PotentialOptimization {
  optimization: FunctionOptimizationType;
  benefit: number; // Estimated cycle savings
  complexity: OptimizationComplexity;
  description: string;
}

export type FunctionOptimizationType =
  | 'inlining' // Function inlining
  | 'loop_unrolling' // Loop unrolling
  | 'register_allocation' // Better register allocation
  | 'dead_code_elimination' // Remove dead code
  | 'constant_propagation' // Propagate constants
  | 'strength_reduction' // Reduce operation strength
  | 'tail_call_optimization' // Tail call optimization
  | 'parameter_optimization'; // Parameter passing optimization

/**
 * 6502-specific function optimization opportunities.
 */
export interface Function6502OptimizationOpportunity {
  opportunity: Function6502OptimizationOpportunityType;
  benefit: number; // Estimated cycle savings
  complexity: OptimizationComplexity;
  description: string;
}

export type Function6502OptimizationOpportunityType =
  | 'zero_page_usage' // Use zero page for function data
  | 'register_optimization' // Optimize A/X/Y register usage
  | 'addressing_mode' // Use better addressing modes
  | 'branch_optimization' // Optimize branch instructions
  | 'memory_layout' // Optimize memory layout
  | 'stack_optimization' // Optimize stack usage
  | 'interrupt_optimization' // Optimize interrupt handling
  | 'hardware_acceleration'; // Use hardware features

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
  minimum: number; // Cycles
  maximum: number; // Cycles
  average: number; // Cycles
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

export type VariabilityCauseType =
  | 'input_dependent' // Performance depends on input
  | 'branch_dependent' // Performance depends on branches taken
  | 'memory_dependent' // Performance depends on memory access patterns
  | 'register_pressure' // Performance varies with register pressure
  | 'call_context'; // Performance varies with calling context

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
  frequency: number; // Usage frequency
  benefit: number; // Benefit of using this register
}

export type RegisterUsageType =
  | 'parameter' // Used for parameter
  | 'return_value' // Used for return value
  | 'local_variable' // Used for local variable
  | 'temporary' // Used for temporary storage
  | 'address_calculation' // Used for address calculation
  | 'loop_counter'; // Used as loop counter

/**
 * Function memory usage details.
 */
export interface FunctionMemoryUsage {
  /** Total memory used */
  totalMemoryUsed: number; // Bytes

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
  size: number; // Bytes
  location: MemoryLocation;
}

export type MemoryUsagePurpose =
  | 'code' // Function code
  | 'local_variables' // Local variables
  | 'constants' // Function constants
  | 'temporary_storage'; // Temporary storage

export type MemoryLocation =
  | 'zero_page' // Zero page memory
  | 'ram' // Regular RAM
  | 'rom' // ROM area
  | 'stack'; // Stack area

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
  maxStackDepth: number; // Bytes

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
  size: number; // Bytes
  benefit: number; // Performance benefit
}

export type ZeroPageUsagePurpose =
  | 'parameter' // Function parameter
  | 'local_variable' // Local variable
  | 'temporary' // Temporary storage
  | 'address_pointer'; // Address pointer

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
  estimatedBenefit: number; // Cycle savings
  implementationEffort: ImplementationEffort;
  description: string;
}

export type FunctionOptimizationRecommendationType =
  | 'inline_function' // Inline this function
  | 'optimize_registers' // Optimize register usage
  | 'reduce_parameters' // Reduce parameter count
  | 'eliminate_recursion' // Eliminate recursion
  | 'optimize_loops' // Optimize internal loops
  | 'improve_memory_layout' // Improve memory layout
  | 'use_zero_page' // Use zero page more effectively
  | 'optimize_branches'; // Optimize branch structure

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
export type MemoryRegion =
  | 'zero_page_high_priority' // Most valuable zero page locations
  | 'zero_page_normal' // Standard zero page usage
  | 'ram_fast' // Fast RAM access areas
  | 'ram_normal' // Standard RAM
  | 'ram_slow' // Slower RAM areas
  | 'data_section' // Pre-initialized data area
  | 'bss_section' // Uninitialized data area
  | 'hardware_region'; // Memory-mapped I/O area (accessed via peek/poke)

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

export type VariableGroupingReason =
  | 'cache_locality' // Variables accessed together
  | 'struct_members' // Members of the same logical structure
  | 'array_elements' // Elements of the same array
  | 'related_state' // Variables representing related state
  | 'hardware_registers' // Hardware register group
  | 'function_locals'; // Local variables in same function

export type GroupLayoutPreference =
  | 'sequential' // Place variables sequentially
  | 'interleaved' // Interleave for better access patterns
  | 'aligned' // Align group to specific boundary
  | 'packed' // Pack tightly to save space
  | 'scattered'; // Don't group (better distributed)

/**
 * Memory access patterns for variables.
 */
export interface MemoryAccessPattern {
  pattern: MemoryAccessPatternType;
  frequency: number;
  spatialLocality: SpatialLocality;
  temporalLocality: TemporalLocality;
}

export type MemoryAccessPatternType =
  | 'sequential' // Sequential access pattern
  | 'random' // Random access pattern
  | 'strided' // Fixed stride access pattern
  | 'clustered' // Clustered access pattern
  | 'sparse' // Sparse access pattern
  | 'single_shot'; // Single access then done

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

// ============================================================================
// HELPER TYPES AND INTERFACES
// ============================================================================

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
  value: number; // Computed value
  explicitValue: Expression | null; // Original expression if provided
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

// ============================================================================
// PHASE 5: UTILITY FUNCTIONS AND TYPE GUARDS
// ============================================================================

/**
 * Type guard functions for symbol types.
 * Enables safe type narrowing in TypeScript.
 */
export function isVariableSymbol(symbol: Symbol): symbol is VariableSymbol {
  return symbol.symbolType === 'Variable';
}

export function isFunctionSymbol(symbol: Symbol): symbol is FunctionSymbol {
  return symbol.symbolType === 'Function';
}

export function isModuleSymbol(symbol: Symbol): symbol is ModuleSymbol {
  return symbol.symbolType === 'Module';
}

export function isTypeSymbol(symbol: Symbol): symbol is TypeSymbol {
  return symbol.symbolType === 'Type';
}

export function isEnumSymbol(symbol: Symbol): symbol is EnumSymbol {
  return symbol.symbolType === 'Enum';
}

/**
 * Type guard functions for Blend65 types.
 */
export function isPrimitiveType(type: Blend65Type): type is PrimitiveType {
  return type.kind === 'primitive';
}

export function isArrayType(type: Blend65Type): type is ArrayType {
  return type.kind === 'array';
}

export function isNamedType(type: Blend65Type): type is NamedType {
  return type.kind === 'named';
}

export function isCallbackType(type: Blend65Type): type is CallbackType {
  return type.kind === 'callback';
}

/**
 * Helper functions for creating common types.
 *
 * Educational Note:
 * - Factory functions provide consistent type creation
 * - Reduces boilerplate and potential errors
 * - Centralized type creation for easy modification
 */
export function createPrimitiveType(name: PrimitiveType['name']): PrimitiveType {
  return { kind: 'primitive', name };
}

export function createArrayType(elementType: Blend65Type, size: number): ArrayType {
  return { kind: 'array', elementType, size };
}

export function createNamedType(name: string): NamedType {
  return { kind: 'named', name };
}

export function createCallbackType(
  parameterTypes: Blend65Type[],
  returnType: Blend65Type
): CallbackType {
  return { kind: 'callback', parameterTypes, returnType };
}

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
export function isAssignmentCompatible(target: Blend65Type, source: Blend65Type): boolean {
  // Same type is always compatible
  if (areTypesEqual(target, source)) {
    return true;
  }

  // Primitive type compatibility
  if (isPrimitiveType(target) && isPrimitiveType(source)) {
    // byte and word are NOT implicitly compatible in Blend65
    // This forces explicit conversions, making 6502 code clearer
    return false;
  }

  // Array type compatibility
  if (isArrayType(target) && isArrayType(source)) {
    return (
      target.size === source.size && isAssignmentCompatible(target.elementType, source.elementType)
    );
  }

  // Callback type compatibility
  if (isCallbackType(target) && isCallbackType(source)) {
    return areCallbackTypesCompatible(target, source);
  }

  // Named types require resolution (handled in semantic analyzer)
  if (isNamedType(target) || isNamedType(source)) {
    // This will be handled by the semantic analyzer after type resolution
    return false; // Conservative approach for now
  }

  return false;
}

/**
 * Check if two types are exactly equal.
 */
export function areTypesEqual(type1: Blend65Type, type2: Blend65Type): boolean {
  if (type1.kind !== type2.kind) {
    return false;
  }

  switch (type1.kind) {
    case 'primitive':
      return type1.name === (type2 as PrimitiveType).name;

    case 'array':
      const array2 = type2 as ArrayType;
      return type1.size === array2.size && areTypesEqual(type1.elementType, array2.elementType);

    case 'named':
      return type1.name === (type2 as NamedType).name;

    case 'callback':
      return areCallbackTypesCompatible(type1, type2 as CallbackType);

    default:
      return false;
  }
}

/**
 * Check if two callback types are compatible.
 * Callback types are compatible if they have the same signature.
 */
export function areCallbackTypesCompatible(
  callback1: CallbackType,
  callback2: CallbackType
): boolean {
  // Same return type
  if (!areTypesEqual(callback1.returnType, callback2.returnType)) {
    return false;
  }

  // Same number of parameters
  if (callback1.parameterTypes.length !== callback2.parameterTypes.length) {
    return false;
  }

  // All parameter types match
  for (let i = 0; i < callback1.parameterTypes.length; i++) {
    if (!areTypesEqual(callback1.parameterTypes[i], callback2.parameterTypes[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Get a human-readable string representation of a type.
 * Useful for error messages and debugging.
 */
export function typeToString(type: Blend65Type): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;

    case 'array':
      return `${typeToString(type.elementType)}[${type.size}]`;

    case 'named':
      return type.name;

    case 'callback':
      const params = type.parameterTypes.map(t => typeToString(t)).join(', ');
      const returnStr =
        type.returnType.kind === 'primitive' && type.returnType.name === 'void'
          ? ''
          : `: ${typeToString(type.returnType)}`;
      return `callback(${params})${returnStr}`;

    default:
      return 'unknown';
  }
}

/**
 * Validate storage class usage.
 * Different storage classes have different constraints.
 */
export function validateStorageClassUsage(
  storageClass: StorageClass,
  scope: ScopeType,
  hasInitializer: boolean
): SemanticResult<void> {
  // Validate that storage class is one of the allowed values
  const validStorageClasses: StorageClass[] = ['zp', 'ram', 'data', 'const'];
  if (!validStorageClasses.includes(storageClass)) {
    return {
      success: false,
      errors: [
        {
          errorType: 'InvalidStorageClass',
          message: `Invalid storage class '${storageClass}'. Valid storage classes are: ${validStorageClasses.join(', ')}`,
          location: { line: 0, column: 0, offset: 0 },
          suggestions: [
            'Use one of the valid storage classes: zp, ram, data, const',
            'For hardware I/O, use peek/poke functions with imported constants',
            `Remove the invalid '${storageClass}' storage class`,
          ],
        },
      ],
    };
  }

  // Storage classes only allowed at global/module scope
  if (scope === 'Function' || scope === 'Block') {
    return {
      success: false,
      errors: [
        {
          errorType: 'InvalidStorageClass',
          message: `Storage class '${storageClass}' not allowed in ${scope.toLowerCase()} scope. Storage classes are only valid for global variables.`,
          location: { line: 0, column: 0, offset: 0 }, // Will be filled by caller
          suggestions: [
            'Remove the storage class to create a local variable',
            'Move the variable declaration to module level to use storage classes',
          ],
        },
      ],
    };
  }

  // 'const' and 'data' require initializers
  if ((storageClass === 'const' || storageClass === 'data') && !hasInitializer) {
    return {
      success: false,
      errors: [
        {
          errorType: 'ConstantRequired',
          message: `Variables with '${storageClass}' storage class must have an initializer.`,
          location: { line: 0, column: 0, offset: 0 },
          suggestions: [
            `Add an initializer: var name: type = value`,
            `Use 'ram' or 'zp' storage class for uninitialized variables`,
          ],
        },
      ],
    };
  }

  // Hardware I/O is now handled through peek/poke functions instead of 'io' storage class

  return { success: true, data: undefined };
}

// ============================================================================
// SYMBOL CREATION HELPER FUNCTIONS
// ============================================================================

/**
 * Helper functions for creating symbols with proper defaults.
 * These will be used by the semantic analyzer to create symbols consistently.
 */

export function createVariableSymbol(
  name: string,
  varType: Blend65Type,
  scope: Scope,
  location: SourcePosition,
  options: {
    storageClass?: StorageClass;
    initialValue?: Expression;
    isExported?: boolean;
    isLocal?: boolean;
  } = {}
): VariableSymbol {
  return {
    name,
    symbolType: 'Variable',
    sourceLocation: location,
    scope,
    isExported: options.isExported ?? false,
    varType,
    storageClass: options.storageClass ?? null,
    initialValue: options.initialValue ?? null,
    isLocal: options.isLocal ?? false,
  };
}

export function createFunctionSymbol(
  name: string,
  parameters: ParameterInfo[],
  returnType: Blend65Type,
  scope: Scope,
  location: SourcePosition,
  options: {
    isCallback?: boolean;
    isExported?: boolean;
  } = {}
): FunctionSymbol {
  return {
    name,
    symbolType: 'Function',
    sourceLocation: location,
    scope,
    isExported: options.isExported ?? false,
    parameters,
    returnType,
    isCallback: options.isCallback ?? false,
  };
}

export function createModuleSymbol(
  name: string,
  qualifiedName: string[],
  scope: Scope,
  location: SourcePosition
): ModuleSymbol {
  return {
    name,
    symbolType: 'Module',
    sourceLocation: location,
    scope,
    isExported: false, // Modules themselves are not exported
    qualifiedName,
    exports: new Map(),
    imports: new Map(),
  };
}

export function createScope(
  scopeType: ScopeType,
  parent: Scope | null = null,
  name?: string
): Scope {
  return {
    scopeType,
    parent,
    symbols: new Map(),
    children: [],
    name,
  };
}

// ============================================================================
// EXPORTS FOR SEMANTIC ANALYZER
// ============================================================================

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
