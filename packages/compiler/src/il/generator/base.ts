/**
 * IL Generator Base
 *
 * Foundation class for generating IL (Intermediate Language) from the Blend65 AST.
 * This class provides:
 * - Type conversion (AST TypeInfo → IL ILType)
 * - Variable-to-register mapping
 * - Error handling and diagnostics
 * - Context management (current function, current block)
 * - Symbol table integration
 *
 * The generator uses an inheritance chain architecture:
 * ILGeneratorBase → ILModuleGenerator → ... → ILGenerator
 *
 * @module il/generator/base
 */

import type { SourceLocation } from '../../ast/base.js';
import type { Symbol } from '../../semantic/symbol.js';
import type { SymbolTable } from '../../semantic/symbol-table.js';
import type { TypeInfo } from '../../semantic/types.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILType } from '../types.js';
import type { VirtualRegister } from '../values.js';
import type { BasicBlock } from '../basic-block.js';
import type { ILFunction } from '../function.js';
import type { ILModule } from '../module.js';
import type { ILBuilder } from '../builder.js';

import { TypeKind } from '../../semantic/types.js';
import { StorageClass } from '../../semantic/symbol.js';
import {
  IL_VOID,
  IL_BOOL,
  IL_BYTE,
  IL_WORD,
  createArrayType,
  createPointerType,
  createFunctionType,
} from '../types.js';
import { ILStorageClass } from '../function.js';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error severity levels for IL generation.
 */
export enum ILErrorSeverity {
  /** Informational message - does not prevent code generation */
  Info = 'info',

  /** Warning - code will be generated but may have issues */
  Warning = 'warning',

  /** Error - prevents code generation */
  Error = 'error',
}

/**
 * Represents an error or diagnostic during IL generation.
 */
export interface ILGeneratorError {
  /** Error message */
  readonly message: string;

  /** Source location where the error occurred */
  readonly location: SourceLocation;

  /** Error severity */
  readonly severity: ILErrorSeverity;

  /** Optional error code for programmatic handling */
  readonly code?: string;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Generation context tracking the current state.
 *
 * Maintains information about what is being generated:
 * - Current function being generated
 * - Current basic block
 * - Loop context (for break/continue)
 * - Variable mappings
 */
export interface GenerationContext {
  /** Current module being generated */
  readonly module: ILModule;

  /** Current function being generated (null at module level) */
  currentFunction: ILFunction | null;

  /** Current basic block for instruction emission */
  currentBlock: BasicBlock | null;

  /** Loop stack for break/continue (label of loop header, label of loop exit) */
  loopStack: Array<{ continueBlock: BasicBlock; breakBlock: BasicBlock }>;
}

/**
 * Variable mapping entry.
 *
 * Maps a variable (by symbol) to its IL representation.
 */
export interface VariableMapping {
  /** The symbol from the symbol table */
  readonly symbol: Symbol;

  /** Virtual register holding the variable's value (for locals) */
  readonly register?: VirtualRegister;

  /** Whether this is a global variable */
  readonly isGlobal: boolean;

  /** Fixed address for @map variables */
  readonly address?: number;
}

// =============================================================================
// ILGeneratorBase Class
// =============================================================================

/**
 * Base class for IL generation.
 *
 * Provides foundation utilities for all IL generation:
 * - Type conversion from semantic types to IL types
 * - Variable-to-register mapping
 * - Error collection and reporting
 * - Context management
 *
 * Subclasses extend this to add specific generation capabilities:
 * - ILModuleGenerator: Generates entire modules
 * - Expression generators
 * - Statement generators
 * - Declaration generators
 *
 * @example
 * ```typescript
 * // This is a base class - use ILGenerator (the concrete class) instead
 * const generator = new ILGenerator(symbolTable, targetConfig);
 * const module = generator.generate(program);
 * ```
 */
export class ILGeneratorBase {
  /** Symbol table from semantic analysis */
  protected readonly symbolTable: SymbolTable;

  /** Target configuration for architecture-specific decisions */
  protected readonly targetConfig: TargetConfig | null;

  /** IL builder for instruction emission */
  protected builder: ILBuilder | null = null;

  /** Collection of errors and warnings during generation */
  protected readonly errors: ILGeneratorError[] = [];

  /** Variable mappings (symbol name → mapping) */
  protected readonly variableMappings: Map<string, VariableMapping> = new Map();

  /** Current generation context */
  protected context: GenerationContext | null = null;

  /**
   * Creates a new IL generator base.
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param targetConfig - Optional target configuration (null for generic generation)
   */
  constructor(symbolTable: SymbolTable, targetConfig: TargetConfig | null = null) {
    this.symbolTable = symbolTable;
    this.targetConfig = targetConfig;
  }

  // ===========================================================================
  // Type Conversion
  // ===========================================================================

