/**
 * Intermediate Language (IL) Type System for Blend65
 * Task 2.1: Create IL Type System
 *
 * This file defines the core types for Blend65's Intermediate Language (IL).
 * The IL serves as an optimization-friendly representation between the AST
 * and target 6502 assembly code.
 *
 * Key Design Principles:
 * - Close to AST structure for easy transformation
 * - 6502-aware for efficient code generation
 * - Optimization-friendly with mutable instruction sequences
 * - Rich metadata integration from semantic analysis
 * - Support for multiple optimization passes
 *
 * Educational Focus:
 * - How compilers represent programs for optimization
 * - Intermediate representations in compiler design
 * - 6502-specific optimization considerations
 * - Integration between semantic analysis and code generation
 */
import type { SourcePosition } from '@blend65/lexer';
import type { Blend65Type, VariableOptimizationMetadata, FunctionOptimizationMetadata, StorageClass } from '@blend65/semantic';
/**
 * Program source information.
 * Contains metadata about the compilation process and source files.
 */
export interface ProgramSourceInfo {
    /** Original source files that contributed to this program */
    originalFiles: string[];
    /** When this program was compiled */
    compilationTimestamp: Date;
    /** Compiler version used */
    compilerVersion: string;
    /** Target platform for this compilation */
    targetPlatform: string;
    /** Compilation options used */
    compilationOptions?: CompilationOptions;
    /** Git commit hash if available */
    gitCommitHash?: string;
    /** Build configuration used */
    buildConfiguration?: string;
}
/**
 * Compilation options used to build this IL program.
 */
export interface CompilationOptions {
    /** Optimization level */
    optimizationLevel: 'O0' | 'O1' | 'O2' | 'O3';
    /** Debug information included */
    includeDebugInfo: boolean;
    /** Target-specific options */
    targetOptions?: Record<string, unknown>;
    /** Warning levels */
    warningLevel: 'none' | 'low' | 'medium' | 'high' | 'all';
    /** Whether to include source maps */
    includeSourceMaps: boolean;
}
/**
 * Complete IL program representation.
 * Represents an entire Blend65 program ready for optimization and code generation.
 */
export interface ILProgram {
    /** Program name (usually the main module name) */
    name: string;
    /** All modules in this program */
    modules: ILModule[];
    /** Global constants and data */
    globalData: ILGlobalData[];
    /** Import dependencies */
    imports: ILImport[];
    /** Export declarations */
    exports: ILExport[];
    /** Program-wide optimization metadata */
    optimizationMetadata?: ProgramOptimizationMetadata;
    /** Source location information */
    sourceInfo: ProgramSourceInfo;
}
/**
 * IL module representation.
 * Each Blend65 module becomes an IL module with functions and data.
 */
export interface ILModule {
    /** Module qualified name (e.g., ["Game", "Main"]) */
    qualifiedName: string[];
    /** Functions defined in this module */
    functions: ILFunction[];
    /** Module-level variables and data */
    moduleData: ILModuleData[];
    /** Functions and data exported from this module */
    exports: ILExport[];
    /** Dependencies imported by this module */
    imports: ILImport[];
    /** Module optimization metadata */
    optimizationMetadata?: ModuleOptimizationMetadata;
}
/**
 * IL function representation.
 * Blend65 functions become IL functions with instruction sequences.
 */
export interface ILFunction {
    /** Function name */
    name: string;
    /** Qualified name including module path */
    qualifiedName: string[];
    /** Function parameters */
    parameters: ILParameter[];
    /** Return type */
    returnType: Blend65Type;
    /** Local variables */
    localVariables: ILLocalVariable[];
    /** Function body as sequence of IL instructions */
    instructions: ILInstruction[];
    /** Function labels (for branches and calls) */
    labels: Map<string, number>;
    /** Whether this is a callback function */
    isCallback: boolean;
    /** Whether this function is exported */
    isExported: boolean;
    /** Function optimization metadata from semantic analysis */
    optimizationMetadata?: FunctionOptimizationMetadata;
    /** IL-specific optimization metadata */
    ilOptimizationMetadata?: ILFunctionOptimizationMetadata;
    /** Source location information */
    sourceLocation: SourcePosition;
}
/**
 * Base interface for all IL instructions.
 * Every operation in the IL is represented as an instruction with operands.
 */
