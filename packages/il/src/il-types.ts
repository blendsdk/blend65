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
import type {
  Blend65Type,
  VariableOptimizationMetadata,
  FunctionOptimizationMetadata,
  StorageClass
} from '@blend65/semantic';

// ============================================================================
// CORE IL PROGRAM STRUCTURE
// ============================================================================

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
  labels: Map<string, number>; // Label name -> instruction index

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

// ============================================================================
// IL INSTRUCTION SYSTEM
// ============================================================================

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
export enum ILInstructionType {
  // ============================================================================
  // MEMORY OPERATIONS
  // ============================================================================

  /** Load immediate value: LOAD_IMMEDIATE <dest> <value> */
  LOAD_IMMEDIATE = 'LOAD_IMMEDIATE',

  /** Load from memory: LOAD_MEMORY <dest> <address> */
  LOAD_MEMORY = 'LOAD_MEMORY',

  /** Store to memory: STORE_MEMORY <address> <value> */
  STORE_MEMORY = 'STORE_MEMORY',

  /** Copy value: COPY <dest> <source> */
  COPY = 'COPY',

  // ============================================================================
  // ARITHMETIC OPERATIONS
  // ============================================================================

  /** Add: ADD <dest> <left> <right> */
  ADD = 'ADD',

  /** Subtract: SUB <dest> <left> <right> */
  SUB = 'SUB',

  /** Multiply: MUL <dest> <left> <right> */
  MUL = 'MUL',

  /** Divide: DIV <dest> <left> <right> */
  DIV = 'DIV',

  /** Modulo: MOD <dest> <left> <right> */
  MOD = 'MOD',

  /** Negate: NEG <dest> <source> */
  NEG = 'NEG',

  // ============================================================================
  // LOGICAL OPERATIONS
  // ============================================================================

  /** Logical AND: AND <dest> <left> <right> */
  AND = 'AND',

  /** Logical OR: OR <dest> <left> <right> */
  OR = 'OR',

  /** Logical NOT: NOT <dest> <source> */
  NOT = 'NOT',

  // ============================================================================
  // BITWISE OPERATIONS
  // ============================================================================

  /** Bitwise AND: BITWISE_AND <dest> <left> <right> */
  BITWISE_AND = 'BITWISE_AND',

  /** Bitwise OR: BITWISE_OR <dest> <left> <right> */
  BITWISE_OR = 'BITWISE_OR',

  /** Bitwise XOR: BITWISE_XOR <dest> <left> <right> */
  BITWISE_XOR = 'BITWISE_XOR',

  /** Bitwise NOT: BITWISE_NOT <dest> <source> */
  BITWISE_NOT = 'BITWISE_NOT',

  /** Shift left: SHIFT_LEFT <dest> <source> <amount> */
  SHIFT_LEFT = 'SHIFT_LEFT',

  /** Shift right: SHIFT_RIGHT <dest> <source> <amount> */
  SHIFT_RIGHT = 'SHIFT_RIGHT',

  // ============================================================================
  // COMPARISON OPERATIONS
  // ============================================================================

  /** Compare equal: COMPARE_EQ <dest> <left> <right> */
  COMPARE_EQ = 'COMPARE_EQ',

  /** Compare not equal: COMPARE_NE <dest> <left> <right> */
  COMPARE_NE = 'COMPARE_NE',

  /** Compare less than: COMPARE_LT <dest> <left> <right> */
  COMPARE_LT = 'COMPARE_LT',

  /** Compare less than or equal: COMPARE_LE <dest> <left> <right> */
  COMPARE_LE = 'COMPARE_LE',

  /** Compare greater than: COMPARE_GT <dest> <left> <right> */
  COMPARE_GT = 'COMPARE_GT',

  /** Compare greater than or equal: COMPARE_GE <dest> <left> <right> */
  COMPARE_GE = 'COMPARE_GE',

  // ============================================================================
  // CONTROL FLOW OPERATIONS
  // ============================================================================

  /** Unconditional branch: BRANCH <target> */
  BRANCH = 'BRANCH',

  /** Conditional branch if true: BRANCH_IF_TRUE <condition> <target> */
  BRANCH_IF_TRUE = 'BRANCH_IF_TRUE',

  /** Conditional branch if false: BRANCH_IF_FALSE <condition> <target> */
  BRANCH_IF_FALSE = 'BRANCH_IF_FALSE',

