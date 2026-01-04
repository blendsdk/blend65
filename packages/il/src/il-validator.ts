/**
 * IL Validation System for Blend65
 * Task 2.4: Implement IL Validation
 *
 * This file implements comprehensive validation for generated Blend65 IL.
 * The validator ensures IL correctness before optimization and code generation,
 * detecting errors in instruction validity, control flow, variable lifecycle,
 * function calls, register usage, and type consistency.
 *
 * Key Responsibilities:
 * - Validate all IL instruction types and operand compatibility
 * - Ensure control flow graph integrity and reachability analysis
 * - Verify variable definition before use and scope compliance
 * - Validate function call conventions and signature compatibility
 * - Check 6502 register allocation hints and usage patterns
 * - Ensure type consistency across instruction sequences
 *
 * Educational Focus:
 * - How compilers validate intermediate representations for correctness
 * - Control flow analysis and dead code detection in IL
 * - Variable lifecycle management and scope validation
 * - 6502-specific validation considerations for optimization
 * - Type safety enforcement in intermediate language
 */

import type { SourcePosition } from '@blend65/lexer';
import type { Blend65Type, PrimitiveType } from '@blend65/semantic';
import type {
  ILProgram,
  ILModule,
  ILFunction,
  ILInstruction,
  ILValue,
  ILOperand,
  ILConstant,
  ILVariable,
  ILTemporary,
  ILLabel,
  Register6502,
  TemporaryScope,
  VariableScope,
  ControlFlowGraph,
} from './il-types';

import { ILInstructionType } from './il-types';

import { isILConstant, isILVariable, isILRegister, isILTemporary, isILLabel } from './il-types';

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

/**
 * Types of IL validation errors.
 */
export enum ILValidationErrorType {
  // Instruction validation errors
  INVALID_INSTRUCTION_TYPE = 'INVALID_INSTRUCTION_TYPE',
  INVALID_OPERAND_COUNT = 'INVALID_OPERAND_COUNT',
  INVALID_OPERAND_TYPE = 'INVALID_OPERAND_TYPE',
  INCOMPATIBLE_RESULT_TYPE = 'INCOMPATIBLE_RESULT_TYPE',

  // Control flow validation errors
  INVALID_BRANCH_TARGET = 'INVALID_BRANCH_TARGET',
  UNREACHABLE_CODE = 'UNREACHABLE_CODE',
  INVALID_CONTROL_FLOW = 'INVALID_CONTROL_FLOW',
  MISSING_RETURN_STATEMENT = 'MISSING_RETURN_STATEMENT',

  // Variable validation errors
  UNDEFINED_VARIABLE = 'UNDEFINED_VARIABLE',
  VARIABLE_USED_BEFORE_DEFINED = 'VARIABLE_USED_BEFORE_DEFINED',
  INVALID_VARIABLE_SCOPE = 'INVALID_VARIABLE_SCOPE',
  TEMPORARY_LIFECYCLE_ERROR = 'TEMPORARY_LIFECYCLE_ERROR',

  // Function validation errors
  INVALID_FUNCTION_CALL = 'INVALID_FUNCTION_CALL',
  PARAMETER_COUNT_MISMATCH = 'PARAMETER_COUNT_MISMATCH',
  PARAMETER_TYPE_MISMATCH = 'PARAMETER_TYPE_MISMATCH',
  INVALID_RETURN_TYPE = 'INVALID_RETURN_TYPE',

  // Register validation errors
  INVALID_REGISTER_USAGE = 'INVALID_REGISTER_USAGE',
  REGISTER_CONFLICT = 'REGISTER_CONFLICT',
  INVALID_ADDRESSING_MODE = 'INVALID_ADDRESSING_MODE',

  // Type validation errors
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  INVALID_TYPE_CONVERSION = 'INVALID_TYPE_CONVERSION',
  STORAGE_CLASS_VIOLATION = 'STORAGE_CLASS_VIOLATION',
}

/**
 * Severity levels for validation errors.
 */
export enum ILValidationSeverity {
  ERROR = 'ERROR', // Critical error that prevents compilation
  WARNING = 'WARNING', // Non-critical issue that should be addressed
  INFO = 'INFO', // Informational message
}

/**
 * IL validation error information.
 */
export interface ILValidationError {
  /** Error type classification */
  type: ILValidationErrorType;

  /** Error severity level */
  severity: ILValidationSeverity;

  /** Human-readable error message */
  message: string;

  /** Source location if available */
  sourceLocation?: SourcePosition;

  /** Instruction ID where error occurred */
  instructionId?: number;

  /** Function where error occurred */
  functionName?: string;

  /** Module where error occurred */
  moduleName?: string;

  /** Additional context information */
  context?: ValidationErrorContext;
}

/**
 * Additional context for validation errors.
 */
export interface ValidationErrorContext {
  /** Related instruction */
  instruction?: ILInstruction;

  /** Related operands */
  operands?: ILOperand[];

  /** Expected type or value */
  expected?: string;

  /** Actual type or value */
  actual?: string;

  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of IL validation.
 */
export interface ILValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** All validation errors found */
  errors: ILValidationError[];

  /** Validation warnings */
  warnings: ILValidationError[];

  /** Informational messages */
  info: ILValidationError[];

  /** Validation statistics */
  statistics: ILValidationStatistics;

  /** Control flow analysis result */
  controlFlowAnalysis?: ControlFlowAnalysisResult;
}

/**
 * Validation statistics.
 */
export interface ILValidationStatistics {
  /** Total instructions validated */
  totalInstructions: number;

  /** Total functions validated */
  totalFunctions: number;

  /** Total modules validated */
  totalModules: number;

  /** Instructions by type count */
  instructionsByType: Map<ILInstructionType, number>;

  /** Variables validated */
  variablesValidated: number;

  /** Temporaries validated */
  temporariesValidated: number;

  /** Control flow paths analyzed */
  controlFlowPaths: number;
}

