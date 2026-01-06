/**
 * Expression and Statement Analysis Implementation
 * Task 1.7: Expression and Statement Analysis Implementation
 *
 * This analyzer provides comprehensive expression and statement validation with
 * maximum optimization metadata collection for human-level peephole optimization.
 *
 * Optimization Intelligence Focus:
 * - Collect all data a human 6502 expert would use for manual optimization
 * - Variable usage patterns for zero page promotion decisions
 * - Expression complexity metrics for inlining decisions
 * - Constant folding opportunities identification
 * - Side effect analysis for code motion optimization
 * - Register allocation hints based on usage patterns
 * - Loop context awareness for optimization decisions
 * - Hardware interaction patterns for 6502-specific optimizations
 *
 * Educational Focus:
 * - How compilers collect optimization metadata during semantic analysis
 * - Expression tree traversal patterns for analysis
 * - Side effect detection algorithms
 * - Performance-critical code identification
 * - 6502-specific optimization opportunity recognition
 */

import {
  Expression,
  Statement,
  BinaryExpr,
  UnaryExpr,
  AssignmentExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  Identifier,
  Literal,
  ArrayLiteral,
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
  ExpressionStatement,
  MatchStatement,
} from '@blend65/ast';

import { SourcePosition } from '@blend65/lexer';

import {
  Blend65Type,
  SemanticError,
  VariableSymbol,
  FunctionSymbol,
  isVariableSymbol,
  isFunctionSymbol,
  isAssignmentCompatible,
  typeToString,
  createPrimitiveType,
  isPrimitiveType,
  isArrayType,
  isCallbackType,
  createArrayType,
} from '../types.js';

import { SymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';

// ============================================================================
// BUILT-IN FUNCTIONS SYSTEM
// ============================================================================

/**
 * Built-in function definition for semantic analysis.
 * Defines the signature and behavior of core Blend65 built-in functions.
 */
export interface BuiltInFunctionDefinition {
  /** Function name */
  name: string;
  /** Parameter types in order */
  parameters: BuiltInParameterInfo[];
  /** Return type */
  returnType: Blend65Type;
  /** Whether the function has side effects */
  hasSideEffects: boolean;
  /** Whether the function accesses hardware/memory */
  accessesHardware: boolean;
  /** Function description for error messages */
  description: string;
  /** Platform validation requirements */
  validation?: BuiltInFunctionValidation;
}

/**
 * Built-in function parameter information.
 */
export interface BuiltInParameterInfo {
  name: string;
  type: Blend65Type;
  description: string;
}

/**
 * Validation requirements for built-in functions.
 */
export interface BuiltInFunctionValidation {
  /** Whether address parameters need platform validation */
  requiresAddressValidation?: boolean;
  /** Whether value parameters need range validation */
  requiresValueValidation?: boolean;
  /** Custom validation function */
  customValidation?: (args: Expression[], context: ExpressionContext) => ValidationResult;
}

/**
 * Result of built-in function validation.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: SemanticError[];
  warnings: SemanticError[];
}

/**
 * Registry of all built-in functions in Blend65 v0.1.
 * These functions provide essential memory access capabilities to replace the broken 'io' storage class.
 */
const BUILTIN_FUNCTIONS: Map<string, BuiltInFunctionDefinition> = new Map([
  [
    'peek',
    {
      name: 'peek',
      parameters: [
        {
          name: 'address',
          type: createPrimitiveType('word'),
          description: 'Memory address to read from (0x0000-0xFFFF)',
        },
      ],
      returnType: createPrimitiveType('byte'),
      hasSideEffects: false, // Reading memory is considered non-side-effecting for optimization
      accessesHardware: true,
      description: 'Read 8-bit value from memory address',
      validation: {
        requiresAddressValidation: true,
      },
    },
  ],
  [
    'poke',
    {
      name: 'poke',
      parameters: [
        {
          name: 'address',
          type: createPrimitiveType('word'),
          description: 'Memory address to write to (0x0000-0xFFFF)',
        },
        {
          name: 'value',
          type: createPrimitiveType('byte'),
          description: 'Byte value to write (0-255)',
        },
      ],
      returnType: createPrimitiveType('void'),
      hasSideEffects: true, // Writing memory has side effects
      accessesHardware: true,
      description: 'Write 8-bit value to memory address',
      validation: {
        requiresAddressValidation: true,
        requiresValueValidation: true,
      },
    },
  ],
  [
    'peekw',
    {
      name: 'peekw',
      parameters: [
        {
          name: 'address',
          type: createPrimitiveType('word'),
          description: 'Memory address to read from (0x0000-0xFFFF)',
        },
      ],
      returnType: createPrimitiveType('word'),
      hasSideEffects: false, // Reading memory is considered non-side-effecting for optimization
      accessesHardware: true,
      description: 'Read 16-bit value from memory address (little-endian)',
      validation: {
        requiresAddressValidation: true,
      },
    },
  ],
  [
    'pokew',
    {
      name: 'pokew',
      parameters: [
        {
          name: 'address',
          type: createPrimitiveType('word'),
          description: 'Memory address to write to (0x0000-0xFFFF)',
        },
        {
          name: 'value',
          type: createPrimitiveType('word'),
          description: 'Word value to write (0-65535)',
        },
      ],
      returnType: createPrimitiveType('void'),
      hasSideEffects: true, // Writing memory has side effects
      accessesHardware: true,
      description: 'Write 16-bit value to memory address (little-endian)',
      validation: {
        requiresAddressValidation: true,
        requiresValueValidation: true,
      },
    },
  ],
  [
    'sys',
    {
      name: 'sys',
      parameters: [
        {
          name: 'address',
          type: createPrimitiveType('word'),
          description: 'Machine language routine address to call',
        },
      ],
      returnType: createPrimitiveType('void'),
      hasSideEffects: true, // Calling machine language routines has side effects
      accessesHardware: true, // May access hardware depending on the routine
      description: 'Call machine language routine at specified address',
      validation: {
        requiresAddressValidation: true,
      },
    },
  ],
]);

/**
 * Check if a function name is a built-in function.
 */
export function isBuiltInFunction(name: string): boolean {
  return BUILTIN_FUNCTIONS.has(name);
}

/**
 * Get built-in function definition by name.
 */
export function getBuiltInFunction(name: string): BuiltInFunctionDefinition | undefined {
  return BUILTIN_FUNCTIONS.get(name);
}

/**
 * Get all built-in function names.
 */
export function getAllBuiltInFunctionNames(): string[] {
  return Array.from(BUILTIN_FUNCTIONS.keys());
}

/**
 * Validate a built-in function call.
 */
function validateBuiltInFunctionCall(
  funcDef: BuiltInFunctionDefinition,
  args: Expression[],
  context: ExpressionContext,
  analyzer: ExpressionAnalyzer
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Validate argument count
  if (args.length !== funcDef.parameters.length) {
    result.isValid = false;
    result.errors.push({
      errorType: 'TypeMismatch',
      message: `Built-in function '${funcDef.name}' expects ${funcDef.parameters.length} arguments, got ${args.length}`,
      location: { line: 0, column: 0, offset: 0 },
      suggestions: [
        `${funcDef.name}(${funcDef.parameters.map(p => `${p.name}: ${typeToString(p.type)}`).join(', ')})`,
        funcDef.description,
      ],
    });
    return result;
  }

  // Validate argument types
  for (let i = 0; i < args.length; i++) {
    const argResult = analyzer.analyzeExpression(args[i], context);
    const argType = argResult.resolvedType;
    const expectedType = funcDef.parameters[i].type;

    if (!isAssignmentCompatible(expectedType, argType)) {
      result.isValid = false;
      result.errors.push({
        errorType: 'TypeMismatch',
        message: `Built-in function '${funcDef.name}' parameter '${funcDef.parameters[i].name}': expected '${typeToString(expectedType)}', got '${typeToString(argType)}'`,
        location: args[i].metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: [
          `Expected: ${funcDef.parameters[i].description}`,
          `Use explicit type conversion if needed`,
        ],
      });
    }

    // Also collect any errors from argument analysis
    result.errors.push(...argResult.errors);
    result.warnings.push(...argResult.warnings);
  }

  // Platform-specific validation
  if (funcDef.validation) {
    if (funcDef.validation.requiresAddressValidation && args.length > 0) {
      const addressValidation = validateMemoryAddress(args[0], funcDef.name, context);
      if (!addressValidation.isValid) {
        result.errors.push(...addressValidation.errors);
        result.warnings.push(...addressValidation.warnings);
        result.isValid = result.isValid && addressValidation.isValid;
      }
    }

    if (funcDef.validation.requiresValueValidation && args.length > 1) {
      const valueValidation = validateValueRange(args[1], funcDef.name, funcDef.parameters[1].type);
      if (!valueValidation.isValid) {
        result.errors.push(...valueValidation.errors);
        result.warnings.push(...valueValidation.warnings);
        result.isValid = result.isValid && valueValidation.isValid;
      }
    }

    if (funcDef.validation.customValidation) {
      const customValidation = funcDef.validation.customValidation(args, context);
      result.errors.push(...customValidation.errors);
      result.warnings.push(...customValidation.warnings);
      result.isValid = result.isValid && customValidation.isValid;
    }
  }

  return result;
}

/**
 * Validate memory address for built-in memory access functions.
 * This provides basic range checking and platform-aware warnings.
 */
function validateMemoryAddress(
  addressExpr: Expression,
  functionName: string,
  _context: ExpressionContext
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check for literal addresses that are obviously invalid
  if (addressExpr.type === 'Literal') {
    const literal = addressExpr as Literal;
    if (typeof literal.value === 'number') {
      // Basic range validation for 6502
      if (literal.value < 0 || literal.value > 0xFFFF) {
        result.isValid = false;
        result.errors.push({
          errorType: 'TypeMismatch',
          message: `Invalid memory address ${literal.value} for ${functionName}(). Address must be 0x0000-0xFFFF for 6502.`,
          location: addressExpr.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            'Use a valid 6502 memory address (0x0000-0xFFFF)',
            'Check platform memory map documentation',
          ],
        });
        return result;
      }

      // Platform-specific warnings for common address ranges
      if (literal.value >= 0xD000 && literal.value <= 0xDFFF) {
        result.warnings.push({
          errorType: 'InvalidOperation',
          message: `Address 0x${literal.value.toString(16).toUpperCase()} is in hardware I/O area. Ensure this is intended for ${functionName}().`,
          location: addressExpr.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            'Hardware I/O addresses require careful handling',
            'Consider using platform-specific constants for readability',
          ],
        });
      }

      if (literal.value >= 0xA000 && literal.value <= 0xBFFF) {
        result.warnings.push({
          errorType: 'InvalidOperation',
          message: `Address 0x${literal.value.toString(16).toUpperCase()} may be in BASIC ROM area on C64. Check memory configuration.`,
          location: addressExpr.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            'BASIC ROM area may not be writable depending on memory configuration',
            'Consider using RAM areas for writable data',
          ],
        });
      }
    }
  }

  return result;
}

