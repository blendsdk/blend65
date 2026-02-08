/**
 * Module Registry Tests
 *
 * Tests for Phase 6.1.2 - Module registry with duplicate detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistry } from '../../semantic/module-registry.js';
import { Parser } from '../../parser/parser.js';
import { Lexer } from '../../lexer/lexer.js';
import type { Program } from '../../ast/nodes.js';

/**
 * Helper: Parse a module from source code
 */
function parseModule(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('Basic Registration', () => {
    it('should register a single module', () => {
      const program = parseModule('module Main\nexport function main(): void { }');

      registry.register('Main', program);

      expect(registry.hasModule('Main')).toBe(true);
      expect(registry.getModuleCount()).toBe(1);
    });

    it('should register multiple modules', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');
      const sprites = parseModule('module c64.sprites\nexport function init(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);
      registry.register('c64.sprites', sprites);

      expect(registry.getModuleCount()).toBe(3);
      expect(registry.hasModule('Main')).toBe(true);
      expect(registry.hasModule('c64.graphics')).toBe(true);
      expect(registry.hasModule('c64.sprites')).toBe(true);
    });

    it('should register module with file path', () => {
      const program = parseModule('module Main\nexport function main(): void { }');

      registry.register('Main', program, 'src/main.b65');

      const info = registry.getModuleInfo('Main');
      expect(info?.filePath).toBe('src/main.b65');
    });

    it('should register module without file path', () => {
      const program = parseModule('module Main\nexport function main(): void { }');

      registry.register('Main', program);

      const info = registry.getModuleInfo('Main');
      expect(info?.filePath).toBeUndefined();
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate module names', () => {
      const program1 = parseModule('module Main\nexport function main(): void { }');
      const program2 = parseModule('module Main\nlet x: byte = 0;');

      registry.register('Main', program1, 'src/main.b65');

      expect(() => {
        registry.register('Main', program2, 'src/main2.b65');
      }).toThrow(/Duplicate module 'Main'/);
    });

    it('should report file paths in duplicate error', () => {
      const program1 = parseModule('module Main\nexport function main(): void { }');
      const program2 = parseModule('module Main\nlet x: byte = 0;');

      registry.register('Main', program1, 'src/main.b65');

      expect(() => {
        registry.register('Main', program2, 'src/other.b65');
      }).toThrow(/already registered at 'src\/main.b65'/);
      expect(() => {
        registry.register('Main', program2, 'src/other.b65');
      }).toThrow(/attempted to register again from 'src\/other.b65'/);
    });

    it('should handle duplicate without file paths', () => {
      const program1 = parseModule('module Main\nexport function main(): void { }');
      const program2 = parseModule('module Main\nlet x: byte = 0;');

      registry.register('Main', program1);

      expect(() => {
        registry.register('Main', program2);
      }).toThrow(/Duplicate module 'Main'/);
      expect(() => {
        registry.register('Main', program2);
      }).toThrow(/\(unknown\)/);
    });
  });

  describe('Module Lookup', () => {
    it('should lookup existing module', () => {
      const program = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', program);

      const retrieved = registry.getModule('Main');

      expect(retrieved).toBe(program);
    });

    it('should return undefined for non-existent module', () => {
      const retrieved = registry.getModule('NonExistent');

      expect(retrieved).toBeUndefined();
    });

    it('should check if module exists', () => {
      const program = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', program);

      expect(registry.hasModule('Main')).toBe(true);
      expect(registry.hasModule('NonExistent')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const program = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', program);

      expect(registry.hasModule('Main')).toBe(true);
      expect(registry.hasModule('main')).toBe(false);
      expect(registry.hasModule('MAIN')).toBe(false);
    });
  });

  describe('Module Information', () => {
    it('should retrieve module info', () => {
      const program = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', program, 'src/main.b65');

      const info = registry.getModuleInfo('Main');

      expect(info?.name).toBe('Main');
      expect(info?.program).toBe(program);
      expect(info?.filePath).toBe('src/main.b65');
      expect(info?.dependencies).toEqual([]);
    });

    it('should return undefined for non-existent module info', () => {
      const info = registry.getModuleInfo('NonExistent');

      expect(info).toBeUndefined();
    });

    it('should return defensive copy of module info', () => {
      const program = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', program);

      const info1 = registry.getModuleInfo('Main');
      const info2 = registry.getModuleInfo('Main');

      expect(info1).not.toBe(info2); // Different objects
      expect(info1).toEqual(info2); // Same content
    });
  });

  describe('Bulk Operations', () => {
    it('should get all module names', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');
      const sprites = parseModule('module c64.sprites\nexport function init(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);
      registry.register('c64.sprites', sprites);

      const names = registry.getAllModuleNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('Main');
      expect(names).toContain('c64.graphics');
      expect(names).toContain('c64.sprites');
    });

    it('should get all modules', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);

      const allModules = registry.getAllModules();

      expect(allModules.size).toBe(2);
      expect(allModules.get('Main')).toBe(main);
      expect(allModules.get('c64.graphics')).toBe(graphics);
    });

    it('should return empty array for empty registry', () => {
      const names = registry.getAllModuleNames();

      expect(names).toEqual([]);
    });

    it('should return empty map for empty registry', () => {
      const modules = registry.getAllModules();

      expect(modules.size).toBe(0);
    });
  });

  describe('Dependency Tracking', () => {
    it('should add dependency', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);

      registry.addDependency('Main', 'c64.graphics');

      const deps = registry.getDependencies('Main');
      expect(deps).toEqual(['c64.graphics']);
    });

    it('should add multiple dependencies', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');
      const sprites = parseModule('module c64.sprites\nexport function init(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);
      registry.register('c64.sprites', sprites);

      registry.addDependency('Main', 'c64.graphics');
      registry.addDependency('Main', 'c64.sprites');

      const deps = registry.getDependencies('Main');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('c64.graphics');
      expect(deps).toContain('c64.sprites');
    });

    it('should prevent duplicate dependencies', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);

      registry.addDependency('Main', 'c64.graphics');
      registry.addDependency('Main', 'c64.graphics'); // Duplicate

      const deps = registry.getDependencies('Main');
      expect(deps).toEqual(['c64.graphics']); // Only once
    });

    it('should return empty array for module with no dependencies', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      registry.register('Main', main);

      const deps = registry.getDependencies('Main');

      expect(deps).toEqual([]);
    });

    it('should return empty array for non-existent module', () => {
      const deps = registry.getDependencies('NonExistent');

      expect(deps).toEqual([]);
    });

    it('should include dependencies in module info', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);
      registry.addDependency('Main', 'c64.graphics');

      const info = registry.getModuleInfo('Main');

      expect(info?.dependencies).toEqual(['c64.graphics']);
    });
  });

  describe('Clear Operation', () => {
    it('should clear all modules', () => {
      const main = parseModule('module Main\nexport function main(): void { }');
      const graphics = parseModule('module c64.graphics\nexport function clear(): void { }');

      registry.register('Main', main);
      registry.register('c64.graphics', graphics);

      expect(registry.getModuleCount()).toBe(2);

      registry.clear();

      expect(registry.getModuleCount()).toBe(0);
      expect(registry.hasModule('Main')).toBe(false);
      expect(registry.hasModule('c64.graphics')).toBe(false);
    });

    it('should allow re-registration after clear', () => {
      const main = parseModule('module Main\nexport function main(): void { }');

      registry.register('Main', main);
      registry.clear();
      registry.register('Main', main); // Should not throw

      expect(registry.hasModule('Main')).toBe(true);
    });
  });

  describe('Hierarchical Module Names', () => {
    it('should handle deeply nested module names', () => {
      const program = parseModule(
        'module c64.graphics.screen.utils\nexport function test(): void { }'
      );

      registry.register('c64.graphics.screen.utils', program);

      expect(registry.hasModule('c64.graphics.screen.utils')).toBe(true);
    });

    it('should treat different nesting levels as separate modules', () => {
      const screen = parseModule('module c64.screen\nexport function test(): void { }');
      const graphics = parseModule('module c64.screen.graphics\nexport function test(): void { }');

      registry.register('c64.screen', screen);
      registry.register('c64.screen.graphics', graphics);

      expect(registry.getModuleCount()).toBe(2);
      expect(registry.hasModule('c64.screen')).toBe(true);
      expect(registry.hasModule('c64.screen.graphics')).toBe(true);
    });
  });
});