  /**
   * Converts a semantic TypeInfo to an IL ILType.
   *
   * This is the core type conversion method used throughout IL generation.
   * Handles all Blend65 types including primitives, arrays, and callbacks.
   *
   * @param typeInfo - Semantic type information
   * @returns Corresponding IL type
   *
   * @example
   * ```typescript
   * // Convert a byte type
   * const byteType = generator.convertType({ kind: TypeKind.Byte, ... });
   * // Returns IL_BYTE
   *
   * // Convert an array type
   * const arrayType = generator.convertType({
   *   kind: TypeKind.Array,
   *   elementType: { kind: TypeKind.Byte, ... },
   *   arraySize: 10,
   *   ...
   * });
   * // Returns ILArrayType with element IL_BYTE, length 10
   * ```
   */
  public convertType(typeInfo: TypeInfo): ILType {
    switch (typeInfo.kind) {
      case TypeKind.Void:
        return IL_VOID;

      case TypeKind.Boolean:
        return IL_BOOL;

      case TypeKind.Byte:
        return IL_BYTE;

      case TypeKind.Word:
        return IL_WORD;

      case TypeKind.String:
        // Strings are pointers to byte arrays at runtime
        return createPointerType(IL_BYTE);

      case TypeKind.Array:
        if (!typeInfo.elementType) {
          // Fallback for malformed array types
          this.addError('Array type missing element type', this.dummyLocation(), 'E_MALFORMED_TYPE');
          return createArrayType(IL_BYTE, typeInfo.arraySize ?? null);
        }
        return createArrayType(
          this.convertType(typeInfo.elementType),
          typeInfo.arraySize ?? null,
        );

      case TypeKind.Callback:
        if (!typeInfo.signature) {
          // Fallback for malformed callback types
          this.addError('Callback type missing signature', this.dummyLocation(), 'E_MALFORMED_TYPE');
          return createFunctionType([], IL_VOID);
        }
        return createFunctionType(
          typeInfo.signature.parameters.map((p) => this.convertType(p)),
          this.convertType(typeInfo.signature.returnType),
        );

      case TypeKind.Unknown:
      default:
        // Unknown types become void (errors should have been caught in semantic analysis)
        this.addWarning(
          `Unknown type kind '${typeInfo.kind}' converted to void`,
          this.dummyLocation(),
        );
        return IL_VOID;
    }
  }

  /**
   * Converts a type annotation string to an IL type.
   *
   * Used for declarations where we have a type annotation string
   * rather than a resolved TypeInfo.
   *
   * @param annotation - Type annotation string (e.g., "byte", "word", "byte[10]")
   * @returns Corresponding IL type
   */
  public convertTypeAnnotation(annotation: string): ILType {
    // Handle array types: "byte[10]" or "word[]"
    const arrayMatch = annotation.match(/^(\w+)\[(\d*)\]$/);
    if (arrayMatch) {
      const elementType = this.convertTypeAnnotation(arrayMatch[1]);
      const size = arrayMatch[2] ? parseInt(arrayMatch[2], 10) : null;
      return createArrayType(elementType, size);
    }

    // Handle primitive types
    switch (annotation.toLowerCase()) {
      case 'void':
        return IL_VOID;
      case 'bool':
      case 'boolean':
        return IL_BOOL;
      case 'byte':
      case 'u8':
        return IL_BYTE;
      case 'word':
      case 'u16':
        return IL_WORD;
      default:
        // Unknown annotation - treat as byte (error in semantic analysis)
        return IL_BYTE;
    }
  }

  /**
   * Converts a semantic StorageClass to IL StorageClass.
   *
   * @param storageClass - Semantic storage class
   * @returns IL storage class
   */
  public convertStorageClass(storageClass: StorageClass | undefined): ILStorageClass {
    if (!storageClass) {
      return ILStorageClass.Ram; // Default to RAM
    }

    switch (storageClass) {
      case StorageClass.ZeroPage:
        return ILStorageClass.ZeroPage;
      case StorageClass.RAM:
        return ILStorageClass.Ram;
      case StorageClass.Data:
        return ILStorageClass.Data;
      case StorageClass.Map:
        return ILStorageClass.Map;
      default:
        return ILStorageClass.Ram;
    }
  }

  // ===========================================================================
  // Variable Mapping
  // ===========================================================================

  /**
   * Records a variable mapping.
   *
   * Used to track how AST variables map to IL registers or globals.
   *
   * @param symbol - Symbol from the symbol table
   * @param register - Virtual register (for locals)
   * @param isGlobal - Whether this is a global variable
   * @param address - Fixed address for @map variables
   */
  protected recordVariableMapping(
    symbol: Symbol,
    register?: VirtualRegister,
    isGlobal: boolean = false,
    address?: number,
  ): void {
    this.variableMappings.set(symbol.name, {
      symbol,
      register,
      isGlobal,
      address,
    });
  }

  /**
   * Gets the mapping for a variable.
   *
   * @param name - Variable name
   * @returns Variable mapping, or undefined if not found
   */
  protected getVariableMapping(name: string): VariableMapping | undefined {
    return this.variableMappings.get(name);
  }

  /**
   * Clears all variable mappings.
   *
   * Called when entering a new function scope.
   */
  protected clearVariableMappings(): void {
    this.variableMappings.clear();
  }

