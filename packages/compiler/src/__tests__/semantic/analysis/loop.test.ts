/**
 * Tests for LoopAnalyzer
 *
 * Tests the loop analysis capabilities including:
 * - Loop registration and tracking
 * - Nesting depth calculation
 * - Induction variable detection
 * - Loop invariant tracking
 * - Unroll candidate identification
 *
 * @module tests/semantic/analysis/loop
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoopAnalyzer,
  LoopKind,
  InductionVariableKind,
  DEFAULT_LOOP_OPTIONS,
} from '../../../semantic/analysis/loop-analysis.js';
import type { Symbol } from '../../../semantic/symbol.js';
import { SymbolKind } from '../../../semantic/symbol.js';
import type { SourceLocation, Expression } from '../../../ast/index.js';
import { ScopeKind, type Scope } from '../../../semantic/scope.js';

/**
 * Create a mock location for testing
 */
function createMockLocation(line: number = 1): SourceLocation {
  return {
    start: { line, column: 1, offset: 0 },
    end: { line, column: 10, offset: 10 },
  };
}

/**
 * Create a mock scope for testing
 */
function createMockScope(id: string = 'test_scope'): Scope {
  return {
    id,
    kind: ScopeKind.Function,
    parent: null,
    children: [],
    symbols: new Map(),
    node: null,
  };
}

/**
 * Create a mock symbol for testing
 */
function createMockSymbol(name: string, kind: SymbolKind = SymbolKind.Variable): Symbol {
  const scope = createMockScope();
  return {
    name,
    kind,
    type: { kind: 'byte' as any, name: 'byte', size: 1, isSigned: false, isAssignable: true },
    location: createMockLocation(),
    scope,
    isExported: false,
    isConst: false,
    metadata: new Map(),
  };
}

/**
 * Create a mock expression for testing
 */
function createMockExpression(): Expression {
  return {
    getNodeType: () => 'NumericLiteral',
    getLocation: () => createMockLocation(),
    getChildren: () => [],
    accept: () => {},
  } as unknown as Expression;
}