  /** Conditional branch if zero: BRANCH_IF_ZERO <value> <target> */
  BRANCH_IF_ZERO = 'BRANCH_IF_ZERO',

  /** Conditional branch if not zero: BRANCH_IF_NOT_ZERO <value> <target> */
  BRANCH_IF_NOT_ZERO = 'BRANCH_IF_NOT_ZERO',

  // ============================================================================
  // FUNCTION OPERATIONS
  // ============================================================================

  /** Function call: CALL <function> [args...] */
  CALL = 'CALL',

  /** Return from function: RETURN [value] */
  RETURN = 'RETURN',

  // ============================================================================
  // VARIABLE OPERATIONS
  // ============================================================================

  /** Declare local variable: DECLARE_LOCAL <variable> <type> */
  DECLARE_LOCAL = 'DECLARE_LOCAL',

  /** Load variable: LOAD_VARIABLE <dest> <variable> */
  LOAD_VARIABLE = 'LOAD_VARIABLE',

  /** Store variable: STORE_VARIABLE <variable> <value> */
  STORE_VARIABLE = 'STORE_VARIABLE',

  // ============================================================================
  // ARRAY OPERATIONS
  // ============================================================================

  /** Load array element: LOAD_ARRAY <dest> <array> <index> */
  LOAD_ARRAY = 'LOAD_ARRAY',

  /** Store array element: STORE_ARRAY <array> <index> <value> */
  STORE_ARRAY = 'STORE_ARRAY',

  /** Calculate array address: ARRAY_ADDRESS <dest> <array> <index> */
  ARRAY_ADDRESS = 'ARRAY_ADDRESS',

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /** Label: LABEL <name> */
  LABEL = 'LABEL',

  /** No operation: NOP */
  NOP = 'NOP',

  /** Comment: COMMENT <text> */
  COMMENT = 'COMMENT',

  // ============================================================================
  // 6502-SPECIFIC OPERATIONS
  // ============================================================================

  /** Register operation: REGISTER_OP <register> <operation> [operand] */
  REGISTER_OP = 'REGISTER_OP',

  /** Hardware peek: PEEK <dest> <address> */
  PEEK = 'PEEK',

  /** Hardware poke: POKE <address> <value> */
  POKE = 'POKE',

  /** Set processor flags: SET_FLAGS <flags> */
  SET_FLAGS = 'SET_FLAGS',

  /** Clear processor flags: CLEAR_FLAGS <flags> */
  CLEAR_FLAGS = 'CLEAR_FLAGS'
}

// ============================================================================
// IL VALUE SYSTEM
// ============================================================================

/**
 * Union type for all values in the IL system.
 * Values represent data that can be operated on by instructions.
 */
export type ILValue =
  | ILConstant
  | ILVariable
  | ILRegister
  | ILTemporary
  | ILMemoryLocation
  | ILLabel;

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
export type ConstantRepresentation =
  | 'decimal'      // 255
  | 'hexadecimal'  // $FF or 0xFF
  | 'binary'       // 0b11111111
  | 'character'    // 'A'
  | 'string'       // "Hello"
  | 'boolean';     // true/false

/**
 * Variable reference in IL.
 * References variables declared in Blend65 source.
 */
export interface ILVariable {
  valueType: 'variable';
  name: string;
  qualifiedName: string[]; // For module-scoped variables
  type: Blend65Type;
  storageClass: StorageClass | null;
  scope: VariableScope;
  optimizationMetadata?: VariableOptimizationMetadata;
}

/**
 * Variable scope classification.
 */
export type VariableScope =
  | 'global'      // Module-level variable
  | 'local'       // Function parameter or local variable
  | 'temporary';  // Compiler-generated temporary

/**
 * 6502 register reference.
 * Represents the three main 6502 registers.
 */
export interface ILRegister {
  valueType: 'register';
  register: Register6502;
  type: Blend65Type; // Usually byte, word for register pairs
}

/**
 * 6502 register types.
 */
export type Register6502 =
  | 'A'    // Accumulator
  | 'X'    // X index register
  | 'Y'    // Y index register
  | 'AX'   // A:X register pair (16-bit)
  | 'XY';  // X:Y register pair (16-bit)

/**
 * Temporary value in IL.
 * Compiler-generated temporary variables for intermediate calculations.
 */
export interface ILTemporary {
  valueType: 'temporary';
  id: number; // Unique temporary ID
  type: Blend65Type;
  scope: TemporaryScope;
  lifetimeInfo?: TemporaryLifetimeInfo;
}

