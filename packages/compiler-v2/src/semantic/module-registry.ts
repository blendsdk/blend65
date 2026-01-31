/**
 * Module Registry for Blend65 Compiler v2
 *
 * Tracks all modules in a multi-module compilation.
 * The registry stores parsed Program ASTs and tracks dependencies
 * between modules for compilation ordering.
 *
 * Key responsibilities:
 * - Store and retrieve module ASTs by name
 * - Track module dependencies (which module imports which)
 * - Validate module existence
 * - Support iteration over all registered modules
 *
 * @module semantic/module-registry
 */

import type { Program } from '../ast/index.js';

/**
 * Module metadata stored in the registry
 *
 * Contains the parsed AST and tracking information for each module.
 */
export interface RegisteredModule {
  /** The full module name (e.g., "Game.Main") */
  name: string;

  /** The parsed AST for this module */
  program: Program;

  /** When this module was registered (for debugging) */
  registeredAt: Date;
}

/**
 * Module Registry - tracks all modules in a multi-module compilation
 *
 * The registry is the central store for all module ASTs during compilation.
 * It provides methods to register, retrieve, and query modules.
 *
 * Usage:
 * 1. Parse all source files into Program ASTs
 * 2. Register each Program with its module name
 * 3. Use the registry to look up modules during import resolution
 *
 * @example
 * ```typescript
 * const registry = new ModuleRegistry();
 *
 * // Register parsed modules
 * registry.register('Game.Main', mainProgram);
 * registry.register('Game.Sprites', spritesProgram);
 *
 * // Look up modules
 * const mainModule = registry.getModule('Game.Main');
 *
 * // Check if module exists
 * if (registry.hasModule('Game.Audio')) {
 *   // ...
 * }
 * ```
 */
export class ModuleRegistry {
  /**
   * Map of module name to registered module data
   * Key: Full module name (e.g., "Game.Main")
   * Value: RegisteredModule containing the AST and metadata
   */
  protected modules: Map<string, RegisteredModule> = new Map();

  /**
   * Registers a module with its parsed AST
   *
   * The module name is extracted from the Program's module declaration.
   * If a module with the same name is already registered, it will be
   * overwritten (useful for hot-reloading during development).
   *
   * @param name - The full module name (e.g., "Game.Main")
   * @param program - The parsed AST for this module
   *
   * @example
   * ```typescript
   * registry.register('Game.Main', mainProgram);
   * ```
   */
  public register(name: string, program: Program): void {
    this.modules.set(name, {
      name,
      program,
      registeredAt: new Date(),
    });
  }

  /**
   * Gets a module by name
   *
   * Returns the registered module data if found, undefined otherwise.
   *
   * @param name - The full module name to look up
   * @returns The registered module or undefined if not found
   *
   * @example
   * ```typescript
   * const module = registry.getModule('Game.Main');
   * if (module) {
   *   const declarations = module.program.getDeclarations();
   * }
   * ```
   */
  public getModule(name: string): RegisteredModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Gets a module's Program AST by name
   *
   * Convenience method that returns just the Program AST.
   * Returns undefined if the module is not registered.
   *
   * @param name - The full module name to look up
   * @returns The Program AST or undefined if not found
   *
   * @example
   * ```typescript
   * const program = registry.getProgram('Game.Main');
   * if (program) {
   *   console.log('Module has', program.getDeclarations().length, 'declarations');
   * }
   * ```
   */
  public getProgram(name: string): Program | undefined {
    return this.modules.get(name)?.program;
  }

  /**
   * Checks if a module is registered
   *
   * @param name - The full module name to check
   * @returns true if the module is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.hasModule('Game.Audio')) {
   *   // Safe to import from Game.Audio
   * }
   * ```
   */
  public hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Removes a module from the registry
   *
   * Useful for hot-reloading during development when a file changes.
   *
   * @param name - The full module name to remove
   * @returns true if the module was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * if (registry.unregister('Game.Main')) {
   *   console.log('Module removed, re-parsing...');
   * }
   * ```
   */
  public unregister(name: string): boolean {
    return this.modules.delete(name);
  }

  /**
   * Gets all registered module names
   *
   * Returns an array of all module names currently in the registry.
   * The order is not guaranteed (depends on Map iteration order).
   *
   * @returns Array of all registered module names
   *
   * @example
   * ```typescript
   * const names = registry.getAllModuleNames();
   * // ['Game.Main', 'Game.Sprites', 'Lib.Math']
   * ```
   */
  public getAllModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Gets all registered modules
   *
   * Returns an array of all registered module data.
   *
   * @returns Array of all registered modules
   *
   * @example
   * ```typescript
   * for (const module of registry.getAllModules()) {
   *   console.log('Processing module:', module.name);
   * }
   * ```
   */
  public getAllModules(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Gets the number of registered modules
   *
   * @returns The count of registered modules
   */
  public getModuleCount(): number {
    return this.modules.size;
  }

  /**
   * Checks if the registry is empty
   *
   * @returns true if no modules are registered
   */
  public isEmpty(): boolean {
    return this.modules.size === 0;
  }

  /**
   * Clears all registered modules
   *
   * Useful for resetting the registry between compilations.
   */
  public clear(): void {
    this.modules.clear();
  }

  /**
   * Iterator support - allows for...of iteration
   *
   * @example
   * ```typescript
   * for (const [name, module] of registry) {
   *   console.log('Module:', name);
   * }
   * ```
   */
  public [Symbol.iterator](): IterableIterator<[string, RegisteredModule]> {
    return this.modules.entries();
  }
}