/**
 * Control flow analysis result.
 */
export interface ControlFlowAnalysisResult {
  /** Control flow graph */
  controlFlowGraph: ControlFlowGraph;

  /** Reachable instructions */
  reachableInstructions: Set<number>;

  /** Unreachable code blocks */
  unreachableBlocks: number[];

  /** Dead code instructions */
  deadInstructions: number[];

  /** Function has proper returns */
  hasProperReturns: boolean;
}

// ============================================================================
// VALIDATION CONTEXT
// ============================================================================

/**
 * Context maintained during IL validation.
 */
interface ILValidationContext {
  /** Current module being validated */
  currentModule: ILModule;

  /** Current function being validated */
  currentFunction: ILFunction | null;

  /** Defined variables in current scope */
  definedVariables: Map<string, VariableDefinition>;

  /** Active temporaries and their lifecycle */
  activeTemporaries: Map<number, TemporaryLifecycle>;

  /** Function labels and their target instructions */
  functionLabels: Map<string, number>;

  /** Register usage tracking */
  registerUsage: Map<Register6502, RegisterUsageInfo>;

  /** Control flow graph being built */
  controlFlowGraph: ControlFlowGraph;

  /** Current basic block */
  currentBlock: number;

  /** Instruction reachability */
  reachableInstructions: Set<number>;

  /** Error collector */
  errors: ILValidationError[];

  /** Warning collector */
  warnings: ILValidationError[];

  /** Info collector */
  info: ILValidationError[];

  /** Validation statistics */
  statistics: ILValidationStatistics;
}

/**
 * Variable definition information.
 */
interface VariableDefinition {
  /** Variable name */
  name: string;

  /** Variable type */
  type: Blend65Type;

  /** Variable scope */
  scope: VariableScope;

  /** Instruction where defined */
  definedAt: number;

  /** Whether variable is initialized */
  isInitialized: boolean;

  /** Last use instruction */
  lastUsedAt?: number;
}

/**
 * Temporary variable lifecycle information.
 */
interface TemporaryLifecycle {
  /** Temporary ID */
  id: number;

  /** Temporary type */
  type: Blend65Type;

  /** Temporary scope */
  scope: TemporaryScope;

  /** Instruction where created */
  createdAt: number;

  /** Last instruction where used */
  lastUsedAt?: number;

  /** Whether temporary is live */
  isLive: boolean;
}

/**
 * Register usage information.
 */
interface RegisterUsageInfo {
  /** Register being tracked */
  register: Register6502;

  /** Current instruction using register */
  currentInstruction?: number;

  /** Last instruction that used register */
  lastUsedAt?: number;

  /** Whether register is currently allocated */
  isAllocated: boolean;
}

// ============================================================================
// MAIN IL VALIDATOR CLASS
// ============================================================================

/**
 * Main IL validator implementation.
 * Performs comprehensive validation of IL programs for correctness.
 */
export class ILValidator {
  private context: ILValidationContext;

  constructor() {
    this.context = this.createValidationContext();
  }

  /**
   * Validate a complete IL program.
   */
  public validateProgram(program: ILProgram): ILValidationResult {
    // Reset validation context
    this.context = this.createValidationContext();

    // Validate each module
    for (const module of program.modules) {
      this.validateModule(module);
    }

    // Validate global data
    this.validateGlobalData(program.globalData);

    // Validate imports/exports
    this.validateImportsExports(program.imports, program.exports);

    return this.createValidationResult();
  }

  /**
   * Validate a single IL module.
   */
  public validateModule(module: ILModule): ILValidationResult {
    // Reset context for module validation
    this.context = this.createValidationContext();
    this.context.currentModule = module;

    // Validate each function in the module
    for (const func of module.functions) {
      this.validateFunction(func);
    }

    // Validate module data
    this.validateModuleData(module.moduleData);

    return this.createValidationResult();
  }

  /**
   * Validate a single IL function.
   */
  public validateFunction(func: ILFunction): ILValidationResult {
    // Reset function-specific context
    this.resetFunctionContext();
    this.context.currentFunction = func;

    // Build function labels map
    this.buildFunctionLabels(func);

    // Validate function signature
    this.validateFunctionSignature(func);

    // Validate function parameters
    this.validateFunctionParameters(func);

    // Validate local variables
    this.validateLocalVariables(func);

    // Validate instruction sequence
    this.validateInstructionSequence(func);

    // Perform control flow analysis
    this.performControlFlowAnalysis(func);

    // Validate variable lifecycle
    this.validateVariableLifecycle(func);

    // Update statistics
    this.context.statistics.totalFunctions++;
    this.context.statistics.totalInstructions += func.instructions.length;

    return this.createValidationResult();
  }

  // ============================================================================
  // INSTRUCTION VALIDATION
  // ============================================================================

  private validateInstructionSequence(func: ILFunction): void {
    for (let i = 0; i < func.instructions.length; i++) {
      const instruction = func.instructions[i];

      try {
        this.validateInstruction(instruction, i);
        this.updateInstructionStatistics(instruction);
      } catch (error) {
        this.addError(
          ILValidationErrorType.INVALID_INSTRUCTION_TYPE,
          ILValidationSeverity.ERROR,
          `Instruction validation failed: ${error instanceof Error ? error.message : String(error)}`,
          instruction.sourceLocation,
          instruction.id,
          {
            instruction,
            suggestion: 'Check instruction operands and types',
          }
        );
      }
    }
  }

