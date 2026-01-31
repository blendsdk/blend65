/**
 * Advanced Analyzer Orchestrator for Blend65 Compiler v2
 *
 * Coordinates all advanced semantic analysis passes beyond basic type checking.
 * This orchestrator runs analysis passes in the correct order and collects
 * all diagnostics and optimization hints.
 *
 * **Analysis Tiers:**
 * The analysis passes are organized into tiers based on their dependencies:
 *
 * **Tier 1 - Core Analysis (no CFG required):**
 * - Definite Assignment: Detects uninitialized variables
 * - Variable Usage: Detects unused variables and parameters
 *
 * **Tier 2 - CFG-Based Analysis (requires control flow graphs):**
 * - Dead Code: Detects unreachable code
 * - Liveness: Computes live variable sets for optimization
 *
 * **Tier 3 - Optimization Hints (requires call graph and earlier analysis):**
 * - Purity: Determines function side effects
 * - Loop Analysis: Identifies loop optimization opportunities
 * - M6502 Hints: Generates 6502-specific optimization hints
 *
 * **SFA Context:**
 * These analyses help produce optimal code for Blend65's Static Frame Allocation
 * model. The hints generated guide code generation to produce efficient 6502
 * assembly code that fits in limited memory.
 *
 * @module semantic/analysis/advanced-analyzer
 */

import type {
  Program,
  IdentifierExpression,
  AssignmentExpression,
  ForStatement,
} from '../../ast/index.js';
import { ASTWalker } from '../../ast/walker/index.js';
import type { SymbolTable, Symbol } from '../index.js';
import { SymbolKind } from '../symbol.js';
import type { ControlFlowGraph } from '../control-flow.js';
import type { GlobalSymbolTable } from '../global-symbol-table.js';
import type { TypeSystem } from '../type-system.js';

import {
  DefiniteAssignmentAnalyzer,
  DefiniteAssignmentSeverity,
  type DefiniteAssignmentResult,
  type DefiniteAssignmentIssue,
} from './definite-assignment.js';

import {
  VariableUsageAnalyzer,
  VariableUsageSeverity,
  type VariableUsageResult,
  type VariableUsageIssue,
  type VariableUsageOptions,
} from './variable-usage.js';

import {
  DeadCodeAnalyzer,
  DeadCodeSeverity,
  type DeadCodeResult,
  type DeadCodeIssue,
} from './dead-code.js';

import {
  LivenessAnalyzer,
  type LivenessResult,
  type LivenessOptions,
} from './liveness.js';

import {
  PurityAnalyzer,
  type PurityAnalysisResult,
  type PurityAnalysisOptions,
} from './purity-analysis.js';

import {
  LoopAnalyzer,
  type LoopAnalysisResult,
  type LoopAnalysisOptions,
} from './loop-analysis.js';

import {
  M6502HintAnalyzer,
  type M6502HintResult,
  type M6502HintOptions,
} from './m6502-hints.js';

/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  /** Error - must be fixed */
  Error = 'error',
  /** Warning - should be reviewed */
  Warning = 'warning',
  /** Info - informational only */
  Info = 'info',
}

/**
 * Diagnostic category for grouping
 */
export enum DiagnosticCategory {
  /** Definite assignment issues */
  DefiniteAssignment = 'definite_assignment',
  /** Variable usage issues */
  VariableUsage = 'variable_usage',
  /** Dead code issues */
  DeadCode = 'dead_code',
  /** Purity analysis findings */
  Purity = 'purity',
  /** Loop analysis findings */
  Loop = 'loop',
  /** M6502 optimization hints */
  M6502 = 'm6502',
}

/**
 * A unified diagnostic from any analysis pass
 */
export interface AdvancedDiagnostic {
  /** Unique identifier for this diagnostic type */
  code: string;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Category of the diagnostic */
  category: DiagnosticCategory;
  /** Human-readable message */
  message: string;
  /** Source location */
  location: {
    line: number;
    column: number;
    file?: string;
  };
  /** Suggested fix */
  suggestion?: string;
  /** Related symbol (if applicable) */
  symbol?: Symbol;
  /** Function name (if applicable) */
  functionName?: string;
}

