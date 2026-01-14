/**
 * Import Resolver
 *
 * Validates and resolves import declarations across all modules.
 * Ensures that all imported modules exist and prepares import metadata
 * for later symbol validation (cross-module type checking).
 *
 * **Phase 6.1.4** - Import validation infrastructure
 *
 * **Responsibilities:**
 * - Validate that all imported modules exist in the module registry
 * - Fail-fast error reporting for missing modules
 * - Build list of resolved imports for later symbol validation
 * - Track import locations for precise error messages
 *
 * **Usage:**
 * ```typescript
 * const registry = new ModuleRegistry();
 * // ... register modules ...
 *
 * const resolver = new ImportResolver(registry);
 *
 * // Validate imports (fail-fast on missing modules)
 * const errors = resolver.validateAllImports(programs);
 * if (errors.length > 0) {
 *   // Handle errors - compilation cannot proceed
 * }
 *
 * // Resolve imports for later cross-module validation
 * const resolved = resolver.resolveImports(programs);
 * // Use resolved imports to validate exported symbols exist
 * ```
 */

import type { Program, ImportDecl } from '../ast/nodes.js';
import type { ModuleRegistry } from './module-registry.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { SourceLocation } from '../ast/base.js';

/**
 * Resolved import metadata
 *
 * Represents a validated import that can be used for cross-module
 * symbol validation (checking that imported identifiers actually exist).
 */
export interface ResolvedImport {
  /** Module that contains the import declaration */
  fromModule: string;

  /** Module being imported from */
  toModule: string;

  /** Identifiers being imported (empty array for wildcard imports) */
  importedIdentifiers: string[];

  /** Original import declaration AST node */
  importDecl: ImportDecl;
}

/**
 * Import resolver validates and resolves imports
 *
 * **Two-Phase Validation:**
 *
 * 1. **Module Existence** (this class - Phase 6.1.4):
 *    - Check that every imported module exists in the registry
 *    - Fail-fast if any modules are missing
 *
 * 2. **Symbol Existence** (later - Phase 6.2.3):
 *    - Check that imported identifiers are actually exported
 *    - Validate types match across module boundaries
 *    - (Not implemented in this task)
 *
 * **Error Handling Strategy:**
 * - Missing modules → immediate error (fail-fast)
 * - Location tracking for precise error messages
 * - Clear error messages indicating which module is missing and where it was imported
 */
export class ImportResolver {
  /**
   * Creates an ImportResolver
   *
   * @param registry - Module registry containing all available modules
   */
  constructor(private readonly registry: ModuleRegistry) {}

  /**
   * Validate all imports across all modules
   *
   * Checks that every module referenced in import declarations
   * actually exists in the module registry.
   *
   * **Fail-Fast Behavior:**
   * If any modules are missing, returns errors immediately.
   * Compilation cannot proceed until all modules are available.
   *
   * @param programs - Array of all parsed programs
   * @returns Array of diagnostics (errors for missing modules)
   *
   * @example
   * ```typescript
   * const errors = resolver.validateAllImports(programs);
   * if (errors.length > 0) {
   *   // Missing module(s) - cannot compile
   *   console.error('Import validation failed:', errors);
   *   return;
   * }
   * ```
   */
  public validateAllImports(programs: Program[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      const moduleErrors = this.validateModuleImports(program, moduleName);
      diagnostics.push(...moduleErrors);
    }

    return diagnostics;
  }

  /**
   * Validate imports for a single module
   *
   * Extracts all import declarations and verifies each target module exists.
   *
   * @param program - Program AST to validate
   * @param moduleName - Name of the module being validated (for error messages)
   * @returns Array of diagnostics for this module
   */
  protected validateModuleImports(program: Program, moduleName: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Extract all import declarations from the program
    const imports = program
      .getDeclarations()
      .filter((d): d is ImportDecl => d.constructor.name === 'ImportDecl');

    for (const importDecl of imports) {
      const targetModule = importDecl.getModuleName();

      // Check if target module exists in registry
      if (!this.registry.hasModule(targetModule)) {
        diagnostics.push(
          this.createError(
            DiagnosticCode.MODULE_NOT_FOUND,
            `Module '${targetModule}' not found (imported by module '${moduleName}')`,
            importDecl.getLocation()
          )
        );
      }
    }

    return diagnostics;
  }

  /**
   * Resolve all imports for later symbol validation
   *
   * Builds a list of all import relationships that can be used
   * for cross-module symbol validation.
   *
   * **Only includes valid imports:**
   * - Skips imports to non-existent modules
   * - Only returns imports where target module exists
   *
   * **Use this after validateAllImports():**
   * 1. Call validateAllImports() - fail if errors
   * 2. Call resolveImports() - get valid imports for symbol checking
   * 3. Use resolved imports for cross-module validation
   *
   * @param programs - Array of all parsed programs
   * @returns Array of resolved imports
   *
   * @example
   * ```typescript
   * // After validation passes
   * const resolved = resolver.resolveImports(programs);
   *
   * // Later: validate that imported symbols are actually exported
   * for (const imp of resolved) {
   *   const targetModule = registry.getModule(imp.toModule);
   *   for (const identifier of imp.importedIdentifiers) {
   *     // Check that identifier is exported by targetModule
   *   }
   * }
   * ```
   */
  public resolveImports(programs: Program[]): ResolvedImport[] {
    const resolved: ResolvedImport[] = [];

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();

      // Extract all import declarations
      const imports = program
        .getDeclarations()
        .filter((d): d is ImportDecl => d.constructor.name === 'ImportDecl');

      for (const importDecl of imports) {
        const targetModule = importDecl.getModuleName();

        // Only include imports to modules that exist
        // (Validation should have caught missing modules already)
        if (this.registry.hasModule(targetModule)) {
          resolved.push({
            fromModule: moduleName,
            toModule: targetModule,
            importedIdentifiers: importDecl.getIdentifiers(),
            importDecl,
          });
        }
      }
    }

    return resolved;
  }

  /**
   * Create an error diagnostic
   *
   * Helper method to create properly formatted error diagnostics.
   *
   * @param code - Diagnostic code
   * @param message - Error message
   * @param location - Source location of the error
   * @returns Complete diagnostic object
   */
  protected createError(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation
  ): Diagnostic {
    return {
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    };
  }
}
