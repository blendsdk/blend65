/**
 * Frame Allocator Tests
 *
 * Tests for the main FrameAllocator class which orchestrates
 * Static Frame Allocation (SFA).
 *
 * Tests use real implementations (no mocks) per testing philosophy:
 * - Real Lexer and Parser
 * - Real SymbolTable and CallGraph
 * - Real FrameAllocator components
 *
 * @module __tests__/frame/frame-allocator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrameAllocator,
  FrameDiagnosticCode,
  FrameAllocationResult,
  createFrameAllocator,
  createEmptyAllocationStats,
} from '../../frame/allocator/frame-allocator.js';
import { C64_PLATFORM_CONFIG, TEST_PLATFORM_CONFIG, createCustomPlatform } from '../../frame/platform.js';
import { DiagnosticSeverity } from '../../frame/enums.js';
import { CallGraph } from '../../semantic/call-graph.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { Program } from '../../ast/program.js';

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
 * Build a call graph for source code using manual construction.
 * This mimics what CallGraphBuilder would do, but simplified for tests.
 */
function buildCallGraph(calls: Array<{ caller: string; callee: string }>): CallGraph {
  const graph = new CallGraph();
  // Create a dummy location
  const loc = { line: 1, column: 1, offset: 0, file: 'test.blend' };

  for (const { caller, callee } of calls) {
    graph.addCall(caller, callee, loc);
  }

  return graph;
}

/**
 * Create an empty call graph (no calls between functions).
 */
function emptyCallGraph(): CallGraph {
  return new CallGraph();
}

// ============================================================================
// Tests: Constructor and Configuration
// ============================================================================

describe('FrameAllocator', () => {
  describe('constructor', () => {
    it('should create allocator with default C64 config', () => {
      const allocator = new FrameAllocator();
      expect(allocator.getConfig()).toBe(C64_PLATFORM_CONFIG);
    });

    it('should create allocator with custom config', () => {
      const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG);
      expect(allocator.getConfig()).toBe(TEST_PLATFORM_CONFIG);
    });

    it('should create allocator with symbol table', () => {
      const symbolTable = new SymbolTable();
      const allocator = new FrameAllocator(C64_PLATFORM_CONFIG, symbolTable);
      expect(allocator.getConfig()).toBe(C64_PLATFORM_CONFIG);
    });
  });

  describe('accessors', () => {
    it('should provide access to frame calculator', () => {
      const allocator = new FrameAllocator();
      expect(allocator.getCalculator()).toBeDefined();
    });

    it('should provide access to ZP allocator', () => {
      const allocator = new FrameAllocator();
      expect(allocator.getZpAllocator()).toBeDefined();
    });

    it('should allow reset', () => {
      const allocator = new FrameAllocator();
      // Should not throw
      expect(() => allocator.reset()).not.toThrow();
    });
  });
});

// ============================================================================
// Tests: Recursion Detection
// ============================================================================

