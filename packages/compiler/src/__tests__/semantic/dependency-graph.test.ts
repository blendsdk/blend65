/**
 * Dependency Graph Tests for Blend65 Compiler v2
 *
 * Tests the DependencyGraph class which tracks module import
 * relationships and provides cycle detection and topological sorting.
 *
 * Test categories:
 * - Creation and basic operations
 * - Node operations (add, query)
 * - Edge operations (add, query)
 * - Dependencies and dependents queries
 * - Cycle detection (critical for error reporting)
 * - Topological sort and compilation order
 * - Edge cases and complex graphs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph, CycleInfo, DependencyEdge } from '../../semantic/dependency-graph.js';
import { SourceLocation } from '../../ast/index.js';

/**
 * Creates a test source location
 */
function createLocation(line: number = 1, col: number = 1): SourceLocation {
  return {
    start: { line, column: col, offset: 0 },
    end: { line, column: col + 10, offset: 10 },
    file: 'test.blend',
  };
}

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  // ============================================
  // CREATION AND BASIC OPERATIONS
  // ============================================

  describe('creation', () => {
    it('should create an empty graph', () => {
      expect(graph.isEmpty()).toBe(true);
      expect(graph.getNodeCount()).toBe(0);
    });

    it('should have no nodes initially', () => {
      expect(graph.getAllNodes().size).toBe(0);
    });
  });

  // ============================================
  // NODE OPERATIONS
  // ============================================

  describe('addNode', () => {
    it('should add a single node', () => {
      graph.addNode('Game.Main');

      expect(graph.getNodeCount()).toBe(1);
      expect(graph.getAllNodes().has('Game.Main')).toBe(true);
    });

    it('should add multiple nodes', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      expect(graph.getNodeCount()).toBe(3);
      expect(graph.getAllNodes().has('A')).toBe(true);
      expect(graph.getAllNodes().has('B')).toBe(true);
      expect(graph.getAllNodes().has('C')).toBe(true);
    });

    it('should be idempotent - adding same node twice does not increase count', () => {
      graph.addNode('A');
      graph.addNode('A');

      expect(graph.getNodeCount()).toBe(1);
    });

    it('should handle dotted module names', () => {
      graph.addNode('Game.Sprites.Player');

      expect(graph.getAllNodes().has('Game.Sprites.Player')).toBe(true);
    });
  });

  describe('getAllNodes', () => {
    it('should return a copy of nodes set', () => {
      graph.addNode('A');
      const nodes1 = graph.getAllNodes();
      const nodes2 = graph.getAllNodes();

      expect(nodes1).not.toBe(nodes2);
      expect(Array.from(nodes1)).toEqual(Array.from(nodes2));
    });
  });

  // ============================================
  // EDGE OPERATIONS
  // ============================================

  describe('addEdge', () => {
    it('should add an edge between two nodes', () => {
      const location = createLocation();
      graph.addEdge('A', 'B', location);

      expect(graph.hasEdge('A', 'B')).toBe(true);
      expect(graph.hasEdge('B', 'A')).toBe(false); // Directed graph
    });

    it('should automatically create nodes when adding edge', () => {
      graph.addEdge('X', 'Y', createLocation());

      expect(graph.getNodeCount()).toBe(2);
      expect(graph.getAllNodes().has('X')).toBe(true);
      expect(graph.getAllNodes().has('Y')).toBe(true);
    });

    it('should store edge metadata', () => {
      const location = createLocation(5, 10);
      graph.addEdge('A', 'B', location);

      const edge = graph.getEdge('A', 'B');
      expect(edge).toBeDefined();
      expect(edge!.from).toBe('A');
      expect(edge!.to).toBe('B');
      expect(edge!.location.start.line).toBe(5);
      expect(edge!.location.start.column).toBe(10);
    });

    it('should handle multiple edges from same node', () => {
      graph.addEdge('Main', 'Sprites', createLocation());
      graph.addEdge('Main', 'Audio', createLocation());
      graph.addEdge('Main', 'Math', createLocation());

      expect(graph.hasEdge('Main', 'Sprites')).toBe(true);
      expect(graph.hasEdge('Main', 'Audio')).toBe(true);
      expect(graph.hasEdge('Main', 'Math')).toBe(true);
    });

    it('should handle multiple edges to same node', () => {
      graph.addEdge('A', 'Lib', createLocation());
      graph.addEdge('B', 'Lib', createLocation());
      graph.addEdge('C', 'Lib', createLocation());

      expect(graph.hasEdge('A', 'Lib')).toBe(true);
      expect(graph.hasEdge('B', 'Lib')).toBe(true);
      expect(graph.hasEdge('C', 'Lib')).toBe(true);
    });
  });

  describe('hasEdge', () => {
    it('should return false for non-existent edge', () => {
      graph.addNode('A');
      graph.addNode('B');

      expect(graph.hasEdge('A', 'B')).toBe(false);
    });

    it('should return true for existing edge', () => {
      graph.addEdge('A', 'B', createLocation());

      expect(graph.hasEdge('A', 'B')).toBe(true);
    });

    it('should return false for non-existent nodes', () => {
      expect(graph.hasEdge('NonExistent1', 'NonExistent2')).toBe(false);
    });
  });

  describe('getEdge', () => {
    it('should return undefined for non-existent edge', () => {
      expect(graph.getEdge('A', 'B')).toBeUndefined();
    });

    it('should return edge data for existing edge', () => {
      const location = createLocation();
      graph.addEdge('A', 'B', location);

      const edge = graph.getEdge('A', 'B');
      expect(edge).toBeDefined();
      expect(edge!.from).toBe('A');
      expect(edge!.to).toBe('B');
    });
  });

  // ============================================
  // DEPENDENCIES AND DEPENDENTS
  // ============================================

  describe('getDependencies', () => {
    it('should return empty set for node with no dependencies', () => {
      graph.addNode('A');

      const deps = graph.getDependencies('A');
      expect(deps.size).toBe(0);
    });

    it('should return all modules that a node imports', () => {
      // A imports B, C, D
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('A', 'C', createLocation());
      graph.addEdge('A', 'D', createLocation());

      const deps = graph.getDependencies('A');
      expect(deps.size).toBe(3);
      expect(deps.has('B')).toBe(true);
      expect(deps.has('C')).toBe(true);
      expect(deps.has('D')).toBe(true);
    });

    it('should return empty set for non-existent node', () => {
      const deps = graph.getDependencies('NonExistent');
      expect(deps.size).toBe(0);
    });
  });

  describe('getDependents', () => {
    it('should return empty set for node with no dependents', () => {
      graph.addNode('A');

      const deps = graph.getDependents('A');
      expect(deps.size).toBe(0);
    });

    it('should return all modules that import this node', () => {
      // A, B, C all import Lib
      graph.addEdge('A', 'Lib', createLocation());
      graph.addEdge('B', 'Lib', createLocation());
      graph.addEdge('C', 'Lib', createLocation());

      const dependents = graph.getDependents('Lib');
      expect(dependents.size).toBe(3);
      expect(dependents.has('A')).toBe(true);
      expect(dependents.has('B')).toBe(true);
      expect(dependents.has('C')).toBe(true);
    });

    it('should return empty set for non-existent node', () => {
      const dependents = graph.getDependents('NonExistent');
      expect(dependents.size).toBe(0);
    });
  });

  // ============================================
  // CYCLE DETECTION (CRITICAL!)
  // ============================================

  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
      // A → B → C (linear chain)
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());

      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it('should return empty array for empty graph', () => {
      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it('should return empty array for graph with only nodes', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it('should detect direct self-loop (A → A)', () => {
      graph.addEdge('A', 'A', createLocation());

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      // Should contain A in the cycle
      const cycleModules = cycles[0].cycle;
      expect(cycleModules).toContain('A');
    });

    it('should detect simple 2-node cycle (A → B → A)', () => {
      graph.addEdge('A', 'B', createLocation(1, 1));
      graph.addEdge('B', 'A', createLocation(2, 1));

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      // Find cycle containing both A and B
      const cycle = cycles.find(c => c.cycle.includes('A') && c.cycle.includes('B'));
      expect(cycle).toBeDefined();
    });

    it('should detect 3-node cycle (A → B → C → A)', () => {
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());
      graph.addEdge('C', 'A', createLocation());

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      // Find cycle containing A, B, C
      const cycle = cycles.find(
        c => c.cycle.includes('A') && c.cycle.includes('B') && c.cycle.includes('C')
      );
      expect(cycle).toBeDefined();
    });

    it('should detect cycle in complex graph with multiple paths', () => {
      // Main → A → B
      // Main → C → A (creates cycle A → B and indirectly C → A → ... → C)
      // B → C (creates cycle)
      graph.addEdge('Main', 'A', createLocation());
      graph.addEdge('Main', 'C', createLocation());
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());
      graph.addEdge('C', 'A', createLocation());

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('should include source location in cycle info', () => {
      const locationAB = createLocation(10, 5);
      const locationBA = createLocation(20, 3);
      graph.addEdge('A', 'B', locationAB);
      graph.addEdge('B', 'A', locationBA);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      // The location should be from one of the edges
      const cycleLocation = cycles[0].location;
      expect(cycleLocation.start.line).toBeGreaterThan(0);
    });

    it('should detect multiple independent cycles', () => {
      // Cycle 1: A → B → A
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'A', createLocation());

      // Cycle 2: X → Y → Z → X
      graph.addEdge('X', 'Y', createLocation());
      graph.addEdge('Y', 'Z', createLocation());
      graph.addEdge('Z', 'X', createLocation());

      const cycles = graph.detectCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // TOPOLOGICAL SORT
  // ============================================

  describe('getTopologicalOrder', () => {
    it('should return empty array for empty graph', () => {
      const order = graph.getTopologicalOrder();
      expect(order).toEqual([]);
    });

    it('should return single node for single-node graph', () => {
      graph.addNode('A');

      const order = graph.getTopologicalOrder();
      expect(order).toEqual(['A']);
    });

    it('should return nodes in valid topological order for linear chain', () => {
      // A → B → C
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());

      const order = graph.getTopologicalOrder();

      // A should come before B, B before C (since A imports B, B imports C)
      const indexA = order.indexOf('A');
      const indexB = order.indexOf('B');
      const indexC = order.indexOf('C');

      expect(order).toHaveLength(3);
      // Topological order: nodes with no incoming edges first
      // A has no incoming edges, so it should be first
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });

    it('should handle diamond dependency pattern', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('A', 'C', createLocation());
      graph.addEdge('B', 'D', createLocation());
      graph.addEdge('C', 'D', createLocation());

      const order = graph.getTopologicalOrder();

      expect(order).toHaveLength(4);

      // A must come before B and C
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));

      // B and C must come before D
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    });

    it('should include disconnected nodes', () => {
      graph.addNode('Isolated');
      graph.addEdge('A', 'B', createLocation());

      const order = graph.getTopologicalOrder();

      expect(order).toHaveLength(3);
      expect(order).toContain('Isolated');
      expect(order).toContain('A');
      expect(order).toContain('B');
    });
  });

  describe('getCompilationOrder', () => {
    it('should return empty array for empty graph', () => {
      const order = graph.getCompilationOrder();
      expect(order).toEqual([]);
    });

    it('should return dependencies before dependents (reverse of topo order)', () => {
      // A → B → C means: A imports B, B imports C
      // Compilation order: C first (no deps), then B, then A
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());

      const order = graph.getCompilationOrder();

      expect(order).toHaveLength(3);

      // C should be compiled first (has no dependencies, is imported by others)
      // B should be compiled after C
      // A should be compiled last
      const indexA = order.indexOf('A');
      const indexB = order.indexOf('B');
      const indexC = order.indexOf('C');

      expect(indexC).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexA);
    });

    it('should compile libraries before application modules', () => {
      // Main imports Sprites and Audio
      // Sprites imports Math
      // Audio imports Math
      graph.addEdge('Main', 'Sprites', createLocation());
      graph.addEdge('Main', 'Audio', createLocation());
      graph.addEdge('Sprites', 'Math', createLocation());
      graph.addEdge('Audio', 'Math', createLocation());

      const order = graph.getCompilationOrder();

      expect(order).toHaveLength(4);

      // Math must be compiled first
      // Sprites and Audio after Math
      // Main last
      expect(order.indexOf('Math')).toBeLessThan(order.indexOf('Sprites'));
      expect(order.indexOf('Math')).toBeLessThan(order.indexOf('Audio'));
      expect(order.indexOf('Sprites')).toBeLessThan(order.indexOf('Main'));
      expect(order.indexOf('Audio')).toBeLessThan(order.indexOf('Main'));
    });
  });

  // ============================================
  // CLEAR AND UTILITY OPERATIONS
  // ============================================

  describe('clear', () => {
    it('should remove all nodes and edges', () => {
      graph.addEdge('A', 'B', createLocation());
      graph.addEdge('B', 'C', createLocation());

      expect(graph.getNodeCount()).toBe(3);

      graph.clear();

      expect(graph.isEmpty()).toBe(true);
      expect(graph.getNodeCount()).toBe(0);
      expect(graph.hasEdge('A', 'B')).toBe(false);
    });

    it('should work on empty graph', () => {
      graph.clear();
      expect(graph.isEmpty()).toBe(true);
    });
  });

  describe('isEmpty', () => {
    it('should return true for new graph', () => {
      expect(graph.isEmpty()).toBe(true);
    });

    it('should return false after adding node', () => {
      graph.addNode('A');
      expect(graph.isEmpty()).toBe(false);
    });

    it('should return true after clearing', () => {
      graph.addNode('A');
      graph.clear();
      expect(graph.isEmpty()).toBe(true);
    });
  });

  describe('toString', () => {
    it('should return readable representation', () => {
      graph.addEdge('A', 'B', createLocation());
      graph.addNode('C');

      const str = graph.toString();

      expect(str).toContain('DependencyGraph');
      expect(str).toContain('A');
      expect(str).toContain('B');
      expect(str).toContain('C');
    });
  });

  // ============================================
  // COMPLEX GRAPH SCENARIOS
  // ============================================

  describe('complex scenarios', () => {
    it('should handle large acyclic graph', () => {
      // Create a chain: A → B → C → D → E → F → G → H → I → J
      const nodes = 'ABCDEFGHIJ'.split('');
      for (let i = 0; i < nodes.length - 1; i++) {
        graph.addEdge(nodes[i], nodes[i + 1], createLocation());
      }

      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(0);

      const order = graph.getCompilationOrder();
      expect(order).toHaveLength(10);

      // J should be first (no deps), A should be last
      expect(order[0]).toBe('J');
      expect(order[order.length - 1]).toBe('A');
    });

    it('should handle module with many dependencies', () => {
      // Main imports A, B, C, D, E, F
      graph.addEdge('Main', 'A', createLocation());
      graph.addEdge('Main', 'B', createLocation());
      graph.addEdge('Main', 'C', createLocation());
      graph.addEdge('Main', 'D', createLocation());
      graph.addEdge('Main', 'E', createLocation());
      graph.addEdge('Main', 'F', createLocation());

      const deps = graph.getDependencies('Main');
      expect(deps.size).toBe(6);

      const dependents = graph.getDependents('Main');
      expect(dependents.size).toBe(0);

      // Each A-F should have Main as dependent
      for (const node of 'ABCDEF') {
        const nodeDependents = graph.getDependents(node);
        expect(nodeDependents.has('Main')).toBe(true);
      }
    });

    it('should handle module imported by many others', () => {
      // A, B, C, D, E all import Lib
      graph.addEdge('A', 'Lib', createLocation());
      graph.addEdge('B', 'Lib', createLocation());
      graph.addEdge('C', 'Lib', createLocation());
      graph.addEdge('D', 'Lib', createLocation());
      graph.addEdge('E', 'Lib', createLocation());

      const dependents = graph.getDependents('Lib');
      expect(dependents.size).toBe(5);

      // Lib should be compiled first
      const order = graph.getCompilationOrder();
      expect(order[0]).toBe('Lib');
    });

    it('should correctly handle real-world module graph', () => {
      // Simulate a real game structure:
      // main → game, graphics, audio
      // game → sprites, input
      // graphics → sprites, shaders
      // sprites → math
      // shaders → math
      // input → (no deps)
      // audio → (no deps)
      // math → (no deps)

      graph.addEdge('main', 'game', createLocation());
      graph.addEdge('main', 'graphics', createLocation());
      graph.addEdge('main', 'audio', createLocation());
      graph.addEdge('game', 'sprites', createLocation());
      graph.addEdge('game', 'input', createLocation());
      graph.addEdge('graphics', 'sprites', createLocation());
      graph.addEdge('graphics', 'shaders', createLocation());
      graph.addEdge('sprites', 'math', createLocation());
      graph.addEdge('shaders', 'math', createLocation());

      // Should have no cycles
      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(0);

      // Compilation order check
      const order = graph.getCompilationOrder();

      // Leaf nodes (math, input, audio) should come before nodes that depend on them
      expect(order.indexOf('math')).toBeLessThan(order.indexOf('sprites'));
      expect(order.indexOf('math')).toBeLessThan(order.indexOf('shaders'));
      expect(order.indexOf('sprites')).toBeLessThan(order.indexOf('game'));
      expect(order.indexOf('sprites')).toBeLessThan(order.indexOf('graphics'));
      expect(order.indexOf('game')).toBeLessThan(order.indexOf('main'));
      expect(order.indexOf('graphics')).toBeLessThan(order.indexOf('main'));
      expect(order.indexOf('audio')).toBeLessThan(order.indexOf('main'));
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('should handle single isolated node', () => {
      graph.addNode('Lonely');

      expect(graph.getNodeCount()).toBe(1);
      expect(graph.detectCycles()).toHaveLength(0);
      expect(graph.getTopologicalOrder()).toEqual(['Lonely']);
    });

    it('should handle graph with all isolated nodes', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      expect(graph.getNodeCount()).toBe(3);
      expect(graph.detectCycles()).toHaveLength(0);

      const order = graph.getTopologicalOrder();
      expect(order).toHaveLength(3);
    });

    it('should handle duplicate edge additions', () => {
      graph.addEdge('A', 'B', createLocation(1, 1));
      graph.addEdge('A', 'B', createLocation(2, 2)); // Same edge, different location

      expect(graph.getNodeCount()).toBe(2);
      expect(graph.hasEdge('A', 'B')).toBe(true);

      // Second location should overwrite
      const edge = graph.getEdge('A', 'B');
      expect(edge!.location.start.line).toBe(2);
    });
  });
});