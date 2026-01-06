/**
 * Type System Infrastructure for Blend65 Semantic Analysis
 * Task 1.3: Create Type System Infrastructure
 *
 * This file implements the core type checking functionality for the Blend65 compiler:
 * - Blend65 type representations and validation
 * - Type compatibility checking with 6502-specific rules
 * - Storage class validation (zp, ram, data, const)
 * - Array type checking with compile-time size validation
 * - Function signature type checking including callback functions
 * - Type promotion and conversion rules
 *
 * Educational Focus:
 * - How compilers implement type checking systems
 * - Type safety in 6502 assembly generation
 * - Storage class semantics for memory-mapped hardware
 * - Function type compatibility with callbacks
 */

import { SourcePosition } from '@blend65/lexer';
import type {
  Expression,
  TypeAnnotation,
  ArrayLiteral,
  FunctionDeclaration,
  NamedType,
  StorageClass,
} from '@blend65/ast';
import {
  Blend65Type,
  ScopeType,
  SemanticError,
  SemanticResult,
  Symbol,
  VariableSymbol,
  FunctionSymbol,
  isPrimitiveType,
  isArrayType,
  isNamedType,
  isCallbackType,
  createPrimitiveType,
  createArrayType,
  createNamedType,
  createCallbackType,
  areTypesEqual,
  typeToString,
  validateStorageClassUsage,
} from './types.js';

// ============================================================================
// TYPE SYSTEM HELPER INTERFACES
// ============================================================================

/**
 * Validated function parameter with resolved types.
 */
export interface ValidatedParameter {
  name: string;
  type: Blend65Type;
  hasDefaultValue: boolean;
}

/**
 * Function signature with resolved parameter and return types.
 */
export interface FunctionSignature {
  parameters: ValidatedParameter[];
  returnType: Blend65Type;
  isCallback: boolean;
}

// ============================================================================
// TYPE CHECKING ENGINE
// ============================================================================

/**
 * Main type checking engine for Blend65.
 *
 * Educational Note:
 * - Type checking ensures program correctness before code generation
 * - Prevents runtime errors that would be difficult to debug in 6502 assembly
 * - Enforces storage class semantics for optimal memory usage
 * - Validates callback function compatibility for interrupt handlers
 */
export class TypeChecker {
  /** Accumulated errors during type checking */
  private errors: SemanticError[];

  /** Current scope type for storage class validation */
  private currentScopeType: ScopeType;

  /** Symbol lookup function for type resolution */
  private symbolLookup: (name: string) => Symbol | null;

  /**
   * Initialize type checker with symbol lookup capability.
   */
  constructor(symbolLookup: (name: string) => Symbol | null) {
    this.errors = [];
    this.currentScopeType = 'Global';
    this.symbolLookup = symbolLookup;
  }

  /**
   * Set current scope type for storage class validation.
   */
  setCurrentScope(scopeType: ScopeType): void {
    this.currentScopeType = scopeType;
  }

  /**
   * Get accumulated errors.
   */
  getErrors(): SemanticError[] {
    return [...this.errors];
  }

  /**
   * Clear accumulated errors.
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Add an error to the error list.
   */
  private addError(error: SemanticError): void {
    this.errors.push(error);
  }

  /**
   * Get the addError method for validation.
   */
  getAddError(): (error: SemanticError) => void {
    return this.addError.bind(this);
  }

  // ============================================================================
  // TYPE REPRESENTATION AND VALIDATION
  // ============================================================================

  /**
   * Convert AST type annotation to internal Blend65Type representation.
   *
   * Educational Note:
   * - AST types are parser output, internal types are semantic analysis input
   * - Type resolution converts string references to concrete types
   * - Array size validation ensures compile-time constants
   */
  convertASTTypeToBlend65Type(
    astType: TypeAnnotation,
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    switch (astType.type) {
      case 'PrimitiveType':
        return {
          success: true,
          data: createPrimitiveType(astType.name as any),
        };

      case 'ArrayType':
        // Validate array element type
        const elementTypeResult = this.convertASTTypeToBlend65Type(astType.elementType, location);
        if (!elementTypeResult.success) {
          return elementTypeResult;
        }

        // Validate array size is compile-time constant
        const sizeResult = this.evaluateConstantExpression(astType.size);
        if (!sizeResult.success || typeof sizeResult.data !== 'number') {
          return {
            success: false,
            errors: [
              {
                errorType: 'ConstantRequired',
                message: `Array size must be a compile-time constant number`,
                location,
                suggestions: [
                  'Use a literal number for array size: byte[10]',
                  'Ensure array size is known at compile time',
                ],
              },
            ],
          };
        }

        const arraySize = sizeResult.data;
        if (arraySize <= 0 || arraySize !== Math.floor(arraySize)) {
          return {
            success: false,
            errors: [
              {
                errorType: 'ConstantRequired',
                message: `Array size must be a positive integer, got: ${arraySize}`,
                location,
                suggestions: [
                  'Use a positive integer for array size',
                  'Check array size calculation',
                ],
              },
            ],
          };
        }

        // Check array size limits for 6502
        if (arraySize > 65536) {
          return {
            success: false,
            errors: [
              {
                errorType: 'ArrayBounds',
                message: `Array size ${arraySize} exceeds maximum 6502 memory (65536 bytes)`,
                location,
                suggestions: [
                  'Reduce array size to fit in 6502 memory',
                  'Consider using multiple smaller arrays',
                ],
              },
            ],
          };
        }

        return {
          success: true,
          data: createArrayType(elementTypeResult.data, arraySize),
        };

      case 'NamedType':
        // Create named type reference (will be resolved later)
        return {
          success: true,
          data: createNamedType(astType.name),
        };

      default:
        return {
          success: false,
          errors: [
            {
              errorType: 'InvalidOperation',
              message: `Unsupported type annotation: ${astType.type}`,
              location,
              suggestions: [
                'Use a supported type: byte, word, boolean, array, or named type',
                'Check type annotation syntax',
              ],
            },
          ],
        };
    }
  }

