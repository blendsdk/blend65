/**
 * Integration Tests: Global Variable Pipeline Integration
 *
 * Tests the integration between GlobalAllocator, FrameAllocator,
 * FramePhase, and GlobalSymbolTable for global variable support.
 *
 * Key integration points tested:
 * 1. FrameAllocator accepts and uses a pre-used ZP pool
 * 2. ZP pool sharing prevents address conflicts between globals and locals
 * 3. GlobalSymbolTable stores and retrieves allocated global slots
 * 4. FramePhase orchestrates global + function-local allocation
 */

import { describe, it, expect } from 'vitest';
import { FrameAllocator } from '../../../frame/allocator/frame-allocator.js';
import { GlobalAllocator } from '../../../frame/allocator/global-allocator.js';
import { ZpPool } from '../../../frame/allocator/zp-pool.js';
import { TEST_PLATFORM_CONFIG, C64_PLATFORM_CONFIG } from '../../../frame/platform.js';
import { GlobalSymbolTable } from '../../../semantic/global-symbol-table.js';
import { Program, ModuleDecl } from '../../../ast/program.js';
import { VariableDecl } from '../../../ast/declarations.js';
import { LiteralExpression } from '../../../ast/expressions.js';
import { TokenType } from '../../../lexer/types.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';
import { createGlobalSlot, createEmptyGlobalAllocationResult } from '../../../frame/types-global.js';
import { CallGraph } from '../../../semantic/call-graph.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import type { SourceLocation } from '../../../lexer/types.js';
import type { GlobalAllocationResult } from '../../../frame/types-global.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates a test SourceLocation */
function loc(): SourceLocation {
  return { line: 1, column: 1, offset: 0, length: 0 };
}

/** Creates a Program AST with given declarations */
function createProgram(moduleName: string, declarations: any[]): Program {
  const moduleDecl = new ModuleDecl(moduleName.split('.'), loc(), false);
  return new Program(moduleDecl, declarations, loc());
}

/** Creates a VariableDecl with optional storage class */
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
  const init = options?.initializer ?? new LiteralExpression(0, 'number', loc());
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
// Tests: FrameAllocator with Shared ZP Pool
// ============================================================================

describe('FrameAllocator: Shared ZP Pool Integration', () => {
  it('should accept a pre-used ZP pool in constructor', () => {
    // Pre-allocate some bytes in the ZP pool (simulating GlobalAllocator)
    const pool = new ZpPool(TEST_PLATFORM_CONFIG);
    const preAlloc = pool.allocate(3); // Allocate 3 bytes for a global
    expect(preAlloc.success).toBe(true);

    // Create FrameAllocator with the pre-used pool
    const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG, undefined, pool);

    // The ZP allocator inside should use the same pool
    const zpAllocator = allocator.getZpAllocator();
    const zpPool = zpAllocator.getPool();

    // Pool should show the pre-allocated bytes as used
    const stats = zpPool.getStats();
    expect(stats.bytesUsed).toBe(3);
  });

  it('should NOT reset shared ZP pool during allocation', () => {
    // Simulate GlobalAllocator allocating a @zp global
    const pool = new ZpPool(TEST_PLATFORM_CONFIG);
    const globalAddr = pool.allocate(2); // 2-byte word global
    expect(globalAddr.success).toBe(true);
    const usedBefore = pool.getStats().bytesUsed;
    expect(usedBefore).toBe(2);

    // Create FrameAllocator with shared pool
    const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG, undefined, pool);

    // Allocate function frames (empty program = no functions)
    const emptyProgram = createProgram('test', []);
    const result = allocator.allocate(emptyProgram, new CallGraph(), new SymbolTable());

    // After allocation, the pool should still have the global's 2 bytes allocated
    const usedAfter = pool.getStats().bytesUsed;
    expect(usedAfter).toBeGreaterThanOrEqual(usedBefore);
    expect(result.success).toBe(true);
  });

  it('should reset ZP pool when NOT using shared pool', () => {
    // Standard FrameAllocator (no shared pool)
    const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG);

    // The internal pool should be fresh (0 bytes used)
    const zpPool = allocator.getZpAllocator().getPool();
    expect(zpPool.getStats().bytesUsed).toBe(0);
  });
});

// ============================================================================
// Tests: GlobalAllocator → FrameAllocator ZP Pool Flow
// ============================================================================

describe('GlobalAllocator → FrameAllocator ZP Pool Flow', () => {
  it('should prevent address conflicts between global and local @zp variables', () => {
    // Step 1: GlobalAllocator allocates a @zp global
    const globalAllocator = new GlobalAllocator(TEST_PLATFORM_CONFIG);
    const programWithGlobal = createProgram('Game', [
      createVarDecl('score', 'byte', { storageClass: TokenType.ZP }),
    ]);
    const globalResult = globalAllocator.allocate([programWithGlobal]);

    expect(globalResult.success).toBe(true);
    expect(globalResult.globals.size).toBe(1);

    // Get the address assigned to the global
    const scoreSlot = globalResult.globals.get('Game.score');
    expect(scoreSlot).toBeDefined();
    const globalAddr = scoreSlot!.address;

    // Step 2: FrameAllocator uses the same ZP pool
    const frameAllocator = new FrameAllocator(
      TEST_PLATFORM_CONFIG,
      undefined,
      globalResult.zpPool,
    );

    // The ZP pool should show the global's byte as already allocated
    const zpPool = frameAllocator.getZpAllocator().getPool();
    expect(zpPool.isAllocated(globalAddr)).toBe(true);

    // Any future local @zp allocations won't conflict with this address
    const localAlloc = zpPool.allocate(1);
    expect(localAlloc.success).toBe(true);
    expect(localAlloc.address).not.toBe(globalAddr);
  });
});

