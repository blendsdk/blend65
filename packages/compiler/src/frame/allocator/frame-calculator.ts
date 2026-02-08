/**
 * Frame Calculator for Static Frame Allocation
 *
 * Calculates frame sizes for each function by analyzing:
 * - Parameters (from function declaration)
 * - Local variables (from function body)
 * - Return value slot (if non-void)
 *
 * The calculator walks the function AST to collect all variables
 * and creates FrameSlots with appropriate sizing and ZP directives.
 *
 * @module frame/allocator/frame-calculator
 */

import { FunctionDecl } from '../../ast/declarations.js';
import { Statement } from '../../ast/base.js';
import { isVariableDecl, isIfStatement, isWhileStatement, isForStatement, isDoWhileStatement, isSwitchStatement, isBlockStatement } from '../../ast/type-guards.js';
import { VariableDecl } from '../../ast/declarations.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { TypeInfo, TypeKind, BUILTIN_TYPES } from '../../semantic/types.js';
import { TokenType } from '../../lexer/types.js';
import { FrameSlot, createFrameSlot, createReturnSlot, getTypeSize } from '../types.js';
import { SlotKind, ZpDirective } from '../enums.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a for loop iterator variable.
 *
 * Since for loop iterators are not VariableDecl nodes,
 * we use this interface to represent them for frame allocation.
 */
export interface ForLoopIterator {
  /** Name of the iterator variable */
  name: string;

  /** Explicit type annotation (null = use inferred type) */
  explicitType: string | null;

  /** Type inferred by semantic analyzer ('byte' or 'word') */
  inferredType: 'byte' | 'word';
}

/**
 * Result of frame calculation for a single function.
 *
 * Contains all the slots in the function's frame and their
 * aggregate size before allocation.
 */
export interface Frame {
  /** Name of the function this frame belongs to */
  functionName: string;

  /** All slots in this frame (parameters, locals, return) */
  slots: FrameSlot[];

  /** Total size of all slots in bytes */
  totalSize: number;

  /** Whether the function is exported */
  isExported: boolean;

  /** Whether the function is a callback */
  isCallback: boolean;

  /** Base address assigned by allocator (0 until allocation) */
  baseAddress: number;

  /** Coalesce group ID (set during coalescing, -1 until then) */
  coalesceGroup: number;
}

/**
 * Creates a new empty frame for a function.
 *
 * @param functionName - Name of the function
 * @param options - Optional overrides
 * @returns A new Frame with default values
 */
export function createFrame(
  functionName: string,
  options?: Partial<Omit<Frame, 'functionName'>>
): Frame {
  return {
    functionName,
    slots: [],
    totalSize: 0,
    isExported: false,
    isCallback: false,
    baseAddress: 0,
    coalesceGroup: -1,
    ...options,
  };
}

// ============================================================================
// Frame Calculator
// ============================================================================

/**
 * Calculates frame sizes from function declarations.
 *
 * The FrameCalculator walks through each function's AST to:
 * 1. Collect parameters and create parameter slots
 * 2. Find all local variable declarations and create local slots
 * 3. Create a return slot if the function returns non-void
 *
 * **Slot Order in Frame:**
 * 1. Parameters (in declaration order)
 * 2. Local variables (in declaration order as found)
 * 3. Return slot (if non-void)
 *
 * **ZP Directive Detection:**
 * - @zp storage class → ZpDirective.Zp (must be in zero page)
 * - @ram storage class → ZpDirective.Ram (must NOT be in zero page)
 * - No storage class → ZpDirective.None (compiler decides)
 *
 * @example
 * ```typescript
 * const calculator = new FrameCalculator(symbolTable);
 *
 * // Calculate frame for a function
 * const frame = calculator.calculateFrame(functionDecl);
 *
 * console.log(`Frame for ${frame.functionName}: ${frame.totalSize} bytes`);
 * for (const slot of frame.slots) {
 *   console.log(`  ${slot.name}: ${slot.size} bytes (${slot.kind})`);
 * }
 * ```
 */
export class FrameCalculator {
  /** Symbol table for type lookups */
  protected readonly symbolTable: SymbolTable;

