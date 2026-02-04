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
} from '../../ast/expressions.js';
import {
  isLiteralExpression,
  isIdentifierExpression,
  isBinaryExpression,
  isUnaryExpression,
  isAssignmentExpression,
  isCallExpression,
  isTernaryExpression,
} from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import { SlotLocation } from '../../frame/enums.js';
import { FrameSlot } from '../../frame/types.js';
import { ILOpcode } from '../enums.js';
import { createImmediateOperand } from '../factories.js';
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
        this.generateBinaryOperation(op);
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
        this.generateBinaryOperation(op);
    }
  }

  /**
   * Generate binary operation with complex right operand.
   *
   * @param op - Operator token type
   * @param right - Right operand expression
   */
  protected generateBinaryComplex(op: TokenType, right: Expression): void {
    // Save left value to stack
    this.builder.emit(ILOpcode.PUSH_A, [], 'save left');

    // Generate right operand
    this.generateExpression(right);

    // Now we have: stack = left, A = right
    // For most operations, we need left OP right
    // But A has right, so we need to swap or reorganize

    // For commutative ops (add, and, or, xor), order doesn't matter
    // For non-commutative ops (sub, div, cmp), we need left in A

    // Strategy: Use a temp slot or swap pattern
    // For simplicity, we'll use the stack approach:
    // 1. Save right to stack
    // 2. Pop left to A
    // 3. Exchange (not efficient on 6502, but correct)

    // TODO: Optimize this pattern with temp slots
    this.generateBinaryOperation(op);
  }

  /**
   * Generate the actual binary operation.
   *
   * Assumes left is on stack, right is in A.
   * For commutative ops, uses A directly.
   * For non-commutative ops, needs stack manipulation.
   *
   * @param op - Operator token type
   */
  protected generateBinaryOperation(op: TokenType): void {
    // For now, implement commutative ops directly
    // Non-commutative will need fixing in Phase 7b
    switch (op) {
      case TokenType.PLUS:
        // Commutative: left + right = right + left
        // Pop left, add to current A
        // This is a placeholder - real impl needs proper stack handling
        this.builder.emit(ILOpcode.POP_A, [], 'get left');
        break;
      case TokenType.MULTIPLY:
        // Multiply is software routine anyway
        this.builder.emit(ILOpcode.POP_A, [], 'mul (placeholder)');
        break;
      default:
        // Placeholder for other operations
        this.builder.emit(ILOpcode.POP_A, [], 'op (placeholder)');
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
   * Placeholder implementation - full version in Phase 7c.
   *
   * @param expr - Call expression
   */
  protected generateCall(expr: CallExpression): void {
    this.setLocation(expr.getLocation());

    const callee = expr.getCallee();
    if (isIdentifierExpression(callee)) {
      const funcName = callee.getName();

      // Check for intrinsics
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