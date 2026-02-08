/**
 * IL Validator - validates IL for correctness before code generation
 *
 * Performs comprehensive validation of IL structures including:
 * - Type checking
 * - CFG integrity
 * - SSA properties
 * - Terminator verification
 *
 * @module il/validator
 */

import { BasicBlock } from './basic-block.js';
import { ILFunction } from './function.js';
import { ILModule } from './module.js';
import { typesEqual, typeToString, ILTypeKind } from './types.js';
import {
  ILOpcode,
  ILInstruction,
  ILBinaryInstruction,
  ILUnaryInstruction,
  ILConstInstruction,
  ILConvertInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILPhiInstruction,
  ILCallInstruction,
} from './instructions.js';

/**
 * Validation error with location information.
 */
export interface ValidationError {
  /** Error message */
  message: string;

  /** Error severity */
  severity: 'error' | 'warning';

  /** Module name (if applicable) */
  module?: string;

  /** Function name (if applicable) */
  function?: string;

  /** Block label (if applicable) */
  block?: string;

  /** Instruction ID (if applicable) */
  instructionId?: number;
}

/**
 * Validation result containing all errors and warnings.
 */
export interface ValidationResult {
  /** Whether validation passed (no errors, warnings ok) */
  valid: boolean;

  /** All validation errors */
  errors: ValidationError[];

  /** All validation warnings */
  warnings: ValidationError[];
}

/**
 * Options for controlling validation behavior.
 */
export interface ValidatorOptions {
  /** Check that all blocks have terminators */
  checkTerminators?: boolean;

  /** Check CFG consistency (predecessors/successors) */
  checkCFG?: boolean;

  /** Check type correctness */
  checkTypes?: boolean;

  /** Check SSA properties (single definition) */
  checkSSA?: boolean;

  /** Check for unreachable code */
  checkReachability?: boolean;

  /** Check phi instruction correctness */
  checkPhi?: boolean;

  /** Check that all used registers are defined */
  checkDefinedBeforeUse?: boolean;
}

/**
 * Default validator options - all checks enabled.
 */
const DEFAULT_OPTIONS: Required<ValidatorOptions> = {
  checkTerminators: true,
  checkCFG: true,
  checkTypes: true,
  checkSSA: true,
  checkReachability: true,
  checkPhi: true,
  checkDefinedBeforeUse: true,
};

/**
 * IL Validator for checking correctness of IL structures.
 *
 * @example
 * ```typescript
 * const validator = new ILValidator();
 * const result = validator.validateModule(module);
 *
 * if (!result.valid) {
 *   for (const error of result.errors) {
 *     console.error(`[${error.function}] ${error.message}`);
 *   }
 * }
 * ```
 */
export class ILValidator {
  /** Validator options */
  protected readonly options: Required<ValidatorOptions>;

  /** Accumulated errors */
  protected errors: ValidationError[] = [];

  /** Accumulated warnings */
  protected warnings: ValidationError[] = [];

  /** Current context for error reporting */
  protected currentModule: string = '';
  protected currentFunction: string = '';
  protected currentBlock: string = '';

