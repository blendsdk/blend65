/**
 * Tests for DeadCodeAnalyzer
 *
 * Tests the dead code detection capabilities using CFG analysis.
 * The analyzer detects unreachable code after:
 * - Return statements
 * - Break statements
 * - Continue statements
 * - Infinite loops
 *
 * @module tests/semantic/analysis/dead-code
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeadCodeAnalyzer,
  DeadCodeSeverity,
  DeadCodeIssueKind,
} from '../../../semantic/analysis/dead-code.js';
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

/**
 * Create a mock return statement
 */
function createMockReturn(line: number, column: number = 1): Statement {
  const location: SourceLocation = {
    start: { line, column, offset: 0 },
    end: { line, column: column + 6, offset: 6 },
  };

  return {
    getNodeType: () => 'ReturnStatement',
    getLocation: () => location,
    getChildren: () => [],
    accept: () => {},
  } as unknown as Statement;
}

describe('DeadCodeAnalyzer', () => {
  let analyzer: DeadCodeAnalyzer;

  beforeEach(() => {
    analyzer = new DeadCodeAnalyzer();
  });

  describe('constructor', () => {
    it('should create analyzer with empty state', () => {
      expect(analyzer.getIssues()).toHaveLength(0);
      expect(analyzer.hasDeadCode()).toBe(false);
      expect(analyzer.getDeadCodeCount()).toBe(0);
    });
  });

  describe('analyzeFunction', () => {
    it('should detect no issues in simple sequential code', () => {
      // Build a simple CFG: entry -> stmt1 -> stmt2 -> exit
      const cfg = new ControlFlowGraph('testFunc');
      const stmt1 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(1));
      const stmt2 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));

      cfg.addEdge(cfg.entry, stmt1);
      cfg.addEdge(stmt1, stmt2);
      cfg.addEdge(stmt2, cfg.exit);
      cfg.computeReachability();

      analyzer.analyzeFunction(cfg, 'testFunc');

      expect(analyzer.hasDeadCode()).toBe(false);
      expect(analyzer.getIssues()).toHaveLength(0);
    });

    it('should detect unreachable code after return', () => {
      // Build CFG: entry -> stmt1 -> return -> unreachable -> exit
      const builder = new CFGBuilder('testFunc');
      builder.addStatement(createMockStatement(1));
      builder.addReturn(createMockReturn(2));

      // Add unreachable code (won't be connected since current is null after return)
      const unreachableNode = builder.cfg.createNode(
        CFGNodeKind.Statement,
        createMockStatement(3)
      );
      // Don't connect it - it's unreachable

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'testFunc');

      expect(analyzer.hasDeadCode()).toBe(true);
      expect(analyzer.getIssues()).toHaveLength(1);

      const issue = analyzer.getIssues()[0];
      expect(issue.kind).toBe(DeadCodeIssueKind.AfterReturn);
      expect(issue.severity).toBe(DeadCodeSeverity.Warning);
      expect(issue.functionName).toBe('testFunc');
      expect(issue.causedBy).toBe('return');
    });

    it('should detect unreachable code after break', () => {
      const builder = new CFGBuilder('loopFunc');

      // Start loop
      const { entry: loopEntry, exit: loopExit } = builder.startLoop(createMockStatement(1));

      // Add statement in loop
      builder.addStatement(createMockStatement(2));

      // Add break
      builder.addBreak(createMockStatement(3));

      // Add unreachable statement after break (in loop body)
      const unreachableNode = builder.cfg.createNode(
        CFGNodeKind.Statement,
        createMockStatement(4)
      );

      builder.endLoop(loopEntry, loopExit);

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'loopFunc');

      expect(analyzer.hasDeadCode()).toBe(true);

      const issues = analyzer.getIssues();
      const breakIssue = issues.find(i => i.causedBy === 'break');
      expect(breakIssue).toBeDefined();
      if (breakIssue) {
        expect(breakIssue.kind).toBe(DeadCodeIssueKind.AfterBreak);
      }
    });

    it('should detect unreachable code after continue', () => {
      const builder = new CFGBuilder('loopFunc');

      // Start loop
      const { entry: loopEntry, exit: loopExit } = builder.startLoop(createMockStatement(1));

      // Add continue
      builder.addContinue(createMockStatement(2));

      // Add unreachable statement after continue
      const unreachableNode = builder.cfg.createNode(
        CFGNodeKind.Statement,
        createMockStatement(3)
      );

      builder.endLoop(loopEntry, loopExit);

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'loopFunc');

      expect(analyzer.hasDeadCode()).toBe(true);

      const issues = analyzer.getIssues();
      const continueIssue = issues.find(i => i.causedBy === 'continue');
      expect(continueIssue).toBeDefined();
      if (continueIssue) {
        expect(continueIssue.kind).toBe(DeadCodeIssueKind.AfterContinue);
      }
    });

    it('should handle multiple functions', () => {
      // First function with dead code
      const builder1 = new CFGBuilder('func1');
      builder1.addStatement(createMockStatement(1));
      builder1.addReturn(createMockReturn(2));
      builder1.cfg.createNode(CFGNodeKind.Statement, createMockStatement(3)); // unreachable
      const cfg1 = builder1.finalize();

      // Second function without dead code
      const builder2 = new CFGBuilder('func2');
      builder2.addStatement(createMockStatement(1));
      builder2.addStatement(createMockStatement(2));
      const cfg2 = builder2.finalize();

      analyzer.analyzeFunction(cfg1, 'func1');
      analyzer.analyzeFunction(cfg2, 'func2');

      expect(analyzer.hasDeadCode()).toBe(true);
      expect(analyzer.getFunctionIssues('func1')).toHaveLength(1);
      expect(analyzer.getFunctionIssues('func2')).toHaveLength(0);
    });
  });

  describe('analyzeFunctions', () => {
    it('should analyze multiple functions at once', () => {
      const builder1 = new CFGBuilder('func1');
      builder1.addStatement(createMockStatement(1));
      builder1.addReturn(createMockReturn(2));
      builder1.cfg.createNode(CFGNodeKind.Statement, createMockStatement(3));
      const cfg1 = builder1.finalize();

      const builder2 = new CFGBuilder('func2');
      builder2.addStatement(createMockStatement(1));
      const cfg2 = builder2.finalize();

      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('func1', cfg1);
      cfgs.set('func2', cfg2);

      analyzer.analyzeFunctions(cfgs);

      expect(analyzer.hasDeadCode()).toBe(true);
      const result = analyzer.getResult();
      expect(result.functionsAnalyzed).toBe(2);
      expect(result.issuesByFunction.get('func1')?.length).toBe(1);
    });
  });

  describe('getResult', () => {
    it('should return complete statistics', () => {
      const builder = new CFGBuilder('testFunc');
      builder.addStatement(createMockStatement(1));
      builder.addStatement(createMockStatement(2));
      builder.addReturn(createMockReturn(3));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(4)); // dead
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'testFunc');

      const result = analyzer.getResult();
      expect(result.hasIssues).toBe(true);
      expect(result.functionsAnalyzed).toBe(1);
      expect(result.totalStatements).toBeGreaterThan(0);
      expect(result.deadStatements).toBe(1);
      expect(result.deadCodePercentage).toBeGreaterThan(0);
      expect(result.issuesByFunction).toBeInstanceOf(Map);
    });

    it('should calculate dead code percentage correctly', () => {
      // Create function with 2 reachable and 2 unreachable statements
      const cfg = new ControlFlowGraph('testFunc');

      const stmt1 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(1));
      const stmt2 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const returnNode = cfg.createNode(CFGNodeKind.Return, createMockReturn(3));
      const dead1 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(4));
      const dead2 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(5));

      cfg.addEdge(cfg.entry, stmt1);
      cfg.addEdge(stmt1, stmt2);
      cfg.addEdge(stmt2, returnNode);
      cfg.addEdge(returnNode, cfg.exit);
      // dead1 and dead2 are not connected

      cfg.computeReachability();
      analyzer.analyzeFunction(cfg, 'testFunc');

      const result = analyzer.getResult();
      expect(result.deadStatements).toBe(2);
      // Percentage depends on total statement count
      expect(result.deadCodePercentage).toBeGreaterThan(0);
      expect(result.deadCodePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('getFunctionIssues', () => {
    it('should return issues for specific function', () => {
      const builder = new CFGBuilder('myFunc');
      builder.addReturn(createMockReturn(1));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'myFunc');

      const issues = analyzer.getFunctionIssues('myFunc');
      expect(issues).toHaveLength(1);
      expect(issues[0].functionName).toBe('myFunc');
    });

    it('should return empty array for unknown function', () => {
      const issues = analyzer.getFunctionIssues('unknownFunc');
      expect(issues).toEqual([]);
    });
  });

  describe('formatReport', () => {
    it('should format report with no issues', () => {
      const builder = new CFGBuilder('cleanFunc');
      builder.addStatement(createMockStatement(1));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'cleanFunc');

      const report = analyzer.formatReport();
      expect(report).toContain('No issues found');
      expect(report).toContain('1 functions');
    });

    it('should format report with issues', () => {
      const builder = new CFGBuilder('problemFunc');
      builder.addReturn(createMockReturn(1));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'problemFunc');

      const report = analyzer.formatReport();
      expect(report).toContain('Dead Code Analysis Report');
      expect(report).toContain('problemFunc');
      expect(report).toContain('WARNING');
      expect(report).toContain('suggestion');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const builder = new CFGBuilder('func');
      builder.addReturn(createMockReturn(1));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');
      expect(analyzer.hasDeadCode()).toBe(true);

      analyzer.reset();

      expect(analyzer.hasDeadCode()).toBe(false);
      expect(analyzer.getIssues()).toHaveLength(0);
      expect(analyzer.getDeadCodeCount()).toBe(0);
    });
  });

  describe('issue kinds', () => {
    it('should use AfterReturn for code after return', () => {
      const builder = new CFGBuilder('func');
      builder.addReturn(createMockReturn(1));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');

      const issue = analyzer.getIssues()[0];
      expect(issue.kind).toBe(DeadCodeIssueKind.AfterReturn);
    });

    it('should use AfterBreak for code after break', () => {
      const builder = new CFGBuilder('func');
      const { entry, exit } = builder.startLoop(createMockStatement(1));
      builder.addBreak(createMockStatement(2));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(3));
      builder.endLoop(entry, exit);
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');

      const issues = analyzer.getIssues();
      expect(issues.some(i => i.kind === DeadCodeIssueKind.AfterBreak)).toBe(true);
    });

    it('should use AfterContinue for code after continue', () => {
      const builder = new CFGBuilder('func');
      const { entry, exit } = builder.startLoop(createMockStatement(1));
      builder.addContinue(createMockStatement(2));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(3));
      builder.endLoop(entry, exit);
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');

      const issues = analyzer.getIssues();
      expect(issues.some(i => i.kind === DeadCodeIssueKind.AfterContinue)).toBe(true);
    });

    it('should use Unreachable for general unreachable code', () => {
      // Create CFG with unreachable code not caused by a specific terminator
      const cfg = new ControlFlowGraph('func');
      const stmt1 = cfg.createNode(CFGNodeKind.Statement, createMockStatement(1));
      const unreachable = cfg.createNode(CFGNodeKind.Statement, createMockStatement(10));

      cfg.addEdge(cfg.entry, stmt1);
      cfg.addEdge(stmt1, cfg.exit);
      // unreachable is not connected

      cfg.computeReachability();
      analyzer.analyzeFunction(cfg, 'func');

      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe(DeadCodeIssueKind.Unreachable);
    });
  });

  describe('issue details', () => {
    it('should include statement and location in issue', () => {
      const builder = new CFGBuilder('func');
      builder.addReturn(createMockReturn(5));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(10, 5));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');

      const issue = analyzer.getIssues()[0];
      expect(issue.statement).toBeDefined();
      expect(issue.location).toBeDefined();
      expect(issue.location.start.line).toBe(10);
      expect(issue.location.start.column).toBe(5);
    });

    it('should include message and suggestion', () => {
      const builder = new CFGBuilder('func');
      builder.addReturn(createMockReturn(1));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(2));
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'func');

      const issue = analyzer.getIssues()[0];
      expect(issue.message).toContain('Unreachable');
      expect(issue.suggestion).toBeDefined();
      expect(issue.suggestion.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty function', () => {
      const builder = new CFGBuilder('emptyFunc');
      const cfg = builder.finalize();

      analyzer.analyzeFunction(cfg, 'emptyFunc');

      expect(analyzer.hasDeadCode()).toBe(false);
    });

    it('should handle function with only entry and exit', () => {
      const cfg = new ControlFlowGraph('minimalFunc');
      cfg.addEdge(cfg.entry, cfg.exit);
      cfg.computeReachability();

      analyzer.analyzeFunction(cfg, 'minimalFunc');

      expect(analyzer.hasDeadCode()).toBe(false);
    });

    it('should handle nested loops with dead code', () => {
      const builder = new CFGBuilder('nestedFunc');

      // Outer loop
      const { entry: outerEntry, exit: outerExit } = builder.startLoop(createMockStatement(1));

      // Inner loop
      const { entry: innerEntry, exit: innerExit } = builder.startLoop(createMockStatement(2));
      builder.addBreak(createMockStatement(3));
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(4)); // dead in inner
      builder.endLoop(innerEntry, innerExit);

      builder.addStatement(createMockStatement(5));
      builder.endLoop(outerEntry, outerExit);

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'nestedFunc');

      expect(analyzer.hasDeadCode()).toBe(true);
    });

    it('should handle branching code without dead code', () => {
      const builder = new CFGBuilder('branchFunc');

      // Create branch
      const branchNode = builder.startBranch(createMockStatement(1));
      builder.addStatement(createMockStatement(2)); // then branch
      const thenExit = builder.getCurrentNode();

      builder.startAlternate(branchNode);
      builder.addStatement(createMockStatement(3)); // else branch
      const elseExit = builder.getCurrentNode();

      builder.mergeBranches([thenExit, elseExit]);
      builder.addStatement(createMockStatement(4)); // after merge

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'branchFunc');

      expect(analyzer.hasDeadCode()).toBe(false);
    });

    it('should handle both branches terminating', () => {
      const builder = new CFGBuilder('bothTerminateFunc');

      // Create branch where both sides return
      const branchNode = builder.startBranch(createMockStatement(1));
      builder.addReturn(createMockReturn(2)); // then branch returns
      const thenExit = builder.getCurrentNode();

      builder.startAlternate(branchNode);
      builder.addReturn(createMockReturn(3)); // else branch returns
      const elseExit = builder.getCurrentNode();

      builder.mergeBranches([thenExit, elseExit]);

      // Add unreachable code after both branches terminate
      builder.cfg.createNode(CFGNodeKind.Statement, createMockStatement(4));

      const cfg = builder.finalize();
      analyzer.analyzeFunction(cfg, 'bothTerminateFunc');

      expect(analyzer.hasDeadCode()).toBe(true);
    });
  });
});