export interface ILInstruction {
    /** Unique instruction type */
    type: ILInstructionType;
    /** Instruction operands */
    operands: ILOperand[];
    /** Optional result destination */
    result?: ILValue;
    /** 6502-specific optimization hints */
    sixtyTwoHints?: IL6502OptimizationHints;
    /** Source location for debugging */
    sourceLocation?: SourcePosition;
    /** Instruction metadata */
    metadata?: ILInstructionMetadata;
    /** Unique instruction ID for tracking */
    id: number;
}
/**
 * All supported IL instruction types.
 * These map closely to 6502 operations and Blend65 language constructs.
 */
export declare enum ILInstructionType {
    /** Load immediate value: LOAD_IMMEDIATE <dest> <value> */
    LOAD_IMMEDIATE = "LOAD_IMMEDIATE",
    /** Load from memory: LOAD_MEMORY <dest> <address> */
    LOAD_MEMORY = "LOAD_MEMORY",
    /** Store to memory: STORE_MEMORY <address> <value> */
    STORE_MEMORY = "STORE_MEMORY",
    /** Copy value: COPY <dest> <source> */
    COPY = "COPY",
    /** Add: ADD <dest> <left> <right> */
    ADD = "ADD",
    /** Subtract: SUB <dest> <left> <right> */
    SUB = "SUB",
    /** Multiply: MUL <dest> <left> <right> */
    MUL = "MUL",
    /** Divide: DIV <dest> <left> <right> */
    DIV = "DIV",
    /** Modulo: MOD <dest> <left> <right> */
    MOD = "MOD",
    /** Negate: NEG <dest> <source> */
    NEG = "NEG",
    /** Logical AND: AND <dest> <left> <right> */
    AND = "AND",
    /** Logical OR: OR <dest> <left> <right> */
    OR = "OR",
    /** Logical NOT: NOT <dest> <source> */
    NOT = "NOT",
    /** Bitwise AND: BITWISE_AND <dest> <left> <right> */
    BITWISE_AND = "BITWISE_AND",
    /** Bitwise OR: BITWISE_OR <dest> <left> <right> */
    BITWISE_OR = "BITWISE_OR",
    /** Bitwise XOR: BITWISE_XOR <dest> <left> <right> */
    BITWISE_XOR = "BITWISE_XOR",
    /** Bitwise NOT: BITWISE_NOT <dest> <source> */
    BITWISE_NOT = "BITWISE_NOT",
    /** Shift left: SHIFT_LEFT <dest> <source> <amount> */
    SHIFT_LEFT = "SHIFT_LEFT",
    /** Shift right: SHIFT_RIGHT <dest> <source> <amount> */
    SHIFT_RIGHT = "SHIFT_RIGHT",
    /** Compare equal: COMPARE_EQ <dest> <left> <right> */
    COMPARE_EQ = "COMPARE_EQ",
    /** Compare not equal: COMPARE_NE <dest> <left> <right> */
    COMPARE_NE = "COMPARE_NE",
    /** Compare less than: COMPARE_LT <dest> <left> <right> */
    COMPARE_LT = "COMPARE_LT",
    /** Compare less than or equal: COMPARE_LE <dest> <left> <right> */
    COMPARE_LE = "COMPARE_LE",
    /** Compare greater than: COMPARE_GT <dest> <left> <right> */
    COMPARE_GT = "COMPARE_GT",
    /** Compare greater than or equal: COMPARE_GE <dest> <left> <right> */
    COMPARE_GE = "COMPARE_GE",
    /** Unconditional branch: BRANCH <target> */
    BRANCH = "BRANCH",
    /** Conditional branch if true: BRANCH_IF_TRUE <condition> <target> */
    BRANCH_IF_TRUE = "BRANCH_IF_TRUE",
    /** Conditional branch if false: BRANCH_IF_FALSE <condition> <target> */
    BRANCH_IF_FALSE = "BRANCH_IF_FALSE",
    /** Conditional branch if zero: BRANCH_IF_ZERO <value> <target> */
    BRANCH_IF_ZERO = "BRANCH_IF_ZERO",
    /** Conditional branch if not zero: BRANCH_IF_NOT_ZERO <value> <target> */
    BRANCH_IF_NOT_ZERO = "BRANCH_IF_NOT_ZERO",
    /** Function call: CALL <function> [args...] */
    CALL = "CALL",
    /** Return from function: RETURN [value] */
    RETURN = "RETURN",
    /** Declare local variable: DECLARE_LOCAL <variable> <type> */
    DECLARE_LOCAL = "DECLARE_LOCAL",
    /** Load variable: LOAD_VARIABLE <dest> <variable> */
    LOAD_VARIABLE = "LOAD_VARIABLE",
    /** Store variable: STORE_VARIABLE <variable> <value> */
    STORE_VARIABLE = "STORE_VARIABLE",
    /** Load array element: LOAD_ARRAY <dest> <array> <index> */
    LOAD_ARRAY = "LOAD_ARRAY",
    /** Store array element: STORE_ARRAY <array> <index> <value> */
    STORE_ARRAY = "STORE_ARRAY",
    /** Calculate array address: ARRAY_ADDRESS <dest> <array> <index> */
    ARRAY_ADDRESS = "ARRAY_ADDRESS",
    /** Label: LABEL <name> */
    LABEL = "LABEL",
    /** No operation: NOP */
    NOP = "NOP",
    /** Comment: COMMENT <text> */
    COMMENT = "COMMENT",
    /** Register operation: REGISTER_OP <register> <operation> [operand] */
    REGISTER_OP = "REGISTER_OP",
    /** Hardware peek: PEEK <dest> <address> */
    PEEK = "PEEK",
    /** Hardware poke: POKE <address> <value> */
    POKE = "POKE",
    /** Set processor flags: SET_FLAGS <flags> */
    SET_FLAGS = "SET_FLAGS",
    /** Clear processor flags: CLEAR_FLAGS <flags> */
    CLEAR_FLAGS = "CLEAR_FLAGS"
}
/**
 * Union type for all values in the IL system.
 * Values represent data that can be operated on by instructions.
 */
