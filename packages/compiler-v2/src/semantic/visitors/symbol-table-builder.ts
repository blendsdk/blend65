/**
 * Symbol Table Builder for Blend65 Compiler v2
 *
 * Pass 1 of semantic analysis: walks the AST and builds the symbol table
 * by registering all declarations (variables, functions, parameters, imports).
 *
 * This pass:
 * - Creates scopes for modules, functions, and blocks
 * - Registers all declarations as symbols
 * - Handles export modifiers
 * - Detects duplicate declarations
 * - Does NOT resolve types (that's Pass 2)
 *
 * @module semantic/visitors/symbol-table-builder
 */

import { ASTWalker } from '../../ast/walker/index.js';
import type {
  Program,
  ModuleDecl,
  ImportDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  EnumDecl,
  TypeDecl,
  ForStatement,
  WhileStatement,
  DoWhileStatement,
  IfStatement,
  BlockStatement,
} from '../../ast/index.js';
import { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type { SourceLocation } from '../../ast/index.js';

/**
 * Result of symbol table building
 */
export interface SymbolTableBuildResult {
  /** The constructed symbol table */
  symbolTable: SymbolTable;

  /** Diagnostics collected during building */
  diagnostics: Diagnostic[];

  /** Whether building succeeded without errors */
  success: boolean;
}

/**
 * Diagnostic codes for symbol table building
 *
 * Uses existing DiagnosticCode enum values where applicable,
 * or custom E-series codes for new errors.
 */
export const SymbolTableDiagnosticCodes = {
  /** Duplicate declaration in same scope */
  DUPLICATE_DECLARATION: DiagnosticCode.DUPLICATE_DECLARATION,

  /** Duplicate parameter name */
  DUPLICATE_PARAMETER: DiagnosticCode.DUPLICATE_DECLARATION,

  /** Duplicate import name */
  DUPLICATE_IMPORT: DiagnosticCode.DUPLICATE_DECLARATION,

  /** Duplicate enum member */
  DUPLICATE_ENUM_MEMBER: DiagnosticCode.DUPLICATE_DECLARATION,

  /** Invalid export (not at module level) */
  INVALID_EXPORT: DiagnosticCode.EXPORT_REQUIRES_DECLARATION,
} as const;

/**
 * Symbol Table Builder - Pass 1 of semantic analysis
 *
 * Walks the AST and constructs the symbol table by:
 * 1. Creating scopes for modules, functions, and blocks
 * 2. Registering all declarations as symbols
 * 3. Handling export/import modifiers
 * 4. Detecting duplicate declarations
 *
 * Usage:
 * ```typescript
 * const builder = new SymbolTableBuilder();
 * const result = builder.build(programAST);
 *
 * if (result.success) {
 *   // Use result.symbolTable for subsequent passes
 * } else {
 *   // Handle result.diagnostics
 * }
 * ```
 *
 * @example
 * ```typescript
 * // For this Blend65 code:
 * // module Game
 * // export function main(): void { let x: byte = 0; }
 *
 * const builder = new SymbolTableBuilder();
 * const result = builder.build(program);
 *
 * // result.symbolTable contains:
 * // - Module scope "Game" with:
 * //   - Function symbol "main" (exported)
 * //     - Function scope with:
 * //       - Variable symbol "x"
 * ```
 */
export class SymbolTableBuilder extends ASTWalker {
  /** The symbol table being built */
  protected symbolTable: SymbolTable;

  /** Collected diagnostics */
  protected diagnostics: Diagnostic[];

  /** Track if we're processing an export declaration */
  protected isExporting: boolean = false;

  /** Track the current module name for error messages */
  protected currentModuleName: string = 'main';

  /**
   * Creates a new SymbolTableBuilder
   */
  constructor() {
    super();
    // These will be initialized in build()
    this.symbolTable = null!;
    this.diagnostics = [];
  }

  /**
   * Builds the symbol table for a program
   *
   * Main entry point for Pass 1 of semantic analysis.
   *
   * @param program - The Program AST node
   * @returns The build result with symbol table and diagnostics
   */
  public build(program: Program): SymbolTableBuildResult {
    // Initialize fresh state
    this.diagnostics = [];
    this.isExporting = false;

    // Create symbol table with the program as the module node
    this.symbolTable = new SymbolTable(program, this.getModuleName(program));
    this.currentModuleName = this.symbolTable.getModuleName();

    // Walk the AST
    this.walk(program);

    return {
      symbolTable: this.symbolTable,
      diagnostics: this.diagnostics,
      success: !this.hasErrors(),
    };
  }

  /**
   * Gets the symbol table (for testing)
   */
  public getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Gets collected diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Checks if any errors were reported
   */
  public hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === 'error');
  }

  // ============================================
  // VISITOR METHODS
  // ============================================

  /**
   * Visit Program node - entry point for the AST
   *
   * The base class ASTWalker.visitProgram already:
   * 1. Visits the module declaration
   * 2. Visits all top-level declarations
   *
   * We override to ensure module name is captured.
   */
  override visitProgram(node: Program): void {
    // Extract module name before walking
    this.currentModuleName = this.getModuleName(node);

    // Let base class handle traversal
    super.visitProgram(node);
  }

  /**
   * Visit Module declaration
   *
   * The module scope is already created in the SymbolTable constructor.
   * This visitor just ensures we track the module name.
   */
  override visitModule(node: ModuleDecl): void {
    // Module name is already captured from Program
    super.visitModule(node);
  }

  /**
   * Visit Import declaration
   *
   * Creates imported symbols for each identifier in the import.
   */
  override visitImportDecl(node: ImportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const sourceModule = node.getModuleName();

    if (node.isWildcardImport()) {
      // Wildcard imports are resolved later in cross-module analysis
      // For now, just record the import declaration
      // The actual symbols will be added during import resolution
    } else {
      // Named imports: import foo, bar from module
      for (const identifier of node.getIdentifiers()) {
        const result = this.symbolTable.declareImport(identifier, identifier, sourceModule, node.getLocation());

        if (!result.success) {
          this.addError(
            SymbolTableDiagnosticCodes.DUPLICATE_IMPORT,
            result.error ?? `Import '${identifier}' is already declared`,
            node.getLocation(),
            result.existingSymbol
              ? `Previously declared at line ${result.existingSymbol.location.start.line}`
              : undefined,
          );
        }
      }
    }

    this.exitNode(node);
  }

  /**
   * Visit Export declaration
   *
   * Sets the export flag and delegates to the wrapped declaration.
   */
  override visitExportDecl(node: ExportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Check we're at module level
    if (this.symbolTable.getCurrentScope() !== this.symbolTable.getRootScope()) {
      this.addError(
        SymbolTableDiagnosticCodes.INVALID_EXPORT,
        'Exports are only allowed at module level',
        node.getLocation(),
      );
      // Still process the declaration
    }

    // Set export flag before visiting the wrapped declaration
    this.isExporting = true;

    // Visit the wrapped declaration
    if (!this.shouldSkip && !this.shouldStop) {
      node.getDeclaration().accept(this);
    }

    // Reset export flag
    this.isExporting = false;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Function declaration
   *
   * 1. Declares the function symbol in the current scope
   * 2. Creates a function scope
   * 3. Declares parameters in the function scope
   * 4. Visits the function body
   */
  override visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const isExported = this.isExporting || node.isExportedFunction();

    // Declare the function in the current scope
    const result = this.symbolTable.declareFunction(
      name,
      node.getLocation(),
      null, // Type resolved in Pass 2
      node,
      isExported,
    );

    if (!result.success) {
      this.addError(
        SymbolTableDiagnosticCodes.DUPLICATE_DECLARATION,
        result.error ?? `Function '${name}' is already declared`,
        node.getLocation(),
        result.existingSymbol
          ? `Previously declared at line ${result.existingSymbol.location.start.line}`
          : undefined,
      );
      // Continue to process body for better error recovery
    }

    const funcSymbol = result.symbol;

    // Enter function scope (even if declaration failed, for error recovery)
    if (funcSymbol) {
      this.symbolTable.enterFunctionScope(funcSymbol, node);
    }

    // Declare parameters
    const parameterSymbols = [];
    for (const param of node.getParameters()) {
      const paramResult = this.symbolTable.declareParameter(
        param.name,
        param.location,
        null, // Type resolved in Pass 2
      );

      if (!paramResult.success) {
        this.addError(
          SymbolTableDiagnosticCodes.DUPLICATE_PARAMETER,
          paramResult.error ?? `Parameter '${param.name}' is already declared`,
          param.location,
        );
      } else if (paramResult.symbol) {
        parameterSymbols.push(paramResult.symbol);
      }
    }

    // Attach parameters to function symbol
    if (funcSymbol) {
      funcSymbol.parameters = parameterSymbols;
    }

    // Visit function body (if not a stub)
    if (!this.shouldSkip && !this.shouldStop) {
      const body = node.getBody();
      if (body) {
        for (const stmt of body) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    // Exit function scope
    if (funcSymbol) {
      this.symbolTable.exitScope();
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Variable declaration
   *
   * Declares the variable in the current scope.
   */
  override visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const isExported = this.isExporting || node.isExportedVariable();
    const isConst = node.isConst();

    // Declare the variable or constant
    let result;

    if (isConst) {
      // declareConstant(name, location, type, initializer, isExported)
      result = this.symbolTable.declareConstant(
        name,
        node.getLocation(),
        null, // Type resolved in Pass 2
        node.getInitializer() ?? undefined,
        isExported,
      );
    } else {
      // declareVariable(name, location, type, options)
      result = this.symbolTable.declareVariable(
        name,
        node.getLocation(),
        null, // Type resolved in Pass 2
        {
          isConst: false,
          isExported,
          initializer: node.getInitializer() ?? undefined,
        },
      );
    }

    if (!result.success) {
      this.addError(
        SymbolTableDiagnosticCodes.DUPLICATE_DECLARATION,
        result.error ?? `Variable '${name}' is already declared`,
        node.getLocation(),
        result.existingSymbol
          ? `Previously declared at line ${result.existingSymbol.location.start.line}`
          : undefined,
      );
    }

    // Visit initializer if present (for nested declarations in expressions)
    if (!this.shouldSkip && !this.shouldStop) {
      const init = node.getInitializer();
      if (init) {
        init.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Enum declaration
   *
   * Declares the enum and all its members.
   */
  override visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const isExported = this.isExporting || node.isExportedEnum();

    // Declare the enum type itself as a constant
    // (Enums are types but we don't have TypeDecl symbol kind, so we use Constant)
    const result = this.symbolTable.declareConstant(
      name,
      node.getLocation(),
      null, // Type resolved in Pass 2
      undefined,
      isExported,
    );

    if (!result.success) {
      this.addError(
        SymbolTableDiagnosticCodes.DUPLICATE_DECLARATION,
        result.error ?? `Enum '${name}' is already declared`,
        node.getLocation(),
        result.existingSymbol
          ? `Previously declared at line ${result.existingSymbol.location.start.line}`
          : undefined,
      );
    }

    // Declare enum members
    // Enum members are accessible as EnumName.MemberName, but we also
    // add them to the current scope for convenience (like TypeScript)
    const seenMembers = new Set<string>();

    for (const member of node.getMembers()) {
      // Check for duplicate members within the enum
      if (seenMembers.has(member.name)) {
        this.addError(
          SymbolTableDiagnosticCodes.DUPLICATE_ENUM_MEMBER,
          `Enum member '${member.name}' is already declared in enum '${name}'`,
          member.location,
        );
        continue;
      }
      seenMembers.add(member.name);

      const memberResult = this.symbolTable.declareEnumMember(
        member.name,
        member.location,
        null, // Type resolved in Pass 2
      );

      if (!memberResult.success) {
        this.addError(
          SymbolTableDiagnosticCodes.DUPLICATE_DECLARATION,
          memberResult.error ?? `Enum member '${member.name}' conflicts with existing declaration`,
          member.location,
          memberResult.existingSymbol
            ? `Previously declared at line ${memberResult.existingSymbol.location.start.line}`
            : undefined,
        );
      }
    }

    this.exitNode(node);
  }

  /**
   * Visit Type declaration
   *
   * Type aliases create a new name for an existing type.
   */
  override visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const isExported = this.isExporting || node.isExportedType();

    // Type aliases are stored as constants (they're compile-time only)
    const result = this.symbolTable.declareConstant(
      name,
      node.getLocation(),
      null, // Type resolved in Pass 2
      undefined,
      isExported,
    );

    if (!result.success) {
      this.addError(
        SymbolTableDiagnosticCodes.DUPLICATE_DECLARATION,
        result.error ?? `Type '${name}' is already declared`,
        node.getLocation(),
        result.existingSymbol
          ? `Previously declared at line ${result.existingSymbol.location.start.line}`
          : undefined,
      );
    }

    this.exitNode(node);
  }

  // ============================================
  // SCOPE-CREATING STATEMENTS
  // ============================================

  /**
   * Visit For statement
   *
   * For loops create a loop scope for the loop variable and body.
   */
  override visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Create loop scope for the for loop
    this.symbolTable.enterLoopScope(node);

    // The loop variable is declared implicitly by the parser
    // Visit start and end expressions
    if (!this.shouldSkip && !this.shouldStop) {
      node.getStart().accept(this);
      if (!this.shouldStop) {
        node.getEnd().accept(this);
      }

      // Visit body
      if (!this.shouldStop) {
        for (const stmt of node.getBody()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    // Exit loop scope
    this.symbolTable.exitScope();

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit While statement
   *
   * While loops create a loop scope for the body.
   */
  override visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Create loop scope
    this.symbolTable.enterLoopScope(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCondition().accept(this);
      if (!this.shouldStop) {
        for (const stmt of node.getBody()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    // Exit loop scope
    this.symbolTable.exitScope();

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Do-While statement
   *
   * Do-while loops create a loop scope for the body.
   */
  override visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Create loop scope
    this.symbolTable.enterLoopScope(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      if (!this.shouldStop) {
        node.getCondition().accept(this);
      }
    }

    // Exit loop scope
    this.symbolTable.exitScope();

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit If statement
   *
   * If statements create block scopes for then and else branches.
   */
  override visitIfStatement(node: IfStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCondition().accept(this);

      // Then branch gets a block scope
      if (!this.shouldStop) {
        this.symbolTable.enterBlockScope(node);
        for (const stmt of node.getThenBranch()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
        this.symbolTable.exitScope();
      }

      // Else branch gets a block scope (if present)
      if (!this.shouldStop) {
        const elseBranch = node.getElseBranch();
        if (elseBranch) {
          this.symbolTable.enterBlockScope(node);
          for (const stmt of elseBranch) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
          this.symbolTable.exitScope();
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Block statement
   *
   * Standalone blocks create a block scope.
   */
  override visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Create block scope
    this.symbolTable.enterBlockScope(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getStatements()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    // Exit block scope
    this.symbolTable.exitScope();

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Gets the module name from a Program node
   */
  protected getModuleName(program: Program): string {
    return program.getModule().getFullName();
  }

  /**
   * Adds an error diagnostic
   *
   * @param code - Diagnostic code
   * @param message - Error message
   * @param location - Source location
   * @param note - Optional note with additional context
   */
  protected addError(code: DiagnosticCode, message: string, location: SourceLocation, note?: string): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
  }

  /**
   * Adds a warning diagnostic
   *
   * @param code - Diagnostic code
   * @param message - Warning message
   * @param location - Source location
   * @param note - Optional note with additional context
   */
  protected addWarning(code: DiagnosticCode, message: string, location: SourceLocation, note?: string): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
  }
}