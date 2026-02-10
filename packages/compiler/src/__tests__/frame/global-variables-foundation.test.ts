/**
 * Global Variables Foundation Tests
 *
 * Tests for Phase 1 Session 1.1 of global variables implementation:
 * - ZpDirective.Data enum value
 * - GlobalSlot and GlobalAllocationResult types
 * - Factory functions (createGlobalSlot, createEmptyGlobalAllocationResult)
 * - Type guards (isZpGlobal, isRamGlobal, isDataGlobal)
 * - Symbol table builder storage class metadata
 * - @data validation (requires const + initializer)
 * - getZpDirective() @data mapping in FrameCalculator
 *
 * @module __tests__/frame/global-variables-foundation
 */

import { describe, it, expect } from 'vitest';
import { ZpDirective } from '../../frame/enums.js';
import {
  createGlobalSlot,
  createEmptyGlobalAllocationResult,
  isZpGlobal,
  isRamGlobal,
  isDataGlobal,
} from '../../frame/types-global.js';
import type { GlobalSlot, GlobalStorageClass } from '../../frame/types-global.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { ZpPool } from '../../frame/allocator/zp-pool.js';
import { C64_PLATFORM_CONFIG } from '../../frame/platform.js';
import { DiagnosticSeverity as FrameDiagSeverity } from '../../frame/enums.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import type { SymbolTableBuildResult } from '../../semantic/visitors/symbol-table-builder.js';
import type { Program } from '../../ast/index.js';
import { TokenType } from '../../lexer/types.js';
import { DiagnosticCode } from '../../ast/diagnostics.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Parse Blend65 source code into a Program AST.
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, { filePath: 'test.blend' });
  return parser.parse();
}

/**
 * Build symbol table from Blend65 source code.
 */
function buildSymbolTable(source: string): SymbolTableBuildResult {
  const program = parse(source);
  const builder = new SymbolTableBuilder();
  return builder.build(program);
}

// ============================================================================
// ZpDirective.Data Enum Tests
// ============================================================================

describe('ZpDirective.Data', () => {
  it('should have Data value', () => {
    expect(ZpDirective.Data).toBe('data');
  });

  it('should now have exactly 4 members', () => {
    const values = Object.values(ZpDirective);
    expect(values).toHaveLength(4);
  });

  it('should contain all expected members including Data', () => {
    const values = Object.values(ZpDirective);
    expect(values).toContain('none');
    expect(values).toContain('zp');
    expect(values).toContain('ram');
    expect(values).toContain('data');
  });

  it('should be usable as string literal', () => {
    const directive: ZpDirective = ZpDirective.Data;
    expect(directive).toBe('data');
  });

  it('should work in allocation decisions for data segment', () => {
    // @data variables go to data segment, not ZP or RAM
    const isDataSegment = (directive: ZpDirective): boolean => {
      return directive === ZpDirective.Data;
    };

    expect(isDataSegment(ZpDirective.Data)).toBe(true);
    expect(isDataSegment(ZpDirective.Zp)).toBe(false);
    expect(isDataSegment(ZpDirective.Ram)).toBe(false);
    expect(isDataSegment(ZpDirective.None)).toBe(false);
  });
});

// ============================================================================
// GlobalSlot Factory Tests
// ============================================================================

