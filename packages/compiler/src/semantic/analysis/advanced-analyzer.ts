/**
 * Advanced Analyzer Orchestrator (Phase 8)
 *
 * Main orchestrator for all Phase 8 optimization analyses.
 * Coordinates Tier 1-3 analyses in proper dependency order.
 *
 * **Analysis Only**: This class performs analysis and marks opportunities.
 * It does NOT perform transformations - that's the IL optimizer's job.
 */

import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { TypeSystem } from '../type-system.js';
import type { ControlFlowGraph } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { DefiniteAssignmentAnalyzer } from './definite-assignment.js';
import { VariableUsageAnalyzer } from './variable-usage.js';
import { UnusedFunctionAnalyzer } from './unused-functions.js';
import { DeadCodeAnalyzer } from './dead-code.js';
import { ReachingDefinitionsAnalyzer } from './reaching-definitions.js';
import { LivenessAnalyzer } from './liveness.js';
import { ConstantPropagationAnalyzer } from './constant-propagation.js';
import { AliasAnalyzer } from './alias-analysis.js';
import { PurityAnalyzer } from './purity-analysis.js';
import { EscapeAnalyzer } from './escape-analysis.js';
import { LoopAnalyzer } from './loop-analysis.js';
import { CallGraphAnalyzer } from './call-graph.js';
import { M6502HintAnalyzer } from './m6502-hints.js';
import { GlobalValueNumberingAnalyzer } from './global-value-numbering.js';
import { CommonSubexpressionEliminationAnalyzer } from './common-subexpr-elimination.js';
import { SourceLocation } from '../../ast/index.js';

