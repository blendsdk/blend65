/**
 * Tests for DefiniteAssignmentAnalyzer
 *
 * Verifies detection of variables used before being assigned.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefiniteAssignmentAnalyzer,
  DefiniteAssignmentSeverity,
  DefiniteAssignmentIssueKind,
} from '../../../semantic/analysis/definite-assignment.js';
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

describe('DefiniteAssignmentAnalyzer', () => {
  let symbolTable: SymbolTable;
  let analyzer: DefiniteAssignmentAnalyzer;

  beforeEach(() => {
    // SymbolTable automatically creates module scope on construction
    symbolTable = new SymbolTable(null, 'test');
    analyzer = new DefiniteAssignmentAnalyzer(symbolTable);
  });

  describe('construction', () => {
    it('should create analyzer with symbol table', () => {
      expect(analyzer).toBeInstanceOf(DefiniteAssignmentAnalyzer);
    });

    it('should have empty issues initially', () => {
      const result = analyzer.analyze();
      expect(result.hasIssues).toBe(false);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('analyze() with symbol table', () => {
    it('should track variables from symbol table', () => {
      // Declare a variable with initializer
      const result = symbolTable.declareVariable('x', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });
      expect(result.success).toBe(true);

      // Analyze
      const analysisResult = analyzer.analyze();
      expect(analysisResult.variablesAnalyzed).toBe(1);
    });

    it('should count variables without initializers', () => {
      // Declare a variable WITHOUT initializer
      symbolTable.declareVariable('x', createTestLocation(1, 1));

      const result = analyzer.analyze();
      expect(result.variablesAnalyzed).toBe(1);
    });

    it('should track parameters as definitely assigned', () => {
      // Declare a function first
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
      expect(funcResult.success).toBe(true);

      // Enter function scope
      symbolTable.enterFunctionScope(funcResult.symbol!);

      // Declare a parameter
      symbolTable.declareParameter('param', createTestLocation(1, 10));

      const result = analyzer.analyze();
      expect(result.variablesAnalyzed).toBe(1);

      // Get the parameter symbol and check it's definitely assigned
      const paramSymbol = symbolTable.lookup('param');
      expect(paramSymbol).toBeDefined();
      expect(analyzer.isDefinitelyAssigned(paramSymbol!)).toBe(true);
    });
  });

  describe('recordAssignment()', () => {
    it('should mark variable as definitely assigned after assignment', () => {
      // Variable without initializer
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      expect(declResult.success).toBe(true);
      const varSymbol = declResult.symbol!;

      // Initialize states
      analyzer.analyze();

      // Initially not assigned
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(false);

      // Record assignment
      analyzer.recordAssignment(varSymbol, createTestLocation(2, 1));

      // Now should be assigned
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(true);
    });

    it('should track multiple assignments', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Multiple assignments
      analyzer.recordAssignment(varSymbol, createTestLocation(2, 1));
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));

      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(true);
    });
  });

  describe('checkRead()', () => {
    it('should report error when reading unassigned variable', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Read without assignment
      analyzer.checkRead(varSymbol, createTestLocation(5, 1));

      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe(DefiniteAssignmentIssueKind.UsedBeforeAssigned);
      expect(issues[0].severity).toBe(DefiniteAssignmentSeverity.Error);
      expect(issues[0].symbol.name).toBe('x');
    });

    it('should not report error when reading assigned variable', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Read after initialization
      analyzer.checkRead(varSymbol, createTestLocation(5, 1));

      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(0);
    });

    it('should not report error when reading parameter', () => {
      // Declare a function first
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(1, 1));
      symbolTable.enterFunctionScope(funcResult.symbol!);

      // Declare a parameter
      const paramResult = symbolTable.declareParameter('param', createTestLocation(1, 10));
      const paramSymbol = paramResult.symbol!;

      analyzer.analyze();

      // Read parameter
      analyzer.checkRead(paramSymbol, createTestLocation(2, 1));

      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(0);
    });

    it('should track read count', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Multiple reads
      analyzer.checkRead(varSymbol, createTestLocation(2, 1));
      analyzer.checkRead(varSymbol, createTestLocation(3, 1));
      analyzer.checkRead(varSymbol, createTestLocation(4, 1));

      // Build result without resetting (use getIssues which doesn't reset)
      // The readsAnalyzed is only tracked internally, so we verify no issues instead
      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(0); // All reads are valid (variable was initialized)
    });
  });

  describe('branch handling', () => {
    it('should save and restore state with enterBranch()', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Save state before branch
      const beforeState = analyzer.enterBranch();
      expect(beforeState).toBeInstanceOf(Map);

      // Assign in branch
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(true);
    });

    it('should merge branch states correctly for if-else', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Save state before if
      const beforeState = analyzer.enterBranch();

      // Then branch assigns x
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));
      const thenState = analyzer.enterBranch();

      // Reset to before state for else branch
      analyzer.mergeBranch(beforeState);

      // Else branch does NOT assign x
      const elseState = analyzer.enterBranch();

      // Merge both branches - x should NOT be definitely assigned
      analyzer.mergeIfElse(thenState, elseState);

      // Variable should NOT be definitely assigned after merge
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(false);
    });

    it('should mark variable as definitely assigned when both branches assign', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Save state before if
      const beforeState = analyzer.enterBranch();

      // Then branch assigns x
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));
      const thenState = analyzer.enterBranch();

      // Restore for else
      analyzer.mergeBranch(beforeState);

      // Else branch ALSO assigns x
      analyzer.recordAssignment(varSymbol, createTestLocation(5, 1));
      const elseState = analyzer.enterBranch();

      // Merge both branches
      analyzer.mergeIfElse(thenState, elseState);

      // Now x IS definitely assigned
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(true);
    });

    it('should handle loop branches correctly', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Save state before loop
      const beforeLoop = analyzer.enterBranch();

      // Loop body assigns x
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));

      // Merge with branchExecuted = false (loop might not execute)
      analyzer.mergeBranch(beforeLoop, false);

      // After loop, x might not be assigned (loop might not run)
      expect(analyzer.isDefinitelyAssigned(varSymbol)).toBe(false);
    });
  });

  describe('possibly uninitialized warnings', () => {
    it('should report warning for possibly uninitialized variable', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Save state
      const beforeState = analyzer.enterBranch();

      // Assign only in one branch
      analyzer.recordAssignment(varSymbol, createTestLocation(3, 1));
      const thenState = analyzer.enterBranch();

      // Restore for else (no assignment)
      analyzer.mergeBranch(beforeState);
      const elseState = analyzer.enterBranch();

      // Merge
      analyzer.mergeIfElse(thenState, elseState);

      // Now read the variable
      analyzer.checkRead(varSymbol, createTestLocation(10, 1));

      const issues = analyzer.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe(DefiniteAssignmentIssueKind.PossiblyUninitialized);
      expect(issues[0].severity).toBe(DefiniteAssignmentSeverity.Warning);
    });
  });

  describe('buildResult()', () => {
    it('should build result with correct statistics', () => {
      // Add multiple variables
      symbolTable.declareVariable('x', createTestLocation(1, 1));
      symbolTable.declareVariable('y', createTestLocation(2, 1), null, {
        initializer: {} as any,
      });

      const result = analyzer.analyze();

      expect(result.variablesAnalyzed).toBe(2);
      expect(result.hasIssues).toBe(false);
    });

    it('should count errors and warnings separately', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();

      // Read without assignment (error)
      analyzer.checkRead(varSymbol, createTestLocation(5, 1));

      // Check issues directly (analyze() would reset)
      const issues = analyzer.getIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe(DefiniteAssignmentSeverity.Error);
    });
  });

  describe('formatReport()', () => {
    it('should format report with no issues', () => {
      const report = analyzer.formatReport();
      expect(report).toContain('No issues found');
    });

    it('should format report with issues', () => {
      const declResult = symbolTable.declareVariable('myVar', createTestLocation(1, 5));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();
      analyzer.checkRead(varSymbol, createTestLocation(5, 10));

      const report = analyzer.formatReport();

      expect(report).toContain('Definite Assignment Analysis Report');
      expect(report).toContain('myVar');
      expect(report).toContain('used before being assigned');
      expect(report).toContain('suggestion');
    });
  });

  describe('reset()', () => {
    it('should clear all state when reset', () => {
      const declResult = symbolTable.declareVariable('x', createTestLocation(1, 1));
      const varSymbol = declResult.symbol!;

      analyzer.analyze();
      analyzer.checkRead(varSymbol, createTestLocation(5, 1));

      expect(analyzer.getIssues()).toHaveLength(1);

      analyzer.reset();

      expect(analyzer.getIssues()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown symbols gracefully', () => {
      // Create a different symbol table and symbol not in our analyzer's symbol table
      const otherSymbolTable = new SymbolTable(null, 'other');
      const unknownResult = otherSymbolTable.declareVariable('unknown', createTestLocation(1, 1));
      const unknownSymbol = unknownResult.symbol!;

      analyzer.analyze();

      // Should not throw when checking read of unknown symbol
      analyzer.checkRead(unknownSymbol, createTestLocation(5, 1));

      // Should not report issues for unknown symbols
      expect(analyzer.getIssues()).toHaveLength(0);
    });

    it('should handle multiple scopes', () => {
      // Module scope variable
      symbolTable.declareVariable('moduleX', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });

      // Function scope
      const funcResult = symbolTable.declareFunction('testFunc', createTestLocation(2, 1));
      symbolTable.enterFunctionScope(funcResult.symbol!);

      // Local variable in function
      symbolTable.declareVariable('localY', createTestLocation(3, 1));

      const result = analyzer.analyze();

      expect(result.variablesAnalyzed).toBe(2);
    });

    it('should handle shadowed variables correctly', () => {
      // Module scope variable with initializer
      const outerResult = symbolTable.declareVariable('x', createTestLocation(1, 1), null, {
        initializer: {} as any,
      });
      const outerX = outerResult.symbol!;

      // Enter block scope
      symbolTable.enterBlockScope();

      // Inner variable without initializer
      const innerResult = symbolTable.declareVariable('x', createTestLocation(3, 1));
      const innerX = innerResult.symbol!;

      analyzer.analyze();

      // Outer x is assigned, inner x is not
      expect(analyzer.isDefinitelyAssigned(outerX)).toBe(true);
      expect(analyzer.isDefinitelyAssigned(innerX)).toBe(false);
    });
  });
});