  private validateInstruction(instruction: ILInstruction, index: number): void {
    // Validate instruction ID
    if (instruction.id <= 0) {
      this.addError(
        ILValidationErrorType.INVALID_INSTRUCTION_TYPE,
        ILValidationSeverity.ERROR,
        `Invalid instruction ID: ${instruction.id}`,
        instruction.sourceLocation,
        instruction.id
      );
    }

    // Validate based on instruction type
    switch (instruction.type) {
      case ILInstructionType.LOAD_IMMEDIATE:
        this.validateLoadImmediate(instruction);
        break;

      case ILInstructionType.LOAD_MEMORY:
        this.validateLoadMemory(instruction);
        break;

      case ILInstructionType.STORE_MEMORY:
        this.validateStoreMemory(instruction);
        break;

      case ILInstructionType.COPY:
        this.validateCopy(instruction);
        break;

      case ILInstructionType.ADD:
      case ILInstructionType.SUB:
      case ILInstructionType.MUL:
      case ILInstructionType.DIV:
      case ILInstructionType.MOD:
        this.validateArithmeticOperation(instruction);
        break;

      case ILInstructionType.AND:
      case ILInstructionType.OR:
        this.validateLogicalOperation(instruction);
        break;

      case ILInstructionType.NOT:
      case ILInstructionType.NEG:
        this.validateUnaryOperation(instruction);
        break;

      case ILInstructionType.BITWISE_AND:
      case ILInstructionType.BITWISE_OR:
      case ILInstructionType.BITWISE_XOR:
        this.validateBitwiseOperation(instruction);
        break;

      case ILInstructionType.BITWISE_NOT:
        this.validateBitwiseUnaryOperation(instruction);
        break;

      case ILInstructionType.SHIFT_LEFT:
      case ILInstructionType.SHIFT_RIGHT:
        this.validateShiftOperation(instruction);
        break;

      case ILInstructionType.COMPARE_EQ:
      case ILInstructionType.COMPARE_NE:
      case ILInstructionType.COMPARE_LT:
      case ILInstructionType.COMPARE_LE:
      case ILInstructionType.COMPARE_GT:
      case ILInstructionType.COMPARE_GE:
        this.validateComparisonOperation(instruction);
        break;

      case ILInstructionType.BRANCH:
        this.validateBranch(instruction);
        break;

      case ILInstructionType.BRANCH_IF_TRUE:
      case ILInstructionType.BRANCH_IF_FALSE:
      case ILInstructionType.BRANCH_IF_ZERO:
      case ILInstructionType.BRANCH_IF_NOT_ZERO:
        this.validateConditionalBranch(instruction);
        break;

      case ILInstructionType.CALL:
        this.validateFunctionCall(instruction);
        break;

      case ILInstructionType.RETURN:
        this.validateReturn(instruction);
        break;

      case ILInstructionType.DECLARE_LOCAL:
        this.validateDeclareLocal(instruction);
        break;

      case ILInstructionType.LOAD_VARIABLE:
        this.validateLoadVariable(instruction);
        break;

      case ILInstructionType.STORE_VARIABLE:
        this.validateStoreVariable(instruction);
        break;

      case ILInstructionType.LOAD_ARRAY:
        this.validateLoadArray(instruction);
        break;

      case ILInstructionType.STORE_ARRAY:
        this.validateStoreArray(instruction);
        break;

      case ILInstructionType.ARRAY_ADDRESS:
        this.validateArrayAddress(instruction);
        break;

      case ILInstructionType.LABEL:
        this.validateLabel(instruction);
        break;

      case ILInstructionType.NOP:
        this.validateNop(instruction);
        break;

      case ILInstructionType.COMMENT:
        this.validateComment(instruction);
        break;

      case ILInstructionType.PEEK:
      case ILInstructionType.POKE:
        this.validate6502MemoryOperation(instruction);
        break;

      case ILInstructionType.REGISTER_OP:
        this.validateRegisterOperation(instruction);
        break;

      case ILInstructionType.SET_FLAGS:
      case ILInstructionType.CLEAR_FLAGS:
        this.validateFlagOperation(instruction);
        break;

      default:
        this.addError(
          ILValidationErrorType.INVALID_INSTRUCTION_TYPE,
          ILValidationSeverity.ERROR,
          `Unknown instruction type: ${instruction.type}`,
          instruction.sourceLocation,
          instruction.id
        );
    }

    // Validate 6502 optimization hints
    if (instruction.sixtyTwoHints) {
      this.validate6502Hints(instruction);
    }
  }

  // ============================================================================
  // SPECIFIC INSTRUCTION VALIDATION METHODS
  // ============================================================================