export type ILValue = ILConstant | ILVariable | ILRegister | ILTemporary | ILMemoryLocation | ILLabel;
/**
 * Constant value in IL.
 * Represents compile-time known values.
 */
export interface ILConstant {
    valueType: 'constant';
    type: Blend65Type;
    value: number | boolean | string;
    representation: ConstantRepresentation;
}
/**
 * How constants are represented in source code.
 */
export type ConstantRepresentation = 'decimal' | 'hexadecimal' | 'binary' | 'character' | 'string' | 'boolean';
/**
 * Variable reference in IL.
 * References variables declared in Blend65 source.
 */
export interface ILVariable {
    valueType: 'variable';
    name: string;
    qualifiedName: string[];
    type: Blend65Type;
    storageClass: StorageClass | null;
    scope: VariableScope;
    optimizationMetadata?: VariableOptimizationMetadata;
}
/**
 * Variable scope classification.
 */
export type VariableScope = 'global' | 'local' | 'temporary';
/**
 * 6502 register reference.
 * Represents the three main 6502 registers.
 */
export interface ILRegister {
    valueType: 'register';
    register: Register6502;
    type: Blend65Type;
}
/**
 * 6502 register types.
 */
export type Register6502 = 'A' | 'X' | 'Y' | 'AX' | 'XY';
/**
 * Temporary value in IL.
 * Compiler-generated temporary variables for intermediate calculations.
 */
export interface ILTemporary {
    valueType: 'temporary';
    id: number;
    type: Blend65Type;
    scope: TemporaryScope;
    lifetimeInfo?: TemporaryLifetimeInfo;
}
/**
 * Temporary variable scope.
 */
export type TemporaryScope = 'expression' | 'statement' | 'block' | 'function';
/**
 * Temporary variable lifetime information.
 */
export interface TemporaryLifetimeInfo {
    /** First instruction where temporary is defined */
    defineInstruction: number;
    /** Last instruction where temporary is used */
    lastUseInstruction: number;
    /** Whether temporary can be register allocated */
    canRegisterAllocate: boolean;
    /** Interference with other temporaries */
    interfersWith: number[];
}
/**
 * Memory location reference.
 * Direct memory address references.
 */
export interface ILMemoryLocation {
    valueType: 'memory';
    address: ILValue;
    type: Blend65Type;
    addressingMode: AddressingMode6502;
    memoryBank?: MemoryBank6502;
}
/**
 * 6502 addressing modes.
 */
export type AddressingMode6502 = 'immediate' | 'zero_page' | 'zero_page_x' | 'zero_page_y' | 'absolute' | 'absolute_x' | 'absolute_y' | 'indirect' | 'indexed_indirect' | 'indirect_indexed';
/**
 * 6502 memory banks.
 */
