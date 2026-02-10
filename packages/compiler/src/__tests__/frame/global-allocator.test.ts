/**
 * Tests for GlobalAllocator
 *
 * Tests the core global variable allocation logic:
 * - Collection of module-level VariableDecls from programs
 * - Categorization by storage class (@zp, @ram, @data, default)
 * - ZP allocation with pool sharing
 * - RAM and data segment offset allocation
 * - Multi-module collection
 * - ZP overflow error handling
 * - Empty programs and edge cases
 */

import { describe, it, expect } from 'vitest';
import { GlobalAllocator } from '../../frame/allocator/global-allocator.js';
import { Program, ModuleDecl, ExportDecl } from '../../ast/program.js';
import { VariableDecl } from '../../ast/declarations.js';
import { LiteralExpression } from '../../ast/expressions.js';
import { TokenType } from '../../lexer/types.js';
import { C64_PLATFORM_CONFIG, TEST_PLATFORM_CONFIG } from '../../frame/platform.js';
import type { SourceLocation } from '../../lexer/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates a test SourceLocation. */
function loc(): SourceLocation {
  return { line: 1, column: 1, offset: 0, length: 0 };
}

/**
 * Creates a module-level Program with the given variable declarations.
 * Convenience for building test AST structures.
 */
function createProgram(moduleName: string, declarations: any[]): Program {
  const moduleDecl = new ModuleDecl(moduleName.split('.'), loc(), false);
  return new Program(moduleDecl, declarations, loc());
}

/**
 * Creates a VariableDecl with optional storage class, const, and export flags.
 */
function createVarDecl(
  name: string,
  typeAnnotation: string,
  options?: {
    storageClass?: TokenType | null;
    isConst?: boolean;
    isExported?: boolean;
    initializer?: any;
  },
): VariableDecl {
  const init = options?.initializer ?? null;
  return new VariableDecl(
    name,
    typeAnnotation,
    init,
    loc(),
    options?.storageClass ?? null,
    options?.isConst ?? false,
    options?.isExported ?? false,
  );
}

// ============================================================================
// Tests: Construction
// ============================================================================

