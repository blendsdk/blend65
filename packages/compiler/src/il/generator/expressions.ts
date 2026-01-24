/**
 * IL Expression Generator - Part 1: Foundation and Literals
 *
 * Generates IL for expressions. Extends ILStatementGenerator to override
 * the generateExpression hook with actual expression generation.
 *
 * This file is Phase 4 of the IL generator implementation.
 * Expression types handled:
 * - Literal expressions (numbers, booleans, strings)
 * - More types will be added in subsequent steps
 *
 * @module il/generator/expressions
 */

import type { Expression } from '../../ast/base.js';
import type { SymbolTable } from '../../semantic/symbol-table.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILFunction } from '../function.js';
import type { VirtualRegister } from '../values.js';

import { ASTNodeType } from '../../ast/base.js';
import { LiteralExpression, IdentifierExpression, BinaryExpression, UnaryExpression, CallExpression, IndexExpression, AssignmentExpression } from '../../ast/nodes.js';
import { TokenType } from '../../lexer/types.js';
import { IL_BYTE } from '../types.js';
import { ILStatementGenerator } from './statements.js';

// =============================================================================
// ILExpressionGenerator Class
// =============================================================================

/**
 * Generates IL for expressions.
 *
 * This class extends ILStatementGenerator to provide expression-level
 * generation capabilities. It overrides the generateExpression hook
 * to produce actual IL instructions for expressions.
 *
 * @example
 * ```typescript
 * const generator = new ILExpressionGenerator(symbolTable, targetConfig);
 * const result = generator.generateModule(program);
 * ```
 */
export class ILExpressionGenerator extends ILStatementGenerator {
  /**
   * Creates a new expression generator.
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param targetConfig - Optional target configuration
   */
  constructor(symbolTable: SymbolTable, targetConfig: TargetConfig | null = null) {
    super(symbolTable, targetConfig);
  }

  // ===========================================================================
  // Expression Generation Entry Point
  // ===========================================================================

  /**
   * Generates IL for an expression.
   *
   * Overrides the hook from ILStatementGenerator to dispatch to
   * the appropriate expression handler based on node type.
   *
   * @param expr - Expression to generate
   * @param ilFunc - Current IL function
   * @returns Virtual register containing result, or null on error
   */
  protected override generateExpression(
    expr: Expression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    switch (expr.getNodeType()) {
      case ASTNodeType.LITERAL_EXPR:
        return this.generateLiteralExpression(expr as LiteralExpression);

      case ASTNodeType.IDENTIFIER_EXPR:
        return this.generateIdentifierExpression(expr as IdentifierExpression, ilFunc);

      case ASTNodeType.BINARY_EXPR:
        return this.generateBinaryExpression(expr as BinaryExpression, ilFunc);

      case ASTNodeType.UNARY_EXPR:
        return this.generateUnaryExpression(expr as UnaryExpression, ilFunc);

      case ASTNodeType.CALL_EXPR:
        return this.generateCallExpression(expr as CallExpression, ilFunc);

      case ASTNodeType.INDEX_EXPR:
        return this.generateIndexExpression(expr as IndexExpression, ilFunc);

      case ASTNodeType.ASSIGNMENT_EXPR:
        return this.generateAssignmentExpression(expr as AssignmentExpression, ilFunc);

      default:
        // Not yet implemented - return placeholder
        this.addWarning(
          `Expression type not yet implemented: ${expr.getNodeType()}`,
          expr.getLocation(),
          'W_EXPR_NOT_IMPLEMENTED',
        );
        return this.builder?.emitConstBool(true) ?? null;
    }
  }

  // ===========================================================================
  // Literal Expression Generation (Task 4.2)
  // ===========================================================================

  /**
   * Generates IL for a literal expression.
   *
   * Handles numeric, boolean, and string literals by emitting
   * appropriate CONST instructions.
   *
   * @param expr - Literal expression
   * @returns Virtual register containing the constant value
   */
  protected generateLiteralExpression(expr: LiteralExpression): VirtualRegister | null {
    const value = expr.getValue();

    // Handle numeric literals
    if (typeof value === 'number') {
      return this.generateNumericLiteral(value);
    }

    // Handle boolean literals
    if (typeof value === 'boolean') {
      return this.builder?.emitConstBool(value) ?? null;
    }

    // Handle string literals
    if (typeof value === 'string') {
      return this.generateStringLiteral(value, expr);
    }

    // Unknown literal type
    this.addError(
      `Unknown literal type: ${typeof value}`,
      expr.getLocation(),
      'E_UNKNOWN_LITERAL',
    );
    return null;
  }

