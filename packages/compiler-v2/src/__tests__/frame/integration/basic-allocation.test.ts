/**
 * Integration Tests for Basic Frame Allocation
 *
 * Tests the complete SFA workflow:
 * - Source code → Lexer → Parser → SymbolTable → CallGraph → FrameAllocator
 *
 * Uses real implementations (no mocks) per testing philosophy.
 *
 * @module __tests__/frame/integration/basic-allocation.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { SymbolTableBuilder } from '../../../semantic/visitors/symbol-table-builder.js';
import { CallGraph, CallGraphBuilder } from '../../../semantic/call-graph.js';
import { Program } from '../../../ast/index.js';
import {
  FrameAllocator,
  createFrameAllocator,
  FrameAllocationResult,
  FrameDiagnosticCode,
} from '../../../frame/allocator/frame-allocator.js';
import {
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
  createCustomPlatform,
} from '../../../frame/platform.js';
import { DiagnosticSeverity, SlotLocation } from '../../../frame/enums.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Parse source code into a Program AST.
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}

/**
 * Build a SymbolTable from a Program.
 */
function buildSymbolTable(program: Program): SymbolTable {
  const builder = new SymbolTableBuilder();
  const result = builder.build(program);
  return result.symbolTable;
}

/**
 * Build a CallGraph from a Program and SymbolTable.
 */
function buildCallGraph(program: Program, symbolTable: SymbolTable): CallGraph {
  const builder = new CallGraphBuilder(symbolTable);
  return builder.build(program);
}

/**
 * Full allocation pipeline: source → allocation result.
 */
function allocateFromSource(
  source: string,
  allocator: FrameAllocator
): { program: Program; symbolTable: SymbolTable; callGraph: CallGraph; result: FrameAllocationResult } {
  const program = parseSource(source);
  const symbolTable = buildSymbolTable(program);
  const callGraph = buildCallGraph(program, symbolTable);
  const result = allocator.allocate(program, callGraph, symbolTable);
  return { program, symbolTable, callGraph, result };
}

// ============================================================================
// Tests
// ============================================================================