/**
 * Validate value range for built-in functions.
 */
function validateValueRange(
  valueExpr: Expression,
  functionName: string,
  expectedType: Blend65Type
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check for literal values that are out of range
  if (valueExpr.type === 'Literal') {
    const literal = valueExpr as Literal;
    if (typeof literal.value === 'number') {
      if (isPrimitiveType(expectedType)) {
        if (expectedType.name === 'byte' && (literal.value < 0 || literal.value > 255)) {
          result.isValid = false;
          result.errors.push({
            errorType: 'TypeMismatch',
            message: `Value ${literal.value} is out of range for byte (0-255) in ${functionName}().`,
            location: valueExpr.metadata?.start || { line: 0, column: 0, offset: 0 },
            suggestions: [
              'Use a value in the range 0-255 for byte parameters',
              'Use modulo operator (%) to wrap values if intended',
            ],
          });
        } else if (expectedType.name === 'word' && (literal.value < 0 || literal.value > 65535)) {
          result.isValid = false;
          result.errors.push({
            errorType: 'TypeMismatch',
            message: `Value ${literal.value} is out of range for word (0-65535) in ${functionName}().`,
            location: valueExpr.metadata?.start || { line: 0, column: 0, offset: 0 },
            suggestions: [
              'Use a value in the range 0-65535 for word parameters',
              'Use modulo operator (%) to wrap values if intended',
            ],
          });
        }
      }
    }
  }

  return result;
}

// ============================================================================
// OPTIMIZATION METADATA INTERFACES
// ============================================================================

/**
 * Comprehensive optimization metadata for expressions.
 * Collects all information a human expert would consider for optimization.
 */
export interface ExpressionOptimizationData {
  // Constant analysis
  isConstant: boolean;
  constantValue?: number | boolean | string;
  isCompileTimeConstant: boolean;

  // Variable usage tracking
  usedVariables: VariableReference[];
  hasVariableAccess: boolean;
  variableAccessPattern: VariableAccessPattern;

  // Side effect analysis
  hasSideEffects: boolean;
  sideEffects: SideEffectInfo[];
  isPure: boolean;

  // Performance characteristics
  complexityScore: number;
  estimatedCycles: number;
  registerPressure: RegisterPressureInfo;

  // 6502-specific optimization hints
  sixtyTwoHints: SixtyTwoOptimizationHints;

  // Loop context
  loopInvariant: boolean;
  loopDependent: boolean;
  hotPathCandidate: boolean;

  // Expression tree properties
  depth: number;
  nodeCount: number;
  hasNestedCalls: boolean;
  hasComplexAddressing: boolean;

  // Optimization opportunities
  constantFoldingCandidate: boolean;
  commonSubexpressionCandidate: boolean;
  deadCodeCandidate: boolean;
  cacheCandidate: boolean;
}

/**
 * Variable reference tracking for optimization analysis.
 */
export interface VariableReference {
  symbol: VariableSymbol;
  accessType: VariableAccessType;
  location: SourcePosition;
  context: ExpressionContext;
  indexExpression?: Expression; // For array access
  memberName?: string; // For member access
}

/**
 * Types of variable access for optimization analysis.
 */
export type VariableAccessType =
  | 'read' // Simple read access
  | 'write' // Simple write access
  | 'modify' // Read-modify-write (++, +=, etc.)
  | 'address' // Address taken (&var)
  | 'array_read' // Array element read
  | 'array_write' // Array element write
  | 'member_read' // Member access read
  | 'member_write'; // Member access write

/**
 * Variable access pattern analysis.
 */
export type VariableAccessPattern =
  | 'single_use' // Used only once
  | 'multiple_read' // Read multiple times
  | 'read_write' // Both read and written
  | 'loop_dependent' // Access depends on loop variable
  | 'sequential' // Sequential array access
  | 'random' // Random access pattern
  | 'hot_path'; // Frequently accessed

/**
 * Side effect information for optimization.
 */
export interface SideEffectInfo {
  type: SideEffectType;
  target: string;
  location: SourcePosition;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export type SideEffectType =
  | 'variable_write' // Writes to variable
  | 'array_write' // Writes to array element
  | 'function_call' // Calls function with potential side effects
  | 'hardware_access' // Accesses hardware registers
  | 'memory_access' // Direct memory access
  | 'volatile_access'; // Access to volatile location

/**
 * Register pressure analysis for 6502 optimization.
 */
export interface RegisterPressureInfo {
  estimatedRegistersNeeded: number;
  preferredRegister: PreferredRegister;
  requiresSpillToMemory: boolean;
  canUseZeroPage: boolean;
  temporaryVariablesNeeded: number;
}

export type PreferredRegister = 'A' | 'X' | 'Y' | 'memory' | 'zero_page';

/**
 * 6502-specific optimization hints.
 */
export interface SixtyTwoOptimizationHints {
  // Addressing mode optimization
  addressingMode: AddressingModeHint;
  zeroPageCandidate: boolean;
  absoluteAddressingRequired: boolean;

  // Register usage hints
  accumulatorOperation: boolean;
  indexRegisterUsage: IndexRegisterUsage;
  requiresIndexing: boolean;

  // Memory layout hints
  memoryBankPreference: MemoryBank;
  alignmentRequirement: number;
  volatileAccess: boolean;

  // Performance optimization
  branchPredictionHint: BranchPrediction;
  loopOptimizationHint: LoopOptimizationHint;
  inlineCandidate: boolean;

  // Hardware-specific hints
  hardwareRegisterAccess: boolean;
  timingCritical: boolean;
  interruptSafe: boolean;
}

export type AddressingModeHint =
  | 'zero_page' // $00-$FF
  | 'absolute' // $0000-$FFFF
  | 'indexed_x' // ,X
  | 'indexed_y' // ,Y
  | 'indirect' // ($xxxx)
  | 'immediate'; // #$xx

export type IndexRegisterUsage =
  | 'none' // No index register needed
  | 'prefer_x' // X register preferred
  | 'prefer_y' // Y register preferred
  | 'requires_x' // Must use X register
  | 'requires_y'; // Must use Y register

export type MemoryBank =
  | 'zero_page' // $00-$FF
  | 'stack' // $0100-$01FF
  | 'ram' // General RAM
  | 'rom' // Read-only memory
  | 'hardware_io'; // Hardware I/O area (accessed via peek/poke)

export type BranchPrediction =
  | 'likely_taken' // Branch likely to be taken
  | 'likely_not' // Branch likely not taken
  | 'unpredictable' // Cannot predict
  | 'always' // Always taken
  | 'never'; // Never taken

export type LoopOptimizationHint =
  | 'unroll_candidate' // Good for loop unrolling
  | 'vectorize_candidate' // Could benefit from vectorization
  | 'strength_reduce' // Strength reduction opportunity
  | 'invariant_motion' // Loop invariant code motion
  | 'induction_variable'; // Induction variable optimization

/**
 * Expression analysis context.
 */
export interface ExpressionContext {
  currentFunction?: FunctionSymbol;
  loopDepth: number;
  inHotPath: boolean;
  inCondition: boolean;
  inAssignment: boolean;
  hardwareContext?: HardwareContext;
  optimizationLevel: OptimizationLevel;
}

export type HardwareContext =
  | 'interrupt_handler' // In interrupt handler
  | 'timing_critical' // Timing-sensitive code
  | 'hardware_access' // Accessing hardware registers
  | 'memory_mapped_io' // Memory-mapped I/O access
  | 'normal'; // Normal execution context

export type OptimizationLevel =
  | 'none' // No optimization
  | 'size' // Optimize for size
  | 'speed' // Optimize for speed
  | 'balanced' // Balance size and speed
  | 'aggressive'; // Maximum optimization

/**
 * Statement analysis results.
 */
export interface StatementAnalysisResult {
  statement: Statement;
  expressions: ExpressionAnalysisResult[];
  controlFlow: ControlFlowInfo;
  optimizationData: StatementOptimizationData;
  errors: SemanticError[];
  warnings: SemanticError[];
}

/**
 * Statement optimization metadata.
 */
export interface StatementOptimizationData {
  // Control flow properties
  isTerminal: boolean;
  alwaysExecutes: boolean;
  conditionalExecution: boolean;
  loopStatement: boolean;

