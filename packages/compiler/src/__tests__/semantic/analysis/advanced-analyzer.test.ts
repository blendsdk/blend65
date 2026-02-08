/**
 * Tests for AdvancedAnalyzer Orchestrator
 *
 * Tests the orchestration of all advanced semantic analysis passes:
 * - Tier 1: Definite assignment, variable usage
 * - Tier 2: Dead code, liveness (requires CFGs)
 * - Tier 3: Purity, loop analysis, M6502 hints (requires global symbol table)
 *
 * @module __tests__/semantic/analysis/advanced-analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvancedAnalyzer,
  DiagnosticSeverity,
  DiagnosticCategory,
  DEFAULT_ADVANCED_OPTIONS,
  type AdvancedAnalysisOptions,
} from '../../../semantic/analysis/advanced-analyzer.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import { GlobalSymbolTable } from '../../../semantic/global-symbol-table.js';
import { ControlFlowGraph, CFGNodeKind } from '../../../semantic/control-flow.js';
import { ScopeKind } from '../../../semantic/scope.js';
import { SymbolKind, type Symbol } from '../../../semantic/symbol.js';

/**
 * Helper to create a test source location
 */
function createTestLocation(line: number = 1, column: number = 1) {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 5, offset: 5 },
  };
}

/**
 * Helper to create a mock symbol
 */
function createTestSymbol(
  name: string,
  kind: SymbolKind,
  scope: ReturnType<SymbolTable['getCurrentScope']>,
  options?: {
    isExported?: boolean;
    isConst?: boolean;
    initializer?: unknown;
  }
): Symbol {
  return {
    name,
    kind,
    type: null,
    location: createTestLocation(),
    scope,
    isExported: options?.isExported ?? false,
    isConst: options?.isConst ?? false,
    initializer: options?.initializer as any,
  };
}