  /**
   * Creates a new IL validator.
   *
   * @param options - Validator options
   */
  constructor(options: ValidatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Module Validation
  // ===========================================================================

  /**
   * Validates an entire IL module.
   *
   * @param module - Module to validate
   * @returns Validation result
   */
  validateModule(module: ILModule): ValidationResult {
    this.reset();
    this.currentModule = module.name;

    // Validate all functions
    for (const func of module.getFunctions()) {
      this.validateFunction(func);
    }

    // Check entry point exists if set
    const entryName = module.getEntryPointName();
    if (entryName && !module.hasFunction(entryName)) {
      this.addError(`Entry point function '${entryName}' not found`);
    }

    // Check exports reference existing symbols
    for (const exp of module.getExports()) {
      if (exp.kind === 'function' && !module.hasFunction(exp.localName)) {
        this.addError(`Export '${exp.exportedName}' references unknown function '${exp.localName}'`);
      }
      if (exp.kind === 'variable' && !module.hasGlobal(exp.localName)) {
        this.addError(`Export '${exp.exportedName}' references unknown global '${exp.localName}'`);
      }
    }

    return this.getResult();
  }

  // ===========================================================================
  // Function Validation
  // ===========================================================================

  /**
   * Validates a single function.
   *
   * @param func - Function to validate
   * @returns Validation result
   */
  validateFunction(func: ILFunction): ValidationResult {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.reset();
    }
    this.currentFunction = func.name;

    // Track defined registers for use-before-def checking
    const definedRegisters = new Set<number>();

    // Add parameter registers as defined
    for (const reg of func.getParameterRegisters()) {
      definedRegisters.add(reg.id);
    }

    // Check entry block exists
    try {
      func.getEntryBlock();
    } catch {
      this.addError('Function has no entry block');
      return this.getResult();
    }

    // Validate each block
    for (const block of func.getBlocks()) {
      this.validateBlock(block, func, definedRegisters);
    }

    // Check CFG consistency
    if (this.options.checkCFG) {
      this.validateCFG(func);
    }

    // Check reachability
    if (this.options.checkReachability) {
      this.checkReachability(func);
    }

    return this.getResult();
  }

  // ===========================================================================
  // Block Validation
  // ===========================================================================

  /**
   * Validates a single basic block.
   *
   * @param block - Block to validate
   * @param func - Containing function
   * @param definedRegisters - Set of defined register IDs
   */
  protected validateBlock(
    block: BasicBlock,
    func: ILFunction,
    definedRegisters: Set<number>,
  ): void {
    this.currentBlock = block.label;

    const instructions = block.getInstructions();

    // Check terminator
    if (this.options.checkTerminators) {
      if (instructions.length === 0) {
        this.addError('Block has no instructions');
      } else if (!block.hasTerminator()) {
        this.addError('Block does not end with a terminator');
      }
    }

    // Check phi instructions are at start
    if (this.options.checkPhi) {
      let seenNonPhi = false;
      for (const inst of instructions) {
        if (inst.opcode === ILOpcode.PHI) {
          if (seenNonPhi) {
            this.addError('Phi instruction found after non-phi instruction', inst.id);
          }
          this.validatePhi(inst as ILPhiInstruction, block, func);
        } else {
          seenNonPhi = true;
        }
      }
    }

    // Validate each instruction
    for (const inst of instructions) {
      this.validateInstruction(inst, block, definedRegisters);

      // Track defined registers
      if (inst.result) {
        if (this.options.checkSSA && definedRegisters.has(inst.result.id)) {
          this.addWarning(`Register ${inst.result} defined multiple times (SSA violation)`, inst.id);
        }
        definedRegisters.add(inst.result.id);
      }
    }
  }

  // ===========================================================================
  // Instruction Validation
  // ===========================================================================

  /**
   * Validates a single instruction.
   *
   * @param inst - Instruction to validate
   * @param block - Containing block
   * @param definedRegisters - Set of defined register IDs
   */
  protected validateInstruction(
    inst: ILInstruction,
    block: BasicBlock,
    definedRegisters: Set<number>,
  ): void {
    // Check use-before-def
    if (this.options.checkDefinedBeforeUse) {
      for (const reg of inst.getUsedRegisters()) {
        if (!definedRegisters.has(reg.id)) {
          this.addError(`Register ${reg} used before definition`, inst.id);
        }
      }
    }

    // Type checking
    if (this.options.checkTypes) {
      this.validateInstructionTypes(inst);
    }

    // Terminator cannot be in middle of block
    if (inst.isTerminator()) {
      const instructions = block.getInstructions();
      const lastInst = instructions[instructions.length - 1];
      if (inst !== lastInst) {
        this.addError('Terminator instruction found in middle of block', inst.id);
      }
    }
  }

