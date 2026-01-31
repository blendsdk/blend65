/**
 * Symbol definitions for Blend65 Compiler v2
 *
 * Symbols represent declared identifiers in the program including variables,
 * functions, parameters, imports, constants, and enum members.
 *
 * @module semantic/symbol
 */

import type { TypeInfo } from './types.js';
import type { Scope } from './scope.js';
import { ScopeKind } from './scope.js';
import type { SourceLocation, Expression, FunctionDecl } from '../ast/index.js';

/**
 * Symbol kinds in the Blend65 type system
 *
 * Each kind represents a different type of declaration that can exist
 * in the program's symbol table.
 */
export enum SymbolKind {
  /** Variable declaration (let x: byte = 5) */
  Variable = 'variable',

  /** Function parameter (function add(a: byte, b: byte)) */
  Parameter = 'parameter',

  /** Function declaration (function add(...): byte) */
  Function = 'function',

  /** Imported symbol from another module */
  ImportedSymbol = 'imported',

  /** Constant declaration (const MAX = 255) */
  Constant = 'constant',

  /** Enum member (enum Color { Red = 0 }) */
  EnumMember = 'enum_member',

  /** Intrinsic function (peek, poke, hi, lo, etc.) */
  Intrinsic = 'intrinsic',
}

/**
 * Symbol represents a declared identifier in the program
 *
 * A symbol is created for every named entity that can be referenced:
 * - Variables (local and module-level)
 * - Function parameters
 * - Function declarations
 * - Imported symbols
 * - Constants
 * - Enum members
 *
 * Symbols are stored in scopes and can be looked up by name.
 *
 * @example
 * ```typescript
 * // For: let counter: byte = 0;
 * const symbol: Symbol = {
 *   name: 'counter',
 *   kind: SymbolKind.Variable,
 *   type: BUILTIN_TYPES.BYTE,
 *   location: { start: {...}, end: {...} },
 *   scope: moduleScope,
 *   isExported: false,
 *   isConst: false,
 * };
 * ```
 */
export interface Symbol {
  /** Symbol name (identifier) */
  name: string;

  /** Symbol kind (variable, function, parameter, etc.) */
  kind: SymbolKind;

  /**
   * Type information (resolved in Pass 2)
   *
   * null before type resolution, populated after.
   */
  type: TypeInfo | null;

  /** Source location of the declaration */
  location: SourceLocation;

  /**
   * Scope where this symbol is declared
   *
   * Used for scope chain lookups and determining visibility.
   */
  scope: Scope;

  /**
   * Is this symbol exported from the module?
   *
   * Exported symbols are visible to other modules that import them.
   */
  isExported: boolean;

  /**
   * Is this symbol constant?
   *
   * Constant symbols cannot be reassigned after initialization.
   */
  isConst: boolean;

  /**
   * Initial value expression (for variables and constants)
   *
   * Stored for potential constant folding and definite assignment analysis.
   */
  initializer?: Expression;

  /**
   * Parameter symbols (for function symbols)
   *
   * Only populated for SymbolKind.Function.
   */
  parameters?: Symbol[];

  /**
   * Source module (for imported symbols)
   *
   * The module path from which this symbol was imported.
   */
  sourceModule?: string;

  /**
   * Original name in source module (for aliased imports)
   *
   * For `import { foo as bar } from 'module'`, this would be 'foo'.
   */
  originalName?: string;

  /**
   * Function declaration AST node (for function symbols)
   *
   * Used for call graph building and frame analysis.
   */
  declaration?: FunctionDecl;

  /**
   * Usage metadata for analysis passes
   *
   * Stores information collected during analysis such as:
   * - useCount: number of references
   * - isRead: whether the variable is read
   * - isWritten: whether the variable is written
   * - isLoopVariable: whether used as loop counter
   */
  metadata?: Map<string, unknown>;
}

/**
 * Creates a new symbol with default values
 *
 * This factory function ensures all required fields are set with
 * appropriate defaults. Type is set to null (resolved in Pass 2).
 *
 * @param name - The symbol name
 * @param kind - The symbol kind
 * @param location - Source location of the declaration
 * @param scope - The scope where this symbol is declared
 * @param options - Optional additional properties
 * @returns A new Symbol instance
 *
 * @example
 * ```typescript
 * const varSymbol = createSymbol('x', SymbolKind.Variable, location, scope);
 * const constSymbol = createSymbol('MAX', SymbolKind.Constant, location, scope, { isConst: true });
 * ```
 */