  /**
   * Generates IL for a numeric literal.
   *
   * Determines whether to emit a byte or word constant based on value.
   *
   * @param value - Numeric value
   * @returns Virtual register containing the constant
   */
  protected generateNumericLiteral(value: number): VirtualRegister | null {
    // Use byte for values 0-255, word for larger values
    if (value >= 0 && value <= 255) {
      return this.builder?.emitConstByte(value) ?? null;
    } else if (value >= 0 && value <= 65535) {
      return this.builder?.emitConstWord(value) ?? null;
    } else {
      // Value out of range for 6502
      this.addWarning(
        `Numeric value ${value} out of 16-bit range, using low 16 bits`,
        this.dummyLocation(),
        'W_NUMERIC_OVERFLOW',
      );
      return this.builder?.emitConstWord(value & 0xffff) ?? null;
    }
  }

  /**
   * Generates IL for a string literal.
   *
   * For now, strings are stored as byte arrays and the address is returned.
   * Full string support will be implemented in a later phase.
   *
   * @param value - String value
   * @param expr - Original expression for error reporting
   * @returns Virtual register containing pointer to string data
   */
  protected generateStringLiteral(
    _value: string,
    expr: LiteralExpression,
  ): VirtualRegister | null {
    // TODO: Implement proper string literal handling with _value
    // For now, emit a placeholder address
    this.addWarning(
      'String literal support not fully implemented',
      expr.getLocation(),
      'W_STRING_NOT_IMPLEMENTED',
    );

    // Return a placeholder byte (0) for now
    return this.builder?.emitConstByte(0) ?? null;
  }

  // ===========================================================================
  // Identifier Expression Generation (Task 4.3)
  // ===========================================================================

  /**
   * Generates IL for an identifier expression.
   *
   * Looks up the variable in the local or global scope and emits
   * a LOAD_VAR instruction to read its value.
   *
   * @param expr - Identifier expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the variable's value
   */
  protected generateIdentifierExpression(
    expr: IdentifierExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const name = expr.getName();

    // Check if it's a local variable first
    const localInfo = this.getLocalVariable(name);
    if (localInfo) {
      // Emit LOAD_VAR instruction
      return this.builder?.emitLoadVar(name, localInfo.type) ?? null;
    }

    // Check if it's a parameter
    const paramReg = ilFunc.getParameterRegisterByName(name);
    if (paramReg) {
      // Parameters are already in registers - emit LOAD_VAR
      return this.builder?.emitLoadVar(name, paramReg.type) ?? null;
    }

    // Check global variable mapping
    const mapping = this.getVariableMapping(name);
    if (mapping) {
      // Global variable - emit LOAD_VAR with appropriate type
      const globalType = mapping.symbol.type
        ? this.convertType(mapping.symbol.type)
        : IL_BYTE;
      return this.builder?.emitLoadVar(name, globalType) ?? null;
    }

    // Variable not found - error
    this.addError(
      `Undefined variable: ${name}`,
      expr.getLocation(),
      'E_UNDEFINED_VAR',
    );
    return null;
  }

  // ===========================================================================
  // Binary Expression Generation (Task 4.4)
  // ===========================================================================

  /**
   * Generates IL for a binary expression.
   *
   * Generates both operands, then emits the appropriate binary instruction.
   * Handles arithmetic, comparison, logical, and bitwise operators.
   *
   * @param expr - Binary expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the result
   */
  protected generateBinaryExpression(
    expr: BinaryExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const operator = expr.getOperator();

    // Generate left operand
    const leftReg = this.generateExpression(expr.getLeft(), ilFunc);
    if (!leftReg) {
      return null;
    }

    // Generate right operand
    const rightReg = this.generateExpression(expr.getRight(), ilFunc);
    if (!rightReg) {
      return null;
    }

    // Emit the appropriate binary operation
    return this.emitBinaryOperation(operator, leftReg, rightReg, expr);
  }

