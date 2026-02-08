/**
 * IL Generator - Expressions Layer
 *
 * Expression generation:
 * - Literal expressions (numbers, booleans)
 * - Identifier expressions (variable loads)
 * - Binary expressions (arithmetic, bitwise, comparison)
 * - Unary expressions (negation, not)
 * - Assignment expressions (store to slot)
 * - Call expressions (function calls)
 *
 * @module il/generator/expressions
 */

import { Expression } from '../../ast/base.js';
import {
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
  UnaryExpression,
  AssignmentExpression,
  CallExpression,
  TernaryExpression,
  IndexExpression,
} from '../../ast/expressions.js';
import {
  isLiteralExpression,
  isIdentifierExpression,
  isBinaryExpression,
  isUnaryExpression,
  isAssignmentExpression,
  isCallExpression,
  isTernaryExpression,
  isIndexExpression,
} from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import { SlotLocation } from '../../frame/enums.js';
import { FrameSlot } from '../../frame/types.js';
import { ILOpcode } from '../enums.js';
import { createImmediateOperand } from '../factories.js';
import { isAsmFunction, parseAsmFunctionName, addressingModeRequiresOperand } from '../asm-utils.js';
import { AsmRawOperand } from '../operands.js';
import { ILGeneratorBase } from './base.js';

// ============================================================================
// ILGeneratorExpressions Class
// ============================================================================

/**
 * Expression generation layer.
 *
 * Handles all expression types:
 * - Literals: Load immediate values into accumulator
 * - Identifiers: Load from slot (with register param optimization)
 * - Binary: Arithmetic, bitwise, comparison operations
 * - Unary: Negation, logical/bitwise NOT
 * - Assignment: Store accumulator to slot
 * - Ternary: Conditional expressions
 * - Calls: Function calls (placeholder for Phase 7c)
 */
