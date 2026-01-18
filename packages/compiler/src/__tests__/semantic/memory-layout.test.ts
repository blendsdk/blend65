/**
 * Memory Layout Builder Tests
 *
 * Tests global memory allocation and conflict detection across modules.
 */

import { describe, it, expect } from 'vitest';
import { MemoryLayoutBuilder } from '../../semantic/memory-layout.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { Symbol, SymbolKind } from '../../semantic/symbol.js';
import { TypeSystem } from '../../semantic/type-system.js';
import { ControlFlowGraph } from '../../semantic/control-flow.js';
import type { ModuleAnalysisResult } from '../../semantic/analyzer.js';
import { SourceLocation } from '../../ast/base.js';
import { Parser } from '../../parser/parser.js';
import { Lexer } from '../../lexer/lexer.js';
import { VariableDecl } from '../../ast/nodes.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Helper: Create a dummy source location
 */
function createLocation(line: number = 1, col: number = 1): SourceLocation {
  return {
    source: 'test.bl65',
    start: { line, column: col, offset: 0 },
    end: { line, column: col + 1, offset: 1 },
  };
}

/**
 * Helper: Create a real VariableDecl using the parser
 * 
 * This uses the actual parser to create proper AST nodes instead of mocks.
 */
function createVariableDecl(name: string, storageClass: string | undefined): VariableDecl {
  // Map string storage class to TokenType
  const storageClassMap: Record<string, string> = {
    'zp': '@zp',
    'ram': '@ram',
    'data': '@data',
  };
  
  const storagePrefix = storageClass ? storageClassMap[storageClass] + ' ' : '';
  const source = `${storagePrefix}let ${name}: byte = 0;`;
  
  const lexer = new Lexer(source, 'test.bl65'); // Pass filename to lexer
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  
  const decl = program.getDeclarations()[0];
  if (!(decl instanceof VariableDecl)) {
    throw new Error(`Expected VariableDecl but got ${decl.constructor.name}`);
  }
  
  return decl;
}

/**
 * Helper: Create a module analysis result with specified symbols
 */
function createModuleResult(
  moduleName: string,
  symbols: Array<{ name: string; storageClass?: string; size?: number; isExported?: boolean }>
): ModuleAnalysisResult {
  const symbolTable = new SymbolTable();
  const rootScope = symbolTable.getRootScope();

  for (const sym of symbols) {
    const decl = createVariableDecl(sym.name, sym.storageClass);
    const symbol: Symbol = {
      name: sym.name,
      kind: SymbolKind.VARIABLE,
      declaration: decl,
      scope: rootScope,
      isExported: sym.isExported || false,
      isConst: false,
      type: {
        kind: 'primitive',
        name: sym.size === 2 ? 'word' : 'byte',
        size: sym.size || 1,
      },
    };
    symbolTable.declare(symbol);
  }

  return {
    moduleName,
    symbolTable,
    typeSystem: new TypeSystem(symbolTable),
    cfgs: new Map<string, ControlFlowGraph>(),
    diagnostics: [],
    success: true,
  };
}

