/**
 * Literal Type Checker for Blend65 Compiler v2
 *
 * Extends TypeCheckerBase to add type inference for literal expressions:
 * - Numeric literals (42, $D000, 0xFF, 0b1010)
 * - String literals ("hello")
 * - Boolean literals (true, false)
 * - Array literals ([1, 2, 3])
 *
 * This is the second layer of the type checker inheritance chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker → ...
 *
 * @module semantic/visitors/type-checker/literals
 */

import type { LiteralExpression, ArrayLiteralExpression } from '../../../ast/index.js';
import { TypeCheckerBase, TypeCheckDiagnosticCodes } from './base.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticCode } from '../../../ast/diagnostics.js';

/**
 * Maximum value that fits in a byte (8-bit unsigned)
 */
const BYTE_MAX = 255;

/**
 * Maximum value that fits in a word (16-bit unsigned)
 */
const WORD_MAX = 65535;

/**
 * Literal Type Checker - Type inference for literal expressions
 *
 * Handles type checking for all literal value expressions:
 *
 * **Numeric Literals:**
 * - Decimal: `42`, `255`, `65535`
 * - Hexadecimal: `$D000`, `0xFF`, `0x1234`
 * - Binary: `0b1010`, `0b11111111`
 *
 * Type inference rules for numeric literals:
 * - 0-255 → byte
 * - 256-65535 → word
 * - >65535 → error (out of range)
 * - Negative → error (unsigned only)
 *
 * **String Literals:**
 * - `"hello"` → string type
 * - Escape sequences: `\n`, `\r`, `\t`, `\\`, `\"`
 *
 * **Boolean Literals:**
 * - `true`, `false` → bool type
 *
 * **Array Literals:**
 * - `[1, 2, 3]` → byte[] (inferred from elements)
 * - `[$100, $200]` → word[] (inferred from elements)
 * - `[]` → error (cannot infer type without context)
 *
 * @example
 * ```typescript
 * class MyChecker extends LiteralTypeChecker {
 *   // Override to add custom literal checking
 *   override visitLiteralExpression(node: LiteralExpression): void {
 *     super.visitLiteralExpression(node);
 *     const result = this.getExpressionType(node);
 *     // Custom logic here
 *   }
 * }
 * ```
 */
export abstract class LiteralTypeChecker extends TypeCheckerBase {
  // ============================================
  // LITERAL EXPRESSION VISITORS
  // ============================================

  /**
   * Type check a literal expression
   *
   * Infers the type based on the literal value:
   * - number → byte or word (based on value range)
   * - string → string
   * - boolean → bool
   *
   * @param node - The literal expression node
   */
  override visitLiteralExpression(node: LiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const value = node.getValue();

    if (typeof value === 'number') {
      this.checkNumericLiteral(node, value);
    } else if (typeof value === 'string') {
      this.checkStringLiteral(node, value);
    } else if (typeof value === 'boolean') {
      this.checkBooleanLiteral(node, value);
    } else {
      // Unknown literal type - should not happen with correct parser
      this.setExpressionType(node, null, false);
    }

    this.exitNode(node);
  }

  /**
   * Type check an array literal expression
   *
   * Infers the array type from element types:
   * - All byte elements → byte[]
   * - Any word element → word[] (promote all to word)
   * - Mixed incompatible types → error
   * - Empty array → error (cannot infer)
   *
   * @param node - The array literal expression node
   */
  override visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const elements = node.getElements();

