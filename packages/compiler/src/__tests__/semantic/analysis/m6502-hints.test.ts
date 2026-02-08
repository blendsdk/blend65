/**
 * Tests for M6502HintAnalyzer
 *
 * Tests the 6502-specific optimization hint generation including:
 * - Zero-page candidate detection
 * - Hot variable identification
 * - Inline candidate detection
 * - Tail-call candidate detection
 *
 * @module tests/semantic/analysis/m6502-hints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  M6502HintAnalyzer,
  M6502HintKind,
  HintPriority,
  DEFAULT_M6502_OPTIONS,
} from '../../../semantic/analysis/m6502-hints.js';
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
function createMockSymbol(name: string, size: number = 1): Symbol {
  const scope = createMockScope();
  return {
    name,
    kind: SymbolKind.Variable,
    type: { kind: 'byte' as any, name: 'byte', size, isSigned: false, isAssignable: true },
    location: createMockLocation(),
    scope,
    isExported: false,
    isConst: false,
    metadata: new Map(),
  };
}

/**
 * Create a mock function symbol
 */
function createMockFunctionSymbol(name: string): Symbol {
  const scope = createMockScope();
  return {
    name,
    kind: SymbolKind.Function,
    type: null,
    location: createMockLocation(),
    scope,
    isExported: false,
    isConst: false,
    metadata: new Map(),
  };
}