  /**
   * Validates instruction type correctness.
   *
   * @param inst - Instruction to validate
   */
  protected validateInstructionTypes(inst: ILInstruction): void {
    switch (inst.opcode) {
      case ILOpcode.ADD:
      case ILOpcode.SUB:
      case ILOpcode.MUL:
      case ILOpcode.DIV:
      case ILOpcode.MOD:
      case ILOpcode.AND:
      case ILOpcode.OR:
      case ILOpcode.XOR:
      case ILOpcode.SHL:
      case ILOpcode.SHR:
        this.validateBinaryArithmetic(inst as ILBinaryInstruction);
        break;

      case ILOpcode.CMP_EQ:
      case ILOpcode.CMP_NE:
      case ILOpcode.CMP_LT:
      case ILOpcode.CMP_LE:
      case ILOpcode.CMP_GT:
      case ILOpcode.CMP_GE:
        this.validateComparison(inst as ILBinaryInstruction);
        break;

      case ILOpcode.NEG:
      case ILOpcode.NOT:
        this.validateUnaryArithmetic(inst as ILUnaryInstruction);
        break;

      case ILOpcode.LOGICAL_NOT:
        this.validateLogicalNot(inst as ILUnaryInstruction);
        break;

      case ILOpcode.ZERO_EXTEND:
      case ILOpcode.TRUNCATE:
        this.validateConversion(inst as ILConvertInstruction);
        break;

      case ILOpcode.RETURN:
        this.validateReturn(inst as ILReturnInstruction);
        break;

      case ILOpcode.BRANCH:
        this.validateBranch(inst as ILBranchInstruction);
        break;

      case ILOpcode.CALL:
        this.validateCall(inst as ILCallInstruction);
        break;

      case ILOpcode.CONST:
        this.validateConst(inst as ILConstInstruction);
        break;
    }
  }

  /**
   * Validates binary arithmetic instruction types.
   */
  protected validateBinaryArithmetic(inst: ILBinaryInstruction): void {
    // Operands must have same type
    if (!typesEqual(inst.left.type, inst.right.type)) {
      this.addError(
        `Binary operation type mismatch: ${typeToString(inst.left.type)} vs ${typeToString(inst.right.type)}`,
        inst.id,
      );
    }

    // Result must match operand type
    if (inst.result && !typesEqual(inst.result.type, inst.left.type)) {
      this.addError(
        `Binary operation result type mismatch: expected ${typeToString(inst.left.type)}, got ${typeToString(inst.result.type)}`,
        inst.id,
      );
    }
  }

  /**
   * Validates comparison instruction types.
   */
  protected validateComparison(inst: ILBinaryInstruction): void {
    // Operands must have same type
    if (!typesEqual(inst.left.type, inst.right.type)) {
      this.addError(
        `Comparison type mismatch: ${typeToString(inst.left.type)} vs ${typeToString(inst.right.type)}`,
        inst.id,
      );
    }

    // Result must be bool
    if (inst.result && inst.result.type.kind !== ILTypeKind.Bool) {
      this.addError(
        `Comparison result must be bool, got ${typeToString(inst.result.type)}`,
        inst.id,
      );
    }
  }

  /**
   * Validates unary arithmetic instruction types.
   */
  protected validateUnaryArithmetic(inst: ILUnaryInstruction): void {
    // Result must match operand type
    if (inst.result && !typesEqual(inst.result.type, inst.operand.type)) {
      this.addError(
        `Unary operation result type mismatch: expected ${typeToString(inst.operand.type)}, got ${typeToString(inst.result.type)}`,
        inst.id,
      );
    }
  }

  /**
   * Validates logical NOT instruction.
   */
  protected validateLogicalNot(inst: ILUnaryInstruction): void {
    // Result must be bool
    if (inst.result && inst.result.type.kind !== ILTypeKind.Bool) {
      this.addError(
        `Logical NOT result must be bool, got ${typeToString(inst.result.type)}`,
        inst.id,
      );
    }
  }

