/**
 * Symbol Table - Symbol Types
 *
 * Defines types and enums for symbols in the symbol table.
 * Symbols represent declared identifiers (variables, functions, parameters, etc.)
 */

import type { ASTNode, SourceLocation } from '../ast/base.js';
import type { Scope } from './scope.js';
import type { TypeInfo } from './types.js';

/**
 * Symbol kinds
 */
export enum SymbolKind {
  /** Variable declaration (let, const) */
  Variable = 'Variable',

  /** Function declaration */
  Function = 'Function',

  /** Function parameter */
  Parameter = 'Parameter',

  /** Memory-mapped variable (@map) */
  MapVariable = 'MapVariable',

  /** Imported symbol */
  ImportedSymbol = 'ImportedSymbol',

  /** Type alias (future feature) */
  Type = 'Type',

  /** Enum declaration (future feature) */
  Enum = 'Enum',

  /** Enum member (future feature) */
  EnumMember = 'EnumMember',
}

/**
 * Storage classes for variables
 */
export enum StorageClass {
  /** Zero page storage (@zp) - fast access, limited space */
  ZeroPage = 'zp',

  /** Regular RAM storage (@ram) - default */
  RAM = 'ram',

  /** Data segment (@data) - ROM-able, cannot modify at runtime */
  Data = 'data',

  /** Memory-mapped (@map) - hardware registers */
  Map = 'map',
}

/**
 * Symbol metadata (extensible for future analysis passes)
 */
export interface SymbolMetadata {
  /** Import source for imported symbols */
  importSource?: string;

  /** Original imported name (if aliased) */
  importedName?: string;

  /** Is this symbol used? (dead code analysis) */
  isUsed?: boolean;

  /** Is this symbol modified? (const validation) */
  isModified?: boolean;

  /** Custom metadata for analysis passes */
  [key: string]: unknown;
}

/**
 * Represents a symbol in the symbol table
 *
 * Symbols are created during Pass 1 (Symbol Table Builder) and
 * annotated with type information during Pass 2 (Type Resolution).
 */
export interface Symbol {
  /** Symbol name (identifier) */
  name: string;

  /** Symbol kind (variable, function, parameter, etc.) */
  kind: SymbolKind;

  /** AST node that declared this symbol */
  declaration: ASTNode;

  /** Type information (resolved in Phase 2: Type Resolution) */
  type?: TypeInfo;

  /** Storage class for variables (zp, ram, data, map) */
  storageClass?: StorageClass;

  /** Is this symbol exported from the module? */
  isExported: boolean;

  /** Is this symbol a constant? (const keyword) */
  isConst: boolean;

  /** Scope where this symbol is declared */
  scope: Scope;

  /** Source location of declaration */
  location: SourceLocation;

  /** Additional metadata for analysis passes */
  metadata?: SymbolMetadata;
}
