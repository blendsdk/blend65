/**
 * Module Parser for Blend65 Compiler
 *
 * Extends DeclarationParser to provide module system parsing capabilities:
 * - Module declarations (explicit and implicit)
 * - Import declarations (future)
 * - Export declarations (future)
 * - Module scope validation
 *
 * Current module support includes basic module declarations.
 * Future phases will add complete import/export system.
 */

import { Declaration, DiagnosticCode, ImportDecl, ModuleDecl, VariableDecl } from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import { DeclarationParser } from './declarations.js';

/**
 * Module parser class - extends DeclarationParser with module system parsing
 *
 * Handles module system parsing including module declarations and provides
 * foundation for future import/export functionality.
 *
 * Current module support (Phase 0):
 * - Module declarations: module Game.Main
 * - Implicit global module when no module declared
 * - Module scope validation
 *
 * Future module support (Phase 5):
 * - Import declarations: import { Function } from "module"
 * - Export declarations: export function name() ... end function
 * - Module resolution and dependencies
 */
export abstract class ModuleParser extends DeclarationParser {
  // ============================================
  // EXPORT CONTEXT TRACKING
  // ============================================

  /**
   * Tracks whether we're currently parsing within an export declaration
   * Used to pass export context from parseExportDecl() to underlying parsers
   */
  protected isInExportContext: boolean = false;

  /**
   * Set export context for nested parsing
   */
  protected setExportContext(inExport: boolean): void {
    this.isInExportContext = inExport;
  }

  /**
   * Get current export context
   */
  protected getExportContext(): boolean {
    return this.isInExportContext;
  }

  /**
   * Override parseExportModifier to handle export context
   *
   * When parsing within an export declaration context, return true.
   * Otherwise, use the default behavior of checking for and consuming export token.
   */
  protected parseExportModifier(): boolean {
    if (this.isInExportContext) {
      // Already in export context, return true
      return true;
    }
    // Default behavior: check for export token
    return this.match(TokenType.EXPORT);
  }
  // ============================================
  // MODULE DECLARATION PARSING
  // ============================================

  /**
   * Parses a module declaration
   *
   * Grammar: module Identifier [ . Identifier ]*
   *
   * Examples:
   * - module Game
   * - module Game.Main
   * - module Graphics.Sprites.Player
   *
   * @returns ModuleDecl AST node
   */
  protected parseModuleDecl(): ModuleDecl {
    this.validateModuleDeclaration(); // Check for duplicate

    const startToken = this.expect(TokenType.MODULE, "Expected 'module' keyword");

    // Parse module name path (e.g., Game.Main)
    const namePath: string[] = [];
    namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected module name').value);

    while (this.match(TokenType.DOT)) {
      namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after dot').value);
    }

    // Module declarations are self-terminating (no semicolon needed)
    const location = this.createLocation(startToken, this.getCurrentToken());

    return new ModuleDecl(namePath, location, false);
  }

  /**
   * Creates implicit "module global" when no module declared
   *
   * When a file doesn't start with an explicit module declaration,
   * we create an implicit global module to represent the file's scope.
   *
   * @returns ModuleDecl for implicit global module
   */
  protected createImplicitGlobalModuleDecl(): ModuleDecl {
    const location = this.createLocation(this.tokens[0], this.tokens[0]);
    return new ModuleDecl(['global'], location, true);
  }

  // ============================================
  // IMPORT DECLARATION PARSING (PHASE 5.1)
  // ============================================

  /**
   * Parses an import declaration
   *
   * Grammar (per specification): import identifier [, identifier]* from module.path
   *
   * Examples:
   * - import clearScreen from c64.graphics
   * - import clearScreen, setPixel from c64.graphics.screen
   * - import initSID, playNote, stopSound from c64.audio
   *
   * @returns ImportDecl AST node
   */
  protected parseImportDecl(): Declaration {
    const startToken = this.expect(TokenType.IMPORT, "Expected 'import'");

    // Parse identifier list (NO braces per specification)
    const identifiers: string[] = [];

    // Parse first identifier
    identifiers.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier to import').value);

    // Parse additional identifiers if present (comma-separated)
    while (this.match(TokenType.COMMA)) {
      identifiers.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after comma').value);
    }

    // Expect 'from' keyword
    this.expect(TokenType.FROM, "Expected 'from' after import list");

    // Parse module path (dot-separated identifiers like c64.graphics.screen)
    const modulePath: string[] = [];
    modulePath.push(this.expect(TokenType.IDENTIFIER, 'Expected module name').value);

    while (this.match(TokenType.DOT)) {
      modulePath.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after dot').value);
    }

    // Import statements are terminated by semicolon or newline (auto-inserted)
    this.expectSemicolon('Expected semicolon after import declaration');

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new ImportDecl(identifiers, modulePath, location, false); // Not wildcard
  }