/**
 * Configuration options for advanced analysis
 */
export interface AdvancedAnalysisOptions {
  /**
   * Enable Tier 1 analysis (definite assignment, variable usage)
   * @default true
   */
  enableTier1: boolean;

  /**
   * Enable Tier 2 analysis (dead code, liveness)
   * Requires CFGs to be provided
   * @default true
   */
  enableTier2: boolean;

  /**
   * Enable Tier 3 analysis (purity, loop, m6502 hints)
   * Requires global symbol table
   * @default true
   */
  enableTier3: boolean;

  /**
   * Variable usage analysis options
   */
  variableUsage?: Partial<VariableUsageOptions>;

  /**
   * Liveness analysis options
   */
  liveness?: Partial<LivenessOptions>;

  /**
   * Purity analysis options
   */
  purity?: Partial<PurityAnalysisOptions>;

  /**
   * Loop analysis options
   */
  loop?: Partial<LoopAnalysisOptions>;

  /**
   * M6502 hints options
   */
  m6502?: Partial<M6502HintOptions>;

  /**
   * Maximum diagnostics to collect before stopping
   * @default 1000
   */
  maxDiagnostics: number;

  /**
   * Include informational diagnostics
   * @default true
   */
  includeInfo: boolean;
}

/**
 * Default advanced analysis options
 */
export const DEFAULT_ADVANCED_OPTIONS: AdvancedAnalysisOptions = {
  enableTier1: true,
  enableTier2: true,
  enableTier3: true,
  maxDiagnostics: 1000,
  includeInfo: true,
};

/**
 * Result of advanced analysis
 */
export interface AdvancedAnalysisResult {
  /** All diagnostics from all analysis passes */
  diagnostics: AdvancedDiagnostic[];

  /** Count by severity */
  errorCount: number;
  warningCount: number;
  infoCount: number;

  /** Results from individual analyzers */
  definiteAssignment?: DefiniteAssignmentResult;
  variableUsage?: VariableUsageResult;
  deadCode?: DeadCodeResult;
  liveness?: Map<string, LivenessResult>;
  purity?: PurityAnalysisResult;
  loopAnalysis?: LoopAnalysisResult;
  m6502Hints?: M6502HintResult;

  /** Statistics */
  analysisTime: number;
  tiersCompleted: number[];
}

/**
 * Advanced Analyzer Orchestrator
 *
 * Coordinates all advanced semantic analysis passes and collects
 * unified diagnostics. Designed to be used after the main semantic
 * analysis (symbol table building, type resolution, type checking).
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new AdvancedAnalyzer(symbolTable, typeSystem, {
 *   globalSymbolTable,  // Required for Tier 3
 *   cfgs,               // Required for Tier 2
 *   functionSymbols,    // Required for Tier 3
 * });
 *
 * // Run analysis
 * const result = analyzer.analyze(ast);
 *
 * // Process diagnostics
 * for (const diag of result.diagnostics) {
 *   console.log(`${diag.severity}: ${diag.message}`);
 * }
 *
 * // Access individual results
 * if (result.m6502Hints) {
 *   // Use zero-page recommendations
 *   for (const rec of result.m6502Hints.zeroPageRecommendations) {
 *     console.log(`Zero-page candidate: ${rec.symbol.name}`);
 *   }
 * }
 * ```
 *
 * **Analysis Order:**
 * 1. Tier 1: Definite assignment → Variable usage
 * 2. Tier 2: Dead code → Liveness (requires CFGs)
 * 3. Tier 3: Purity → Loop analysis → M6502 hints
 */
export class AdvancedAnalyzer {
  /** Symbol table from semantic analysis */
  protected readonly symbolTable: SymbolTable;

  /** Type system for type information */
  protected readonly typeSystem: TypeSystem;

  /** Global symbol table (for Tier 3 analysis) */
  protected readonly globalSymbolTable?: GlobalSymbolTable;

  /** Control flow graphs per function (for Tier 2 analysis) */
  protected readonly cfgs?: Map<string, ControlFlowGraph>;