export function createSymbol(
  name: string,
  kind: SymbolKind,
  location: SourceLocation,
  scope: Scope,
  options?: Partial<Pick<Symbol, 'isExported' | 'isConst' | 'initializer' | 'sourceModule' | 'originalName' | 'type'>>,
): Symbol {
  return {
    name,
    kind,
    type: options?.type ?? null,
    location,
    scope,
    isExported: options?.isExported ?? false,
    isConst: options?.isConst ?? false,
    initializer: options?.initializer,
    sourceModule: options?.sourceModule,
    originalName: options?.originalName,
    metadata: new Map(),
  };
}

/**
 * Creates a function symbol
 *
 * Helper for creating function symbols with their parameters.
 *
 * @param name - The function name
 * @param location - Source location of the declaration
 * @param scope - The scope where the function is declared
 * @param parameters - Array of parameter symbols
 * @param returnType - The function's return type (null if not yet resolved)
 * @param declaration - The function declaration AST node
 * @param isExported - Whether the function is exported
 * @returns A new function Symbol
 */
export function createFunctionSymbol(
  name: string,
  location: SourceLocation,
  scope: Scope,
  parameters: Symbol[],
  returnType: TypeInfo | null,
  declaration?: FunctionDecl,
  isExported: boolean = false,
): Symbol {
  return {
    name,
    kind: SymbolKind.Function,
    type: returnType,
    location,
    scope,
    isExported,
    isConst: false,
    parameters,
    declaration,
    metadata: new Map(),
  };
}

/**
 * Creates an imported symbol
 *
 * Helper for creating symbols that represent imports from other modules.
 *
 * @param name - The local name (possibly aliased)
 * @param originalName - The name in the source module
 * @param sourceModule - The module path
 * @param location - Source location of the import declaration
 * @param scope - The scope where the import is declared (module scope)
 * @returns A new imported Symbol
 */
export function createImportedSymbol(
  name: string,
  originalName: string,
  sourceModule: string,
  location: SourceLocation,
  scope: Scope,
): Symbol {
  return {
    name,
    kind: SymbolKind.ImportedSymbol,
    type: null, // Resolved during cross-module analysis
    location,
    scope,
    isExported: false,
    isConst: false, // Imports are immutable but this tracks const declarations
    sourceModule,
    originalName,
    metadata: new Map(),
  };
}

/**
 * Creates an intrinsic function symbol
 *
 * Intrinsics are built-in functions like peek, poke, hi, lo, len.
 *
 * @param name - The intrinsic name
 * @param type - The function type (parameters and return type)
 * @returns A new intrinsic Symbol
 */
export function createIntrinsicSymbol(name: string, type: TypeInfo): Symbol {
  // Create a minimal scope reference for intrinsics
  // They are always in the "global" intrinsic namespace
  const intrinsicScope: Scope = {
    id: '__intrinsics__',
    kind: ScopeKind.Module,
    parent: null,
    children: [],
    symbols: new Map(),
    node: null,
  };

  return {
    name,
    kind: SymbolKind.Intrinsic,
    type,
    location: {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    },
    scope: intrinsicScope,
    isExported: false,
    isConst: true, // Intrinsics cannot be reassigned
    metadata: new Map(),
  };
}

/**
 * Type guard: checks if a symbol is a variable
 */
export function isVariableSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Variable;
}

/**
 * Type guard: checks if a symbol is a parameter
 */
export function isParameterSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Parameter;
}

/**
 * Type guard: checks if a symbol is a function
 */
export function isFunctionSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Function;
}

/**
 * Type guard: checks if a symbol is callable (function or intrinsic)
 */
export function isCallableSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Intrinsic;
}

/**
 * Type guard: checks if a symbol is an import
 */
export function isImportedSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.ImportedSymbol;
}

/**
 * Type guard: checks if a symbol is a constant
 */
export function isConstantSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Constant || symbol.isConst;
}

/**
 * Type guard: checks if a symbol is an intrinsic
 */
export function isIntrinsicSymbol(symbol: Symbol): boolean {
  return symbol.kind === SymbolKind.Intrinsic;
}