/**
 * Temporary variable scope.
 */
export type TemporaryScope =
  | 'expression'  // Lives only within an expression
  | 'statement'   // Lives within a statement
  | 'block'       // Lives within a block
  | 'function';   // Lives within entire function

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
  address: ILValue; // Address can be constant, variable, or calculated
  type: Blend65Type;
  addressingMode: AddressingMode6502;
  memoryBank?: MemoryBank6502;
}

/**
 * 6502 addressing modes.
 */
export type AddressingMode6502 =
  | 'immediate'         // #$20
  | 'zero_page'        // $20
  | 'zero_page_x'      // $20,X
  | 'zero_page_y'      // $20,Y
  | 'absolute'         // $2000
  | 'absolute_x'       // $2000,X
  | 'absolute_y'       // $2000,Y
  | 'indirect'         // ($2000)
  | 'indexed_indirect' // ($20,X)
  | 'indirect_indexed';// ($20),Y

/**
 * 6502 memory banks.
 */
export type MemoryBank6502 =
  | 'zero_page'   // $00-$FF
  | 'stack'       // $0100-$01FF
  | 'ram'         // $0200-$9FFF (C64)
  | 'io'          // $D000-$DFFF (C64)
  | 'rom'         // $E000-$FFFF (C64)
  | 'cartridge';  // Cartridge space

/**
 * Label reference for branches and calls.
 */
export interface ILLabel {
  valueType: 'label';
  name: string;
  targetInstruction?: number; // Resolved during IL processing
}

// ============================================================================
// IL OPERAND SYSTEM
// ============================================================================

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

// ============================================================================
// IL DATA STRUCTURES
// ============================================================================

/**
 * Function parameter in IL.
 */
export interface ILParameter {
  name: string;
  type: Blend65Type;
  index: number; // Parameter index (0, 1, 2...)
  passingMethod: ParameterPassingMethod;
  optimizationHints?: ParameterOptimizationHints;
}

/**
 * How parameters are passed to functions.
 */
export type ParameterPassingMethod =
  | 'register_A'    // Pass in A register
  | 'register_X'    // Pass in X register
  | 'register_Y'    // Pass in Y register
  | 'zero_page'     // Pass via zero page location
  | 'stack'         // Pass on stack
  | 'global';       // Pass via global variable

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
export type LocalVariableAllocation =
  | 'register'      // Allocated to register
  | 'zero_page'     // Allocated to zero page
  | 'stack'         // Allocated on stack
  | 'global';       // Allocated as global (for static locals)

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

// ============================================================================
// 6502-SPECIFIC OPTIMIZATION HINTS
// ============================================================================

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
  benefit: number; // Estimated cycle savings
  description: string;
}

export type Instruction6502OptimizationOpportunityType =
  | 'use_zero_page'        // Use zero page addressing
  | 'use_register'         // Keep value in register
  | 'combine_operations'   // Combine with next instruction
  | 'eliminate_load_store' // Eliminate unnecessary load/store
  | 'use_immediate'        // Use immediate addressing
  | 'strength_reduction'   // Reduce operation strength
  | 'dead_code'           // Instruction can be removed
  | 'loop_optimization';  // Optimize for loop usage

// ============================================================================
// OPTIMIZATION METADATA
// ============================================================================

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

// ============================================================================
// HELPER TYPES AND METADATA
// ============================================================================

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
  start: number; // Instruction index
  end: number;   // Instruction index
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

// More metadata types for comprehensive analysis
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

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

/**
 * Type guard functions for IL values.
 */
export function isILConstant(value: ILValue): value is ILConstant {
  return value.valueType === 'constant';
}

export function isILVariable(value: ILValue): value is ILVariable {
  return value.valueType === 'variable';
}

export function isILRegister(value: ILValue): value is ILRegister {
  return value.valueType === 'register';
}

export function isILTemporary(value: ILValue): value is ILTemporary {
  return value.valueType === 'temporary';
}

export function isILMemoryLocation(value: ILValue): value is ILMemoryLocation {
  return value.valueType === 'memory';
}

export function isILLabel(value: ILValue): value is ILLabel {
  return value.valueType === 'label';
}

/**
 * Type guard functions for IL operands.
 */
export function isILParameterReference(operand: ILOperand): operand is ILParameterReference {
  return (operand as ILParameterReference).operandType === 'parameter';
}