// ============================================================================
// Tests: GlobalSymbolTable Global Allocation Integration
// ============================================================================

describe('GlobalSymbolTable: Global Allocation Integration', () => {
  it('should store and retrieve global slots via applyGlobalAllocation', () => {
    const table = new GlobalSymbolTable();

    // Create a mock GlobalAllocationResult with two slots
    const zpPool = new ZpPool(TEST_PLATFORM_CONFIG);
    const slot1 = createGlobalSlot('score', 'Game', 'zp', BUILTIN_TYPES.BYTE, 1);
    slot1.address = 0x10;
    const slot2 = createGlobalSlot('lives', 'Game', 'ram', BUILTIN_TYPES.BYTE, 1);
    slot2.address = 0x0800;

    const result: GlobalAllocationResult = {
      success: true,
      globals: new Map([
        ['Game.score', slot1],
        ['Game.lives', slot2],
      ]),
      zpPool,
      dataSegmentSize: 0,
      ramRegionSize: 1,
      diagnostics: [],
    };

    table.applyGlobalAllocation(result);

    // Retrieve by qualified name
    const foundScore = table.getGlobalSlot('Game.score');
    expect(foundScore).toBeDefined();
    expect(foundScore!.address).toBe(0x10);
    expect(foundScore!.storageClass).toBe('zp');

    const foundLives = table.getGlobalSlot('Game.lives');
    expect(foundLives).toBeDefined();
    expect(foundLives!.address).toBe(0x0800);
  });

  it('should retrieve global slot by module and variable name', () => {
    const table = new GlobalSymbolTable();
    const zpPool = new ZpPool(TEST_PLATFORM_CONFIG);
    const slot = createGlobalSlot('counter', 'Utils', 'ram', BUILTIN_TYPES.WORD, 2);
    slot.address = 0x0200;

    const result: GlobalAllocationResult = {
      success: true,
      globals: new Map([['Utils.counter', slot]]),
      zpPool,
      dataSegmentSize: 0,
      ramRegionSize: 2,
      diagnostics: [],
    };

    table.applyGlobalAllocation(result);

    const found = table.getGlobalSlotByName('Utils', 'counter');
    expect(found).toBeDefined();
    expect(found!.address).toBe(0x0200);
    expect(found!.size).toBe(2);
  });

  it('should find global slot by simple variable name', () => {
    const table = new GlobalSymbolTable();
    const zpPool = new ZpPool(TEST_PLATFORM_CONFIG);
    const slot = createGlobalSlot('highScore', 'Game', 'zp', BUILTIN_TYPES.WORD, 2);
    slot.address = 0x20;

    const result: GlobalAllocationResult = {
      success: true,
      globals: new Map([['Game.highScore', slot]]),
      zpPool,
      dataSegmentSize: 0,
      ramRegionSize: 0,
      diagnostics: [],
    };

    table.applyGlobalAllocation(result);

    const found = table.findGlobalSlotBySimpleName('highScore');
    expect(found).toBeDefined();
    expect(found!.qualifiedName).toBe('Game.highScore');
  });

  it('should return undefined for non-existent global slot', () => {
    const table = new GlobalSymbolTable();
    expect(table.getGlobalSlot('Game.nonexistent')).toBeUndefined();
    expect(table.findGlobalSlotBySimpleName('nonexistent')).toBeUndefined();
  });

  it('should track hasGlobalSlots correctly', () => {
    const table = new GlobalSymbolTable();
    expect(table.hasGlobalSlots()).toBe(false);

    const zpPool = new ZpPool(TEST_PLATFORM_CONFIG);
    const slot = createGlobalSlot('x', 'M', 'ram', BUILTIN_TYPES.BYTE, 1);

    table.applyGlobalAllocation({
      success: true,
      globals: new Map([['M.x', slot]]),
      zpPool,
      dataSegmentSize: 0,
      ramRegionSize: 1,
      diagnostics: [],
    });

    expect(table.hasGlobalSlots()).toBe(true);
  });

  it('should return all global slots as a new map', () => {
    const table = new GlobalSymbolTable();
    const zpPool = new ZpPool(TEST_PLATFORM_CONFIG);
    const slot1 = createGlobalSlot('a', 'M', 'zp', BUILTIN_TYPES.BYTE, 1);
    const slot2 = createGlobalSlot('b', 'M', 'ram', BUILTIN_TYPES.WORD, 2);

    table.applyGlobalAllocation({
      success: true,
      globals: new Map([['M.a', slot1], ['M.b', slot2]]),
      zpPool,
      dataSegmentSize: 0,
      ramRegionSize: 2,
      diagnostics: [],
    });

    const allSlots = table.getAllGlobalSlots();
    expect(allSlots.size).toBe(2);
    expect(allSlots.get('M.a')).toBeDefined();
    expect(allSlots.get('M.b')).toBeDefined();

    // Should be a copy, not the original map
    allSlots.delete('M.a');
    expect(table.getAllGlobalSlots().size).toBe(2); // Original unchanged
  });
});

// ============================================================================
// Tests: FrameAllocationResult includes globalAllocation
// ============================================================================

describe('FrameAllocationResult: globalAllocation field', () => {
  it('should support optional globalAllocation field', () => {
    // Standard FrameAllocationResult without globals (backward compat)
    const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG);
    const emptyProgram = createProgram('test', []);

    const result = allocator.allocate(emptyProgram, new CallGraph(), new SymbolTable());

    // globalAllocation is undefined by default (backward compatible)
    expect(result.globalAllocation).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