export type MemoryBank6502 = 'zero_page' | 'stack' | 'ram' | 'io' | 'rom' | 'cartridge';
/**
 * Label reference for branches and calls.
 */
export interface ILLabel {
    valueType: 'label';
    name: string;
    targetInstruction?: number;
}
/**
 * Union type for instruction operands.
 * Operands specify the inputs and outputs for IL instructions.
 */
export type ILOperand = ILValue | ILParameterReference | ILReturnReference;
/**
 * Reference to function parameter.
 */
export interface ILParameterReference {
    operandType: 'parameter';
    parameterIndex: number;
    parameterName: string;
    type: Blend65Type;
}
/**
 * Reference to function return value.
 */
export interface ILReturnReference {
    operandType: 'return';
    type: Blend65Type;
}
/**
 * Function parameter in IL.
 */
export interface ILParameter {
    name: string;
    type: Blend65Type;
    index: number;
    passingMethod: ParameterPassingMethod;
    optimizationHints?: ParameterOptimizationHints;
}
/**
 * How parameters are passed to functions.
 */
export type ParameterPassingMethod = 'register_A' | 'register_X' | 'register_Y' | 'zero_page' | 'stack' | 'global';
/**
 * Local variable in IL function.
 */
export interface ILLocalVariable {
    name: string;
    type: Blend65Type;
    allocationMethod: LocalVariableAllocation;
    optimizationMetadata?: VariableOptimizationMetadata;
    ilOptimizationHints?: LocalVariableOptimizationHints;
}
/**
 * How local variables are allocated.
 */
export type LocalVariableAllocation = 'register' | 'zero_page' | 'stack' | 'global';
/**
 * Global data declarations.
 */
export interface ILGlobalData {
    name: string;
    qualifiedName: string[];
    type: Blend65Type;
    storageClass: StorageClass;
    initialValue?: ILConstant;
    memoryLocation?: MemoryAllocationInfo;
    isExported: boolean;
}
/**
 * Module-level data.
 */
export interface ILModuleData {
    name: string;
    type: Blend65Type;
    storageClass: StorageClass | null;
    initialValue?: ILConstant;
    isExported: boolean;
    optimizationMetadata?: VariableOptimizationMetadata;
}
/**
 * Import declaration in IL.
 */
export interface ILImport {
    importedName: string;
    localName: string;
    sourceModule: string[];
    importType: ImportType;
}
/**
 * What type of symbol is being imported.
 */
export type ImportType = 'function' | 'variable' | 'constant' | 'type';
/**
 * Export declaration in IL.
 */
export interface ILExport {
    exportedName: string;
    localName: string;
    exportType: ExportType;
    value: ILValue;
}
/**
 * What type of symbol is being exported.
 */
export type ExportType = 'function' | 'variable' | 'constant';
/**
 * 6502-specific optimization hints for IL instructions.
 */
export interface IL6502OptimizationHints {
    /** Preferred register for this operation */
    preferredRegister?: Register6502;
    /** Preferred addressing mode */
    preferredAddressingMode?: AddressingMode6502;
    /** Whether this operation is timing critical */
    isTimingCritical?: boolean;
    /** Whether this operation is in a hot path */
    isHotPath?: boolean;
    /** Cycle count estimate for this instruction */
    estimatedCycles?: number;
    /** Whether this instruction can be optimized away */
    canOptimizeAway?: boolean;
    /** 6502-specific optimization opportunities */
    optimizationOpportunities?: Instruction6502OptimizationOpportunity[];
}
/**
 * 6502-specific instruction optimization opportunities.
 */
export interface Instruction6502OptimizationOpportunity {
    opportunity: Instruction6502OptimizationOpportunityType;
    benefit: number;
    description: string;
}
export type Instruction6502OptimizationOpportunityType = 'use_zero_page' | 'use_register' | 'combine_operations' | 'eliminate_load_store' | 'use_immediate' | 'strength_reduction' | 'dead_code' | 'loop_optimization';
/**
 * Program-level optimization metadata.
 */
export interface ProgramOptimizationMetadata {
    /** Total instruction count */
    totalInstructions: number;
    /** Hot path analysis */
    hotPaths: HotPathInfo[];
    /** Global optimization opportunities */
    globalOptimizations: GlobalOptimizationOpportunity[];
    /** Resource usage analysis */
    resourceUsage: ProgramResourceUsage;
}
/**
 * Module-level optimization metadata.
 */