describe('createGlobalSlot', () => {
  it('should create a basic global slot with defaults', () => {
    const slot = createGlobalSlot('score', 'Game', 'zp', BUILTIN_TYPES.BYTE, 1);

    expect(slot.name).toBe('score');
    expect(slot.qualifiedName).toBe('Game.score');
    expect(slot.moduleName).toBe('Game');
    expect(slot.storageClass).toBe('zp');
    expect(slot.type).toBe(BUILTIN_TYPES.BYTE);
    expect(slot.size).toBe(1);
    expect(slot.address).toBe(0);
    expect(slot.isExported).toBe(false);
    expect(slot.isConst).toBe(false);
    expect(slot.initializer).toBeUndefined();
  });

  it('should create a slot with exported and const options', () => {
    const slot = createGlobalSlot('MAX_SPRITES', 'Game', 'data', BUILTIN_TYPES.BYTE, 1, {
      isExported: true,
      isConst: true,
    });

    expect(slot.isExported).toBe(true);
    expect(slot.isConst).toBe(true);
    expect(slot.storageClass).toBe('data');
  });

  it('should create a word-sized RAM slot', () => {
    const slot = createGlobalSlot('screenPtr', 'Game', 'ram', BUILTIN_TYPES.WORD, 2);

    expect(slot.size).toBe(2);
    expect(slot.storageClass).toBe('ram');
    expect(slot.qualifiedName).toBe('Game.screenPtr');
  });

  it('should create a default storage class slot', () => {
    const slot = createGlobalSlot('counter', 'Main', 'default', BUILTIN_TYPES.BYTE, 1);

    expect(slot.storageClass).toBe('default');
    expect(slot.qualifiedName).toBe('Main.counter');
  });

  it('should set address to 0 (unallocated)', () => {
    const slot = createGlobalSlot('x', 'M', 'zp', BUILTIN_TYPES.BYTE, 1);
    expect(slot.address).toBe(0);
  });
});

// ============================================================================
// GlobalAllocationResult Factory Tests
// ============================================================================