describe('LoopAnalyzer', () => {
  let analyzer: LoopAnalyzer;

  beforeEach(() => {
    analyzer = new LoopAnalyzer();
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const customAnalyzer = new LoopAnalyzer({
        maxUnrollIterations: 16,
      });
      expect(customAnalyzer).toBeDefined();
    });

    it('should have correct default options', () => {
      expect(DEFAULT_LOOP_OPTIONS.detectInvariants).toBe(true);
      expect(DEFAULT_LOOP_OPTIONS.detectInductionVariables).toBe(true);
      expect(DEFAULT_LOOP_OPTIONS.maxUnrollIterations).toBe(8);
    });
  });

  describe('registerLoop', () => {
    it('should register a new loop', () => {
      const loopId = analyzer.registerLoop('testFunc', LoopKind.For, createMockLocation());

      expect(loopId).toBeDefined();
      expect(loopId).toContain('loop_');
    });

    it('should assign unique IDs to each loop', () => {
      const id1 = analyzer.registerLoop('testFunc', LoopKind.For, createMockLocation());
      const id2 = analyzer.registerLoop('testFunc', LoopKind.While, createMockLocation());

      expect(id1).not.toBe(id2);
    });

    it('should track loop kind', () => {
      const loopId = analyzer.registerLoop('testFunc', LoopKind.While, createMockLocation());
      const loop = analyzer.getLoop(loopId);

      expect(loop?.kind).toBe(LoopKind.While);
    });

    it('should track function name', () => {
      const loopId = analyzer.registerLoop('myFunction', LoopKind.For, createMockLocation());
      const loop = analyzer.getLoop(loopId);

      expect(loop?.functionName).toBe('myFunction');
    });

    it('should track source location', () => {
      const location = createMockLocation(42);
      const loopId = analyzer.registerLoop('testFunc', LoopKind.For, location);
      const loop = analyzer.getLoop(loopId);

      expect(loop?.location.start.line).toBe(42);
    });
  });

  describe('enterLoop / exitLoop', () => {
    it('should track nesting depth', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const inner = analyzer.registerLoop('func', LoopKind.While, createMockLocation());

      const outerLoop = analyzer.getLoop(outer);
      const innerLoop = analyzer.getLoop(inner);

      expect(outerLoop?.nestingDepth).toBe(0);
      expect(innerLoop?.nestingDepth).toBe(1);
    });

    it('should track parent loop', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const inner = analyzer.registerLoop('func', LoopKind.While, createMockLocation());

      const innerLoop = analyzer.getLoop(inner);
      expect(innerLoop?.parentLoopId).toBe(outer);
    });

    it('should track child loops', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const inner = analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      analyzer.exitLoop(inner);
      analyzer.exitLoop(outer);

      const outerLoop = analyzer.getLoop(outer);
      expect(outerLoop?.childLoopIds).toContain(inner);
    });

    it('should handle deeply nested loops', () => {
      const loop1 = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(loop1);

      const loop2 = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(loop2);

      const loop3 = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      expect(analyzer.getLoop(loop1)?.nestingDepth).toBe(0);
      expect(analyzer.getLoop(loop2)?.nestingDepth).toBe(1);
      expect(analyzer.getLoop(loop3)?.nestingDepth).toBe(2);
    });
  });

  describe('getCurrentLoop', () => {
    it('should return undefined when not in a loop', () => {
      expect(analyzer.getCurrentLoop()).toBeUndefined();
    });

    it('should return current loop ID', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(loopId);

      expect(analyzer.getCurrentLoop()).toBe(loopId);
    });

    it('should return innermost loop', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const inner = analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      analyzer.enterLoop(inner);

      expect(analyzer.getCurrentLoop()).toBe(inner);
    });
  });

  describe('recordModifiedVariable', () => {
    it('should track modified variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      const symbol = createMockSymbol('counter');

      analyzer.recordModifiedVariable(loopId, symbol);

      const loop = analyzer.getLoop(loopId);
      expect(loop?.modifiedVariables).toHaveLength(1);
      expect(loop?.modifiedVariables[0].name).toBe('counter');
    });

    it('should not duplicate modified variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      const symbol = createMockSymbol('counter');

      analyzer.recordModifiedVariable(loopId, symbol);
      analyzer.recordModifiedVariable(loopId, symbol);

      const loop = analyzer.getLoop(loopId);
      expect(loop?.modifiedVariables).toHaveLength(1);
    });
  });

  describe('recordReadVariable', () => {
    it('should track read variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      const symbol = createMockSymbol('limit');

      analyzer.recordReadVariable(loopId, symbol);

      const loop = analyzer.getLoop(loopId);
      expect(loop?.readVariables).toHaveLength(1);
      expect(loop?.readVariables[0].name).toBe('limit');
    });
  });

  describe('recordInductionVariable', () => {
    it('should track induction variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      const symbol = createMockSymbol('i');

      analyzer.recordInductionVariable(loopId, {
        symbol,
        kind: InductionVariableKind.Basic,
        increment: 1,
        isPrimary: true,
      });

      const loop = analyzer.getLoop(loopId);
      expect(loop?.inductionVariables).toHaveLength(1);
      expect(loop?.inductionVariables[0].symbol.name).toBe('i');
      expect(loop?.inductionVariables[0].kind).toBe(InductionVariableKind.Basic);
    });

    it('should track derived induction variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      const baseSymbol = createMockSymbol('i');
      const derivedSymbol = createMockSymbol('j');

      analyzer.recordInductionVariable(loopId, {
        symbol: derivedSymbol,
        kind: InductionVariableKind.Derived,
        baseVariable: baseSymbol,
        multiplier: 2,
        constant: 1,
        isPrimary: false,
      });

      const loop = analyzer.getLoop(loopId);
      expect(loop?.inductionVariables[0].kind).toBe(InductionVariableKind.Derived);
      expect(loop?.inductionVariables[0].multiplier).toBe(2);
    });
  });

  describe('recordInvariant', () => {
    it('should track loop invariant expressions', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      analyzer.recordInvariant(loopId, {
        expression: createMockExpression(),
        location: createMockLocation(),
        usedVariables: [],
        reason: 'Constant expression',
        estimatedBenefit: 5,
      });

      const loop = analyzer.getLoop(loopId);
      expect(loop?.invariants).toHaveLength(1);
      expect(loop?.invariants[0].reason).toBe('Constant expression');
    });

    it('should filter out low-benefit invariants', () => {
      const lowBenefitAnalyzer = new LoopAnalyzer({ minInvariantBenefit: 10 });
      const loopId = lowBenefitAnalyzer.registerLoop('func', LoopKind.For, createMockLocation());

      lowBenefitAnalyzer.recordInvariant(loopId, {
        expression: createMockExpression(),
        location: createMockLocation(),
        usedVariables: [],
        reason: 'Low benefit',
        estimatedBenefit: 5, // Below threshold
      });

      const loop = lowBenefitAnalyzer.getLoop(loopId);
      expect(loop?.invariants).toHaveLength(0);
    });
  });

  describe('setIterationCount', () => {
    it('should set iteration count', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      analyzer.setIterationCount(loopId, 10, true);

      const loop = analyzer.getLoop(loopId);
      expect(loop?.estimatedIterations).toBe(10);
      expect(loop?.isCountable).toBe(true);
    });
  });

  describe('getLoops', () => {
    it('should return all loops', () => {
      analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.registerLoop('func', LoopKind.While, createMockLocation());

      const loops = analyzer.getLoops();
      expect(loops.size).toBe(2);
    });
  });

  describe('getLoopsInFunction', () => {
    it('should return loops in specific function', () => {
      analyzer.registerLoop('funcA', LoopKind.For, createMockLocation());
      analyzer.registerLoop('funcA', LoopKind.While, createMockLocation());
      analyzer.registerLoop('funcB', LoopKind.For, createMockLocation());

      const funcALoops = analyzer.getLoopsInFunction('funcA');
      const funcBLoops = analyzer.getLoopsInFunction('funcB');

      expect(funcALoops).toHaveLength(2);
      expect(funcBLoops).toHaveLength(1);
    });
  });

  describe('getNestedLoops', () => {
    it('should return nested loops', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const inner1 = analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      const inner2 = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      const nested = analyzer.getNestedLoops(outer);
      expect(nested).toHaveLength(2);
    });

    it('should return empty for loop without children', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      const nested = analyzer.getNestedLoops(loopId);
      expect(nested).toHaveLength(0);
    });
  });

  describe('isUnrollCandidate', () => {
    it('should identify unroll candidates', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 4, true);

      expect(analyzer.isUnrollCandidate(loopId)).toBe(true);
    });

    it('should reject loops without known count', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      // No iteration count set

      expect(analyzer.isUnrollCandidate(loopId)).toBe(false);
    });

    it('should reject loops exceeding max iterations', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 100, true);

      expect(analyzer.isUnrollCandidate(loopId)).toBe(false);
    });

    it('should reject loops with nested loops', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(outer, 4, true);
      analyzer.enterLoop(outer);

      analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      analyzer.exitLoop(outer);

      expect(analyzer.isUnrollCandidate(outer)).toBe(false);
    });

    it('should reject loops with zero iterations', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 0, true);

      expect(analyzer.isUnrollCandidate(loopId)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should return analysis result', () => {
      analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.registerLoop('func', LoopKind.While, createMockLocation());

      const result = analyzer.analyze();

      expect(result.totalLoops).toBe(2);
    });

    it('should calculate max nesting depth', () => {
      const outer = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.enterLoop(outer);

      const middle = analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      analyzer.enterLoop(middle);

      analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      const result = analyzer.analyze();
      expect(result.maxNestingDepth).toBe(2);
    });

    it('should count invariants', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      analyzer.recordInvariant(loopId, {
        expression: createMockExpression(),
        location: createMockLocation(),
        usedVariables: [],
        reason: 'Test',
        estimatedBenefit: 5,
      });

      const result = analyzer.analyze();
      expect(result.totalInvariants).toBe(1);
    });

    it('should count induction variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());

      analyzer.recordInductionVariable(loopId, {
        symbol: createMockSymbol('i'),
        kind: InductionVariableKind.Basic,
        isPrimary: true,
      });

      const result = analyzer.analyze();
      expect(result.totalInductionVariables).toBe(1);
    });

    it('should identify unroll candidates', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 4, true);

      const result = analyzer.analyze();
      expect(result.unrollCandidates).toContain(loopId);
    });
  });

  describe('formatReport', () => {
    it('should format report with no loops', () => {
      const report = analyzer.formatReport();
      expect(report).toContain('No loops found');
    });

    it('should format report with loops', () => {
      const loopId = analyzer.registerLoop('myFunc', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 10, true);

      const report = analyzer.formatReport();
      expect(report).toContain('Loop Analysis Report');
      expect(report).toContain('myFunc');
      expect(report).toContain('for');
      expect(report).toContain('10 iterations');
    });

    it('should show unroll candidates', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.setIterationCount(loopId, 4, true);

      const report = analyzer.formatReport();
      expect(report).toContain('Unroll candidate');
    });

    it('should show induction variables', () => {
      const loopId = analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.recordInductionVariable(loopId, {
        symbol: createMockSymbol('counter'),
        kind: InductionVariableKind.Basic,
        isPrimary: true,
      });

      const report = analyzer.formatReport();
      expect(report).toContain('Induction vars');
      expect(report).toContain('counter');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.registerLoop('func', LoopKind.While, createMockLocation());

      expect(analyzer.getResult().totalLoops).toBe(2);

      analyzer.reset();

      expect(analyzer.getResult().totalLoops).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown loop ID', () => {
      expect(analyzer.getLoop('unknown')).toBeUndefined();
      expect(analyzer.isUnrollCandidate('unknown')).toBe(false);
    });

    it('should handle loop kinds', () => {
      analyzer.registerLoop('func', LoopKind.While, createMockLocation());
      analyzer.registerLoop('func', LoopKind.For, createMockLocation());
      analyzer.registerLoop('func', LoopKind.DoWhile, createMockLocation());
      analyzer.registerLoop('func', LoopKind.Infinite, createMockLocation());

      const result = analyzer.analyze();
      expect(result.totalLoops).toBe(4);
    });

    it('should handle empty function', () => {
      const loops = analyzer.getLoopsInFunction('emptyFunc');
      expect(loops).toHaveLength(0);
    });
  });
});