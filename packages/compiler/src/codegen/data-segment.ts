/**
 * Data Segment Builder
 *
 * Collects all @data const declarations and packs their initializer
 * values into a raw byte array for binary output. The data segment
 * is appended after the code segment in the final binary.
 *
 * **Responsibilities:**
 * - Evaluate constant initializers at compile time
 * - Pack scalar and array values into raw bytes
 * - Track total data segment size
 * - Support byte and word types
 *
 * **Binary Layout:**
 * ```
 * $0801          BASIC SYS stub
 * $080D-$xxxx   Code segment
 * $xxxx-$yyyy   Global RAM region (@ram, default globals)
 * $yyyy-$zzzz   Data segment (@data const blocks)
 * ```
 *
 * @module codegen/data-segment
 */

import type { GlobalSlot } from '../frame/types-global.js';
import { ASTNodeType, type Expression } from '../ast/base.js';

// ============================================================================
// Data Segment Entry
// ============================================================================

/**
 * A single entry in the data segment.
 *
 * Each entry represents one @data const variable with its
 * packed byte representation.
 *
 * @example
 * ```typescript
 * // For: @data const colors: byte[] = [0, 1, 2, 7, 14]
 * const entry: DataSegmentEntry = {
 *   name: 'colors',
 *   qualifiedName: 'Game.colors',
 *   address: 0x2000,
 *   bytes: Uint8Array.from([0, 1, 2, 7, 14]),
 *   size: 5,
 * };
 * ```
 */
export interface DataSegmentEntry {
  /** Variable name */
  readonly name: string;

  /** Fully qualified name (module.name) */
  readonly qualifiedName: string;

  /** Assigned absolute address in binary */
  readonly address: number;

  /** Packed byte data */
  readonly bytes: Uint8Array;

  /** Size in bytes */
  readonly size: number;
}

// ============================================================================
// Data Segment Result
// ============================================================================

/**
 * Result of building the data segment.
 *
 * Contains the packed byte array and metadata about the entries.
 */
export interface DataSegmentResult {
  /** Complete data segment bytes (all entries concatenated) */
  readonly bytes: Uint8Array;

  /** Total size in bytes */
  readonly totalSize: number;

  /** Individual data entries for debugging/inspection */
  readonly entries: DataSegmentEntry[];

  /** Any errors encountered during constant evaluation */
  readonly errors: string[];
}

// ============================================================================
// Data Segment Builder
// ============================================================================

/**
 * Builds the data segment from @data const global variables.
 *
 * Evaluates constant initializers at compile time and packs
 * them into a sequential byte array. Supports:
 * - Byte literals (decimal, hex, binary)
 * - Word literals (16-bit values, little-endian)
 * - Array literals (each element evaluated and packed)
 *
 * @example
 * ```typescript
 * const builder = new DataSegmentBuilder();
 * const result = builder.build(dataGlobals);
 *
 * if (result.errors.length === 0) {
 *   // Append result.bytes to binary output
 *   output.set(result.bytes, codeSegmentEnd);
 * }
 * ```
 */
export class DataSegmentBuilder {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Collected errors during constant evaluation */
  protected errors: string[] = [];

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Builds the data segment from @data global slots.
   *
   * Filters for @data globals, evaluates their initializers,
   * and packs the results into a byte array.
   *
   * @param globals - Map of all global slots (only @data ones are processed)
   * @returns DataSegmentResult with packed bytes and metadata
   */
  public build(globals: Map<string, GlobalSlot>): DataSegmentResult {
    this.errors = [];
    const entries: DataSegmentEntry[] = [];

    // Process only @data globals, sorted by address for deterministic output
    const dataGlobals = Array.from(globals.values())
      .filter(slot => slot.storageClass === 'data')
      .sort((a, b) => a.address - b.address);

    for (const slot of dataGlobals) {
      const entry = this.buildEntry(slot);
      if (entry) {
        entries.push(entry);
      }
    }

    // Concatenate all entries into single byte array
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const bytes = new Uint8Array(totalSize);
    let offset = 0;

    for (const entry of entries) {
      bytes.set(entry.bytes, offset);
      offset += entry.size;
    }

    return {
      bytes,
      totalSize,
      entries,
      errors: [...this.errors],
    };
  }

  // ==========================================================================
  // Entry Building
  // ==========================================================================

  /**
   * Builds a single data segment entry from a global slot.
   *
   * Evaluates the initializer expression and packs the result
   * into bytes based on the variable's type.
   *
   * @param slot - The @data global slot
   * @returns DataSegmentEntry, or undefined if evaluation fails
   */
  protected buildEntry(slot: GlobalSlot): DataSegmentEntry | undefined {
    if (!slot.initializer) {
      this.errors.push(
        `@data variable '${slot.qualifiedName}' has no initializer`,
      );
      return undefined;
    }

    const bytes = this.evaluateInitializer(slot.initializer, slot.size, slot.qualifiedName);
    if (!bytes) {
      return undefined;
    }

    return {
      name: slot.name,
      qualifiedName: slot.qualifiedName,
      address: slot.address,
      bytes,
      size: bytes.length,
    };
  }

  // ==========================================================================
  // Constant Evaluation
  // ==========================================================================