describe('AdvancedAnalyzer', () => {
  let symbolTable: SymbolTable;
  let typeSystem: TypeSystem;
  let globalSymbolTable: GlobalSymbolTable;
  let functionSymbols: Map<string, Symbol>;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    typeSystem = new TypeSystem();
    globalSymbolTable = new GlobalSymbolTable();
    functionSymbols = new Map();
  });

  describe('constructor', () => {
    it('should create an analyzer with default options', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      expect(analyzer).toBeDefined();
    });

    it('should create an analyzer with custom options', () => {
      const options: Partial<AdvancedAnalysisOptions> = {
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
        includeInfo: false,
      };
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, options);
      expect(analyzer).toBeDefined();
    });

    it('should accept context with global symbol table', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, {
        globalSymbolTable,
        functionSymbols,
      });
      expect(analyzer).toBeDefined();
    });

    it('should accept context with CFGs', () => {
      const cfgs = new Map<string, ControlFlowGraph>();
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs });
      expect(analyzer).toBeDefined();
    });
  });

  describe('DEFAULT_ADVANCED_OPTIONS', () => {
    it('should have all tiers enabled by default', () => {
      expect(DEFAULT_ADVANCED_OPTIONS.enableTier1).toBe(true);
      expect(DEFAULT_ADVANCED_OPTIONS.enableTier2).toBe(true);
      expect(DEFAULT_ADVANCED_OPTIONS.enableTier3).toBe(true);
    });

    it('should include info diagnostics by default', () => {
      expect(DEFAULT_ADVANCED_OPTIONS.includeInfo).toBe(true);
    });

    it('should have a reasonable max diagnostics limit', () => {
      expect(DEFAULT_ADVANCED_OPTIONS.maxDiagnostics).toBe(1000);
    });
  });

  describe('analyze()', () => {
    it('should return analysis result with empty symbol table', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      const result = analyzer.analyze();

      expect(result).toBeDefined();
      expect(result.diagnostics).toBeInstanceOf(Array);
      expect(result.errorCount).toBeGreaterThanOrEqual(0);
      expect(result.warningCount).toBeGreaterThanOrEqual(0);
      expect(result.infoCount).toBeGreaterThanOrEqual(0);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('should complete Tier 1 analysis when enabled', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.tiersCompleted).toContain(1);
      expect(result.definiteAssignment).toBeDefined();
      expect(result.variableUsage).toBeDefined();
    });

    it('should skip Tier 1 when disabled', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: false,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.tiersCompleted).not.toContain(1);
      expect(result.definiteAssignment).toBeUndefined();
      expect(result.variableUsage).toBeUndefined();
    });

    it('should complete Tier 2 when CFGs provided', () => {
      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('testFunc', new ControlFlowGraph('testFunc'));

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.tiersCompleted).toContain(2);
      expect(result.deadCode).toBeDefined();
      expect(result.liveness).toBeDefined();
    });

    it('should skip Tier 2 without CFGs', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.tiersCompleted).not.toContain(2);
      expect(result.deadCode).toBeUndefined();
    });

    it('should complete Tier 3 when global symbol table provided', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      const result = analyzer.analyze();

      expect(result.tiersCompleted).toContain(3);
      expect(result.purity).toBeDefined();
      expect(result.loopAnalysis).toBeDefined();
      expect(result.m6502Hints).toBeDefined();
    });

    it('should skip Tier 3 without global symbol table', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: false,
        enableTier3: true,
      });
      const result = analyzer.analyze();

      expect(result.tiersCompleted).not.toContain(3);
    });

    it('should run all tiers in sequence', () => {
      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('testFunc', new ControlFlowGraph('testFunc'));

      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols, cfgs },
        DEFAULT_ADVANCED_OPTIONS
      );
      const result = analyzer.analyze();

      expect(result.tiersCompleted).toContain(1);
      expect(result.tiersCompleted).toContain(2);
      expect(result.tiersCompleted).toContain(3);
    });

    it('should track analysis time', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      const result = analyzer.analyze();

      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.analysisTime).toBe('number');
    });
  });

  describe('Tier 1 Analysis', () => {
    it('should run definite assignment analysis', () => {
      // Test with empty symbol table - the analyzer should still work
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.definiteAssignment).toBeDefined();
      expect(result.definiteAssignment?.variablesAnalyzed).toBeGreaterThanOrEqual(0);
    });

    it('should run variable usage analysis', () => {
      // Test with empty symbol table - the analyzer should still work
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.variableUsage).toBeDefined();
      expect(result.variableUsage?.totalVariables).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tier 2 Analysis', () => {
    it('should run dead code analysis on CFGs', () => {
      const cfg = new ControlFlowGraph('testFunc');
      const stmt1 = cfg.createNode(CFGNodeKind.Statement, null);
      cfg.addEdge(cfg.entry, stmt1);
      cfg.addEdge(stmt1, cfg.exit);
      cfg.computeReachability();

      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('testFunc', cfg);

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.deadCode).toBeDefined();
      expect(result.deadCode?.functionsAnalyzed).toBe(1);
    });

    it('should run liveness analysis on CFGs', () => {
      const cfg = new ControlFlowGraph('testFunc');
      const stmt = cfg.createNode(CFGNodeKind.Statement, null);
      cfg.addEdge(cfg.entry, stmt);
      cfg.addEdge(stmt, cfg.exit);
      cfg.computeReachability();

      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('testFunc', cfg);

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.liveness).toBeDefined();
      expect(result.liveness?.has('testFunc')).toBe(true);
    });

    it('should analyze multiple CFGs', () => {
      const cfg1 = new ControlFlowGraph('func1');
      cfg1.addEdge(cfg1.entry, cfg1.exit);
      cfg1.computeReachability();

      const cfg2 = new ControlFlowGraph('func2');
      cfg2.addEdge(cfg2.entry, cfg2.exit);
      cfg2.computeReachability();

      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('func1', cfg1);
      cfgs.set('func2', cfg2);

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      const result = analyzer.analyze();

      expect(result.deadCode?.functionsAnalyzed).toBe(2);
      expect(result.liveness?.size).toBe(2);
    });
  });

  describe('Tier 3 Analysis', () => {
    it('should run purity analysis', () => {
      // Create a mock function symbol without using symbolTable.enterScope
      const mockScope = { id: 'test-scope', kind: ScopeKind.Module } as any;
      const funcSymbol = createTestSymbol('pureFunc', SymbolKind.Function, mockScope);
      functionSymbols.set('pureFunc', funcSymbol);

      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      const result = analyzer.analyze();

      expect(result.purity).toBeDefined();
      expect(result.purity?.totalFunctions).toBe(1);
    });

    it('should run loop analysis', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      const result = analyzer.analyze();

      expect(result.loopAnalysis).toBeDefined();
      expect(result.loopAnalysis?.totalLoops).toBe(0);
    });

    it('should run M6502 hints analysis', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      const result = analyzer.analyze();

      expect(result.m6502Hints).toBeDefined();
      expect(result.m6502Hints?.hints).toBeInstanceOf(Array);
    });
  });

  describe('getDiagnostics()', () => {
    it('should return empty array when no diagnostics', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const diagnostics = analyzer.getDiagnostics();

      expect(diagnostics).toBeInstanceOf(Array);
    });

    it('should return copy of diagnostics', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const diag1 = analyzer.getDiagnostics();
      const diag2 = analyzer.getDiagnostics();

      expect(diag1).not.toBe(diag2);
    });
  });

  describe('getDiagnosticsBySeverity()', () => {
    it('should filter by error severity', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const errors = analyzer.getDiagnosticsBySeverity(DiagnosticSeverity.Error);

      expect(errors).toBeInstanceOf(Array);
      for (const diag of errors) {
        expect(diag.severity).toBe(DiagnosticSeverity.Error);
      }
    });

    it('should filter by warning severity', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const warnings = analyzer.getDiagnosticsBySeverity(DiagnosticSeverity.Warning);

      expect(warnings).toBeInstanceOf(Array);
      for (const diag of warnings) {
        expect(diag.severity).toBe(DiagnosticSeverity.Warning);
      }
    });

    it('should filter by info severity', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const info = analyzer.getDiagnosticsBySeverity(DiagnosticSeverity.Info);

      expect(info).toBeInstanceOf(Array);
      for (const diag of info) {
        expect(diag.severity).toBe(DiagnosticSeverity.Info);
      }
    });
  });

  describe('getDiagnosticsByCategory()', () => {
    it('should filter by category', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const daIssues = analyzer.getDiagnosticsByCategory(DiagnosticCategory.DefiniteAssignment);

      expect(daIssues).toBeInstanceOf(Array);
      for (const diag of daIssues) {
        expect(diag.category).toBe(DiagnosticCategory.DefiniteAssignment);
      }
    });

    it('should return empty array for unused category', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const purity = analyzer.getDiagnosticsByCategory(DiagnosticCategory.Purity);

      expect(purity).toBeInstanceOf(Array);
    });
  });

  describe('hasErrors()', () => {
    it('should return false when no errors', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();

      expect(analyzer.hasErrors()).toBe(false);
    });
  });

  describe('hasWarnings()', () => {
    it('should return false when no warnings on empty table', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: false,
        enableTier3: false,
      });
      analyzer.analyze();

      expect(analyzer.hasWarnings()).toBe(false);
    });
  });

  describe('analyzer accessors', () => {
    it('should provide access to definite assignment analyzer after Tier 1', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
      });
      analyzer.analyze();

      expect(analyzer.getDefiniteAssignmentAnalyzer()).toBeDefined();
    });

    it('should provide access to variable usage analyzer after Tier 1', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: true,
        enableTier2: false,
        enableTier3: false,
      });
      analyzer.analyze();

      expect(analyzer.getVariableUsageAnalyzer()).toBeDefined();
    });

    it('should provide access to dead code analyzer after Tier 2', () => {
      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('test', new ControlFlowGraph('test'));

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      analyzer.analyze();

      expect(analyzer.getDeadCodeAnalyzer()).toBeDefined();
    });

    it('should provide access to liveness analyzer by function name', () => {
      const cfgs = new Map<string, ControlFlowGraph>();
      cfgs.set('myFunc', new ControlFlowGraph('myFunc'));

      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, { cfgs }, {
        ...DEFAULT_ADVANCED_OPTIONS,
        enableTier1: false,
        enableTier2: true,
        enableTier3: false,
      });
      analyzer.analyze();

      expect(analyzer.getLivenessAnalyzer('myFunc')).toBeDefined();
      expect(analyzer.getLivenessAnalyzer('nonExistent')).toBeUndefined();
    });

    it('should provide access to purity analyzer after Tier 3', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      analyzer.analyze();

      expect(analyzer.getPurityAnalyzer()).toBeDefined();
    });

    it('should provide access to loop analyzer after Tier 3', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      analyzer.analyze();

      expect(analyzer.getLoopAnalyzer()).toBeDefined();
    });

    it('should provide access to M6502 analyzer after Tier 3', () => {
      const analyzer = new AdvancedAnalyzer(
        symbolTable,
        typeSystem,
        { globalSymbolTable, functionSymbols },
        {
          ...DEFAULT_ADVANCED_OPTIONS,
          enableTier1: false,
          enableTier2: false,
          enableTier3: true,
        }
      );
      analyzer.analyze();

      expect(analyzer.getM6502Analyzer()).toBeDefined();
    });

    it('should return undefined for analyzers before analysis', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);

      expect(analyzer.getDefiniteAssignmentAnalyzer()).toBeUndefined();
      expect(analyzer.getVariableUsageAnalyzer()).toBeUndefined();
      expect(analyzer.getDeadCodeAnalyzer()).toBeUndefined();
      expect(analyzer.getPurityAnalyzer()).toBeUndefined();
      expect(analyzer.getLoopAnalyzer()).toBeUndefined();
      expect(analyzer.getM6502Analyzer()).toBeUndefined();
    });
  });

  describe('formatReport()', () => {
    it('should generate a report string', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const report = analyzer.formatReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('Advanced Analysis Report');
      expect(report).toContain('Summary');
    });

    it('should include error count in report', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const report = analyzer.formatReport();

      expect(report).toContain('Errors:');
    });

    it('should include warning count in report', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const report = analyzer.formatReport();

      expect(report).toContain('Warnings:');
    });

    it('should include info count in report', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      const report = analyzer.formatReport();

      expect(report).toContain('Info:');
    });
  });

  describe('reset()', () => {
    it('should clear diagnostics', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      analyzer.reset();

      expect(analyzer.getDiagnostics()).toHaveLength(0);
    });

    it('should clear analyzer references', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      analyzer.analyze();
      analyzer.reset();

      expect(analyzer.getDefiniteAssignmentAnalyzer()).toBeUndefined();
      expect(analyzer.getVariableUsageAnalyzer()).toBeUndefined();
    });

    it('should allow re-analysis after reset', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem);
      const result1 = analyzer.analyze();
      analyzer.reset();
      const result2 = analyzer.analyze();

      expect(result2).toBeDefined();
      expect(result2.tiersCompleted).toEqual(result1.tiersCompleted);
    });
  });

  describe('options', () => {
    it('should respect maxDiagnostics option', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        maxDiagnostics: 5,
      });
      analyzer.analyze();
      const diagnostics = analyzer.getDiagnostics();

      expect(diagnostics.length).toBeLessThanOrEqual(5);
    });

    it('should exclude info when includeInfo is false', () => {
      const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, undefined, {
        ...DEFAULT_ADVANCED_OPTIONS,
        includeInfo: false,
      });
      analyzer.analyze();
      const info = analyzer.getDiagnosticsBySeverity(DiagnosticSeverity.Info);

      expect(info).toHaveLength(0);
    });
  });

  describe('DiagnosticSeverity enum', () => {
    it('should have Error level', () => {
      expect(DiagnosticSeverity.Error).toBe('error');
    });

    it('should have Warning level', () => {
      expect(DiagnosticSeverity.Warning).toBe('warning');
    });

    it('should have Info level', () => {
      expect(DiagnosticSeverity.Info).toBe('info');
    });
  });

  describe('DiagnosticCategory enum', () => {
    it('should have DefiniteAssignment category', () => {
      expect(DiagnosticCategory.DefiniteAssignment).toBe('definite_assignment');
    });

    it('should have VariableUsage category', () => {
      expect(DiagnosticCategory.VariableUsage).toBe('variable_usage');
    });

    it('should have DeadCode category', () => {
      expect(DiagnosticCategory.DeadCode).toBe('dead_code');
    });

    it('should have Purity category', () => {
      expect(DiagnosticCategory.Purity).toBe('purity');
    });

    it('should have Loop category', () => {
      expect(DiagnosticCategory.Loop).toBe('loop');
    });

    it('should have M6502 category', () => {
      expect(DiagnosticCategory.M6502).toBe('m6502');
    });
  });
});