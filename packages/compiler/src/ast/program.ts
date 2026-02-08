/**
 * Program Structure AST Node Implementations for Blend65 Compiler v2
 *
 * This module contains the program-level node classes:
 * - Program: Root of the entire AST
 * - ModuleDecl: Module declaration
 * - ImportDecl: Import statements
 * - ExportDecl: Export wrappers
 */

import { ASTNode, ASTNodeType, ASTVisitor, Declaration, SourceLocation } from './base.js';

// ============================================
// PROGRAM ROOT
// ============================================

/**
 * Program node - root of the entire AST
 *
 * Represents a complete Blend65 source file.
 * Contains the module declaration and all top-level declarations.
 */
export class Program extends ASTNode {
  /**
   * Creates a Program node
   * @param module - The module declaration (explicit or implicit)
   * @param declarations - All top-level declarations in the file
   * @param location - Source location
   */
  constructor(
    protected readonly module: ModuleDecl,
    protected readonly declarations: Declaration[],
    location: SourceLocation
  ) {
    super(ASTNodeType.PROGRAM, location);
  }

  public getModule(): ModuleDecl {
    return this.module;
  }

  public getDeclarations(): Declaration[] {
    return this.declarations;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitProgram(this);
  }
}

// ============================================
// MODULE DECLARATION
// ============================================

/**
 * Module declaration node
 *
 * Represents: module Game.Main
 *
 * Can be explicit (declared in source) or implicit ("module global").
 * Module names are dot-separated paths for namespace organization.
 */
export class ModuleDecl extends Declaration {
  /**
   * Creates a Module declaration
   * @param namePath - Module name parts (e.g., ['Game', 'Main'])
   * @param location - Source location
   * @param isImplicit - True if synthesized "module global"
   */
  constructor(
    protected readonly namePath: string[],
    location: SourceLocation,
    protected readonly isImplicit: boolean = false
  ) {
    super(ASTNodeType.MODULE, location);
  }

  public getNamePath(): string[] {
    return this.namePath;
  }

  public getFullName(): string {
    return this.namePath.join('.');
  }

  public isImplicitModule(): boolean {
    return this.isImplicit;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitModule(this);
  }
}

// ============================================
// IMPORT/EXPORT DECLARATIONS
// ============================================

/**
 * Import declaration node
 *
 * Represents:
 * - import foo from bar.baz
 * - import foo, bar from baz
 * - import * from module
 *
 * Imports make symbols from other modules available in the current scope.
 */
export class ImportDecl extends Declaration {
  /**
   * Creates an Import declaration
   * @param identifiers - Names being imported (empty for wildcard)
   * @param modulePath - Module to import from (e.g., ['bar', 'baz'])
   * @param location - Source location
   * @param isWildcard - True for "import * from ..."
   */
  constructor(
    protected readonly identifiers: string[],
    protected readonly modulePath: string[],
    location: SourceLocation,
    protected readonly isWildcard: boolean = false
  ) {
    super(ASTNodeType.IMPORT_DECL, location);
  }

  public getIdentifiers(): string[] {
    return this.identifiers;
  }

  public getModulePath(): string[] {
    return this.modulePath;
  }

  public getModuleName(): string {
    return this.modulePath.join('.');
  }

  public isWildcardImport(): boolean {
    return this.isWildcard;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitImportDecl(this);
  }
}

/**
 * Export declaration node
 *
 * Wraps another declaration to mark it as exported.
 * Exported declarations are visible to other modules.
 *
 * Represents: export function foo() { ... }
 */
export class ExportDecl extends Declaration {
  /**
   * Creates an Export declaration
   * @param declaration - The declaration being exported
   * @param location - Source location
   */
  constructor(
    protected readonly declaration: Declaration,
    location: SourceLocation
  ) {
    super(ASTNodeType.EXPORT_DECL, location);
  }

  public getDeclaration(): Declaration {
    return this.declaration;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitExportDecl(this);
  }
}