describe('createEmptyGlobalAllocationResult', () => {
  it('should create an empty result with success=true', () => {
    const pool = new ZpPool(C64_PLATFORM_CONFIG);
    const result = createEmptyGlobalAllocationResult(pool);

    expect(result.success).toBe(true);
    expect(result.globals.size).toBe(0);
    expect(result.zpPool).toBe(pool);
    expect(result.dataSegmentSize).toBe(0);
    expect(result.ramRegionSize).toBe(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should preserve the ZpPool reference', () => {
    const pool = new ZpPool(C64_PLATFORM_CONFIG);
    const result = createEmptyGlobalAllocationResult(pool);

    // The pool should be the same instance — important for ZP sharing
    expect(result.zpPool).toBe(pool);
  });
});

// ============================================================================
// Global Type Guard Tests
// ============================================================================

describe('GlobalSlot type guards', () => {
  const zpSlot = createGlobalSlot('a', 'M', 'zp', BUILTIN_TYPES.BYTE, 1);
  const ramSlot = createGlobalSlot('b', 'M', 'ram', BUILTIN_TYPES.BYTE, 1);
  const dataSlot = createGlobalSlot('c', 'M', 'data', BUILTIN_TYPES.BYTE, 1);
  const defaultSlot = createGlobalSlot('d', 'M', 'default', BUILTIN_TYPES.BYTE, 1);

  describe('isZpGlobal', () => {
    it('should return true for zp storage class', () => {
      expect(isZpGlobal(zpSlot)).toBe(true);
    });

    it('should return false for non-zp storage classes', () => {
      expect(isZpGlobal(ramSlot)).toBe(false);
      expect(isZpGlobal(dataSlot)).toBe(false);
      expect(isZpGlobal(defaultSlot)).toBe(false);
    });
  });

  describe('isRamGlobal', () => {
    it('should return true for ram storage class', () => {
      expect(isRamGlobal(ramSlot)).toBe(true);
    });

    it('should return true for default storage class (defaults to RAM)', () => {
      expect(isRamGlobal(defaultSlot)).toBe(true);
    });

    it('should return false for zp and data', () => {
      expect(isRamGlobal(zpSlot)).toBe(false);
      expect(isRamGlobal(dataSlot)).toBe(false);
    });
  });

  describe('isDataGlobal', () => {
    it('should return true for data storage class', () => {
      expect(isDataGlobal(dataSlot)).toBe(true);
    });

    it('should return false for non-data storage classes', () => {
      expect(isDataGlobal(zpSlot)).toBe(false);
      expect(isDataGlobal(ramSlot)).toBe(false);
      expect(isDataGlobal(defaultSlot)).toBe(false);
    });
  });
});

// ============================================================================
// Symbol Table Builder — Storage Class Metadata Tests
// ============================================================================

describe('SymbolTableBuilder storage class metadata', () => {
  it('should store @zp storage class in metadata', () => {
    const source = `module Test\n@zp let score: byte = 0`;
    const result = buildSymbolTable(source);

    expect(result.success).toBe(true);
    const symbol = result.symbolTable.lookup('score');
    expect(symbol).toBeDefined();
    // Should have both new storageClass and backward-compat zpDirective
    expect(symbol!.metadata?.get('storageClass')).toBe(TokenType.ZP);
    expect(symbol!.metadata?.get('zpDirective')).toBe(true);
  });

  it('should store @ram storage class in metadata', () => {
    const source = `module Test\n@ram let buffer: byte = 0`;
    const result = buildSymbolTable(source);

    expect(result.success).toBe(true);
    const symbol = result.symbolTable.lookup('buffer');
    expect(symbol).toBeDefined();
    expect(symbol!.metadata?.get('storageClass')).toBe(TokenType.RAM);
    // @ram should NOT set zpDirective
    expect(symbol!.metadata?.get('zpDirective')).toBeUndefined();
  });

  it('should store @data storage class in metadata', () => {
    const source = `module Test\n@data const SPRITE_DATA: byte = 42`;
    const result = buildSymbolTable(source);

    expect(result.success).toBe(true);
    const symbol = result.symbolTable.lookup('SPRITE_DATA');
    expect(symbol).toBeDefined();
    expect(symbol!.metadata?.get('storageClass')).toBe(TokenType.DATA);
    // @data should NOT set zpDirective
    expect(symbol!.metadata?.get('zpDirective')).toBeUndefined();
  });

  it('should NOT store storageClass metadata for variables without annotation', () => {
    const source = `module Test\nlet counter: byte = 0`;
    const result = buildSymbolTable(source);

    expect(result.success).toBe(true);
    const symbol = result.symbolTable.lookup('counter');
    expect(symbol).toBeDefined();
    expect(symbol!.metadata?.get('storageClass')).toBeUndefined();
    expect(symbol!.metadata?.get('zpDirective')).toBeUndefined();
  });
});

// ============================================================================
// @data Validation Tests
// ============================================================================

describe('@data validation', () => {
  it('should error when @data is used without const', () => {
    const source = `module Test\n@data let x: byte = 5`;
    const result = buildSymbolTable(source);

    // Should have an error about @data requiring const
    const errors = result.diagnostics.filter(d => d.code === DiagnosticCode.DATA_REQUIRES_CONST);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('const');
  });

  it('should error when @data const has no initializer', () => {
    const source = `module Test\n@data const x: byte`;
    const result = buildSymbolTable(source);

    // Should have an error about @data requiring initializer
    const errors = result.diagnostics.filter(d => d.code === DiagnosticCode.DATA_REQUIRES_INITIALIZER);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('initializer');
  });

  it('should succeed when @data const has an initializer', () => {
    const source = `module Test\n@data const SPRITE: byte = 255`;
    const result = buildSymbolTable(source);

    // Should have no @data-related errors
    const dataErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.DATA_REQUIRES_CONST || d.code === DiagnosticCode.DATA_REQUIRES_INITIALIZER,
    );
    expect(dataErrors).toHaveLength(0);
  });

  it('should report both errors when @data let without initializer', () => {
    const source = `module Test\n@data let x: byte`;
    const result = buildSymbolTable(source);

    // Should have BOTH errors: not const AND no initializer
    const constErrors = result.diagnostics.filter(d => d.code === DiagnosticCode.DATA_REQUIRES_CONST);
    const initErrors = result.diagnostics.filter(d => d.code === DiagnosticCode.DATA_REQUIRES_INITIALIZER);
    expect(constErrors).toHaveLength(1);
    expect(initErrors).toHaveLength(1);
  });

  it('should NOT error for @zp let (not @data)', () => {
    const source = `module Test\n@zp let score: byte = 0`;
    const result = buildSymbolTable(source);

    const dataErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.DATA_REQUIRES_CONST || d.code === DiagnosticCode.DATA_REQUIRES_INITIALIZER,
    );
    expect(dataErrors).toHaveLength(0);
  });

  it('should NOT error for @ram let (not @data)', () => {
    const source = `module Test\n@ram let buffer: byte = 0`;
    const result = buildSymbolTable(source);

    const dataErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.DATA_REQUIRES_CONST || d.code === DiagnosticCode.DATA_REQUIRES_INITIALIZER,
    );
    expect(dataErrors).toHaveLength(0);
  });
});
