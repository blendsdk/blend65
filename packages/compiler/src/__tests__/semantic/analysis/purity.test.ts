/**
 * Tests for PurityAnalyzer
 *
 * Tests the purity analysis capabilities including:
 * - Detection of pure functions
 * - Detection of impure functions (global writes, intrinsic calls)
 * - Impurity propagation through call graph
 * - Configuration options
 *
 * @module tests/semantic/analysis/purity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PurityAnalyzer,
  PurityStatus,
  ImpurityKind,
  DEFAULT_PURITY_OPTIONS,
} from '../../../semantic/analysis/purity-analysis.js';
import { GlobalSymbolTable } from '../../../semantic/global-symbol-table.js';
import type { Symbol } from '../../../semantic/symbol.js';
import { SymbolKind } from '../../../semantic/symbol.js';
import type { SourceLocation } from '../../../ast/index.js';
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
    kind: ScopeKind.Module,
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
    type: null,
    location: createMockLocation(),
    scope,
    isExported: false,
    isConst: false,
    metadata: new Map(),
  };
}

describe('PurityAnalyzer', () => {
  let analyzer: PurityAnalyzer;
  let globalSymbolTable: GlobalSymbolTable;
  let functionSymbols: Map<string, Symbol>;

  beforeEach(() => {
    globalSymbolTable = new GlobalSymbolTable();
    functionSymbols = new Map();
    analyzer = new PurityAnalyzer(globalSymbolTable, functionSymbols);
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const customAnalyzer = new PurityAnalyzer(globalSymbolTable, functionSymbols, {
        strictGlobalReads: true,
      });
      expect(customAnalyzer).toBeDefined();
    });

    it('should use default pure intrinsics', () => {
      expect(DEFAULT_PURITY_OPTIONS.pureIntrinsics).toContain('hi');
      expect(DEFAULT_PURITY_OPTIONS.pureIntrinsics).toContain('lo');
      expect(DEFAULT_PURITY_OPTIONS.pureIntrinsics).toContain('len');
    });

    it('should use default impure intrinsics', () => {
      expect(DEFAULT_PURITY_OPTIONS.impureIntrinsics).toContain('poke');
    });
  });

  describe('initializeFunction', () => {
    it('should initialize tracking for a function', () => {
      analyzer.initializeFunction('myFunc');

      const result = analyzer.analyze();
      expect(result.totalFunctions).toBe(1);
    });

    it('should not duplicate when initialized twice', () => {
      analyzer.initializeFunction('myFunc');
      analyzer.initializeFunction('myFunc');

      const result = analyzer.analyze();
      expect(result.totalFunctions).toBe(1);
    });
  });

  describe('recordGlobalWrite', () => {
    it('should mark function as impure for global write', () => {
      const symbol = createMockSymbol('globalVar');
      const location = createMockLocation();

      analyzer.recordGlobalWrite('myFunc', symbol, location);
      analyzer.analyze();

      expect(analyzer.isImpure('myFunc')).toBe(true);
      expect(analyzer.isPure('myFunc')).toBe(false);
    });

    it('should record reason for impurity', () => {
      const symbol = createMockSymbol('globalVar');
      const location = createMockLocation();

      analyzer.recordGlobalWrite('myFunc', symbol, location);
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.impurityReasons).toHaveLength(1);
      expect(purity?.impurityReasons[0].kind).toBe(ImpurityKind.GlobalWrite);
      expect(purity?.impurityReasons[0].symbol?.name).toBe('globalVar');
    });

    it('should set writesGlobals flag', () => {
      const symbol = createMockSymbol('globalVar');
      analyzer.recordGlobalWrite('myFunc', symbol, createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.writesGlobals).toBe(true);
    });
  });

  describe('recordGlobalRead', () => {
    it('should not mark function as impure by default', () => {
      const symbol = createMockSymbol('globalVar');
      analyzer.recordGlobalRead('myFunc', symbol, createMockLocation());
      analyzer.analyze();

      expect(analyzer.isPure('myFunc')).toBe(true);
    });

    it('should mark function as impure in strict mode', () => {
      const strictAnalyzer = new PurityAnalyzer(globalSymbolTable, functionSymbols, {
        strictGlobalReads: true,
      });

      const symbol = createMockSymbol('globalVar');
      strictAnalyzer.recordGlobalRead('myFunc', symbol, createMockLocation());
      strictAnalyzer.analyze();

      expect(strictAnalyzer.isImpure('myFunc')).toBe(true);
    });

    it('should set readsGlobals flag', () => {
      const symbol = createMockSymbol('globalVar');
      analyzer.recordGlobalRead('myFunc', symbol, createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.readsGlobals).toBe(true);
    });
  });

  describe('recordArrayWrite', () => {
    it('should mark function as impure', () => {
      analyzer.recordArrayWrite('myFunc', createMockLocation());
      analyzer.analyze();

      expect(analyzer.isImpure('myFunc')).toBe(true);
    });

    it('should record array write reason', () => {
      analyzer.recordArrayWrite('myFunc', createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.impurityReasons[0].kind).toBe(ImpurityKind.ArrayWrite);
    });
  });

  describe('recordFunctionCall', () => {
    it('should track callee relationships', () => {
      analyzer.initializeFunction('caller');
      analyzer.initializeFunction('callee');
      analyzer.recordFunctionCall('caller', 'callee', createMockLocation());

      const purity = analyzer.getFunctionPurity('caller');
      expect(purity?.callees).toContain('callee');
    });

    it('should not duplicate callees', () => {
      analyzer.initializeFunction('caller');
      analyzer.recordFunctionCall('caller', 'callee', createMockLocation());
      analyzer.recordFunctionCall('caller', 'callee', createMockLocation());

      const purity = analyzer.getFunctionPurity('caller');
      expect(purity?.callees.filter(c => c === 'callee')).toHaveLength(1);
    });
  });

  describe('recordIntrinsicCall', () => {
    it('should mark function as impure for poke', () => {
      analyzer.recordIntrinsicCall('myFunc', 'poke', createMockLocation());
      analyzer.analyze();

      expect(analyzer.isImpure('myFunc')).toBe(true);
    });

    it('should keep function pure for hi/lo', () => {
      analyzer.recordIntrinsicCall('myFunc', 'hi', createMockLocation());
      analyzer.recordIntrinsicCall('myFunc', 'lo', createMockLocation());
      analyzer.analyze();

      expect(analyzer.isPure('myFunc')).toBe(true);
    });

    it('should set callsIntrinsics flag', () => {
      analyzer.recordIntrinsicCall('myFunc', 'hi', createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.callsIntrinsics).toBe(true);
    });

    it('should record reason for impure intrinsic', () => {
      analyzer.recordIntrinsicCall('myFunc', 'poke', createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('myFunc');
      expect(purity?.impurityReasons[0].kind).toBe(ImpurityKind.IntrinsicSideEffect);
      expect(purity?.impurityReasons[0].calledFunction).toBe('poke');
    });
  });

  describe('markUnknownBody', () => {
    it('should mark function as impure', () => {
      analyzer.markUnknownBody('externalFunc', createMockLocation());
      analyzer.analyze();

      expect(analyzer.isImpure('externalFunc')).toBe(true);
    });

    it('should record unknown body reason', () => {
      analyzer.markUnknownBody('externalFunc', createMockLocation());
      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('externalFunc');
      expect(purity?.impurityReasons[0].kind).toBe(ImpurityKind.UnknownBody);
    });
  });

  describe('analyze', () => {
    it('should mark functions without issues as pure', () => {
      analyzer.initializeFunction('pureFunc');
      analyzer.analyze();

      expect(analyzer.isPure('pureFunc')).toBe(true);
    });

    it('should propagate impurity through call graph', () => {
      // Setup: A calls B, B writes global
      analyzer.initializeFunction('funcA');
      analyzer.initializeFunction('funcB');
      analyzer.recordFunctionCall('funcA', 'funcB', createMockLocation());
      analyzer.recordGlobalWrite('funcB', createMockSymbol('global'), createMockLocation());

      analyzer.analyze();

      expect(analyzer.isImpure('funcB')).toBe(true);
      expect(analyzer.isImpure('funcA')).toBe(true);
    });

    it('should handle chain of calls', () => {
      // A -> B -> C (impure)
      analyzer.initializeFunction('funcA');
      analyzer.initializeFunction('funcB');
      analyzer.initializeFunction('funcC');
      analyzer.recordFunctionCall('funcA', 'funcB', createMockLocation());
      analyzer.recordFunctionCall('funcB', 'funcC', createMockLocation());
      analyzer.recordGlobalWrite('funcC', createMockSymbol('global'), createMockLocation());

      analyzer.analyze();

      expect(analyzer.isImpure('funcC')).toBe(true);
      expect(analyzer.isImpure('funcB')).toBe(true);
      expect(analyzer.isImpure('funcA')).toBe(true);
    });

    it('should mark callers of unknown functions as impure', () => {
      analyzer.initializeFunction('myFunc');
      analyzer.recordFunctionCall('myFunc', 'unknownExternalFunc', createMockLocation());

      analyzer.analyze();

      expect(analyzer.isImpure('myFunc')).toBe(true);
    });

    it('should not mark callers of pure intrinsics as impure', () => {
      analyzer.initializeFunction('myFunc');
      analyzer.recordFunctionCall('myFunc', 'hi', createMockLocation());

      analyzer.analyze();

      expect(analyzer.isPure('myFunc')).toBe(true);
    });
  });

  describe('isPure / isImpure', () => {
    it('should return true for pure function', () => {
      analyzer.initializeFunction('pureFunc');
      analyzer.analyze();

      expect(analyzer.isPure('pureFunc')).toBe(true);
      expect(analyzer.isImpure('pureFunc')).toBe(false);
    });

    it('should return true for impure function', () => {
      analyzer.recordGlobalWrite('impureFunc', createMockSymbol('x'), createMockLocation());
      analyzer.analyze();

      expect(analyzer.isImpure('impureFunc')).toBe(true);
      expect(analyzer.isPure('impureFunc')).toBe(false);
    });

    it('should return false for unknown function', () => {
      expect(analyzer.isPure('unknownFunc')).toBe(false);
      expect(analyzer.isImpure('unknownFunc')).toBe(false);
    });
  });

  describe('getPureFunctions / getImpureFunctions', () => {
    it('should return lists of pure and impure functions', () => {
      analyzer.initializeFunction('pureFunc1');
      analyzer.initializeFunction('pureFunc2');
      analyzer.recordGlobalWrite('impureFunc', createMockSymbol('x'), createMockLocation());

      analyzer.analyze();

      const pureFuncs = analyzer.getPureFunctions();
      const impureFuncs = analyzer.getImpureFunctions();

      expect(pureFuncs).toContain('pureFunc1');
      expect(pureFuncs).toContain('pureFunc2');
      expect(impureFuncs).toContain('impureFunc');
      expect(pureFuncs).not.toContain('impureFunc');
    });
  });

  describe('getResult', () => {
    it('should return complete statistics', () => {
      analyzer.initializeFunction('pure1');
      analyzer.initializeFunction('pure2');
      analyzer.recordGlobalWrite('impure1', createMockSymbol('x'), createMockLocation());

      const result = analyzer.analyze();

      expect(result.totalFunctions).toBe(3);
      expect(result.pureCount).toBe(2);
      expect(result.impureCount).toBe(1);
      expect(result.purityPercentage).toBeCloseTo(66.67, 1);
    });

    it('should return 0% purity for all impure', () => {
      analyzer.recordGlobalWrite('impure1', createMockSymbol('x'), createMockLocation());
      analyzer.recordGlobalWrite('impure2', createMockSymbol('y'), createMockLocation());

      const result = analyzer.analyze();

      expect(result.purityPercentage).toBe(0);
    });

    it('should return 100% purity for all pure', () => {
      analyzer.initializeFunction('pure1');
      analyzer.initializeFunction('pure2');

      const result = analyzer.analyze();

      expect(result.purityPercentage).toBe(100);
    });
  });

  describe('formatReport', () => {
    it('should format report with no functions', () => {
      const report = analyzer.formatReport();
      expect(report).toContain('No functions analyzed');
    });

    it('should format report with pure functions', () => {
      analyzer.initializeFunction('pureFunc');
      analyzer.analyze();

      const report = analyzer.formatReport();
      expect(report).toContain('Pure Functions');
      expect(report).toContain('pureFunc');
    });

    it('should format report with impure functions', () => {
      analyzer.recordGlobalWrite('impureFunc', createMockSymbol('x'), createMockLocation());
      analyzer.analyze();

      const report = analyzer.formatReport();
      expect(report).toContain('Impure Functions');
      expect(report).toContain('impureFunc');
      expect(report).toContain('Writes to global');
    });

    it('should include statistics', () => {
      analyzer.initializeFunction('pureFunc');
      analyzer.analyze();

      const report = analyzer.formatReport();
      expect(report).toContain('Total functions: 1');
      expect(report).toContain('100.0%');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      analyzer.initializeFunction('func');
      analyzer.recordGlobalWrite('func', createMockSymbol('x'), createMockLocation());
      analyzer.analyze();

      expect(analyzer.getResult().totalFunctions).toBe(1);

      analyzer.reset();

      expect(analyzer.getResult().totalFunctions).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle self-recursion', () => {
      analyzer.initializeFunction('recursive');
      analyzer.recordFunctionCall('recursive', 'recursive', createMockLocation());
      analyzer.analyze();

      // Self-recursion doesn't add impurity by itself
      expect(analyzer.isPure('recursive')).toBe(true);
    });

    it('should handle mutual recursion', () => {
      analyzer.initializeFunction('funcA');
      analyzer.initializeFunction('funcB');
      analyzer.recordFunctionCall('funcA', 'funcB', createMockLocation());
      analyzer.recordFunctionCall('funcB', 'funcA', createMockLocation());
      analyzer.analyze();

      // Mutual recursion without side effects is pure
      expect(analyzer.isPure('funcA')).toBe(true);
      expect(analyzer.isPure('funcB')).toBe(true);
    });

    it('should handle multiple impurity reasons', () => {
      analyzer.recordGlobalWrite('func', createMockSymbol('x'), createMockLocation());
      analyzer.recordArrayWrite('func', createMockLocation());
      analyzer.recordIntrinsicCall('func', 'poke', createMockLocation());

      analyzer.analyze();

      const purity = analyzer.getFunctionPurity('func');
      expect(purity?.impurityReasons.length).toBeGreaterThanOrEqual(3);
    });
  });
});