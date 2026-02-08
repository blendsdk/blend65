/**
 * Module Registry Tests for Blend65 Compiler v2
 *
 * Tests the ModuleRegistry class which tracks all modules
 * in a multi-module compilation.
 *
 * Test categories:
 * - Creation and basic operations
 * - Module registration
 * - Module retrieval
 * - Module existence checking
 * - Module removal
 * - Iteration and collection operations
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistry, RegisteredModule } from '../../semantic/module-registry.js';
import { Program, ModuleDecl, SourceLocation } from '../../ast/index.js';

/**
 * Creates a test source location
 */
function createLocation(line: number = 1, col: number = 1): SourceLocation {
  return {
    start: { line, column: col, offset: 0 },
    end: { line, column: col + 10, offset: 10 },
  };
}

/**
 * Creates a mock Program AST for testing
 *
 * @param moduleName - The module name (e.g., "Game.Main")
 * @returns A Program with the given module name
 */
function createMockProgram(moduleName: string): Program {
  const namePath = moduleName.split('.');
  const moduleDecl = new ModuleDecl(namePath, createLocation(), false);
  return new Program(moduleDecl, [], createLocation());
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  // ============================================
  // CREATION AND BASIC OPERATIONS
  // ============================================

  describe('creation', () => {
    it('should create an empty registry', () => {
      expect(registry.isEmpty()).toBe(true);
      expect(registry.getModuleCount()).toBe(0);
    });

    it('should have no modules initially', () => {
      expect(registry.getAllModuleNames()).toEqual([]);
      expect(registry.getAllModules()).toEqual([]);
    });
  });

  // ============================================
  // MODULE REGISTRATION
  // ============================================

  describe('register', () => {
    it('should register a single module', () => {
      const program = createMockProgram('Game.Main');
      registry.register('Game.Main', program);

      expect(registry.hasModule('Game.Main')).toBe(true);
      expect(registry.getModuleCount()).toBe(1);
    });

    it('should register multiple modules', () => {
      const main = createMockProgram('Game.Main');
      const sprites = createMockProgram('Game.Sprites');
      const math = createMockProgram('Lib.Math');

      registry.register('Game.Main', main);
      registry.register('Game.Sprites', sprites);
      registry.register('Lib.Math', math);

      expect(registry.getModuleCount()).toBe(3);
      expect(registry.hasModule('Game.Main')).toBe(true);
      expect(registry.hasModule('Game.Sprites')).toBe(true);
      expect(registry.hasModule('Lib.Math')).toBe(true);
    });

    it('should overwrite existing module when registered again', () => {
      const program1 = createMockProgram('Game.Main');
      const program2 = createMockProgram('Game.Main');

      registry.register('Game.Main', program1);
      const first = registry.getProgram('Game.Main');

      registry.register('Game.Main', program2);
      const second = registry.getProgram('Game.Main');

      expect(registry.getModuleCount()).toBe(1);
      expect(first).toBe(program1);
      expect(second).toBe(program2);
    });

    it('should set registeredAt timestamp', () => {
      const before = new Date();
      const program = createMockProgram('Test');
      registry.register('Test', program);
      const after = new Date();

      const module = registry.getModule('Test');
      expect(module).toBeDefined();
      expect(module!.registeredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(module!.registeredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should store the correct module name', () => {
      const program = createMockProgram('Deep.Nested.Module.Name');
      registry.register('Deep.Nested.Module.Name', program);

      const module = registry.getModule('Deep.Nested.Module.Name');
      expect(module?.name).toBe('Deep.Nested.Module.Name');
    });
  });

  // ============================================
  // MODULE RETRIEVAL
  // ============================================

  describe('getModule', () => {
    it('should return undefined for non-existent module', () => {
      expect(registry.getModule('NonExistent')).toBeUndefined();
    });

    it('should return RegisteredModule with all fields', () => {
      const program = createMockProgram('Game.Main');
      registry.register('Game.Main', program);

      const module = registry.getModule('Game.Main');
      expect(module).toBeDefined();
      expect(module!.name).toBe('Game.Main');
      expect(module!.program).toBe(program);
      expect(module!.registeredAt).toBeInstanceOf(Date);
    });

    it('should return the same module on multiple calls', () => {
      const program = createMockProgram('Game.Main');
      registry.register('Game.Main', program);

      const module1 = registry.getModule('Game.Main');
      const module2 = registry.getModule('Game.Main');

      expect(module1).toBe(module2);
    });
  });

  describe('getProgram', () => {
    it('should return undefined for non-existent module', () => {
      expect(registry.getProgram('NonExistent')).toBeUndefined();
    });

    it('should return the Program AST directly', () => {
      const program = createMockProgram('Game.Main');
      registry.register('Game.Main', program);

      expect(registry.getProgram('Game.Main')).toBe(program);
    });

    it('should return undefined after module is unregistered', () => {
      const program = createMockProgram('Game.Main');
      registry.register('Game.Main', program);

      expect(registry.getProgram('Game.Main')).toBe(program);

      registry.unregister('Game.Main');

      expect(registry.getProgram('Game.Main')).toBeUndefined();
    });
  });

  // ============================================
  // MODULE EXISTENCE CHECKING
  // ============================================

  describe('hasModule', () => {
    it('should return false for non-existent module', () => {
      expect(registry.hasModule('NonExistent')).toBe(false);
    });

    it('should return true for registered module', () => {
      registry.register('Game.Main', createMockProgram('Game.Main'));
      expect(registry.hasModule('Game.Main')).toBe(true);
    });

    it('should return false after module is unregistered', () => {
      registry.register('Game.Main', createMockProgram('Game.Main'));
      expect(registry.hasModule('Game.Main')).toBe(true);

      registry.unregister('Game.Main');
      expect(registry.hasModule('Game.Main')).toBe(false);
    });

    it('should be case-sensitive', () => {
      registry.register('Game.Main', createMockProgram('Game.Main'));

      expect(registry.hasModule('Game.Main')).toBe(true);
      expect(registry.hasModule('game.main')).toBe(false);
      expect(registry.hasModule('GAME.MAIN')).toBe(false);
    });
  });

  // ============================================
  // MODULE REMOVAL
  // ============================================

  describe('unregister', () => {
    it('should return false for non-existent module', () => {
      expect(registry.unregister('NonExistent')).toBe(false);
    });

    it('should return true and remove existing module', () => {
      registry.register('Game.Main', createMockProgram('Game.Main'));

      expect(registry.unregister('Game.Main')).toBe(true);
      expect(registry.hasModule('Game.Main')).toBe(false);
      expect(registry.getModuleCount()).toBe(0);
    });

    it('should only remove the specified module', () => {
      registry.register('Game.Main', createMockProgram('Game.Main'));
      registry.register('Game.Sprites', createMockProgram('Game.Sprites'));

      registry.unregister('Game.Main');

      expect(registry.hasModule('Game.Main')).toBe(false);
      expect(registry.hasModule('Game.Sprites')).toBe(true);
      expect(registry.getModuleCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all modules', () => {
      registry.register('A', createMockProgram('A'));
      registry.register('B', createMockProgram('B'));
      registry.register('C', createMockProgram('C'));

      expect(registry.getModuleCount()).toBe(3);

      registry.clear();

      expect(registry.isEmpty()).toBe(true);
      expect(registry.getModuleCount()).toBe(0);
    });

    it('should work on empty registry', () => {
      registry.clear();
      expect(registry.isEmpty()).toBe(true);
    });
  });

  // ============================================
  // ITERATION AND COLLECTION OPERATIONS
  // ============================================

  describe('getAllModuleNames', () => {
    it('should return empty array for empty registry', () => {
      expect(registry.getAllModuleNames()).toEqual([]);
    });

    it('should return all registered module names', () => {
      registry.register('A', createMockProgram('A'));
      registry.register('B', createMockProgram('B'));
      registry.register('C', createMockProgram('C'));

      const names = registry.getAllModuleNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('A');
      expect(names).toContain('B');
      expect(names).toContain('C');
    });
  });

  describe('getAllModules', () => {
    it('should return empty array for empty registry', () => {
      expect(registry.getAllModules()).toEqual([]);
    });

    it('should return all registered modules', () => {
      const progA = createMockProgram('A');
      const progB = createMockProgram('B');

      registry.register('A', progA);
      registry.register('B', progB);

      const modules = registry.getAllModules();

      expect(modules).toHaveLength(2);
      expect(modules.map(m => m.name)).toContain('A');
      expect(modules.map(m => m.name)).toContain('B');
    });
  });

  describe('iterator', () => {
    it('should support for...of iteration', () => {
      registry.register('A', createMockProgram('A'));
      registry.register('B', createMockProgram('B'));

      const collected: Array<[string, RegisteredModule]> = [];
      for (const entry of registry) {
        collected.push(entry);
      }

      expect(collected).toHaveLength(2);
      expect(collected.map(([name]) => name)).toContain('A');
      expect(collected.map(([name]) => name)).toContain('B');
    });

    it('should yield [name, RegisteredModule] tuples', () => {
      const progA = createMockProgram('A');
      registry.register('A', progA);

      for (const [name, module] of registry) {
        expect(name).toBe('A');
        expect(module.name).toBe('A');
        expect(module.program).toBe(progA);
      }
    });
  });

  // ============================================
  // COUNT AND EMPTY CHECKS
  // ============================================

  describe('getModuleCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getModuleCount()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registry.register('A', createMockProgram('A'));
      expect(registry.getModuleCount()).toBe(1);

      registry.register('B', createMockProgram('B'));
      expect(registry.getModuleCount()).toBe(2);

      registry.register('C', createMockProgram('C'));
      expect(registry.getModuleCount()).toBe(3);
    });

    it('should return correct count after unregistration', () => {
      registry.register('A', createMockProgram('A'));
      registry.register('B', createMockProgram('B'));

      expect(registry.getModuleCount()).toBe(2);

      registry.unregister('A');

      expect(registry.getModuleCount()).toBe(1);
    });
  });

  describe('isEmpty', () => {
    it('should return true for new registry', () => {
      expect(registry.isEmpty()).toBe(true);
    });

    it('should return false after registration', () => {
      registry.register('A', createMockProgram('A'));
      expect(registry.isEmpty()).toBe(false);
    });

    it('should return true after clearing', () => {
      registry.register('A', createMockProgram('A'));
      registry.clear();
      expect(registry.isEmpty()).toBe(true);
    });

    it('should return true after all modules unregistered', () => {
      registry.register('A', createMockProgram('A'));
      registry.unregister('A');
      expect(registry.isEmpty()).toBe(true);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle module names with dots correctly', () => {
      const program = createMockProgram('Very.Deep.Nested.Module');
      registry.register('Very.Deep.Nested.Module', program);

      expect(registry.hasModule('Very.Deep.Nested.Module')).toBe(true);
      expect(registry.hasModule('Very')).toBe(false);
      expect(registry.hasModule('Very.Deep')).toBe(false);
    });

    it('should handle single-word module names', () => {
      const program = createMockProgram('Global');
      registry.register('Global', program);

      expect(registry.hasModule('Global')).toBe(true);
    });

    it('should handle empty string module name', () => {
      // Edge case - not recommended but should work
      const program = createMockProgram('');
      registry.register('', program);

      expect(registry.hasModule('')).toBe(true);
    });

    it('should handle special characters in module names', () => {
      // Module names should normally be identifiers, but test edge cases
      const program = createMockProgram('Test_123');
      registry.register('Test_123', program);

      expect(registry.hasModule('Test_123')).toBe(true);
    });
  });
});