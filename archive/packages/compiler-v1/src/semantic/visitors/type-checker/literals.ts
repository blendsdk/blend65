/**
 * TypeChecker Literals Layer
 *
 * Handles type checking for literal expressions:
 * - Number literals (byte vs word inference)
 * - Boolean literals
 * - String literals
 * - Array literals
 * - Identifier expressions (symbol lookup)
 * - Intrinsic function recognition
 */

import { TypeCheckerBase } from './base.js';
import type { TypeInfo, FunctionSignature } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type {
  LiteralExpression,
  IdentifierExpression,
  ArrayLiteralExpression,
} from '../../../ast/nodes.js';
import { INTRINSIC_REGISTRY } from '../../../il/intrinsics/registry.js';
import { ILTypeKind, type ILType } from '../../../il/types.js';

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
   * Convert IL type to semantic TypeInfo
   *
   * Maps IL types (IL_BYTE, IL_WORD, IL_VOID) to semantic TypeInfo.
   * This is used for converting intrinsic function signatures.
   *
   * @param ilType - IL type to convert
   * @returns Corresponding semantic TypeInfo
   */
  protected ilTypeToTypeInfo(ilType: ILType): TypeInfo {
    switch (ilType.kind) {
      case ILTypeKind.Void:
        return this.typeSystem.getBuiltinType('void')!;
      case ILTypeKind.Bool:
        return this.typeSystem.getBuiltinType('boolean')!;
      case ILTypeKind.Byte:
        return this.typeSystem.getBuiltinType('byte')!;
      case ILTypeKind.Word:
        return this.typeSystem.getBuiltinType('word')!;
      default:
        // For complex types (array, pointer, function), default to word
        return this.typeSystem.getBuiltinType('word')!;
    }
  }

  /**
   * Get intrinsic function type
   *
   * Creates a Callback TypeInfo for an intrinsic function based on its
   * definition in the IntrinsicRegistry. This allows intrinsics to be
   * type-checked like regular functions.
   *
   * **Special handling for compile-time intrinsics:**
   * - sizeof(type) and length(array) take special parameters (types/arrays)
   *   that aren't represented in the standard IL type system
   * - For these, we create a signature that accepts any single argument
   *
   * @param name - Intrinsic function name
   * @returns Callback TypeInfo for the intrinsic, or null if not an intrinsic
   */
  protected getIntrinsicType(name: string): TypeInfo | null {
    const intrinsic = INTRINSIC_REGISTRY.get(name);
    if (!intrinsic) {
      return null;
    }

    // Convert IL parameter types to semantic TypeInfo
    let parameterTypes: TypeInfo[];
    let parameterNames: string[];

    // Special handling for compile-time intrinsics that take type/array parameters
    // These have parameterTypes: [] in the registry but actually accept an argument
    // sizeof takes a type name (byte, word, boolean) or a variable expression
    // length takes an array expression
    // For semantic analysis, we use a permissive approach that accepts any argument
    if (intrinsic.isCompileTime && intrinsic.parameterNames.length > 0 && intrinsic.parameterTypes.length === 0) {
      // Create an Unknown type that accepts any argument
      // This allows type names like "byte", "word" and also variable expressions
      const anyType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'any',
        size: 0,
        isSigned: false,
        isAssignable: true, // Allow any value to be passed
      };
      parameterTypes = [anyType];
      parameterNames = [...intrinsic.parameterNames];
    } else {
      // Standard intrinsics - convert IL parameter types to semantic TypeInfo
      parameterTypes = intrinsic.parameterTypes.map(ilType => this.ilTypeToTypeInfo(ilType));
      parameterNames = [...intrinsic.parameterNames];
    }

    // Convert IL return type to semantic TypeInfo
    const returnType = this.ilTypeToTypeInfo(intrinsic.returnType);

    // Create function signature
    const signature: FunctionSignature = {
      parameters: parameterTypes,
      returnType,
      parameterNames,
    };

    // Create and return callback type
    return this.typeSystem.createCallbackType(signature);
  }

  /**
   * Visit IdentifierExpression - look up symbol type or intrinsic
   *
   * Looks up the identifier in the symbol table and uses its declared type.
   * If not found in symbol table, checks if it's a built-in intrinsic function.
   * Reports error if identifier is not found anywhere.
   *
   * **Intrinsic Recognition:**
   * Intrinsic functions (peek, poke, sei, cli, etc.) are recognized here
   * and given proper Callback types based on their definitions in the
   * IntrinsicRegistry. This allows type checking of intrinsic calls.
   *
   * **Phase 7 (Task 7.1): Symbol Usage Tracking**
   * Marks the symbol as used for unused import detection.
   */
  public visitIdentifierExpression(node: IdentifierExpression): void {
    const name = node.getName();
    const symbol = this.symbolTable.lookup(name);

    if (!symbol) {
      // Symbol not found in symbol table - check if it's an intrinsic
      const intrinsicType = this.getIntrinsicType(name);
      if (intrinsicType) {
        // Mark node as intrinsic call for IL generator
        (node as any).isIntrinsic = true;
        (node as any).intrinsicName = name;
        (node as any).typeInfo = intrinsicType;
        return;
      }

      // Not an intrinsic either - undefined identifier
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