  /**
   * Validates type conversion instruction.
   */
  protected validateConversion(inst: ILConvertInstruction): void {
    const sourceKind = inst.source.type.kind;
    const targetKind = inst.targetType.kind;

    if (inst.opcode === ILOpcode.ZERO_EXTEND) {
      // byte -> word
      if (sourceKind !== ILTypeKind.Byte) {
        this.addError(`ZERO_EXTEND source must be byte, got ${typeToString(inst.source.type)}`, inst.id);
      }
      if (targetKind !== ILTypeKind.Word) {
        this.addError(`ZERO_EXTEND target must be word, got ${typeToString(inst.targetType)}`, inst.id);
      }
    } else if (inst.opcode === ILOpcode.TRUNCATE) {
      // word -> byte
      if (sourceKind !== ILTypeKind.Word) {
        this.addError(`TRUNCATE source must be word, got ${typeToString(inst.source.type)}`, inst.id);
      }
      if (targetKind !== ILTypeKind.Byte) {
        this.addError(`TRUNCATE target must be byte, got ${typeToString(inst.targetType)}`, inst.id);
      }
    }
  }

  /**
   * Validates return instruction.
   */
  protected validateReturn(inst: ILReturnInstruction): void {
    // Value type should match function return type
    // (This would require passing function context, simplified check here)
    if (inst.value.type.kind === ILTypeKind.Void) {
      this.addError('RETURN with void value - use RETURN_VOID instead', inst.id);
    }
  }

  /**
   * Validates branch instruction.
   */
  protected validateBranch(inst: ILBranchInstruction): void {
    // Condition must be comparable to zero
    const condType = inst.condition.type;
    if (condType.kind !== ILTypeKind.Bool && condType.kind !== ILTypeKind.Byte) {
      this.addWarning(
        `Branch condition should be bool or byte, got ${typeToString(condType)}`,
        inst.id,
      );
    }
  }

  /**
   * Validates call instruction.
   */
  protected validateCall(inst: ILCallInstruction): void {
    // Result type check would require function lookup
    // Basic validation: ensure we have a result register
    if (!inst.result) {
      this.addError('CALL instruction missing result register', inst.id);
    }
  }

  /**
   * Validates const instruction.
   */
  protected validateConst(inst: ILConstInstruction): void {
    // Check value fits in type
    const typeKind = inst.type.kind;
    const value = inst.value;

    if (typeKind === ILTypeKind.Byte) {
      if (value < 0 || value > 255) {
        this.addError(`Byte constant ${value} out of range [0, 255]`, inst.id);
      }
    } else if (typeKind === ILTypeKind.Word) {
      if (value < 0 || value > 65535) {
        this.addError(`Word constant ${value} out of range [0, 65535]`, inst.id);
      }
    } else if (typeKind === ILTypeKind.Bool) {
      if (value !== 0 && value !== 1) {
        this.addWarning(`Bool constant ${value} should be 0 or 1`, inst.id);
      }
    }
  }

  // ===========================================================================
  // Phi Validation
  // ===========================================================================

  /**
   * Validates a phi instruction.
   */
  protected validatePhi(inst: ILPhiInstruction, block: BasicBlock, func: ILFunction): void {
    const predecessors = block.getPredecessors();
    const predIds = new Set(predecessors.map((p) => p.id));

    // Check that phi has entry for each predecessor
    for (const pred of predecessors) {
      const source = inst.sources.find((s) => s.blockId === pred.id);
      if (!source) {
        this.addError(`Phi missing entry for predecessor block '${pred.label}'`, inst.id);
      }
    }

    // Check that all phi sources reference actual predecessors
    for (const source of inst.sources) {
      if (!predIds.has(source.blockId)) {
        const sourceBlock = func.getBlock(source.blockId);
        const blockName = sourceBlock?.label ?? `block#${source.blockId}`;
        this.addError(`Phi references non-predecessor block '${blockName}'`, inst.id);
      }
    }

    // Check that all source values have same type as result
    if (inst.result) {
      for (const source of inst.sources) {
        if (!typesEqual(source.value.type, inst.result.type)) {
          this.addError(
            `Phi source type ${typeToString(source.value.type)} doesn't match result type ${typeToString(inst.result.type)}`,
            inst.id,
          );
        }
      }
    }
  }