    // Empty array - cannot infer type without context
    if (elements.length === 0) {
      this.reportError(
        TypeCheckDiagnosticCodes.EMPTY_ARRAY_NO_TYPE as DiagnosticCode,
        'Cannot infer type of empty array literal',
        node.getLocation(),
        'Provide an explicit type annotation or add at least one element'
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // First, type check all elements
    for (const element of elements) {
      if (this.shouldStop) break;
      element.accept(this);
    }

    // Infer array element type from elements
    const inferredType = this.inferArrayElementType(node);

    if (inferredType) {
      // Create array type with inferred element type and known size
      const arrayType = this.typeSystem.createArrayType(inferredType, elements.length);

      // Array literal is constant if all elements are constants
      const allConstant = elements.every((elem) => {
        const result = this.getExpressionType(elem);
        return result?.isConstant ?? false;
      });

      // Collect constant values if all are constant
      let constantValues: (number | string | boolean)[] | undefined;
      if (allConstant) {
        constantValues = elements.map((elem) => {
          const result = this.getExpressionType(elem);
          return result?.constantValue;
        }).filter((v): v is number | string | boolean => v !== undefined);
      }

      this.setExpressionType(node, arrayType, allConstant, constantValues as unknown as number);
    } else {
      // Type inference failed - error already reported
      this.setExpressionType(node, null, false);
    }

    this.exitNode(node);
  }

  // ============================================
  // NUMERIC LITERAL TYPE CHECKING
  // ============================================

  /**
   * Type check a numeric literal
   *
   * Rules:
   * - 0-255 → byte
   * - 256-65535 → word
   * - >65535 → error
   * - Negative → error (Blend65 uses unsigned types only)
   *
   * @param node - The literal expression node
   * @param value - The numeric value
   */
  protected checkNumericLiteral(node: LiteralExpression, value: number): void {
    // Check for negative values (not supported in Blend65)
    if (value < 0) {
      this.reportError(
        TypeCheckDiagnosticCodes.NUMERIC_OVERFLOW as DiagnosticCode,
        `Negative literal '${value}' is not supported - Blend65 uses unsigned types`,
        node.getLocation(),
        'Use explicit subtraction if you need negative values'
      );
      this.setExpressionType(node, null, true, value);
      return;
    }

    // Check for overflow beyond word
    if (value > WORD_MAX) {
      this.reportError(
        TypeCheckDiagnosticCodes.NUMERIC_OVERFLOW as DiagnosticCode,
        `Numeric literal '${value}' exceeds maximum word value (${WORD_MAX})`,
        node.getLocation(),
        'Maximum value is 65535 ($FFFF)'
      );
      this.setExpressionType(node, null, true, value);
      return;
    }

    // Check for non-integer values
    if (!Number.isInteger(value)) {
      this.reportError(
        TypeCheckDiagnosticCodes.NUMERIC_OVERFLOW as DiagnosticCode,
        `Floating-point literal '${value}' is not supported - Blend65 uses integers only`,
        node.getLocation(),
        'Use integer values only'
      );
      this.setExpressionType(node, null, true, value);
      return;
    }

    // Determine type based on value range
    if (value <= BYTE_MAX) {
      const byteType = this.getBuiltinType('byte')!;
      this.setExpressionType(node, byteType, true, value);
    } else {
      const wordType = this.getBuiltinType('word')!;
      this.setExpressionType(node, wordType, true, value);
    }
  }

  // ============================================
  // STRING LITERAL TYPE CHECKING
  // ============================================

  /**
   * Type check a string literal
   *
   * String literals are compile-time only in Blend65 - they are
   * typically used for:
   * - Error messages
   * - PETSCII text data
   * - Debug output
   *
   * @param node - The literal expression node
   * @param value - The string value
   */
  protected checkStringLiteral(node: LiteralExpression, value: string): void {
    const stringType = this.getBuiltinType('string')!;
    this.setExpressionType(node, stringType, true, value);
  }

  // ============================================
  // BOOLEAN LITERAL TYPE CHECKING
  // ============================================

  /**
   * Type check a boolean literal
   *
   * Boolean values (true/false) have type 'bool'.
   * At runtime, bool is represented as a byte (0 = false, non-zero = true).
   *
   * @param node - The literal expression node
   * @param value - The boolean value
   */
  protected checkBooleanLiteral(node: LiteralExpression, value: boolean): void {
    const boolType = this.getBuiltinType('bool')!;
    this.setExpressionType(node, boolType, true, value);
  }

  // ============================================
  // ARRAY LITERAL TYPE INFERENCE
  // ============================================

  /**
   * Infers the element type for an array literal
   *
   * Algorithm:
   * 1. Collect types of all elements
   * 2. Find the "widest" numeric type if all numeric (byte vs word)
   * 3. If non-numeric types, all must be the same type
   * 4. Report error for incompatible element types
   *
   * @param node - The array literal expression
   * @returns The inferred element type, or null if error
   */
  protected inferArrayElementType(node: ArrayLiteralExpression): TypeInfo | null {
    const elements = node.getElements();

    if (elements.length === 0) {
      return null; // Handled by caller
    }

    // Get type of first element
    const firstResult = this.getExpressionType(elements[0]);
    if (!firstResult?.type) {
      return null; // First element had an error
    }

    let inferredType = firstResult.type;

    // Check remaining elements
    for (let i = 1; i < elements.length; i++) {
      const elementResult = this.getExpressionType(elements[i]);

      if (!elementResult?.type) {
        // Element had an error - skip
        continue;
      }

      const elementType = elementResult.type;

      // Check compatibility
      if (this.areTypesEqual(inferredType, elementType)) {
        // Same type - no change needed
        continue;
      }

      // Handle numeric type widening: byte → word
      if (this.isNumericType(inferredType) && this.isNumericType(elementType)) {
        // Widen to word if either is word
        if (elementType.kind === TypeKind.Word) {
          inferredType = this.getBuiltinType('word')!;
        } else if (inferredType.kind === TypeKind.Word) {
          // inferredType is already word, no change
        }
        // Both byte - no change needed
        continue;
      }

      // Handle bool/byte compatibility (bool is stored as byte)
      if (
        (inferredType.kind === TypeKind.Bool && elementType.kind === TypeKind.Byte) ||
        (inferredType.kind === TypeKind.Byte && elementType.kind === TypeKind.Bool)
      ) {
        // Promote to byte
        inferredType = this.getBuiltinType('byte')!;
        continue;
      }

      // Incompatible types
      this.reportError(
        TypeCheckDiagnosticCodes.ARRAY_ELEMENT_TYPE_MISMATCH as DiagnosticCode,
        `Array element type '${elementType.name}' is incompatible with previous element type '${inferredType.name}'`,
        elements[i].getLocation(),
        'All array elements must have compatible types'
      );
      return null;
    }

    return inferredType;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Checks if a numeric value would fit in a byte type
   *
   * @param value - The numeric value to check
   * @returns True if value fits in byte (0-255)
   */
  protected isValidByteValue(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= BYTE_MAX;
  }

  /**
   * Checks if a numeric value would fit in a word type
   *
   * @param value - The numeric value to check
   * @returns True if value fits in word (0-65535)
   */
  protected isValidWordValue(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= WORD_MAX;
  }

  /**
   * Gets the minimum type needed to represent a numeric value
   *
   * @param value - The numeric value
   * @returns 'byte', 'word', or null if value is out of range
   */
  protected getMinTypeForNumeric(value: number): TypeInfo | null {
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }
    if (value <= BYTE_MAX) {
      return this.getBuiltinType('byte')!;
    }
    if (value <= WORD_MAX) {
      return this.getBuiltinType('word')!;
    }
    return null;
  }
}