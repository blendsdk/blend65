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
import { TypeKind } from '../../semantic/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { ILOpcode } from '../enums.js';
import { createImmediateOperand, createAddressOperand, createIndexedAddressOperand } from '../factories.js';
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
  // Type-Aware Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if an expression has word (16-bit) type annotation.
   *
   * Used to dispatch between byte and word IL opcode paths.
   * Returns false if no type info is set (defaults to byte behavior).
   *
   * @param expr - Expression to check
   * @returns True if expression type is TypeKind.Word
   */
  protected isWordTyped(expr: Expression): boolean {
    const typeInfo = expr.getTypeInfo();
    return typeInfo?.kind === TypeKind.Word;
  }

  /**
   * Check if an expression is a unary address-of (`@`) expression.
   *
   * Used to skip byte→word promotion for `@variable` arguments passed
   * to word-typed function parameters. The `@` operator generates
   * LOAD_ADDRESS which already produces a full A:X word pair (low byte
   * in A, high byte in X). Applying PROMOTE_BYTE_WORD (LDX #$00) after
   * LOAD_ADDRESS would destroy the high byte loaded by LOAD_ADDRESS.
   *
   * @param expr - Expression to check
   * @returns True if expression is a UnaryExpression with AT operator
   */
  protected isAddressOfExpression(expr: Expression): boolean {
    return expr instanceof UnaryExpression && expr.getOperator() === TokenType.AT;
  }

  /**
   * Infer whether an expression produces a word-width (16-bit) value
   * by examining the source slot size.
   *
   * This is a fallback for when `expr.getTypeInfo()` returns undefined
   * (which is the common case in production, since `setTypeInfo()` is
   * not called during compilation). It checks if the expression is an
   * identifier that resolves to a word-sized slot (size === 2).
   *
   * Used in `generateBinary()` to correctly route word-typed variable
   * operations (e.g., `wordParam / 64`) to the word binary path instead
   * of the byte path.
   *
   * @param expr - Expression to check
   * @returns True if expression is an identifier with a word-sized slot
   */
  protected inferWordWidthFromExpression(expr: Expression): boolean {
    if (isIdentifierExpression(expr)) {
      const slot = this.tryResolveVariable((expr as IdentifierExpression).getName());
      return slot !== undefined && slot.size === 2;
    }
    return false;
  }

  /**
   * Return log2(value) if value is a power of 2, otherwise undefined.
   *
   * Used to convert division by a power-of-2 constant into a right
   * shift (e.g., `x / 64` → `x >> 6`). Returns undefined for
   * non-power-of-2 values or zero.
   *
   * @param value - The divisor to check
   * @returns log2(value) if power-of-2, undefined otherwise
   */
  protected log2IfPowerOf2(value: number): number | undefined {
    if (value <= 0 || (value & (value - 1)) !== 0) {
      return undefined;
    }
    return Math.log2(value);
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
      // Check if this literal is word-typed (set by semantic analysis)
      // Word literals load into A:X pair (low in A, high in X)
      if (this.isWordTyped(expr)) {
        this.builder.loadImmWord(value, `literal ${value} (word)`);
      } else {
        // Byte literal - load immediate into A
        this.builder.loadImm(value, `literal ${value}`);
      }
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

    // Check if this identifier is a compile-time constant.
    // Constants (e.g., const SPACE_CHAR: byte = 32) should resolve
    // to immediate loads rather than slot loads. The constant's value
    // is known at compile time via the symbol table's initializer.
    // This must be checked BEFORE tryResolveVariable because constants
    // may also have allocated slots — but loading from the slot is
    // wasteful when we know the exact value at compile time.
    const symbol = this.symbolTable.lookupGlobal(name);
    if (symbol && symbol.isConst && symbol.initializer) {
      const resolvedValue = this.tryResolveConstantAddress(symbol.initializer);
      if (resolvedValue !== undefined) {
        if (this.isWordTyped(expr)) {
          this.builder.loadImmWord(resolvedValue, `const ${name}`);
        } else {
          this.builder.loadImm(resolvedValue & 0xff, `const ${name}`);
        }
        this.clearLocation();
        return;
      }
    }

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
    } else if (slot.size === 2) {
      // Word slot - load A:X pair (low byte in A, high byte in X)
      this.builder.loadSlotWord(slot, `load ${name} (word)`);
    } else {
      // Byte slot - load from address into A
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
  // Index Assignment (Array Element Write)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for array element assignment (arr[index] = value).
   *
   * Strategy mirrors generateIndex() but uses store instead of load:
   * 1. Static index: compute base+offset at compile time, STA directly
   * 2. Dynamic index: load index into Y, generate value into A,
   *    then use Y-indexed store (STA base,Y)
   *
   * For dynamic index, the register management is:
   *   - Generate index expression → A
   *   - Transfer A → Y (TAY)
   *   - Generate value expression → A
   *   - Store A to base[Y] (STA base,Y)
   *
   * @param target - Index expression (e.g., arr[i])
   * @param value - Value expression to store
   */
  protected generateIndexAssignment(target: IndexExpression, value: Expression): void {
    const obj = target.getObject();
    const index = target.getIndex();

    if (!isIdentifierExpression(obj)) {
      // Complex base expression (e.g., getArray()[i] = v) — not supported
      this.generateExpression(value);
      return;
    }

    const arrayName = obj.getName();
    const arraySlot = this.tryResolveVariable(arrayName);

    if (!arraySlot) {
      // Array not found — emit value generation only (best effort)
      this.generateExpression(value);
      return;
    }

    // Check if index is a literal for optimization
    if (isLiteralExpression(index)) {
      const indexValue = index.getValue();
      if (typeof indexValue === 'number') {
        // Static index — compute address at compile time
        // Generate value into A, then store to base+offset
        this.generateExpression(value);
        this.builder.storeIndexedImm(arraySlot, indexValue, `${arrayName}[${indexValue}] =`);
        return;
      }
    }

    // Dynamic index — need Y register for indexed addressing
    // Step 1: Generate index expression into A, transfer to Y
    this.generateExpression(index);
    this.builder.transferAY();

    // Step 2: Generate value expression into A
    this.generateExpression(value);

    // Step 3: Store A to base[Y] using Y-indexed addressing
    this.builder.storeIndexedY(arraySlot, `${arrayName}[Y] =`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Binary Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Try to resolve an identifier expression to a compile-time constant value.
   *
   * Checks if the expression is an identifier that refers to a global const
   * with a resolvable initializer (e.g., `const SCREEN_WIDTH: byte = 40`).
   * Used by binary expression generation to emit immediate instructions
   * instead of memory loads for constant operands.
   *
   * @param expr - Expression to check (must be an identifier)
   * @returns The numeric constant value, or undefined if not a resolvable constant
   */
  protected tryResolveConstantIdentifier(expr: Expression): number | undefined {
    if (!isIdentifierExpression(expr)) return undefined;

    const name = (expr as IdentifierExpression).getName();
    const symbol = this.symbolTable.lookupGlobal(name);

    // Only resolve if the symbol is a const with a compile-time initializer
    if (symbol && symbol.isConst && symbol.initializer) {
      return this.tryResolveConstantAddress(symbol.initializer);
    }

    return undefined;
  }

  /**
   * Generate IL for a binary expression.
   *
   * Strategy:
   * 1. Generate left operand (result in A)
   * 2. If right is immediate: Use immediate instruction
   * 3. If right is constant identifier: Use immediate instruction (inlined)
   * 4. If right is identifier: Use slot instruction
   * 5. Otherwise: Push A, generate right, operate
   *
   * @param expr - Binary expression
   */
  protected generateBinary(expr: BinaryExpression): void {
    this.setLocation(expr.getLocation());

    // Assembly-time address expression optimization:
    // Detect pattern: @variable / constant  or  @variable >> constant
    // When left is address-of and right is a compile-time constant,
    // emit LOAD_ADDRESS_EXPR which the assembler resolves at assembly time.
    if (this.tryGenerateAddressExpr(expr)) {
      this.clearLocation();
      return;
    }

    // Type-aware dispatch: check if the RESULT type is word (16-bit)
    // When result is word, use word IL opcodes (ADD_WORD_*, etc.)
    // When result is byte (or unknown), use existing byte opcodes
    const resultType = expr.getTypeInfo();
    if (resultType?.kind === TypeKind.Word) {
      this.generateBinaryWord(expr);
      this.clearLocation();
      return;
    }

    // Fallback word-width inference: when type info is unavailable
    // (which is the common case in production since setTypeInfo() is
    // not called), check if the LEFT operand is an identifier that
    // resolves to a word-sized slot. This correctly routes expressions
    // like `wordParam / 64` to the word binary path instead of the
    // byte path (which would use 8-bit __div8).
    //
    // IMPORTANT: Only trigger for operators that have word-path support
    // (PLUS, MINUS, DIVIDE, RIGHT_SHIFT, comparisons). For operators
    // without word support (MULTIPLY, MODULO, bitwise), the byte path
    // gives a better result than a NOP placeholder.
    const op = expr.getOperator();
    const hasWordSupport = op === TokenType.PLUS || op === TokenType.MINUS
      || op === TokenType.DIVIDE || op === TokenType.RIGHT_SHIFT
      || op === TokenType.EQUAL || op === TokenType.NOT_EQUAL
      || op === TokenType.LESS_THAN || op === TokenType.LESS_EQUAL
      || op === TokenType.GREATER_THAN || op === TokenType.GREATER_EQUAL;

    if (!resultType && hasWordSupport && this.inferWordWidthFromExpression(expr.getLeft())) {
      this.generateBinaryWord(expr);
      this.clearLocation();
      return;
    }

    // Byte path (existing code — unchanged, zero regression risk)
    // Generate left operand first (result in A)
    this.generateExpression(expr.getLeft());

    const right = expr.getRight();
    // Note: `op` already declared above for word-support check

    // Optimization: Check for immediate right operand
    if (isLiteralExpression(right)) {
      const value = right.getValue();
      if (typeof value === 'number') {
        this.generateBinaryImmediate(op, value);
        this.clearLocation();
        return;
      }
    }

    // Optimization: Check for constant identifier right operand.
    // If the right operand is a const (e.g., SCREEN_WIDTH = 40),
    // inline its value as an immediate instead of loading from a slot.
    // This avoids unnecessary memory access for compile-time constants.
    if (isIdentifierExpression(right)) {
      const constValue = this.tryResolveConstantIdentifier(right);
      if (constValue !== undefined) {
        this.generateBinaryImmediate(op, constValue);
        this.clearLocation();
        return;
      }
    }

    // Optimization: Check for slot right operand (mutable variable)
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

  // ═══════════════════════════════════════════════════════════════════
  // Word Binary Expression (16-bit)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a word-typed binary expression.
   *
   * The result type is word (16-bit), using A:X register pair convention.
   * Strategy:
   * 1. Generate left operand (may produce byte or word in A or A:X)
   * 2. If left is byte-typed, promote to word via PROMOTE_BYTE_WORD
   * 3. Apply word-width operation with right operand
   *
   * @param expr - Binary expression with word result type
   */
  protected generateBinaryWord(expr: BinaryExpression): void {
    const left = expr.getLeft();
    const right = expr.getRight();
    const op = expr.getOperator();

    // Generate left operand
    this.generateExpression(left);

    // Promote left from byte to word if needed (byte A → word A:X via LDX #0).
    // Skip promotion when: (a) type info says it's already word, OR
    // (b) inference shows the left is a word-sized slot (already loaded
    //     via LOAD_WORD which produces A:X). Adding LDX #0 would destroy X.
    const leftType = left.getTypeInfo();
    const leftAlreadyWord = (leftType?.kind === TypeKind.Word)
      || this.inferWordWidthFromExpression(left);
    if (!leftAlreadyWord) {
      this.builder.promoteByteWord('byte→word left');
    }

    // Try immediate right operand (most common: addr + 5, counter + 1)
    if (isLiteralExpression(right)) {
      const value = right.getValue();
      if (typeof value === 'number') {
        this.generateBinaryWordImmediate(op, value);
        return;
      }
    }

    // Try constant identifier right operand (e.g., addr + OFFSET where const OFFSET = 40).
    // Inline the constant value as an immediate to avoid unnecessary memory loads.
    if (isIdentifierExpression(right)) {
      const constValue = this.tryResolveConstantIdentifier(right);
      if (constValue !== undefined) {
        this.generateBinaryWordImmediate(op, constValue);
        return;
      }
    }

    // Try slot right operand (addr + offset where offset is a mutable variable)
    if (isIdentifierExpression(right)) {
      const slot = this.tryResolveVariable(right.getName());
      if (slot && slot.location !== SlotLocation.Register) {
        this.generateBinaryWordSlot(op, slot);
        return;
      }
    }

    // Complex right operand — not yet supported for word width
    // (would need push A:X pair, generate right, operate)
    this.builder.nop();
  }

  /**
   * Generate word binary operation with immediate right operand.
   *
   * Selects the optimal word opcode based on whether the immediate
   * value fits in a byte (0-255) or requires a full word:
   * - Byte value: ADD_WORD_BYTE_IMM (faster, CLC/ADC/BCC/INX)
   * - Word value: ADD_WORD_IMM (full 16-bit, PHA/TXA/ADC/TAX/PLA/ADC)
   *
   * @param op - Operator token type
   * @param value - Immediate numeric value
   */
  protected generateBinaryWordImmediate(op: TokenType, value: number): void {
    // Choose byte vs word immediate variant based on value range
    const isByteValue = value >= 0 && value <= 0xFF;

    switch (op) {
      case TokenType.PLUS:
        if (isByteValue) {
          this.builder.addWordByteImm(value, `word + ${value}`);
        } else {
          this.builder.addWordImm(value, `word + ${value}`);
        }
        break;
      case TokenType.MINUS:
        if (isByteValue) {
          this.builder.subWordByteImm(value, `word - ${value}`);
        } else {
          this.builder.subWordImm(value, `word - ${value}`);
        }
        break;
      case TokenType.DIVIDE:
      case TokenType.RIGHT_SHIFT: {
        // Word division/shift by a power-of-2 immediate is converted to
        // SHR_WORD (16-bit logical shift right). This is the key fix for
        // expressions like `spriteAddr / 64` where spriteAddr is a word
        // parameter — previously this fell to the byte path and used 8-bit
        // __div8, corrupting the high byte.
        //
        // For non-power-of-2 divisors, a 16-bit software divide would be
        // needed (not yet implemented), so we emit NOP as a placeholder.
        const shiftCount = op === TokenType.RIGHT_SHIFT
          ? value  // >> N shifts by exactly N
          : this.log2IfPowerOf2(value);  // / N → log2(N) shifts if power-of-2

        if (shiftCount !== undefined && shiftCount > 0) {
          this.builder.shrWord(shiftCount, `word ${op === TokenType.RIGHT_SHIFT ? '>>' : '/'} ${value}`);
        } else {
          // Non-power-of-2 division — no 16-bit __div16 runtime yet
          this.builder.nop();
        }
        break;
      }
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        // Word comparison — always uses full word compare
        this.builder.cmpWordImm(value, `word cmp ${value}`);
        break;
      default:
        // Other word ops (multiply, bitwise) not yet supported
        this.builder.nop();
    }
  }

  /**
   * Generate word binary operation with slot right operand.
   *
   * Selects the optimal word opcode based on the slot's size:
   * - Byte slot (size=1): ADD_WORD_BYTE_SLOT (CLC/ADC/BCC/INX)
   * - Word slot (size=2): ADD_WORD_SLOT (full 16-bit add from memory)
   *
   * @param op - Operator token type
   * @param slot - Right operand frame slot
   */
  protected generateBinaryWordSlot(op: TokenType, slot: FrameSlot): void {
    // Choose byte vs word slot variant based on slot size
    const isByteSlot = slot.size === 1;

    switch (op) {
      case TokenType.PLUS:
        if (isByteSlot) {
          this.builder.addWordByteSlot(slot, `word + ${slot.name}`);
        } else {
          this.builder.addWordSlot(slot, `word + ${slot.name}`);
        }
        break;
      case TokenType.MINUS:
        if (isByteSlot) {
          this.builder.subWordByteSlot(slot, `word - ${slot.name}`);
        } else {
          this.builder.subWordSlot(slot, `word - ${slot.name}`);
        }
        break;
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        // Word comparison with slot
        this.builder.cmpWordSlot(slot, `word cmp ${slot.name}`);
        break;
      default:
        // Other word ops not yet supported
        this.builder.nop();
    }
  }

  /**
   * Create a synthetic FrameSlot pointing to ZP temp ($FE).
   *
   * Used by the complex binary path and compound assignment path
   * to store intermediate values when the right operand is complex
   * and needs to be temporarily saved before the operation.
   *
   * @returns FrameSlot pointing to zero-page address $FE
   */
  protected createZpTempSlot(): FrameSlot {
    const slot = createFrameSlot('__zp_temp', SlotKind.Local, BUILTIN_TYPES.BYTE, {
      location: SlotLocation.ZeroPage,
      address: 0xfe,
    });
    return slot;
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
      case TokenType.DIVIDE:
        this.builder.divImm(value);
        break;
      case TokenType.MODULO:
        this.builder.modImm(value);
        break;
      case TokenType.LEFT_SHIFT:
        this.builder.shl(value, `<< ${value}`);
        break;
      case TokenType.RIGHT_SHIFT:
        this.builder.shr(value, `>> ${value}`);
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
    // At entry: stack has left value, A has right value.
    // Strategy: store right to ZP temp ($FE), pop left to A,
    // then operate A with ZP temp using proper slot-based opcodes.
    // This ensures all _BYTE opcodes receive valid slot operands.

    const zpTemp = this.createZpTempSlot();

    // Store right operand (in A) to ZP temp
    this.builder.storeSlot(zpTemp, 'save right to temp');

    // Pop left operand back into A
    this.builder.emit(ILOpcode.POP_A, [], 'restore left');

    // Now: A = left, $FE = right — use slot-based operations
    switch (op) {
      case TokenType.PLUS:
        this.builder.addSlot(zpTemp, 'left + right');
        break;
      case TokenType.MINUS:
        this.builder.subSlot(zpTemp, 'left - right');
        break;
      case TokenType.MULTIPLY:
        this.builder.mulSlot(zpTemp, 'left * right');
        break;
      case TokenType.DIVIDE:
        this.builder.divSlot(zpTemp, 'left / right');
        break;
      case TokenType.MODULO:
        this.builder.modSlot(zpTemp, 'left % right');
        break;
      case TokenType.BITWISE_AND:
        this.builder.andSlot(zpTemp, 'left & right');
        break;
      case TokenType.BITWISE_OR:
        this.builder.orSlot(zpTemp, 'left | right');
        break;
      case TokenType.BITWISE_XOR:
        this.builder.xorSlot(zpTemp, 'left ^ right');
        break;
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_EQUAL:
        this.builder.cmpSlot(zpTemp, 'left cmp right');
        break;
      case TokenType.LEFT_SHIFT:
      case TokenType.RIGHT_SHIFT:
        // Variable-count shifts require a runtime loop — not yet supported.
        // A already has the left value after POP_A, so result is left (unshifted).
        break;
      default:
        // Unsupported operator — A has the left value from POP_A
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Unary Expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a unary expression.
   *
   * Address-of (`@`) is handled specially because we need the variable's
   * memory address, not its value. All other unary operators generate
   * the operand value into A first, then apply the transformation.
   *
   * @param expr - Unary expression
   */
  protected generateUnary(expr: UnaryExpression): void {
    this.setLocation(expr.getLocation());

    const op = expr.getOperator();

    // Address-of is special — we need the variable's address, not its value.
    // Must be handled BEFORE generateExpression(operand) is called.
    if (op === TokenType.AT) {
      this.generateAddressOf(expr);
      this.clearLocation();
      return;
    }

    // Generate operand (result in A) for all other unary operators
    this.generateExpression(expr.getOperand());

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
  // Address-Of Expression (@variable)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for the address-of operator (`@variable`).
   *
   * Resolves the operand to a FrameSlot and emits LOAD_ADDRESS,
   * which loads the 16-bit memory address into A:X.
   *
   * For @data globals with ACME labels, the codegen will emit:
   *   LDA #<label / LDX #>label (resolved at assembly time)
   *
   * For RAM/ZP globals with numeric addresses, the codegen will emit:
   *   LDA #lo(addr) / LDX #hi(addr)
   *
   * The operand MUST be an identifier expression (variable name).
   * Address-of on complex expressions (e.g., @arr[i]) is not supported.
   *
   * @param expr - The unary expression with AT operator
   */
  protected generateAddressOf(expr: UnaryExpression): void {
    const operand = expr.getOperand();

    // Address-of requires an identifier operand (variable name)
    if (!isIdentifierExpression(operand)) {
      // Address-of on non-identifier is not supported
      this.builder.nop();
      return;
    }

    const name = (operand as IdentifierExpression).getName();
    const slot = this.tryResolveVariable(name);

    if (!slot) {
      // Variable not found — emit NOP as fallback
      this.builder.nop();
      return;
    }

    // Emit LOAD_ADDRESS with the slot — the codegen will determine
    // whether to use an ACME label or a numeric address based on
    // whether slot.dataLabel is set.
    this.builder.loadAddress(slot, `@${name}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Assembly-Time Address Expression (@variable / constant)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Try to generate an assembly-time address expression.
   *
   * Detects the pattern: `@variable / constant` or `@variable >> constant`
   * where the left operand is an address-of unary expression and the
   * right operand is a compile-time constant.
   *
   * If the pattern matches, emits LOAD_ADDRESS_EXPR (byte result in A).
   * If the variable has a known numeric address (RAM/ZP), constant-folds
   * to a LOAD_IMM instead.
   * If the pattern doesn't match, returns false so normal binary
   * generation proceeds.
   *
   * This is the key optimization for C64 sprite/charset pointer
   * calculation: `@spriteData / 64` becomes `LDA #(label / 64)`
   * which the assembler resolves at assembly time with zero runtime cost.
   *
   * @param expr - Binary expression to check
   * @returns True if pattern was detected and IL emitted, false otherwise
   */
  protected tryGenerateAddressExpr(expr: BinaryExpression): boolean {
    const op = expr.getOperator();

    // Only / and >> are supported for address expressions
    if (op !== TokenType.DIVIDE && op !== TokenType.RIGHT_SHIFT) {
      return false;
    }

    // Left must be address-of: @variable (UnaryExpression with AT operator)
    const left = expr.getLeft();
    if (!isUnaryExpression(left)) return false;
    const unary = left as UnaryExpression;
    if (unary.getOperator() !== TokenType.AT) return false;
    const operand = unary.getOperand();
    if (!isIdentifierExpression(operand)) return false;

    // Right must be a compile-time constant (literal or const identifier)
    const right = expr.getRight();
    const constValue = this.tryResolveConstantAddress(right);
    // Guard: constant must exist and must not be zero (division by zero)
    if (constValue === undefined || constValue === 0) return false;

    // Resolve the variable to a frame slot
    const varName = (operand as IdentifierExpression).getName();
    const slot = this.tryResolveVariable(varName);
    if (!slot) return false;

    // For slots with known numeric addresses (RAM/ZP), constant-fold
    // the entire expression to a single immediate byte value
    if (slot.address !== undefined && !slot.dataLabel) {
      const result = op === TokenType.DIVIDE
        ? Math.floor(slot.address / constValue) & 0xFF
        : (slot.address >>> constValue) & 0xFF;
      this.builder.loadImm(result, `@${varName} ${op === TokenType.DIVIDE ? '/' : '>>'} ${constValue}`);
      return true;
    }

    // Emit LOAD_ADDRESS_EXPR for label-based slots (@data, @sprite, etc.)
    // The assembler will compute (label / N) or (label >> N) at assembly time
    const isShift = op === TokenType.RIGHT_SHIFT;
    this.builder.loadAddressExpr(
      slot,
      constValue,
      isShift,
      `@${varName} ${isShift ? '>>' : '/'} ${constValue}`
    );
    return true;
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

    // Handle array element assignment: arr[index] = value
    if (isIndexExpression(target)) {
      this.generateIndexAssignment(target as IndexExpression, value);
      this.clearLocation();
      return;
    }

    // Get target slot
    if (!isIdentifierExpression(target)) {
      // Complex target (member access) - TODO in Phase 7c
      this.generateExpression(value);
      this.clearLocation();
      return;
    }

    const targetName = target.getName();
    const slot = this.resolveVariable(targetName);

    if (op === TokenType.ASSIGN) {
      // Simple assignment: x = value
      this.generateExpression(value);
      // Use word-width store for 2-byte slots
      if (slot.size === 2) {
        this.builder.storeSlotWord(slot, `${targetName} = (word)`);
      } else {
        this.builder.storeSlot(slot, `${targetName} =`);
      }
    } else {
      // Compound assignment: x += value, x -= value, etc.
      if (slot.size === 2) {
        this.generateCompoundAssignmentWord(slot, op, value);
      } else {
        this.generateCompoundAssignment(slot, op, value);
      }
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
          case TokenType.MULTIPLY_ASSIGN:
            this.builder.mulImm(literalValue);
            break;
          case TokenType.DIVIDE_ASSIGN:
            this.builder.divImm(literalValue);
            break;
          case TokenType.MODULO_ASSIGN:
            this.builder.modImm(literalValue);
            break;
          case TokenType.LEFT_SHIFT_ASSIGN:
            this.builder.shl(literalValue, `<<= ${literalValue}`);
            break;
          case TokenType.RIGHT_SHIFT_ASSIGN:
            this.builder.shr(literalValue, `>>= ${literalValue}`);
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
   * Generate word-width compound assignment (+=, -=, etc.) for 2-byte slots.
   *
   * Loads the current word value, applies the word-width operation,
   * then stores back. Uses immediate word ops when the value is a constant.
   *
   * @param slot - Target word slot (size=2)
   * @param op - Compound operator token type
   * @param value - Value expression to apply
   */
  protected generateCompoundAssignmentWord(
    slot: FrameSlot,
    op: TokenType,
    value: Expression
  ): void {
    // Load current word value into A:X
    this.builder.loadSlotWord(slot, `load ${slot.name} (word)`);

    // Apply operation — try immediate optimization first
    if (isLiteralExpression(value)) {
      const literalValue = value.getValue();
      if (typeof literalValue === 'number') {
        const isByte = literalValue >= 0 && literalValue <= 0xFF;
        switch (op) {
          case TokenType.PLUS_ASSIGN:
            if (isByte) {
              this.builder.addWordByteImm(literalValue, `word += ${literalValue}`);
            } else {
              this.builder.addWordImm(literalValue, `word += ${literalValue}`);
            }
            break;
          case TokenType.MINUS_ASSIGN:
            if (isByte) {
              this.builder.subWordByteImm(literalValue, `word -= ${literalValue}`);
            } else {
              this.builder.subWordImm(literalValue, `word -= ${literalValue}`);
            }
            break;
          default:
            // Other compound ops on words not yet supported (bitwise, mul, etc.)
            this.builder.nop();
        }
        // Store result back as word
        this.builder.storeSlotWord(slot, `store ${slot.name} (word)`);
        return;
      }
    }

    // Non-literal value — generate expression, promote, and apply
    // For now, use a simplified path: push word, gen value, add
    this.builder.nop();
    this.builder.storeSlotWord(slot, `store ${slot.name} (word)`);
  }

  /**
   * Generate the operation for compound assignment.
   *
   * @param op - Compound operator token type
   */
  protected generateCompoundOperation(op: TokenType): void {
    // At entry: stack has old (left) value, A has new (right) value.
    // Strategy: store right to ZP temp ($FE), pop left to A,
    // then operate A with ZP temp using proper slot-based opcodes.
    // This mirrors generateBinaryComplexOp() but for compound operators.

    const zpTemp = this.createZpTempSlot();

    // Store right operand (in A) to ZP temp
    this.builder.storeSlot(zpTemp, 'save compound rhs to temp');

    // Pop old value (left operand) back into A
    this.builder.emit(ILOpcode.POP_A, [], 'restore compound lhs');

    // Now: A = old value, $FE = new value — apply compound operation
    switch (op) {
      case TokenType.PLUS_ASSIGN:
        this.builder.addSlot(zpTemp, 'compound +=');
        break;
      case TokenType.MINUS_ASSIGN:
        this.builder.subSlot(zpTemp, 'compound -=');
        break;
      case TokenType.MULTIPLY_ASSIGN:
        this.builder.mulSlot(zpTemp, 'compound *=');
        break;
      case TokenType.DIVIDE_ASSIGN:
        this.builder.divSlot(zpTemp, 'compound /=');
        break;
      case TokenType.MODULO_ASSIGN:
        this.builder.modSlot(zpTemp, 'compound %=');
        break;
      case TokenType.BITWISE_AND_ASSIGN:
        this.builder.andSlot(zpTemp, 'compound &=');
        break;
      case TokenType.BITWISE_OR_ASSIGN:
        this.builder.orSlot(zpTemp, 'compound |=');
        break;
      case TokenType.BITWISE_XOR_ASSIGN:
        this.builder.xorSlot(zpTemp, 'compound ^=');
        break;
      default:
        // Unsupported compound op — A has old value from POP_A
        break;
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
   * 3. Regular functions → Argument passing + CALL IL instruction
   *
   * For regular function calls, the first argument is passed via:
   * - A register for byte parameters
   * - A:X register pair for word parameters (low byte in A, high byte in X)
   *
   * The 6502 calling convention is:
   * 1. Caller evaluates first argument (result in A or A:X)
   * 2. Caller executes JSR (via CALL opcode)
   * 3. Callee prologue stores A or A:X to parameter's frame slot
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

      // Regular function call — generate first argument before CALL
      // The 6502 convention passes the first arg in A (byte) or A:X (word)
      this.generateCallArguments(funcName, expr.getArguments());

      // Collect callee parameter slot names so the CALL instruction declares
      // them as uses. This prevents DCE from removing the preceding stores
      // that pass arguments to the callee via its parameter slots.
      const calleeFrame = this.frameMap.get(funcName);
      const paramUses = calleeFrame
        ? calleeFrame.slots
            .filter(s => s.kind === SlotKind.Parameter)
            .map(s => s.name)
        : [];

      this.builder.call(funcName, false, -1, undefined, paramUses);
    }

    this.clearLocation();
  }

  /**
   * Generate argument passing for a regular function call.
   *
   * 6502 calling convention:
   * - args[0]: Passed via A (byte) or A:X (word) — callee prologue stores it.
   * - args[1..N]: Generated into A, then stored to the callee's parameter
   *   slots BEFORE args[0] is generated, so that args[0] remains in A at
   *   the moment of the CALL (JSR).
   *
   * If the callee's first parameter is word-typed but the argument expression
   * produces a byte value, a PROMOTE_BYTE_WORD is emitted to widen A → A:X.
   *
   * @param funcName - Name of the function being called
   * @param args - Call argument expressions
   */
  protected generateCallArguments(funcName: string, args: Expression[]): void {
    if (args.length === 0) {
      return; // No arguments to pass
    }

    const targetFrame = this.frameMap.get(funcName);

    // Collect callee parameter slots in declaration order.
    // These correspond 1:1 with the argument positions.
    const paramSlots = targetFrame
      ? targetFrame.slots.filter(s => s.kind === SlotKind.Parameter)
      : [];

    // Generate args[1..N] BEFORE args[0].
    // Why? Because args[0] must remain in A (or A:X) at the CALL site.
    // If we generated args[0] first and then args[1], generating the
    // second argument would clobber A. By storing args[1..N] to their
    // parameter slots first, A is free for args[0] at call time.
    for (let i = 1; i < args.length; i++) {
      if (i < paramSlots.length) {
        // Generate the argument expression — result lands in A (or A:X)
        this.generateExpression(args[i]);

        // Store the result to the callee's parameter slot
        if (paramSlots[i].size === 2) {
          this.builder.storeSlotWord(paramSlots[i], `arg${i} → ${paramSlots[i].name}`);
        } else {
          this.builder.storeSlot(paramSlots[i], `arg${i} → ${paramSlots[i].name}`);
        }
      }
    }

    // Generate args[0] last — result stays in A (or A:X) for the CALL
    this.generateExpression(args[0]);

    // Check if the callee's first parameter is word-typed
    // If so and the arg is byte-typed, promote A → A:X via PROMOTE_BYTE_WORD.
    // IMPORTANT: Skip promotion for address-of (@) expressions because
    // LOAD_ADDRESS already produces a full A:X word pair. Applying
    // PROMOTE_BYTE_WORD after LOAD_ADDRESS would destroy the high byte
    // (X register) by overwriting it with #$00.
    if (targetFrame) {
      const firstParam = paramSlots.length > 0 ? paramSlots[0] : undefined;
      if (firstParam && firstParam.size === 2 && !this.isWordTyped(args[0])) {
        // Only promote if the argument is NOT an address-of expression.
        // @variable already loads a full 16-bit address into A:X via LOAD_ADDRESS.
        if (!this.isAddressOfExpression(args[0])) {
          this.builder.promoteByteWord(`arg byte→word for ${funcName}`);
        }
      }
    }
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
      'barrier',
      'length',
    ];
    return intrinsics.includes(name);
  }

  /**
   * Try to resolve an expression to a constant numeric address.
   *
   * This is critical for peek/poke/peekw/pokew intrinsics which need
   * the address as an operand on the IL instruction (not on the stack).
   * The codegen expects address operands to generate proper 6502
   * `LDA abs` / `STA abs` instructions.
   *
   * Handles two cases:
   * 1. Numeric literal: `poke($D020, value)` → returns 0xD020
   * 2. Constant identifier: `poke(BORDER, value)` where BORDER = $D020 → returns 0xD020
   *
   * @param expr - Address expression to evaluate
   * @returns Numeric address if resolvable at compile time, undefined otherwise
   */
  protected tryResolveConstantAddress(expr: Expression): number | undefined {
    // Case 1: Numeric literal (e.g., $D020, 53280, 0xD020)
    if (isLiteralExpression(expr)) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }

    // Case 2: Constant identifier reference (e.g., BORDER where const BORDER = $D020)
    if (isIdentifierExpression(expr)) {
      const name = expr.getName();
      const symbol = this.symbolTable.lookupGlobal(name);
      if (symbol && symbol.isConst && symbol.initializer) {
        // Recursively resolve the initializer (handles const BORDER = $D020)
        return this.tryResolveConstantAddress(symbol.initializer);
      }
    }

    // Case 3: Binary expression between two constants (e.g., SCREEN + 40, BASE * 8)
    // Supports: +, -, *, /, %, <<, >>, &, |, ^
    if (isBinaryExpression(expr)) {
      const binExpr = expr as BinaryExpression;
      const left = this.tryResolveConstantAddress(binExpr.getLeft());
      const right = this.tryResolveConstantAddress(binExpr.getRight());

      if (left !== undefined && right !== undefined) {
        // Both sides are constants — fold the operation at compile time
        switch (binExpr.getOperator()) {
          case TokenType.PLUS:
            return (left + right) & 0xFFFF;
          case TokenType.MINUS:
            return (left - right) & 0xFFFF;
          case TokenType.MULTIPLY:
            return (left * right) & 0xFFFF;
          case TokenType.DIVIDE:
            // Guard against division by zero
            return right !== 0 ? (Math.floor(left / right)) & 0xFFFF : undefined;
          case TokenType.MODULO:
            // Guard against modulo by zero
            return right !== 0 ? (left % right) & 0xFFFF : undefined;
          case TokenType.LEFT_SHIFT:
            return (left << right) & 0xFFFF;
          case TokenType.RIGHT_SHIFT:
            return (left >>> right) & 0xFFFF;
          case TokenType.BITWISE_AND:
            return (left & right) & 0xFFFF;
          case TokenType.BITWISE_OR:
            return (left | right) & 0xFFFF;
          case TokenType.BITWISE_XOR:
            return (left ^ right) & 0xFFFF;
          default:
            // Operator not foldable (comparison, logical, etc.)
            return undefined;
        }
      }
    }

    // Cannot resolve to a constant address
    return undefined;
  }

  /**
   * Try to decompose an address expression into constant_base + variable_offset.
   *
   * Detects the common pattern used in C64 programming:
   *   poke(SPRITE_DATA_ADDR + i, value)
   *
   * Where SPRITE_DATA_ADDR is a compile-time constant and i is a runtime variable.
   * Returns the constant base address and the variable offset expression so the
   * IL generator can emit X-indexed addressing (e.g., STA $3000,X).
   *
   * Handles both orderings:
   *   - constant + variable (most common)
   *   - variable + constant (same semantics due to addition commutativity)
   *
   * @param expr - Address expression to decompose
   * @returns Object with base address and offset expression, or undefined if pattern doesn't match
   */
  protected tryDecomposeIndexedAddress(
    expr: Expression,
  ): { base: number; offsetExpr: Expression } | undefined {
    // Only binary addition expressions can be decomposed
    if (!isBinaryExpression(expr)) {
      return undefined;
    }

    const binExpr = expr as BinaryExpression;

    // Must be addition operator
    if (binExpr.getOperator() !== TokenType.PLUS) {
      return undefined;
    }

    const left = binExpr.getLeft();
    const right = binExpr.getRight();

    // Try: constant + variable (e.g., SPRITE_DATA_ADDR + i)
    const leftConst = this.tryResolveConstantAddress(left);
    if (leftConst !== undefined) {
      return { base: leftConst, offsetExpr: right };
    }

    // Try: variable + constant (e.g., i + SPRITE_DATA_ADDR)
    const rightConst = this.tryResolveConstantAddress(right);
    if (rightConst !== undefined) {
      return { base: rightConst, offsetExpr: left };
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Address Decomposer (for 3-tier intrinsic addressing)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Result of decomposing an address expression into constant and variable parts.
   *
   * Used by the 3-tier intrinsic strategy to determine optimal addressing mode:
   * - Tier 1 (absolute): zero variable terms → use constantSum directly
   * - Tier 2 (indexed): one byte-typed variable term + addition only → use X-indexed
   * - Tier 3 (indirect): multiple terms or word variable → use ZP pointer indirect
   */
  protected static readonly DEFAULT_DECOMPOSITION = {
    constantSum: 0,
    variableTerms: [] as Expression[],
    isAdditionOnly: true,
  };

  /**
   * Decompose an address expression into a constant base and variable offsets.
   *
   * Walks the binary expression tree along `+` chains, folding all
   * compile-time constants into a single sum and collecting all runtime
   * variable sub-expressions separately.
   *
   * For non-`+` operators (*, -, <<, etc.), the entire sub-tree is
   * treated as a single opaque variable term (cannot be decomposed further).
   *
   * Examples:
   *   SCREEN + i + j     → { constantSum: 0x0400, variableTerms: [i, j], isAdditionOnly: true }
   *   SCREEN + 40 + i    → { constantSum: 0x0428, variableTerms: [i],    isAdditionOnly: true }
   *   $0400 + offset * 2 → { constantSum: 0x0400, variableTerms: [offset*2], isAdditionOnly: true }
   *   i - j              → { constantSum: 0, variableTerms: [i-j], isAdditionOnly: false }
   *
   * @param expr - Address expression to decompose
   * @returns Decomposition with constantSum, variableTerms, and isAdditionOnly flag
   */
  protected decomposeAddressExpression(expr: Expression): {
    constantSum: number;
    variableTerms: Expression[];
    isAdditionOnly: boolean;
  } {
    // Leaf: pure constant — fold into constantSum
    const constVal = this.tryResolveConstantAddress(expr);
    if (constVal !== undefined) {
      return { constantSum: constVal, variableTerms: [], isAdditionOnly: true };
    }

    // Leaf: non-binary expression (identifier, call, etc.) — treat as variable term
    if (!isBinaryExpression(expr)) {
      return { constantSum: 0, variableTerms: [expr], isAdditionOnly: true };
    }

    const binExpr = expr as BinaryExpression;
    const op = binExpr.getOperator();

    // Only decompose along `+` chains — non-addition operators are opaque
    if (op !== TokenType.PLUS) {
      // The entire sub-tree is one variable term
      return { constantSum: 0, variableTerms: [expr], isAdditionOnly: false };
    }

    // Addition node: recursively decompose both sides and merge
    const leftDecomp = this.decomposeAddressExpression(binExpr.getLeft());
    const rightDecomp = this.decomposeAddressExpression(binExpr.getRight());

    return {
      // Fold constants from both sides (mask to 16 bits)
      constantSum: (leftDecomp.constantSum + rightDecomp.constantSum) & 0xFFFF,
      // Collect all variable terms from both sides
      variableTerms: [...leftDecomp.variableTerms, ...rightDecomp.variableTerms],
      // Addition-only if both sides are addition-only
      isAdditionOnly: leftDecomp.isAdditionOnly && rightDecomp.isAdditionOnly,
    };
  }

  /**
   * Generate IL for an intrinsic call.
   *
   * When the address argument can be resolved to a compile-time constant,
   * emits the intrinsic with an address operand (required by codegen).
   * Falls back to stack-based approach for dynamic addresses.
   *
   * @param name - Intrinsic name
   * @param args - Arguments
   */
  protected generateIntrinsic(name: string, args: Expression[]): void {
    switch (name) {
      case 'peek':
        if (args.length >= 1) {
          this.generatePeekIntrinsic(args[0], 'peek');
        }
        break;
      case 'poke':
        if (args.length >= 2) {
          this.generatePokeIntrinsic(args[0], args[1], 'poke');
        }
        break;
      case 'peekw':
        if (args.length >= 1) {
          this.generatePeekwIntrinsic(args[0], 'peekw');
        }
        break;
      case 'pokew':
        if (args.length >= 2) {
          this.generatePokewIntrinsic(args[0], args[1], 'pokew');
        }
        break;
      case 'volatile_read':
        // Same as peek() with volatile semantics
        if (args.length >= 1) {
          this.generatePeekIntrinsic(args[0], 'volatile_read');
        }
        break;
      case 'volatile_write':
        // Same as poke() with volatile semantics
        if (args.length >= 2) {
          this.generatePokeIntrinsic(args[0], args[1], 'volatile_write');
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
      case 'barrier':
        // Optimization barrier — emits a BARRIER IL opcode that prevents the
        // optimizer from reordering, merging, or eliminating instructions
        // across this point (per spec 08-intrinsics.md). Generates no runtime
        // code — the codegen emits only a comment.
        this.builder.emit(ILOpcode.BARRIER, [], 'barrier()');
        break;
      case 'length':
        // length() is a compile-time intrinsic - resolved during semantic analysis
        // No runtime IL needed (per spec 08-intrinsics.md)
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Intrinsic Helper Methods
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // Tier 3 Address Helper (shared by all intrinsics)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compute a dynamic 16-bit address into A:X and store to ZP pointer ($FB/$FC).
   *
   * Used by Tier 3 of the 3-tier intrinsic strategy when neither
   * absolute nor indexed addressing is possible.
   *
   * Two sub-strategies:
   * - **Optimized**: If all variable terms are simple identifiers with
   *   resolvable slots and the expression is addition-only, loads the
   *   folded constant base into A:X and adds each slot individually.
   * - **General**: Otherwise generates the full address expression
   *   and promotes to word if needed.
   *
   * After this method, $FB/$FC holds the computed 16-bit address.
   *
   * @param addrExpr - Original address expression (used for general fallback)
   * @param decomp - Address decomposition result
   */
  protected generateTier3Address(
    addrExpr: Expression,
    decomp: { constantSum: number; variableTerms: Expression[]; isAdditionOnly: boolean },
  ): void {
    // Check if all variable terms are simple slot identifiers (optimized path)
    const allSlotsResolvable = decomp.isAdditionOnly && decomp.variableTerms.every(term => {
      if (!isIdentifierExpression(term)) return false;
      const slot = this.tryResolveVariable((term as IdentifierExpression).getName());
      return slot !== undefined && slot.location !== SlotLocation.Register;
    });

    if (allSlotsResolvable) {
      // Optimized Tier 3: load folded constant base, add each slot individually
      // This avoids runtime computation of constants and uses efficient slot-based adds
      this.builder.loadImmWord(decomp.constantSum, 'addr base');
      for (const term of decomp.variableTerms) {
        const name = (term as IdentifierExpression).getName();
        const slot = this.tryResolveVariable(name)!;
        if (slot.size === 2) {
          // Word slot: full 16-bit add (CLC/ADC lo/PHA/TXA/ADC hi/TAX/PLA)
          this.builder.addWordSlot(slot, `+ ${name} (word)`);
        } else {
          // Byte slot: zero-extended add (CLC/ADC/BCC+2/INX)
          this.builder.addWordByteSlot(slot, `+ ${name}`);
        }
      }
    } else {
      // General Tier 3: generate the full address expression
      // This handles complex sub-expressions (e.g., row * 40 + col)
      this.generateExpression(addrExpr);
      // Ensure result is in A:X word format (promote if byte)
      if (!this.isWordTyped(addrExpr)) {
        this.builder.promoteByteWord('addr → word');
      }
    }

    // Store computed 16-bit address to ZP pointer for indirect access
    this.builder.storeZpPtr('addr → ($FB/$FC)');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3-Tier Intrinsic Generators
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for peek/volatile_read intrinsic using 3-tier strategy.
   *
   * Tier 1 (absolute): Address is a compile-time constant → LDA addr
   * Tier 2 (indexed): Single byte variable + constant base → LDA base,X
   * Tier 3 (indirect): Complex address → compute A:X, store ZP ptr, LDA ($FB),Y
   *
   * @param addrExpr - Address expression
   * @param label - Comment label (e.g., 'peek' or 'volatile_read')
   */
  protected generatePeekIntrinsic(addrExpr: Expression, label: string): void {
    // Tier 1: Pure constant address → absolute addressing
    const constAddr = this.tryResolveConstantAddress(addrExpr);
    if (constAddr !== undefined) {
      this.builder.emit(
        ILOpcode.PEEK,
        [createAddressOperand(constAddr)],
        `${label}($${constAddr.toString(16)})`
      );
      return;
    }

    // Decompose address into constant base + variable offsets
    const decomp = this.decomposeAddressExpression(addrExpr);

    // Tier 2: Single byte-typed variable offset + addition only → X-indexed
    if (decomp.isAdditionOnly && decomp.variableTerms.length === 1
        && !this.isWordTyped(decomp.variableTerms[0])) {
      this.generateExpression(decomp.variableTerms[0]);
      this.builder.emit(ILOpcode.TRANSFER_AX, [], 'index → X');
      this.builder.emit(
        ILOpcode.PEEK,
        [createIndexedAddressOperand(decomp.constantSum, 'X')],
        `${label}($${decomp.constantSum.toString(16)},X)`
      );
      return;
    }

    // Tier 3: General indirect addressing via ZP pointer
    this.generateTier3Address(addrExpr, decomp);
    this.builder.peekIndirect(`${label}(indirect)`);
  }

  /**
   * Generate IL for poke/volatile_write intrinsic using 3-tier strategy.
   *
   * Tier 1 (absolute): Address is a compile-time constant → STA addr
   * Tier 2 (indexed): Single byte variable + constant base → STA base,X
   * Tier 3 (indirect): Complex address → compute A:X, store ZP ptr, STA ($FB),Y
   *
   * @param addrExpr - Address expression
   * @param valueExpr - Value expression
   * @param label - Comment label (e.g., 'poke' or 'volatile_write')
   */
  protected generatePokeIntrinsic(addrExpr: Expression, valueExpr: Expression, label: string): void {
    // Tier 1: Pure constant address → absolute addressing
    const constAddr = this.tryResolveConstantAddress(addrExpr);
    if (constAddr !== undefined) {
      this.generateExpression(valueExpr);
      this.builder.emit(
        ILOpcode.POKE,
        [createAddressOperand(constAddr)],
        `${label}($${constAddr.toString(16)}, value)`
      );
      return;
    }

    // Decompose address into constant base + variable offsets
    const decomp = this.decomposeAddressExpression(addrExpr);

    // Tier 2: Single byte-typed variable offset + addition only → X-indexed
    if (decomp.isAdditionOnly && decomp.variableTerms.length === 1
        && !this.isWordTyped(decomp.variableTerms[0])) {
      // Generate offset into A, transfer to X, then generate value, use indexed poke
      this.generateExpression(decomp.variableTerms[0]);
      this.builder.emit(ILOpcode.TRANSFER_AX, [], 'index → X');
      this.generateExpression(valueExpr);
      this.builder.emit(
        ILOpcode.POKE,
        [createIndexedAddressOperand(decomp.constantSum, 'X')],
        `${label}($${decomp.constantSum.toString(16)},X, value)`
      );
      return;
    }

    // Tier 3: General indirect addressing via ZP pointer
    // Compute address first (before value), store to ZP pointer,
    // then generate value and store via indirect
    this.generateTier3Address(addrExpr, decomp);
    this.generateExpression(valueExpr);
    this.builder.pokeIndirect(`${label}(indirect)`);
  }

  /**
   * Generate IL for peekw intrinsic (16-bit read) using 3-tier strategy.
   *
   * Tier 1 (absolute): Address is compile-time constant → LDA addr / LDX addr+1
   * Tier 2 (indexed): Not applicable for peekw (word reads need consecutive bytes)
   * Tier 3 (indirect): Complex address → compute A:X, store ZP ptr, PEEKW_INDIRECT
   *
   * Note: Tier 2 (X-indexed) is skipped for peekw because reading two
   * consecutive bytes at base+X and base+X+1 is not straightforward
   * with 6502 indexed addressing. Tier 3 indirect handles this correctly.
   *
   * @param addrExpr - Address expression
   * @param label - Comment label
   */
  protected generatePeekwIntrinsic(addrExpr: Expression, label: string): void {
    // Tier 1: Pure constant address → absolute PEEKW (LDA addr / LDX addr+1)
    const constAddr = this.tryResolveConstantAddress(addrExpr);
    if (constAddr !== undefined) {
      this.builder.emit(
        ILOpcode.PEEKW,
        [createAddressOperand(constAddr)],
        `${label}($${constAddr.toString(16)})`
      );
      return;
    }

    // Tier 3: General indirect addressing via ZP pointer
    // (Tier 2 skipped — word reads need consecutive bytes, not easily X-indexed)
    const decomp = this.decomposeAddressExpression(addrExpr);
    this.generateTier3Address(addrExpr, decomp);
    this.builder.peekwIndirect(`${label}(indirect)`);
  }

  /**
   * Generate IL for pokew intrinsic (16-bit write) using 3-tier strategy.
   *
   * Tier 1 (absolute): Address is compile-time constant → STA addr / STX addr+1
   * Tier 2 (indexed): Not applicable for pokew (word writes need consecutive bytes)
   * Tier 3 (indirect): Complex address → compute A:X, store ZP ptr, POKEW_INDIRECT
   *
   * Note: Tier 2 (X-indexed) is skipped for pokew because writing two
   * consecutive bytes at base+X and base+X+1 is not straightforward
   * with 6502 indexed addressing. Tier 3 indirect handles this correctly.
   *
   * @param addrExpr - Address expression
   * @param valueExpr - Value expression
   * @param label - Comment label
   */
  protected generatePokewIntrinsic(addrExpr: Expression, valueExpr: Expression, label: string): void {
    // Tier 1: Pure constant address → absolute POKEW (STA addr / STX addr+1)
    const constAddr = this.tryResolveConstantAddress(addrExpr);
    if (constAddr !== undefined) {
      this.generateExpression(valueExpr);
      this.builder.emit(
        ILOpcode.POKEW,
        [createAddressOperand(constAddr)],
        `${label}($${constAddr.toString(16)}, value)`
      );
      return;
    }

    // Tier 3: General indirect addressing via ZP pointer
    // (Tier 2 skipped — word writes need consecutive bytes, not easily X-indexed)
    // Compute address first, store to ZP pointer, then generate value
    const decomp = this.decomposeAddressExpression(addrExpr);
    this.generateTier3Address(addrExpr, decomp);
    this.generateExpression(valueExpr);
    this.builder.pokewIndirect(`${label}(indirect)`);
  }
}