  // ===========================================================================
  // CFG Validation
  // ===========================================================================

  /**
   * Validates CFG consistency.
   */
  protected validateCFG(func: ILFunction): void {
    for (const block of func.getBlocks()) {
      // Check successor/predecessor consistency
      for (const succ of block.getSuccessors()) {
        if (!succ.hasPredecessor(block)) {
          this.addError(
            `CFG inconsistency: ${block.label} -> ${succ.label}, but ${succ.label} ` +
              `doesn't have ${block.label} as predecessor`,
          );
        }
      }

      for (const pred of block.getPredecessors()) {
        if (!pred.hasSuccessor(block)) {
          this.addError(
            `CFG inconsistency: ${pred.label} <- ${block.label}, but ${pred.label} ` +
              `doesn't have ${block.label} as successor`,
          );
        }
      }
    }
  }

  /**
   * Checks for unreachable blocks.
   */
  protected checkReachability(func: ILFunction): void {
    const unreachable = func.getUnreachableBlocks();
    for (const block of unreachable) {
      this.addWarning(`Block '${block.label}' is unreachable`);
    }
  }

  // ===========================================================================
  // Error Management
  // ===========================================================================

  /**
   * Resets the validator state.
   */
  protected reset(): void {
    this.errors = [];
    this.warnings = [];
    this.currentModule = '';
    this.currentFunction = '';
    this.currentBlock = '';
  }

  /**
   * Adds an error.
   */
  protected addError(message: string, instructionId?: number): void {
    this.errors.push({
      message,
      severity: 'error',
      module: this.currentModule || undefined,
      function: this.currentFunction || undefined,
      block: this.currentBlock || undefined,
      instructionId,
    });
  }

  /**
   * Adds a warning.
   */
  protected addWarning(message: string, instructionId?: number): void {
    this.warnings.push({
      message,
      severity: 'warning',
      module: this.currentModule || undefined,
      function: this.currentFunction || undefined,
      block: this.currentBlock || undefined,
      instructionId,
    });
  }

  /**
   * Gets the validation result.
   */
  protected getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }
}

// ===========================================================================
// Convenience Functions
// ===========================================================================

/**
 * Validates an IL module with default options.
 *
 * @param module - Module to validate
 * @returns Validation result
 */
export function validateModule(module: ILModule): ValidationResult {
  return new ILValidator().validateModule(module);
}

/**
 * Validates an IL function with default options.
 *
 * @param func - Function to validate
 * @returns Validation result
 */
export function validateFunction(func: ILFunction): ValidationResult {
  return new ILValidator().validateFunction(func);
}

/**
 * Formats validation errors for display.
 *
 * @param result - Validation result
 * @returns Formatted error string
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  for (const error of result.errors) {
    const location = [error.module, error.function, error.block]
      .filter(Boolean)
      .join('/');
    const instStr = error.instructionId !== undefined ? ` [inst#${error.instructionId}]` : '';
    lines.push(`ERROR [${location}]${instStr}: ${error.message}`);
  }

  for (const warning of result.warnings) {
    const location = [warning.module, warning.function, warning.block]
      .filter(Boolean)
      .join('/');
    const instStr = warning.instructionId !== undefined ? ` [inst#${warning.instructionId}]` : '';
    lines.push(`WARNING [${location}]${instStr}: ${warning.message}`);
  }

  return lines.join('\n');
}