  /**
   * Emits the appropriate binary operation instruction.
   *
   * @param operator - Token type of the operator
   * @param left - Left operand register
   * @param right - Right operand register
   * @param expr - Original expression for error reporting
   * @returns Result register
   */
  protected emitBinaryOperation(
    operator: TokenType,
    left: VirtualRegister,
    right: VirtualRegister,
    expr: BinaryExpression,
  ): VirtualRegister | null {
    switch (operator) {
      // Arithmetic operators
      case TokenType.PLUS:
        return this.builder?.emitAdd(left, right) ?? null;
      case TokenType.MINUS:
        return this.builder?.emitSub(left, right) ?? null;
      case TokenType.MULTIPLY:
        return this.builder?.emitMul(left, right) ?? null;
      case TokenType.DIVIDE:
        return this.builder?.emitDiv(left, right) ?? null;
      case TokenType.MODULO:
        return this.builder?.emitMod(left, right) ?? null;

      // Comparison operators
      case TokenType.EQUAL:
        return this.builder?.emitCmpEq(left, right) ?? null;
      case TokenType.NOT_EQUAL:
        return this.builder?.emitCmpNe(left, right) ?? null;
      case TokenType.LESS_THAN:
        return this.builder?.emitCmpLt(left, right) ?? null;
      case TokenType.LESS_EQUAL:
        return this.builder?.emitCmpLe(left, right) ?? null;
      case TokenType.GREATER_THAN:
        return this.builder?.emitCmpGt(left, right) ?? null;
      case TokenType.GREATER_EQUAL:
        return this.builder?.emitCmpGe(left, right) ?? null;

      // Bitwise operators
      case TokenType.BITWISE_AND:
        return this.builder?.emitAnd(left, right) ?? null;
      case TokenType.BITWISE_OR:
        return this.builder?.emitOr(left, right) ?? null;
      case TokenType.BITWISE_XOR:
        return this.builder?.emitXor(left, right) ?? null;
      case TokenType.LEFT_SHIFT:
        return this.builder?.emitShl(left, right) ?? null;
      case TokenType.RIGHT_SHIFT:
        return this.builder?.emitShr(left, right) ?? null;

      // Logical operators (non-short-circuit for now)
      case TokenType.AND:
        return this.builder?.emitAnd(left, right) ?? null;
      case TokenType.OR:
        return this.builder?.emitOr(left, right) ?? null;

      default:
        this.addError(
          `Unsupported binary operator: ${operator}`,
          expr.getLocation(),
          'E_UNSUPPORTED_OP',
        );
        return null;
    }
  }

  // ===========================================================================
  // Unary Expression Generation (Task 4.5)
  // ===========================================================================

  /**
   * Generates IL for a unary expression.
   *
   * Handles negation, logical not, bitwise not, and address-of operators.
   *
   * @param expr - Unary expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the result
   */
  protected generateUnaryExpression(
    expr: UnaryExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const operator = expr.getOperator();
    const operand = expr.getOperand();

    // Generate operand
    const operandReg = this.generateExpression(operand, ilFunc);
    if (!operandReg) {
      return null;
    }

    // Emit appropriate unary operation
    switch (operator) {
      case TokenType.MINUS:
        // Arithmetic negation
        return this.builder?.emitNeg(operandReg) ?? null;

      case TokenType.NOT:
        // Logical NOT
        return this.builder?.emitLogicalNot(operandReg) ?? null;

      case TokenType.BITWISE_NOT:
        // Bitwise NOT
        return this.builder?.emitNot(operandReg) ?? null;

      case TokenType.ADDRESS:
        // Address-of operator (@)
        // For now, this is a placeholder - full implementation depends on backend
        this.addWarning(
          'Address-of operator not fully implemented',
          expr.getLocation(),
          'W_ADDRESS_NOT_IMPLEMENTED',
        );
        return operandReg;

      default:
        this.addError(
          `Unsupported unary operator: ${operator}`,
          expr.getLocation(),
          'E_UNSUPPORTED_OP',
        );
        return null;
    }
  }

  // ===========================================================================
  // Call Expression Generation (Task 4.6)
  // ===========================================================================

