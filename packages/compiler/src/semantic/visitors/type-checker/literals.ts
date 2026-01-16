/**
 * TypeChecker Literals Layer
 *
 * Handles type checking for literal expressions:
 * - Number literals (byte vs word inference)
 * - Boolean literals
 * - String literals
 * - Array literals
 * - Identifier expressions (symbol lookup)
 */

import { TypeCheckerBase } from './base.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type {
  LiteralExpression,
  IdentifierExpression,
  ArrayLiteralExpression,
} from '../../../ast/nodes.js';

/**
 * TypeCheckerLiterals - Type checks literal expressions
 *
 * Implements:
 * - visitLiteralExpression (numbers, booleans, strings)
 * - visitArrayLiteralExpression (array type inference)
 * - visitIdentifierExpression (symbol table lookup)
 */
export abstract class TypeCheckerLiterals extends TypeCheckerBase {
  // ============================================
  // LITERAL EXPRESSIONS
  // ============================================

  /**
   * Visit NumberLiteral - infer byte vs word based on value
   *
   * Type inference rules:
   * - 0-255: byte
   * - 256-65535: word
   * - >65535: error (too large)
   */
  public visitLiteralExpression(node: LiteralExpression): void {
    const value = node.getValue();

    let type: TypeInfo;

    if (typeof value === 'number') {
      // Number literal - infer byte vs word
      if (value < 0) {
        // Negative numbers not supported in Blend65
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Negative number literals are not supported`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
        type = this.typeSystem.getBuiltinType('byte')!;
      } else if (value <= 255) {
        // Fits in byte
        type = this.typeSystem.getBuiltinType('byte')!;
      } else if (value <= 65535) {
        // Needs word
        type = this.typeSystem.getBuiltinType('word')!;
      } else {
        // Too large for 6502
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Number literal ${value} exceeds maximum value 65535`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
        type = this.typeSystem.getBuiltinType('word')!;
      }
    } else if (typeof value === 'boolean') {
      // Boolean literal
      type = this.typeSystem.getBuiltinType('boolean')!;
    } else if (typeof value === 'string') {
      // String literal
      type = this.typeSystem.getBuiltinType('string')!;
    } else {
      // Unknown literal type (should not happen)
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Unknown literal type`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      type = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
    }

    // Annotate node with type
    (node as any).typeInfo = type;
  }

  /**
   * Visit ArrayLiteralExpression - infer array type from elements
   *
   * Type inference rules:
   * - Empty array: error (cannot infer type)
   * - Single element: array of that element's type
   * - Multiple elements: check all match first element's type
   */
  public visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    if (node.isEmpty()) {
      // Empty array - cannot infer type
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: 'Cannot infer type of empty array literal',
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Return byte array with size 0 as placeholder
      const type = this.typeSystem.createArrayType(this.typeSystem.getBuiltinType('byte')!, 0);
      (node as any).typeInfo = type;
      return;
    }

    // Type check first element to determine array type
    const elements = node.getElements();
    const firstElementType = this.typeCheckExpression(elements[0]);

    // Type check remaining elements and ensure they match
    // Array literals require exact type match (not just assignability)
    for (let i = 1; i < elements.length; i++) {
      const elementType = this.typeCheckExpression(elements[i]);

      // Require exact type kind match for array elements
      if (elementType.kind !== firstElementType.kind) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Array element type mismatch: expected '${firstElementType.name}', got '${elementType.name}'`,
          location: elements[i].getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
    }

    // Create array type with element type and size
    const type = this.typeSystem.createArrayType(firstElementType, elements.length);
    (node as any).typeInfo = type;
  }

  /**
   * Visit IdentifierExpression - look up symbol type
   *
   * Looks up the identifier in the symbol table and uses its declared type.
   * Reports error if identifier is not found.
   *
   * **Phase 7 (Task 7.1): Symbol Usage Tracking**
   * Marks the symbol as used for unused import detection.
   */
  public visitIdentifierExpression(node: IdentifierExpression): void {
    const name = node.getName();
    const symbol = this.symbolTable.lookup(name);

    if (!symbol) {
      // Undefined identifier
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Undefined identifier '${name}'`,
        location: node.getLocation(),
        code: DiagnosticCode.UNDEFINED_VARIABLE,
      });

      // Return unknown type as placeholder
      const unknownType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      (node as any).typeInfo = unknownType;
      return;
    }

    // Phase 7 (Task 7.1): Mark symbol as used for unused import detection
    if (!symbol.metadata) {
      symbol.metadata = {};
    }
    symbol.metadata.isUsed = true;

    // Use symbol's resolved type from Phase 2
    const type = symbol.type || {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
    (node as any).typeInfo = type;
  }
}