describe('MemoryLayoutBuilder', () => {
  describe('Zero Page Allocation', () => {
    it('should allocate zero page variables', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'counter', storageClass: 'zp', size: 1 },
          { name: 'pointer', storageClass: 'zp', size: 2 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.zeroPageAllocation.size).toBe(2);
      expect(layout.statistics.zeroPageUsed).toBe(3); // 1 byte + 2 bytes
    });

    it('should detect zero page overflow', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      // Create many variables that exceed 112 bytes
      const symbols: Array<{ name: string; storageClass: string; size: number }> = [];
      for (let i = 0; i < 60; i++) {
        symbols.push({ name: `var${i}`, storageClass: 'zp', size: 2 }); // 60 * 2 = 120 bytes
      }

      modules.set('test', createModuleResult('test', symbols));

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(false);
      expect(layout.conflicts.length).toBeGreaterThan(0);
      expect(layout.conflicts[0].type).toBe('zp_overflow');
    });

    it('should allocate exactly 112 bytes without overflow', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      // 56 words = 112 bytes (exactly the limit)
      const symbols: Array<{ name: string; storageClass: string; size: number }> = [];
      for (let i = 0; i < 56; i++) {
        symbols.push({ name: `var${i}`, storageClass: 'zp', size: 2 });
      }

      modules.set('test', createModuleResult('test', symbols));

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.statistics.zeroPageUsed).toBe(112);
      expect(layout.conflicts.length).toBe(0);
    });

    it('should allocate zero page across multiple modules', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'module1',
        createModuleResult('module1', [
          { name: 'counter1', storageClass: 'zp', size: 1 },
          { name: 'pointer1', storageClass: 'zp', size: 2 },
        ])
      );

      modules.set(
        'module2',
        createModuleResult('module2', [
          { name: 'counter2', storageClass: 'zp', size: 1 },
          { name: 'pointer2', storageClass: 'zp', size: 2 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.zeroPageAllocation.size).toBe(4);
      expect(layout.statistics.zeroPageUsed).toBe(6); // 2 bytes + 2 bytes + 2 bytes
    });

    it('should allocate zero page variables in optimal order', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'byte1', storageClass: 'zp', size: 1 },
          { name: 'word1', storageClass: 'zp', size: 2 },
          { name: 'byte2', storageClass: 'zp', size: 1 },
          { name: 'word2', storageClass: 'zp', size: 2 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.statistics.zeroPageUsed).toBe(6);

      // Verify addresses are allocated (largest first for better packing)
      const allocations = Array.from(layout.zeroPageAllocation.values());
      expect(allocations.length).toBe(4);
      expect(allocations.every(a => a.address >= 0x90 && a.address <= 0xff)).toBe(true);
    });
  });

  describe('Memory Statistics', () => {
    it('should calculate zero page usage percentage', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      // Allocate 56 bytes (50% of 112 bytes)
      modules.set(
        'test',
        createModuleResult('test', [{ name: 'data', storageClass: 'zp', size: 56 }])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.statistics.zeroPageUsagePercent).toBe(50);
    });

    it('should track module count', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set('module1', createModuleResult('module1', []));
      modules.set('module2', createModuleResult('module2', []));
      modules.set('module3', createModuleResult('module3', []));

      const layout = builder.buildLayout(modules);

      expect(layout.statistics.moduleCount).toBe(3);
    });

    it('should calculate RAM usage', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'buffer', storageClass: 'ram', size: 100 },
          { name: 'data', storageClass: 'ram', size: 50 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.statistics.totalRamUsage).toBe(150);
    });

    it('should calculate data section usage', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'table', storageClass: 'data', size: 256 },
          { name: 'constants', storageClass: 'data', size: 64 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.statistics.totalDataUsage).toBe(320);
    });

    it('should handle mixed storage classes', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'zpVar', storageClass: 'zp', size: 2 },
          { name: 'ramVar', storageClass: 'ram', size: 100 },
          { name: 'dataVar', storageClass: 'data', size: 256 },
          { name: 'defaultVar', storageClass: undefined, size: 50 }, // Defaults to ram
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.statistics.zeroPageUsed).toBe(2);
      expect(layout.statistics.totalRamUsage).toBe(150); // 100 + 50
      expect(layout.statistics.totalDataUsage).toBe(256);
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty modules', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set('empty', createModuleResult('empty', []));

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.zeroPageAllocation.size).toBe(0);
      expect(layout.memoryMaps.size).toBe(0);
      expect(layout.conflicts.length).toBe(0);
      expect(layout.statistics.zeroPageUsed).toBe(0);
    });

    it('should handle no modules', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.statistics.moduleCount).toBe(0);
    });

    it('should handle modules with only non-zp variables', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'ramVar', storageClass: 'ram', size: 100 },
          { name: 'dataVar', storageClass: 'data', size: 200 },
        ])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.zeroPageAllocation.size).toBe(0);
      expect(layout.statistics.zeroPageUsed).toBe(0);
    });
  });

  describe('Symbol Metadata', () => {
    it('should preserve symbol metadata in allocations', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'exportedVar', storageClass: 'zp', size: 1, isExported: true },
          { name: 'privateVar', storageClass: 'zp', size: 1, isExported: false },
        ])
      );

      const layout = builder.buildLayout(modules);

      const allocations = Array.from(layout.zeroPageAllocation.values());
      const exportedVar = allocations.find(a => a.name === 'exportedVar');
      const privateVar = allocations.find(a => a.name === 'privateVar');

      expect(exportedVar?.isExported).toBe(true);
      expect(privateVar?.isExported).toBe(false);
      expect(exportedVar?.moduleName).toBe('test');
      expect(privateVar?.moduleName).toBe('test');
    });

    it('should include source locations in allocations', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [{ name: 'zpVar', storageClass: 'zp', size: 1 }])
      );

      const layout = builder.buildLayout(modules);

      const allocations = Array.from(layout.zeroPageAllocation.values());
      expect(allocations[0].location).toBeDefined();
      expect(allocations[0].location.start).toBeDefined();
      expect(allocations[0].location.end).toBeDefined();
      expect(allocations[0].location.start.line).toBeGreaterThan(0);
    });
  });

  describe('Zero Page Address Allocation', () => {
    it('should allocate addresses starting at $90', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [{ name: 'first', storageClass: 'zp', size: 1 }])
      );

      const layout = builder.buildLayout(modules);

      const allocations = Array.from(layout.zeroPageAllocation.values());
      expect(allocations[0].address).toBeGreaterThanOrEqual(0x90);
    });

    it('should allocate contiguous addresses', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'var1', storageClass: 'zp', size: 1 },
          { name: 'var2', storageClass: 'zp', size: 1 },
          { name: 'var3', storageClass: 'zp', size: 1 },
        ])
      );

      const layout = builder.buildLayout(modules);

      const allocations = Array.from(layout.zeroPageAllocation.values()).sort(
        (a, b) => a.address - b.address
      );

      // Verify no gaps (addresses should be contiguous)
      expect(allocations.length).toBe(3);
      expect(allocations[1].address - (allocations[0].address + allocations[0].size)).toBe(0);
      expect(allocations[2].address - (allocations[1].address + allocations[1].size)).toBe(0);
    });

    it('should respect variable sizes in allocation', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'test',
        createModuleResult('test', [
          { name: 'byte1', storageClass: 'zp', size: 1 },
          { name: 'word1', storageClass: 'zp', size: 2 },
        ])
      );

      const layout = builder.buildLayout(modules);

      const word1 = Array.from(layout.zeroPageAllocation.values()).find(a => a.name === 'word1');

      expect(word1?.size).toBe(2);
      expect(word1?.address).toBeDefined();
      expect(word1!.address + word1!.size).toBeLessThanOrEqual(0x100);
    });
  });

  describe('Multi-Module Zero Page', () => {
    it('should allocate zero page globally across modules', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      modules.set(
        'game',
        createModuleResult('game', [{ name: 'gameCounter', storageClass: 'zp', size: 1 }])
      );
      modules.set(
        'player',
        createModuleResult('player', [{ name: 'playerX', storageClass: 'zp', size: 1 }])
      );
      modules.set(
        'enemy',
        createModuleResult('enemy', [{ name: 'enemyCount', storageClass: 'zp', size: 1 }])
      );

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(true);
      expect(layout.zeroPageAllocation.size).toBe(3);

      // Verify each module's variables are allocated
      const gameVar = Array.from(layout.zeroPageAllocation.values()).find(
        a => a.moduleName === 'game'
      );
      const playerVar = Array.from(layout.zeroPageAllocation.values()).find(
        a => a.moduleName === 'player'
      );
      const enemyVar = Array.from(layout.zeroPageAllocation.values()).find(
        a => a.moduleName === 'enemy'
      );

      expect(gameVar).toBeDefined();
      expect(playerVar).toBeDefined();
      expect(enemyVar).toBeDefined();

      // All should have different addresses
      const addresses = [gameVar!.address, playerVar!.address, enemyVar!.address];
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);
    });

    it('should detect overflow when multiple modules exceed limit', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      // Each module uses 60 bytes, total 120 > 112
      const symbols1: Array<{ name: string; storageClass: string; size: number }> = [];
      const symbols2: Array<{ name: string; storageClass: string; size: number }> = [];

      for (let i = 0; i < 30; i++) {
        symbols1.push({ name: `var1_${i}`, storageClass: 'zp', size: 2 });
        symbols2.push({ name: `var2_${i}`, storageClass: 'zp', size: 2 });
      }

      modules.set('module1', createModuleResult('module1', symbols1));
      modules.set('module2', createModuleResult('module2', symbols2));

      const layout = builder.buildLayout(modules);

      expect(layout.success).toBe(false);
      expect(layout.conflicts.some(c => c.type === 'zp_overflow')).toBe(true);
    });
  });

  describe('Conflict Reporting', () => {
    it('should provide detailed overflow messages', () => {
      const builder = new MemoryLayoutBuilder();
      const modules = new Map<string, ModuleAnalysisResult>();

      const symbols: Array<{ name: string; storageClass: string; size: number }> = [];
      for (let i = 0; i < 60; i++) {
        symbols.push({ name: `overflow${i}`, storageClass: 'zp', size: 2 });
      }

      modules.set('test', createModuleResult('test', symbols));

      const layout = builder.buildLayout(modules);

      const overflowConflict = layout.conflicts.find(c => c.type === 'zp_overflow');
      expect(overflowConflict).toBeDefined();
      expect(overflowConflict!.message).toContain('Zero page overflow');
      expect(overflowConflict!.message).toContain('112 bytes');
    });
  });
});