  // Optimization opportunities
  deadCodeCandidate: boolean;
  unreachableCode: boolean;
  constantCondition: boolean;
  emptyStatement: boolean;

  // Performance characteristics
  executionFrequency: ExecutionFrequency;
  criticalPath: boolean;
  hotPath: boolean;

  // 6502-specific hints
  branchInstruction: boolean;
  jumpInstruction: boolean;
  hardwareInteraction: boolean;
}

export type ExecutionFrequency =
  | 'never' // Never executed (dead code)
  | 'rare' // Rarely executed
  | 'normal' // Normal execution
  | 'frequent' // Frequently executed
  | 'hot'; // Very frequently executed (hot path)

/**
 * Control flow information.
 */
export interface ControlFlowInfo {
  hasControlFlow: boolean;
  flowType: ControlFlowType;
  targetLabel?: string;
  condition?: Expression;
  branches: BranchInfo[];
}

export type ControlFlowType =
  | 'sequential' // Normal sequential flow
  | 'conditional' // Conditional branch
  | 'unconditional' // Unconditional jump
  | 'loop' // Loop control
  | 'return' // Function return
  | 'break' // Break statement
  | 'continue'; // Continue statement

export interface BranchInfo {
  condition?: Expression;
  target: string;
  probability: number; // 0.0 to 1.0
}

/**
 * Expression analysis result.
 */
export interface ExpressionAnalysisResult {
  expression: Expression;
  resolvedType: Blend65Type;
  optimizationData: ExpressionOptimizationData;
  errors: SemanticError[];
  warnings: SemanticError[];
}

/**
 * Block analysis result.
 */
export interface BlockAnalysisResult {
  statements: StatementAnalysisResult[];
  blockOptimizationData: BlockOptimizationData;
  errors: SemanticError[];
  warnings: SemanticError[];
}

/**
 * Block-level optimization metadata.
 */
export interface BlockOptimizationData {
  // Block properties
  statementCount: number;
  expressionCount: number;
  variableAccesses: VariableReference[];

  // Optimization opportunities
  deadCodeElimination: DeadCodeInfo[];
  commonSubexpressions: CommonSubexpressionInfo[];
  constantPropagation: ConstantPropagationInfo[];
  loopOptimizations: LoopOptimizationInfo[];

  // Performance characteristics
  estimatedCycles: number;
  codeSize: number;
  hotPath: boolean;
  criticalSection: boolean;
}

export interface DeadCodeInfo {
  statement: Statement;
  reason: string;
  canEliminate: boolean;
}

export interface CommonSubexpressionInfo {
  expression: Expression;
  occurrences: SourcePosition[];
  eliminationBenefit: number;
}

export interface ConstantPropagationInfo {
  variable: VariableSymbol;
  constantValue: number | boolean | string;
  propagationSites: SourcePosition[];
}

export interface LoopOptimizationInfo {
  loopType: 'for' | 'while';
  invariantExpressions: Expression[];
  inductionVariables: VariableSymbol[];
  unrollCandidate: boolean;
  strengthReduction: StrengthReductionInfo[];
}

export interface StrengthReductionInfo {
  originalExpression: Expression;
  reducedForm: string;
  benefit: number;
}

// ============================================================================
// EXPRESSION ANALYZER IMPLEMENTATION
// ============================================================================

/**
 * Comprehensive expression and statement analyzer with maximum optimization
 * metadata collection for human-level peephole optimization decisions.
 */
export class ExpressionAnalyzer {
  private symbolTable: SymbolTable;
  private typeChecker: TypeChecker;
  private errors: SemanticError[] = [];
  private warnings: SemanticError[] = [];
  private optimizationMetadata: Map<Expression, ExpressionOptimizationData> = new Map();
  private statementMetadata: Map<Statement, StatementOptimizationData> = new Map();

  constructor(symbolTable: SymbolTable, typeChecker: TypeChecker) {
    this.symbolTable = symbolTable;
    this.typeChecker = typeChecker;
  }

  /**
   * Get the type checker instance.
   */
  getTypeChecker(): TypeChecker {
    return this.typeChecker;
  }

  // ============================================================================
  // MAIN ANALYSIS METHODS
  // ============================================================================

  /**
   * Analyze an expression with comprehensive optimization metadata collection.
   */
  analyzeExpression(expr: Expression, context: ExpressionContext): ExpressionAnalysisResult {
    const result: ExpressionAnalysisResult = {
      expression: expr,
      resolvedType: createPrimitiveType('void'), // Will be determined
      optimizationData: this.createDefaultOptimizationData(),
      errors: [],
      warnings: [],
    };

    // Clear any previous errors for this analysis
    const previousErrorCount = this.errors.length;
    const previousWarningCount = this.warnings.length;

    // Type analysis
    result.resolvedType = this.analyzeExpressionType(expr, context);

    // Optimization metadata collection
    result.optimizationData = this.collectExpressionMetadata(expr, context);

    // Store in cache for later reference
    this.optimizationMetadata.set(expr, result.optimizationData);

    // Copy only new errors/warnings from this analysis into the result
    result.errors.push(...this.errors.slice(previousErrorCount));
    result.warnings.push(...this.warnings.slice(previousWarningCount));

    return result;
  }

  /**
   * Analyze a statement with optimization metadata collection.
   */
  analyzeStatement(stmt: Statement, context: ExpressionContext): StatementAnalysisResult {
    const result: StatementAnalysisResult = {
      statement: stmt,
      expressions: [],
      controlFlow: this.createDefaultControlFlow(),
      optimizationData: this.createDefaultStatementOptimizationData(),
      errors: [],
      warnings: [],
    };

    // Track errors from this analysis
    const previousErrorCount = this.errors.length;
    const previousWarningCount = this.warnings.length;

    try {
      // Analyze expressions within the statement
      result.expressions = this.extractAndAnalyzeExpressions(stmt, context);

      // Analyze control flow
      result.controlFlow = this.analyzeControlFlow(stmt, context);

      // Collect statement-level optimization metadata
      result.optimizationData = this.collectStatementMetadata(stmt, context);

      // Store in cache
      this.statementMetadata.set(stmt, result.optimizationData);
    } catch (error) {
      const semanticError: SemanticError = {
        errorType: 'InvalidOperation',
        message: `Statement analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        location: stmt.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: ['Check statement syntax and semantic correctness'],
      };
      result.errors.push(semanticError);
      this.errors.push(semanticError);
    }

    // Copy any new errors/warnings from this analysis into the result
    result.errors.push(...this.errors.slice(previousErrorCount));
    result.warnings.push(...this.warnings.slice(previousWarningCount));

    return result;
  }

  /**
   * Analyze a block of statements.
   */
  analyzeBlock(statements: Statement[], context: ExpressionContext): BlockAnalysisResult {
    const result: BlockAnalysisResult = {
      statements: [],
      blockOptimizationData: this.createDefaultBlockOptimizationData(),
      errors: [],
      warnings: [],
    };

    // Analyze each statement
    for (const stmt of statements) {
      const stmtResult = this.analyzeStatement(stmt, context);
      result.statements.push(stmtResult);
      result.errors.push(...stmtResult.errors);
      result.warnings.push(...stmtResult.warnings);
    }

    // Collect block-level optimization metadata
    result.blockOptimizationData = this.collectBlockMetadata(result.statements, context);

    return result;
  }

  // ============================================================================
  // EXPRESSION TYPE ANALYSIS
  // ============================================================================

  /**
   * Determine the type of an expression.
   */
  private analyzeExpressionType(expr: Expression, context: ExpressionContext): Blend65Type {
    switch (expr.type) {
      case 'BinaryExpr':
        return this.analyzeBinaryExpressionType(expr as BinaryExpr, context);

      case 'UnaryExpr':
        return this.analyzeUnaryExpressionType(expr as UnaryExpr, context);

      case 'AssignmentExpr':
        return this.analyzeAssignmentExpressionType(expr as AssignmentExpr, context);

      case 'CallExpr':
        return this.analyzeCallExpressionType(expr as CallExpr, context);

      case 'MemberExpr':
        return this.analyzeMemberExpressionType(expr as MemberExpr, context);

      case 'IndexExpr':
        return this.analyzeIndexExpressionType(expr as IndexExpr, context);

      case 'Identifier':
        return this.analyzeIdentifierType(expr as Identifier, context);

      case 'Literal':
        return this.analyzeLiteralType(expr as Literal, context);

      case 'ArrayLiteral':
        return this.analyzeArrayLiteralType(expr as ArrayLiteral, context);

      default:
        this.addError({
          errorType: 'InvalidOperation',
          message: `Unknown expression type: ${expr.type}`,
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
  }

  /**
   * Analyze binary expression type and collect optimization metadata.
   */
  private analyzeBinaryExpressionType(expr: BinaryExpr, context: ExpressionContext): Blend65Type {
    const leftType = this.analyzeExpressionType(expr.left, context);
    const rightType = this.analyzeExpressionType(expr.right, context);

    // Arithmetic operators
    if (['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'].includes(expr.operator)) {
      // For arithmetic, allow mixed byte/word operations (promote to word)
      if (isPrimitiveType(leftType) && isPrimitiveType(rightType)) {
        const leftIsNumeric = leftType.name === 'byte' || leftType.name === 'word';
        const rightIsNumeric = rightType.name === 'byte' || rightType.name === 'word';

        if (!leftIsNumeric || !rightIsNumeric) {
          this.addError({
            errorType: 'TypeMismatch',
            message: `Cannot perform '${expr.operator}' on types '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
            suggestions: ['Use explicit type conversion', 'Ensure both operands are numeric types'],
          });
        }