  private validateLoadImmediate(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and immediate value');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const value = instruction.operands[1] as ILValue;

      // Value must be a constant
      if (!isILConstant(value)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `LOAD_IMMEDIATE requires constant value, got ${value.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }

      // Validate result type compatibility
      if (instruction.result && !this.areTypesCompatible(dest, instruction.result)) {
        this.addError(
          ILValidationErrorType.INCOMPATIBLE_RESULT_TYPE,
          ILValidationSeverity.ERROR,
          `Result type incompatible with destination`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateLoadMemory(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and address');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const address = instruction.operands[1] as ILValue;

      // Address should be valid
      this.validateMemoryAddress(address, instruction);

      // Check result type
      if (instruction.result && !this.areTypesCompatible(dest, instruction.result)) {
        this.addError(
          ILValidationErrorType.INCOMPATIBLE_RESULT_TYPE,
          ILValidationSeverity.ERROR,
          `Result type incompatible with destination`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateStoreMemory(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'address and value');

    if (instruction.operands.length >= 2) {
      const address = instruction.operands[0] as ILValue;
      const value = instruction.operands[1] as ILValue;

      this.validateMemoryAddress(address, instruction);
      this.validateValueOperand(value, instruction);
    }
  }

  private validateCopy(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and source');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const source = instruction.operands[1] as ILValue;

      // Check type compatibility
      if (!this.areTypesCompatible(dest, source)) {
        this.addError(
          ILValidationErrorType.TYPE_MISMATCH,
          ILValidationSeverity.ERROR,
          `Type mismatch in COPY: destination and source types incompatible`,
          instruction.sourceLocation,
          instruction.id,
          {
            expected: this.getValueTypeString(dest),
            actual: this.getValueTypeString(source),
          }
        );
      }
    }
  }

  private validateArithmeticOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, left operand, and right operand');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const left = instruction.operands[1] as ILValue;
      const right = instruction.operands[2] as ILValue;

      // Operands should be numeric types
      this.validateNumericOperand(left, instruction, 'left operand');
      this.validateNumericOperand(right, instruction, 'right operand');

      // Result should be compatible
      if (instruction.result) {
        if (!this.areTypesCompatible(dest, instruction.result)) {
          this.addError(
            ILValidationErrorType.INCOMPATIBLE_RESULT_TYPE,
            ILValidationSeverity.ERROR,
            `Arithmetic result type incompatible`,
            instruction.sourceLocation,
            instruction.id
          );
        }
      }

      // Check for division by zero in constants
      if (instruction.type === ILInstructionType.DIV && isILConstant(right)) {
        const constant = right as ILConstant;
        if (constant.value === 0) {
          this.addError(
            ILValidationErrorType.INVALID_OPERAND_TYPE,
            ILValidationSeverity.ERROR,
            `Division by zero detected`,
            instruction.sourceLocation,
            instruction.id
          );
        }
      }
    }
  }

  private validateLogicalOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, left operand, and right operand');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const left = instruction.operands[1] as ILValue;
      const right = instruction.operands[2] as ILValue;

      // Logical operations expect boolean operands
      this.validateBooleanOperand(left, instruction, 'left operand');
      this.validateBooleanOperand(right, instruction, 'right operand');

      // Result should be boolean
      if (instruction.result && !this.isBooleanType(instruction.result)) {
        this.addError(
          ILValidationErrorType.INCOMPATIBLE_RESULT_TYPE,
          ILValidationSeverity.ERROR,
          `Logical operation result must be boolean`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateUnaryOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and operand');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const operand = instruction.operands[1] as ILValue;

      if (instruction.type === ILInstructionType.NEG) {
        this.validateNumericOperand(operand, instruction, 'operand');
      } else if (instruction.type === ILInstructionType.NOT) {
        this.validateBooleanOperand(operand, instruction, 'operand');
      }
    }
  }

  private validateBitwiseOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, left operand, and right operand');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const left = instruction.operands[1] as ILValue;
      const right = instruction.operands[2] as ILValue;

      // Bitwise operations expect integer operands
      this.validateIntegerOperand(left, instruction, 'left operand');
      this.validateIntegerOperand(right, instruction, 'right operand');
    }
  }

  private validateBitwiseUnaryOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and operand');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const operand = instruction.operands[1] as ILValue;

      this.validateIntegerOperand(operand, instruction, 'operand');
    }
  }

  private validateShiftOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, value, and shift amount');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const value = instruction.operands[1] as ILValue;
      const amount = instruction.operands[2] as ILValue;

      this.validateIntegerOperand(value, instruction, 'value');
      this.validateIntegerOperand(amount, instruction, 'shift amount');

      // Validate shift amount bounds
      if (isILConstant(amount)) {
        const shiftValue = (amount as ILConstant).value as number;
        if (shiftValue < 0 || shiftValue > 8) {
          this.addError(
            ILValidationErrorType.INVALID_OPERAND_TYPE,
            ILValidationSeverity.WARNING,
            `Shift amount ${shiftValue} outside typical 6502 range (0-8)`,
            instruction.sourceLocation,
            instruction.id
          );
        }
      }
    }
  }

  private validateComparisonOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, left operand, and right operand');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const left = instruction.operands[1] as ILValue;
      const right = instruction.operands[2] as ILValue;

      // Operands should be comparable types
      if (!this.areTypesCompatible(left, right)) {
        this.addError(
          ILValidationErrorType.TYPE_MISMATCH,
          ILValidationSeverity.ERROR,
          `Comparison operand types incompatible`,
          instruction.sourceLocation,
          instruction.id,
          {
            expected: this.getValueTypeString(left),
            actual: this.getValueTypeString(right),
          }
        );
      }

      // Result should be boolean
      if (instruction.result && !this.isBooleanType(instruction.result)) {
        this.addError(
          ILValidationErrorType.INCOMPATIBLE_RESULT_TYPE,
          ILValidationSeverity.ERROR,
          `Comparison result must be boolean`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateBranch(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'target label');

    if (instruction.operands.length >= 1) {
      const target = instruction.operands[0] as ILValue;

      if (!isILLabel(target)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `BRANCH requires label target, got ${target.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      } else {
        this.validateBranchTarget(target as ILLabel, instruction);
      }
    }
  }

  private validateConditionalBranch(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'condition and target label');

    if (instruction.operands.length >= 2) {
      const condition = instruction.operands[0] as ILValue;
      const target = instruction.operands[1] as ILValue;

      // Validate condition operand
      if (
        instruction.type === ILInstructionType.BRANCH_IF_TRUE ||
        instruction.type === ILInstructionType.BRANCH_IF_FALSE
      ) {
        this.validateBooleanOperand(condition, instruction, 'condition');
      } else {
        // BRANCH_IF_ZERO and BRANCH_IF_NOT_ZERO accept any value
        this.validateValueOperand(condition, instruction);
      }

      // Validate target
      if (!isILLabel(target)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `Conditional branch requires label target, got ${target.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      } else {
        this.validateBranchTarget(target as ILLabel, instruction);
      }
    }
  }

  private validateFunctionCall(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'function reference', true); // Allow variable operand count

    if (instruction.operands.length >= 1) {
      const functionRef = instruction.operands[0] as ILValue;

      // Function reference should be a variable or label
      if (!isILVariable(functionRef) && !isILLabel(functionRef)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `Function call requires function reference, got ${functionRef.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }

      // Validate arguments (rest of operands)
      for (let i = 1; i < instruction.operands.length; i++) {
        this.validateValueOperand(instruction.operands[i] as ILValue, instruction);
      }
    }
  }