export class ILGeneratorExpressions extends ILGeneratorBase {
  // ═══════════════════════════════════════════════════════════════════
  // Main Expression Dispatcher
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an expression.
   *
   * Dispatches to specific handlers based on expression type.
   * Result is left in the accumulator (A register).
   *
   * @param expr - Expression to generate
   *
   * @example
   * ```typescript
   * this.generateExpression(someExpr);
   * // A register now contains result
   * this.builder.storeSlot(targetSlot);
   * ```
   */
  protected generateExpression(expr: Expression): void {
    if (isLiteralExpression(expr)) {
      this.generateLiteral(expr);
    } else if (isIdentifierExpression(expr)) {
      this.generateIdentifier(expr);
    } else if (isBinaryExpression(expr)) {
      this.generateBinary(expr);
    } else if (isUnaryExpression(expr)) {
      this.generateUnary(expr);
    } else if (isAssignmentExpression(expr)) {
      this.generateAssignment(expr);
    } else if (isTernaryExpression(expr)) {
      this.generateTernary(expr);
    } else if (isCallExpression(expr)) {
      this.generateCall(expr);
    } else if (isIndexExpression(expr)) {
      this.generateIndex(expr);
    } else {
      // Unknown expression type - emit NOP as placeholder
      this.builder.nop();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Literal Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a literal value.
   *
   * Loads the immediate value into the accumulator:
   * - Numbers: LDA #value
   * - Booleans: LDA #0 or LDA #1
   *
   * @param expr - Literal expression
   */
  protected generateLiteral(expr: LiteralExpression): void {
    const value = expr.getValue();
    this.setLocation(expr.getLocation());

    if (typeof value === 'number') {
      // Numeric literal - load immediate
      this.builder.loadImm(value, `literal ${value}`);
    } else if (typeof value === 'boolean') {
      // Boolean literal - 0 or 1
      this.builder.loadImm(value ? 1 : 0, value ? 'true' : 'false');
    } else {
      // String literal - TODO: handle in Phase 7c
      this.builder.loadImm(0, 'string (placeholder)');
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Identifier Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an identifier (variable reference).
   *
   * Loads the variable's value into the accumulator:
   * - Register parameters: Transfer from X/Y register
   * - Memory slots: Load from memory address
   *
   * @param expr - Identifier expression
   */
  protected generateIdentifier(expr: IdentifierExpression): void {
    const name = expr.getName();
    this.setLocation(expr.getLocation());

    const slot = this.tryResolveVariable(name);

    if (!slot) {
      // Not a local variable - might be intrinsic or global
      // Emit placeholder for now (will be handled in Phase 7c)
      this.builder.nop();
      this.clearLocation();
      return;
    }

    // Check for register parameter (no memory load needed!)
    if (slot.location === SlotLocation.Register) {
      this.generateRegisterLoad(slot);
    } else {
      // Memory slot - load from address
      this.builder.loadSlot(slot, `load ${name}`);
    }

    this.clearLocation();
  }

  /**
   * Generate register transfer for register-passed parameters.
   *
   * @param slot - Slot in register
   */
  protected generateRegisterLoad(slot: FrameSlot): void {
    switch (slot.register) {
      case 'X':
        this.builder.transferXA();
        break;
      case 'Y':
        this.builder.transferYA();
        break;
      case 'A':
        // Already in accumulator - no transfer needed
        break;
      default:
        // Unknown register - should not happen
        throw new Error(`Unknown register: ${slot.register}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Index Expression (Array Element Access)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for array element access (arr[index]).
   *
   * Strategy:
   * 1. Get the base array slot
   * 2. Generate index expression into Y register
   * 3. Use indexed addressing mode to load the element
   *
   * For byte arrays: LOAD_INDEXED with base slot and Y
   *
   * @param expr - Index expression (e.g., arr[i])
   */
  protected generateIndex(expr: IndexExpression): void {
    this.setLocation(expr.getLocation());

    const obj = expr.getObject();
    const index = expr.getIndex();

    // Get the array base slot
    if (isIdentifierExpression(obj)) {
      const arrayName = obj.getName();
      const arraySlot = this.tryResolveVariable(arrayName);

      if (!arraySlot) {
        // Array not found - emit placeholder
        this.builder.nop();
        this.clearLocation();
        return;
      }

      // Check if index is a literal for optimization
      if (isLiteralExpression(index)) {
        const indexValue = index.getValue();
        if (typeof indexValue === 'number') {
          // Static index - can compute address at compile time
          // Load from base + offset directly
          this.builder.loadIndexedImm(arraySlot, indexValue, `${arrayName}[${indexValue}]`);
          this.clearLocation();
          return;
        }
      }

      // Dynamic index - need to use Y register for indexing
      // Generate index into A, transfer to Y, then use indexed load
      this.generateExpression(index);
      this.builder.transferAY();
      this.builder.loadIndexedY(arraySlot, `${arrayName}[Y]`);
    } else {
      // Complex base expression - not yet supported
      this.builder.nop();
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Binary Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a binary expression.
   *
   * Strategy:
   * 1. Generate left operand (result in A)
   * 2. If right is immediate: Use immediate instruction
   * 3. If right is identifier: Use slot instruction
   * 4. Otherwise: Push A, generate right, operate
   *
   * @param expr - Binary expression
   */
  protected generateBinary(expr: BinaryExpression): void {
    this.setLocation(expr.getLocation());

    // Generate left operand first (result in A)
    this.generateExpression(expr.getLeft());

    const right = expr.getRight();
    const op = expr.getOperator();

    // Optimization: Check for immediate right operand
    if (isLiteralExpression(right)) {
      const value = right.getValue();
      if (typeof value === 'number') {
        this.generateBinaryImmediate(op, value);
        this.clearLocation();
        return;
      }
    }

    // Optimization: Check for slot right operand
    if (isIdentifierExpression(right)) {
      const slot = this.tryResolveVariable(right.getName());
      if (slot && slot.location !== SlotLocation.Register) {
        this.generateBinarySlot(op, slot);
        this.clearLocation();
        return;
      }
    }

    // Complex right operand - need temporary storage
    // Push left value, generate right, then operate
    this.generateBinaryComplex(op, right);
    this.clearLocation();
  }

  /**
   * Generate binary operation with immediate operand.
   *
   * @param op - Operator token type
   * @param value - Immediate value
   */
  protected generateBinaryImmediate(op: TokenType, value: number): void {
    switch (op) {
      case TokenType.PLUS:
        this.builder.addImm(value);
        break;
      case TokenType.MINUS:
        this.builder.subImm(value);
        break;
      case TokenType.BITWISE_AND:
        this.builder.andImm(value);
        break;
      case TokenType.BITWISE_OR:
        this.builder.orImm(value);
        break;
      case TokenType.BITWISE_XOR:
        this.builder.xorImm(value);
        break;
      case TokenType.MULTIPLY:
        this.builder.mulImm(value);
        break;
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        // Comparison: CMP, then result depends on branch
        this.builder.cmpImm(value);
        break;
      default:
        // Other operators need full evaluation
        this.builder.emit(ILOpcode.PUSH_A, []);
        this.builder.loadImm(value);
        this.generateBinaryComplexOp(op);
    }
  }

  /**
   * Generate binary operation with slot operand.
   *
   * @param op - Operator token type
   * @param slot - Right operand slot
   */
  protected generateBinarySlot(op: TokenType, slot: FrameSlot): void {
    switch (op) {
      case TokenType.PLUS:
        this.builder.addSlot(slot);
        break;
      case TokenType.MINUS:
        this.builder.subSlot(slot);
        break;
      case TokenType.MULTIPLY:
        this.builder.mulSlot(slot);
        break;
      case TokenType.DIVIDE:
        this.builder.divSlot(slot);
        break;
      case TokenType.MODULO:
        this.builder.modSlot(slot);
        break;
      case TokenType.BITWISE_AND:
        this.builder.andSlot(slot);
        break;
      case TokenType.BITWISE_OR:
        this.builder.orSlot(slot);
        break;
      case TokenType.BITWISE_XOR:
        this.builder.xorSlot(slot);
        break;
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        this.builder.cmpSlot(slot);
        break;
      default:
        // Unsupported slot operation - fallback to complex
        this.builder.emit(ILOpcode.PUSH_A, []);
        this.builder.loadSlot(slot);
        this.generateBinaryComplexOp(op);
    }
  }

  /**
   * Generate binary operation with complex right operand.
   *
   * Strategy for A OP B where B is complex:
   * 1. Compute A (left), push to stack
   * 2. Compute B (right), result in A
   * 3. Save right to temp, pop left to A
   * 4. Execute A OP temp (using _BYTE opcodes)
   *
   * @param op - Operator token type
   * @param right - Right operand expression
   */
  protected generateBinaryComplex(op: TokenType, right: Expression): void {
    // Save left value to stack
    this.builder.emit(ILOpcode.PUSH_A, [], 'save left');

    // Generate right operand (result in A)
    this.generateExpression(right);

    // Now we have: stack = left, A = right
    // For correct operation, we need: A = left OP right
    //
    // For commutative ops (add, and, or, xor), we can swap:
    //   A = right OP stack (pop)
    //
    // For non-commutative ops (sub, cmp), we need proper order:
    //   Save right to temp, pop left to A, then A OP temp

    this.generateBinaryComplexOp(op);
  }

  /**
   * Generate the actual binary operation for complex operands.
   *
   * At entry: stack has left, A has right
   * For commutative ops: A OP stack is same as stack OP A
   * For non-commutative ops: need proper ordering
   *
   * @param op - Operator token type
   */
  protected generateBinaryComplexOp(op: TokenType): void {
    switch (op) {
      // Commutative operations - right OP left = left OP right
      case TokenType.PLUS:
        // right + left: ADD right with popped left
        // Save right temp, pop left, add temp
        this.builder.emit(ILOpcode.POP_A, [], 'get left (add)');
        this.builder.emit(ILOpcode.ADD_BYTE, [], 'add right'); // Uses stack
        break;

      case TokenType.BITWISE_AND:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (and)');
        this.builder.emit(ILOpcode.AND_BYTE, [], 'and right');
        break;

      case TokenType.BITWISE_OR:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (or)');
        this.builder.emit(ILOpcode.OR_BYTE, [], 'or right');
        break;

      case TokenType.BITWISE_XOR:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (xor)');
        this.builder.emit(ILOpcode.XOR_BYTE, [], 'xor right');
        break;

      case TokenType.MULTIPLY:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (mul)');
        this.builder.emit(ILOpcode.MUL_BYTE, [], 'mul right');
        break;

      // Non-commutative - need proper left OP right ordering
      case TokenType.MINUS:
        // left - right: We have right in A, left on stack
        // Need: A = left - right
        // Swap: push right, pop left to A, sub with original right
        this.builder.emit(ILOpcode.POP_A, [], 'get left (sub)');
        this.builder.emit(ILOpcode.SUB_BYTE, [], 'sub right');
        break;

      case TokenType.DIVIDE:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (div)');
        this.builder.emit(ILOpcode.DIV_BYTE, [], 'div right');
        break;

      case TokenType.MODULO:
        this.builder.emit(ILOpcode.POP_A, [], 'get left (mod)');
        this.builder.emit(ILOpcode.MOD_BYTE, [], 'mod right');
        break;

      // Comparison operators
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        // Comparison: left CMP right
        // We have right in A, left on stack
        // For proper CMP, we need left in A, compare with right
        this.builder.emit(ILOpcode.POP_A, [], 'get left (cmp)');
        this.builder.emit(ILOpcode.CMP_BYTE, [], 'cmp right');
        break;

      default:
        // Fallback - just pop
        this.builder.emit(ILOpcode.POP_A, [], 'op (unsupported)');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Unary Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a unary expression.
   *
   * @param expr - Unary expression
   */
  protected generateUnary(expr: UnaryExpression): void {
    this.setLocation(expr.getLocation());

    // Generate operand (result in A)
    this.generateExpression(expr.getOperand());

    const op = expr.getOperator();

    switch (op) {
      case TokenType.MINUS:
        // Negate: 0 - value
        // Store A, load 0, subtract stored value
        // For simplicity, use EOR #$FF then INC (two's complement)
        this.builder.emit(
          ILOpcode.XOR_IMM,
          [createImmediateOperand(0xff)],
          'negate step 1'
        );
        // Need to add 1 - but we don't have INC_A directly
        // Use ADC #1 (assuming carry clear)
        this.builder.addImm(1, 'negate step 2');
        break;

      case TokenType.NOT:
        // Logical NOT: 0 becomes 1, non-zero becomes 0
        // Compare with 0, if equal set 1, else set 0
        this.builder.cmpImm(0);
        // After CMP, Z flag is set if A == 0
        // Use branch to set result - placeholder for now
        this.builder.not();
        break;

      case TokenType.BITWISE_NOT:
        // Bitwise NOT: EOR #$FF
        this.builder.not();
        break;

      default:
        // Unknown unary operator
        break;
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Assignment Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an assignment expression.
   *
   * Generates the value expression, then stores to target slot.
   *
   * @param expr - Assignment expression
   */
  protected generateAssignment(expr: AssignmentExpression): void {
    this.setLocation(expr.getLocation());

    const target = expr.getTarget();
    const op = expr.getOperator();
    const value = expr.getValue();

    // Get target slot
    if (!isIdentifierExpression(target)) {
      // Complex target (index, member) - TODO in Phase 7c
      this.generateExpression(value);
      this.clearLocation();
      return;
    }

    const targetName = target.getName();
    const slot = this.resolveVariable(targetName);

    if (op === TokenType.ASSIGN) {
      // Simple assignment: x = value
      this.generateExpression(value);
      this.builder.storeSlot(slot, `${targetName} =`);
    } else {
      // Compound assignment: x += value, x -= value, etc.
      this.generateCompoundAssignment(slot, op, value);
    }

    this.clearLocation();
  }

  /**
   * Generate compound assignment (+=, -=, etc.).
   *
   * @param slot - Target slot
   * @param op - Compound operator
   * @param value - Value expression
   */
  protected generateCompoundAssignment(
    slot: FrameSlot,
    op: TokenType,
    value: Expression
  ): void {
    // Load current value
    this.builder.loadSlot(slot, `load ${slot.name}`);

    // Apply operation
    if (isLiteralExpression(value)) {
      const literalValue = value.getValue();
      if (typeof literalValue === 'number') {
        switch (op) {
          case TokenType.PLUS_ASSIGN:
            this.builder.addImm(literalValue);
            break;
          case TokenType.MINUS_ASSIGN:
            this.builder.subImm(literalValue);
            break;
          case TokenType.BITWISE_AND_ASSIGN:
            this.builder.andImm(literalValue);
            break;
          case TokenType.BITWISE_OR_ASSIGN:
            this.builder.orImm(literalValue);
            break;
          case TokenType.BITWISE_XOR_ASSIGN:
            this.builder.xorImm(literalValue);
            break;
          default:
            // Other compound ops need full generation
            this.builder.emit(ILOpcode.PUSH_A, []);
            this.generateExpression(value);
            this.generateCompoundOperation(op);
        }
      } else {
        this.builder.emit(ILOpcode.PUSH_A, []);
        this.generateExpression(value);
        this.generateCompoundOperation(op);
      }
    } else {
      // Complex value - full generation
      this.builder.emit(ILOpcode.PUSH_A, []);
      this.generateExpression(value);
      this.generateCompoundOperation(op);
    }

    // Store result
    this.builder.storeSlot(slot, `store ${slot.name}`);
  }

  /**
   * Generate the operation for compound assignment.
   *
   * @param op - Compound operator token type
   */
  protected generateCompoundOperation(op: TokenType): void {
    // Stack has old value, A has new value
    // Similar to binary complex case
    switch (op) {
      case TokenType.PLUS_ASSIGN:
      case TokenType.MINUS_ASSIGN:
      case TokenType.MULTIPLY_ASSIGN:
      case TokenType.DIVIDE_ASSIGN:
      case TokenType.MODULO_ASSIGN:
      case TokenType.BITWISE_AND_ASSIGN:
      case TokenType.BITWISE_OR_ASSIGN:
      case TokenType.BITWISE_XOR_ASSIGN:
        this.builder.emit(ILOpcode.POP_A, [], 'compound op');
        break;
      default:
        this.builder.emit(ILOpcode.POP_A, []);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Ternary Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a ternary conditional expression.
   *
   * @param expr - Ternary expression
   */
  protected generateTernary(expr: TernaryExpression): void {
    this.setLocation(expr.getLocation());

    const elseLabel = this.builder.newLabel('ternelse');
    const endLabel = this.builder.newLabel('ternend');

    // Generate condition
    this.generateExpression(expr.getCondition());
    this.builder.cmpImm(0);
    this.builder.jumpEq(elseLabel);

    // Generate then branch
    this.generateExpression(expr.getThenBranch());
    this.builder.jump(endLabel);

    // Generate else branch
    this.builder.label(elseLabel);
    this.generateExpression(expr.getElseBranch());

    this.builder.label(endLabel);
    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Call Expression (Placeholder)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a function call.
   *
   * Handles three categories of calls:
   * 1. asm_* functions → ASM_RAW IL instructions (raw 6502 assembly)
   * 2. Intrinsic functions → Dedicated IL opcodes (peek, poke, hi, lo, etc.)
   * 3. Regular functions → CALL IL instruction
   *
   * @param expr - Call expression
   */
  protected generateCall(expr: CallExpression): void {
    this.setLocation(expr.getLocation());

    const callee = expr.getCallee();
    if (isIdentifierExpression(callee)) {
      const funcName = callee.getName();

      // Check for asm_* functions first (raw 6502 assembly)
      if (isAsmFunction(funcName)) {
        this.generateAsmRaw(funcName, expr.getArguments());
        this.clearLocation();
        return;
      }

      // Check for intrinsics (peek, poke, hi, lo, etc.)
      if (this.isIntrinsic(funcName)) {
        this.generateIntrinsic(funcName, expr.getArguments());
        this.clearLocation();
        return;
      }

      // Regular function call - placeholder
      this.builder.call(funcName, false, -1);
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // ASM_RAW Generation (asm_* functions)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an asm_* function call.
   *
   * Parses the function name to extract the 6502 mnemonic and addressing
   * mode, then emits an ASM_RAW IL instruction. For implied-mode
   * instructions (e.g., asm_sei), no argument is needed. For addressed
   * modes (e.g., asm_lda_imm), the single argument is evaluated first
   * and passed as an immediate operand.
   *
   * @param name - Function name (e.g., 'asm_sei', 'asm_lda_imm')
   * @param args - Call arguments (0 for implied, 1 for addressed modes)
   */
  protected generateAsmRaw(name: string, args: Expression[]): void {
    const parsed = parseAsmFunctionName(name);
    if (!parsed) {
      // Invalid asm_* name - emit NOP as fallback
      this.builder.nop();
      return;
    }

    const { mnemonic, addressingMode } = parsed;

    // Create the AsmRawOperand that carries the 6502 instruction metadata
    const asmRawOp: AsmRawOperand = {
      kind: 'asm_raw',
      mnemonic,
      addressingMode,
    };

    if (addressingModeRequiresOperand(addressingMode)) {
      // Addressed mode (immediate, zeroPage, absolute, etc.)
      // The argument provides the operand value
      if (args.length >= 1) {
        // Generate argument value into accumulator, then push it
        // so ASM_RAW can reference it via immediate operand
        this.generateExpression(args[0]);

        // Emit ASM_RAW with both the asm metadata and the generated operand
        // The value is already in A from generateExpression above.
        // We pass the AsmRawOperand as the first operand for the codegen
        // to know mnemonic + addressing mode.
        this.builder.emit(
          ILOpcode.ASM_RAW,
          [asmRawOp],
          `${name}(arg)`
        );
      } else {
        // Missing argument - emit NOP as fallback
        this.builder.nop();
      }
    } else {
      // Implied mode - no operand needed (e.g., SEI, CLI, NOP, TAX, PHA)
      this.builder.emit(
        ILOpcode.ASM_RAW,
        [asmRawOp],
        `${name}()`
      );
    }
  }

  /**
   * Check if a function name is an intrinsic.
   *
   * @param name - Function name
   * @returns True if intrinsic
   */
  protected isIntrinsic(name: string): boolean {
    const intrinsics = [
      'peek',
      'poke',
      'peekw',
      'pokew',
      'volatile_read',
      'volatile_write',
      'hi',
      'lo',
    ];
    return intrinsics.includes(name);
  }

  /**
   * Generate IL for an intrinsic call.
   *
   * For peek/poke intrinsics, the address is dynamic (from expression),
   * so we use the raw IL opcode rather than the builder's address-based method.
   *
   * @param name - Intrinsic name
   * @param args - Arguments
   */
  protected generateIntrinsic(name: string, args: Expression[]): void {
    switch (name) {
      case 'peek':
        if (args.length >= 1) {
          // Generate address to A, then PEEK reads from (addr) into A
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PEEK, [], 'peek(addr)');
        }
        break;
      case 'poke':
        if (args.length >= 2) {
          // Generate address, push, generate value, then POKE
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PUSH_A, [], 'poke addr');
          this.generateExpression(args[1]);
          this.builder.emit(ILOpcode.POKE, [], 'poke(addr, value)');
        }
        break;
      case 'peekw':
        if (args.length >= 1) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PEEKW, [], 'peekw(addr)');
        }
        break;
      case 'pokew':
        if (args.length >= 2) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PUSH_A, [], 'pokew addr');
          this.generateExpression(args[1]);
          this.builder.emit(ILOpcode.POKEW, [], 'pokew(addr, value)');
        }
        break;
      case 'volatile_read':
        // Same as peek() - reads byte from address with volatile semantics
        if (args.length >= 1) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PEEK, [], 'volatile_read(addr)');
        }
        break;
      case 'volatile_write':
        // Same as poke() - writes byte to address with volatile semantics
        if (args.length >= 2) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.PUSH_A, [], 'volatile_write addr');
          this.generateExpression(args[1]);
          this.builder.emit(ILOpcode.POKE, [], 'volatile_write(addr, value)');
        }
        break;
      case 'hi':
        if (args.length >= 1) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.HI, [], 'hi(value)');
        }
        break;
      case 'lo':
        if (args.length >= 1) {
          this.generateExpression(args[0]);
          this.builder.emit(ILOpcode.LO, [], 'lo(value)');
        }
        break;
    }
  }
}