  /**
   * Creates a new FrameCalculator.
   *
   * @param symbolTable - Symbol table for type resolution
   */
  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }

  /**
   * Calculates the frame for a function.
   *
   * Analyzes the function declaration to create a Frame containing
   * all parameters, local variables, and return slot with their
   * sizes and ZP directives.
   *
   * @param func - Function declaration to analyze
   * @returns Frame containing all slots and total size
   *
   * @example
   * ```typescript
   * // For: function add(x: byte, y: byte): byte { let sum: byte = x + y; return sum; }
   * const frame = calculator.calculateFrame(addFunc);
   * // frame.slots = [
   * //   { name: 'x', kind: Parameter, size: 1 },
   * //   { name: 'y', kind: Parameter, size: 1 },
   * //   { name: 'sum', kind: Local, size: 1 },
   * //   { name: '__return', kind: Return, size: 1 },
   * // ]
   * // frame.totalSize = 4
   * ```
   */
  public calculateFrame(func: FunctionDecl): Frame {
    const frame = createFrame(func.getName(), {
      isExported: func.isExportedFunction(),
      isCallback: func.isCallbackFunction(),
    });

    let offset = 0;

    // 1. Add parameter slots
    for (const param of func.getParameters()) {
      const typeInfo = this.resolveType(param.typeAnnotation);
      const size = getTypeSize(typeInfo);
      const slot = createFrameSlot(param.name, SlotKind.Parameter, typeInfo, {
        offset,
        zpDirective: ZpDirective.None, // Parameters don't have storage class annotations
      });
      frame.slots.push(slot);
      offset += size;
    }

    // 2. Add local variable slots from function body
    const body = func.getBody();
    if (body) {
      // Reset for loop iterators collection before collecting locals
      this.forLoopIterators = [];

      const locals = this.collectLocals(body);
      for (const local of locals) {
        const typeInfo = this.resolveTypeFromAnnotation(local.getTypeAnnotation());
        const size = getTypeSize(typeInfo);
        const zpDirective = this.getZpDirective(local.getStorageClass());
        const slot = createFrameSlot(local.getName(), SlotKind.Local, typeInfo, {
          offset,
          zpDirective,
        });
        frame.slots.push(slot);
        offset += size;
      }

      // 2b. Add for loop iterator slots (collected during collectLocals)
      for (const iterator of this.forLoopIterators) {
        // Determine type: explicit type takes precedence over inferred type
        const typeName = iterator.explicitType ?? iterator.inferredType;
        const typeInfo = this.resolveType(typeName);
        const size = getTypeSize(typeInfo);
        const slot = createFrameSlot(iterator.name, SlotKind.Local, typeInfo, {
          offset,
          zpDirective: ZpDirective.None, // For loop iterators don't have storage class
        });
        frame.slots.push(slot);
        offset += size;
      }
    }

    // 3. Add return slot if non-void
    const returnType = func.getReturnType();
    if (returnType && returnType !== 'void') {
      const returnTypeInfo = this.resolveType(returnType);
      if (returnTypeInfo.kind !== TypeKind.Void) {
        const returnSlot = createReturnSlot(returnTypeInfo, { offset });
        frame.slots.push(returnSlot);
        offset += getTypeSize(returnTypeInfo);
      }
    }

    frame.totalSize = offset;
    return frame;
  }

  /**
   * Calculates frames for multiple functions.
   *
   * Convenience method to calculate frames for all functions
   * in a list.
   *
   * @param functions - Array of function declarations
   * @returns Map from function name to Frame
   */
  public calculateFrames(functions: FunctionDecl[]): Map<string, Frame> {
    const frames = new Map<string, Frame>();
    for (const func of functions) {
      // Skip stub functions (no body = no frame needed)
      if (!func.isStubFunction()) {
        frames.set(func.getName(), this.calculateFrame(func));
      }
    }
    return frames;
  }

  /**
   * Represents a for loop iterator variable.
   *
   * Since for loop iterators are not VariableDecl nodes,
   * we use this interface to represent them for frame allocation.
   */
  protected forLoopIterators: ForLoopIterator[] = [];

  /**
   * Collects all local variable declarations from statements.
   *
   * Recursively walks through all statements including nested
   * blocks (if, while, for, etc.) to find all local variables.
   * Also collects for loop iterator variables into this.forLoopIterators.
   *
   * Note: this.forLoopIterators should be reset before calling this method
   * at the top level (done in calculateFrame).
   *
   * @param statements - Statements to search
   * @returns Array of VariableDecl nodes for local variables
   */
  protected collectLocals(statements: Statement[]): VariableDecl[] {
    const locals: VariableDecl[] = [];

    for (const stmt of statements) {
      this.collectLocalsFromStatement(stmt, locals);
    }

    return locals;
  }

  /**
   * Collects local variables from a single statement.
   *
   * Handles nested control structures to find all locals.
   *
   * @param stmt - Statement to analyze
   * @param locals - Array to add found variables to
   */
  protected collectLocalsFromStatement(stmt: Statement, locals: VariableDecl[]): void {
    // Variable declaration at this level
    if (isVariableDecl(stmt)) {
      locals.push(stmt);
      return;
    }

    // If statement - check then and else branches
    if (isIfStatement(stmt)) {
      this.collectLocals(stmt.getThenBranch()).forEach((l) => locals.push(l));
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        this.collectLocals(elseBranch).forEach((l) => locals.push(l));
      }
      return;
    }

    // While statement - check body
    if (isWhileStatement(stmt)) {
      this.collectLocals(stmt.getBody()).forEach((l) => locals.push(l));
      return;
    }

    // Do-while statement - check body
    if (isDoWhileStatement(stmt)) {
      this.collectLocals(stmt.getBody()).forEach((l) => locals.push(l));
      return;
    }

    // For statement - collect iterator variable and check body
    if (isForStatement(stmt)) {
      // Collect the for loop iterator variable
      this.forLoopIterators.push({
        name: stmt.getVariable(),
        explicitType: stmt.getVariableType(),
        inferredType: stmt.getInferredCounterType(),
      });
      // Also collect any locals from the body
      this.collectLocals(stmt.getBody()).forEach((l) => locals.push(l));
      return;
    }

    // Switch statement - check all cases
    if (isSwitchStatement(stmt)) {
      for (const caseClause of stmt.getCases()) {
        this.collectLocals(caseClause.body).forEach((l) => locals.push(l));
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        this.collectLocals(defaultCase).forEach((l) => locals.push(l));
      }
      return;
    }

    // Block statement - check statements
    if (isBlockStatement(stmt)) {
      this.collectLocals(stmt.getStatements()).forEach((l) => locals.push(l));
      return;
    }
  }

  /**
   * Resolves a type name to TypeInfo.
   *
   * @param typeName - Type name string (e.g., "byte", "word")
   * @returns Resolved TypeInfo
   */
  protected resolveType(typeName: string): TypeInfo {
    return this.resolveTypeFromAnnotation(typeName);
  }

  /**
   * Resolves a type annotation to TypeInfo.
   *
   * Handles built-in types and array types.
   *
   * @param annotation - Type annotation string or null
   * @returns Resolved TypeInfo (UNKNOWN if null)
   */
  protected resolveTypeFromAnnotation(annotation: string | null): TypeInfo {
    if (!annotation) {
      return BUILTIN_TYPES.UNKNOWN;
    }

    // Check for array type: type[size]
    const arrayMatch = annotation.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const elementTypeName = arrayMatch[1];
      const size = parseInt(arrayMatch[2], 10);
      const elementType = this.getBuiltinType(elementTypeName);
      return {
        kind: TypeKind.Array,
        name: annotation,
        size: getTypeSize(elementType) * size,
        elementType,
        elementCount: size,
      };
    }

    // Built-in type
    return this.getBuiltinType(annotation);
  }

  /**
   * Gets a built-in type by name.
   *
   * @param name - Type name (byte, word, bool, etc.)
   * @returns TypeInfo for the built-in type
   */
  protected getBuiltinType(name: string): TypeInfo {
    switch (name.toLowerCase()) {
      case 'byte':
        return BUILTIN_TYPES.BYTE;
      case 'word':
        return BUILTIN_TYPES.WORD;
      case 'bool':
        return BUILTIN_TYPES.BOOL;
      case 'void':
        return BUILTIN_TYPES.VOID;
      case 'string':
        return BUILTIN_TYPES.STRING;
      default:
        // Unknown type - treat as byte (will be caught by type checker)
        return BUILTIN_TYPES.UNKNOWN;
    }
  }

  /**
   * Converts storage class token to ZpDirective.
   *
   * @param storageClass - Storage class token from variable declaration
   * @returns Corresponding ZpDirective
   */
  protected getZpDirective(storageClass: TokenType | null): ZpDirective {
    if (!storageClass) {
      return ZpDirective.None;
    }

    switch (storageClass) {
      case TokenType.ZP:
        return ZpDirective.Zp;
      case TokenType.RAM:
        return ZpDirective.Ram;
      default:
        return ZpDirective.None;
    }
  }

  /**
   * Gets the total frame size in bytes.
   *
   * Convenience method to calculate size without creating slots.
   *
   * @param func - Function declaration
   * @returns Total frame size in bytes
   */
  public getFrameSize(func: FunctionDecl): number {
    return this.calculateFrame(func).totalSize;
  }
}