describe('FrameAllocator - Recursion Detection', () => {
  let allocator: FrameAllocator;

  beforeEach(() => {
    allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
  });

  describe('checkRecursion', () => {
    it('should detect direct recursion', () => {
      // foo calls foo
      const callGraph = buildCallGraph([
        { caller: 'foo', callee: 'foo' },
      ]);

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(FrameDiagnosticCode.RECURSION);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toContain('Direct recursion');
      expect(diagnostics[0].message).toContain('foo');
    });

    it('should detect indirect recursion (2-function cycle)', () => {
      // foo calls bar, bar calls foo
      const callGraph = buildCallGraph([
        { caller: 'foo', callee: 'bar' },
        { caller: 'bar', callee: 'foo' },
      ]);

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      expect(diagnostics[0].code).toBe(FrameDiagnosticCode.RECURSION);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toContain('Indirect recursion');
    });

    it('should detect indirect recursion (3-function cycle)', () => {
      // foo -> bar -> baz -> foo
      const callGraph = buildCallGraph([
        { caller: 'foo', callee: 'bar' },
        { caller: 'bar', callee: 'baz' },
        { caller: 'baz', callee: 'foo' },
      ]);

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      expect(diagnostics[0].code).toBe(FrameDiagnosticCode.RECURSION);
      expect(diagnostics[0].message).toContain('Indirect recursion');
    });

    it('should return no diagnostics for acyclic call graph', () => {
      // main -> helper -> utility (no cycles)
      const callGraph = buildCallGraph([
        { caller: 'main', callee: 'helper' },
        { caller: 'helper', callee: 'utility' },
        { caller: 'main', callee: 'utility' },
      ]);

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics).toHaveLength(0);
    });

    it('should return no diagnostics for empty call graph', () => {
      const callGraph = emptyCallGraph();

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics).toHaveLength(0);
    });

    it('should include context with cycle path', () => {
      const callGraph = buildCallGraph([
        { caller: 'foo', callee: 'bar' },
        { caller: 'bar', callee: 'foo' },
      ]);

      const diagnostics = allocator.checkRecursion(callGraph);

      expect(diagnostics[0].context).toBeDefined();
      expect(diagnostics[0].context!.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// Tests: Basic Allocation
// ============================================================================

describe('FrameAllocator - Basic Allocation', () => {
  let allocator: FrameAllocator;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    allocator = new FrameAllocator(C64_PLATFORM_CONFIG, symbolTable);
  });

  describe('allocate with simple functions', () => {
    it('should allocate frames for a single function', () => {
      const source = `
        function main() {
          let x: byte = 0;
        }
      `;
      const program = parseSource(source);
      const callGraph = emptyCallGraph();

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(1);
      expect(result.frameMap.has('main')).toBe(true);
    });

    it('should allocate frames for multiple functions', () => {
      const source = `
        function main() {
          let a: byte = 0;
        }

        function helper() {
          let b: byte = 1;
        }
      `;
      const program = parseSource(source);
      const callGraph = emptyCallGraph();

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(2);
      expect(result.frameMap.has('main')).toBe(true);
      expect(result.frameMap.has('helper')).toBe(true);
    });

    it('should assign base addresses starting from frame region start', () => {
      const source = `
        function main() {
          let x: byte = 0;
        }
      `;
      const program = parseSource(source);
      const callGraph = emptyCallGraph();

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(true);
      const mainFrame = result.frameMap.get('main');
      expect(mainFrame).toBeDefined();
      expect(mainFrame!.baseAddress).toBe(C64_PLATFORM_CONFIG.frameRegionStart);
    });

    it('should assign sequential addresses to multiple functions (alphabetical order)', () => {
      const source = `
        function aaa() {
          let x: byte = 0;
        }

        function bbb() {
          let y: byte = 1;
        }
      `;
      const program = parseSource(source);
      const callGraph = emptyCallGraph();

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(true);

      const aaaFrame = result.frameMap.get('aaa');
      const bbbFrame = result.frameMap.get('bbb');

      expect(aaaFrame).toBeDefined();
      expect(bbbFrame).toBeDefined();

      // aaa comes first alphabetically
      expect(aaaFrame!.baseAddress).toBe(C64_PLATFORM_CONFIG.frameRegionStart);
      // bbb comes after aaa
      expect(bbbFrame!.baseAddress).toBe(aaaFrame!.baseAddress + aaaFrame!.totalSize);
    });

    it('should skip stub functions (no body)', () => {
      const source = `
        stub function external();

        function main() {
          let x: byte = 0;
        }
      `;
      const program = parseSource(source);
      const callGraph = emptyCallGraph();

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(true);
      expect(result.frameMap.size).toBe(1);
      expect(result.frameMap.has('external')).toBe(false);
      expect(result.frameMap.has('main')).toBe(true);
    });
  });

  describe('allocate with recursion errors', () => {
    it('should fail allocation when direct recursion detected', () => {
      const source = `
        function recursive() {
          let x: byte = 0;
        }
      `;
      const program = parseSource(source);
      // Simulate direct recursion in call graph
      const callGraph = buildCallGraph([
        { caller: 'recursive', callee: 'recursive' },
      ]);

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].code).toBe(FrameDiagnosticCode.RECURSION);
    });

    it('should return empty frame map when recursion detected', () => {
      const source = `
        function foo() {
          let x: byte = 0;
        }
      `;
      const program = parseSource(source);
      const callGraph = buildCallGraph([
        { caller: 'foo', callee: 'foo' },
      ]);

      const result = allocator.allocate(program, callGraph, symbolTable);

      expect(result.success).toBe(false);
      expect(result.frameMap.size).toBe(0);
    });
  });
});

// ============================================================================
// Tests: Frame Region Overflow
// ============================================================================

describe('FrameAllocator - Frame Region Overflow', () => {
  it('should detect frame region overflow', () => {
    // Use test platform with tiny frame region (32 bytes)
    const allocator = new FrameAllocator(TEST_PLATFORM_CONFIG);
    const symbolTable = new SymbolTable();

    // Create functions that exceed 32 bytes total
    const source = `
      function func1() {
        let a: byte[20] = [];
      }

      function func2() {
        let b: byte[20] = [];
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === FrameDiagnosticCode.FRAME_OVERFLOW)).toBe(true);
  });

  it('should succeed when frames fit in region', () => {
    // Use C64 platform with larger frame region (512 bytes)
    const allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
    const symbolTable = new SymbolTable();

    const source = `
      function small() {
        let x: byte = 0;
        let y: byte = 1;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    expect(result.diagnostics.filter(d => d.code === FrameDiagnosticCode.FRAME_OVERFLOW)).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Statistics
// ============================================================================

describe('FrameAllocator - Statistics', () => {
  let allocator: FrameAllocator;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    allocator = new FrameAllocator(C64_PLATFORM_CONFIG, symbolTable);
  });

  it('should compute function count', () => {
    const source = `
      function a() { let x: byte = 0; }
      function b() { let y: byte = 1; }
      function c() { let z: byte = 2; }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.stats.functionCount).toBe(3);
    expect(result.stats.framesAllocated).toBe(3);
  });

  it('should compute frame region bytes used', () => {
    const source = `
      function main() {
        let x: byte = 0;
        let y: word = 0;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    // byte (1) + word (2) = 3 bytes
    expect(result.stats.frameRegionBytesUsed).toBe(3);
  });

  it('should compute frame region utilization', () => {
    const source = `
      function main() {
        let x: byte = 0;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    // 1 byte used / 512 available = ~0.2%
    expect(result.stats.frameRegionUtilization).toBeGreaterThan(0);
    expect(result.stats.frameRegionUtilization).toBeLessThan(1);
  });

  it('should compute total slot count', () => {
    const source = `
      function f1() { let a: byte = 0; let b: byte = 1; }
      function f2() { let c: byte = 2; }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    // f1: 2 slots, f2: 1 slot
    expect(result.stats.totalSlotCount).toBe(3);
  });

  it('should report coalesce stats as zero (Phase 3 feature)', () => {
    const source = `
      function main() { let x: byte = 0; }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.stats.coalesceBytesSaved).toBe(0);
    expect(result.stats.coalesceGroupCount).toBe(0);
  });
});

// ============================================================================
// Tests: Factory Functions
// ============================================================================

describe('Factory Functions', () => {
  describe('createFrameAllocator', () => {
    it('should create allocator with default config', () => {
      const allocator = createFrameAllocator();
      expect(allocator.getConfig()).toBe(C64_PLATFORM_CONFIG);
    });

    it('should create allocator with custom config', () => {
      const allocator = createFrameAllocator(TEST_PLATFORM_CONFIG);
      expect(allocator.getConfig()).toBe(TEST_PLATFORM_CONFIG);
    });
  });

  describe('createEmptyAllocationStats', () => {
    it('should create stats with zero values', () => {
      const stats = createEmptyAllocationStats(C64_PLATFORM_CONFIG);

      expect(stats.functionCount).toBe(0);
      expect(stats.framesAllocated).toBe(0);
      expect(stats.frameRegionBytesUsed).toBe(0);
      expect(stats.zpBytesUsed).toBe(0);
      expect(stats.totalSlotCount).toBe(0);
    });

    it('should include platform capacities', () => {
      const stats = createEmptyAllocationStats(C64_PLATFORM_CONFIG);

      expect(stats.frameRegionBytesAvailable).toBe(C64_PLATFORM_CONFIG.frameRegionSize);
      expect(stats.zpBytesAvailable).toBe(C64_PLATFORM_CONFIG.zpAvailable);
    });
  });
});

// ============================================================================
// Tests: Empty Program
// ============================================================================

describe('FrameAllocator - Edge Cases', () => {
  let allocator: FrameAllocator;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    allocator = new FrameAllocator(C64_PLATFORM_CONFIG, symbolTable);
  });

  it('should handle empty program', () => {
    const source = `// Empty module`;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    expect(result.frameMap.size).toBe(0);
    expect(result.stats.functionCount).toBe(0);
  });

  it('should handle function with no locals', () => {
    const source = `
      function empty() {
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    expect(result.frameMap.has('empty')).toBe(true);
    expect(result.frameMap.get('empty')!.totalSize).toBe(0);
  });

  it('should handle function with parameters only', () => {
    const source = `
      function withParams(a: byte, b: word) {
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    const frame = result.frameMap.get('withParams');
    expect(frame).toBeDefined();
    expect(frame!.slots.length).toBe(2); // a: byte, b: word
    expect(frame!.totalSize).toBe(3); // 1 + 2
  });

  it('should handle function with return value', () => {
    const source = `
      function getValue(): byte {
        return 42;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    const frame = result.frameMap.get('getValue');
    expect(frame).toBeDefined();
    // Return slot is added
    expect(frame!.slots.some(s => s.name === '__return')).toBe(true);
  });
});

// ============================================================================
// Tests: ZP Allocation Integration
// ============================================================================

describe('FrameAllocator - ZP Allocation', () => {
  it('should include ZP allocation summary in result', () => {
    const allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
    const symbolTable = new SymbolTable();

    const source = `
      function main() {
        let counter: byte = 0;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    expect(result.zpAllocationSummary).toBeDefined();
  });

  it('should report ZP stats from allocation', () => {
    const allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
    const symbolTable = new SymbolTable();

    const source = `
      function main() {
        let a: byte = 0;
        let b: byte = 1;
        let c: byte = 2;
      }
    `;
    const program = parseSource(source);
    const callGraph = emptyCallGraph();

    const result = allocator.allocate(program, callGraph, symbolTable);

    expect(result.success).toBe(true);
    // Slots should be counted in stats
    expect(result.stats.totalSlotCount).toBe(3);
  });
});