        // Result type is the "larger" of the two types
        if (leftType.name === 'word' || rightType.name === 'word') {
          return createPrimitiveType('word');
        }
        return createPrimitiveType('byte');
      }
      return leftType;
    }

    // Comparison operators
    if (['==', '!=', '<', '<=', '>', '>='].includes(expr.operator)) {
      // Comparisons can work with mixed byte/word
      if (isPrimitiveType(leftType) && isPrimitiveType(rightType)) {
        const leftIsComparable =
          leftType.name === 'byte' || leftType.name === 'word' || leftType.name === 'boolean';
        const rightIsComparable =
          rightType.name === 'byte' || rightType.name === 'word' || rightType.name === 'boolean';

        if (!leftIsComparable || !rightIsComparable) {
          this.addError({
            errorType: 'TypeMismatch',
            message: `Cannot compare types '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
          });
        }
      }
      return createPrimitiveType('boolean');
    }

    // Logical operators
    if (['&&', '||'].includes(expr.operator)) {
      // Both operands should be boolean-compatible
      return createPrimitiveType('boolean');
    }

    this.addError({
      errorType: 'InvalidOperation',
      message: `Unknown binary operator: ${expr.operator}`,
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });
    return createPrimitiveType('void');
  }

  /**
   * Analyze unary expression type.
   */
  private analyzeUnaryExpressionType(expr: UnaryExpr, context: ExpressionContext): Blend65Type {
    const operandType = this.analyzeExpressionType(expr.operand, context);

    switch (expr.operator) {
      case '-':
      case '+':
      case '~':
        // These preserve the operand type
        return operandType;

      case '!':
        // Logical not always returns boolean
        return createPrimitiveType('boolean');

      case '++':
      case '--':
        // Increment/decrement preserves type but requires numeric type
        if (
          isPrimitiveType(operandType) &&
          (operandType.name === 'byte' || operandType.name === 'word')
        ) {
          return operandType;
        }
        this.addError({
          errorType: 'TypeMismatch',
          message: `Cannot apply '${expr.operator}' to type '${typeToString(operandType)}'`,
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return operandType;

      default:
        this.addError({
          errorType: 'InvalidOperation',
          message: `Unknown unary operator: ${expr.operator}`,
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
  }

  /**
   * Analyze assignment expression type.
   */
  private analyzeAssignmentExpressionType(
    expr: AssignmentExpr,
    context: ExpressionContext
  ): Blend65Type {
    const leftType = this.analyzeExpressionType(expr.left, context);
    const rightType = this.analyzeExpressionType(expr.right, context);

    // Check assignment compatibility
    if (!isAssignmentCompatible(leftType, rightType)) {
      this.addError({
        errorType: 'TypeMismatch',
        message: `Cannot assign '${typeToString(rightType)}' to '${typeToString(leftType)}'`,
        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: ['Use explicit type conversion', 'Check variable declaration type'],
      });
    }

    // Assignment expression returns the assigned value type
    return leftType;
  }

  /**
   * Analyze call expression type.
   */
  private analyzeCallExpressionType(expr: CallExpr, context: ExpressionContext): Blend65Type {
    // If callee is a function identifier, check for built-in functions first
    if (expr.callee.type === 'Identifier') {
      const functionName = (expr.callee as Identifier).name;

      // Check for built-in functions first
      if (isBuiltInFunction(functionName)) {
        const builtInDef = getBuiltInFunction(functionName)!;

        // Validate built-in function call
        const validation = validateBuiltInFunctionCall(builtInDef, expr.args, context, this);

        // Add validation errors and warnings
        this.errors.push(...validation.errors);
        this.warnings.push(...validation.warnings);

        // Mark optimization metadata for built-in function calls
        if (context.hardwareContext === undefined) {
          // Built-in functions that access hardware should update context
          if (builtInDef.accessesHardware) {
            context = { ...context, hardwareContext: 'hardware_access' };
          }
        }

        return builtInDef.returnType;
      }

      // Check for user-defined function symbols
      const functionSymbol = this.symbolTable.lookupSymbol(functionName);
      if (functionSymbol && isFunctionSymbol(functionSymbol)) {
        // Validate argument count
        if (expr.args.length !== functionSymbol.parameters.length) {
          this.addError({
            errorType: 'TypeMismatch',
            message: `Function '${functionSymbol.name}' expects ${functionSymbol.parameters.length} arguments, got ${expr.args.length}`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
          });
        }

        // Validate argument types
        for (let i = 0; i < Math.min(expr.args.length, functionSymbol.parameters.length); i++) {
          const argType = this.analyzeExpressionType(expr.args[i], context);
          const paramType = functionSymbol.parameters[i].type;

          if (!isAssignmentCompatible(paramType, argType)) {
            this.addError({
              errorType: 'TypeMismatch',
              message: `Argument ${i + 1} to function '${functionSymbol.name}': expected '${typeToString(paramType)}', got '${typeToString(argType)}'`,
              location: expr.args[i].metadata?.start || { line: 0, column: 0, offset: 0 },
            });
          }
        }

        return functionSymbol.returnType;
      }

      // If we reach here, the identifier is not a known function
      this.addError({
        errorType: 'UndefinedSymbol',
        message: `Undefined function '${functionName}'`,
        location: expr.callee.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: [
          `Check if '${functionName}' is declared`,
          'Verify function name spelling',
          `Available built-in functions: ${getAllBuiltInFunctionNames().join(', ')}`,
        ],
      });
      return createPrimitiveType('void');
    }

    // Analyze callee for non-identifier cases
    const calleeType = this.analyzeExpressionType(expr.callee, context);

    // Callback function call
    if (isCallbackType(calleeType)) {
      // Validate arguments against callback signature
      if (expr.args.length !== calleeType.parameterTypes.length) {
        this.addError({
          errorType: 'TypeMismatch',
          message: `Callback expects ${calleeType.parameterTypes.length} arguments, got ${expr.args.length}`,
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
      }

      return calleeType.returnType;
    }

    this.addError({
      errorType: 'TypeMismatch',
      message: `Expression is not callable`,
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });
    return createPrimitiveType('void');
  }

  /**
   * Analyze member expression type.
   */
  private analyzeMemberExpressionType(expr: MemberExpr, context: ExpressionContext): Blend65Type {
    this.analyzeExpressionType(expr.object, context);

    // For now, assume member access is valid and return byte type
    // Full implementation would check struct/object field types
    this.addWarning({
      errorType: 'InvalidOperation',
      message: 'Member expression analysis not fully implemented',
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });

    return createPrimitiveType('byte');
  }

  /**
   * Analyze index expression type (array access).
   */
  private analyzeIndexExpressionType(expr: IndexExpr, context: ExpressionContext): Blend65Type {
    const arrayType = this.analyzeExpressionType(expr.object, context);
    const indexType = this.analyzeExpressionType(expr.index, context);

    // Index must be numeric
    if (!isPrimitiveType(indexType) || (indexType.name !== 'byte' && indexType.name !== 'word')) {
      this.addError({
        errorType: 'TypeMismatch',
        message: `Array index must be numeric, got '${typeToString(indexType)}'`,
        location: expr.index.metadata?.start || { line: 0, column: 0, offset: 0 },
      });
    }

    // Return element type if array
    if (isArrayType(arrayType)) {
      return arrayType.elementType;
    }

    this.addError({
      errorType: 'TypeMismatch',
      message: `Cannot index into non-array type '${typeToString(arrayType)}'`,
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });
    return createPrimitiveType('void');
  }

  /**
   * Analyze identifier type.
   */
  private analyzeIdentifierType(expr: Identifier, _context: ExpressionContext): Blend65Type {
    const symbol = this.symbolTable.lookupSymbol(expr.name);

    if (!symbol) {
      this.addError({
        errorType: 'UndefinedSymbol',
        message: `Undefined symbol '${expr.name}'`,
        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: [`Check if '${expr.name}' is declared`, 'Verify variable name spelling'],
      });
      return createPrimitiveType('void');
    }

    if (isVariableSymbol(symbol)) {
      return symbol.varType;
    }

    if (isFunctionSymbol(symbol)) {
      // Function identifiers are treated as callback types when not called
      return {
        kind: 'callback',
        parameterTypes: symbol.parameters.map(p => p.type),
        returnType: symbol.returnType,
      };
    }

    // Other symbol types (types, enums) not directly usable as expressions
    this.addError({
      errorType: 'InvalidOperation',
      message: `Symbol '${expr.name}' cannot be used as an expression`,
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });
    return createPrimitiveType('void');
  }

  /**
   * Analyze literal type.
   */
  private analyzeLiteralType(expr: Literal, _context: ExpressionContext): Blend65Type {
    if (typeof expr.value === 'number') {
      // Check range for 6502 compatibility
      if (expr.value < 0 || expr.value > 65535) {
        this.addError({
          errorType: 'TypeMismatch',
          message: `Number literal ${expr.value} is out of range for 6502 (0-65535)`,
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: ['Use a number within the valid range'],
        });
        return createPrimitiveType('void');
      }

      // Determine if byte or word
      return expr.value <= 255 ? createPrimitiveType('byte') : createPrimitiveType('word');
    }

    if (typeof expr.value === 'boolean') {
      return createPrimitiveType('boolean');
    }

    if (typeof expr.value === 'string') {
      // String literals are treated as byte arrays
      return createArrayType(createPrimitiveType('byte'), expr.value.length);
    }

    this.addError({
      errorType: 'InvalidOperation',
      message: `Unknown literal type: ${typeof expr.value}`,
      location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
    });
    return createPrimitiveType('void');
  }

  /**
   * Analyze array literal type.
   */
  private analyzeArrayLiteralType(expr: ArrayLiteral, context: ExpressionContext): Blend65Type {
    if (expr.elements.length === 0) {
      this.addError({
        errorType: 'TypeMismatch',
        message: 'Empty array literals are not allowed',
        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: ['Provide at least one element to determine array type'],
      });
      return createPrimitiveType('void');
    }

    // Determine element type from first element
    const firstElementType = this.analyzeExpressionType(expr.elements[0], context);

    // Check that all elements are compatible
    for (let i = 1; i < expr.elements.length; i++) {
      const elementType = this.analyzeExpressionType(expr.elements[i], context);
      if (!isAssignmentCompatible(firstElementType, elementType)) {
        this.addError({
          errorType: 'TypeMismatch',
          message: `Array element ${i + 1} type '${typeToString(elementType)}' is not compatible with array type '${typeToString(firstElementType)}'`,
          location: expr.elements[i].metadata?.start || { line: 0, column: 0, offset: 0 },
        });
      }
    }

    return createArrayType(firstElementType, expr.elements.length);
  }

  // ============================================================================
  // OPTIMIZATION METADATA COLLECTION
  // ============================================================================

  /**
   * Collect comprehensive optimization metadata for an expression.
   */
  private collectExpressionMetadata(
    expr: Expression,
    _context: ExpressionContext
  ): ExpressionOptimizationData {
    const metadata: ExpressionOptimizationData = this.createDefaultOptimizationData();

    // Basic properties
    metadata.depth = this.calculateExpressionDepth(expr);
    metadata.nodeCount = this.countExpressionNodes(expr);

    // Constant analysis
    this.analyzeConstantProperties(expr, metadata, _context);

    // Variable usage analysis
    metadata.usedVariables = this.collectVariableReferences(expr, _context);
    metadata.hasVariableAccess = metadata.usedVariables.length > 0;
    metadata.variableAccessPattern = this.analyzeVariableAccessPattern(
      metadata.usedVariables,
      _context
    );

    // Side effect analysis
    this.analyzeSideEffects(expr, metadata, _context);

    // Performance analysis
    this.analyzePerformanceCharacteristics(expr, metadata, _context);

    // 6502-specific hints
    this.collect6502OptimizationHints(expr, metadata, _context);

    // Loop context analysis
    this.analyzeLoopContext(expr, metadata, _context);

    // Optimization opportunities
    this.identifyOptimizationOpportunities(expr, metadata, _context);

    return metadata;
  }

  /**
   * Calculate the depth of an expression tree.
   */
  private calculateExpressionDepth(expr: Expression): number {
    switch (expr.type) {
      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        return (
          1 +
          Math.max(
            this.calculateExpressionDepth(binaryExpr.left),
            this.calculateExpressionDepth(binaryExpr.right)
          )
        );

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        return 1 + this.calculateExpressionDepth(unaryExpr.operand);

      case 'AssignmentExpr':
        const assignExpr = expr as AssignmentExpr;
        return (
          1 +
          Math.max(
            this.calculateExpressionDepth(assignExpr.left),
            this.calculateExpressionDepth(assignExpr.right)
          )
        );

      case 'CallExpr':
        const callExpr = expr as CallExpr;
        const calleeDepth = this.calculateExpressionDepth(callExpr.callee);
        const maxArgDepth =
          callExpr.args.length > 0
            ? Math.max(...callExpr.args.map(arg => this.calculateExpressionDepth(arg)))
            : 0;
        return 1 + Math.max(calleeDepth, maxArgDepth);

      case 'MemberExpr':
        const memberExpr = expr as MemberExpr;
        return 1 + this.calculateExpressionDepth(memberExpr.object);

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        return (
          1 +
          Math.max(
            this.calculateExpressionDepth(indexExpr.object),
            this.calculateExpressionDepth(indexExpr.index)
          )
        );

      case 'ArrayLiteral':
        const arrayLit = expr as ArrayLiteral;
        return arrayLit.elements.length > 0
          ? 1 + Math.max(...arrayLit.elements.map(elem => this.calculateExpressionDepth(elem)))
          : 1;

      default:
        return 1; // Leaf nodes (Identifier, Literal)
    }
  }

  /**
   * Count total nodes in an expression tree.
   */
  private countExpressionNodes(expr: Expression): number {
    switch (expr.type) {
      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        return (
          1 +
          this.countExpressionNodes(binaryExpr.left) +
          this.countExpressionNodes(binaryExpr.right)
        );

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        return 1 + this.countExpressionNodes(unaryExpr.operand);

      case 'AssignmentExpr':
        const assignExpr = expr as AssignmentExpr;
        return (
          1 +
          this.countExpressionNodes(assignExpr.left) +
          this.countExpressionNodes(assignExpr.right)
        );

      case 'CallExpr':
        const callExpr = expr as CallExpr;
        const calleeNodes = this.countExpressionNodes(callExpr.callee);
        const argNodes = callExpr.args.reduce(
          (sum, arg) => sum + this.countExpressionNodes(arg),
          0
        );
        return 1 + calleeNodes + argNodes;

      case 'MemberExpr':
        const memberExpr = expr as MemberExpr;
        return 1 + this.countExpressionNodes(memberExpr.object);

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        return (
          1 +
          this.countExpressionNodes(indexExpr.object) +
          this.countExpressionNodes(indexExpr.index)
        );

      case 'ArrayLiteral':
        const arrayLit = expr as ArrayLiteral;
        return (
          1 + arrayLit.elements.reduce((sum, elem) => sum + this.countExpressionNodes(elem), 0)
        );

      default:
        return 1; // Leaf nodes
    }
  }

  /**
   * Recursively collect variable references from an expression.
   */
  private collectVariableReferences(
    expr: Expression,
    context: ExpressionContext
  ): VariableReference[] {
    const references: VariableReference[] = [];

    switch (expr.type) {
      case 'Identifier':
        const identifier = expr as Identifier;
        const symbol = this.symbolTable.lookupSymbol(identifier.name);
        if (symbol && isVariableSymbol(symbol)) {
          references.push({
            symbol: symbol,
            accessType: context.inAssignment ? 'write' : 'read',
            location: identifier.metadata?.start || { line: 0, column: 0, offset: 0 },
            context: context,
          });
        }
        break;

      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        references.push(...this.collectVariableReferences(binaryExpr.left, context));
        references.push(...this.collectVariableReferences(binaryExpr.right, context));
        break;

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        references.push(...this.collectVariableReferences(unaryExpr.operand, context));
        break;

      case 'AssignmentExpr':
        const assignExpr = expr as AssignmentExpr;
        // Left side is written to
        const writeContext = { ...context, inAssignment: true };
        references.push(...this.collectVariableReferences(assignExpr.left, writeContext));
        // Right side is read from
        references.push(...this.collectVariableReferences(assignExpr.right, context));
        break;

      case 'CallExpr':
        const callExpr = expr as CallExpr;
        references.push(...this.collectVariableReferences(callExpr.callee, context));
        callExpr.args.forEach(arg => {
          references.push(...this.collectVariableReferences(arg, context));
        });
        break;

      case 'MemberExpr':
        const memberExpr = expr as MemberExpr;
        references.push(...this.collectVariableReferences(memberExpr.object, context));
        break;

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        references.push(...this.collectVariableReferences(indexExpr.object, context));
        references.push(...this.collectVariableReferences(indexExpr.index, context));
        break;

      case 'ArrayLiteral':
        const arrayLit = expr as ArrayLiteral;
        arrayLit.elements.forEach(elem => {
          references.push(...this.collectVariableReferences(elem, context));
        });
        break;

      // Literals have no variable references
      default:
        break;
    }

    return references;
  }

  /**
   * Analyze variable access patterns for optimization.
   */
  private analyzeVariableAccessPattern(
    references: VariableReference[],
    _context: ExpressionContext
  ): VariableAccessPattern {
    if (references.length === 0) {
      return 'single_use';
    }

    if (references.length === 1) {
      return 'single_use';
    }

    // Check for read-write pattern
    const hasRead = references.some(ref => ref.accessType === 'read');
    const hasWrite = references.some(
      ref => ref.accessType === 'write' || ref.accessType === 'modify'
    );

    if (hasRead && hasWrite) {
      return 'read_write';
    }

    if (hasRead && !hasWrite) {
      return 'multiple_read';
    }

    if (_context.loopDepth > 0) {
      return 'loop_dependent';
    }

    if (_context.inHotPath) {
      return 'hot_path';
    }

    return 'multiple_read';
  }

  /**
   * Analyze constant properties of an expression.
   */
  private analyzeConstantProperties(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    switch (expr.type) {
      case 'Literal':
        const literal = expr as Literal;
        metadata.isConstant = true;
        metadata.constantValue = literal.value;
        metadata.isCompileTimeConstant = true;
        metadata.constantFoldingCandidate = false; // Already a literal
        break;

      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        const leftMeta = this.createDefaultOptimizationData();
        const rightMeta = this.createDefaultOptimizationData();
        this.analyzeConstantProperties(binaryExpr.left, leftMeta, _context);
        this.analyzeConstantProperties(binaryExpr.right, rightMeta, _context);

        // Binary expressions are NOT constant themselves, but they may be constant folding candidates
        metadata.isConstant = false;
        metadata.constantFoldingCandidate = leftMeta.isConstant && rightMeta.isConstant;
        metadata.isCompileTimeConstant =
          leftMeta.isCompileTimeConstant && rightMeta.isCompileTimeConstant;
        break;

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        const operandMeta = this.createDefaultOptimizationData();
        this.analyzeConstantProperties(unaryExpr.operand, operandMeta, _context);

        // Unary expressions are NOT constant themselves, but may be constant folding candidates
        metadata.isConstant = false;
        metadata.constantFoldingCandidate = operandMeta.isConstant;
        metadata.isCompileTimeConstant = operandMeta.isCompileTimeConstant;
        break;

      default:
        metadata.isConstant = false;
        metadata.constantFoldingCandidate = false;
        metadata.isCompileTimeConstant = false;
        break;
    }
  }

  /**
   * Analyze side effects in an expression.
   */
  private analyzeSideEffects(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    switch (expr.type) {
      case 'AssignmentExpr':
        metadata.hasSideEffects = true;
        metadata.isPure = false;
        metadata.sideEffects.push({
          type: 'variable_write',
          target: 'variable',
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
          severity: 'medium',
          description: 'Assignment modifies variable',
        });
        break;

      case 'CallExpr':
        metadata.hasSideEffects = true;
        metadata.isPure = false;
        metadata.hasNestedCalls = true;
        metadata.sideEffects.push({
          type: 'function_call',
          target: 'function',
          location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
          severity: 'medium',
          description: 'Function call may have side effects',
        });
        break;

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        if (unaryExpr.operator === '++' || unaryExpr.operator === '--') {
          metadata.hasSideEffects = true;
          metadata.isPure = false;
          metadata.sideEffects.push({
            type: 'variable_write',
            target: 'variable',
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
            severity: 'medium',
            description: 'Increment/decrement modifies variable',
          });
        }
        break;

      case 'IndexExpr':
        metadata.hasComplexAddressing = true;
        break;

      default:
        // Most expressions are pure
        metadata.hasSideEffects = false;
        metadata.isPure = true;
        break;
    }

    // Recursively analyze sub-expressions
    this.propagateSideEffectsFromSubExpressions(expr, metadata, _context);
  }

  /**
   * Propagate side effects from sub-expressions.
   */
  private propagateSideEffectsFromSubExpressions(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    const subExpressions = this.getSubExpressions(expr);

    for (const subExpr of subExpressions) {
      const subMeta = this.createDefaultOptimizationData();
      this.analyzeSideEffects(subExpr, subMeta, _context);

      if (subMeta.hasSideEffects) {
        metadata.hasSideEffects = true;
        metadata.isPure = false;
        metadata.sideEffects.push(...subMeta.sideEffects);
      }

      if (subMeta.hasNestedCalls) {
        metadata.hasNestedCalls = true;
      }

      if (subMeta.hasComplexAddressing) {
        metadata.hasComplexAddressing = true;
      }
    }
  }

  /**
   * Get all sub-expressions of an expression.
   */
  private getSubExpressions(expr: Expression): Expression[] {
    switch (expr.type) {
      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        return [binaryExpr.left, binaryExpr.right];

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        return [unaryExpr.operand];

      case 'AssignmentExpr':
        const assignExpr = expr as AssignmentExpr;
        return [assignExpr.left, assignExpr.right];

      case 'CallExpr':
        const callExpr = expr as CallExpr;
        return [callExpr.callee, ...callExpr.args];

      case 'MemberExpr':
        const memberExpr = expr as MemberExpr;
        return [memberExpr.object];

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        return [indexExpr.object, indexExpr.index];

      case 'ArrayLiteral':
        const arrayLit = expr as ArrayLiteral;
        return arrayLit.elements;

      default:
        return [];
    }
  }

  /**
   * Analyze performance characteristics of an expression.
   */
  private analyzePerformanceCharacteristics(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    // Calculate complexity score based on operation types and nesting
    metadata.complexityScore = this.calculateComplexityScore(expr);

    // Estimate 6502 cycles for the expression
    metadata.estimatedCycles = this.estimateExecutionCycles(expr);

    // Analyze register pressure
    metadata.registerPressure = this.analyzeRegisterPressure(expr, _context);
  }

  /**
   * Calculate complexity score for an expression.
   */
  private calculateComplexityScore(expr: Expression): number {
    switch (expr.type) {
      case 'Literal':
      case 'Identifier':
        return 1;

      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        const leftScore = this.calculateComplexityScore(binaryExpr.left);
        const rightScore = this.calculateComplexityScore(binaryExpr.right);
        // Multiplication and division are more complex
        const opWeight = ['*', '/', '%'].includes(binaryExpr.operator) ? 3 : 2;
        return opWeight + leftScore + rightScore;

      case 'UnaryExpr':
        const unaryExpr = expr as UnaryExpr;
        return 1 + this.calculateComplexityScore(unaryExpr.operand);

      case 'AssignmentExpr':
        const assignExpr = expr as AssignmentExpr;
        return (
          2 +
          this.calculateComplexityScore(assignExpr.left) +
          this.calculateComplexityScore(assignExpr.right)
        );

      case 'CallExpr':
        const callExpr = expr as CallExpr;
        const calleeScore = this.calculateComplexityScore(callExpr.callee);
        const argsScore = callExpr.args.reduce(
          (sum, arg) => sum + this.calculateComplexityScore(arg),
          0
        );
        return 5 + calleeScore + argsScore; // Function calls are expensive

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        return (
          3 +
          this.calculateComplexityScore(indexExpr.object) +
          this.calculateComplexityScore(indexExpr.index)
        );

      default:
        return 2;
    }
  }

  /**
   * Estimate 6502 execution cycles for an expression.
   */
  private estimateExecutionCycles(expr: Expression): number {
    switch (expr.type) {
      case 'Literal':
        return 2; // LDA #immediate

      case 'Identifier':
        return 3; // LDA zero_page or 4 for absolute

      case 'BinaryExpr':
        const binaryExpr = expr as BinaryExpr;
        const leftCycles = this.estimateExecutionCycles(binaryExpr.left);
        const rightCycles = this.estimateExecutionCycles(binaryExpr.right);

        switch (binaryExpr.operator) {
          case '+':
          case '-':
            return leftCycles + rightCycles + 3; // ADC/SBC
          case '*':
            return leftCycles + rightCycles + 20; // Multiplication routine
          case '/':
          case '%':
            return leftCycles + rightCycles + 40; // Division routine
          default:
            return leftCycles + rightCycles + 2;
        }

      case 'CallExpr':
        return 20; // JSR overhead + function execution

      case 'IndexExpr':
        const indexExpr = expr as IndexExpr;
        return (
          this.estimateExecutionCycles(indexExpr.object) +
          this.estimateExecutionCycles(indexExpr.index) +
          4
        ); // Indexed addressing

      default:
        return 5; // Conservative estimate
    }
  }

  /**
   * Analyze register pressure for 6502.
   */
  private analyzeRegisterPressure(
    expr: Expression,
    _context: ExpressionContext
  ): RegisterPressureInfo {
    const complexityScore = this.calculateComplexityScore(expr);

    return {
      estimatedRegistersNeeded: Math.min(3, Math.ceil(complexityScore / 3)), // A, X, Y max
      preferredRegister: this.determinePreferredRegister(expr),
      requiresSpillToMemory: complexityScore > 6,
      canUseZeroPage: true, // Most expressions can benefit from zero page
      temporaryVariablesNeeded: Math.max(0, complexityScore - 3),
    };
  }

  /**
   * Determine preferred register for an expression.
   */
  private determinePreferredRegister(expr: Expression): PreferredRegister {
    switch (expr.type) {
      case 'BinaryExpr':
        return 'A'; // Accumulator for arithmetic

      case 'IndexExpr':
        return 'X'; // Index register for array access

      case 'CallExpr':
        return 'A'; // Function results in accumulator

      default:
        return 'A'; // Default to accumulator
    }
  }

  /**
   * Collect 6502-specific optimization hints.
   */
  private collect6502OptimizationHints(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    metadata.sixtyTwoHints = {
      addressingMode: this.determineAddressingMode(expr, _context),
      zeroPageCandidate: this.isZeroPageCandidate(expr),
      absoluteAddressingRequired: this.requiresAbsoluteAddressing(expr),
      accumulatorOperation: this.isAccumulatorOperation(expr),
      indexRegisterUsage: this.analyzeIndexRegisterUsage(expr),
      requiresIndexing: this.requiresIndexing(expr),
      memoryBankPreference: this.determineMemoryBankPreference(expr, _context),
      alignmentRequirement: 1, // Most expressions have no special alignment
      volatileAccess: false, // Most expressions are not volatile
      branchPredictionHint: 'unpredictable',
      loopOptimizationHint: this.getLoopOptimizationHint(expr, _context),
      inlineCandidate: this.isInlineCandidate(expr),
      hardwareRegisterAccess: false, // Most expressions don't access hardware
      timingCritical: _context.hardwareContext === 'timing_critical',
      interruptSafe: _context.hardwareContext !== 'interrupt_handler',
    };
  }

  /**
   * Determine addressing mode for an expression.
   */
  private determineAddressingMode(
    expr: Expression,
    _context: ExpressionContext
  ): AddressingModeHint {
    if (expr.type === 'Literal') {
      return 'immediate';
    }

    if (expr.type === 'Identifier') {
      const symbol = this.symbolTable.lookupSymbol((expr as Identifier).name);
      if (symbol && isVariableSymbol(symbol) && symbol.storageClass === 'zp') {
        return 'zero_page';
      }
      return 'absolute';
    }

    if (expr.type === 'IndexExpr') {
      return 'indexed_x'; // Prefer X register for indexing
    }

    return 'absolute';
  }

  /**
   * Check if expression is a zero page candidate.
   */
  private isZeroPageCandidate(expr: Expression): boolean {
    if (expr.type === 'Identifier') {
      const symbol = this.symbolTable.lookupSymbol((expr as Identifier).name);
      return !!(
        symbol &&
        isVariableSymbol(symbol) &&
        (symbol.storageClass === 'zp' || symbol.storageClass === undefined)
      );
    }
    return false;
  }

  /**
   * Check if expression requires absolute addressing.
   */
  private requiresAbsoluteAddressing(expr: Expression): boolean {
    return expr.type === 'CallExpr' || expr.type === 'MemberExpr';
  }

  /**
   * Check if expression is an accumulator operation.
   */
  private isAccumulatorOperation(expr: Expression): boolean {
    return (
      expr.type === 'BinaryExpr' &&
      ['+', '-', '&', '|', '^'].includes((expr as BinaryExpr).operator)
    );
  }

  /**
   * Analyze index register usage.
   */
  private analyzeIndexRegisterUsage(expr: Expression): IndexRegisterUsage {
    if (expr.type === 'IndexExpr') {
      return 'requires_x'; // Array access typically uses X
    }

    if (expr.type === 'CallExpr') {
      return 'prefer_x'; // Function calls may use X for parameters
    }

    return 'none';
  }

  /**
   * Check if expression requires indexing.
   */
  private requiresIndexing(expr: Expression): boolean {
    return expr.type === 'IndexExpr' || expr.type === 'MemberExpr';
  }

  /**
   * Determine memory bank preference.
   */
  private determineMemoryBankPreference(expr: Expression, _context: ExpressionContext): MemoryBank {
    if (expr.type === 'Identifier') {
      const symbol = this.symbolTable.lookupSymbol((expr as Identifier).name);
      if (symbol && isVariableSymbol(symbol)) {
        switch (symbol.storageClass) {
          case 'zp':
            return 'zero_page';
          default:
            return 'ram';
        }
      }
    }
    return 'ram';
  }

  /**
   * Get loop optimization hint for an expression.
   */
  private getLoopOptimizationHint(
    expr: Expression,
    _context: ExpressionContext
  ): LoopOptimizationHint {
    if (_context.loopDepth === 0) {
      return 'invariant_motion'; // Default outside loops
    }

    switch (expr.type) {
      case 'Literal':
        return 'invariant_motion';
      case 'Identifier':
        return 'induction_variable';
      case 'BinaryExpr':
        return 'strength_reduce';
      default:
        return 'invariant_motion';
    }
  }

  /**
   * Check if expression is inline candidate.
   */
  private isInlineCandidate(expr: Expression): boolean {
    return this.calculateComplexityScore(expr) <= 3;
  }

  /**
   * Analyze loop context for an expression.
   */
  private analyzeLoopContext(
    expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    metadata.loopInvariant = _context.loopDepth === 0 || expr.type === 'Literal';
    metadata.loopDependent = _context.loopDepth > 0 && !metadata.loopInvariant;
    metadata.hotPathCandidate = _context.inHotPath || _context.loopDepth > 0;
  }

  /**
   * Identify optimization opportunities.
   */
  private identifyOptimizationOpportunities(
    _expr: Expression,
    metadata: ExpressionOptimizationData,
    _context: ExpressionContext
  ): void {
    // Common subexpression elimination opportunity
    metadata.commonSubexpressionCandidate =
      metadata.complexityScore > 2 && !metadata.hasSideEffects;

    // Dead code elimination
    metadata.deadCodeCandidate = false; // This would be determined at a higher level

    // Caching opportunity
    metadata.cacheCandidate = metadata.loopInvariant && metadata.complexityScore > 3;
  }

  // ============================================================================
  // STATEMENT ANALYSIS METHODS
  // ============================================================================

  /**
   * Extract and analyze all expressions from a statement.
   */
  private extractAndAnalyzeExpressions(
    stmt: Statement,
    context: ExpressionContext
  ): ExpressionAnalysisResult[] {
    const expressions: Expression[] = [];
    const results: ExpressionAnalysisResult[] = [];

    // Extract expressions based on statement type
    switch (stmt.type) {
      case 'ExpressionStatement':
        const exprStmt = stmt as ExpressionStatement;
        expressions.push(exprStmt.expression);
        break;

      case 'IfStatement':
        const ifStmt = stmt as IfStatement;
        expressions.push(ifStmt.condition);
        // Note: We don't recursively analyze nested statements here
        break;

      case 'WhileStatement':
        const whileStmt = stmt as WhileStatement;
        expressions.push(whileStmt.condition);
        break;

      case 'ForStatement':
        const forStmt = stmt as ForStatement;
        expressions.push(forStmt.start);
        expressions.push(forStmt.end);
        if (forStmt.step) expressions.push(forStmt.step);
        break;

      case 'ReturnStatement':
        const returnStmt = stmt as ReturnStatement;
        if (returnStmt.value) expressions.push(returnStmt.value);
        break;

      case 'MatchStatement':
        const matchStmt = stmt as MatchStatement;
        expressions.push(matchStmt.discriminant);
        break;

      // Break, continue statements have no expressions
      default:
        break;
    }

    // Analyze each extracted expression
    for (const expr of expressions) {
      results.push(this.analyzeExpression(expr, context));
    }

    return results;
  }

  /**
   * Analyze control flow for a statement.
   */
  private analyzeControlFlow(stmt: Statement, _context: ExpressionContext): ControlFlowInfo {
    const controlFlow: ControlFlowInfo = {
      hasControlFlow: false,
      flowType: 'sequential',
      branches: [],
    };

    switch (stmt.type) {
      case 'IfStatement':
        const ifStmt = stmt as IfStatement;
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'conditional';
        controlFlow.condition = ifStmt.condition;
        controlFlow.branches = [
          { condition: ifStmt.condition, target: 'then', probability: 0.5 },
          { target: 'else', probability: 0.5 },
        ];
        break;

      case 'WhileStatement':
      case 'ForStatement':
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'loop';
        controlFlow.branches = [
          { target: 'loop_body', probability: 0.8 },
          { target: 'loop_exit', probability: 0.2 },
        ];
        break;

      case 'ReturnStatement':
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'return';
        break;

      case 'BreakStatement':
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'break';
        break;

      case 'ContinueStatement':
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'continue';
        break;

      case 'MatchStatement':
        const matchStmt = stmt as MatchStatement;
        controlFlow.hasControlFlow = true;
        controlFlow.flowType = 'conditional';
        controlFlow.condition = matchStmt.discriminant;
        break;

      default:
        // Sequential statements
        break;
    }

    return controlFlow;
  }

  /**
   * Collect statement-level optimization metadata.
   */
  private collectStatementMetadata(
    stmt: Statement,
    _context: ExpressionContext
  ): StatementOptimizationData {
    const metadata: StatementOptimizationData = {
      isTerminal: false,
      alwaysExecutes: true,
      conditionalExecution: false,
      loopStatement: false,
      deadCodeCandidate: false,
      unreachableCode: false,
      constantCondition: false,
      emptyStatement: false,
      executionFrequency: this.determineExecutionFrequency(_context),
      criticalPath: _context.inHotPath,
      hotPath: _context.inHotPath,
      branchInstruction: false,
      jumpInstruction: false,
      hardwareInteraction: false,
    };

    switch (stmt.type) {
      case 'ReturnStatement':
        metadata.isTerminal = true;
        metadata.jumpInstruction = true;
        break;

      case 'IfStatement':
        const ifStmt = stmt as IfStatement;
        metadata.conditionalExecution = true;
        metadata.branchInstruction = true;
        // Check for constant condition
        if (ifStmt.condition.type === 'Literal') {
          metadata.constantCondition = true;
        }
        break;

      case 'WhileStatement':
      case 'ForStatement':
      case 'MatchStatement':
        metadata.conditionalExecution = true;
        metadata.branchInstruction = true;
        metadata.loopStatement = stmt.type === 'WhileStatement' || stmt.type === 'ForStatement';
        break;

      case 'BreakStatement':
      case 'ContinueStatement':
        metadata.isTerminal = true;
        metadata.jumpInstruction = true;
        break;

      case 'ExpressionStatement':
        const exprStmt = stmt as ExpressionStatement;
        // Check if expression has constant condition
        if (exprStmt.expression.type === 'Literal') {
          metadata.constantCondition = true;
        }
        break;

      default:
        break;
    }

    return metadata;
  }

  /**
   * Collect block-level optimization metadata.
   */
  private collectBlockMetadata(
    statements: StatementAnalysisResult[],
    _context: ExpressionContext
  ): BlockOptimizationData {
    const metadata: BlockOptimizationData = {
      statementCount: statements.length,
      expressionCount: 0,
      variableAccesses: [],
      deadCodeElimination: [],
      commonSubexpressions: [],
      constantPropagation: [],
      loopOptimizations: [],
      estimatedCycles: 0,
      codeSize: statements.length * 2, // Rough estimate
      hotPath: _context.inHotPath,
      criticalSection: false,
    };

    // Aggregate data from statements
    for (const stmtResult of statements) {
      metadata.expressionCount += stmtResult.expressions.length;
      metadata.estimatedCycles += stmtResult.expressions.reduce(
        (sum, expr) => sum + expr.optimizationData.estimatedCycles,
        0
      );

      // Collect variable accesses
      for (const expr of stmtResult.expressions) {
        metadata.variableAccesses.push(...expr.optimizationData.usedVariables);
      }

      // Identify dead code candidates
      if (stmtResult.optimizationData.deadCodeCandidate) {
        metadata.deadCodeElimination.push({
          statement: stmtResult.statement,
          reason: 'Unreachable code',
          canEliminate: true,
        });
      }
    }

    return metadata;
  }

  /**
   * Determine execution frequency based on context.
   */
  private determineExecutionFrequency(_context: ExpressionContext): ExecutionFrequency {
    if (_context.inHotPath) {
      return 'hot';
    }
    if (_context.loopDepth > 1) {
      return 'frequent';
    }
    if (_context.loopDepth === 1) {
      return 'frequent';
    }
    return 'normal';
  }

  // ============================================================================
  // DEFAULT VALUE CREATORS
  // ============================================================================

  /**
   * Create default optimization metadata for expressions.
   */
  private createDefaultOptimizationData(): ExpressionOptimizationData {
    return {
      isConstant: false,
      constantValue: undefined,
      isCompileTimeConstant: false,
      usedVariables: [],
      hasVariableAccess: false,
      variableAccessPattern: 'single_use',
      hasSideEffects: false,
      sideEffects: [],
      isPure: true,
      complexityScore: 1,
      estimatedCycles: 1,
      registerPressure: {
        estimatedRegistersNeeded: 1,
        preferredRegister: 'A',
        requiresSpillToMemory: false,
        canUseZeroPage: true,
        temporaryVariablesNeeded: 0,
      },
      sixtyTwoHints: {
        addressingMode: 'absolute',
        zeroPageCandidate: false,
        absoluteAddressingRequired: false,
        accumulatorOperation: false,
        indexRegisterUsage: 'none',
        requiresIndexing: false,
        memoryBankPreference: 'ram',
        alignmentRequirement: 1,
        volatileAccess: false,
        branchPredictionHint: 'unpredictable',
        loopOptimizationHint: 'invariant_motion',
        inlineCandidate: true,
        hardwareRegisterAccess: false,
        timingCritical: false,
        interruptSafe: true,
      },
      loopInvariant: false,
      loopDependent: false,
      hotPathCandidate: false,
      depth: 1,
      nodeCount: 1,
      hasNestedCalls: false,
      hasComplexAddressing: false,
      constantFoldingCandidate: false,
      commonSubexpressionCandidate: false,
      deadCodeCandidate: false,
      cacheCandidate: false,
    };
  }

  /**
   * Create default control flow information.
   */
  private createDefaultControlFlow(): ControlFlowInfo {
    return {
      hasControlFlow: false,
      flowType: 'sequential',
      branches: [],
    };
  }

  /**
   * Create default statement optimization metadata.
   */
  private createDefaultStatementOptimizationData(): StatementOptimizationData {
    return {
      isTerminal: false,
      alwaysExecutes: true,
      conditionalExecution: false,
      loopStatement: false,
      deadCodeCandidate: false,
      unreachableCode: false,
      constantCondition: false,
      emptyStatement: false,
      executionFrequency: 'normal',
      criticalPath: false,
      hotPath: false,
      branchInstruction: false,
      jumpInstruction: false,
      hardwareInteraction: false,
    };
  }

  /**
   * Create default block optimization metadata.
   */
  private createDefaultBlockOptimizationData(): BlockOptimizationData {
    return {
      statementCount: 0,
      expressionCount: 0,
      variableAccesses: [],
      deadCodeElimination: [],
      commonSubexpressions: [],
      constantPropagation: [],
      loopOptimizations: [],
      estimatedCycles: 0,
      codeSize: 0,
      hotPath: false,
      criticalSection: false,
    };
  }

  // ============================================================================
  // ERROR HANDLING METHODS
  // ============================================================================

  /**
   * Add semantic error to the error list.
   */
  private addError(error: SemanticError): void {
    this.errors.push(error);
  }

  /**
   * Add semantic warning to the warning list.
   */
  private addWarning(warning: SemanticError): void {
    this.warnings.push(warning);
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Get all accumulated errors.
   */
  getErrors(): SemanticError[] {
    return [...this.errors];
  }

  /**
   * Get all accumulated warnings.
   */
  getWarnings(): SemanticError[] {
    return [...this.warnings];
  }

  /**
   * Clear all errors and warnings.
   */
  clearErrors(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Get optimization metadata for an expression.
   */
  getOptimizationMetadata(expr: Expression): ExpressionOptimizationData | undefined {
    return this.optimizationMetadata.get(expr);
  }

  /**
   * Get statement metadata.
   */
  getStatementMetadata(stmt: Statement): StatementOptimizationData | undefined {
    return this.statementMetadata.get(stmt);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create expression context with optional overrides.
 */
export function createExpressionContext(
  options: Partial<ExpressionContext> = {}
): ExpressionContext {
  return {
    loopDepth: 0,
    inHotPath: false,
    inCondition: false,
    inAssignment: false,
    hardwareContext: 'normal',
    optimizationLevel: 'balanced',
    ...options,
  };
}
