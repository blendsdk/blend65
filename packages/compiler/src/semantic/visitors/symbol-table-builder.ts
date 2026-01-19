/**
 * Symbol Table Builder - Pass 1
 *
 * First semantic analysis pass that collects all declarations
 * and builds the symbol table with proper scope management.
 *
 * This visitor:
 * - Creates symbols for all declarations (variables, functions, @map, imports)
 * - Builds scope hierarchy (module scope + function scopes)
 * - Detects duplicate declarations
 * - Does NOT perform type checking (that's Phase 3)
 * - Does NOT resolve types (that's Phase 2)
 */

import { ContextWalker } from '../../ast/walker/context.js';
import { SymbolTable } from '../symbol-table.js';
import { Symbol, SymbolKind, StorageClass } from '../symbol.js';
import { ScopeKind } from '../scope.js';
import { Diagnostic, DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type { SourceLocation } from '../../ast/base.js';
import type {
  Program,
  VariableDecl,
  FunctionDecl,
  Parameter,
  ImportDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from '../../ast/nodes.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Symbol table builder visitor
 *
 * Traverses the AST once to collect all declarations and build
 * the complete symbol table with proper scoping.
 */
export class SymbolTableBuilder extends ContextWalker {
  /** Symbol table being built */
  protected symbolTable: SymbolTable;

  /** Diagnostics collected during symbol table building */
  protected diagnostics: Diagnostic[];

  /**
   * Creates a new symbol table builder
   */
  constructor() {
    super();
    this.symbolTable = new SymbolTable();
    this.diagnostics = [];
  }

  /**
   * Get the built symbol table
   *
   * @returns Complete symbol table with all symbols and scopes
   */
  public getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Get collected diagnostics
   *
   * @returns Array of diagnostics (errors, warnings)
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Check if any errors were collected
   *
   * @returns True if there are any error-level diagnostics
   */
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.ERROR);
  }

  /**
   * Report a diagnostic
   *
   * @param diagnostic - Diagnostic to add to collection
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  /**
   * Report a duplicate declaration error
   *
   * @param name - Name of the duplicate symbol
   * @param location - Location where duplicate was declared
   */
  protected reportDuplicateDeclaration(name: string, location: SourceLocation): void {
    this.reportDiagnostic({
      code: DiagnosticCode.DUPLICATE_DECLARATION,
      severity: DiagnosticSeverity.ERROR,
      message: `Duplicate declaration of '${name}'`,
      location,
    });
  }

  /**
   * Extract storage class from variable declaration
   *
   * @param node - Variable declaration node
   * @returns Storage class enum value
   */
  protected getStorageClass(node: VariableDecl): StorageClass {
    const storageClassToken = node.getStorageClass();

    if (!storageClassToken) {
      return StorageClass.RAM; // Default storage class
    }

    switch (storageClassToken) {
      case TokenType.ZP:
        return StorageClass.ZeroPage;
      case TokenType.RAM:
        return StorageClass.RAM;
      case TokenType.DATA:
        return StorageClass.Data;
      default:
        return StorageClass.RAM;
    }
  }

  //
  // Program and Module
  //

  /**
   * Visit program node (root of AST)
   *
   * Sets the program node on the root scope and processes all declarations.
   */
  public visitProgram(node: Program): void {
    // Set the program node on root scope
    this.symbolTable.getRootScope().node = node;

    // Process module declaration (just for completeness, doesn't create symbols)
    node.getModule().accept(this);

    // Process all top-level declarations
    for (const decl of node.getDeclarations()) {
      decl.accept(this);
    }
  }

  //
  // Variable Declarations
  //

  /**
   * Visit variable declaration
   *
   * Creates a symbol for the variable in the current scope.
   * Handles: let, const, @zp, @ram, @data, export modifiers.
   */
  public visitVariableDecl(node: VariableDecl): void {
    try {
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.Variable,
        declaration: node,
        isExported: node.isExportedVariable(),
        isConst: node.isConst(),
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
        storageClass: this.getStorageClass(node),
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      // Duplicate declaration error
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Skip initializer expression - Phase 1 doesn't analyze expressions
    // Don't call accept() on initializer to avoid expression traversal
  }

  //
  // Memory-Mapped Declarations (@map)
  //

  /**
   * Visit simple @map declaration
   *
   * Creates a symbol for @map variable: @map var at $D020: byte
   */
  public visitSimpleMapDecl(node: SimpleMapDecl): void {
    try {
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.MapVariable,
        declaration: node,
        isExported: false, // @map variables are module-scope, not exported
        isConst: false, // @map variables can be modified (they're hardware registers)
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
        storageClass: StorageClass.Map,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Visit address expression (may reference other symbols)
    node.getAddress().accept(this);
  }

  /**
   * Visit range @map declaration
   *
   * Creates a symbol for @map range: @map sprites from $D000 to $D02E: byte
   */
  public visitRangeMapDecl(node: RangeMapDecl): void {
    try {
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.MapVariable,
        declaration: node,
        isExported: false,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
        storageClass: StorageClass.Map,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Visit address expressions
    node.getStartAddress().accept(this);
    node.getEndAddress().accept(this);
  }

  /**
   * Visit sequential struct @map declaration
   *
   * Creates a symbol for @map struct with auto-layout
   */
  public visitSequentialStructMapDecl(node: SequentialStructMapDecl): void {
    try {
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.MapVariable,
        declaration: node,
        isExported: false,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
        storageClass: StorageClass.Map,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Visit base address expression
    node.getBaseAddress().accept(this);

    // Note: Fields are NOT separate symbols, they're properties of the struct
    // Field access will be handled during type checking phase
  }

  /**
   * Visit explicit struct @map declaration
   *
   * Creates a symbol for @map struct with explicit layout
   */
  public visitExplicitStructMapDecl(node: ExplicitStructMapDecl): void {
    try {
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.MapVariable,
        declaration: node,
        isExported: false,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
        storageClass: StorageClass.Map,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Visit base address expression
    node.getBaseAddress().accept(this);

    // Visit field address expressions
    for (const field of node.getFields()) {
      if (field.addressSpec.kind === 'single') {
        field.addressSpec.address.accept(this);
      } else {
        field.addressSpec.startAddress.accept(this);
        field.addressSpec.endAddress.accept(this);
      }
    }
  }

  //
  // Function Declarations
  //

  /**
   * Visit function declaration
   *
   * Creates a symbol for the function in current scope,
   * then creates a new function scope and declares parameters.
   */
  public visitFunctionDecl(node: FunctionDecl): void {
    try {
      // Declare function in current (module) scope
      const symbol: Symbol = {
        name: node.getName(),
        kind: SymbolKind.Function,
        declaration: node,
        isExported: node.isExportedFunction(),
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: node.getLocation(),
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(node.getName(), node.getLocation());
    }

    // Create function scope
    const functionScope = this.symbolTable.createScope(
      ScopeKind.Function,
      this.symbolTable.getCurrentScope(),
      node
    );

    // Enter function scope
    this.symbolTable.enterScope(functionScope);

    // Declare parameters in function scope
    for (const param of node.getParameters()) {
      this.visitParameter(param);
    }

    // Visit function body statements (if present - stub functions have no body)
    // TODO(IL-GEN): Stub functions are currently handled passively.
    // Future enhancement: Add metadata to symbol for faster intrinsic detection.
    // See: plans/il-generator-requirements.md - AST Annotation Strategy
    const body = node.getBody();
    if (body) {
      for (const stmt of body) {
        stmt.accept(this);
      }
    }

    // Exit function scope
    this.symbolTable.exitScope();
  }

  /**
   * Visit function parameter
   *
   * Creates a symbol for the parameter in the function scope.
   *
   * @param param - Function parameter
   */
  protected visitParameter(param: Parameter): void {
    try {
      const symbol: Symbol = {
        name: param.name,
        kind: SymbolKind.Parameter,
        declaration: param as any, // Parameter is not an ASTNode but has location
        isExported: false,
        isConst: false,
        scope: this.symbolTable.getCurrentScope(),
        location: param.location,
      };

      this.symbolTable.declare(symbol);
    } catch (error) {
      this.reportDuplicateDeclaration(param.name, param.location);
    }
  }

  //
  // Import/Export Declarations
  //

  /**
   * Visit import declaration
   *
   * Creates symbols for all imported identifiers.
   * Handles: import foo from bar, import foo, bar from baz
   */
  public visitImportDecl(node: ImportDecl): void {
    // Create imported symbols in current scope
    for (const identifier of node.getIdentifiers()) {
      try {
        const symbol: Symbol = {
          name: identifier,
          kind: SymbolKind.ImportedSymbol,
          declaration: node,
          isExported: false,
          isConst: false,
          scope: this.symbolTable.getCurrentScope(),
          location: node.getLocation(),
          metadata: {
            importSource: node.getModuleName(),
            importedName: identifier,
          },
        };

        this.symbolTable.declare(symbol);
      } catch (error) {
        this.reportDuplicateDeclaration(identifier, node.getLocation());
      }
    }
  }

  //
  // Statement & Expression Overrides - Phase 1 Skips Expression Analysis
  //

  /**
   * Override expression visitors to skip expression traversal.
   *
   * Phase 1 (Symbol Table Builder) only collects declarations.
   * We skip expression analysis but still need to traverse statements
   * that might contain variable declarations.
   */

  public visitExpressionStatement(): void {
    // Skip - expression statements don't contain declarations
  }

  public visitReturnStatement(): void {
    // Skip - return statements don't contain declarations
  }

  /**
   * Override control flow to skip conditions but visit bodies for declarations
   */
  public visitIfStatement(node: any): void {
    // Skip condition, visit branches for declarations
    const thenBranch = node.getThenBranch();
    for (const stmt of thenBranch) {
      stmt.accept(this);
    }

    const elseBranch = node.getElseBranch();
    if (elseBranch) {
      for (const stmt of elseBranch) {
        stmt.accept(this);
      }
    }
  }

  public visitWhileStatement(node: any): void {
    // Skip condition, visit body for declarations
    const body = node.getBody();
    for (const stmt of body) {
      stmt.accept(this);
    }
  }

  public visitForStatement(node: any): void {
    // Declare loop variable
    const loopVar = node.getVariable();
    if (loopVar) {
      try {
        const symbol: Symbol = {
          name: loopVar,
          kind: SymbolKind.Variable,
          declaration: node as any,
          isExported: false,
          isConst: false,
          scope: this.symbolTable.getCurrentScope(),
          location: node.getLocation(),
          storageClass: StorageClass.RAM,
        };

        this.symbolTable.declare(symbol);
      } catch (error) {
        this.reportDuplicateDeclaration(loopVar, node.getLocation());
      }
    }

    // Visit body for declarations (skip range expressions)
    const body = node.getBody();
    for (const stmt of body) {
      stmt.accept(this);
    }
  }

  public visitMatchStatement(node: any): void {
    // Skip match expression, visit cases for declarations
    const cases = node.getCases();
    for (const caseNode of cases) {
      const body = caseNode.body;
      for (const stmt of body) {
        stmt.accept(this);
      }
    }

    const defaultCase = node.getDefaultCase();
    if (defaultCase) {
      for (const stmt of defaultCase) {
        stmt.accept(this);
      }
    }
  }

  public visitBinaryExpression(): void {
    // Skip - don't analyze binary expressions in Phase 1
  }

  public visitUnaryExpression(): void {
    // Skip - don't analyze unary expressions in Phase 1
  }

  public visitCallExpression(): void {
    // Skip - don't analyze function calls in Phase 1
  }

  public visitIndexExpression(): void {
    // Skip - don't analyze index expressions in Phase 1
  }

  public visitMemberExpression(): void {
    // Skip - don't analyze member access in Phase 1
  }

  public visitIdentifierExpression(): void {
    // Skip - don't analyze identifiers in Phase 1
  }

  public visitNumericLiteral(): void {
    // Skip - don't analyze literals in Phase 1
  }

  public visitStringLiteral(): void {
    // Skip - don't analyze literals in Phase 1
  }

  public visitBooleanLiteral(): void {
    // Skip - don't analyze literals in Phase 1
  }

  public visitArrayLiteralExpression(): void {
    // Skip - don't analyze array literals in Phase 1
  }

  public visitAssignmentExpression(): void {
    // Skip - don't analyze assignments in Phase 1
  }
}
