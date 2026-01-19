/**
 * Control Flow Graph (CFG) Data Structures Tests
 *
 * Tests the CFG infrastructure including:
 * - Node creation
 * - Edge creation
 * - Reachability computation
 * - Dead code detection
 */

import { describe, it, expect } from 'vitest';
import { ControlFlowGraph, CFGNodeKind } from '../../semantic/control-flow.js';

describe('Control Flow Graph', () => {
  describe('Graph Construction', () => {
    it('creates a CFG with entry and exit nodes', () => {
      const cfg = new ControlFlowGraph();

      expect(cfg.entry).toBeDefined();
      expect(cfg.exit).toBeDefined();
      expect(cfg.entry.kind).toBe(CFGNodeKind.Entry);
      expect(cfg.exit.kind).toBe(CFGNodeKind.Exit);
      expect(cfg.getNodeCount()).toBe(2);
    });

    it('creates nodes with unique IDs', () => {
      const cfg = new ControlFlowGraph();

      const node1 = cfg.createNode(CFGNodeKind.Statement, null);
      const node2 = cfg.createNode(CFGNodeKind.Statement, null);
      const node3 = cfg.createNode(CFGNodeKind.Statement, null);

      expect(node1.id).not.toBe(node2.id);
      expect(node2.id).not.toBe(node3.id);
      expect(node1.id).not.toBe(node3.id);
    });

    it('creates nodes with correct initial state', () => {
      const cfg = new ControlFlowGraph();
      const node = cfg.createNode(CFGNodeKind.Statement, null);

      expect(node.kind).toBe(CFGNodeKind.Statement);
      expect(node.statement).toBeNull();
      expect(node.predecessors).toEqual([]);
      expect(node.successors).toEqual([]);
      expect(node.reachable).toBe(false);
      expect(node.metadata).toBeInstanceOf(Map);
    });

    it('tracks all created nodes', () => {
      const cfg = new ControlFlowGraph();

      cfg.createNode(CFGNodeKind.Statement, null);
      cfg.createNode(CFGNodeKind.Statement, null);
      cfg.createNode(CFGNodeKind.Statement, null);

      // 2 (entry/exit) + 3 created = 5
      expect(cfg.getNodeCount()).toBe(5);
      expect(cfg.getNodes()).toHaveLength(5);
    });
  });

  describe('Edge Creation', () => {
    it('adds edges between nodes', () => {
      const cfg = new ControlFlowGraph();
      const node1 = cfg.createNode(CFGNodeKind.Statement, null);
      const node2 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(node1, node2);

      expect(node1.successors).toContain(node2);
      expect(node2.predecessors).toContain(node1);
    });

    it('prevents duplicate edges', () => {
      const cfg = new ControlFlowGraph();
      const node1 = cfg.createNode(CFGNodeKind.Statement, null);
      const node2 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(node1, node2);
      cfg.addEdge(node1, node2); // Duplicate
      cfg.addEdge(node1, node2); // Duplicate

      expect(node1.successors).toHaveLength(1);
      expect(node2.predecessors).toHaveLength(1);
    });

    it('allows multiple successors (branching)', () => {
      const cfg = new ControlFlowGraph();
      const branch = cfg.createNode(CFGNodeKind.Branch, null);
      const then = cfg.createNode(CFGNodeKind.Statement, null);
      const els = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(branch, then);
      cfg.addEdge(branch, els);

      expect(branch.successors).toHaveLength(2);
      expect(branch.successors).toContain(then);
      expect(branch.successors).toContain(els);
    });

    it('allows multiple predecessors (merging)', () => {
      const cfg = new ControlFlowGraph();
      const then = cfg.createNode(CFGNodeKind.Statement, null);
      const els = cfg.createNode(CFGNodeKind.Statement, null);
      const merge = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(then, merge);
      cfg.addEdge(els, merge);

      expect(merge.predecessors).toHaveLength(2);
      expect(merge.predecessors).toContain(then);
      expect(merge.predecessors).toContain(els);
    });

    it('counts edges correctly', () => {
      const cfg = new ControlFlowGraph();
      const n1 = cfg.createNode(CFGNodeKind.Statement, null);
      const n2 = cfg.createNode(CFGNodeKind.Statement, null);
      const n3 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, n1);
      cfg.addEdge(n1, n2);
      cfg.addEdge(n2, n3);
      cfg.addEdge(n3, cfg.exit);

      expect(cfg.getEdgeCount()).toBe(4);
    });
  });

  describe('Reachability Analysis', () => {
    it('marks entry as reachable', () => {
      const cfg = new ControlFlowGraph();
      cfg.computeReachability();

      expect(cfg.entry.reachable).toBe(true);
    });

    it('marks nodes reachable from entry', () => {
      const cfg = new ControlFlowGraph();
      const n1 = cfg.createNode(CFGNodeKind.Statement, null);
      const n2 = cfg.createNode(CFGNodeKind.Statement, null);
      const n3 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, n1);
      cfg.addEdge(n1, n2);
      cfg.addEdge(n2, n3);
      cfg.addEdge(n3, cfg.exit);

      cfg.computeReachability();

      expect(n1.reachable).toBe(true);
      expect(n2.reachable).toBe(true);
      expect(n3.reachable).toBe(true);
      expect(cfg.exit.reachable).toBe(true);
    });

    it('marks disconnected nodes as unreachable', () => {
      const cfg = new ControlFlowGraph();
      const n1 = cfg.createNode(CFGNodeKind.Statement, null);
      const n2 = cfg.createNode(CFGNodeKind.Statement, null);
      const disconnected = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, n1);
      cfg.addEdge(n1, n2);
      cfg.addEdge(n2, cfg.exit);
      // disconnected has no edges

      cfg.computeReachability();

      expect(n1.reachable).toBe(true);
      expect(n2.reachable).toBe(true);
      expect(disconnected.reachable).toBe(false);
    });

    it('handles branching correctly', () => {
      const cfg = new ControlFlowGraph();
      const branch = cfg.createNode(CFGNodeKind.Branch, null);
      const then = cfg.createNode(CFGNodeKind.Statement, null);
      const els = cfg.createNode(CFGNodeKind.Statement, null);
      const merge = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, branch);
      cfg.addEdge(branch, then);
      cfg.addEdge(branch, els);
      cfg.addEdge(then, merge);
      cfg.addEdge(els, merge);
      cfg.addEdge(merge, cfg.exit);

      cfg.computeReachability();

      expect(branch.reachable).toBe(true);
      expect(then.reachable).toBe(true);
      expect(els.reachable).toBe(true);
      expect(merge.reachable).toBe(true);
      expect(cfg.exit.reachable).toBe(true);
    });

    it('handles loops correctly', () => {
      const cfg = new ControlFlowGraph();
      const loop = cfg.createNode(CFGNodeKind.Loop, null);
      const body = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, loop);
      cfg.addEdge(loop, body);
      cfg.addEdge(body, loop); // Back edge
      cfg.addEdge(loop, cfg.exit); // Exit edge

      cfg.computeReachability();

      expect(loop.reachable).toBe(true);
      expect(body.reachable).toBe(true);
      expect(cfg.exit.reachable).toBe(true);
    });

    it('detects code after return as unreachable', () => {
      const cfg = new ControlFlowGraph();
      const stmt1 = cfg.createNode(CFGNodeKind.Statement, null);
      const ret = cfg.createNode(CFGNodeKind.Return, null);
      const stmt2 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, stmt1);
      cfg.addEdge(stmt1, ret);
      cfg.addEdge(ret, cfg.exit);
      // stmt2 has no incoming edges - unreachable

      cfg.computeReachability();

      expect(stmt1.reachable).toBe(true);
      expect(ret.reachable).toBe(true);
      expect(stmt2.reachable).toBe(false);
    });
  });

  describe('Dead Code Detection', () => {
    it('returns empty array when all code is reachable', () => {
      const cfg = new ControlFlowGraph();
      const n1 = cfg.createNode(CFGNodeKind.Statement, null);
      const n2 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, n1);
      cfg.addEdge(n1, n2);
      cfg.addEdge(n2, cfg.exit);

      cfg.computeReachability();

      const unreachable = cfg.getUnreachableNodes();
      expect(unreachable).toHaveLength(0);
    });

    it('finds unreachable nodes', () => {
      const cfg = new ControlFlowGraph();
      const n1 = cfg.createNode(CFGNodeKind.Statement, null);
      const dead1 = cfg.createNode(CFGNodeKind.Statement, null);
      const dead2 = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, n1);
      cfg.addEdge(n1, cfg.exit);
      // dead1 and dead2 are not connected

      cfg.computeReachability();

      const unreachable = cfg.getUnreachableNodes();
      expect(unreachable).toHaveLength(2);
      expect(unreachable).toContain(dead1);
      expect(unreachable).toContain(dead2);
    });

    it('excludes exit node from unreachable list', () => {
      const cfg = new ControlFlowGraph();
      const loop = cfg.createNode(CFGNodeKind.Loop, null);
      const body = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, loop);
      cfg.addEdge(loop, body);
      cfg.addEdge(body, loop); // Infinite loop, exit unreachable

      cfg.computeReachability();

      const unreachable = cfg.getUnreachableNodes();
      // Exit is unreachable but should not be in list
      expect(cfg.exit.reachable).toBe(false);
      expect(unreachable).not.toContain(cfg.exit);
    });
  });

  describe('Path Analysis', () => {
    it('detects when exit is reachable', () => {
      const cfg = new ControlFlowGraph();
      const stmt = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, stmt);
      cfg.addEdge(stmt, cfg.exit);

      cfg.computeReachability();

      expect(cfg.allPathsReachExit()).toBe(true);
    });

    it('detects when exit is unreachable', () => {
      const cfg = new ControlFlowGraph();
      const loop = cfg.createNode(CFGNodeKind.Loop, null);
      const body = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, loop);
      cfg.addEdge(loop, body);
      cfg.addEdge(body, loop); // Infinite loop

      cfg.computeReachability();

      expect(cfg.allPathsReachExit()).toBe(false);
    });

    it('detects when all paths return early', () => {
      const cfg = new ControlFlowGraph();
      const branch = cfg.createNode(CFGNodeKind.Branch, null);
      const ret1 = cfg.createNode(CFGNodeKind.Return, null);
      const ret2 = cfg.createNode(CFGNodeKind.Return, null);

      cfg.addEdge(cfg.entry, branch);
      cfg.addEdge(branch, ret1);
      cfg.addEdge(branch, ret2);
      cfg.addEdge(ret1, cfg.exit);
      cfg.addEdge(ret2, cfg.exit);

      cfg.computeReachability();

      expect(cfg.allPathsReachExit()).toBe(true);
    });
  });

  describe('DOT Format Generation', () => {
    it('generates valid DOT format', () => {
      const cfg = new ControlFlowGraph();
      const stmt = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, stmt);
      cfg.addEdge(stmt, cfg.exit);

      const dot = cfg.toDot();

      expect(dot).toContain('digraph CFG {');
      expect(dot).toContain('ENTRY');
      expect(dot).toContain('EXIT');
      expect(dot).toContain('->');
      expect(dot).toContain('}');
    });

    it('marks unreachable nodes in red', () => {
      const cfg = new ControlFlowGraph();
      const reachable = cfg.createNode(CFGNodeKind.Statement, null);
      const unreachable = cfg.createNode(CFGNodeKind.Statement, null);

      cfg.addEdge(cfg.entry, reachable);
      cfg.addEdge(reachable, cfg.exit);
      // unreachable is disconnected

      cfg.computeReachability();

      const dot = cfg.toDot();

      // Verify unreachable nodes are marked differently
      expect(dot).toContain('color=black');
      expect(dot).toContain('color=red');
    });
  });
});