export interface ModuleOptimizationMetadata {
    /** Module instruction count */
    instructionCount: number;
    /** Inter-function optimization opportunities */
    interFunctionOptimizations: InterFunctionOptimization[];
    /** Module resource usage */
    moduleResourceUsage: ModuleResourceUsage;
}
/**
 * IL-specific function optimization metadata.
 */
export interface ILFunctionOptimizationMetadata {
    /** Control flow graph information */
    controlFlowGraph: ControlFlowGraph;
    /** Basic block analysis */
    basicBlocks: BasicBlock[];
    /** Loop information */
    loops: LoopInfo[];
    /** Data flow analysis */
    dataFlowAnalysis: DataFlowAnalysis;
    /** Register usage analysis */
    registerUsage: RegisterUsageAnalysis;
}
/**
 * Hot path information.
 */
export interface HotPathInfo {
    /** Path identifier */
    pathId: string;
    /** Instructions in this hot path */
    instructions: number[];
    /** Estimated execution frequency */
    frequency: number;
    /** Optimization priority */
    priority: 'low' | 'medium' | 'high' | 'critical';
}
/**
 * Control flow graph for function.
 */
export interface ControlFlowGraph {
    /** Entry block */
    entryBlock: number;
    /** Exit blocks */
    exitBlocks: number[];
    /** Basic blocks */
    blocks: ControlFlowBlock[];
    /** Edges between blocks */
    edges: ControlFlowEdge[];
}
/**
 * Control flow graph block.
 */
export interface ControlFlowBlock {
    /** Block ID */
    blockId: number;
    /** First instruction in block */
    startInstruction: number;
    /** Last instruction in block */
    endInstruction: number;
    /** Predecessors */
    predecessors: number[];
    /** Successors */
    successors: number[];
}
/**
 * Control flow graph edge.
 */
export interface ControlFlowEdge {
    /** Source block */
    from: number;
    /** Target block */
    to: number;
    /** Edge type */
    edgeType: 'fall_through' | 'branch_true' | 'branch_false' | 'unconditional';
    /** Probability this edge is taken */
    probability?: number;
}
/**
 * Basic block information.
 */
export interface BasicBlock {
    /** Block ID */
    id: number;
    /** Instructions in this block */
    instructions: number[];
    /** Whether this block is in a loop */
    isInLoop: boolean;
    /** Loop nesting level */
    loopNesting: number;
    /** Execution frequency estimate */
    frequency: number;
}
/**
 * Loop information.
 */
export interface LoopInfo {
    /** Loop ID */
    id: number;
    /** Header block */
    headerBlock: number;
    /** Blocks in loop */
    blocks: number[];
    /** Nested loops */
    nestedLoops: number[];
    /** Loop type */
    loopType: 'for' | 'while' | 'do_while';
    /** Iteration estimate */
    estimatedIterations: number;
}
/**
 * Data flow analysis information.
 */
export interface DataFlowAnalysis {
    /** Live variable analysis */
    liveVariables: LiveVariableInfo[];
    /** Reaching definitions */
    reachingDefinitions: ReachingDefinitionInfo[];
    /** Available expressions */
    availableExpressions: AvailableExpressionInfo[];
}
/**
 * Live variable information.
 */
export interface LiveVariableInfo {
    variable: ILValue;
    liveRanges: LiveRange[];
}
/**
 * Live range for a variable.
 */
export interface LiveRange {
    start: number;
    end: number;
}
/**
 * IL instruction metadata.
 */
export interface ILInstructionMetadata {
    /** Optimization passes that have processed this instruction */
    processedBy: string[];
    /** Whether this instruction was generated by optimization */
    synthetic: boolean;
    /** Original AST node reference */
    originalAstNode?: string;
    /** Performance characteristics */
    performanceInfo?: InstructionPerformanceInfo;
    /** Debug information */
    debugInfo?: InstructionDebugInfo;
}
/**
 * Memory allocation information.
 */
export interface MemoryAllocationInfo {
    /** Allocated address */
    address: number;
    /** Size in bytes */
    size: number;
    /** Memory region */
    region: MemoryBank6502;
    /** Alignment */
    alignment: number;
}
/**
 * Parameter optimization hints.
 */