  /**
   * Evaluate a compile-time constant expression.
   */
  private evaluateConstantExpression(
    expression: Expression
  ): SemanticResult<number | string | boolean> {
    switch (expression.type) {
      case 'Literal':
        return {
          success: true,
          data: expression.value,
        };

      case 'BinaryExpr':
        // Simple arithmetic for array sizes
        const leftResult = this.evaluateConstantExpression(expression.left);
        const rightResult = this.evaluateConstantExpression(expression.right);

        if (!leftResult.success || !rightResult.success) {
          return {
            success: false,
            errors: [
              {
                errorType: 'ConstantRequired',
                message: 'Array size expression contains non-constant values',
                location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
              },
            ],
          };
        }

        if (typeof leftResult.data === 'number' && typeof rightResult.data === 'number') {
          switch (expression.operator) {
            case '+':
              return { success: true, data: leftResult.data + rightResult.data };
            case '-':
              return { success: true, data: leftResult.data - rightResult.data };
            case '*':
              return { success: true, data: leftResult.data * rightResult.data };
            case '/':
              return { success: true, data: Math.floor(leftResult.data / rightResult.data) };
            default:
              return {
                success: false,
                errors: [
                  {
                    errorType: 'ConstantRequired',
                    message: `Operator '${expression.operator}' not supported in constant expressions`,
                    location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
                  },
                ],
              };
          }
        }

        return {
          success: false,
          errors: [
            {
              errorType: 'ConstantRequired',
              message: 'Array size expression must evaluate to a number',
              location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
            },
          ],
        };

      default:
        return {
          success: false,
          errors: [
            {
              errorType: 'ConstantRequired',
              message: 'Array size expression must be a compile-time constant',
              location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
            },
          ],
        };
    }
  }