  private validateReturn(instruction: ILInstruction): void {
    // Return can have 0 or 1 operands
    if (instruction.operands.length > 1) {
      this.addError(
        ILValidationErrorType.INVALID_OPERAND_COUNT,
        ILValidationSeverity.ERROR,
        `RETURN takes at most 1 operand, got ${instruction.operands.length}`,
        instruction.sourceLocation,
        instruction.id
      );
    }

    if (instruction.operands.length === 1) {
      this.validateValueOperand(instruction.operands[0] as ILValue, instruction);

      // Check return type compatibility if function context available
      if (this.context.currentFunction) {
        const returnType = this.context.currentFunction.returnType;
        if (this.isVoidType(returnType)) {
          this.addError(
            ILValidationErrorType.INVALID_RETURN_TYPE,
            ILValidationSeverity.ERROR,
            `Void function cannot return a value`,
            instruction.sourceLocation,
            instruction.id
          );
        }
      }
    }
  }

  private validateDeclareLocal(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'variable declaration');

    if (instruction.operands.length >= 1) {
      const variable = instruction.operands[0] as ILValue;

      if (!isILVariable(variable)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `DECLARE_LOCAL requires variable, got ${variable.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      } else {
        // Add to defined variables
        this.addVariableDefinition(variable as ILVariable, instruction.id, false);
      }
    }
  }

  private validateLoadVariable(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'destination and variable');

    if (instruction.operands.length >= 2) {
      const dest = instruction.operands[0] as ILValue;
      const variable = instruction.operands[1] as ILValue;

      if (!isILVariable(variable)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `LOAD_VARIABLE requires variable, got ${variable.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      } else {
        this.validateVariableAccess(variable as ILVariable, instruction.id, false);
      }
    }
  }

  private validateStoreVariable(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'variable and value');

    if (instruction.operands.length >= 2) {
      const variable = instruction.operands[0] as ILValue;
      const value = instruction.operands[1] as ILValue;

      if (!isILVariable(variable)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `STORE_VARIABLE requires variable, got ${variable.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      } else {
        this.validateVariableAccess(variable as ILVariable, instruction.id, true);
      }

      this.validateValueOperand(value, instruction);
    }
  }

  private validateLoadArray(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, array, and index');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const array = instruction.operands[1] as ILValue;
      const index = instruction.operands[2] as ILValue;

      this.validateValueOperand(array, instruction);
      this.validateValueOperand(index, instruction);

      // Index should be numeric
      this.validateNumericOperand(index, instruction, 'array index');
    }
  }

  private validateStoreArray(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'array, index, and value');

    if (instruction.operands.length >= 3) {
      const array = instruction.operands[0] as ILValue;
      const index = instruction.operands[1] as ILValue;
      const value = instruction.operands[2] as ILValue;

      this.validateValueOperand(array, instruction);
      this.validateValueOperand(index, instruction);
      this.validateValueOperand(value, instruction);

      // Index should be numeric
      this.validateNumericOperand(index, instruction, 'array index');
    }
  }

  private validateArrayAddress(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 3, 'destination, array, and index');

    if (instruction.operands.length >= 3) {
      const dest = instruction.operands[0] as ILValue;
      const array = instruction.operands[1] as ILValue;
      const index = instruction.operands[2] as ILValue;

      this.validateValueOperand(array, instruction);
      this.validateValueOperand(index, instruction);

      // Index should be numeric
      this.validateNumericOperand(index, instruction, 'array index');
    }
  }

  private validateLabel(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'label name');

    if (instruction.operands.length >= 1) {
      const label = instruction.operands[0] as ILValue;

      if (!isILLabel(label)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `LABEL requires label, got ${label.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateNop(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 0, 'no operands');
  }

  private validateComment(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'comment text');

    if (instruction.operands.length >= 1) {
      const comment = instruction.operands[0] as ILValue;

      if (!isILConstant(comment)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `COMMENT requires constant string, got ${comment.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validate6502MemoryOperation(instruction: ILInstruction): void {
    if (instruction.type === ILInstructionType.PEEK) {
      this.validateOperandCount(instruction, 2, 'destination and address');
    } else {
      this.validateOperandCount(instruction, 2, 'address and value');
    }

    if (instruction.operands.length >= 2) {
      if (instruction.type === ILInstructionType.PEEK) {
        const dest = instruction.operands[0] as ILValue;
        const address = instruction.operands[1] as ILValue;
        this.validateMemoryAddress(address, instruction);
      } else {
        const address = instruction.operands[0] as ILValue;
        const value = instruction.operands[1] as ILValue;
        this.validateMemoryAddress(address, instruction);
        this.validateValueOperand(value, instruction);
      }
    }
  }

  private validateRegisterOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 2, 'register and operation', true); // Variable operand count

    if (instruction.operands.length >= 2) {
      const register = instruction.operands[0] as ILValue;
      const operation = instruction.operands[1] as ILValue;

      if (!isILRegister(register)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `REGISTER_OP requires register, got ${register.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }

      if (!isILConstant(operation)) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_TYPE,
          ILValidationSeverity.ERROR,
          `REGISTER_OP requires constant operation, got ${operation.valueType}`,
          instruction.sourceLocation,
          instruction.id
        );
      }

      // Validate optional operand
      if (instruction.operands.length > 2) {
        this.validateValueOperand(instruction.operands[2] as ILValue, instruction);
      }
    }
  }

  private validateFlagOperation(instruction: ILInstruction): void {
    this.validateOperandCount(instruction, 1, 'flags');

    if (instruction.operands.length >= 1) {
      const flags = instruction.operands[0] as ILValue;
      this.validateValueOperand(flags, instruction);
    }
  }

  // ============================================================================
  // HELPER VALIDATION METHODS
  // ============================================================================

