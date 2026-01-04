/**
 * Module System Analyzer for Blend65
 * Task 1.6: Implement Module System Analysis
 *
 * Handles cross-file module analysis including import/export resolution,
 * dependency validation, and symbol visibility across modules.
 *
 * Key Responsibilities:
 * - Cross-file import/export resolution
 * - Circular dependency detection
 * - Symbol visibility enforcement across module boundaries
 * - Qualified name resolution (Module.symbolName)
 * - Module dependency graph construction
 */

import { ImportDeclaration, Program, QualifiedName } from '@blend65/ast';
import { SemanticError } from '../types.js';
import { SymbolTable } from '../symbol-table.js';

/**
 * Handles cross-file module analysis including import/export resolution,
 * dependency validation, and symbol visibility across modules.
 */
export class ModuleAnalyzer {
  private symbolTable: SymbolTable;
  private errors: SemanticError[] = [];
  private warnings: SemanticError[] = [];
  private dependencyGraph = new Map<string, Set<string>>(); // module -> dependencies
  private processingStack = new Set<string>(); // for circular dependency detection
  private moduleExports = new Map<string, Set<string>>(); // module -> exported symbols
  private programMap = new Map<string, Program>(); // module name -> program

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }

  /**
   * Analyzes all imports and exports across multiple programs in compilation unit.
   * This is the main entry point called from SemanticAnalyzer.
   */
  analyzeModuleSystem(programs: Program[]): SemanticError[] {
    this.reset();

    // Build program map for quick lookup
    this.buildProgramMap(programs);

    // Phase 1: Build dependency graph and collect exports
    this.buildDependencyGraph(programs);
    this.collectAllExports(programs);

    // Phase 2: Detect circular dependencies
    this.detectCircularDependencies();

    // Phase 3: Resolve imports in dependency order (only if no circular dependencies)
    const hasCircularDependencies = this.errors.some(e => e.errorType === 'CircularDependency');
    if (!hasCircularDependencies) {
      this.resolveImportsInOrder(programs);
    }

    // Phase 4: Validate all exports are accessible
    this.validateExports(programs);

    return [...this.errors, ...this.warnings];
  }

  /**
   * Reset analyzer state for fresh analysis
   */
  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.dependencyGraph.clear();
    this.processingStack.clear();
    this.moduleExports.clear();
    this.programMap.clear();
  }

  /**
   * Build mapping from module names to programs for quick lookup
   */
  private buildProgramMap(programs: Program[]): void {
    for (const program of programs) {
      if (program.module?.name) {
        const moduleName = this.qualifiedNameToString(program.module.name);
        this.programMap.set(moduleName, program);
      }
    }
  }

  /**
   * Builds a dependency graph from all import declarations
   */
  private buildDependencyGraph(programs: Program[]): void {
    for (const program of programs) {
      if (!program.module?.name) continue;

      const moduleName = this.qualifiedNameToString(program.module.name);
      const dependencies = new Set<string>();

      for (const importDecl of program.imports) {
        const importedModuleName = this.qualifiedNameToString(importDecl.source);
        dependencies.add(importedModuleName);
      }

      this.dependencyGraph.set(moduleName, dependencies);
    }
  }

  /**
   * Collect all exported symbols from all modules
   */
  private collectAllExports(programs: Program[]): void {
    for (const program of programs) {
      if (!program.module?.name) continue;

      const moduleName = this.qualifiedNameToString(program.module.name);
      const exports = new Set<string>();

      // Collect explicit export declarations
      for (const exportDecl of program.exports) {
        // ExportDeclaration has a 'declaration' property containing the exported declaration
        const declaration = exportDecl.declaration;
        switch (declaration.type) {
          case 'VariableDeclaration':
            exports.add(declaration.name);
            break;
          case 'FunctionDeclaration':
            exports.add(declaration.name);
            break;
          case 'EnumDeclaration':
            exports.add(declaration.name);
            break;
          case 'TypeDeclaration':
            exports.add(declaration.name);
            break;
        }
      }

      // Also collect exported declarations from program body
      for (const declaration of program.body) {
        // Check if declaration has exported property set to true
        const isExported = (declaration as any).exported === true;
        if (isExported) {
          switch (declaration.type) {
            case 'VariableDeclaration':
              exports.add(declaration.name);
              break;
            case 'FunctionDeclaration':
              exports.add(declaration.name);
              break;
            case 'EnumDeclaration':
              exports.add(declaration.name);
              break;
            case 'TypeDeclaration':
              exports.add(declaration.name);
              break;
          }
        }
      }

      this.moduleExports.set(moduleName, exports);
    }
  }

  /**
   * Detects circular dependencies using DFS
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();

    for (const moduleName of this.dependencyGraph.keys()) {
      if (!visited.has(moduleName)) {
        this.detectCircularDependencyDFS(moduleName, visited, []);
      }
    }
  }

  private detectCircularDependencyDFS(
    moduleName: string,
    visited: Set<string>,
    path: string[]
  ): void {
    if (this.processingStack.has(moduleName)) {
      // Found circular dependency
      const cycleStart = path.indexOf(moduleName);
      const cycle = [...path.slice(cycleStart), moduleName];
      this.errors.push({
        errorType: 'CircularDependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        location: { line: 1, column: 1, offset: 0 },
        suggestions: [
          'Remove circular imports by restructuring module dependencies',
          'Consider moving shared functionality to a separate module',
          'Use forward declarations where possible',
        ],
      });
      return;
    }

    if (visited.has(moduleName)) return;

    visited.add(moduleName);
    this.processingStack.add(moduleName);

    const dependencies = this.dependencyGraph.get(moduleName) || new Set();
    for (const dependency of dependencies) {
      this.detectCircularDependencyDFS(dependency, visited, [...path, moduleName]);
    }

    this.processingStack.delete(moduleName);
  }

  /**
   * Resolves imports in proper dependency order (topological sort)
   */
  private resolveImportsInOrder(programs: Program[]): void {
    const resolved = new Set<string>();

    // Resolve in dependency order
    for (const program of programs) {
      if (program.module?.name) {
        const moduleName = this.qualifiedNameToString(program.module.name);
        if (!resolved.has(moduleName)) {
          this.resolveModuleImports(program, resolved);
        }
      }
    }
  }

  private resolveModuleImports(program: Program, resolved: Set<string>): void {
    const moduleName = this.qualifiedNameToString(program.module!.name);
    if (resolved.has(moduleName)) return;

    // Resolve dependencies first, but avoid infinite recursion on circular dependencies
    const dependencies = this.dependencyGraph.get(moduleName) || new Set();
    for (const dependency of dependencies) {
      const dependencyProgram = this.programMap.get(dependency);
      if (dependencyProgram && !resolved.has(dependency)) {
        // Only recurse if dependency is not already resolved
        // Circular dependencies are detected separately and reported as errors
        this.resolveModuleImports(dependencyProgram, resolved);
      }
    }

    // Now resolve this module's imports
    this.processModuleImports(program);
    resolved.add(moduleName);
  }

  /**
   * Process a single module's import declarations
   */
  private processModuleImports(program: Program): void {
    const moduleName = this.qualifiedNameToString(program.module!.name);

    for (const importDecl of program.imports) {
      this.resolveImportDeclaration(importDecl, moduleName);
    }
  }

  /**
   * Resolve a single import declaration
   */
  private resolveImportDeclaration(importDecl: ImportDeclaration, importingModule: string): void {
    const importedModuleName = this.qualifiedNameToString(importDecl.source);

    // Check if the imported module exists
    if (!this.programMap.has(importedModuleName)) {
      this.errors.push({
        errorType: 'ModuleNotFound',
        message: `Cannot find module '${importedModuleName}'`,
        location: importDecl.metadata?.start || { line: 0, column: 0, offset: 0 },
        suggestions: [
          `Check if module '${importedModuleName}' is included in the compilation`,
          'Verify the module name spelling',
          'Ensure the module file is accessible',
        ],
      });
      return;
    }

    // Get exported symbols from the imported module
    const exportedSymbols = this.moduleExports.get(importedModuleName) || new Set();

    // Validate each import specifier
    for (const specifier of importDecl.specifiers) {
      const importedName = specifier.imported || specifier.local;
      const localName = specifier.local || specifier.imported;

      if (!localName || !importedName) {
        this.errors.push({
          errorType: 'InvalidOperation',
          message: `Invalid import specifier in module '${importingModule}'`,
          location: importDecl.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            'Check import specifier syntax',
            'Ensure imported and local names are properly specified',
          ],
        });
        continue;
      }

      // Check if the symbol is exported by the module
      if (!exportedSymbols.has(importedName)) {
        this.errors.push({
          errorType: 'ImportNotFound',
          message: `Module '${importedModuleName}' does not export '${importedName}'`,
          location: importDecl.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            `Check available exports from module '${importedModuleName}'`,
            `Add 'export' to the '${importedName}' declaration`,
            'Verify the imported symbol name spelling',
          ],
        });
        continue;
      }

      // Add the imported symbol to the current module's scope
      this.addImportedSymbol(importingModule, localName, importedName, importedModuleName);
    }
  }

  /**
   * Add an imported symbol to the importing module's scope
   */
  private addImportedSymbol(
    importingModule: string,
    localName: string,
    importedName: string,
    sourceModule: string
  ): void {
    // Create a symbol representing the imported identifier
    // This is a simplified implementation - in a full compiler,
    // we'd need to resolve the actual symbol type from the source module

    // For now, just validate that we can add it to the symbol table
    try {
      // Enter the importing module's scope
      this.symbolTable.enterScope('Module', importingModule);

      // Check if the local name conflicts with existing symbols
      const existingSymbol = this.symbolTable.lookupSymbol(localName);
      if (existingSymbol) {
        this.errors.push({
          errorType: 'DuplicateIdentifier',
          message: `Identifier '${localName}' conflicts with existing symbol in module '${importingModule}'`,
          location: { line: 0, column: 0, offset: 0 },
          suggestions: [
            `Use a different local name for the import: 'import ${importedName} as ${localName}NewName from ${sourceModule}'`,
            'Remove the conflicting local declaration',
            'Use qualified access instead of importing',
          ],
        });
      }

      // Exit the module scope
      this.symbolTable.exitScope();
    } catch (error) {
      // Symbol table operation failed - this shouldn't happen in normal operation
      this.warnings.push({
        errorType: 'InvalidOperation',
        message: `Could not validate import '${localName}' in module '${importingModule}': ${error}`,
        location: { line: 0, column: 0, offset: 0 },
      });
    }
  }

  /**
   * Validate that all export declarations are valid
   */
  private validateExports(programs: Program[]): void {
    for (const program of programs) {
      if (program.module?.name) {
        this.validateModuleExports(program);
      }
    }
  }

  /**
   * Validate exports for a single module
   */
  private validateModuleExports(program: Program): void {
    const moduleName = this.qualifiedNameToString(program.module!.name);

    // Collect all declared symbols in the module
    const declaredSymbols = new Set<string>();

    for (const declaration of program.body) {
      switch (declaration.type) {
        case 'VariableDeclaration':
          declaredSymbols.add(declaration.name);
          break;
        case 'FunctionDeclaration':
          declaredSymbols.add(declaration.name);
          break;
        case 'EnumDeclaration':
          declaredSymbols.add(declaration.name);
          break;
        case 'TypeDeclaration':
          declaredSymbols.add(declaration.name);
          break;
      }
    }

    // Validate explicit export declarations
    for (const exportDecl of program.exports) {
      // ExportDeclaration only has a 'declaration' property, not 'specifiers'
      const declaration = exportDecl.declaration;
      let exportedName: string | undefined;

      switch (declaration.type) {
        case 'VariableDeclaration':
          exportedName = declaration.name;
          break;
        case 'FunctionDeclaration':
          exportedName = declaration.name;
          break;
        case 'EnumDeclaration':
          exportedName = declaration.name;
          break;
        case 'TypeDeclaration':
          exportedName = declaration.name;
          break;
      }

      // Check if the exported symbol is actually declared in the module body
      if (exportedName && !declaredSymbols.has(exportedName)) {
        this.errors.push({
          errorType: 'ExportNotFound',
          message: `Cannot export '${exportedName}' - symbol not declared in module '${moduleName}'`,
          location: exportDecl.metadata?.start || { line: 0, column: 0, offset: 0 },
          suggestions: [
            `Add a declaration for '${exportedName}' in this module`,
            `Remove the export of '${exportedName}'`,
            'Check the symbol name spelling',
          ],
        });
      }
    }
  }

  /**
   * Convert QualifiedName to string representation
   */
  private qualifiedNameToString(name: QualifiedName): string {
    return name.parts.join('.');
  }

  /**
   * Get current errors (for testing and debugging)
   */
  getErrors(): SemanticError[] {
    return [...this.errors];
  }

  /**
   * Get current warnings (for testing and debugging)
   */
  getWarnings(): SemanticError[] {
    return [...this.warnings];
  }
}
