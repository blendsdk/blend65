/**
 * Tests for DependencyGraph class
 *
 * Tests cycle detection, topological sorting, and dependency tracking
 * for multi-module compilation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../semantic/dependency-graph.js';
import type { SourceLocation } from '../../ast/base.js';

/**
 * Helper to create a mock source location
 */
function createLocation(line = 1, column = 1): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
  };
}

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Basic Graph Construction', () => {
    it('should add edges to the graph', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);

      expect(graph.getEdgeCount()).toBe(2);
      expect(graph.hasModule('A')).toBe(true);
      expect(graph.hasModule('B')).toBe(true);
      expect(graph.hasModule('C')).toBe(true);
    });

    it('should track module dependencies', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('A', 'C', loc);
      graph.addEdge('B', 'D', loc);

      expect(graph.getModuleDependencies('A')).toEqual(['B', 'C']);
      expect(graph.getModuleDependencies('B')).toEqual(['D']);
      expect(graph.getModuleDependencies('C')).toEqual([]);
    });

    it('should return all modules in the graph', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('C', 'D', loc);

      const modules = graph.getAllModules();
      expect(modules).toContain('A');
      expect(modules).toContain('B');
      expect(modules).toContain('C');
      expect(modules).toContain('D');
      expect(modules.length).toBe(4);
    });

    it('should return all edges with locations', () => {
      const loc1 = createLocation(1, 1);
      const loc2 = createLocation(2, 1);

      graph.addEdge('A', 'B', loc1);
      graph.addEdge('B', 'C', loc2);

      const edges = graph.getEdges();
      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({ from: 'A', to: 'B', importLocation: loc1 });
      expect(edges[1]).toEqual({ from: 'B', to: 'C', importLocation: loc2 });
    });

    it('should handle empty graph', () => {
      expect(graph.getEdgeCount()).toBe(0);
      expect(graph.getAllModules()).toEqual([]);
      expect(graph.getEdges()).toEqual([]);
      expect(graph.hasCycles()).toBe(false);
    });
  });

  describe('Cycle Detection - Simple Cycles', () => {
    it('should detect simple 2-node cycle (A → B → A)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'A', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);

      // Check that the cycle contains A and B
      const cycle = cycles[0];
      expect(cycle).toContain('A');
      expect(cycle).toContain('B');
    });

    it('should detect self-loop (A → A)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'A', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('A');
    });

    it('should not detect cycle in linear chain (A → B → C)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);

      expect(graph.hasCycles()).toBe(false);
      expect(graph.detectCycles()).toEqual([]);
    });
  });

  describe('Cycle Detection - Complex Cycles', () => {
    it('should detect 3-node cycle (A → B → C → A)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);
      graph.addEdge('C', 'A', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);

      const cycle = cycles[0];
      expect(cycle).toContain('A');
      expect(cycle).toContain('B');
      expect(cycle).toContain('C');
    });

    it('should detect 4-node cycle (A → B → C → D → A)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);
      graph.addEdge('C', 'D', loc);
      graph.addEdge('D', 'A', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect multiple independent cycles', () => {
      const loc = createLocation();

      // Cycle 1: A → B → A
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'A', loc);

      // Cycle 2: X → Y → X
      graph.addEdge('X', 'Y', loc);
      graph.addEdge('Y', 'X', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle cycle with branches (diamond with back edge)', () => {
      const loc = createLocation();

      // Diamond: A → B, A → C, B → D, C → D
      graph.addEdge('A', 'B', loc);
      graph.addEdge('A', 'C', loc);
      graph.addEdge('B', 'D', loc);
      graph.addEdge('C', 'D', loc);

      // Add back edge to create cycle
      graph.addEdge('D', 'A', loc);

      expect(graph.hasCycles()).toBe(true);
    });
  });

  describe('Topological Sorting - No Cycles', () => {
    it('should compute topological order for linear chain', () => {
      const loc = createLocation();

      // A → B → C
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);

      const order = graph.getTopologicalOrder();

      // C should come before B, B should come before A
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    });

    it('should compute topological order for diamond pattern', () => {
      const loc = createLocation();

      // A → B, A → C, B → D, C → D
      graph.addEdge('A', 'B', loc);
      graph.addEdge('A', 'C', loc);
      graph.addEdge('B', 'D', loc);
      graph.addEdge('C', 'D', loc);

      const order = graph.getTopologicalOrder();

      // D should come before B and C
      expect(order.indexOf('D')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('D')).toBeLessThan(order.indexOf('C'));

      // B and C should come before A
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('A'));
    });

    it('should compute topological order for complex DAG', () => {
      const loc = createLocation();

      // Complex dependency tree:
      // game → [screen, sprites, input]
      // screen → [kernal]
      // sprites → [kernal, math]
      // input → [kernal]
      graph.addEdge('game', 'screen', loc);
      graph.addEdge('game', 'sprites', loc);
      graph.addEdge('game', 'input', loc);
      graph.addEdge('screen', 'kernal', loc);
      graph.addEdge('sprites', 'kernal', loc);
      graph.addEdge('sprites', 'math', loc);
      graph.addEdge('input', 'kernal', loc);

      const order = graph.getTopologicalOrder();

      // kernal and math should come before everything
      const kernalIdx = order.indexOf('kernal');
      const mathIdx = order.indexOf('math');
      const screenIdx = order.indexOf('screen');
      const spritesIdx = order.indexOf('sprites');
      const inputIdx = order.indexOf('input');
      const gameIdx = order.indexOf('game');

      expect(kernalIdx).toBeLessThan(screenIdx);
      expect(kernalIdx).toBeLessThan(spritesIdx);
      expect(kernalIdx).toBeLessThan(inputIdx);
      expect(mathIdx).toBeLessThan(spritesIdx);

      // game should come last
      expect(screenIdx).toBeLessThan(gameIdx);
      expect(spritesIdx).toBeLessThan(gameIdx);
      expect(inputIdx).toBeLessThan(gameIdx);
    });

    it('should handle disconnected components', () => {
      const loc = createLocation();

      // Component 1: A → B
      graph.addEdge('A', 'B', loc);

      // Component 2: X → Y
      graph.addEdge('X', 'Y', loc);

      const order = graph.getTopologicalOrder();

      // Each component maintains order
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
      expect(order.indexOf('Y')).toBeLessThan(order.indexOf('X'));

      // All modules present
      expect(order).toHaveLength(4);
    });

    it('should handle single node with no dependencies', () => {
      const loc = createLocation();

      // Add a node with no edges (isolated module)
      // We need to add at least one edge to register the module
      graph.addEdge('A', 'B', loc);

      const order = graph.getTopologicalOrder();

      // B comes before A
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    });

    it('should throw error when cycles exist', () => {
      const loc = createLocation();

      // Create cycle: A → B → A
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'A', loc);

      expect(() => graph.getTopologicalOrder()).toThrow(/circular dependencies/i);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle C64 library dependencies', () => {
      const loc = createLocation();

      // Typical C64 project structure:
      // game → [c64.screen, c64.sprites, utils]
      // c64.screen → c64.kernal
      // c64.sprites → c64.kernal
      // utils → (no dependencies)
      graph.addEdge('game', 'c64.screen', loc);
      graph.addEdge('game', 'c64.sprites', loc);
      graph.addEdge('game', 'utils', loc);
      graph.addEdge('c64.screen', 'c64.kernal', loc);
      graph.addEdge('c64.sprites', 'c64.kernal', loc);

      expect(graph.hasCycles()).toBe(false);

      const order = graph.getTopologicalOrder();

      // Verify compilation order
      expect(order.indexOf('c64.kernal')).toBeLessThan(order.indexOf('c64.screen'));
      expect(order.indexOf('c64.kernal')).toBeLessThan(order.indexOf('c64.sprites'));
      expect(order.indexOf('c64.screen')).toBeLessThan(order.indexOf('game'));
      expect(order.indexOf('c64.sprites')).toBeLessThan(order.indexOf('game'));
      expect(order.indexOf('utils')).toBeLessThan(order.indexOf('game'));
    });

    it('should detect circular import in library modules', () => {
      const loc = createLocation();

      // Bad design: circular dependency between library modules
      // screen → sprites → screen (cycle)
      graph.addEdge('c64.screen', 'c64.sprites', loc);
      graph.addEdge('c64.sprites', 'c64.screen', loc);

      expect(graph.hasCycles()).toBe(true);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested module names', () => {
      const loc = createLocation();

      // Deep hierarchy: game → c64.graphics.screen.utils
      graph.addEdge('game', 'c64.graphics.screen.utils', loc);
      graph.addEdge('c64.graphics.screen.utils', 'c64.kernal.memory', loc);

      expect(graph.hasCycles()).toBe(false);

      const order = graph.getTopologicalOrder();
      expect(order.indexOf('c64.kernal.memory')).toBeLessThan(
        order.indexOf('c64.graphics.screen.utils')
      );
      expect(order.indexOf('c64.graphics.screen.utils')).toBeLessThan(order.indexOf('game'));
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for dependencies of non-existent module', () => {
      const deps = graph.getModuleDependencies('nonexistent');
      expect(deps).toEqual([]);
    });

    it('should handle module with no dependencies', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);

      const deps = graph.getModuleDependencies('B');
      expect(deps).toEqual([]);
    });

    it('should handle multiple edges from same module', () => {
      const loc = createLocation();

      graph.addEdge('A', 'B', loc);
      graph.addEdge('A', 'C', loc);
      graph.addEdge('A', 'D', loc);

      const deps = graph.getModuleDependencies('A');
      expect(deps).toEqual(['B', 'C', 'D']);
    });

    it('should clear the graph', () => {
      const loc = createLocation();

      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);

      expect(graph.getEdgeCount()).toBe(2);

      graph.clear();

      expect(graph.getEdgeCount()).toBe(0);
      expect(graph.getAllModules()).toEqual([]);
      expect(graph.hasCycles()).toBe(false);
    });

    it('should allow duplicate edges (same from/to pair)', () => {
      const loc1 = createLocation(1, 1);
      const loc2 = createLocation(2, 1);

      // Same import declared twice (from different locations)
      graph.addEdge('A', 'B', loc1);
      graph.addEdge('A', 'B', loc2);

      expect(graph.getEdgeCount()).toBe(2);
      expect(graph.getModuleDependencies('A')).toEqual(['B', 'B']);
    });

    it('should handle module that is both importer and importee', () => {
      const loc = createLocation();

      // A imports B, B imports C, A also imports C
      graph.addEdge('A', 'B', loc);
      graph.addEdge('B', 'C', loc);
      graph.addEdge('A', 'C', loc);

      expect(graph.hasCycles()).toBe(false);

      const order = graph.getTopologicalOrder();
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('A'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    });
  });

  describe('Defensive Copying', () => {
    it('should return copy of edges (not mutate internal state)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);

      const edges = graph.getEdges();
      edges.push({ from: 'X', to: 'Y', importLocation: loc });

      // Original graph unchanged
      expect(graph.getEdgeCount()).toBe(1);
    });

    it('should return copy of dependencies (not mutate internal state)', () => {
      const loc = createLocation();
      graph.addEdge('A', 'B', loc);
      graph.addEdge('A', 'C', loc);

      const deps = graph.getModuleDependencies('A');
      deps.push('X');

      // Original graph unchanged
      expect(graph.getModuleDependencies('A')).toEqual(['B', 'C']);
    });
  });
});
