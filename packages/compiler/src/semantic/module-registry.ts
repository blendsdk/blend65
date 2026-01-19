/**
 * Module Registry
 *
 * Tracks all modules in a compilation unit by name.
 * Provides module lookup, duplicate detection, and metadata tracking.
 *
 * **Phase 6.1.2** - Core module discovery infrastructure
 */

import type { Program } from '../ast/nodes.js';

/**
 * Information about a registered module
 */
export interface ModuleInfo {
  /** Full module name (e.g., 'c64.graphics.screen') */
  name: string;

  /** Parsed Program AST for this module */
  program: Program;

  /** Source file path (optional, for error reporting) */
  filePath?: string;

  /** Names of modules this module imports from */
  dependencies: string[];
}

/**
 * Module registry tracks all modules in a compilation unit
 *
 * Responsibilities:
 * - Register modules by name
 * - Detect duplicate module declarations (fail-fast)
 * - Provide module lookup by name
 * - Track module metadata (file paths, dependencies)
 *
 * **Usage:**
 * ```typescript
 * const registry = new ModuleRegistry();
 *
 * // Register modules
 * registry.register('Main', mainProgram);
 * registry.register('c64.graphics', graphicsProgram, 'src/c64/graphics.b65');
 *
 * // Query modules
 * if (registry.hasModule('Main')) {
 *   const program = registry.getModule('Main');
 * }
 *
 * // Get metadata
 * const info = registry.getModuleInfo('Main');
 * console.log(info.filePath, info.dependencies);
 * ```
 */
export class ModuleRegistry {
  /** Map of module name → module info */
  protected modules: Map<string, ModuleInfo> = new Map();

  /**
   * Register a module in the registry
   *
   * @param name - Full module name (case-sensitive)
   * @param program - Parsed Program AST
   * @param filePath - Optional source file path
   * @throws Error if module name already registered (duplicate module)
   *
   * @example
   * ```typescript
   * registry.register('Main', program);
   * registry.register('c64.graphics.screen', program, 'src/c64/graphics/screen.b65');
   * ```
   */
  public register(name: string, program: Program, filePath?: string): void {
    // Check for duplicate module name
    if (this.modules.has(name)) {
      const existing = this.modules.get(name);
      const existingPath = existing?.filePath || '(unknown)';
      const newPath = filePath || '(unknown)';

      throw new Error(
        `Duplicate module '${name}': already registered at '${existingPath}', ` +
          `attempted to register again from '${newPath}'`
      );
    }

    // Register the module
    this.modules.set(name, {
      name,
      program,
      filePath,
      dependencies: [], // Will be populated during import analysis (Task 6.1.4)
    });
  }

  /**
   * Check if a module is registered
   *
   * @param name - Module name to check
   * @returns True if module exists in registry
   *
   * @example
   * ```typescript
   * if (registry.hasModule('c64.graphics')) {
   *   // Module exists
   * }
   * ```
   */
  public hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get a module's Program AST by name
   *
   * @param name - Module name
   * @returns Program AST, or undefined if not found
   *
   * @example
   * ```typescript
   * const program = registry.getModule('Main');
   * if (program) {
   *   // Analyze the program
   * }
   * ```
   */
  public getModule(name: string): Program | undefined {
    return this.modules.get(name)?.program;
  }

  /**
   * Get full module information by name
   *
   * @param name - Module name
   * @returns ModuleInfo, or undefined if not found
   *
   * @example
   * ```typescript
   * const info = registry.getModuleInfo('Main');
   * if (info) {
   *   console.log('File:', info.filePath);
   *   console.log('Dependencies:', info.dependencies);
   * }
   * ```
   */
  public getModuleInfo(name: string): ModuleInfo | undefined {
    const info = this.modules.get(name);
    // Return a copy to prevent external modification
    return info ? { ...info, dependencies: [...info.dependencies] } : undefined;
  }

  /**
   * Get all registered module names
   *
   * @returns Array of module names in registration order
   *
   * @example
   * ```typescript
   * const names = registry.getAllModuleNames();
   * // ['Main', 'c64.graphics', 'c64.sprites']
   * ```
   */
  public getAllModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Get all registered modules
   *
   * @returns Map of module name → Program AST (copy, not reference)
   *
   * @example
   * ```typescript
   * const allModules = registry.getAllModules();
   * for (const [name, program] of allModules) {
   *   console.log('Module:', name);
   * }
   * ```
   */
  public getAllModules(): Map<string, Program> {
    const result = new Map<string, Program>();
    for (const [name, info] of this.modules) {
      result.set(name, info.program);
    }
    return result;
  }

  /**
   * Get number of registered modules
   *
   * @returns Count of modules
   *
   * @example
   * ```typescript
   * console.log(`Registered ${registry.getModuleCount()} modules`);
   * ```
   */
  public getModuleCount(): number {
    return this.modules.size;
  }

  /**
   * Add a dependency for a module
   *
   * This is called during import analysis (Task 6.1.4) to track
   * which modules depend on which other modules.
   *
   * @param moduleName - Module that has the dependency
   * @param dependencyName - Module being depended upon
   *
   * @example
   * ```typescript
   * // Module 'Main' imports from 'c64.graphics'
   * registry.addDependency('Main', 'c64.graphics');
   * ```
   */
  public addDependency(moduleName: string, dependencyName: string): void {
    const info = this.modules.get(moduleName);
    if (info && !info.dependencies.includes(dependencyName)) {
      info.dependencies.push(dependencyName);
    }
  }

  /**
   * Get dependencies for a specific module
   *
   * @param moduleName - Module name
   * @returns Array of module names this module depends on
   *
   * @example
   * ```typescript
   * const deps = registry.getDependencies('Main');
   * // ['c64.graphics', 'c64.sprites']
   * ```
   */
  public getDependencies(moduleName: string): string[] {
    const info = this.modules.get(moduleName);
    return info ? [...info.dependencies] : [];
  }

  /**
   * Clear all registered modules
   *
   * Used for testing and when starting a new compilation.
   *
   * @example
   * ```typescript
   * registry.clear();
   * assert(registry.getModuleCount() === 0);
   * ```
   */
  public clear(): void {
    this.modules.clear();
  }
}
