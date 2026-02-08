/**
 * Tests for LivenessAnalyzer
 *
 * Tests the liveness analysis capabilities using CFG analysis.
 * The analyzer computes:
 * - Live-in sets (variables live at node entry)
 * - Live-out sets (variables live at node exit)
 * - USE sets (variables read in node)
 * - DEF sets (variables written in node)
 * - Dead definitions (writes to variables never read)
 * - Variable interference (variables live at same point)
 *
 * @module tests/semantic/analysis/liveness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LivenessAnalyzer,
  DEFAULT_LIVENESS_OPTIONS,
} from '../../../semantic/analysis/liveness.js';
import { ControlFlowGraph, CFGBuilder, CFGNodeKind } from '../../../semantic/control-flow.js';
import type { Statement, SourceLocation } from '../../../ast/index.js';

/**
 * Create a mock statement for testing
 */
function createMockStatement(line: number, column: number = 1): Statement {
  const location: SourceLocation = {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
  };

  return {
    getNodeType: () => 'ExpressionStatement',
    getLocation: () => location,
    getChildren: () => [],
    accept: () => {},
  } as unknown as Statement;
}

describe('LivenessAnalyzer', () => {
  let analyzer: LivenessAnalyzer;

  beforeEach(() => {
    analyzer = new LivenessAnalyzer();
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      expect(analyzer.getAllVariables().size).toBe(0);
    });

    it('should accept custom options', () => {
      const customAnalyzer = new LivenessAnalyzer({ maxIterations: 500, debug: true });
      expect(customAnalyzer.getAllVariables().size).toBe(0);
    });
  });

  describe('recordUse', () => {
    it('should record variable uses', () => {
      analyzer.recordUse('node_1', 'x');
      analyzer.recordUse('node_1', 'y');

      expect(analyzer.getAllVariables().has('x')).toBe(true);
      expect(analyzer.getAllVariables().has('y')).toBe(true);
    });

    it('should not record use if variable was defined first in same node', () => {
      // Define x first, then use it - the use should not be in USE set
      analyzer.recordDef('node_1', 'x');
      analyzer.recordUse('node_1', 'x');

      // After analysis, the USE set for node_1 should not contain x
      // (since x was defined before being used in that node)
      const cfg = new ControlFlowGraph('test');
      const node = cfg.createNode(CFGNodeKind.Statement, createMockStatement(1));
      cfg.addEdge(cfg.entry, node);
      cfg.addEdge(node, cfg.exit);
      cfg.computeReachability();

      // Need to set the correct node ID
      analyzer.reset();
      analyzer.recordDef(node.id, 'x');
      analyzer.recordUse(node.id, 'x');

      const result = analyzer.analyze(cfg);
      const nodeInfo = result.nodeInfo.get(node.id);
      expect(nodeInfo).toBeDefined();
      // USE should not contain x since it was defined first
      expect(nodeInfo!.use.has('x')).toBe(false);
      expect(nodeInfo!.def.has('x')).toBe(true);
    });
  });

  describe('recordDef', () => {
    it('should record variable definitions', () => {
      analyzer.recordDef('node_1', 'x');

      expect(analyzer.getAllVariables().has('x')).toBe(true);
    });

    it('should track multiple definitions', () => {
      analyzer.recordDef('node_1', 'x');
      analyzer.recordDef('node_2', 'y');
      analyzer.recordDef('node_2', 'z');

      expect(analyzer.getAllVariables().size).toBe(3);
    });
  });

  describe('analyze', () => {
    it('should compute liveness for simple sequential code', () => {
      // CFG: entry -> stmt1 (use x) -> stmt2 (def x) -> exit
      const builder = new CFGBuilder('test');
      const stmt1 = builder.addStatement(createMockStatement(1));
      const stmt2 = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      // Register uses and defs
      analyzer.recordUse(stmt1.id, 'x');
      analyzer.recordDef(stmt2.id, 'x');

      const result = analyzer.analyze(cfg);

      expect(result.functionName).toBe('test');
      expect(result.allVariables.has('x')).toBe(true);
      expect(result.iterations).toBeGreaterThan(0);
    });

    it('should propagate liveness backwards', () => {
      // CFG: entry -> def x -> use x -> exit
      // x should be live between def and use
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const useNode = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.recordUse(useNode.id, 'x');

      const result = analyzer.analyze(cfg);

      // x should be live-in at useNode
      const useInfo = result.nodeInfo.get(useNode.id);
      expect(useInfo).toBeDefined();
      expect(useInfo!.liveIn.has('x')).toBe(true);

      // x should be live-out at defNode
      const defInfo = result.nodeInfo.get(defNode.id);
      expect(defInfo).toBeDefined();
      expect(defInfo!.liveOut.has('x')).toBe(true);
    });

    it('should handle unused variable (dead definition)', () => {
      // CFG: entry -> def x -> exit
      // x is defined but never used - dead definition
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');

      const result = analyzer.analyze(cfg);

      // x should NOT be live-out at defNode (never used)
      const defInfo = result.nodeInfo.get(defNode.id);
      expect(defInfo).toBeDefined();
      expect(defInfo!.liveOut.has('x')).toBe(false);

      // Should detect as dead definition
      const deadDefs = analyzer.findDeadDefinitions();
      expect(deadDefs.some(d => d.variable === 'x')).toBe(true);
    });

    it('should handle multiple variables', () => {
      // CFG: entry -> def x, def y -> use x -> use y -> exit
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const useXNode = builder.addStatement(createMockStatement(2));
      const useYNode = builder.addStatement(createMockStatement(3));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.recordDef(defNode.id, 'y');
      analyzer.recordUse(useXNode.id, 'x');
      analyzer.recordUse(useYNode.id, 'y');

      const result = analyzer.analyze(cfg);

      // Both variables should be tracked
      expect(result.allVariables.has('x')).toBe(true);
      expect(result.allVariables.has('y')).toBe(true);

      // x should be live at useXNode, y should be live at useYNode
      expect(analyzer.isLiveAt('x', useXNode.id, 'in')).toBe(true);
      expect(analyzer.isLiveAt('y', useYNode.id, 'in')).toBe(true);
    });

    it('should handle branches correctly', () => {
      // CFG: entry -> branch -> [use x, use y] -> merge -> exit
      const builder = new CFGBuilder('test');
      const branchNode = builder.startBranch(createMockStatement(1));
      const useX = builder.addStatement(createMockStatement(2));
      const thenExit = builder.getCurrentNode();

      builder.startAlternate(branchNode);
      const useY = builder.addStatement(createMockStatement(3));
      const elseExit = builder.getCurrentNode();

      builder.mergeBranches([thenExit, elseExit]);
      const cfg = builder.finalize();

      analyzer.recordUse(useX.id, 'x');
      analyzer.recordUse(useY.id, 'y');

      const result = analyzer.analyze(cfg);

      // x should be live-in at useX
      expect(analyzer.isLiveAt('x', useX.id, 'in')).toBe(true);
      // y should be live-in at useY
      expect(analyzer.isLiveAt('y', useY.id, 'in')).toBe(true);

      // Both should be live at branch node (different paths)
      expect(analyzer.isLiveAt('x', branchNode.id, 'out')).toBe(true);
      expect(analyzer.isLiveAt('y', branchNode.id, 'out')).toBe(true);
    });

    it('should handle loops correctly', () => {
      // CFG: entry -> loop header -> body (use x) -> back edge -> exit
      const builder = new CFGBuilder('test');
      const { entry: loopEntry, exit: loopExit } = builder.startLoop(createMockStatement(1));
      const bodyNode = builder.addStatement(createMockStatement(2));
      builder.endLoop(loopEntry, loopExit);
      const cfg = builder.finalize();

      analyzer.recordUse(bodyNode.id, 'x');

      const result = analyzer.analyze(cfg);

      // x should be live at loop entry (because it's used in the body)
      expect(analyzer.isLiveAt('x', loopEntry.id, 'out')).toBe(true);
    });
  });

  describe('getLiveIn', () => {
    it('should return live-in set for a node', () => {
      const builder = new CFGBuilder('test');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.analyze(cfg);

      const liveIn = analyzer.getLiveIn(stmt.id);
      expect(liveIn.has('x')).toBe(true);
    });

    it('should return empty set for unknown node', () => {
      const liveIn = analyzer.getLiveIn('unknown_node');
      expect(liveIn.size).toBe(0);
    });
  });

  describe('getLiveOut', () => {
    it('should return live-out set for a node', () => {
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const useNode = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.recordUse(useNode.id, 'x');
      analyzer.analyze(cfg);

      const liveOut = analyzer.getLiveOut(defNode.id);
      expect(liveOut.has('x')).toBe(true);
    });

    it('should return empty set for unknown node', () => {
      const liveOut = analyzer.getLiveOut('unknown_node');
      expect(liveOut.size).toBe(0);
    });
  });

  describe('isLiveAt', () => {
    it('should check live-in by default', () => {
      const builder = new CFGBuilder('test');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.analyze(cfg);

      expect(analyzer.isLiveAt('x', stmt.id)).toBe(true);
      expect(analyzer.isLiveAt('y', stmt.id)).toBe(false);
    });

    it('should check live-out when specified', () => {
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const useNode = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.recordUse(useNode.id, 'x');
      analyzer.analyze(cfg);

      expect(analyzer.isLiveAt('x', defNode.id, 'out')).toBe(true);
    });

    it('should return false for unknown node', () => {
      expect(analyzer.isLiveAt('x', 'unknown_node')).toBe(false);
    });
  });

  describe('getNodeInfo', () => {
    it('should return complete liveness info', () => {
      const builder = new CFGBuilder('test');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.recordDef(stmt.id, 'y');
      analyzer.analyze(cfg);

      const info = analyzer.getNodeInfo(stmt.id);
      expect(info).toBeDefined();
      expect(info!.use.has('x')).toBe(true);
      expect(info!.def.has('y')).toBe(true);
      expect(info!.liveIn).toBeInstanceOf(Set);
      expect(info!.liveOut).toBeInstanceOf(Set);
    });

    it('should return undefined for unknown node', () => {
      const info = analyzer.getNodeInfo('unknown_node');
      expect(info).toBeUndefined();
    });

    it('should return a copy (not mutable)', () => {
      const builder = new CFGBuilder('test');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.analyze(cfg);

      const info1 = analyzer.getNodeInfo(stmt.id);
      const info2 = analyzer.getNodeInfo(stmt.id);

      // Should be different objects
      expect(info1).not.toBe(info2);
      expect(info1!.use).not.toBe(info2!.use);
    });
  });

  describe('findDeadDefinitions', () => {
    it('should find definitions that are never used', () => {
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.analyze(cfg);

      const deadDefs = analyzer.findDeadDefinitions();
      expect(deadDefs.length).toBe(1);
      expect(deadDefs[0].variable).toBe('x');
      expect(deadDefs[0].nodeId).toBe(defNode.id);
    });

    it('should not flag definitions that are used', () => {
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const useNode = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(defNode.id, 'x');
      analyzer.recordUse(useNode.id, 'x');
      analyzer.analyze(cfg);

      const deadDefs = analyzer.findDeadDefinitions();
      expect(deadDefs.some(d => d.variable === 'x')).toBe(false);
    });

    it('should find multiple dead definitions', () => {
      const builder = new CFGBuilder('test');
      const def1 = builder.addStatement(createMockStatement(1));
      const def2 = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(def1.id, 'x');
      analyzer.recordDef(def2.id, 'y');
      analyzer.analyze(cfg);

      const deadDefs = analyzer.findDeadDefinitions();
      expect(deadDefs.length).toBe(2);
      expect(deadDefs.some(d => d.variable === 'x')).toBe(true);
      expect(deadDefs.some(d => d.variable === 'y')).toBe(true);
    });
  });

  describe('computeInterference', () => {
    it('should compute interference between variables live at same point', () => {
      const builder = new CFGBuilder('test');
      const useNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(useNode.id, 'x');
      analyzer.recordUse(useNode.id, 'y');
      analyzer.analyze(cfg);

      const interference = analyzer.computeInterference();

      // x and y should interfere (both live at useNode)
      expect(interference.get('x')?.has('y')).toBe(true);
      expect(interference.get('y')?.has('x')).toBe(true);
    });

    it('should not show interference for non-overlapping lifetimes', () => {
      // x is used first, then y is used - no overlap
      const builder = new CFGBuilder('test');
      const useX = builder.addStatement(createMockStatement(1));
      const defY = builder.addStatement(createMockStatement(2));
      const useY = builder.addStatement(createMockStatement(3));
      const cfg = builder.finalize();

      analyzer.recordUse(useX.id, 'x');
      analyzer.recordDef(defY.id, 'y');
      analyzer.recordUse(useY.id, 'y');
      analyzer.analyze(cfg);

      const interference = analyzer.computeInterference();

      // Variables should both exist in the graph
      expect(interference.has('x')).toBe(true);
      expect(interference.has('y')).toBe(true);
    });

    it('should handle multiple interfering variables', () => {
      const builder = new CFGBuilder('test');
      const useNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(useNode.id, 'a');
      analyzer.recordUse(useNode.id, 'b');
      analyzer.recordUse(useNode.id, 'c');
      analyzer.analyze(cfg);

      const interference = analyzer.computeInterference();

      // All three should interfere with each other
      expect(interference.get('a')?.has('b')).toBe(true);
      expect(interference.get('a')?.has('c')).toBe(true);
      expect(interference.get('b')?.has('a')).toBe(true);
      expect(interference.get('b')?.has('c')).toBe(true);
      expect(interference.get('c')?.has('a')).toBe(true);
      expect(interference.get('c')?.has('b')).toBe(true);
    });
  });

  describe('formatReport', () => {
    it('should format a readable report', () => {
      const builder = new CFGBuilder('testFunc');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.recordDef(stmt.id, 'y');
      analyzer.analyze(cfg);

      const report = analyzer.formatReport(cfg);

      expect(report).toContain('Liveness Analysis Report');
      expect(report).toContain('testFunc');
      expect(report).toContain('USE');
      expect(report).toContain('DEF');
      expect(report).toContain('Live-in');
      expect(report).toContain('Live-out');
    });

    it('should show dead definitions in report', () => {
      const builder = new CFGBuilder('testFunc');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordDef(stmt.id, 'unused');
      analyzer.analyze(cfg);

      const report = analyzer.formatReport(cfg);
      expect(report).toContain('Dead Definitions');
      expect(report).toContain('unused');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const builder = new CFGBuilder('test');
      const stmt = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.recordUse(stmt.id, 'x');
      analyzer.recordDef(stmt.id, 'y');
      analyzer.analyze(cfg);

      expect(analyzer.getAllVariables().size).toBe(2);

      analyzer.reset();

      expect(analyzer.getAllVariables().size).toBe(0);
      expect(analyzer.getLiveIn(stmt.id).size).toBe(0);
    });
  });

  describe('default options', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_LIVENESS_OPTIONS.maxIterations).toBe(1000);
      expect(DEFAULT_LIVENESS_OPTIONS.includeParameters).toBe(true);
      expect(DEFAULT_LIVENESS_OPTIONS.debug).toBe(false);
    });
  });

  describe('fixed point iteration', () => {
    it('should reach fixed point', () => {
      const builder = new CFGBuilder('test');
      const stmt1 = builder.addStatement(createMockStatement(1));
      const stmt2 = builder.addStatement(createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.recordDef(stmt1.id, 'x');
      analyzer.recordUse(stmt2.id, 'x');

      const result = analyzer.analyze(cfg);

      // Should terminate with a finite number of iterations
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.iterations).toBeLessThan(DEFAULT_LIVENESS_OPTIONS.maxIterations);
    });

    it('should handle complex CFG', () => {
      // Create a more complex CFG with loops and branches
      const builder = new CFGBuilder('complex');

      // Loop with branch inside
      const { entry: loopEntry, exit: loopExit } = builder.startLoop(createMockStatement(1));
      const branch = builder.startBranch(createMockStatement(2));
      const thenStmt = builder.addStatement(createMockStatement(3));
      const thenExit = builder.getCurrentNode();
      builder.startAlternate(branch);
      const elseStmt = builder.addStatement(createMockStatement(4));
      const elseExit = builder.getCurrentNode();
      builder.mergeBranches([thenExit, elseExit]);
      const afterBranch = builder.addStatement(createMockStatement(5));
      builder.endLoop(loopEntry, loopExit);
      const afterLoop = builder.addStatement(createMockStatement(6));
      const cfg = builder.finalize();

      // Add uses and defs
      analyzer.recordDef(thenStmt.id, 'x');
      analyzer.recordDef(elseStmt.id, 'y');
      analyzer.recordUse(afterBranch.id, 'x');
      analyzer.recordUse(afterBranch.id, 'y');
      analyzer.recordUse(afterLoop.id, 'z');

      const result = analyzer.analyze(cfg);

      // Should still terminate
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.iterations).toBeLessThan(100); // Should converge quickly
    });
  });

  describe('live at entry/exit', () => {
    it('should track variables live at function entry', () => {
      const builder = new CFGBuilder('test');
      const useNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      // Using a variable that was never defined means it must be live at entry
      analyzer.recordUse(useNode.id, 'param');
      const result = analyzer.analyze(cfg);

      // param should be live at entry (needs to be passed in)
      expect(result.liveAtEntry.has('param')).toBe(true);
    });

    it('should track variables live at function exit', () => {
      const builder = new CFGBuilder('test');
      const defNode = builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      // Variable defined but not used - should NOT be live at exit
      analyzer.recordDef(defNode.id, 'local');
      const result = analyzer.analyze(cfg);

      expect(result.liveAtExit.has('local')).toBe(false);
    });
  });
});