describe('Frame Allocator Integration', () => {
  let allocator: FrameAllocator;

  beforeEach(() => {
    allocator = createFrameAllocator(C64_PLATFORM_CONFIG);
  });

  // ==========================================================================
  // Basic Allocation Scenarios
  // ==========================================================================

  describe('Basic Allocation Scenarios', () => {
    it('should allocate a single function with local variables', () => {
      const source = `
        function main(): void {
          let counter: byte = 0;
          let total: word = 0;
          counter = counter + 1;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      // Allocation should succeed
      expect(result.success).toBe(true);
      expect(result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(0);

      // Should have one frame
      expect(result.frameMap.size).toBe(1);
      expect(result.frameMap.has('main')).toBe(true);

      // Check frame details
      const frame = result.frameMap.get('main')!;
      expect(frame.functionName).toBe('main');
      expect(frame.slots.length).toBe(2); // counter + total
      expect(frame.totalSize).toBeGreaterThan(0);

      // Check stats
      expect(result.stats.functionCount).toBe(1);
      expect(result.stats.framesAllocated).toBe(1);
      expect(result.stats.totalSlotCount).toBe(2);
    });

    it('should allocate multiple independent functions', () => {
      const source = `
        function init(): void {
          let x: byte = 0;
        }

        function update(): void {
          let y: byte = 0;
          let z: byte = 0;
        }

        function render(): void {
          let color: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      // Allocation should succeed
      expect(result.success).toBe(true);

      // Should have three frames
      expect(result.frameMap.size).toBe(3);
      expect(result.frameMap.has('init')).toBe(true);
      expect(result.frameMap.has('update')).toBe(true);
      expect(result.frameMap.has('render')).toBe(true);

      // Each function should have correct slot count
      expect(result.frameMap.get('init')!.slots.length).toBe(1);
      expect(result.frameMap.get('update')!.slots.length).toBe(2);
      expect(result.frameMap.get('render')!.slots.length).toBe(1);

      // Check stats
      expect(result.stats.functionCount).toBe(3);
      expect(result.stats.framesAllocated).toBe(3);
      expect(result.stats.totalSlotCount).toBe(4);
    });

    it('should allocate function with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte {
          let sum: byte = a + b;
          return sum;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(1);

      const frame = result.frameMap.get('add')!;
      // Parameters + local variable (+ return value slot if allocated)
      expect(frame.slots.length).toBeGreaterThanOrEqual(3); // a, b, sum (+ possibly return slot)
      expect(frame.totalSize).toBeGreaterThan(0);
    });

    it('should handle function with no local variables', () => {
      const source = `
        function nop(): void {
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(1);

      const frame = result.frameMap.get('nop')!;
      expect(frame.slots.length).toBe(0);
      expect(frame.totalSize).toBe(0);
    });
  });

  // ==========================================================================
  // Call Graph Scenarios
  // ==========================================================================

  describe('Call Graph Scenarios', () => {
    it('should allocate caller and callee functions', () => {
      const source = `
        function helper(): byte {
          let temp: byte = 42;
          return temp;
        }

        function main(): void {
          let result: byte = helper();
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(2);

      // Both functions should have frames
      expect(result.frameMap.has('main')).toBe(true);
      expect(result.frameMap.has('helper')).toBe(true);

      // Frames should have distinct base addresses
      const mainBase = result.frameMap.get('main')!.baseAddress;
      const helperBase = result.frameMap.get('helper')!.baseAddress;
      expect(mainBase).not.toBe(helperBase);
    });

    it('should allocate deep call chain', () => {
      const source = `
        function level3(): byte {
          let x: byte = 3;
          return x;
        }

        function level2(): byte {
          let x: byte = level3();
          return x;
        }

        function level1(): byte {
          let x: byte = level2();
          return x;
        }

        function main(): void {
          let result: byte = level1();
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(4);

      // All functions should have distinct base addresses
      const addresses = new Set<number>();
      for (const frame of result.frameMap.values()) {
        addresses.add(frame.baseAddress);
      }
      expect(addresses.size).toBe(4);
    });

    it('should detect direct recursion', () => {
      const source = `
        function recursive(): void {
          recursive();
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === FrameDiagnosticCode.RECURSION)).toBe(true);
    });

    it('should detect indirect recursion (A → B → A)', () => {
      const source = `
        function funcB(): void {
          funcA();
        }

        function funcA(): void {
          funcB();
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === FrameDiagnosticCode.RECURSION)).toBe(true);
    });
  });

  // ==========================================================================
  // Frame Region Scenarios
  // ==========================================================================

  describe('Frame Region Scenarios', () => {
    it('should assign sequential addresses in frame region', () => {
      const source = `
        function alpha(): void {
          let a: byte = 0;
        }

        function beta(): void {
          let b: byte = 0;
        }

        function gamma(): void {
          let c: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      // Frames should be allocated in alphabetical order
      const alpha = result.frameMap.get('alpha')!;
      const beta = result.frameMap.get('beta')!;
      const gamma = result.frameMap.get('gamma')!;

      // Alpha starts at frame region start
      expect(alpha.baseAddress).toBe(C64_PLATFORM_CONFIG.frameRegionStart);

      // Beta starts after alpha
      expect(beta.baseAddress).toBe(alpha.baseAddress + alpha.totalSize);

      // Gamma starts after beta
      expect(gamma.baseAddress).toBe(beta.baseAddress + beta.totalSize);
    });

    it('should detect frame region overflow with tiny frame region', () => {
      // Create config with very small frame region and minimal ZP
      // to force variables into frame region
      const tinyConfig = createCustomPlatform({
        displayName: 'Tiny Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0204, // Only 4 bytes!
        zpStart: 0x02,
        zpEnd: 0x03, // Only 1 byte of ZP!
      });

      const tinyAllocator = createFrameAllocator(tinyConfig);

      // Even a single function with a few variables should overflow
      const source = `
        function func1(): void {
          let a: byte = 0;
          let b: byte = 0;
          let c: byte = 0;
          let d: byte = 0;
          let e: byte = 0;
          let f: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, tinyAllocator);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === FrameDiagnosticCode.FRAME_OVERFLOW)).toBe(true);
    });

    it('should track frame region utilization', () => {
      const source = `
        function test(): void {
          let a: byte = 0;
          let b: word = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      // Frame region stats should be populated
      expect(result.stats.frameRegionBytesUsed).toBeGreaterThan(0);
      expect(result.stats.frameRegionBytesAvailable).toBe(C64_PLATFORM_CONFIG.frameRegionSize);
      expect(result.stats.frameRegionUtilization).toBeGreaterThan(0);
      expect(result.stats.frameRegionUtilization).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // ZP Allocation Scenarios
  // ==========================================================================

  describe('ZP Allocation Scenarios', () => {
    it('should populate ZP allocation summary', () => {
      const source = `
        function main(): void {
          let x: byte = 0;
          let y: word = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      // ZP summary should exist
      expect(result.zpAllocationSummary).toBeDefined();

      // Stats should show ZP info
      expect(result.stats.zpBytesAvailable).toBe(C64_PLATFORM_CONFIG.zpAvailable);
      expect(result.stats.zpSlotCount).toBeGreaterThanOrEqual(0);
    });

    it('should track ZP utilization stats', () => {
      const source = `
        function main(): void {
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = 3;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      // ZP utilization should be calculated
      expect(result.stats.zpBytesUsed).toBeGreaterThanOrEqual(0);
      expect(result.stats.zpUtilization).toBeGreaterThanOrEqual(0);
      expect(result.stats.zpUtilization).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Platform Configuration Scenarios
  // ==========================================================================

  describe('Platform Configuration Scenarios', () => {
    it('should work with C64 platform config', () => {
      const c64Allocator = createFrameAllocator(C64_PLATFORM_CONFIG);

      const source = `
        function main(): void {
          let x: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, c64Allocator);

      expect(result.success).toBe(true);
      expect(result.stats.frameRegionBytesAvailable).toBe(C64_PLATFORM_CONFIG.frameRegionSize);
      expect(result.stats.zpBytesAvailable).toBe(C64_PLATFORM_CONFIG.zpAvailable);
    });

    it('should work with X16 platform config', () => {
      const x16Allocator = createFrameAllocator(X16_PLATFORM_CONFIG);

      const source = `
        function main(): void {
          let x: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, x16Allocator);

      expect(result.success).toBe(true);
      expect(result.stats.frameRegionBytesAvailable).toBe(X16_PLATFORM_CONFIG.frameRegionSize);
      expect(result.stats.zpBytesAvailable).toBe(X16_PLATFORM_CONFIG.zpAvailable);
    });

    it('should work with custom platform config', () => {
      const customConfig = createCustomPlatform({
        displayName: 'Custom Test',
        frameRegionStart: 0x0300,
        frameRegionEnd: 0x0500, // 512 bytes
        zpStart: 0x02,
        zpEnd: 0x34, // 50 bytes
      });

      const customAllocator = createFrameAllocator(customConfig);

      const source = `
        function main(): void {
          let x: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, customAllocator);

      expect(result.success).toBe(true);
      expect(result.stats.frameRegionBytesAvailable).toBe(512);
      expect(result.stats.zpBytesAvailable).toBe(50);

      // Frame should start at custom region start
      const frame = result.frameMap.get('main')!;
      expect(frame.baseAddress).toBe(0x0300);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty program (no functions)', () => {
      const source = `
        // Empty program
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(0);
      expect(result.stats.functionCount).toBe(0);
      expect(result.stats.framesAllocated).toBe(0);
    });

    it('should handle function with many variables', () => {
      const source = `
        function manyVars(): void {
          let a: byte = 0;
          let b: byte = 0;
          let c: byte = 0;
          let d: byte = 0;
          let e: byte = 0;
          let f: word = 0;
          let g: word = 0;
          let h: word = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      const frame = result.frameMap.get('manyVars')!;
      expect(frame.slots.length).toBe(8);
      expect(frame.totalSize).toBeGreaterThan(0);
    });

    it('should maintain deterministic allocation order', () => {
      const source = `
        function zeta(): void { let z: byte = 0; }
        function alpha(): void { let a: byte = 0; }
        function beta(): void { let b: byte = 0; }
      `;

      // Run allocation multiple times
      const results: FrameAllocationResult[] = [];
      for (let i = 0; i < 3; i++) {
        const freshAllocator = createFrameAllocator(C64_PLATFORM_CONFIG);
        const { result } = allocateFromSource(source, freshAllocator);
        results.push(result);
      }

      // All allocations should produce identical base addresses
      for (let i = 1; i < results.length; i++) {
        for (const funcName of results[0].frameMap.keys()) {
          expect(results[i].frameMap.get(funcName)!.baseAddress).toBe(
            results[0].frameMap.get(funcName)!.baseAddress
          );
        }
      }

      // Verify alphabetical order: alpha < beta < zeta
      const alpha = results[0].frameMap.get('alpha')!;
      const beta = results[0].frameMap.get('beta')!;
      const zeta = results[0].frameMap.get('zeta')!;

      expect(alpha.baseAddress).toBeLessThan(beta.baseAddress);
      expect(beta.baseAddress).toBeLessThan(zeta.baseAddress);
    });

    it('should skip stub functions', () => {
      const source = `
        // Stub declaration (no body)
        stub function external(): void;

        function main(): void {
          external();
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      // Only main should have a frame (external is stub)
      expect(result.frameMap.size).toBe(1);
      expect(result.frameMap.has('main')).toBe(true);
      expect(result.frameMap.has('external')).toBe(false);
    });

    it('should allocate slots with correct locations', () => {
      const source = `
        function test(): void {
          let x: byte = 0;
          let y: word = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.success).toBe(true);

      const frame = result.frameMap.get('test')!;

      // Each slot should have a valid location
      for (const slot of frame.slots) {
        expect([SlotLocation.ZeroPage, SlotLocation.FrameRegion]).toContain(slot.location);
      }
    });
  });

  // ==========================================================================
  // Statistics Verification
  // ==========================================================================

  describe('Statistics Verification', () => {
    it('should calculate correct function count', () => {
      const source = `
        function f1(): void { let a: byte = 0; }
        function f2(): void { let b: byte = 0; }
        function f3(): void { let c: byte = 0; }
        function f4(): void { let d: byte = 0; }
        function f5(): void { let e: byte = 0; }
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.stats.functionCount).toBe(5);
      expect(result.stats.framesAllocated).toBe(5);
    });

    it('should calculate total slot count correctly', () => {
      const source = `
        function a(): void { let x: byte = 0; }           // 1 slot
        function b(): void { let y: byte = 0; let z: byte = 0; }  // 2 slots
        function c(): void { let w: word = 0; }           // 1 slot
      `;

      const { result } = allocateFromSource(source, allocator);

      expect(result.stats.totalSlotCount).toBe(4);
    });

    it('should show zero coalescing stats in basic allocation', () => {
      const source = `
        function main(): void {
          let x: byte = 0;
        }
      `;

      const { result } = allocateFromSource(source, allocator);

      // Coalescing is Phase 3 - should be 0 in basic allocation
      expect(result.stats.coalesceBytesSaved).toBe(0);
      expect(result.stats.coalesceGroupCount).toBe(0);
    });
  });

  // ==========================================================================
  // Reset and Reuse
  // ==========================================================================

  describe('Reset and Reuse', () => {
    it('should allow allocator reset and reuse', () => {
      const source1 = `
        function first(): void {
          let a: byte = 0;
        }
      `;

      const source2 = `
        function second(): void {
          let b: byte = 0;
        }
      `;

      // First allocation
      const result1 = allocateFromSource(source1, allocator).result;
      expect(result1.success).toBe(true);
      expect(result1.frameMap.has('first')).toBe(true);

      // Reset and second allocation
      allocator.reset();
      const result2 = allocateFromSource(source2, allocator).result;
      expect(result2.success).toBe(true);
      expect(result2.frameMap.has('second')).toBe(true);

      // Results should be independent
      expect(result2.frameMap.has('first')).toBe(false);
    });
  });
});