  // ============================================
  // EXPORT DECLARATION PARSING (PHASE 5.2)
  // ============================================

  /**
   * Parses an export declaration using the original export flag design
   *
   * Grammar (per specification): export (function_decl | variable_decl | type_decl | enum_decl)
   *
   * Examples:
   * - export function clearScreen(): void  → Returns FunctionDecl with isExported=true
   * - export const MAX_SPRITES: byte = 8;  → Returns VariableDecl with isExported=true
   * - export @zp let frameCounter: byte = 0; → Returns VariableDecl with isExported=true
   *
   * Note: This method sets the export flag on declarations rather than wrapping them.
   * This preserves backward compatibility with existing tests and follows the established
   * AST design where export status is a property of declarations.
   *
   * @returns Declaration with export flag set to true
   */
  protected parseExportDecl(): Declaration {
    // Consume 'export' token but don't create wrapper - use export flags instead
    this.expect(TokenType.EXPORT, "Expected 'export'");

    // Set export context for nested parsing
    this.setExportContext(true);

    try {
      // Parse the actual declaration with export context
      if (this.check(TokenType.FUNCTION) || this.check(TokenType.CALLBACK)) {
        // Export function declaration: call parseFunctionDecl which handles export context
        if (typeof (this as any).parseFunctionDecl === 'function') {
          return (this as any).parseFunctionDecl();
        } else {
          // Fallback for testing - function parsing not available at this level
          this.reportError(
            DiagnosticCode.EXPORT_REQUIRES_DECLARATION,
            'Function declaration parsing not available at this parser level'
          );
          this.synchronize();
          return this.createDummyDeclaration();
        }
      } else if (this.isStorageClass() || this.isLetOrConst()) {
        // Export variable declaration: parseVariableDecl will handle export context
        return this.parseVariableDecl();
      } else if (this.check(TokenType.TYPE)) {
        // Export type declaration: call parseTypeDecl which handles export context
        if (typeof (this as any).parseTypeDecl === 'function') {
          return (this as any).parseTypeDecl();
        } else {
          // Fallback for testing - type parsing not available at this level
          this.reportError(
            DiagnosticCode.EXPORT_REQUIRES_DECLARATION,
            'Type declaration parsing not available at this parser level'
          );
          this.synchronize();
          return this.createDummyDeclaration();
        }
      } else if (this.check(TokenType.ENUM)) {
        // Export enum declaration: call parseEnumDecl which handles export context
        if (typeof (this as any).parseEnumDecl === 'function') {
          return (this as any).parseEnumDecl();
        } else {
          // Fallback for testing - enum parsing not available at this level
          this.reportError(
            DiagnosticCode.EXPORT_REQUIRES_DECLARATION,
            'Enum declaration parsing not available at this parser level'
          );
          this.synchronize();
          return this.createDummyDeclaration();
        }
      } else {
        // Unknown token after export
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Expected function, variable, type, or enum declaration after 'export', got '${this.getCurrentToken().value}'`
        );
        this.synchronize();
        return this.createDummyDeclaration();
      }
    } finally {
      // Always reset export context
      this.setExportContext(false);
    }
  }

  /**
   * Creates a dummy declaration for error recovery
   * Used when export parsing encounters errors but needs to return a valid Declaration
   */
  protected createDummyDeclaration(): Declaration {
    return new VariableDecl('error', null, null, this.currentLocation(), null, false, false);
  }

  // ============================================
  // FUTURE MODULE RESOLUTION (PHASE 7+)
  // ============================================

  // Module Resolution (Future):
  // protected resolveModulePath(path: string): string
  // protected validateModuleDependencies(): void
}