  /** Function symbols map (for Tier 3 analysis) */
  protected readonly functionSymbols?: Map<string, Symbol>;

  /** Configuration options */
  protected readonly options: AdvancedAnalysisOptions;

  /** Collected diagnostics */
  protected diagnostics: AdvancedDiagnostic[];

  /** Individual analyzer instances */
  protected definiteAssignmentAnalyzer?: DefiniteAssignmentAnalyzer;
  protected variableUsageAnalyzer?: VariableUsageAnalyzer;
  protected deadCodeAnalyzer?: DeadCodeAnalyzer;
  protected livenessAnalyzers: Map<string, LivenessAnalyzer>;
  protected purityAnalyzer?: PurityAnalyzer;
  protected loopAnalyzer?: LoopAnalyzer;
  protected m6502Analyzer?: M6502HintAnalyzer;

  /**
   * Create a new advanced analyzer
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param typeSystem - Type system for type information
   * @param context - Additional context required for analysis
   * @param options - Configuration options
   */
  constructor(
    symbolTable: SymbolTable,
    typeSystem: TypeSystem,
    context?: {
      globalSymbolTable?: GlobalSymbolTable;
      cfgs?: Map<string, ControlFlowGraph>;
      functionSymbols?: Map<string, Symbol>;
    },
    options?: Partial<AdvancedAnalysisOptions>
  ) {
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.globalSymbolTable = context?.globalSymbolTable;
    this.cfgs = context?.cfgs;
    this.functionSymbols = context?.functionSymbols;
    this.options = { ...DEFAULT_ADVANCED_OPTIONS, ...options };
    this.diagnostics = [];
    this.livenessAnalyzers = new Map();
  }

  /** The current AST being analyzed */
  protected currentAst?: Program;

  /**
   * Run all enabled analysis passes
   *
   * Executes analysis in tier order, collecting diagnostics from each pass.
   *
   * @param ast - The AST to analyze
   * @returns Complete analysis result
   */
  public analyze(ast?: Program): AdvancedAnalysisResult {
    this.currentAst = ast;
    const startTime = Date.now();
    this.diagnostics = [];
    const tiersCompleted: number[] = [];

    // Individual results
    let definiteAssignmentResult: DefiniteAssignmentResult | undefined;
    let variableUsageResult: VariableUsageResult | undefined;
    let deadCodeResult: DeadCodeResult | undefined;
    let livenessResults: Map<string, LivenessResult> | undefined;
    let purityResult: PurityAnalysisResult | undefined;
    let loopResult: LoopAnalysisResult | undefined;
    let m6502Result: M6502HintResult | undefined;

    // Tier 1: Core analysis
    if (this.options.enableTier1) {
      definiteAssignmentResult = this.runTier1DefiniteAssignment();
      variableUsageResult = this.runTier1VariableUsage();
      tiersCompleted.push(1);
    }

    // Tier 2: CFG-based analysis
    if (this.options.enableTier2 && this.cfgs && this.cfgs.size > 0) {
      deadCodeResult = this.runTier2DeadCode();
      livenessResults = this.runTier2Liveness();
      tiersCompleted.push(2);
    }

    // Tier 3: Optimization hints
    if (this.options.enableTier3 && this.globalSymbolTable && this.functionSymbols) {
      purityResult = this.runTier3Purity();
      loopResult = this.runTier3LoopAnalysis();
      m6502Result = this.runTier3M6502Hints();
      tiersCompleted.push(3);
    }

    // Count by severity
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const diag of this.diagnostics) {
      switch (diag.severity) {
        case DiagnosticSeverity.Error:
          errorCount++;
          break;
        case DiagnosticSeverity.Warning:
          warningCount++;
          break;
        case DiagnosticSeverity.Info:
          infoCount++;
          break;
      }
    }