  /**
   * Clears local (non-global) variable mappings.
   *
   * Preserves global variable mappings while clearing function-local ones.
   */
  protected clearLocalVariableMappings(): void {
    for (const [name, mapping] of this.variableMappings) {
      if (!mapping.isGlobal) {
        this.variableMappings.delete(name);
      }
    }
  }

  // ===========================================================================
  // Context Management
  // ===========================================================================

  /**
   * Gets the current function being generated.
   *
   * @returns Current function, or null if at module level
   */
  protected getCurrentFunction(): ILFunction | null {
    return this.context?.currentFunction ?? null;
  }

  /**
   * Gets the current basic block.
   *
   * @returns Current block, or null if not in a function
   */
  protected getCurrentBlock(): BasicBlock | null {
    return this.context?.currentBlock ?? null;
  }

  /**
   * Sets the current basic block.
   *
   * @param block - Block to set as current
   */
  protected setCurrentBlock(block: BasicBlock): void {
    if (this.context) {
      this.context.currentBlock = block;
    }
  }

  /**
   * Pushes a loop context for break/continue handling.
   *
   * @param continueBlock - Block to jump to for 'continue'
   * @param breakBlock - Block to jump to for 'break'
   */
  protected pushLoopContext(continueBlock: BasicBlock, breakBlock: BasicBlock): void {
    if (this.context) {
      this.context.loopStack.push({ continueBlock, breakBlock });
    }
  }

  /**
   * Pops the current loop context.
   */
  protected popLoopContext(): void {
    if (this.context) {
      this.context.loopStack.pop();
    }
  }

  /**
   * Gets the current loop context.
   *
   * @returns Loop context, or null if not in a loop
   */
  protected getCurrentLoopContext(): { continueBlock: BasicBlock; breakBlock: BasicBlock } | null {
    if (!this.context || this.context.loopStack.length === 0) {
      return null;
    }
    return this.context.loopStack[this.context.loopStack.length - 1];
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  /**
   * Adds an error to the error collection.
   *
   * Errors prevent successful code generation.
   *
   * @param message - Error message
   * @param location - Source location
   * @param code - Optional error code
   */
  protected addError(message: string, location: SourceLocation, code?: string): void {
    this.errors.push({
      message,
      location,
      severity: ILErrorSeverity.Error,
      code,
    });
  }

  /**
   * Adds a warning to the error collection.
   *
   * Warnings don't prevent code generation but indicate potential issues.
   *
   * @param message - Warning message
   * @param location - Source location
   * @param code - Optional warning code
   */
  protected addWarning(message: string, location: SourceLocation, code?: string): void {
    this.errors.push({
      message,
      location,
      severity: ILErrorSeverity.Warning,
      code,
    });
  }

  /**
   * Adds an info message to the error collection.
   *
   * Informational messages for debugging or hints.
   *
   * @param message - Info message
   * @param location - Source location
   * @param code - Optional message code
   */
  protected addInfo(message: string, location: SourceLocation, code?: string): void {
    this.errors.push({
      message,
      location,
      severity: ILErrorSeverity.Info,
      code,
    });
  }

  /**
   * Gets all errors and diagnostics.
   *
   * @returns Array of all errors, warnings, and info messages
   */
  public getErrors(): ILGeneratorError[] {
    return [...this.errors];
  }

  /**
   * Gets only errors (not warnings or info).
   *
   * @returns Array of errors only
   */
  public getErrorsOnly(): ILGeneratorError[] {
    return this.errors.filter((e) => e.severity === ILErrorSeverity.Error);
  }

  /**
   * Checks if there are any errors.
   *
   * @returns true if there are errors (not counting warnings/info)
   */
  public hasErrors(): boolean {
    return this.errors.some((e) => e.severity === ILErrorSeverity.Error);
  }

  /**
   * Clears all errors.
   */
  protected clearErrors(): void {
    this.errors.length = 0;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Creates a dummy source location for internal errors.
   *
   * Used when we need to report an error but don't have a real location.
   *
   * @returns A dummy source location
   */
  protected dummyLocation(): SourceLocation {
    return {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    };
  }

  /**
   * Checks if a type is a numeric type (byte or word).
   *
   * @param type - IL type to check
   * @returns true if numeric
   */
  protected isNumericType(type: ILType): boolean {
    return type.kind === 'byte' || type.kind === 'word';
  }

  /**
   * Gets the larger of two numeric types.
   *
   * Used for type promotion in binary operations.
   *
   * @param a - First type
   * @param b - Second type
   * @returns The larger type (word > byte)
   */
  protected getPromotedType(a: ILType, b: ILType): ILType {
    // Word is larger than byte
    if (a.kind === 'word' || b.kind === 'word') {
      return IL_WORD;
    }
    return IL_BYTE;
  }

  /**
   * Gets the symbol table.
   *
   * @returns Symbol table from semantic analysis
   */
  protected getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Gets the target configuration.
   *
   * @returns Target config, or null if not specified
   */
  protected getTargetConfig(): TargetConfig | null {
    return this.targetConfig;
  }
}