  /**
   * Generates IL for a call expression.
   *
   * Generates arguments, checks for intrinsics, and emits CALL instruction.
   *
   * @param expr - Call expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the return value (if any)
   */
  protected generateCallExpression(
    expr: CallExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const callee = expr.getCallee();
    const args = expr.getArguments();

    // Get function name from callee
    const funcName = this.getCalleeFunction(callee);
    if (!funcName) {
      this.addError(
        'Cannot determine function name from callee expression',
        expr.getLocation(),
        'E_INVALID_CALLEE',
      );
      return null;
    }

    // Generate argument expressions
    const argRegs: VirtualRegister[] = [];
    for (const arg of args) {
      const argReg = this.generateExpression(arg, ilFunc);
      if (!argReg) {
        return null;
      }
      argRegs.push(argReg);
    }

    // Check if this is an intrinsic function
    const intrinsicInfo = this.getIntrinsicInfo(funcName);
    if (intrinsicInfo) {
      return this.generateIntrinsicCall(funcName, argRegs, intrinsicInfo, expr);
    }

    // Look up the function to determine return type
    const funcSymbol = this.symbolTable.lookup(funcName);
    if (!funcSymbol || !funcSymbol.type || !funcSymbol.type.signature) {
      // Unknown function - emit void call and warn
      this.addWarning(
        `Unknown function '${funcName}', assuming void return`,
        expr.getLocation(),
        'W_UNKNOWN_FUNCTION',
      );
      this.builder?.emitCallVoid(funcName, argRegs);
      return null;
    }

    // Emit call based on return type
    const returnType = this.convertType(funcSymbol.type.signature.returnType);
    if (returnType.kind === 'void') {
      this.builder?.emitCallVoid(funcName, argRegs);
      return null;
    } else {
      return this.builder?.emitCall(funcName, argRegs, returnType) ?? null;
    }
  }

  /**
   * Gets the function name from a callee expression.
   *
   * @param callee - Callee expression
   * @returns Function name, or null if cannot be determined
   */
  protected getCalleeFunction(callee: Expression): string | null {
    if (callee.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
      return (callee as IdentifierExpression).getName();
    }
    // TODO: Handle member expressions for method calls
    return null;
  }