describe('M6502HintAnalyzer', () => {
  let analyzer: M6502HintAnalyzer;
  let globalSymbolTable: GlobalSymbolTable;
  let functionSymbols: Map<string, Symbol>;

  beforeEach(() => {
    globalSymbolTable = new GlobalSymbolTable();
    functionSymbols = new Map();
    analyzer = new M6502HintAnalyzer(globalSymbolTable, functionSymbols);
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const customAnalyzer = new M6502HintAnalyzer(globalSymbolTable, functionSymbols, {
        minZeroPageAccessCount: 5,
      });
      expect(customAnalyzer).toBeDefined();
    });

    it('should have correct default options', () => {
      expect(DEFAULT_M6502_OPTIONS.minZeroPageAccessCount).toBe(3);
      expect(DEFAULT_M6502_OPTIONS.maxInlineInstructions).toBe(20);
      expect(DEFAULT_M6502_OPTIONS.loopAccessMultiplier).toBe(10);
      expect(DEFAULT_M6502_OPTIONS.maxZeroPageRecommendations).toBe(128);
    });
  });

  describe('recordVariableAccess', () => {
    it('should track read access', () => {
      const symbol = createMockSymbol('counter');
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc');

      const result = analyzer.analyze();
      expect(result.zeroPageRecommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('should track write access', () => {
      const symbol = createMockSymbol('counter');
      analyzer.recordVariableAccess(symbol, 'write', 'testFunc');
      analyzer.recordVariableAccess(symbol, 'write', 'testFunc');
      analyzer.recordVariableAccess(symbol, 'write', 'testFunc');

      const result = analyzer.analyze();
      expect(result.zeroPageRecommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('should track loop access separately', () => {
      const symbol = createMockSymbol('loopVar');

      // 3 accesses in a loop at depth 1
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 1);
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 1);
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 1);

      const result = analyzer.analyze();

      // Loop variables should have higher priority
      const rec = result.zeroPageRecommendations.find(r => r.symbol.name === 'loopVar');
      expect(rec?.inLoop).toBe(true);
      expect(rec?.score).toBeGreaterThan(3); // Should be multiplied
    });

    it('should track max loop depth', () => {
      const symbol = createMockSymbol('deepVar');

      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 1);
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 2);
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 3);

      const result = analyzer.analyze();
      const rec = result.zeroPageRecommendations.find(r => r.symbol.name === 'deepVar');

      // Score should reflect deeper nesting
      expect(rec?.inLoop).toBe(true);
    });

    it('should track accessing functions', () => {
      const symbol = createMockSymbol('sharedVar');

      analyzer.recordVariableAccess(symbol, 'read', 'funcA');
      analyzer.recordVariableAccess(symbol, 'read', 'funcB');
      analyzer.recordVariableAccess(symbol, 'read', 'funcC');

      // Access from multiple functions (total 3)
      const result = analyzer.analyze();
      expect(result.zeroPageRecommendations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordFunctionMetrics', () => {
    it('should store function metrics', () => {
      functionSymbols.set('smallFunc', createMockFunctionSymbol('smallFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'smallFunc',
        instructionCount: 10,
        parameterCount: 2,
        localCount: 3,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      expect(result.inlineCandidates).toContain('smallFunc');
    });
  });

  describe('zero-page recommendations', () => {
    it('should not recommend variables below threshold', () => {
      const symbol = createMockSymbol('rareVar');

      // Only 2 accesses (below default threshold of 3)
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      analyzer.recordVariableAccess(symbol, 'read', 'testFunc');

      const result = analyzer.analyze();
      const rec = result.zeroPageRecommendations.find(r => r.symbol.name === 'rareVar');
      expect(rec).toBeUndefined();
    });

    it('should sort recommendations by score', () => {
      const lowVar = createMockSymbol('lowVar');
      const highVar = createMockSymbol('highVar');

      // Low access count
      for (let i = 0; i < 3; i++) {
        analyzer.recordVariableAccess(lowVar, 'read', 'testFunc');
      }

      // High access count (in loop)
      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(highVar, 'read', 'testFunc', 1);
      }

      const result = analyzer.analyze();

      // highVar should be first due to higher score
      if (result.zeroPageRecommendations.length >= 2) {
        expect(result.zeroPageRecommendations[0].symbol.name).toBe('highVar');
      }
    });

    it('should limit total zero-page bytes', () => {
      // Create many variables that would exceed the limit
      for (let i = 0; i < 200; i++) {
        const symbol = createMockSymbol(`var${i}`, 1);
        for (let j = 0; j < 5; j++) {
          analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
        }
      }

      const result = analyzer.analyze();
      expect(result.estimatedZeroPageNeeds).toBeLessThanOrEqual(128);
    });

    it('should include reason in recommendations', () => {
      const symbol = createMockSymbol('testVar');

      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      const result = analyzer.analyze();
      const rec = result.zeroPageRecommendations.find(r => r.symbol.name === 'testVar');

      expect(rec?.reason).toContain('Accessed');
      expect(rec?.reason).toContain('5');
    });
  });

  describe('inline candidates', () => {
    it('should identify small functions', () => {
      functionSymbols.set('tinyFunc', createMockFunctionSymbol('tinyFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'tinyFunc',
        instructionCount: 5,
        parameterCount: 1,
        localCount: 0,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      expect(result.inlineCandidates).toContain('tinyFunc');
    });

    it('should reject large functions', () => {
      functionSymbols.set('bigFunc', createMockFunctionSymbol('bigFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'bigFunc',
        instructionCount: 100, // Exceeds threshold
        parameterCount: 2,
        localCount: 10,
        makesCalls: true,
        hasTailCall: false,
        hasLoops: true,
      });

      const result = analyzer.analyze();
      expect(result.inlineCandidates).not.toContain('bigFunc');
    });

    it('should reject functions with many parameters', () => {
      functionSymbols.set('manyParams', createMockFunctionSymbol('manyParams'));

      analyzer.recordFunctionMetrics({
        functionName: 'manyParams',
        instructionCount: 10,
        parameterCount: 6, // Too many
        localCount: 0,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      expect(result.inlineCandidates).not.toContain('manyParams');
    });
  });

  describe('tail-call candidates', () => {
    it('should identify functions with tail calls', () => {
      functionSymbols.set('tailFunc', createMockFunctionSymbol('tailFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'tailFunc',
        instructionCount: 20,
        parameterCount: 2,
        localCount: 3,
        makesCalls: true,
        hasTailCall: true,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      expect(result.tailCallCandidates).toContain('tailFunc');
    });

    it('should not include functions without tail calls', () => {
      functionSymbols.set('normalFunc', createMockFunctionSymbol('normalFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'normalFunc',
        instructionCount: 20,
        parameterCount: 2,
        localCount: 3,
        makesCalls: true,
        hasTailCall: false,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      expect(result.tailCallCandidates).not.toContain('normalFunc');
    });
  });

  describe('hot variables', () => {
    it('should identify frequently accessed variables', () => {
      const symbol = createMockSymbol('hotVar');

      // Many accesses in a loop
      for (let i = 0; i < 10; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc', 1);
      }

      const result = analyzer.analyze();
      const isHot = result.hotVariables.some(v => v.name === 'hotVar');
      expect(isHot).toBe(true);
    });

    it('should boost loop variables', () => {
      const loopVar = createMockSymbol('loopCounter');

      // Fewer accesses but in a loop
      for (let i = 0; i < 3; i++) {
        analyzer.recordVariableAccess(loopVar, 'read', 'testFunc', 1);
      }

      const result = analyzer.analyze();
      const isHot = result.hotVariables.some(v => v.name === 'loopCounter');
      expect(isHot).toBe(true);
    });
  });

  describe('hints', () => {
    it('should generate zero-page hints', () => {
      const symbol = createMockSymbol('zpVar');

      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      const result = analyzer.analyze();
      const zpHints = result.hints.filter(h => h.kind === M6502HintKind.ZeroPageCandidate);
      expect(zpHints.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate inline hints', () => {
      functionSymbols.set('inlineFunc', createMockFunctionSymbol('inlineFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'inlineFunc',
        instructionCount: 10,
        parameterCount: 2,
        localCount: 1,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      const result = analyzer.analyze();
      const inlineHints = result.hints.filter(h => h.kind === M6502HintKind.InlineCandidate);
      expect(inlineHints.length).toBeGreaterThanOrEqual(1);
    });

    it('should include estimated savings in hints', () => {
      const symbol = createMockSymbol('savedVar');

      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      const result = analyzer.analyze();
      const hint = result.hints.find(h => h.symbol?.name === 'savedVar');

      expect(hint?.estimatedCycleSavings).toBeGreaterThan(0);
      expect(hint?.estimatedByteSavings).toBeGreaterThan(0);
    });

    it('should assign appropriate priority', () => {
      const lowSymbol = createMockSymbol('lowPriority');
      const highSymbol = createMockSymbol('highPriority');

      // Low access
      for (let i = 0; i < 3; i++) {
        analyzer.recordVariableAccess(lowSymbol, 'read', 'testFunc');
      }

      // High access in deep loop
      for (let i = 0; i < 20; i++) {
        analyzer.recordVariableAccess(highSymbol, 'read', 'testFunc', 2);
      }

      const result = analyzer.analyze();
      const lowHint = result.hints.find(h => h.symbol?.name === 'lowPriority');
      const highHint = result.hints.find(h => h.symbol?.name === 'highPriority');

      // High priority should be higher than low
      if (lowHint && highHint) {
        const priorityOrder = [HintPriority.Low, HintPriority.Medium, HintPriority.High, HintPriority.Critical];
        const lowIndex = priorityOrder.indexOf(lowHint.priority);
        const highIndex = priorityOrder.indexOf(highHint.priority);
        expect(highIndex).toBeGreaterThanOrEqual(lowIndex);
      }
    });
  });

  describe('getHintsForFunction / getHintsForVariable', () => {
    it('should filter hints by function', () => {
      functionSymbols.set('myFunc', createMockFunctionSymbol('myFunc'));

      analyzer.recordFunctionMetrics({
        functionName: 'myFunc',
        instructionCount: 10,
        parameterCount: 1,
        localCount: 0,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      analyzer.analyze();
      const funcHints = analyzer.getHintsForFunction('myFunc');

      expect(funcHints.length).toBeGreaterThanOrEqual(1);
      expect(funcHints.every(h => h.functionName === 'myFunc')).toBe(true);
    });

    it('should filter hints by variable', () => {
      const symbol = createMockSymbol('targetVar');

      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      analyzer.analyze();
      const varHints = analyzer.getHintsForVariable(symbol);

      expect(varHints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('formatReport', () => {
    it('should format empty report', () => {
      const report = analyzer.formatReport();
      expect(report).toContain('M6502');
    });

    it('should include zero-page section', () => {
      const symbol = createMockSymbol('zpVar');
      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      const report = analyzer.formatReport();
      expect(report).toContain('Zero-Page');
      expect(report).toContain('zpVar');
    });

    it('should include inline candidates', () => {
      functionSymbols.set('inlineMe', createMockFunctionSymbol('inlineMe'));

      analyzer.recordFunctionMetrics({
        functionName: 'inlineMe',
        instructionCount: 5,
        parameterCount: 1,
        localCount: 0,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      const report = analyzer.formatReport();
      expect(report).toContain('Inline');
      expect(report).toContain('inlineMe');
    });

    it('should include summary', () => {
      const report = analyzer.formatReport();
      expect(report).toContain('Summary');
      expect(report).toContain('Total hints');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const symbol = createMockSymbol('testVar');
      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      let result = analyzer.analyze();
      expect(result.zeroPageRecommendations.length).toBeGreaterThan(0);

      analyzer.reset();

      result = analyzer.analyze();
      expect(result.zeroPageRecommendations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle variable with no type', () => {
      const symbol = createMockSymbol('noTypeVar');
      symbol.type = null;

      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      // Should not crash
      const result = analyzer.analyze();
      expect(result).toBeDefined();
    });

    it('should handle function symbol not in map', () => {
      // Record metrics for function not in functionSymbols map
      analyzer.recordFunctionMetrics({
        functionName: 'unknownFunc',
        instructionCount: 10,
        parameterCount: 1,
        localCount: 0,
        makesCalls: false,
        hasTailCall: false,
        hasLoops: false,
      });

      // Should not crash and should still identify as inline candidate
      const result = analyzer.analyze();
      expect(result.inlineCandidates).toContain('unknownFunc');
    });

    it('should handle multiple calls to analyze', () => {
      const symbol = createMockSymbol('multiVar');
      for (let i = 0; i < 5; i++) {
        analyzer.recordVariableAccess(symbol, 'read', 'testFunc');
      }

      // Call analyze multiple times
      const result1 = analyzer.analyze();
      const result2 = analyzer.analyze();

      // Results should be consistent
      expect(result1.zeroPageRecommendations.length).toBe(result2.zeroPageRecommendations.length);
    });
  });
});