/**
 * Advanced analyzer orchestrator (Phase 8)
 *
 * Coordinates all optimization analysis passes and generates
 * metadata for IL optimizer consumption.
 *
 * Analysis is performed in three tiers:
 * - Tier 1: Basic analysis (definite assignment, usage, dead code)
 * - Tier 2: Data flow analysis (reaching defs, liveness, constants)
 * - Tier 3: Advanced analysis (alias, purity, loops, 6502 hints)
 *
 * Each tier builds on results from previous tiers.
 *
 * @example
 * ```typescript
 * const analyzer = new AdvancedAnalyzer(symbolTable, cfgs, typeSystem);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class AdvancedAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /**
   * Creates an advanced analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   * @param typeSystem - Type system from Pass 2
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly cfgs: Map<string, ControlFlowGraph>,
    protected readonly typeSystem: TypeSystem
  ) {}

  /**
   * Run all Phase 8 analyses
   *
   * Executes analyses in dependency order:
   * 1. Tier 1: Basic analysis (usage, dead code detection)
   * 2. Tier 2: Data flow (reaching defs, liveness, constant propagation)
   * 3. Tier 3: Advanced (alias, purity, escape, loops, 6502 hints)
   *
   * Each tier's results are stored in AST node metadata using
   * OptimizationMetadataKey enum for type safety.
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Tier 1: Basic Analysis
      // Provides: usage counts, dead code detection, definite assignment
      this.runTier1BasicAnalysis(ast);

      // Tier 2: Data Flow Analysis (requires Tier 1)
      // Provides: reaching definitions, liveness, constant propagation
      this.runTier2DataFlowAnalysis(ast);

      // Tier 3: Advanced Analysis (requires Tiers 1+2)
      // Provides: alias analysis, purity, escape, loops, 6502 hints
      this.runTier3AdvancedAnalysis(ast);
    } catch (error) {
      // Catch any unexpected analysis errors
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic error
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error during advanced analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Tier 1: Basic Analysis
   *
   * Performs fundamental analyses that other tiers depend on:
   * - Task 8.1: Definite assignment analysis 
   * - Task 8.2: Variable usage analysis
   * - Task 8.3: Unused function detection
   * - Task 8.4: Dead code detection
   *
   * Results stored using OptimizationMetadataKey enum.
   *
   * @param ast - Program AST
   */
  protected runTier1BasicAnalysis(ast: Program): void {
    // Task 8.1: Definite assignment analysis 
    // Analyzes: variable initialization before use
    // Metadata: DefiniteAssignmentAlwaysInitialized, DefiniteAssignmentInitValue
    const definiteAssignment = new DefiniteAssignmentAnalyzer(this.symbolTable, this.cfgs);
    definiteAssignment.analyze(ast);
    this.diagnostics.push(...definiteAssignment.getDiagnostics());

    // Task 8.2: Variable usage analysis
    // Analyzes: read/write counts, hot path accesses, loop depth
    // Metadata: UsageReadCount, UsageWriteCount, UsageIsUsed, etc.
    const usageAnalyzer = new VariableUsageAnalyzer(this.symbolTable);
    usageAnalyzer.analyze(ast);
    this.diagnostics.push(...usageAnalyzer.getDiagnostics());

    // Task 8.3: Unused function detection
    // Analyzes: functions that are never called
    // Metadata: CallGraphUnused, CallGraphCallCount
    const functionAnalyzer = new UnusedFunctionAnalyzer(this.symbolTable);
    functionAnalyzer.analyze(ast);
    this.diagnostics.push(...functionAnalyzer.getDiagnostics());

    // Task 8.4: Dead code detection
    // Analyzes: unreachable statements, dead stores, unreachable branches
    // Metadata: DeadCodeUnreachable, DeadCodeKind, DeadCodeReason, DeadCodeRemovable
    const deadCodeAnalyzer = new DeadCodeAnalyzer(this.symbolTable, this.cfgs, this.typeSystem);
    deadCodeAnalyzer.analyze(ast);
    this.diagnostics.push(...deadCodeAnalyzer.getDiagnostics());
  }

  /**
   * Tier 2: Data Flow Analysis
   *
   * Performs classic data flow analyses:
   * - Task 8.5: Reaching definitions
   * - Task 8.6: Liveness analysis
   * - Task 8.7: Constant propagation
   *
   * Requires Tier 1 results (usage information).
   *
   * @param ast - Program AST
   */
  protected runTier2DataFlowAnalysis(ast: Program): void {
    // Task 8.5: Reaching definitions analysis
    // Analyzes: which definitions reach which uses
    // Metadata: ReachingDefinitionsSet, DefUseChain, UseDefChain
    const reachingAnalyzer = new ReachingDefinitionsAnalyzer(this.symbolTable, this.cfgs);
    reachingAnalyzer.analyze(ast);
    this.diagnostics.push(...reachingAnalyzer.getDiagnostics());

    // Task 8.6: Liveness analysis
    // Analyzes: variable live ranges, register allocation hints
    // Metadata: LivenessLiveIn, LivenessLiveOut, LivenessInterval
    const livenessAnalyzer = new LivenessAnalyzer(this.symbolTable, this.cfgs);
    livenessAnalyzer.analyze(ast);
    this.diagnostics.push(...livenessAnalyzer.getDiagnostics());

    // Task 8.7: Constant propagation
    // Analyzes: compile-time constant values, foldable expressions
    // Metadata: ConstantValue, ConstantFoldable, ConstantBranchCondition
    const constAnalyzer = new ConstantPropagationAnalyzer(this.symbolTable, this.cfgs);
    constAnalyzer.analyze(ast);
    this.diagnostics.push(...constAnalyzer.getDiagnostics());
  }

  /**
   * Tier 3: Advanced Analysis
   *
   * Performs sophisticated analyses for optimization:
   * - Task 8.8: Alias analysis
   * - Task 8.9: Purity analysis
   * - Task 8.10: Escape analysis
   * - Task 8.11: Loop analysis
   * - Task 8.12: Call graph analysis
   * - Task 8.13: 6502-specific hints
   * - Task 8.14.2: Global Value Numbering (GVN)
   * - Task 8.14.4: Common Subexpression Elimination (CSE)
   *
   * Requires Tiers 1+2 results (usage + data flow).
   *
   * @param ast - Program AST
   */
  protected runTier3AdvancedAnalysis(ast: Program): void {
    // Task 8.8: Alias analysis
    // Analyzes: pointer aliasing, memory regions, self-modifying code
    // Metadata: AliasPointsTo, AliasNonAliasSet, AliasMemoryRegion
    const aliasAnalyzer = new AliasAnalyzer(this.symbolTable);
    aliasAnalyzer.analyze(ast);
    this.diagnostics.push(...aliasAnalyzer.getDiagnostics());

    // Task 8.9: Purity analysis
    // Analyzes: function side effects, pure functions
    // Metadata: PurityLevel, PurityHasSideEffects, PurityWrittenLocations, PurityIsPure
    const purityAnalyzer = new PurityAnalyzer(this.symbolTable);
    purityAnalyzer.analyze(ast);
    this.diagnostics.push(...purityAnalyzer.getDiagnostics());

    // Task 8.10: Escape analysis
    // Analyzes: variable escape, stack allocatability, 6502 stack overflow detection
    // Metadata: EscapeEscapes, EscapeStackAllocatable, EscapeReason, StackDepth, StackOverflowRisk
    const escapeAnalyzer = new EscapeAnalyzer(this.symbolTable);
    escapeAnalyzer.analyze(ast);
    this.diagnostics.push(...escapeAnalyzer.getDiagnostics());

    // Task 8.11: Loop analysis
    // Analyzes: loop invariants, induction variables, hoisting, iteration counts
    // Metadata: LoopInvariant, LoopHoistCandidate, LoopInductionVariable, LoopIterationCount, LoopUnrollable
    const loopAnalyzer = new LoopAnalyzer(this.cfgs, this.symbolTable);
    loopAnalyzer.analyze(ast);
    this.diagnostics.push(...loopAnalyzer.getDiagnostics());

    // Task 8.12: Call graph analysis
    // Analyzes: inlining candidates, recursion, tail calls, dead functions
    // Metadata: CallGraphInlineCandidate, CallGraphRecursionDepth, CallGraphCallCount, CallGraphUnused
    const callGraphAnalyzer = new CallGraphAnalyzer();
    callGraphAnalyzer.analyze(ast);
    this.diagnostics.push(...callGraphAnalyzer.getDiagnostics());

    // Task 8.13: 6502-specific hints
    // Analyzes: zero-page priority, register preferences, cycle counts, reserved ZP validation
    // Metadata: M6502ZeroPagePriority, M6502RegisterPreference, M6502CycleEstimate, M6502ZeroPageReserved
    const m6502Analyzer = new M6502HintAnalyzer(this.symbolTable, this.cfgs);
    m6502Analyzer.analyze(ast);
    this.diagnostics.push(...m6502Analyzer.getDiagnostics());

    // Task 8.14.2: Global Value Numbering
    // Analyzes: redundant computations, value equivalence across code paths
    // Metadata: GVNNumber, GVNRedundant, GVNReplacement
    const gvnAnalyzer = new GlobalValueNumberingAnalyzer(this.cfgs, this.symbolTable);
    gvnAnalyzer.analyze(ast);
    this.diagnostics.push(...gvnAnalyzer.getDiagnostics());

    // Task 8.14.4: Common Subexpression Elimination
    // Analyzes: local redundant subexpressions within basic blocks
    // Metadata: CSEAvailable, CSECandidate
    const cseAnalyzer = new CommonSubexpressionEliminationAnalyzer(this.cfgs, this.symbolTable);
    cseAnalyzer.analyze(ast);
    this.diagnostics.push(...cseAnalyzer.getDiagnostics());
  }

  /**
   * Get all diagnostics generated during analysis
   *
   * Includes warnings about:
   * - Unused variables and functions
   * - Unreachable code
   * - Uninitialized variables
   * - Inefficient patterns
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Check if any errors occurred during analysis
   *
   * @returns True if errors exist
   */
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.ERROR);
  }

  /**
   * Check if any warnings occurred during analysis
   *
   * @returns True if warnings exist
   */
  public hasWarnings(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.WARNING);
  }

  /**
   * Add a diagnostic to the collection
   *
   * @param diagnostic - Diagnostic to add
   */
  protected addDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  /**
   * Create and add an error diagnostic
   *
   * @param message - Error message
   * @param location - Source location
   */
  protected addError(message: string, location: SourceLocation): void {
    this.diagnostics.push({
      code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic error
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    });
  }

  /**
   * Create and add a warning diagnostic
   *
   * @param message - Warning message
   * @param location - Source location
   */
  protected addWarning(message: string, location: SourceLocation): void {
    this.diagnostics.push({
      code: DiagnosticCode.UNUSED_IMPORT, // Generic warning code
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    });
  }

  /**
   * Create and add an info diagnostic
   *
   * @param message - Info message
   * @param location - Source location
   */
  protected addInfo(message: string, location: SourceLocation): void {
    this.diagnostics.push({
      code: DiagnosticCode.UNUSED_IMPORT, // Generic info code (will be refined later)
      severity: DiagnosticSeverity.INFO,
      message,
      location,
    });
  }
}