  /**
   * Generates IL for an intrinsic function call.
   *
   * Intrinsic functions are handled specially and may emit
   * different instructions than regular calls. This includes:
   * - Memory intrinsics: peek, poke, peekw, pokew
   * - Byte extraction: lo, hi
   * - CPU control: sei, cli, nop, brk
   * - Stack operations: pha, pla, php, plp
   * - Optimization: barrier, volatile_read, volatile_write
   * - Compile-time: sizeof, length
   *
   * @param name - Intrinsic function name
   * @param args - Argument registers
   * @param info - Intrinsic info
   * @param expr - Original expression for error reporting
   * @returns Result register
   */
  protected generateIntrinsicCall(
    name: string,
    args: VirtualRegister[],
    info: import('./declarations.js').IntrinsicInfo,
    expr: CallExpression,
  ): VirtualRegister | null {
    // Handle known intrinsics
    switch (name) {
      // =========================================================================
      // Memory Intrinsics - Byte Access
      // =========================================================================
      case 'peek':
        // peek(address) - read byte from memory
        if (args.length !== 1) {
          this.addError('peek() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitPeek(args[0]) ?? null;

      case 'poke':
        // poke(address, value) - write byte to memory
        if (args.length !== 2) {
          this.addError('poke() requires exactly 2 arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitPoke(args[0], args[1]);
        return null;

      // =========================================================================
      // Memory Intrinsics - Word Access
      // =========================================================================
      case 'peekw':
        // peekw(address) - read word (16-bit) from memory
        if (args.length !== 1) {
          this.addError('peekw() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitPeekw(args[0]) ?? null;

      case 'pokew':
        // pokew(address, value) - write word (16-bit) to memory
        if (args.length !== 2) {
          this.addError('pokew() requires exactly 2 arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitPokew(args[0], args[1]);
        return null;

      // =========================================================================
      // Byte Extraction Intrinsics
      // =========================================================================
      case 'lo':
        // lo(value) - extract low byte from word
        if (args.length !== 1) {
          this.addError('lo() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitLo(args[0]) ?? null;

      case 'hi':
        // hi(value) - extract high byte from word
        if (args.length !== 1) {
          this.addError('hi() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitHi(args[0]) ?? null;

      // =========================================================================
      // CPU Control Intrinsics
      // =========================================================================
      case 'sei':
        // sei() - set interrupt disable flag
        if (args.length !== 0) {
          this.addError('sei() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitSei();
        return null;

      case 'cli':
        // cli() - clear interrupt disable flag
        if (args.length !== 0) {
          this.addError('cli() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitCli();
        return null;

      case 'nop':
        // nop() - no operation (timing/padding)
        if (args.length !== 0) {
          this.addError('nop() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitNop();
        return null;

      case 'brk':
        // brk() - break (software interrupt)
        if (args.length !== 0) {
          this.addError('brk() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitBrk();
        return null;

      // =========================================================================
      // Stack Operation Intrinsics
      // =========================================================================
      case 'pha':
        // pha() - push accumulator to stack
        if (args.length !== 0) {
          this.addError('pha() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitPha();
        return null;

      case 'pla':
        // pla() - pull accumulator from stack (returns byte)
        if (args.length !== 0) {
          this.addError('pla() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitPla() ?? null;

      case 'php':
        // php() - push processor status to stack
        if (args.length !== 0) {
          this.addError('php() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitPhp();
        return null;

      case 'plp':
        // plp() - pull processor status from stack
        if (args.length !== 0) {
          this.addError('plp() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitPlp();
        return null;

      // =========================================================================
      // Optimization Control Intrinsics
      // =========================================================================
      case 'barrier':
        // barrier() - optimization barrier, prevents reordering
        if (args.length !== 0) {
          this.addError('barrier() takes no arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitOptBarrier();
        return null;

      case 'volatile_read':
        // volatile_read(address) - read that cannot be optimized away
        if (args.length !== 1) {
          this.addError('volatile_read() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        return this.builder?.emitVolatileRead(args[0]) ?? null;

      case 'volatile_write':
        // volatile_write(address, value) - write that cannot be optimized away
        if (args.length !== 2) {
          this.addError('volatile_write() requires exactly 2 arguments', expr.getLocation(), 'E_INTRINSIC_ARGS');
          return null;
        }
        this.builder?.emitVolatileWrite(args[0], args[1]);
        return null;

      // =========================================================================
      // Compile-Time Intrinsics
      // =========================================================================
      case 'sizeof':
        // sizeof(type) - returns size of type at compile time
        // Note: This requires special handling as the argument is a type, not a value
        // For now, emit placeholder - full implementation needs type expression support
        return this.generateSizeofIntrinsic(expr);

      case 'length':
        // length(array) - returns array length at compile time
        return this.generateLengthIntrinsic(expr);

      default:
        // Unknown intrinsic - emit regular call
        this.addWarning(
          `Unknown intrinsic '${name}', treating as regular call`,
          expr.getLocation(),
          'W_UNKNOWN_INTRINSIC',
        );
        return this.builder?.emitCall(name, args, info.returnType) ?? null;
    }
  }

  /**
   * Generates IL for the sizeof() compile-time intrinsic.
   *
   * sizeof() returns the size of a type at compile time. This requires
   * special handling because the argument is a type expression, not a value.
   *
   * @param expr - Call expression for sizeof()
   * @returns Virtual register containing the constant size value
   */
  protected generateSizeofIntrinsic(expr: CallExpression): VirtualRegister | null {
    const args = expr.getArguments();

    if (args.length !== 1) {
      this.addError('sizeof() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
      return null;
    }

    // Get the argument - should be a type identifier
    const arg = args[0];

    if (arg.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
      const typeName = (arg as IdentifierExpression).getName();

      // Look up the type size
      const size = this.getTypeSizeByName(typeName);
      if (size !== null) {
        return this.builder?.emitConstWord(size) ?? null;
      }

      // Check if it's a variable and get its type size
      const symbol = this.symbolTable.lookup(typeName);
      if (symbol && symbol.type) {
        const varSize = symbol.type.size ?? 1;
        return this.builder?.emitConstWord(varSize) ?? null;
      }

      this.addError(
        `Cannot determine size of '${typeName}'`,
        expr.getLocation(),
        'E_SIZEOF_UNKNOWN_TYPE',
      );
      return null;
    }

    // Argument is not a simple identifier
    this.addError(
      'sizeof() requires a type or variable name',
      expr.getLocation(),
      'E_SIZEOF_INVALID_ARG',
    );
    return null;
  }

  /**
   * Gets the size of a type by its name.
   *
   * @param typeName - Type name (e.g., 'byte', 'word', 'bool')
   * @returns Size in bytes, or null if unknown
   */
  protected getTypeSizeByName(typeName: string): number | null {
    switch (typeName.toLowerCase()) {
      case 'byte':
      case 'u8':
      case 'i8':
      case 'bool':
        return 1;
      case 'word':
      case 'u16':
      case 'i16':
        return 2;
      case 'void':
        return 0;
      default:
        return null;
    }
  }

  /**
   * Generates IL for the length() compile-time intrinsic.
   *
   * length() returns the length of an array or string at compile time.
   * The argument must be a variable with a known compile-time size.
   *
   * @param expr - Call expression for length()
   * @returns Virtual register containing the constant length value
   */
  protected generateLengthIntrinsic(expr: CallExpression): VirtualRegister | null {
    const args = expr.getArguments();

    if (args.length !== 1) {
      this.addError('length() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
      return null;
    }

    const arg = args[0];

    // Check if argument is an identifier (array/string variable name)
    if (arg.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
      const varName = (arg as IdentifierExpression).getName();

      // Look up the variable in symbol table
      const symbol = this.symbolTable.lookup(varName);
      if (symbol && symbol.type) {
        // Check for array type with known size
        if (symbol.type.arraySize !== undefined && symbol.type.arraySize !== null) {
          return this.builder?.emitConstWord(symbol.type.arraySize) ?? null;
        }

        // Check for string type with known length
        if (symbol.type.kind === 'string' && symbol.type.size !== undefined) {
          // String size includes null terminator, length does not
          const stringLength = Math.max(0, symbol.type.size - 1);
          return this.builder?.emitConstWord(stringLength) ?? null;
        }

        // Check for array type element count
        if (symbol.type.elementType !== undefined && symbol.type.size !== undefined) {
          const elementSize = symbol.type.elementType.size ?? 1;
          const arrayLength = Math.floor(symbol.type.size / elementSize);
          return this.builder?.emitConstWord(arrayLength) ?? null;
        }
      }

      this.addError(
        `Cannot determine length of '${varName}' - must be an array or string with known size`,
        expr.getLocation(),
        'E_LENGTH_UNKNOWN_SIZE',
      );
      return null;
    }

    // Argument is not a variable reference
    this.addError(
      'length() requires an array or string variable',
      expr.getLocation(),
      'E_LENGTH_INVALID_ARG',
    );
    return null;
  }

  // ===========================================================================
  // Index Expression Generation (Task 4.7)
  // ===========================================================================

  /**
   * Generates IL for an index expression (array access).
   *
   * Emits LOAD_ARRAY instruction to read array element.
   *
   * @param expr - Index expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the element value
   */
  protected generateIndexExpression(
    expr: IndexExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const obj = expr.getObject();
    const index = expr.getIndex();

    // Get the array name
    const arrayName = this.getArrayName(obj);
    if (!arrayName) {
      this.addError(
        'Cannot determine array name for indexing',
        expr.getLocation(),
        'E_INVALID_ARRAY',
      );
      return null;
    }

    // Generate index expression
    const indexReg = this.generateExpression(index, ilFunc);
    if (!indexReg) {
      return null;
    }

    // Get element type from array type
    const elementType = this.getArrayElementType(arrayName);

    // Emit LOAD_ARRAY instruction
    return this.builder?.emitLoadArray(arrayName, indexReg, elementType) ?? null;
  }

  /**
   * Gets the array name from an expression.
   *
   * @param expr - Expression that should resolve to an array
   * @returns Array name, or null if cannot be determined
   */
  protected getArrayName(expr: Expression): string | null {
    if (expr.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
      return (expr as IdentifierExpression).getName();
    }
    return null;
  }

  /**
   * Gets the element type of an array.
   *
   * @param arrayName - Array variable name
   * @returns Element type (defaults to byte)
   */
  protected getArrayElementType(arrayName: string): import('../types.js').ILType {
    // Check local variables
    const localInfo = this.getLocalVariable(arrayName);
    if (localInfo && localInfo.type.kind === 'array') {
      return (localInfo.type as import('../types.js').ILArrayType).elementType;
    }

    // Check global variable mapping
    const mapping = this.getVariableMapping(arrayName);
    if (mapping && mapping.symbol.type?.elementType) {
      return this.convertType(mapping.symbol.type.elementType);
    }

    // Default to byte
    return IL_BYTE;
  }

  // ===========================================================================
  // Assignment Expression Generation (Task 4.8)
  // ===========================================================================

  /**
   * Generates IL for an assignment expression.
   *
   * Handles simple assignment (=) and compound assignments (+=, -=, etc.).
   *
   * @param expr - Assignment expression
   * @param ilFunc - Current IL function
   * @returns Virtual register containing the assigned value
   */
  protected generateAssignmentExpression(
    expr: AssignmentExpression,
    ilFunc: ILFunction,
  ): VirtualRegister | null {
    const target = expr.getTarget();
    const operator = expr.getOperator();
    const value = expr.getValue();

    // Generate the value to assign
    let valueReg = this.generateExpression(value, ilFunc);
    if (!valueReg) {
      return null;
    }

    // Handle compound assignments
    if (operator !== TokenType.ASSIGN) {
      // Load current value
      const currentReg = this.generateExpression(target, ilFunc);
      if (!currentReg) {
        return null;
      }

      // Apply compound operation
      valueReg = this.emitCompoundOperation(operator, currentReg, valueReg, expr);
      if (!valueReg) {
        return null;
      }
    }

    // Store to target
    this.storeToTarget(target, valueReg, ilFunc, expr);

    // Return the assigned value
    return valueReg;
  }

  /**
   * Emits the operation for a compound assignment.
   *
   * @param operator - Compound assignment operator
   * @param current - Current value register
   * @param value - Value to apply
   * @param expr - Original expression for error reporting
   * @returns Result register
   */
  protected emitCompoundOperation(
    operator: TokenType,
    current: VirtualRegister,
    value: VirtualRegister,
    expr: AssignmentExpression,
  ): VirtualRegister | null {
    switch (operator) {
      case TokenType.PLUS_ASSIGN:
        return this.builder?.emitAdd(current, value) ?? null;
      case TokenType.MINUS_ASSIGN:
        return this.builder?.emitSub(current, value) ?? null;
      case TokenType.MULTIPLY_ASSIGN:
        return this.builder?.emitMul(current, value) ?? null;
      case TokenType.DIVIDE_ASSIGN:
        return this.builder?.emitDiv(current, value) ?? null;
      case TokenType.MODULO_ASSIGN:
        return this.builder?.emitMod(current, value) ?? null;
      case TokenType.BITWISE_AND_ASSIGN:
        return this.builder?.emitAnd(current, value) ?? null;
      case TokenType.BITWISE_OR_ASSIGN:
        return this.builder?.emitOr(current, value) ?? null;
      case TokenType.BITWISE_XOR_ASSIGN:
        return this.builder?.emitXor(current, value) ?? null;
      case TokenType.LEFT_SHIFT_ASSIGN:
        return this.builder?.emitShl(current, value) ?? null;
      case TokenType.RIGHT_SHIFT_ASSIGN:
        return this.builder?.emitShr(current, value) ?? null;
      default:
        this.addError(
          `Unsupported compound assignment: ${operator}`,
          expr.getLocation(),
          'E_UNSUPPORTED_OP',
        );
        return null;
    }
  }

  /**
   * Stores a value to an assignment target.
   *
   * @param target - Target expression (lvalue)
   * @param value - Value register to store
   * @param ilFunc - Current IL function
   * @param expr - Original expression for error reporting
   */
  protected storeToTarget(
    target: Expression,
    value: VirtualRegister,
    ilFunc: ILFunction,
    expr: AssignmentExpression,
  ): void {
    const nodeType = target.getNodeType();

    if (nodeType === ASTNodeType.IDENTIFIER_EXPR) {
      // Simple variable assignment
      const name = (target as IdentifierExpression).getName();
      this.builder?.emitStoreVar(name, value);
    } else if (nodeType === ASTNodeType.INDEX_EXPR) {
      // Array element assignment
      const indexExpr = target as IndexExpression;
      const arrayName = this.getArrayName(indexExpr.getObject());
      if (arrayName) {
        const indexReg = this.generateExpression(indexExpr.getIndex(), ilFunc);
        if (indexReg) {
          this.builder?.emitStoreArray(arrayName, indexReg, value);
        }
      }
    } else {
      this.addError(
        `Invalid assignment target: ${nodeType}`,
        expr.getLocation(),
        'E_INVALID_LVALUE',
      );
    }
  }
}