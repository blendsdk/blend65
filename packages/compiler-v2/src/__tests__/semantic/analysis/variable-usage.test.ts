/**
 * Tests for VariableUsageAnalyzer
 *
 * Verifies detection of unused variables and parameters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VariableUsageAnalyzer,
  VariableUsageSeverity,
  VariableUsageIssueKind,
  DEFAULT_VARIABLE_USAGE_OPTIONS,
} from '../../../semantic/analysis/variable-usage.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import type { SourceLocation } from '../../../ast/index.js';

/**
 * Helper to create a test location
 */
function createTestLocation(line: number = 1, column: number = 1): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 1, offset: 1 },
  };
}

describe('VariableUsageAnalyzer', () => {
  let symbolTable: SymbolTable;
  let analyzer: VariableUsageAnalyzer;

  beforeEach(() => {
    // SymbolTable automatically creates module scope on construction
    symbolTable = new SymbolTable(null, 'test');
    analyzer = new VariableUsageAnalyzer(symbolTable);
  });

  describe('construction', () => {
    it('should create analyzer with symbol table', () => {
      expect(analyzer).toBeInstanceOf(VariableUsageAnalyzer);
    });

    it('should accept custom options', () => {
      const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
        reportUnusedVariables: false,
      });
      expect(customAnalyzer).toBeInstanceOf(VariableUsageAnalyzer);
    });

    it('should use default options', () => {
      expect(DEFAULT_VARIABLE_USAGE_OPTIONS.reportUnusedVariables).toBe(true);
      expect(DEFAULT_VARIABLE_USAGE_OPTIONS.reportUnusedParameters).toBe(true);
      expect(DEFAULT_VARIABLE_USAGE_OPTIONS.reportWriteOnly).toBe(true);
      expect(DEFAULT_VARIABLE_USAGE_OPTIONS.ignoreUnderscorePrefixed).toBe(true);
      expect(DEFAULT_VARIABLE_USAGE_OPTIONS.ignoreExported).toBe(true);
    });
  });

  describe('initialize()', () => {
    it('should initialize usage tracking from symbol table', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      expect(declResult.success).toBe(true);

      analyzer.initialize();

      const usage = analyzer.getUsage(declResult.symbol!);
      expect(usage).toBeDefined();
      expect(usage?.readCount).toBe(0);
      expect(usage?.writeCount).toBe(0);
    });

    it('should track variables with initializers as having one write', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });

      analyzer.initialize();

      const usage = analyzer.getUsage(declResult.symbol!);
      expect(usage?.writeCount).toBe(1);
    });

    it('should track parameters', () => {
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
      symbolTable.enterFunctionScope(funcResult.symbol!);
      const paramResult = symbolTable.declareParameter('param', createTestLocation(1, 10));

      analyzer.initialize();

      const usage = analyzer.getUsage(paramResult.symbol!);
      expect(usage).toBeDefined();
    });

    it('should mark underscore-prefixed as intentionally unused', () => {
      const declResult = symbolTable.declareVariable('_unused', createTestLocation(1, 1));

      analyzer.initialize();

      const usage = analyzer.getUsage(declResult.symbol!);
      expect(usage?.isIntentionallyUnused).toBe(true);
    });
  });

  describe('recordRead()', () => {
    it('should increment read count', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordRead(varSymbol, createTestLocation(2, 1));

      const usage = analyzer.getUsage(varSymbol);
      expect(usage?.readCount).toBe(1);
    });

    it('should track multiple reads', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordRead(varSymbol, createTestLocation(2, 1));
      analyzer.recordRead(varSymbol, createTestLocation(3, 1));
      analyzer.recordRead(varSymbol, createTestLocation(4, 1));

      const usage = analyzer.getUsage(varSymbol);
      expect(usage?.readCount).toBe(3);
      expect(usage?.readLocations).toHaveLength(3);
    });
  });

  describe('recordWrite()', () => {
    it('should increment write count', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordWrite(varSymbol, createTestLocation(2, 1));

      const usage = analyzer.getUsage(varSymbol);
      expect(usage?.writeCount).toBe(1);
    });

    it('should track multiple writes', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordWrite(varSymbol, createTestLocation(2, 1));
      analyzer.recordWrite(varSymbol, createTestLocation(3, 1));

      const usage = analyzer.getUsage(varSymbol);
      expect(usage?.writeCount).toBe(2);
      expect(usage?.writeLocations).toHaveLength(2);
    });
  });

  describe('markAsLoopCounter()', () => {
    it('should mark variable as loop counter', () => {
      const declResult = symbolTable.declareVariable('i', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      // With ignoreLoopCounters option
      const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
        ignoreLoopCounters: true,
      });
      customAnalyzer.initialize();
      customAnalyzer.markAsLoopCounter(varSymbol);

      const result = customAnalyzer.analyze();
      // Loop counter should be skipped
      expect(result.issues.filter(i => i.symbol.name === 'i')).toHaveLength(0);
    });
  });

  describe('analyze()', () => {
    describe('unused variables', () => {
      it('should detect unused variable (never read, never written)', () => {
        symbolTable.declareVariable('unused', createTestLocation(1, 1));

        analyzer.initialize();
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(true);
        expect(result.unusedVariableCount).toBe(1);
        expect(result.issues[0].kind).toBe(VariableUsageIssueKind.UnusedVariable);
        expect(result.issues[0].severity).toBe(VariableUsageSeverity.Warning);
      });

      it('should not report used variable', () => {
        const declResult = symbolTable.declareVariable('used', createTestLocation(1, 1));
        const varSymbol = declResult.symbol!;

        analyzer.initialize();
        analyzer.recordRead(varSymbol, createTestLocation(2, 1));
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(false);
        expect(result.usedVariables).toBe(1);
      });
    });

    describe('unused parameters', () => {
      it('should detect unused parameter', () => {
        const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
        symbolTable.enterFunctionScope(funcResult.symbol!);
        symbolTable.declareParameter('unusedParam', createTestLocation(1, 10));

        analyzer.initialize();
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(true);
        expect(result.unusedParameterCount).toBe(1);
        expect(result.issues[0].kind).toBe(VariableUsageIssueKind.UnusedParameter);
      });

      it('should not report used parameter', () => {
        const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
        symbolTable.enterFunctionScope(funcResult.symbol!);
        const paramResult = symbolTable.declareParameter('usedParam', createTestLocation(1, 10));

        analyzer.initialize();
        analyzer.recordRead(paramResult.symbol!, createTestLocation(2, 1));
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(false);
        expect(result.usedParameters).toBe(1);
      });
    });

    describe('write-only variables', () => {
      it('should detect write-only variable', () => {
        const declResult = symbolTable.declareVariable('writeOnly', createTestLocation(1, 1), null, {
          initializer: {} as any,
        });
        const varSymbol = declResult.symbol!;

        analyzer.initialize();
        // Only writes, no reads
        analyzer.recordWrite(varSymbol, createTestLocation(2, 1));
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(true);
        expect(result.writeOnlyCount).toBe(1);
        expect(result.issues[0].kind).toBe(VariableUsageIssueKind.WriteOnlyVariable);
      });

      it('should not report write-only when reads exist', () => {
        const declResult = symbolTable.declareVariable('readAndWrite', createTestLocation(1, 1));
        const varSymbol = declResult.symbol!;

        analyzer.initialize();
        analyzer.recordWrite(varSymbol, createTestLocation(2, 1));
        analyzer.recordRead(varSymbol, createTestLocation(3, 1));
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(false);
      });
    });

    describe('exclusions', () => {
      it('should ignore underscore-prefixed variables by default', () => {
        symbolTable.declareVariable('_ignored', createTestLocation(1, 1));

        analyzer.initialize();
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(false);
      });

      it('should report underscore-prefixed when option disabled', () => {
        const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
          ignoreUnderscorePrefixed: false,
        });

        symbolTable.declareVariable('_notIgnored', createTestLocation(1, 1));

        customAnalyzer.initialize();
        const result = customAnalyzer.analyze();

        expect(result.hasIssues).toBe(true);
      });

      it('should ignore exported variables by default', () => {
        symbolTable.declareVariable('exported', createTestLocation(1, 1), null, {
          isExported: true,
        });

        analyzer.initialize();
        const result = analyzer.analyze();

        expect(result.hasIssues).toBe(false);
      });

      it('should report exported when option disabled', () => {
        const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
          ignoreExported: false,
        });

        symbolTable.declareVariable('exported', createTestLocation(1, 1), null, {
          isExported: true,
        });

        customAnalyzer.initialize();
        const result = customAnalyzer.analyze();

        expect(result.hasIssues).toBe(true);
      });
    });

    describe('configuration options', () => {
      it('should respect reportUnusedVariables = false', () => {
        const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
          reportUnusedVariables: false,
        });

        symbolTable.declareVariable('unused', createTestLocation(1, 1));

        customAnalyzer.initialize();
        const result = customAnalyzer.analyze();

        expect(result.unusedVariableCount).toBe(0);
      });

      it('should respect reportUnusedParameters = false', () => {
        const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
          reportUnusedParameters: false,
        });

        const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
        symbolTable.enterFunctionScope(funcResult.symbol!);
        symbolTable.declareParameter('unused', createTestLocation(1, 10));

        customAnalyzer.initialize();
        const result = customAnalyzer.analyze();

        expect(result.unusedParameterCount).toBe(0);
      });

      it('should respect reportWriteOnly = false', () => {
        const customAnalyzer = new VariableUsageAnalyzer(symbolTable, {
          reportWriteOnly: false,
        });

        symbolTable.declareVariable('writeOnly', createTestLocation(1, 1), null, {
          initializer: {} as any,
        });

        customAnalyzer.initialize();
        const result = customAnalyzer.analyze();

        expect(result.writeOnlyCount).toBe(0);
      });
    });
  });

  describe('isUsed()', () => {
    it('should return true for used variable', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordRead(varSymbol, createTestLocation(2, 1));

      expect(analyzer.isUsed(varSymbol)).toBe(true);
    });

    it('should return false for unused variable', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();

      expect(analyzer.isUsed(varSymbol)).toBe(false);
    });

    it('should return true for unknown symbol', () => {
      const otherSymbolTable = new SymbolTable(null, 'other');
      const unknownResult = otherSymbolTable.declareVariable('unknown', createTestLocation(1, 1));
      const unknownSymbol = unknownResult.symbol!;

      analyzer.initialize();

      // Unknown symbols are assumed to be used (conservative)
      expect(analyzer.isUsed(unknownSymbol)).toBe(true);
    });
  });

  describe('getUnusedSymbols()', () => {
    it('should return array of unused symbols', () => {
      const unused1Result = symbolTable.declareVariable('unused1', createTestLocation(1, 1));
      const unused2Result = symbolTable.declareVariable('unused2', createTestLocation(2, 1));
      const usedResult = symbolTable.declareVariable('used', createTestLocation(3, 1));

      analyzer.initialize();
      analyzer.recordRead(usedResult.symbol!, createTestLocation(4, 1));

      const unusedSymbols = analyzer.getUnusedSymbols();
      expect(unusedSymbols).toHaveLength(2);
      expect(unusedSymbols.map(s => s.name)).toContain('unused1');
      expect(unusedSymbols.map(s => s.name)).toContain('unused2');
      expect(unusedSymbols.map(s => s.name)).not.toContain('used');
    });

    it('should exclude underscore-prefixed from unused', () => {
      symbolTable.declareVariable('_ignored', createTestLocation(1, 1));
      symbolTable.declareVariable('unused', createTestLocation(2, 1));

      analyzer.initialize();

      const unusedSymbols = analyzer.getUnusedSymbols();
      expect(unusedSymbols).toHaveLength(1);
      expect(unusedSymbols[0].name).toBe('unused');
    });
  });

  describe('formatReport()', () => {
    it('should format report with no issues', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));

      analyzer.initialize();
      analyzer.recordRead(declResult.symbol!, createTestLocation(2, 1));

      const report = analyzer.formatReport();
      expect(report).toContain('No issues found');
      expect(report).toContain('1/1 variables');
    });

    it('should format report with issues', () => {
      symbolTable.declareVariable('unusedVar', createTestLocation(1, 5));

      analyzer.initialize();
      const report = analyzer.formatReport();

      expect(report).toContain('Variable Usage Analysis Report');
      expect(report).toContain('unusedVar');
      expect(report).toContain('never used');
      expect(report).toContain('suggestion');
    });

    it('should include statistics in report', () => {
      const var1Result = symbolTable.declareVariable('x', createTestLocation(1, 1));
      symbolTable.declareVariable('y', createTestLocation(2, 1));

      analyzer.initialize();
      analyzer.recordRead(var1Result.symbol!, createTestLocation(3, 1));

      const report = analyzer.formatReport();

      expect(report).toContain('Variables: 1/2 used');
    });
  });

  describe('reset()', () => {
    it('should clear all state when reset', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.initialize();
      analyzer.recordRead(varSymbol, createTestLocation(2, 1));

      expect(analyzer.getUsage(varSymbol)?.readCount).toBe(1);

      analyzer.reset();

      expect(analyzer.getUsage(varSymbol)).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple scopes', () => {
      // Module scope variable
      symbolTable.declareVariable('moduleX', createTestLocation(1, 1));

      // Function scope
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(2, 1));
      symbolTable.enterFunctionScope(funcResult.symbol!);

      // Local variable in function
      symbolTable.declareVariable('localY', createTestLocation(3, 1));

      analyzer.initialize();
      const result = analyzer.analyze();

      expect(result.totalVariables).toBe(2);
    });

    it('should handle shadowed variables correctly', () => {
      // Module scope variable
      const outerResult = symbolTable.declareVariable('x', createTestLocation(1, 1));

      // Enter block scope
      symbolTable.enterBlockScope();

      // Inner variable
      symbolTable.declareVariable('x', createTestLocation(3, 1));

      analyzer.initialize();

      // Read outer x
      analyzer.recordRead(outerResult.symbol!, createTestLocation(2, 1));

      const result = analyzer.analyze();

      // Inner x should be reported as unused
      expect(result.unusedVariableCount).toBe(1);
    });

    it('should handle variables with only initializers as write-only', () => {
      symbolTable.declareVariable('initialized', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });

      analyzer.initialize();
      const result = analyzer.analyze();

      // Variable with initializer but no reads is write-only
      expect(result.writeOnlyCount).toBe(1);
    });
  });

  describe('statistics', () => {
    it('should calculate correct statistics', () => {
      // 2 variables
      const var1Result = symbolTable.declareVariable('v1', createTestLocation(1, 1));
      symbolTable.declareVariable('v2', createTestLocation(2, 1));

      // Function scope with 2 parameters and 1 variable
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(3, 1));
      symbolTable.enterFunctionScope(funcResult.symbol!);
      const param1Result = symbolTable.declareParameter('p1', createTestLocation(3, 10));
      symbolTable.declareParameter('p2', createTestLocation(3, 20));
      symbolTable.declareVariable('v3', createTestLocation(4, 1));

      analyzer.initialize();

      // Use some symbols
      analyzer.recordRead(var1Result.symbol!, createTestLocation(5, 1));
      analyzer.recordRead(param1Result.symbol!, createTestLocation(6, 1));

      const result = analyzer.analyze();

      expect(result.totalVariables).toBe(3);
      expect(result.totalParameters).toBe(2);
      expect(result.usedVariables).toBe(1);
      expect(result.usedParameters).toBe(1);
    });
  });
});