  /**
   * Resolve named type references to concrete types.
   *
   * Educational Note:
   * - Named types enable forward declarations and user-defined types
   * - Type resolution happens after symbol table construction
   * - Recursive type checking prevents infinite loops
   */
  resolveNamedType(
    namedType: NamedType,
    location: SourcePosition,
    visited: Set<string> = new Set()
  ): SemanticResult<Blend65Type> {
    // Check for circular type references
    if (visited.has(namedType.name)) {
      return {
        success: false,
        errors: [
          {
            errorType: 'CircularDependency',
            message: `Circular type reference detected: ${namedType.name}`,
            location,
            suggestions: [
              'Remove circular dependencies in type definitions',
              'Use forward declarations to break cycles',
            ],
          },
        ],
      };
    }

    // Look up the type symbol
    const symbol = this.symbolLookup(namedType.name);
    if (!symbol) {
      return {
        success: false,
        errors: [
          {
            errorType: 'UndefinedSymbol',
            message: `Type '${namedType.name}' is not defined`,
            location,
            suggestions: [
              `Define the type '${namedType.name}' before using it`,
              'Check spelling and case of type name',
              "Import the type if it's from another module",
            ],
          },
        ],
      };
    }

    // Verify it's actually a type symbol
    if (symbol.symbolType !== 'Type' && symbol.symbolType !== 'Enum') {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `'${namedType.name}' is a ${symbol.symbolType.toLowerCase()}, not a type`,
            location,
            suggestions: [
              `Use a type name instead of ${symbol.symbolType.toLowerCase()} name`,
              'Check if you meant to reference a different symbol',
            ],
          },
        ],
      };
    }

    // For enum types, return the underlying type (usually byte)
    if (symbol.symbolType === 'Enum') {
      return {
        success: true,
        data: createPrimitiveType('byte'), // Enums are represented as bytes
      };
    }

    // For user-defined types, this would resolve to the type definition
    // For now, we'll treat them as opaque types
    return {
      success: true,
      data: createNamedType(namedType.name),
    };
  }

  /**
   * Get the concrete type from a potentially named type.
   */
  getConcreteType(type: Blend65Type, location: SourcePosition): SemanticResult<Blend65Type> {
    if (isNamedType(type)) {
      // Convert semantic NamedType to AST NamedType structure
      const astNamedType = {
        type: 'NamedType' as const,
        name: type.name,
        metadata: { start: location, end: location },
      };
      return this.resolveNamedType(astNamedType, location);
    }
    return {
      success: true,
      data: type,
    };
  }

  // ============================================================================
  // TYPE COMPATIBILITY CHECKING
  // ============================================================================

  /**
   * Check if source type can be assigned to target type.
   *
   * Educational Note:
   * - Assignment compatibility is stricter than general type compatibility
   * - Blend65 uses explicit conversions to prevent 6502 assembly errors
   * - Storage classes affect assignment compatibility
   */
  checkAssignmentCompatibility(
    target: Blend65Type,
    source: Blend65Type,
    location: SourcePosition
  ): SemanticResult<void> {
    // Resolve named types
    const targetResult = this.getConcreteType(target, location);
    if (!targetResult.success) {
      return targetResult;
    }

    const sourceResult = this.getConcreteType(source, location);
    if (!sourceResult.success) {
      return sourceResult;
    }

    const concreteTarget = targetResult.data;
    const concreteSource = sourceResult.data;

    // Check exact type equality first
    if (areTypesEqual(concreteTarget, concreteSource)) {
      return {
        success: true,
        data: undefined,
      };
    }

    // Check specific compatibility rules
    return this.checkSpecificCompatibility(concreteTarget, concreteSource, location);
  }

  /**
   * Check specific type compatibility rules.
   */
  private checkSpecificCompatibility(
    target: Blend65Type,
    source: Blend65Type,
    location: SourcePosition
  ): SemanticResult<void> {
    // Primitive type compatibility
    if (isPrimitiveType(target) && isPrimitiveType(source)) {
      return this.checkPrimitiveCompatibility(target, source, location);
    }

    // Array type compatibility
    if (isArrayType(target) && isArrayType(source)) {
      return this.checkArrayCompatibility(target, source, location);
    }

    // Callback type compatibility
    if (isCallbackType(target) && isCallbackType(source)) {
      return this.checkCallbackCompatibility(target, source, location);
    }

    // Different type kinds are not compatible
    return {
      success: false,
      errors: [
        {
          errorType: 'TypeMismatch',
          message: `Cannot assign ${typeToString(source)} to ${typeToString(target)}`,
          location,
          suggestions: [
            `Use explicit type conversion if intended`,
            `Check if types should match exactly`,
          ],
        },
      ],
    };
  }

  /**
   * Check primitive type compatibility.
   */
  private checkPrimitiveCompatibility(
    target: any,
    source: any,
    location: SourcePosition
  ): SemanticResult<void> {
    // Exact matches are always compatible
    if (target.name === source.name) {
      return {
        success: true,
        data: undefined,
      };
    }

    // Define allowed implicit conversions
    const allowedConversions: Record<string, string[]> = {
      // No implicit conversions in Blend65 for 6502 safety
      // All conversions must be explicit
    };

    const allowed = allowedConversions[target.name]?.includes(source.name) ?? false;

    if (!allowed) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Cannot assign ${source.name} to ${target.name} without explicit conversion`,
            location,
            suggestions: [
              'Use explicit type conversion functions',
              'Ensure both sides have the same type',
              'Consider if byte/word conversion is needed',
            ],
          },
        ],
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Check array type compatibility.
   */
  private checkArrayCompatibility(
    target: any,
    source: any,
    location: SourcePosition
  ): SemanticResult<void> {
    // Array sizes must match exactly
    if (target.size !== source.size) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Array size mismatch: cannot assign ${typeToString(source)} to ${typeToString(target)}`,
            location,
            suggestions: [
              'Ensure both arrays have the same size',
              'Use array slicing if partial assignment is intended',
            ],
          },
        ],
      };
    }

    // Element types must be compatible
    return this.checkAssignmentCompatibility(target.elementType, source.elementType, location);
  }

  /**
   * Check callback type compatibility.
   */
  private checkCallbackCompatibility(
    target: any,
    source: any,
    location: SourcePosition
  ): SemanticResult<void> {
    // Return types must be compatible
    const returnCompatibility = this.checkAssignmentCompatibility(
      target.returnType,
      source.returnType,
      location
    );
    if (!returnCompatibility.success) {
      return {
        success: false,
        errors: [
          {
            errorType: 'CallbackMismatch',
            message: `Callback return type mismatch: ${typeToString(source.returnType)} cannot be assigned to ${typeToString(target.returnType)}`,
            location,
            suggestions: [
              'Ensure callback return types match exactly',
              'Use type conversion if different return types are needed',
            ],
          },
        ],
      };
    }

    // Parameter count must match
    if (target.parameterTypes.length !== source.parameterTypes.length) {
      return {
        success: false,
        errors: [
          {
            errorType: 'CallbackMismatch',
            message: `Callback parameter count mismatch: expected ${target.parameterTypes.length}, got ${source.parameterTypes.length}`,
            location,
            suggestions: [
              'Ensure callback parameter counts match exactly',
              'Check callback function signature',
            ],
          },
        ],
      };
    }

    // All parameter types must be compatible (contravariant)
    for (let i = 0; i < target.parameterTypes.length; i++) {
      const paramCompatibility = this.checkAssignmentCompatibility(
        source.parameterTypes[i], // Note: contravariant
        target.parameterTypes[i],
        location
      );

      if (!paramCompatibility.success) {
        return {
          success: false,
          errors: [
            {
              errorType: 'CallbackMismatch',
              message: `Callback parameter ${i + 1} type mismatch: ${typeToString(target.parameterTypes[i])} cannot accept ${typeToString(source.parameterTypes[i])}`,
              location,
              suggestions: [
                'Ensure callback parameter types match exactly',
                'Check parameter order and types in callback signature',
              ],
            },
          ],
        };
      }
    }

    return {
      success: true,
      data: undefined,
    };
  }

  // ============================================================================
  // STORAGE CLASS VALIDATION
  // ============================================================================

  /**
   * Validate storage class usage for variables.
   *
   * Educational Note:
   * - Storage classes determine memory layout in 6502 assembly
   * - 'zp' uses zero page for fastest access
   * - 'const' and 'data' require compile-time initialization
   */
  validateVariableStorageClass(
    storageClass: StorageClass | null,
    varType: Blend65Type,
    hasInitializer: boolean,
    location: SourcePosition
  ): SemanticResult<void> {
    if (!storageClass) {
      // No storage class is valid for local variables
      return {
        success: true,
        data: undefined,
      };
    }

    // Use existing storage class validation
    const basicValidation = validateStorageClassUsage(
      storageClass,
      this.currentScopeType,
      hasInitializer
    );
    if (!basicValidation.success) {
      // Update location information
      const errors = basicValidation.errors.map(error => ({
        ...error,
        location,
      }));
      return {
        success: false,
        errors,
      };
    }

    // Additional type-specific storage class validation
    return this.validateStorageClassForType(storageClass, varType, location);
  }

  /**
   * Validate storage class compatibility with type.
   */
  private validateStorageClassForType(
    storageClass: StorageClass,
    varType: Blend65Type,
    location: SourcePosition
  ): SemanticResult<void> {
    const concreteTypeResult = this.getConcreteType(varType, location);
    if (!concreteTypeResult.success) {
      return concreteTypeResult;
    }

    const concreteType = concreteTypeResult.data;

    // Zero page has size limitations
    if (storageClass === 'zp') {
      const sizeResult = this.getTypeSize(concreteType, location);
      if (!sizeResult.success) {
        return sizeResult;
      }

      if (sizeResult.data > 256) {
        return {
          success: false,
          errors: [
            {
              errorType: 'InvalidStorageClass',
              message: `Type ${typeToString(concreteType)} (${sizeResult.data} bytes) is too large for zero page storage`,
              location,
              suggestions: [
                'Use "ram" storage class for large types',
                'Reduce type size to fit in zero page (256 bytes max)',
              ],
            },
          ],
        };
      }
    }

    // Hardware I/O is accessed via peek/poke functions with imported constants

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Get the size in bytes of a type.
   */
  getTypeSize(type: Blend65Type, location: SourcePosition): SemanticResult<number> {
    if (isPrimitiveType(type)) {
      switch (type.name) {
        case 'byte':
        case 'boolean':
          return { success: true, data: 1 };
        case 'word':
          return { success: true, data: 2 };
        case 'void':
          return { success: true, data: 0 };
        case 'callback':
          return { success: true, data: 2 }; // Function pointer
        default:
          return {
            success: false,
            errors: [
              {
                errorType: 'InvalidOperation',
                message: `Unknown primitive type: ${(type as any).name}`,
                location,
              },
            ],
          };
      }
    }

    if (isArrayType(type)) {
      const elementSizeResult = this.getTypeSize(type.elementType, location);
      if (!elementSizeResult.success) {
        return elementSizeResult;
      }
      return {
        success: true,
        data: elementSizeResult.data * type.size,
      };
    }

    if (isNamedType(type)) {
      // For named types, we'd need to resolve them first
      // For now, assume they're single-byte types
      return { success: true, data: 1 };
    }

    return {
      success: false,
      errors: [
        {
          errorType: 'InvalidOperation',
          message: `Cannot determine size of type: ${typeToString(type)}`,
          location,
        },
      ],
    };
  }

  // ============================================================================
  // ARRAY TYPE CHECKING
  // ============================================================================

  /**
   * Validate array access with bounds checking where possible.
   *
   * Educational Note:
   * - Compile-time bounds checking prevents 6502 memory corruption
   * - Runtime bounds checking can be added for dynamic indices
   * - Array access validation prevents buffer overflows
   */
  checkArrayAccess(
    arrayType: any,
    indexExpression: Expression,
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    // Validate index is numeric type
    const indexTypeResult = this.checkExpressionType(indexExpression);
    if (!indexTypeResult.success) {
      return indexTypeResult;
    }

    const indexType = indexTypeResult.data;
    if (!isPrimitiveType(indexType) || (indexType.name !== 'byte' && indexType.name !== 'word')) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Array index must be byte or word, got ${typeToString(indexType)}`,
            location,
            suggestions: [
              'Use byte or word type for array indices',
              'Convert index to appropriate numeric type',
            ],
          },
        ],
      };
    }

    // Check compile-time bounds if index is a literal
    if (indexExpression.type === 'Literal' && typeof indexExpression.value === 'number') {
      const indexValue = indexExpression.value;

      if (indexValue < 0 || indexValue >= arrayType.size) {
        return {
          success: false,
          errors: [
            {
              errorType: 'ArrayBounds',
              message: `Array index ${indexValue} out of bounds for array of size ${arrayType.size}`,
              location,
              suggestions: [
                `Use index in range 0 to ${arrayType.size - 1}`,
                'Check array size and index calculation',
              ],
            },
          ],
        };
      }
    }

    return {
      success: true,
      data: arrayType.elementType,
    };
  }

  /**
   * Validate array literal initialization.
   */
  checkArrayLiteralType(
    arrayLiteral: ArrayLiteral,
    expectedType: any,
    location: SourcePosition
  ): SemanticResult<void> {
    // Check element count
    if (arrayLiteral.elements.length !== expectedType.size) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Array literal has ${arrayLiteral.elements.length} elements, expected ${expectedType.size}`,
            location,
            suggestions: [
              `Provide exactly ${expectedType.size} elements`,
              'Check array size declaration',
            ],
          },
        ],
      };
    }

    // Check each element type
    for (let i = 0; i < arrayLiteral.elements.length; i++) {
      const elementResult = this.checkExpressionType(arrayLiteral.elements[i]);
      if (!elementResult.success) {
        return elementResult;
      }

      const compatibilityResult = this.checkAssignmentCompatibility(
        expectedType.elementType,
        elementResult.data,
        location
      );

      if (!compatibilityResult.success) {
        return {
          success: false,
          errors: [
            {
              errorType: 'TypeMismatch',
              message: `Array element ${i} has type ${typeToString(elementResult.data)}, expected ${typeToString(expectedType.elementType)}`,
              location,
              suggestions: [
                'Ensure all array elements have the same type',
                'Use explicit type conversion if needed',
              ],
            },
          ],
        };
      }
    }

    return {
      success: true,
      data: undefined,
    };
  }

  // ============================================================================
  // FUNCTION SIGNATURE TYPE CHECKING
  // ============================================================================

  /**
   * Validate function signature for consistency and correctness.
   *
   * Educational Note:
   * - Function signatures define contracts between callers and callees
   * - Parameter types enable compile-time validation of function calls
   * - Return type validation ensures proper value handling
   */
  validateFunctionSignature(
    functionDecl: FunctionDeclaration,
    location: SourcePosition
  ): SemanticResult<FunctionSignature> {
    // Validate parameter types
    const parameters: ValidatedParameter[] = [];

    for (const param of functionDecl.params) {
      const paramTypeResult = this.convertASTTypeToBlend65Type(param.paramType, location);
      if (!paramTypeResult.success) {
        return paramTypeResult;
      }

      // Validate default value if present
      if (param.defaultValue) {
        const defaultValueTypeResult = this.checkExpressionType(param.defaultValue);
        if (!defaultValueTypeResult.success) {
          return defaultValueTypeResult;
        }

        const compatibilityResult = this.checkAssignmentCompatibility(
          paramTypeResult.data,
          defaultValueTypeResult.data,
          location
        );

        if (!compatibilityResult.success) {
          return {
            success: false,
            errors: [
              {
                errorType: 'TypeMismatch',
                message: `Default value for parameter '${param.name}' has type ${typeToString(defaultValueTypeResult.data)}, expected ${typeToString(paramTypeResult.data)}`,
                location,
                suggestions: [
                  'Ensure default value matches parameter type',
                  'Use explicit type conversion if needed',
                ],
              },
            ],
          };
        }
      }

      parameters.push({
        name: param.name,
        type: paramTypeResult.data,
        hasDefaultValue: param.defaultValue !== null,
      });
    }

    // Validate return type
    const returnTypeResult = this.convertASTTypeToBlend65Type(functionDecl.returnType, location);
    if (!returnTypeResult.success) {
      return returnTypeResult;
    }

    // Additional validation for callback functions
    if (functionDecl.callback) {
      // Callback functions have additional restrictions
      const callbackValidation = this.validateCallbackFunction(
        parameters,
        returnTypeResult.data,
        location
      );
      if (!callbackValidation.success) {
        return callbackValidation;
      }
    }

    return {
      success: true,
      data: {
        parameters,
        returnType: returnTypeResult.data,
        isCallback: functionDecl.callback,
      },
    };
  }

  /**
   * Validate callback function specific requirements.
   */
  private validateCallbackFunction(
    parameters: ValidatedParameter[],
    returnType: Blend65Type,
    location: SourcePosition
  ): SemanticResult<void> {
    // Callback functions should have minimal parameter complexity for 6502
    for (const param of parameters) {
      if (isArrayType(param.type)) {
        const arraySize = (param.type as any).size;
        if (arraySize > 256) {
          return {
            success: false,
            errors: [
              {
                errorType: 'CallbackMismatch',
                message: `Callback parameter '${param.name}' has large array type (${arraySize} elements) which may not be suitable for interrupt handlers`,
                location,
                suggestions: [
                  'Use smaller array types in callback functions',
                  'Consider passing array references instead of values',
                  'Use byte or word parameters for interrupt handlers',
                ],
              },
            ],
          };
        }
      }
    }

    // Callback functions should avoid complex return types
    if (isArrayType(returnType)) {
      return {
        success: false,
        errors: [
          {
            errorType: 'CallbackMismatch',
            message: `Callback functions cannot return array types (got ${typeToString(returnType)})`,
            location,
            suggestions: [
              'Use void, byte, or word return types for callbacks',
              'Return array references instead of array values',
              'Consider using global variables for complex return data',
            ],
          },
        ],
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Check function call compatibility with function signature.
   */
  checkFunctionCall(
    signature: FunctionSignature,
    argumentTypes: Blend65Type[],
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    // Check argument count
    const requiredParams = signature.parameters.filter(p => !p.hasDefaultValue).length;
    const totalParams = signature.parameters.length;

    if (argumentTypes.length < requiredParams || argumentTypes.length > totalParams) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Function call has ${argumentTypes.length} arguments, expected ${requiredParams}${requiredParams !== totalParams ? ` to ${totalParams}` : ''}`,
            location,
            suggestions: [
              `Provide ${requiredParams}${requiredParams !== totalParams ? ` to ${totalParams}` : ''} arguments`,
              'Check function signature for required parameters',
            ],
          },
        ],
      };
    }

    // Check each argument type compatibility
    for (let i = 0; i < argumentTypes.length; i++) {
      const expectedType = signature.parameters[i].type;
      const actualType = argumentTypes[i];

      const compatibilityResult = this.checkAssignmentCompatibility(
        expectedType,
        actualType,
        location
      );
      if (!compatibilityResult.success) {
        return {
          success: false,
          errors: [
            {
              errorType: 'TypeMismatch',
              message: `Argument ${i + 1} has type ${typeToString(actualType)}, expected ${typeToString(expectedType)}`,
              location,
              suggestions: [
                'Ensure argument types match parameter types',
                'Use explicit type conversion if needed',
                'Check function signature and call arguments',
              ],
            },
          ],
        };
      }
    }

    return {
      success: true,
      data: signature.returnType,
    };
  }

  // ============================================================================
  // EXPRESSION TYPE INFERENCE
  // ============================================================================

  /**
   * Infer the type of an expression.
   *
   * Educational Note:
   * - Type inference determines expression types from context
   * - Enables type checking without explicit type annotations
   * - Essential for validating complex expressions
   */
  checkExpressionType(expression: Expression): SemanticResult<Blend65Type> {
    switch (expression.type) {
      case 'Identifier':
        return this.checkIdentifierType(
          expression.name,
          expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
        );

      case 'Literal':
        return this.inferLiteralType(expression.value);

      case 'BinaryExpr':
        return this.checkBinaryExpressionType(expression);

      case 'UnaryExpr':
        return this.checkUnaryExpressionType(expression);

      case 'CallExpr':
        return this.checkCallExpressionType(expression);

      case 'MemberExpr':
        return this.checkMemberExpressionType(expression);

      case 'IndexExpr':
        return this.checkIndexExpressionType(expression);

      case 'ArrayLiteral':
        return this.checkArrayLiteralExpressionType(expression);

      default:
        return {
          success: false,
          errors: [
            {
              errorType: 'InvalidOperation',
              message: `Unsupported expression type: ${expression.type}`,
              location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
            },
          ],
        };
    }
  }

  /**
   * Check identifier type by looking up in symbol table.
   */
  private checkIdentifierType(name: string, location: SourcePosition): SemanticResult<Blend65Type> {
    const symbol = this.symbolLookup(name);
    if (!symbol) {
      return {
        success: false,
        errors: [
          {
            errorType: 'UndefinedSymbol',
            message: `Variable '${name}' is not defined`,
            location,
            suggestions: [
              `Define variable '${name}' before using it`,
              'Check spelling and case of variable name',
              "Import the variable if it's from another module",
            ],
          },
        ],
      };
    }

    if (symbol.symbolType === 'Variable') {
      const varSymbol = symbol as VariableSymbol;
      return {
        success: true,
        data: varSymbol.varType,
      };
    }

    if (symbol.symbolType === 'Function') {
      // Functions can be used as callback types
      const funcSymbol = symbol as FunctionSymbol;
      return {
        success: true,
        data: createCallbackType(
          funcSymbol.parameters.map(p => p.type),
          funcSymbol.returnType
        ),
      };
    }

    return {
      success: false,
      errors: [
        {
          errorType: 'TypeMismatch',
          message: `'${name}' is not a variable or function`,
          location,
          suggestions: [
            'Use a variable or function name',
            'Check if you meant to reference a different symbol',
          ],
        },
      ],
    };
  }

  /**
   * Infer literal type from value.
   */
  private inferLiteralType(value: string | number | boolean): SemanticResult<Blend65Type> {
    if (typeof value === 'boolean') {
      return {
        success: true,
        data: createPrimitiveType('boolean'),
      };
    }

    if (typeof value === 'number') {
      // Determine byte vs word based on value range
      if (value >= 0 && value <= 255 && value === Math.floor(value)) {
        return {
          success: true,
          data: createPrimitiveType('byte'),
        };
      } else if (value >= 0 && value <= 65535 && value === Math.floor(value)) {
        return {
          success: true,
          data: createPrimitiveType('word'),
        };
      } else {
        return {
          success: false,
          errors: [
            {
              errorType: 'TypeMismatch',
              message: `Number literal ${value} is out of range for 6502 types (0-65535)`,
              location: { line: 0, column: 0, offset: 0 },
              suggestions: [
                'Use values in range 0-255 for byte type',
                'Use values in range 0-65535 for word type',
              ],
            },
          ],
        };
      }
    }

    // String literals not supported in basic Blend65
    return {
      success: false,
      errors: [
        {
          errorType: 'TypeMismatch',
          message: `String literals are not supported in Blend65 v0.1`,
          location: { line: 0, column: 0, offset: 0 },
          suggestions: [
            'Use byte arrays for string-like data',
            'Consider using character codes for simple text',
          ],
        },
      ],
    };
  }

  /**
   * Check binary expression type.
   */
  private checkBinaryExpressionType(expression: any): SemanticResult<Blend65Type> {
    // Check left and right operand types
    const leftResult = this.checkExpressionType(expression.left);
    if (!leftResult.success) {
      return leftResult;
    }

    const rightResult = this.checkExpressionType(expression.right);
    if (!rightResult.success) {
      return rightResult;
    }

    const leftType = leftResult.data;
    const rightType = rightResult.data;

    // Operator-specific type checking
    switch (expression.operator) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
        return this.checkArithmeticOperation(
          leftType,
          rightType,
          expression.operator,
          expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
        );

      case '==':
      case '!=':
      case '<':
      case '<=':
      case '>':
      case '>=':
        return this.checkComparisonOperation(
          leftType,
          rightType,
          expression.operator,
          expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
        );

      case 'and':
      case 'or':
        return this.checkLogicalOperation(
          leftType,
          rightType,
          expression.operator,
          expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
        );

      default:
        return {
          success: false,
          errors: [
            {
              errorType: 'InvalidOperation',
              message: `Unsupported binary operator: ${expression.operator}`,
              location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
            },
          ],
        };
    }
  }

  /**
   * Check arithmetic operation type compatibility.
   */
  private checkArithmeticOperation(
    leftType: Blend65Type,
    rightType: Blend65Type,
    _operator: string,
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    // Both operands must be numeric
    if (!isPrimitiveType(leftType) || (leftType.name !== 'byte' && leftType.name !== 'word')) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Left operand of '${_operator}' must be byte or word, got ${typeToString(leftType)}`,
            location,
          },
        ],
      };
    }

    if (!isPrimitiveType(rightType) || (rightType.name !== 'byte' && rightType.name !== 'word')) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Right operand of '${_operator}' must be byte or word, got ${typeToString(rightType)}`,
            location,
          },
        ],
      };
    }

    // Result type is the larger of the two types
    if (leftType.name === 'word' || rightType.name === 'word') {
      return {
        success: true,
        data: createPrimitiveType('word'),
      };
    } else {
      return {
        success: true,
        data: createPrimitiveType('byte'),
      };
    }
  }

  /**
   * Check comparison operation type compatibility.
   */
  private checkComparisonOperation(
    leftType: Blend65Type,
    rightType: Blend65Type,
    _operator: string,
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    // Types must be compatible for comparison
    const compatibilityResult = this.checkAssignmentCompatibility(leftType, rightType, location);
    if (!compatibilityResult.success) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Cannot compare ${typeToString(leftType)} and ${typeToString(rightType)}`,
            location,
            suggestions: [
              'Ensure both operands have compatible types',
              'Use explicit type conversion if needed',
            ],
          },
        ],
      };
    }

    // Comparison always returns boolean
    return {
      success: true,
      data: createPrimitiveType('boolean'),
    };
  }

  /**
   * Check logical operation type compatibility.
   */
  private checkLogicalOperation(
    leftType: Blend65Type,
    rightType: Blend65Type,
    _operator: string,
    location: SourcePosition
  ): SemanticResult<Blend65Type> {
    // Both operands must be boolean
    if (!isPrimitiveType(leftType) || leftType.name !== 'boolean') {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Left operand of '${_operator}' must be boolean, got ${typeToString(leftType)}`,
            location,
          },
        ],
      };
    }

    if (!isPrimitiveType(rightType) || rightType.name !== 'boolean') {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Right operand of '${_operator}' must be boolean, got ${typeToString(rightType)}`,
            location,
          },
        ],
      };
    }

    // Result is boolean
    return {
      success: true,
      data: createPrimitiveType('boolean'),
    };
  }

  /**
   * Check unary expression type.
   */
  private checkUnaryExpressionType(expression: any): SemanticResult<Blend65Type> {
    const operandResult = this.checkExpressionType(expression.operand);
    if (!operandResult.success) {
      return operandResult;
    }

    const operandType = operandResult.data;
    const location = expression.metadata?.start ?? { line: 0, column: 0, offset: 0 };

    switch (expression.operator) {
      case '-':
      case '+':
        // Numeric unary operators
        if (
          !isPrimitiveType(operandType) ||
          (operandType.name !== 'byte' && operandType.name !== 'word')
        ) {
          return {
            success: false,
            errors: [
              {
                errorType: 'TypeMismatch',
                message: `Unary '${expression.operator}' requires numeric operand, got ${typeToString(operandType)}`,
                location,
              },
            ],
          };
        }
        return { success: true, data: operandType };

      case 'not':
        // Logical NOT requires boolean
        if (!isPrimitiveType(operandType) || operandType.name !== 'boolean') {
          return {
            success: false,
            errors: [
              {
                errorType: 'TypeMismatch',
                message: `Unary 'not' requires boolean operand, got ${typeToString(operandType)}`,
                location,
              },
            ],
          };
        }
        return { success: true, data: createPrimitiveType('boolean') };

      default:
        return {
          success: false,
          errors: [
            {
              errorType: 'InvalidOperation',
              message: `Unsupported unary operator: ${expression.operator}`,
              location,
            },
          ],
        };
    }
  }

  /**
   * Check call expression type.
   */
  private checkCallExpressionType(expression: any): SemanticResult<Blend65Type> {
    // Get function type
    const calleeResult = this.checkExpressionType(expression.callee);
    if (!calleeResult.success) {
      return calleeResult;
    }

    const calleeType = calleeResult.data;

    // Must be a callback type or function symbol
    if (!isCallbackType(calleeType)) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Cannot call expression of type ${typeToString(calleeType)}`,
            location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
          },
        ],
      };
    }

    // Check argument types
    const argumentTypes: Blend65Type[] = [];
    for (const arg of expression.args) {
      const argResult = this.checkExpressionType(arg);
      if (!argResult.success) {
        return argResult;
      }
      argumentTypes.push(argResult.data);
    }

    // Create function signature from callback type
    const signature: FunctionSignature = {
      parameters: (calleeType as any).parameterTypes.map((type: Blend65Type, index: number) => ({
        name: `param${index}`,
        type,
        hasDefaultValue: false,
      })),
      returnType: (calleeType as any).returnType,
      isCallback: true,
    };

    return this.checkFunctionCall(
      signature,
      argumentTypes,
      expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
    );
  }

  /**
   * Check member expression type (simplified).
   */
  private checkMemberExpressionType(expression: any): SemanticResult<Blend65Type> {
    // For now, member expressions are not fully supported
    return {
      success: false,
      errors: [
        {
          errorType: 'InvalidOperation',
          message: 'Member expressions are not yet implemented',
          location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
        },
      ],
    };
  }

  /**
   * Check index expression type.
   */
  private checkIndexExpressionType(expression: any): SemanticResult<Blend65Type> {
    const objectResult = this.checkExpressionType(expression.object);
    if (!objectResult.success) {
      return objectResult;
    }

    const objectType = objectResult.data;
    if (!isArrayType(objectType)) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: `Cannot index into non-array type ${typeToString(objectType)}`,
            location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
          },
        ],
      };
    }

    return this.checkArrayAccess(
      objectType,
      expression.index,
      expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
    );
  }

  /**
   * Check array literal expression type.
   */
  private checkArrayLiteralExpressionType(expression: ArrayLiteral): SemanticResult<Blend65Type> {
    if (expression.elements.length === 0) {
      return {
        success: false,
        errors: [
          {
            errorType: 'TypeMismatch',
            message: 'Empty array literals are not allowed',
            location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
          },
        ],
      };
    }

    // Infer element type from first element
    const firstElementResult = this.checkExpressionType(expression.elements[0]);
    if (!firstElementResult.success) {
      return firstElementResult;
    }

    const elementType = firstElementResult.data;

    // Check all elements have the same type
    for (let i = 1; i < expression.elements.length; i++) {
      const elementResult = this.checkExpressionType(expression.elements[i]);
      if (!elementResult.success) {
        return elementResult;
      }

      const compatibilityResult = this.checkAssignmentCompatibility(
        elementType,
        elementResult.data,
        expression.metadata?.start ?? { line: 0, column: 0, offset: 0 }
      );

      if (!compatibilityResult.success) {
        return {
          success: false,
          errors: [
            {
              errorType: 'TypeMismatch',
              message: `Array element ${i} has type ${typeToString(elementResult.data)}, expected ${typeToString(elementType)}`,
              location: expression.metadata?.start ?? { line: 0, column: 0, offset: 0 },
            },
          ],
        };
      }
    }

    // Return array type
    return {
      success: true,
      data: createArrayType(elementType, expression.elements.length),
    };
  }
}