describe('GlobalAllocator', () => {
  describe('constructor', () => {
    it('should create allocator with platform config', () => {
      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      expect(allocator).toBeDefined();
      expect(allocator.getZpPool()).toBeDefined();
    });
  });

  // ==========================================================================
  // Tests: Empty Programs
  // ==========================================================================

  describe('empty programs', () => {
    it('should return empty result for no programs', () => {
      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([]);

      expect(result.success).toBe(true);
      expect(result.globals.size).toBe(0);
      expect(result.dataSegmentSize).toBe(0);
      expect(result.ramRegionSize).toBe(0);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should return empty result for program with no variables', () => {
      const program = createProgram('Test', []);
      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.success).toBe(true);
      expect(result.globals.size).toBe(0);
    });
  });

  // ==========================================================================
  // Tests: Collection
  // ==========================================================================

  describe('collectGlobals', () => {
    it('should collect module-level variable declarations', () => {
      const varDecl = createVarDecl('score', 'word');
      const program = createProgram('Game', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.size).toBe(1);
      expect(result.globals.has('Game.score')).toBe(true);
    });

    it('should unwrap ExportDecl to find VariableDecl', () => {
      const varDecl = createVarDecl('counter', 'byte', { isExported: true });
      const exportDecl = new ExportDecl(varDecl, loc());
      const program = createProgram('Main', [exportDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.size).toBe(1);
      const slot = result.globals.get('Main.counter');
      expect(slot).toBeDefined();
      expect(slot!.isExported).toBe(true);
    });

    it('should collect from multiple modules', () => {
      const prog1 = createProgram('ModA', [createVarDecl('x', 'byte')]);
      const prog2 = createProgram('ModB', [createVarDecl('y', 'word')]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([prog1, prog2]);

      expect(result.globals.size).toBe(2);
      expect(result.globals.has('ModA.x')).toBe(true);
      expect(result.globals.has('ModB.y')).toBe(true);
    });

    it('should use qualified names to avoid cross-module collisions', () => {
      // Both modules have a variable named "count"
      const prog1 = createProgram('ModA', [createVarDecl('count', 'byte')]);
      const prog2 = createProgram('ModB', [createVarDecl('count', 'byte')]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([prog1, prog2]);

      expect(result.globals.size).toBe(2);
      expect(result.globals.has('ModA.count')).toBe(true);
      expect(result.globals.has('ModB.count')).toBe(true);
    });
  });

  // ==========================================================================
  // Tests: Categorization
  // ==========================================================================

  describe('categorizeByStorageClass', () => {
    it('should categorize @zp variables', () => {
      const varDecl = createVarDecl('fast', 'byte', { storageClass: TokenType.ZP });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.fast');
      expect(slot).toBeDefined();
      expect(slot!.storageClass).toBe('zp');
    });

    it('should categorize @ram variables', () => {
      const varDecl = createVarDecl('buffer', 'byte', { storageClass: TokenType.RAM });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.buffer');
      expect(slot).toBeDefined();
      expect(slot!.storageClass).toBe('ram');
    });

    it('should categorize @data variables', () => {
      const init = new LiteralExpression(42, loc());
      const varDecl = createVarDecl('table', 'byte', {
        storageClass: TokenType.DATA,
        isConst: true,
        initializer: init,
      });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.table');
      expect(slot).toBeDefined();
      expect(slot!.storageClass).toBe('data');
    });

    it('should categorize default (no annotation) as default', () => {
      const varDecl = createVarDecl('simple', 'byte');
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.simple');
      expect(slot).toBeDefined();
      expect(slot!.storageClass).toBe('default');
    });

    it('should handle mixed storage classes in one module', () => {
      const zpVar = createVarDecl('fast', 'byte', { storageClass: TokenType.ZP });
      const ramVar = createVarDecl('buf', 'byte', { storageClass: TokenType.RAM });
      const defaultVar = createVarDecl('temp', 'byte');
      const program = createProgram('Mixed', [zpVar, ramVar, defaultVar]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.size).toBe(3);
      expect(result.globals.get('Mixed.fast')!.storageClass).toBe('zp');
      expect(result.globals.get('Mixed.buf')!.storageClass).toBe('ram');
      expect(result.globals.get('Mixed.temp')!.storageClass).toBe('default');
    });
  });

  // ==========================================================================
  // Tests: ZP Allocation
  // ==========================================================================

  describe('allocateZpGlobals', () => {
    it('should allocate @zp byte to zero page address', () => {
      const varDecl = createVarDecl('counter', 'byte', { storageClass: TokenType.ZP });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.counter')!;
      // ZP address should be in the C64 ZP range ($02-$8F)
      expect(slot.address).toBeGreaterThanOrEqual(0x02);
      expect(slot.address).toBeLessThan(0x90);
      expect(slot.size).toBe(1);
    });

    it('should allocate @zp word to zero page (2 contiguous bytes)', () => {
      const varDecl = createVarDecl('ptr', 'word', { storageClass: TokenType.ZP });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Test.ptr')!;
      expect(slot.address).toBeGreaterThanOrEqual(0x02);
      expect(slot.address).toBeLessThan(0x90);
      expect(slot.size).toBe(2);
    });

    it('should allocate multiple @zp variables at different addresses', () => {
      const var1 = createVarDecl('a', 'byte', { storageClass: TokenType.ZP });
      const var2 = createVarDecl('b', 'byte', { storageClass: TokenType.ZP });
      const program = createProgram('Test', [var1, var2]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slotA = result.globals.get('Test.a')!;
      const slotB = result.globals.get('Test.b')!;
      expect(slotA.address).not.toBe(slotB.address);
    });

    it('should reduce ZP pool availability after allocation', () => {
      const varDecl = createVarDecl('x', 'byte', { storageClass: TokenType.ZP });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      // The ZP pool should have 1 byte less available
      const stats = result.zpPool.getStats();
      expect(stats.bytesUsed).toBeGreaterThanOrEqual(1);
    });

    it('should report error on ZP overflow', () => {
      // Use TEST_PLATFORM_CONFIG with only 16 bytes of ZP
      // Try to allocate more than fits
      const vars = [];
      // ZP range $10-$20 (16 bytes) minus scratch $1C-$20 (4 bytes) = 12 usable
      // Allocate 13 byte variables to overflow
      for (let i = 0; i < 13; i++) {
        vars.push(createVarDecl(`var${i}`, 'byte', { storageClass: TokenType.ZP }));
      }
      const program = createProgram('Test', vars);

      const allocator = new GlobalAllocator(TEST_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('cannot fit in zero page');
    });
  });

  // ==========================================================================
  // Tests: RAM and Data Allocation
  // ==========================================================================

  describe('allocateRamGlobals', () => {
    it('should assign sequential RAM offsets', () => {
      const var1 = createVarDecl('a', 'byte', { storageClass: TokenType.RAM });
      const var2 = createVarDecl('b', 'word', { storageClass: TokenType.RAM });
      const program = createProgram('Test', [var1, var2]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slotA = result.globals.get('Test.a')!;
      const slotB = result.globals.get('Test.b')!;
      expect(slotA.address).toBe(0); // first at offset 0
      expect(slotB.address).toBe(1); // second after 1 byte
      expect(result.ramRegionSize).toBe(3); // 1 + 2 bytes
    });

    it('should include default globals in RAM region', () => {
      const varDecl = createVarDecl('temp', 'byte');
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.ramRegionSize).toBe(1);
      const slot = result.globals.get('Test.temp')!;
      expect(slot.address).toBe(0);
    });
  });

  describe('allocateDataGlobals', () => {
    it('should assign sequential data segment offsets', () => {
      const init = new LiteralExpression(42, loc());
      const var1 = createVarDecl('t1', 'byte', {
        storageClass: TokenType.DATA, isConst: true, initializer: init,
      });
      const var2 = createVarDecl('t2', 'word', {
        storageClass: TokenType.DATA, isConst: true, initializer: init,
      });
      const program = createProgram('Test', [var1, var2]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot1 = result.globals.get('Test.t1')!;
      const slot2 = result.globals.get('Test.t2')!;
      expect(slot1.address).toBe(0);
      expect(slot2.address).toBe(1);
      expect(result.dataSegmentSize).toBe(3);
    });
  });

  // ==========================================================================
  // Tests: Type Resolution
  // ==========================================================================

  describe('type resolution', () => {
    it('should resolve byte type to size 1', () => {
      const varDecl = createVarDecl('x', 'byte');
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.get('Test.x')!.size).toBe(1);
    });

    it('should resolve word type to size 2', () => {
      const varDecl = createVarDecl('x', 'word');
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.get('Test.x')!.size).toBe(2);
    });
  });

  // ==========================================================================
  // Tests: Metadata
  // ==========================================================================

  describe('slot metadata', () => {
    it('should preserve isConst flag', () => {
      const varDecl = createVarDecl('MAX', 'byte', { isConst: true });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.get('Test.MAX')!.isConst).toBe(true);
    });

    it('should preserve isExported flag', () => {
      const varDecl = createVarDecl('pub', 'byte', { isExported: true });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.get('Test.pub')!.isExported).toBe(true);
    });

    it('should preserve initializer', () => {
      const init = new LiteralExpression(42, loc());
      const varDecl = createVarDecl('x', 'byte', { initializer: init });
      const program = createProgram('Test', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      expect(result.globals.get('Test.x')!.initializer).toBeDefined();
    });

    it('should set qualified name correctly', () => {
      const varDecl = createVarDecl('score', 'word');
      const program = createProgram('Game.Main', [varDecl]);

      const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
      const result = allocator.allocate([program]);

      const slot = result.globals.get('Game.Main.score');
      expect(slot).toBeDefined();
      expect(slot!.qualifiedName).toBe('Game.Main.score');
      expect(slot!.moduleName).toBe('Game.Main');
      expect(slot!.name).toBe('score');
    });
  });
});