  /**
   * Evaluates an initializer expression to packed bytes.
   *
   * Supports:
   * - NumericLiteral → single byte or word (little-endian)
   * - ArrayLiteral → each element evaluated and packed
   *
   * @param expr - The initializer expression
   * @param expectedSize - Expected size in bytes (from type)
   * @param varName - Variable name for error messages
   * @returns Packed bytes, or undefined on evaluation failure
   */
  protected evaluateInitializer(
    expr: Expression,
    expectedSize: number,
    varName: string,
  ): Uint8Array | undefined {
    const nodeType = expr.getNodeType();

    // Handle array literals (ASTNodeType.ARRAY_LITERAL_EXPR = 'ArrayLiteralExpression')
    if (nodeType === ASTNodeType.ARRAY_LITERAL_EXPR) {
      return this.evaluateArrayLiteral(expr, varName);
    }

    // Handle scalar values
    const value = this.evaluateConstantExpression(expr);
    if (value === undefined) {
      this.errors.push(
        `Cannot evaluate constant initializer for '${varName}'`,
      );
      return undefined;
    }

    // Pack scalar value based on expected size
    if (expectedSize <= 1) {
      return Uint8Array.from([value & 0xFF]);
    }
    // Word: little-endian (low byte first)
    return Uint8Array.from([value & 0xFF, (value >> 8) & 0xFF]);
  }

  /**
   * Evaluates an array literal to packed bytes.
   *
   * Each element is evaluated as a constant expression and
   * packed sequentially. All elements are assumed to be bytes
   * unless the array element type indicates otherwise.
   *
   * @param expr - The array literal expression
   * @param varName - Variable name for error messages
   * @returns Packed bytes for all elements
   */
  protected evaluateArrayLiteral(
    expr: Expression,
    varName: string,
  ): Uint8Array | undefined {
    // Access array elements via the AST node interface
    // ArrayLiteral has getElements() returning Expression[]
    const elementsGetter = expr as unknown as { getElements?(): Expression[] };
    if (!elementsGetter.getElements) {
      this.errors.push(
        `'${varName}' array literal has no getElements() method`,
      );
      return undefined;
    }

    const elements = elementsGetter.getElements();
    const bytes: number[] = [];

    for (let i = 0; i < elements.length; i++) {
      const value = this.evaluateConstantExpression(elements[i]);
      if (value === undefined) {
        this.errors.push(
          `Cannot evaluate element [${i}] of '${varName}'`,
        );
        return undefined;
      }
      bytes.push(value & 0xFF);
    }

    return Uint8Array.from(bytes);
  }

  /**
   * Evaluates a constant expression to a numeric value.
   *
   * Supports:
   * - NumericLiteral: decimal, hex ($FF, 0xFF), binary (%10101010)
   * - UnaryExpression with '-': negation of constant
   * - BinaryExpression with constant operands: +, -, *, /
   * - BooleanLiteral: true=1, false=0
   *
   * @param expr - Expression to evaluate
   * @returns Numeric value, or undefined if not a constant
   */
  protected evaluateConstantExpression(expr: Expression): number | undefined {
    const nodeType = expr.getNodeType();

    // LiteralExpression covers all scalar literals (number, boolean, string)
    // Blend AST uses a single LiteralExpression class with getValue() returning LiteralValue
    if (nodeType === ASTNodeType.LITERAL_EXPR) {
      const litExpr = expr as unknown as { getValue(): number | string | boolean };
      if (litExpr.getValue) {
        const val = litExpr.getValue();
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? 1 : 0;
        // String literals cannot be packed as numeric constants
      }
      return undefined;
    }

    // Unary expression — support negation, bitwise NOT, logical NOT
    if (nodeType === ASTNodeType.UNARY_EXPR) {
      const unary = expr as unknown as {
        getOperator(): string;
        getOperand(): Expression;
      };
      if (unary.getOperator && unary.getOperand) {
        const operand = this.evaluateConstantExpression(unary.getOperand());
        if (operand === undefined) return undefined;

        switch (unary.getOperator()) {
          case '-': return (-operand) & 0xFFFF;
          case '~': return (~operand) & 0xFFFF;
          case '!': return operand === 0 ? 1 : 0;
          default: return undefined;
        }
      }
      return undefined;
    }

    // Binary expression — support basic arithmetic
    if (nodeType === ASTNodeType.BINARY_EXPR) {
      const binary = expr as unknown as {
        getOperator(): string;
        getLeft(): Expression;
        getRight(): Expression;
      };
      if (binary.getOperator && binary.getLeft && binary.getRight) {
        const left = this.evaluateConstantExpression(binary.getLeft());
        const right = this.evaluateConstantExpression(binary.getRight());
        if (left === undefined || right === undefined) return undefined;

        switch (binary.getOperator()) {
          case '+': return (left + right) & 0xFFFF;
          case '-': return (left - right) & 0xFFFF;
          case '*': return (left * right) & 0xFFFF;
          case '/': return right !== 0 ? Math.floor(left / right) : undefined;
          case '%': return right !== 0 ? left % right : undefined;
          case '|': return left | right;
          case '&': return left & right;
          case '^': return left ^ right;
          case '<<': return (left << right) & 0xFFFF;
          case '>>': return left >> right;
          default: return undefined;
        }
      }
      return undefined;
    }

    // Unsupported expression type
    return undefined;
  }
}