  private validateOperandCount(
    instruction: ILInstruction,
    expectedCount: number,
    description: string,
    allowVariable: boolean = false
  ): void {
    if (allowVariable) {
      if (instruction.operands.length < expectedCount) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_COUNT,
          ILValidationSeverity.ERROR,
          `Expected at least ${expectedCount} operands (${description}), got ${instruction.operands.length}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    } else {
      if (instruction.operands.length !== expectedCount) {
        this.addError(
          ILValidationErrorType.INVALID_OPERAND_COUNT,
          ILValidationSeverity.ERROR,
          `Expected ${expectedCount} operands (${description}), got ${instruction.operands.length}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateValueOperand(operand: ILValue, instruction: ILInstruction): void {
    // Basic validation that operand is a valid IL value
    if (!operand || !operand.valueType) {
      this.addError(
        ILValidationErrorType.INVALID_OPERAND_TYPE,
        ILValidationSeverity.ERROR,
        `Invalid operand: missing value type`,
        instruction.sourceLocation,
        instruction.id
      );
    }
  }

  private validateMemoryAddress(address: ILValue, instruction: ILInstruction): void {
    // Memory address can be constant, variable, or calculated
    this.validateValueOperand(address, instruction);

    // Additional validation for memory addresses
    if (isILConstant(address)) {
      const constant = address as ILConstant;
      if (typeof constant.value === 'number') {
        if (constant.value < 0 || constant.value > 0xffff) {
          this.addError(
            ILValidationErrorType.INVALID_OPERAND_TYPE,
            ILValidationSeverity.WARNING,
            `Memory address ${constant.value} outside 16-bit range`,
            instruction.sourceLocation,
            instruction.id
          );
        }
      }
    }
  }

  private validateNumericOperand(
    operand: ILValue,
    instruction: ILInstruction,
    context: string
  ): void {
    this.validateValueOperand(operand, instruction);

    if (isILConstant(operand)) {
      const constant = operand as ILConstant;
      if (typeof constant.value !== 'number') {
        this.addError(
          ILValidationErrorType.TYPE_MISMATCH,
          ILValidationSeverity.ERROR,
          `${context} must be numeric, got ${typeof constant.value}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateBooleanOperand(
    operand: ILValue,
    instruction: ILInstruction,
    context: string
  ): void {
    this.validateValueOperand(operand, instruction);

    if (isILConstant(operand)) {
      const constant = operand as ILConstant;
      if (typeof constant.value !== 'boolean') {
        this.addError(
          ILValidationErrorType.TYPE_MISMATCH,
          ILValidationSeverity.ERROR,
          `${context} must be boolean, got ${typeof constant.value}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateIntegerOperand(
    operand: ILValue,
    instruction: ILInstruction,
    context: string = 'operand'
  ): void {
    this.validateValueOperand(operand, instruction);

    if (isILConstant(operand)) {
      const constant = operand as ILConstant;
      if (typeof constant.value !== 'number' || !Number.isInteger(constant.value)) {
        this.addError(
          ILValidationErrorType.TYPE_MISMATCH,
          ILValidationSeverity.ERROR,
          `${context} must be integer, got ${typeof constant.value}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private validateBranchTarget(label: ILLabel, instruction: ILInstruction): void {
    // Check if label exists in current function
    if (this.context.currentFunction && !this.context.functionLabels.has(label.name)) {
      this.addError(
        ILValidationErrorType.INVALID_BRANCH_TARGET,
        ILValidationSeverity.ERROR,
        `Undefined label: ${label.name}`,
        instruction.sourceLocation,
        instruction.id
      );
    }
  }

  private validate6502Hints(instruction: ILInstruction): void {
    const hints = instruction.sixtyTwoHints!;

    if (hints.preferredRegister) {
      // Validate register is valid 6502 register
      const validRegisters: Register6502[] = ['A', 'X', 'Y', 'AX', 'XY'];
      if (!validRegisters.includes(hints.preferredRegister)) {
        this.addError(
          ILValidationErrorType.INVALID_REGISTER_USAGE,
          ILValidationSeverity.WARNING,
          `Invalid 6502 register hint: ${hints.preferredRegister}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }

    if (hints.estimatedCycles !== undefined && hints.estimatedCycles < 0) {
      this.addError(
        ILValidationErrorType.INVALID_OPERAND_TYPE,
        ILValidationSeverity.WARNING,
        `Invalid cycle estimate: ${hints.estimatedCycles}`,
        instruction.sourceLocation,
        instruction.id
      );
    }
  }

  // ============================================================================
  // TYPE COMPATIBILITY METHODS
  // ============================================================================

  private areTypesCompatible(left: ILValue, right: ILValue): boolean {
    // Simple type compatibility check
    if (isILConstant(left) && isILConstant(right)) {
      const leftConst = left as ILConstant;
      const rightConst = right as ILConstant;
      return this.areBlend65TypesCompatible(leftConst.type, rightConst.type);
    }

    if (isILVariable(left) && isILVariable(right)) {
      const leftVar = left as ILVariable;
      const rightVar = right as ILVariable;
      return this.areBlend65TypesCompatible(leftVar.type, rightVar.type);
    }

    if (isILTemporary(left) && isILTemporary(right)) {
      const leftTemp = left as ILTemporary;
      const rightTemp = right as ILTemporary;
      return this.areBlend65TypesCompatible(leftTemp.type, rightTemp.type);
    }

    // Different value types are generally not compatible
    return false;
  }

  private areBlend65TypesCompatible(left: Blend65Type, right: Blend65Type): boolean {
    if (left.kind !== right.kind) {
      // Allow some implicit conversions
      if (left.kind === 'primitive' && right.kind === 'primitive') {
        const leftPrim = left as PrimitiveType;
        const rightPrim = right as PrimitiveType;

        // byte and word are compatible
        if (
          (leftPrim.name === 'byte' && rightPrim.name === 'word') ||
          (leftPrim.name === 'word' && rightPrim.name === 'byte')
        ) {
          return true;
        }
      }
      return false;
    }

    if (left.kind === 'primitive') {
      const leftPrim = left as PrimitiveType;
      const rightPrim = right as PrimitiveType;
      return leftPrim.name === rightPrim.name;
    }

    return true; // For now, assume other types are compatible
  }

  private isBooleanType(value: ILValue): boolean {
    if (isILConstant(value)) {
      const constant = value as ILConstant;
      return (
        constant.type.kind === 'primitive' && (constant.type as PrimitiveType).name === 'boolean'
      );
    }

    if (isILVariable(value)) {
      const variable = value as ILVariable;
      return (
        variable.type.kind === 'primitive' && (variable.type as PrimitiveType).name === 'boolean'
      );
    }

    if (isILTemporary(value)) {
      const temporary = value as ILTemporary;
      return (
        temporary.type.kind === 'primitive' && (temporary.type as PrimitiveType).name === 'boolean'
      );
    }

    return false;
  }

  private isVoidType(type: Blend65Type): boolean {
    return type.kind === 'primitive' && (type as PrimitiveType).name === 'void';
  }

  private getValueTypeString(value: ILValue): string {
    if (isILConstant(value)) {
      const constant = value as ILConstant;
      return `${constant.type.kind}:${constant.type.kind === 'primitive' ? (constant.type as PrimitiveType).name : 'complex'}`;
    }

    if (isILVariable(value)) {
      const variable = value as ILVariable;
      return `${variable.type.kind}:${variable.type.kind === 'primitive' ? (variable.type as PrimitiveType).name : 'complex'}`;
    }

    if (isILTemporary(value)) {
      const temporary = value as ILTemporary;
      return `${temporary.type.kind}:${temporary.type.kind === 'primitive' ? (temporary.type as PrimitiveType).name : 'complex'}`;
    }

    return value.valueType;
  }

  // ============================================================================
  // VARIABLE LIFECYCLE METHODS
  // ============================================================================

  private addVariableDefinition(
    variable: ILVariable,
    instructionId: number,
    isInitialized: boolean
  ): void {
    const definition: VariableDefinition = {
      name: variable.name,
      type: variable.type,
      scope: variable.scope,
      definedAt: instructionId,
      isInitialized,
    };

    this.context.definedVariables.set(variable.name, definition);
    this.context.statistics.variablesValidated++;
  }

  private validateVariableAccess(
    variable: ILVariable,
    instructionId: number,
    isWrite: boolean
  ): void {
    const definition = this.context.definedVariables.get(variable.name);

    if (!definition) {
      this.addError(
        ILValidationErrorType.UNDEFINED_VARIABLE,
        ILValidationSeverity.ERROR,
        `Variable '${variable.name}' used before declaration`,
        undefined,
        instructionId
      );
      return;
    }

    if (!isWrite && !definition.isInitialized) {
      this.addError(
        ILValidationErrorType.VARIABLE_USED_BEFORE_DEFINED,
        ILValidationSeverity.WARNING,
        `Variable '${variable.name}' used before initialization`,
        undefined,
        instructionId
      );
    }

    if (isWrite) {
      definition.isInitialized = true;
    }

    definition.lastUsedAt = instructionId;
  }

  // ============================================================================
  // CONTEXT MANAGEMENT METHODS
  // ============================================================================

  private createValidationContext(): ILValidationContext {
    return {
      currentModule: {} as ILModule,
      currentFunction: null,
      definedVariables: new Map(),
      activeTemporaries: new Map(),
      functionLabels: new Map(),
      registerUsage: new Map(),
      controlFlowGraph: {
        entryBlock: 0,
        exitBlocks: [],
        blocks: [],
        edges: [],
      },
      currentBlock: 0,
      reachableInstructions: new Set(),
      errors: [],
      warnings: [],
      info: [],
      statistics: {
        totalInstructions: 0,
        totalFunctions: 0,
        totalModules: 0,
        instructionsByType: new Map(),
        variablesValidated: 0,
        temporariesValidated: 0,
        controlFlowPaths: 0,
      },
    };
  }

  private resetFunctionContext(): void {
    this.context.definedVariables.clear();
    this.context.activeTemporaries.clear();
    this.context.functionLabels.clear();
    this.context.registerUsage.clear();
    this.context.reachableInstructions.clear();
    this.context.currentBlock = 0;
  }

  private buildFunctionLabels(func: ILFunction): void {
    // Build map of labels to instruction indices
    for (let i = 0; i < func.instructions.length; i++) {
      const instruction = func.instructions[i];
      if (instruction.type === ILInstructionType.LABEL && instruction.operands.length > 0) {
        const label = instruction.operands[0] as ILLabel;
        this.context.functionLabels.set(label.name, i);
      }
    }

    // Also include function's label map
    for (const [labelName, instructionIndex] of func.labels) {
      this.context.functionLabels.set(labelName, instructionIndex);
    }
  }

  private validateFunctionSignature(func: ILFunction): void {
    // Validate function name
    if (!func.name || func.name.trim().length === 0) {
      this.addError(
        ILValidationErrorType.INVALID_FUNCTION_CALL,
        ILValidationSeverity.ERROR,
        `Function has invalid name: '${func.name}'`,
        func.sourceLocation
      );
    }

    // Validate return type
    if (!func.returnType) {
      this.addError(
        ILValidationErrorType.INVALID_RETURN_TYPE,
        ILValidationSeverity.ERROR,
        `Function '${func.name}' has no return type`,
        func.sourceLocation
      );
    }
  }

  private validateFunctionParameters(func: ILFunction): void {
    for (let i = 0; i < func.parameters.length; i++) {
      const param = func.parameters[i];

      if (param.index !== i) {
        this.addError(
          ILValidationErrorType.PARAMETER_COUNT_MISMATCH,
          ILValidationSeverity.ERROR,
          `Parameter '${param.name}' has incorrect index: expected ${i}, got ${param.index}`,
          func.sourceLocation
        );
      }
    }
  }

  private validateLocalVariables(func: ILFunction): void {
    // Add parameters to variable scope
    for (const param of func.parameters) {
      const variable: ILVariable = {
        valueType: 'variable',
        name: param.name,
        qualifiedName: [],
        type: param.type,
        storageClass: null,
        scope: 'local',
      };

      this.addVariableDefinition(variable, 0, true); // Parameters are always initialized
    }
  }

  private performControlFlowAnalysis(func: ILFunction): void {
    // Basic control flow analysis
    this.context.reachableInstructions.clear();
    this.analyzeReachability(func, 0); // Start from first instruction

    // Check for unreachable code
    for (let i = 0; i < func.instructions.length; i++) {
      if (!this.context.reachableInstructions.has(i)) {
        const instruction = func.instructions[i];
        this.addError(
          ILValidationErrorType.UNREACHABLE_CODE,
          ILValidationSeverity.WARNING,
          `Unreachable code at instruction ${i}`,
          instruction.sourceLocation,
          instruction.id
        );
      }
    }
  }

  private analyzeReachability(func: ILFunction, startIndex: number): void {
    const visited = new Set<number>();
    const toVisit = [startIndex];

    while (toVisit.length > 0) {
      const index = toVisit.pop()!;

      if (visited.has(index) || index >= func.instructions.length) {
        continue;
      }

      visited.add(index);
      this.context.reachableInstructions.add(index);

      const instruction = func.instructions[index];

      // Analyze control flow
      switch (instruction.type) {
        case ILInstructionType.BRANCH:
          // Unconditional branch
          const target = this.resolveBranchTarget(instruction.operands[0] as ILLabel);
          if (target >= 0) {
            toVisit.push(target);
          }
          break;

        case ILInstructionType.BRANCH_IF_TRUE:
        case ILInstructionType.BRANCH_IF_FALSE:
        case ILInstructionType.BRANCH_IF_ZERO:
        case ILInstructionType.BRANCH_IF_NOT_ZERO:
          // Conditional branch - both paths possible
          const conditionalTarget = this.resolveBranchTarget(instruction.operands[1] as ILLabel);
          if (conditionalTarget >= 0) {
            toVisit.push(conditionalTarget);
          }
          toVisit.push(index + 1); // Fall through
          break;

        case ILInstructionType.RETURN:
          // Return terminates flow
          break;

        default:
          // Normal instruction - continue to next
          toVisit.push(index + 1);
          break;
      }
    }
  }

  private resolveBranchTarget(label: ILLabel): number {
    return this.context.functionLabels.get(label.name) ?? -1;
  }

  private validateVariableLifecycle(func: ILFunction): void {
    // Check for variables that are defined but never used
    for (const [varName, definition] of this.context.definedVariables) {
      if (!definition.lastUsedAt) {
        this.addError(
          ILValidationErrorType.UNDEFINED_VARIABLE,
          ILValidationSeverity.WARNING,
          `Variable '${varName}' is defined but never used`,
          undefined,
          definition.definedAt
        );
      }
    }
  }

  private validateGlobalData(globalData: any[]): void {
    // Validate global data declarations
    this.context.statistics.variablesValidated += globalData.length;
  }

  private validateImportsExports(imports: any[], exports: any[]): void {
    // Validate import/export declarations
    // This is a placeholder for now
  }

  private validateModuleData(moduleData: any[]): void {
    // Validate module data declarations
    this.context.statistics.variablesValidated += moduleData.length;
  }

  private updateInstructionStatistics(instruction: ILInstruction): void {
    // Update instruction type statistics
    const currentCount = this.context.statistics.instructionsByType.get(instruction.type) || 0;
    this.context.statistics.instructionsByType.set(instruction.type, currentCount + 1);
  }

  private addError(
    type: ILValidationErrorType,
    severity: ILValidationSeverity,
    message: string,
    sourceLocation?: SourcePosition,
    instructionId?: number,
    context?: ValidationErrorContext
  ): void {
    const error: ILValidationError = {
      type,
      severity,
      message,
      sourceLocation,
      instructionId,
      functionName: this.context.currentFunction?.name,
      moduleName: this.context.currentModule?.qualifiedName?.join('.'),
      context,
    };

    if (severity === ILValidationSeverity.ERROR) {
      this.context.errors.push(error);
    } else if (severity === ILValidationSeverity.WARNING) {
      this.context.warnings.push(error);
    } else {
      this.context.info.push(error);
    }
  }

  private createValidationResult(): ILValidationResult {
    return {
      isValid: this.context.errors.length === 0,
      errors: [...this.context.errors],
      warnings: [...this.context.warnings],
      info: [...this.context.info],
      statistics: {
        totalInstructions: this.context.statistics.totalInstructions,
        totalFunctions: this.context.statistics.totalFunctions,
        totalModules: this.context.statistics.totalModules,
        instructionsByType: new Map(this.context.statistics.instructionsByType),
        variablesValidated: this.context.statistics.variablesValidated,
        temporariesValidated: this.context.statistics.temporariesValidated,
        controlFlowPaths: this.context.statistics.controlFlowPaths,
      },
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new IL validator instance.
 */
export function createILValidator(): ILValidator {
  return new ILValidator();
}

/**
 * Validate an IL program and return detailed results.
 * Convenience function for one-shot validation.
 */
export function validateILProgram(program: ILProgram): ILValidationResult {
  const validator = createILValidator();
  return validator.validateProgram(program);
}

/**
 * Validate an IL module and return detailed results.
 * Convenience function for module-level validation.
 */
export function validateILModule(module: ILModule): ILValidationResult {
  const validator = createILValidator();
  return validator.validateModule(module);
}

/**
 * Validate an IL function and return detailed results.
 * Convenience function for function-level validation.
 */
export function validateILFunction(func: ILFunction): ILValidationResult {
  const validator = createILValidator();
  return validator.validateFunction(func);
}