export function isILReturnReference(operand: ILOperand): operand is ILReturnReference {
  return (operand as ILReturnReference).operandType === 'return';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory functions for creating IL values.
 */
export function createILConstant(
  type: Blend65Type,
  value: number | boolean | string,
  representation: ConstantRepresentation = 'decimal'
): ILConstant {
  return {
    valueType: 'constant',
    type,
    value,
    representation
  };
}

export function createILVariable(
  name: string,
  type: Blend65Type,
  qualifiedName: string[] = [],
  storageClass: StorageClass | null = null,
  scope: VariableScope = 'local'
): ILVariable {
  return {
    valueType: 'variable',
    name,
    qualifiedName,
    type,
    storageClass,
    scope
  };
}

export function createILRegister(register: Register6502, type: Blend65Type): ILRegister {
  return {
    valueType: 'register',
    register,
    type
  };
}

export function createILTemporary(id: number, type: Blend65Type, scope: TemporaryScope = 'expression'): ILTemporary {
  return {
    valueType: 'temporary',
    id,
    type,
    scope
  };
}

export function createILLabel(name: string): ILLabel {
  return {
    valueType: 'label',
    name
  };
}

/**
 * Factory functions for creating IL instructions.
 */
export function createILInstruction(
  type: ILInstructionType,
  operands: ILOperand[],
  id: number,
  options: {
    result?: ILValue;
    sourceLocation?: SourcePosition;
    sixtyTwoHints?: IL6502OptimizationHints;
    metadata?: ILInstructionMetadata;
  } = {}
): ILInstruction {
  return {
    type,
    operands,
    id,
    ...options
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a string representation of an IL value for debugging.
 */
export function ilValueToString(value: ILValue): string {
  switch (value.valueType) {
    case 'constant':
      switch (value.representation) {
        case 'hexadecimal':
          return typeof value.value === 'number' ? `$${value.value.toString(16).toUpperCase()}` : String(value.value);
        case 'binary':
          return typeof value.value === 'number' ? `0b${value.value.toString(2)}` : String(value.value);
        case 'character':
          return `'${value.value}'`;
        case 'string':
          return `"${value.value}"`;
        case 'boolean':
          return String(value.value);
        default:
          return String(value.value);
      }

    case 'variable':
      return value.qualifiedName.length > 0
        ? `${value.qualifiedName.join('.')}.${value.name}`
        : value.name;

    case 'register':
      return value.register;

    case 'temporary':
      return `temp_${value.id}`;

    case 'memory':
      return `[${ilValueToString(value.address)}]`;

    case 'label':
      return value.name;

    default:
      return 'unknown';
  }
}

/**
 * Get a string representation of an IL instruction for debugging.
 */
export function ilInstructionToString(instruction: ILInstruction): string {
  const operandStrs = instruction.operands.map(op => {
    if ('valueType' in op) {
      return ilValueToString(op as ILValue);
    } else if ('operandType' in op) {
      const ref = op as ILParameterReference | ILReturnReference;
      return ref.operandType === 'parameter'
        ? `param_${(ref as ILParameterReference).parameterIndex}`
        : 'return';
    } else {
      return String(op);
    }
  }).join(', ');

  const resultStr = instruction.result ? ` -> ${ilValueToString(instruction.result)}` : '';

  return `${instruction.type}(${operandStrs})${resultStr}`;
}

/**
 * Create a basic IL program structure.
 */
export function createILProgram(name: string): ILProgram {
  return {
    name,
    modules: [],
    globalData: [],
    imports: [],
    exports: [],
    sourceInfo: {
      originalFiles: [],
      compilationTimestamp: new Date(),
      compilerVersion: '0.1.0',
      targetPlatform: 'c64'
    }
  };
}

/**
 * Create a basic IL module structure.
 */
export function createILModule(qualifiedName: string[]): ILModule {
  return {
    qualifiedName,
    functions: [],
    moduleData: [],
    exports: [],
    imports: []
  };
}

/**
 * Create a basic IL function structure.
 */
export function createILFunction(
  name: string,
  qualifiedName: string[],
  returnType: Blend65Type,
  sourceLocation: SourcePosition
): ILFunction {
  return {
    name,
    qualifiedName,
    parameters: [],
    returnType,
    localVariables: [],
    instructions: [],
    labels: new Map(),
    isCallback: false,
    isExported: false,
    sourceLocation
  };
}