export interface ParameterOptimizationHints {
    /** Whether parameter is read-only */
    isReadOnly: boolean;
    /** Whether parameter is used in hot paths */
    usedInHotPath: boolean;
    /** Preferred passing method */
    preferredPassingMethod: ParameterPassingMethod;
}
/**
 * Local variable optimization hints.
 */
export interface LocalVariableOptimizationHints {
    /** Whether variable can be register allocated */
    canRegisterAllocate: boolean;
    /** Preferred allocation method */
    preferredAllocation: LocalVariableAllocation;
    /** Register allocation priority */
    registerPriority: 'low' | 'medium' | 'high';
}
/**
 * Instruction performance information.
 */
export interface InstructionPerformanceInfo {
    /** Estimated cycle count */
    cycles: number;
    /** Memory accesses */
    memoryAccesses: number;
    /** Whether instruction is on critical path */
    criticalPath: boolean;
}
/**
 * Instruction debug information.
 */
export interface InstructionDebugInfo {
    /** Original source code line */
    sourceLine?: string;
    /** Comments */
    comments?: string[];
    /** Variable names at this point */
    variables?: string[];
}
export interface GlobalOptimizationOpportunity {
    type: string;
    benefit: number;
    description: string;
}
export interface ProgramResourceUsage {
    memoryUsage: number;
    registerPressure: number;
}
export interface InterFunctionOptimization {
    type: string;
    functions: string[];
    benefit: number;
}
export interface ModuleResourceUsage {
    instructionCount: number;
    memoryUsage: number;
}
export interface RegisterUsageAnalysis {
    registerPressure: Map<Register6502, number>;
    conflicts: RegisterConflict[];
}
export interface RegisterConflict {
    register: Register6502;
    instructions: number[];
    severity: 'low' | 'medium' | 'high';
}
export interface ReachingDefinitionInfo {
    variable: ILValue;
    definitions: number[];
}
export interface AvailableExpressionInfo {
    expression: string;
    availableAt: number[];
}
/**
 * Type guard functions for IL values.
 */
export declare function isILConstant(value: ILValue): value is ILConstant;
export declare function isILVariable(value: ILValue): value is ILVariable;
export declare function isILRegister(value: ILValue): value is ILRegister;
export declare function isILTemporary(value: ILValue): value is ILTemporary;
export declare function isILMemoryLocation(value: ILValue): value is ILMemoryLocation;
export declare function isILLabel(value: ILValue): value is ILLabel;
/**
 * Type guard functions for IL operands.
 */
export declare function isILParameterReference(operand: ILOperand): operand is ILParameterReference;
export declare function isILReturnReference(operand: ILOperand): operand is ILReturnReference;
/**
 * Factory functions for creating IL values.
 */
export declare function createILConstant(type: Blend65Type, value: number | boolean | string, representation?: ConstantRepresentation): ILConstant;
export declare function createILVariable(name: string, type: Blend65Type, qualifiedName?: string[], storageClass?: StorageClass | null, scope?: VariableScope): ILVariable;
export declare function createILRegister(register: Register6502, type: Blend65Type): ILRegister;
export declare function createILTemporary(id: number, type: Blend65Type, scope?: TemporaryScope): ILTemporary;
export declare function createILLabel(name: string): ILLabel;
/**
 * Factory functions for creating IL instructions.
 */
export declare function createILInstruction(type: ILInstructionType, operands: ILOperand[], id: number, options?: {
    result?: ILValue;
    sourceLocation?: SourcePosition;
    sixtyTwoHints?: IL6502OptimizationHints;
    metadata?: ILInstructionMetadata;
}): ILInstruction;
/**
 * Get a string representation of an IL value for debugging.
 */
export declare function ilValueToString(value: ILValue): string;
/**
 * Get a string representation of an IL instruction for debugging.
 */
export declare function ilInstructionToString(instruction: ILInstruction): string;
/**
 * Create a basic IL program structure.
 */
export declare function createILProgram(name: string): ILProgram;
/**
 * Create a basic IL module structure.
 */
export declare function createILModule(qualifiedName: string[]): ILModule;
/**
 * Create a basic IL function structure.
 */
export declare function createILFunction(name: string, qualifiedName: string[], returnType: Blend65Type, sourceLocation: SourcePosition): ILFunction;
//# sourceMappingURL=il-types.d.ts.map