    return {
      diagnostics: [...this.diagnostics],
      errorCount,
      warningCount,
      infoCount,
      definiteAssignment: definiteAssignmentResult,
      variableUsage: variableUsageResult,
      deadCode: deadCodeResult,
      liveness: livenessResults,
      purity: purityResult,
      loopAnalysis: loopResult,
      m6502Hints: m6502Result,
      analysisTime: Date.now() - startTime,
      tiersCompleted,
    };
  }

  /**
   * Run Tier 1: Definite Assignment Analysis
   *
   * Detects variables that may be used before being assigned.
   */
  protected runTier1DefiniteAssignment(): DefiniteAssignmentResult {
    this.definiteAssignmentAnalyzer = new DefiniteAssignmentAnalyzer(this.symbolTable);
    const result = this.definiteAssignmentAnalyzer.analyze();

    // Convert issues to unified diagnostics
    for (const issue of result.issues) {
      if (this.shouldIncludeDiagnostic(this.convertDefiniteAssignmentSeverity(issue.severity))) {
        this.addDiagnostic(this.convertDefiniteAssignmentIssue(issue));
      }
    }

    return result;
  }

  /**
   * Run Tier 1: Variable Usage Analysis
   *
   * Detects unused variables and parameters.
   * Walks the AST to record variable reads/writes before analyzing.
   */
  protected runTier1VariableUsage(): VariableUsageResult {
    this.variableUsageAnalyzer = new VariableUsageAnalyzer(
      this.symbolTable,
      this.options.variableUsage
    );
    this.variableUsageAnalyzer.initialize();

    // Walk the AST to record variable reads and writes
    if (this.currentAst) {
      this.recordVariableUsageFromAST(this.currentAst);
    }

    const result = this.variableUsageAnalyzer.analyze();

    // Convert issues to unified diagnostics
    for (const issue of result.issues) {
      if (this.shouldIncludeDiagnostic(this.convertVariableUsageSeverity(issue.severity))) {
        this.addDiagnostic(this.convertVariableUsageIssue(issue));
      }
    }

    return result;
  }

  /**
   * Walk the AST to record variable reads and writes for usage analysis
   *
   * This is necessary because the variable usage analyzer needs to know
   * where variables are actually used (read) in expressions.
   *
   * @param ast - The program AST to walk
   */
  protected recordVariableUsageFromAST(ast: Program): void {
    const analyzer = this.variableUsageAnalyzer;
    if (!analyzer) return;

    const symTable = this.symbolTable;

    /**
     * AST walker that records variable reads
     * Uses constructor injection to capture the analyzer reference
     */
    class UsageWalker extends ASTWalker {
      protected currentAssignment: AssignmentExpression | null = null;

      constructor(
        private readonly usageAnalyzer: VariableUsageAnalyzer,
        private readonly symbolTable: SymbolTable
      ) {
        super();
      }

      override visitIdentifierExpression(node: IdentifierExpression): void {
        const name = node.getName();
        const symbol = this.symbolTable.lookup(name);

        if (symbol && (symbol.kind === SymbolKind.Variable || symbol.kind === SymbolKind.Parameter)) {
          // Check if this is a read or write context
          // If we're inside an assignment and this is the target, it's a write (handled separately)
          if (this.currentAssignment === null || this.currentAssignment.getTarget() !== node) {
            // This is a READ - variable is being used in an expression
            this.usageAnalyzer.recordRead(symbol, node.getLocation());
          }
          // Note: writes are handled in visitAssignmentExpression
        }

        super.visitIdentifierExpression(node);
      }

      override visitAssignmentExpression(node: AssignmentExpression): void {
        // Record write for the assignment target
        const target = node.getTarget();
        if (target.getNodeType() === 'IdentifierExpression') {
          const identExpr = target as IdentifierExpression;
          const name = identExpr.getName();
          const symbol = this.symbolTable.lookup(name);

          if (symbol && (symbol.kind === SymbolKind.Variable || symbol.kind === SymbolKind.Parameter)) {
            this.usageAnalyzer.recordWrite(symbol, target.getLocation());
          }
        }

        // Save current assignment context for identifier visits
        const prevAssignment = this.currentAssignment;
        this.currentAssignment = node;

        // Visit target (but it's a write context, so identifier won't record a read)
        target.accept(this);

        // Reset context before visiting value (value identifiers are reads)
        this.currentAssignment = null;

        // Visit value expression - identifiers here ARE reads
        node.getValue().accept(this);

        // Restore
        this.currentAssignment = prevAssignment;
      }

      override visitForStatement(node: ForStatement): void {
        // Mark loop counter as a loop counter (may be intentionally unused)
        // Blend65 for loops have a 'variable' property, not an initializer
        const varName = node.getVariable();
        const symbol = this.symbolTable.lookup(varName);
        if (symbol) {
          this.usageAnalyzer.markAsLoopCounter(symbol);
        }

        // Continue normal traversal
        super.visitForStatement(node);
      }
    }

    const walker = new UsageWalker(analyzer, symTable);
    walker.walk(ast);
  }

  /**
   * Run Tier 2: Dead Code Analysis
   *
   * Detects unreachable code using CFGs.
   */
  protected runTier2DeadCode(): DeadCodeResult {
    this.deadCodeAnalyzer = new DeadCodeAnalyzer();

    if (this.cfgs) {
      this.deadCodeAnalyzer.analyzeFunctions(this.cfgs);
    }

    const result = this.deadCodeAnalyzer.getResult();

    // Convert issues to unified diagnostics
    for (const issue of result.issues) {
      if (this.shouldIncludeDiagnostic(this.convertDeadCodeSeverity(issue.severity))) {
        this.addDiagnostic(this.convertDeadCodeIssue(issue));
      }
    }

    return result;
  }

  /**
   * Run Tier 2: Liveness Analysis
   *
   * Computes live variable sets for each function's CFG.
   */
  protected runTier2Liveness(): Map<string, LivenessResult> {
    const results = new Map<string, LivenessResult>();

    if (this.cfgs) {
      for (const [functionName, cfg] of this.cfgs) {
        const analyzer = new LivenessAnalyzer(this.options.liveness);
        this.livenessAnalyzers.set(functionName, analyzer);

        // Note: The liveness analyzer requires use/def information to be recorded
        // during AST traversal. Here we just run the analysis with whatever
        // has been recorded.
        const result = analyzer.analyze(cfg);
        results.set(functionName, result);

        // Liveness analysis doesn't produce diagnostics directly
        // but the results are used by other optimizations
      }
    }

    return results;
  }

  /**
   * Run Tier 3: Purity Analysis
   *
   * Determines which functions have side effects.
   */
  protected runTier3Purity(): PurityAnalysisResult {
    if (!this.globalSymbolTable || !this.functionSymbols) {
      return {
        functions: new Map(),
        pureCount: 0,
        impureCount: 0,
        totalFunctions: 0,
        purityPercentage: 0,
      };
    }

    this.purityAnalyzer = new PurityAnalyzer(
      this.globalSymbolTable,
      this.functionSymbols,
      this.options.purity
    );

    // Initialize all functions
    for (const name of this.functionSymbols.keys()) {
      this.purityAnalyzer.initializeFunction(name);
    }

    const result = this.purityAnalyzer.analyze();

    // Purity results are informational, not diagnostics
    // They're used by the optimizer

    return result;
  }

  /**
   * Run Tier 3: Loop Analysis
   *
   * Identifies loop optimization opportunities.
   */
  protected runTier3LoopAnalysis(): LoopAnalysisResult {
    this.loopAnalyzer = new LoopAnalyzer(this.options.loop);
    const result = this.loopAnalyzer.analyze();

    // Loop analysis results are used by the optimizer
    // No diagnostics are generated

    return result;
  }

  /**
   * Run Tier 3: M6502 Hints Analysis
   *
   * Generates 6502-specific optimization hints.
   */
  protected runTier3M6502Hints(): M6502HintResult {
    if (!this.globalSymbolTable || !this.functionSymbols) {
      return {
        hints: [],
        zeroPageRecommendations: [],
        estimatedZeroPageNeeds: 0,
        inlineCandidates: [],
        tailCallCandidates: [],
        hotVariables: [],
      };
    }

    this.m6502Analyzer = new M6502HintAnalyzer(
      this.globalSymbolTable,
      this.functionSymbols,
      this.options.m6502
    );

    const result = this.m6502Analyzer.analyze();

    // M6502 hints can produce informational diagnostics
    if (this.options.includeInfo) {
      for (const hint of result.hints) {
        this.addDiagnostic({
          code: `M6502_${hint.kind.toUpperCase()}`,
          severity: DiagnosticSeverity.Info,
          category: DiagnosticCategory.M6502,
          message: hint.description,
          location: {
            line: hint.location.start.line,
            column: hint.location.start.column,
          },
          symbol: hint.symbol,
          functionName: hint.functionName,
        });
      }
    }

    return result;
  }

  /**
   * Add a diagnostic to the collection
   */
  protected addDiagnostic(diagnostic: AdvancedDiagnostic): void {
    if (this.diagnostics.length < this.options.maxDiagnostics) {
      this.diagnostics.push(diagnostic);
    }
  }

  /**
   * Check if a diagnostic should be included based on severity
   */
  protected shouldIncludeDiagnostic(severity: DiagnosticSeverity): boolean {
    if (severity === DiagnosticSeverity.Info) {
      return this.options.includeInfo;
    }
    return true;
  }

  /**
   * Convert definite assignment severity to unified severity
   */
  protected convertDefiniteAssignmentSeverity(severity: DefiniteAssignmentSeverity): DiagnosticSeverity {
    switch (severity) {
      case DefiniteAssignmentSeverity.Error:
        return DiagnosticSeverity.Error;
      case DefiniteAssignmentSeverity.Warning:
        return DiagnosticSeverity.Warning;
      case DefiniteAssignmentSeverity.Info:
        return DiagnosticSeverity.Info;
    }
  }

  /**
   * Convert variable usage severity to unified severity
   */
  protected convertVariableUsageSeverity(severity: VariableUsageSeverity): DiagnosticSeverity {
    switch (severity) {
      case VariableUsageSeverity.Warning:
        return DiagnosticSeverity.Warning;
      case VariableUsageSeverity.Info:
        return DiagnosticSeverity.Info;
    }
  }

  /**
   * Convert dead code severity to unified severity
   */
  protected convertDeadCodeSeverity(severity: DeadCodeSeverity): DiagnosticSeverity {
    switch (severity) {
      case DeadCodeSeverity.Warning:
        return DiagnosticSeverity.Warning;
      case DeadCodeSeverity.Info:
        return DiagnosticSeverity.Info;
    }
  }

  /**
   * Convert definite assignment issue to unified diagnostic
   */
  protected convertDefiniteAssignmentIssue(issue: DefiniteAssignmentIssue): AdvancedDiagnostic {
    return {
      code: `DA_${issue.kind.toUpperCase()}`,
      severity: this.convertDefiniteAssignmentSeverity(issue.severity),
      category: DiagnosticCategory.DefiniteAssignment,
      message: issue.message,
      location: {
        line: issue.readLocation.start.line,
        column: issue.readLocation.start.column,
      },
      suggestion: issue.suggestion,
      symbol: issue.symbol,
    };
  }

  /**
   * Convert variable usage issue to unified diagnostic
   */
  protected convertVariableUsageIssue(issue: VariableUsageIssue): AdvancedDiagnostic {
    return {
      code: `VU_${issue.kind.toUpperCase()}`,
      severity: this.convertVariableUsageSeverity(issue.severity),
      category: DiagnosticCategory.VariableUsage,
      message: issue.message,
      location: {
        line: issue.location.start.line,
        column: issue.location.start.column,
      },
      suggestion: issue.suggestion,
      symbol: issue.symbol,
    };
  }

  /**
   * Convert dead code issue to unified diagnostic
   */
  protected convertDeadCodeIssue(issue: DeadCodeIssue): AdvancedDiagnostic {
    return {
      code: `DC_${issue.kind.toUpperCase()}`,
      severity: this.convertDeadCodeSeverity(issue.severity),
      category: DiagnosticCategory.DeadCode,
      message: issue.message,
      location: {
        line: issue.location.start.line,
        column: issue.location.start.column,
      },
      suggestion: issue.suggestion,
      functionName: issue.functionName,
    };
  }

  /**
   * Get all collected diagnostics
   *
   * @returns Array of all diagnostics
   */
  public getDiagnostics(): AdvancedDiagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get diagnostics filtered by severity
   *
   * @param severity - Severity to filter by
   * @returns Filtered diagnostics
   */
  public getDiagnosticsBySeverity(severity: DiagnosticSeverity): AdvancedDiagnostic[] {
    return this.diagnostics.filter(d => d.severity === severity);
  }

  /**
   * Get diagnostics filtered by category
   *
   * @param category - Category to filter by
   * @returns Filtered diagnostics
   */
  public getDiagnosticsByCategory(category: DiagnosticCategory): AdvancedDiagnostic[] {
    return this.diagnostics.filter(d => d.category === category);
  }

  /**
   * Check if any errors were found
   *
   * @returns true if there are error-level diagnostics
   */
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.Error);
  }

  /**
   * Check if any warnings were found
   *
   * @returns true if there are warning-level diagnostics
   */
  public hasWarnings(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.Warning);
  }

  /**
   * Get access to individual analyzers for advanced use
   */
  public getDefiniteAssignmentAnalyzer(): DefiniteAssignmentAnalyzer | undefined {
    return this.definiteAssignmentAnalyzer;
  }

  public getVariableUsageAnalyzer(): VariableUsageAnalyzer | undefined {
    return this.variableUsageAnalyzer;
  }

  public getDeadCodeAnalyzer(): DeadCodeAnalyzer | undefined {
    return this.deadCodeAnalyzer;
  }

  public getLivenessAnalyzer(functionName: string): LivenessAnalyzer | undefined {
    return this.livenessAnalyzers.get(functionName);
  }

  public getPurityAnalyzer(): PurityAnalyzer | undefined {
    return this.purityAnalyzer;
  }

  public getLoopAnalyzer(): LoopAnalyzer | undefined {
    return this.loopAnalyzer;
  }

  public getM6502Analyzer(): M6502HintAnalyzer | undefined {
    return this.m6502Analyzer;
  }

  /**
   * Format a human-readable report of all analysis results
   *
   * @returns Multi-line report string
   */
  public formatReport(): string {
    const lines: string[] = [];

    lines.push('=== Advanced Analysis Report ===');
    lines.push('');

    // Summary
    const errors = this.getDiagnosticsBySeverity(DiagnosticSeverity.Error);
    const warnings = this.getDiagnosticsBySeverity(DiagnosticSeverity.Warning);
    const info = this.getDiagnosticsBySeverity(DiagnosticSeverity.Info);

    lines.push('Summary:');
    lines.push(`  Errors: ${errors.length}`);
    lines.push(`  Warnings: ${warnings.length}`);
    lines.push(`  Info: ${info.length}`);
    lines.push('');

    // Diagnostics by category
    for (const category of Object.values(DiagnosticCategory)) {
      const categoryDiags = this.getDiagnosticsByCategory(category);
      if (categoryDiags.length > 0) {
        lines.push(`${category}:`);
        for (const diag of categoryDiags.slice(0, 10)) {
          lines.push(`  [${diag.severity}] ${diag.message}`);
          lines.push(`    at line ${diag.location.line}, column ${diag.location.column}`);
          if (diag.suggestion) {
            lines.push(`    suggestion: ${diag.suggestion}`);
          }
        }
        if (categoryDiags.length > 10) {
          lines.push(`  ... and ${categoryDiags.length - 10} more`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state for reuse
   */
  public reset(): void {
    this.diagnostics = [];
    this.definiteAssignmentAnalyzer = undefined;
    this.variableUsageAnalyzer = undefined;
    this.deadCodeAnalyzer = undefined;
    this.livenessAnalyzers.clear();
    this.purityAnalyzer = undefined;
    this.loopAnalyzer = undefined;
    this.m6502Analyzer = undefined;
  }
}