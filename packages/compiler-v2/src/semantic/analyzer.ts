/**
 * Semantic Analyzer for Blend65 Compiler v2
 *
 * Main entry point for semantic analysis. Orchestrates all semantic passes:
 *
 * **Pass 1**: Symbol Table Builder - Collects declarations, builds scope tree
 * **Pass 2**: Type Resolution - Resolves type annotations to TypeInfo objects
 * **Pass 3**: Type Checking - Type checks expressions and validates statements
 * **Pass 4**: (Integrated in Pass 3) - Statement validation (break/continue/return)
 * **Pass 5**: Control Flow Analysis - Builds CFGs, detects unreachable code
 * **Pass 6**: Call Graph & Recursion - Builds call graph, detects recursion (SFA error!)
 * **Pass 7**: Advanced Analysis - Definite assignment, variable usage, purity, etc.
 *
 * **Key Features:**
 * - Multi-pass architecture for clean separation of concerns
 * - SFA-optimized: Recursion detection is a compile-time ERROR
 * - Multi-module support with import/export resolution
 * - Comprehensive diagnostics with helpful error messages
 *
 * @module semantic/analyzer
 */

import type { Program, Diagnostic, SourceLocation } from '../ast/index.js';
import { DiagnosticSeverity, DiagnosticCode } from '../ast/diagnostics.js';
import type { SymbolTable } from './symbol-table.js';
import type { Symbol } from './symbol.js';
import { TypeSystem } from './type-system.js';
import type { ControlFlowGraph } from './control-flow.js';
import { CallGraph, CallGraphBuilder } from './call-graph.js';
import { RecursionChecker, type RecursionError, RecursionErrorCode } from './recursion-checker.js';
import { ModuleRegistry } from './module-registry.js';
import { DependencyGraph } from './dependency-graph.js';
import { ImportResolver, ImportErrorCode, type ImportError } from './import-resolver.js';
import { GlobalSymbolTable } from './global-symbol-table.js';
import {
  SymbolTableBuilder,
  type SymbolTableBuildResult,
} from './visitors/symbol-table-builder.js';
import { TypeResolver, type TypeResolutionResult } from './visitors/type-resolver.js';
import { TypeChecker, type TypeCheckPassResult } from './visitors/type-checker/index.js';
import { ControlFlowAnalyzer } from './visitors/control-flow-analyzer.js';
import {
  AdvancedAnalyzer,
  type AdvancedAnalysisResult,
  type AdvancedAnalysisOptions,
  type AdvancedDiagnostic,
  DiagnosticSeverity as AdvSeverity,
  DiagnosticCategory,
  DEFAULT_ADVANCED_OPTIONS,
} from './analysis/index.js';

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of analyzing a single module
 *
 * Contains all artifacts from semantic analysis:
 * - Symbol table with all declarations and scopes
 * - Type system with resolved types
 * - Control flow graphs for all functions
 * - Call graph tracking function relationships
 * - Diagnostics (errors and warnings)
 */
export interface AnalysisResult {
  /** Whether analysis completed successfully (no errors) */
  success: boolean;

  /** The module name */
  moduleName: string;

  /** The AST that was analyzed */
  ast: Program;

  /** Symbol table with all declarations and scopes */
  symbolTable: SymbolTable;

  /** Type system with built-in and custom types */
  typeSystem: TypeSystem;

  /** Control flow graphs for all functions */
  cfgs: Map<string, ControlFlowGraph>;

  /** Call graph tracking function relationships */
  callGraph: CallGraph;

  /** All collected diagnostics (errors, warnings, info) */
  diagnostics: Diagnostic[];

  /** Pass-specific results for debugging */
  passResults: {
    /** Pass 1: Symbol table building */
    symbolTableBuild: SymbolTableBuildResult;

    /** Pass 2: Type resolution */
    typeResolution: TypeResolutionResult;

    /** Pass 3: Type checking */
    typeCheck: TypeCheckPassResult;

    /** Pass 6: Recursion checking result */
    recursionErrors: RecursionError[];

    /** Pass 7: Advanced analysis (if enabled) */
    advancedAnalysis?: AdvancedAnalysisResult;
  };

  /** Statistics about the analysis */
  stats: {
    /** Total declarations analyzed */
    totalDeclarations: number;

    /** Total expressions type-checked */
    expressionsChecked: number;

    /** Total functions analyzed */
    functionsAnalyzed: number;

    /** Number of errors */
    errorCount: number;

    /** Number of warnings */
    warningCount: number;

    /** Time taken for analysis (ms) */
    analysisTimeMs: number;
  };
}

/**
 * Result of analyzing multiple modules together
 *
 * Contains aggregated results from all modules plus
 * cross-module information like import resolution.
 */
export interface MultiModuleAnalysisResult {
  /** Whether all modules analyzed successfully */
  success: boolean;

  /** Per-module analysis results */
  modules: Map<string, AnalysisResult>;

  /** Global symbol table aggregating all exports */
  globalSymbolTable: GlobalSymbolTable;

  /** Module dependency graph */
  dependencyGraph: DependencyGraph;

  /** Import resolution results */
  importResolution: {
    /** Whether all imports resolved successfully */
    success: boolean;
    /** Import resolution errors */
    errors: ImportError[];
  };

  /** Aggregated diagnostics from all modules */
  diagnostics: Diagnostic[];

  /** Compilation order (topologically sorted) */
  compilationOrder: string[];

  /** Statistics about the multi-module analysis */
  stats: {
    /** Total modules analyzed */
    totalModules: number;
    /** Total declarations across all modules */
    totalDeclarations: number;
    /** Total errors across all modules */
    totalErrors: number;
    /** Total warnings across all modules */
    totalWarnings: number;
    /** Total analysis time (ms) */
    totalTimeMs: number;
  };
}

// ============================================
// OPTIONS
// ============================================

/**
 * Options for semantic analysis
 */
export interface SemanticAnalyzerOptions {
  /**
   * Whether to run advanced analysis pass (Pass 7)
   * Includes: definite assignment, variable usage, liveness, etc.
   * Default: true
   */
  runAdvancedAnalysis?: boolean;

  /**
   * Options for the advanced analyzer
   */
  advancedAnalysisOptions?: Partial<AdvancedAnalysisOptions>;

  /**
   * Whether to stop on first error
   * Default: false
   */
  stopOnFirstError?: boolean;

  /**
   * Maximum number of errors before stopping
   * Default: 100
   */
  maxErrors?: number;

  /**
   * Whether to include info-level diagnostics
   * Default: false
   */
  includeInfoDiagnostics?: boolean;

  /**
   * Custom type system (for testing or extension)
   */
  typeSystem?: TypeSystem;
}

/**
 * Default analyzer options
 */
export const DEFAULT_ANALYZER_OPTIONS: SemanticAnalyzerOptions = {
  runAdvancedAnalysis: true,
  advancedAnalysisOptions: {},
  stopOnFirstError: false,
  maxErrors: 100,
  includeInfoDiagnostics: false,
  typeSystem: undefined,
};

// ============================================
// SEMANTIC ANALYZER
// ============================================

/**
 * Semantic Analyzer - Main entry point for semantic analysis
 *
 * Orchestrates all semantic passes for single and multi-module analysis.
 *
 * **Single Module Analysis:**
 * ```typescript
 * const analyzer = new SemanticAnalyzer();
 * const result = analyzer.analyze(programAST);
 *
 * if (result.success) {
 *   console.log('Analysis passed!');
 *   // Use result.symbolTable, result.callGraph, etc.
 * } else {
 *   for (const diag of result.diagnostics) {
 *     console.error(diag.message);
 *   }
 * }
 * ```
 *
 * **Multi-Module Analysis:**
 * ```typescript
 * const analyzer = new SemanticAnalyzer();
 * const result = analyzer.analyzeMultiple([program1, program2, program3]);
 *
 * if (result.success) {
 *   const order = result.compilationOrder;
 *   for (const moduleName of order) {
 *     const moduleResult = result.modules.get(moduleName)!;
 *     // Use moduleResult...
 *   }
 * }
 * ```
 */
export class SemanticAnalyzer {
  /**
   * Analysis options
   */
  protected options: SemanticAnalyzerOptions;

  /**
   * Type system (shared across passes)
   */
  protected typeSystem: TypeSystem;

  /**
   * Creates a new SemanticAnalyzer
   *
   * @param options - Analysis options
   */
  constructor(options?: SemanticAnalyzerOptions) {
    this.options = {
      ...DEFAULT_ANALYZER_OPTIONS,
      ...options,
    };
    this.typeSystem = this.options.typeSystem ?? new TypeSystem();
  }

  // ============================================
  // SINGLE MODULE ANALYSIS
  // ============================================

  /**
   * Analyzes a single module (program)
   *
   * Runs all semantic passes in sequence:
   * 1. Symbol table building
   * 2. Type resolution
   * 3. Type checking
   * 4. Control flow analysis
   * 5. Call graph & recursion detection
   * 6. Advanced analysis (optional)
   *
   * @param program - The program AST to analyze
   * @returns The analysis result
   */
  public analyze(program: Program): AnalysisResult {
    const startTime = Date.now();
    const diagnostics: Diagnostic[] = [];
    const moduleName = program.getModule().getFullName();

    // ----------------------------------------
    // Pass 1: Symbol Table Building
    // ----------------------------------------
    const symbolTableBuilder = new SymbolTableBuilder();
    const symbolTableResult = symbolTableBuilder.build(program);

    diagnostics.push(...symbolTableResult.diagnostics);

    // Check if we should stop
    if (this.shouldStopAnalysis(diagnostics)) {
      return this.createFailedResult(
        moduleName,
        program,
        symbolTableResult.symbolTable,
        diagnostics,
        symbolTableResult,
        Date.now() - startTime,
      );
    }

    // ----------------------------------------
    // Pass 2: Type Resolution
    // ----------------------------------------
    const typeResolver = new TypeResolver(this.typeSystem);
    const typeResolutionResult = typeResolver.resolve(
      symbolTableResult.symbolTable,
      program,
    );

    diagnostics.push(...typeResolutionResult.diagnostics);

    if (this.shouldStopAnalysis(diagnostics)) {
      return this.createFailedResult(
        moduleName,
        program,
        symbolTableResult.symbolTable,
        diagnostics,
        symbolTableResult,
        Date.now() - startTime,
        typeResolutionResult,
      );
    }

    // ----------------------------------------
    // Pass 3: Type Checking (includes Pass 4)
    // ----------------------------------------
    const typeChecker = new TypeChecker(this.typeSystem, {
      stopOnFirstError: this.options.stopOnFirstError ?? false,
      maxErrors: this.options.maxErrors ?? 100,
      reportWarnings: true,
    });
    const typeCheckResult = typeChecker.check(symbolTableResult.symbolTable, program);

    diagnostics.push(...typeCheckResult.diagnostics);

    if (this.shouldStopAnalysis(diagnostics)) {
      return this.createFailedResult(
        moduleName,
        program,
        symbolTableResult.symbolTable,
        diagnostics,
        symbolTableResult,
        Date.now() - startTime,
        typeResolutionResult,
        typeCheckResult,
      );
    }

    // ----------------------------------------
    // Pass 5: Control Flow Analysis
    // ----------------------------------------
    const cfAnalyzer = new ControlFlowAnalyzer(symbolTableResult.symbolTable);
    cfAnalyzer.walk(program);
    const cfgs = cfAnalyzer.getAllCFGs();
    const cfDiagnostics = cfAnalyzer.getDiagnostics();

    diagnostics.push(...cfDiagnostics);

    // ----------------------------------------
    // Pass 6: Call Graph & Recursion Detection
    // ----------------------------------------
    const callGraphBuilder = new CallGraphBuilder(symbolTableResult.symbolTable);
    const callGraph = callGraphBuilder.build(program);

    const recursionChecker = new RecursionChecker(callGraph);
    const recursionResult = recursionChecker.check();

    // Convert recursion errors to diagnostics
    const recursionErrors = recursionResult.errors;
    for (const error of recursionErrors) {
      diagnostics.push(this.recursionErrorToDiagnostic(error));
    }

    // ----------------------------------------
    // Pass 7: Advanced Analysis (optional)
    // ----------------------------------------
    let advancedResult: AdvancedAnalysisResult | undefined;

    if (this.options.runAdvancedAnalysis && !this.hasErrors(diagnostics)) {
      const advancedOptions: AdvancedAnalysisOptions = {
        ...DEFAULT_ADVANCED_OPTIONS,
        ...(this.options.advancedAnalysisOptions ?? {}),
      };

      const advancedAnalyzer = new AdvancedAnalyzer(
        symbolTableResult.symbolTable,
        this.typeSystem,
        {
          globalSymbolTable: this.createGlobalSymbolTableForSingleModule(moduleName, program),
          cfgs,
          functionSymbols: this.createFunctionSymbolsMap(symbolTableResult.symbolTable),
        },
        advancedOptions,
      );

      advancedResult = advancedAnalyzer.analyze(program);

      // Convert advanced diagnostics to standard diagnostics
      for (const advDiag of advancedResult.diagnostics) {
        if (this.shouldIncludeDiagnostic(advDiag)) {
          diagnostics.push(this.advancedDiagnosticToStandard(advDiag));
        }
      }
    }

    // ----------------------------------------
    // Build Result
    // ----------------------------------------
    const endTime = Date.now();
    const errorCount = this.countErrors(diagnostics);
    const warningCount = this.countWarnings(diagnostics);

    return {
      success: errorCount === 0,
      moduleName,
      ast: program,
      symbolTable: symbolTableResult.symbolTable,
      typeSystem: this.typeSystem,
      cfgs,
      callGraph,
      diagnostics,
      passResults: {
        symbolTableBuild: symbolTableResult,
        typeResolution: typeResolutionResult,
        typeCheck: typeCheckResult,
        recursionErrors,
        advancedAnalysis: advancedResult,
      },
      stats: {
        totalDeclarations: this.countDeclarations(symbolTableResult.symbolTable),
        expressionsChecked: typeCheckResult.expressionsChecked,
        functionsAnalyzed: callGraph.size(),
        errorCount,
        warningCount,
        analysisTimeMs: endTime - startTime,
      },
    };
  }

  // ============================================
  // MULTI-MODULE ANALYSIS
  // ============================================

  /**
   * Analyzes multiple modules together
   *
   * Handles cross-module dependencies:
   * 1. Builds dependency graph from imports
   * 2. Detects circular dependencies
   * 3. Computes compilation order (topological sort)
   * 4. Analyzes modules in dependency order
   * 5. Resolves cross-module imports
   * 6. Builds global symbol table
   *
   * @param programs - Array of program ASTs to analyze
   * @returns The multi-module analysis result
   */
  public analyzeMultiple(programs: Program[]): MultiModuleAnalysisResult {
    const startTime = Date.now();
    const allDiagnostics: Diagnostic[] = [];

    // ----------------------------------------
    // Phase 1: Register Modules
    // ----------------------------------------
    const moduleRegistry = new ModuleRegistry();

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      moduleRegistry.register(moduleName, program);
    }

    // ----------------------------------------
    // Phase 2: Build Dependency Graph
    // ----------------------------------------
    const dependencyGraph = this.buildDependencyGraph(programs, moduleRegistry);

    // Check for circular dependencies
    const cycles = dependencyGraph.detectCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        allDiagnostics.push({
          severity: DiagnosticSeverity.ERROR,
          code: DiagnosticCode.CIRCULAR_IMPORT,
          message: `Circular dependency detected: ${cycle.cycle.join(' → ')}`,
          location: cycle.location,
        });
      }
    }

    // ----------------------------------------
    // Phase 3: Compute Compilation Order
    // ----------------------------------------
    let compilationOrder: string[];
    try {
      compilationOrder = dependencyGraph.getCompilationOrder();
    } catch {
      // If topological sort fails (due to cycles), use registration order
      compilationOrder = moduleRegistry.getAllModuleNames();
    }

    // ----------------------------------------
    // Phase 4: Analyze Modules in Order
    // ----------------------------------------
    const moduleResults = new Map<string, AnalysisResult>();
    const globalSymbolTable = new GlobalSymbolTable();

    for (const moduleName of compilationOrder) {
      const registeredModule = moduleRegistry.getModule(moduleName);
      if (!registeredModule) continue;

      // Analyze the module
      const result = this.analyze(registeredModule.program);
      moduleResults.set(moduleName, result);

      // Collect exports into global symbol table
      globalSymbolTable.collectFromProgram(moduleName, registeredModule.program);

      // Collect diagnostics
      allDiagnostics.push(...result.diagnostics);
    }

    // ----------------------------------------
    // Phase 5: Resolve Cross-Module Imports
    // ----------------------------------------
    const importResolver = new ImportResolver(moduleRegistry);
    const importErrors: ImportError[] = [];

    for (const moduleName of compilationOrder) {
      const registeredModule = moduleRegistry.getModule(moduleName);
      if (!registeredModule) continue;

      const moduleResult = moduleResults.get(moduleName);
      if (!moduleResult) continue;

      const resolutions = importResolver.resolveImports(registeredModule.program);

      // Extract errors from resolutions
      for (const resolution of resolutions) {
        if (!resolution.success && resolution.errors) {
          importErrors.push(...resolution.errors);
        }
      }
    }

    // Convert import errors to diagnostics
    for (const error of importErrors) {
      allDiagnostics.push(this.importErrorToDiagnostic(error));
    }

    // ----------------------------------------
    // Build Result
    // ----------------------------------------
    const endTime = Date.now();
    const totalErrors = this.countErrors(allDiagnostics);
    const totalWarnings = this.countWarnings(allDiagnostics);

    return {
      success: totalErrors === 0,
      modules: moduleResults,
      globalSymbolTable,
      dependencyGraph,
      importResolution: {
        success: importErrors.length === 0,
        errors: importErrors,
      },
      diagnostics: allDiagnostics,
      compilationOrder,
      stats: {
        totalModules: programs.length,
        totalDeclarations: this.sumStats(moduleResults, (r) => r.stats.totalDeclarations),
        totalErrors,
        totalWarnings,
        totalTimeMs: endTime - startTime,
      },
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Builds a dependency graph from program imports
   */
  protected buildDependencyGraph(
    programs: Program[],
    registry: ModuleRegistry,
  ): DependencyGraph {
    const graph = new DependencyGraph();

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      graph.addNode(moduleName);

      // Add edges for each import
      for (const decl of program.getDeclarations()) {
        if (decl.getNodeType() === 'ImportDecl') {
          const importDecl = decl as unknown as { getModuleName(): string; getLocation(): SourceLocation };
          const targetModule = importDecl.getModuleName();

          if (registry.hasModule(targetModule)) {
            graph.addEdge(moduleName, targetModule, importDecl.getLocation());
          }
        }
      }
    }

    return graph;
  }

  /**
   * Creates a global symbol table for single-module analysis
   */
  protected createGlobalSymbolTableForSingleModule(
    moduleName: string,
    program: Program,
  ): GlobalSymbolTable {
    const globalTable = new GlobalSymbolTable();
    globalTable.collectFromProgram(moduleName, program);
    return globalTable;
  }

  /**
   * Creates a map of function name to function symbol
   */
  protected createFunctionSymbolsMap(symbolTable: SymbolTable): Map<string, Symbol> {
    const map = new Map<string, Symbol>();
    const allScopes = symbolTable.getAllScopes();

    for (const scope of allScopes.values()) {
      for (const symbol of scope.symbols.values()) {
        if (symbol.kind === 'function') {
          map.set(symbol.name, symbol);
        }
      }
    }

    return map;
  }

  /**
   * Checks if analysis should stop based on current diagnostics
   */
  protected shouldStopAnalysis(diagnostics: Diagnostic[]): boolean {
    if (this.options.stopOnFirstError && this.hasErrors(diagnostics)) {
      return true;
    }

    if (this.countErrors(diagnostics) >= (this.options.maxErrors ?? 100)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if there are any errors in diagnostics
   */
  protected hasErrors(diagnostics: Diagnostic[]): boolean {
    return diagnostics.some((d) => d.severity === DiagnosticSeverity.ERROR);
  }

  /**
   * Counts error diagnostics
   */
  protected countErrors(diagnostics: Diagnostic[]): number {
    return diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR).length;
  }

  /**
   * Counts warning diagnostics
   */
  protected countWarnings(diagnostics: Diagnostic[]): number {
    return diagnostics.filter((d) => d.severity === DiagnosticSeverity.WARNING).length;
  }

  /**
   * Counts total declarations in symbol table
   */
  protected countDeclarations(symbolTable: SymbolTable): number {
    let count = 0;
    const allScopes = symbolTable.getAllScopes();

    for (const scope of allScopes.values()) {
      count += scope.symbols.size;
    }

    return count;
  }

  /**
   * Sums a stat across all module results
   */
  protected sumStats(
    results: Map<string, AnalysisResult>,
    getter: (r: AnalysisResult) => number,
  ): number {
    let sum = 0;
    for (const result of results.values()) {
      sum += getter(result);
    }
    return sum;
  }

  /**
   * Converts a recursion error to a standard diagnostic
   */
  protected recursionErrorToDiagnostic(error: RecursionError): Diagnostic {
    const code =
      error.code === RecursionErrorCode.DIRECT_RECURSION
        ? DiagnosticCode.RECURSION_DETECTED
        : DiagnosticCode.INDIRECT_RECURSION_DETECTED;

    return {
      severity: DiagnosticSeverity.ERROR,
      code,
      message: error.message,
      location: error.functionLocation,
      relatedLocations: [
        {
          location: error.callLocation,
          message: `Recursive call occurs here`,
        },
      ],
    };
  }

  /**
   * Converts an import error to a standard diagnostic
   */
  protected importErrorToDiagnostic(error: ImportError): Diagnostic {
    let code: DiagnosticCode;

    switch (error.code) {
      case ImportErrorCode.MODULE_NOT_FOUND:
        code = DiagnosticCode.MODULE_NOT_FOUND;
        break;
      case ImportErrorCode.SYMBOL_NOT_EXPORTED:
        code = DiagnosticCode.IMPORT_NOT_EXPORTED;
        break;
      case ImportErrorCode.SYMBOL_NOT_FOUND:
        code = DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND;
        break;
      default:
        code = DiagnosticCode.INVALID_IMPORT_SYNTAX;
    }

    return {
      severity: DiagnosticSeverity.ERROR,
      code,
      message: error.message,
      location: error.location,
    };
  }

  /**
   * Converts an advanced diagnostic to a standard diagnostic
   */
  protected advancedDiagnosticToStandard(adv: AdvancedDiagnostic): Diagnostic {
    let severity: DiagnosticSeverity;

    switch (adv.severity) {
      case AdvSeverity.Error:
        severity = DiagnosticSeverity.ERROR;
        break;
      case AdvSeverity.Warning:
        severity = DiagnosticSeverity.WARNING;
        break;
      case AdvSeverity.Info:
      default:
        severity = DiagnosticSeverity.INFO;
        break;
    }

    // Map category to diagnostic code
    let code: DiagnosticCode;
    switch (adv.category) {
      case DiagnosticCategory.DefiniteAssignment:
        code = DiagnosticCode.UNDEFINED_VARIABLE;
        break;
      case DiagnosticCategory.VariableUsage:
        code = DiagnosticCode.UNUSED_VARIABLE;
        break;
      case DiagnosticCategory.DeadCode:
        code = DiagnosticCode.UNREACHABLE_CODE;
        break;
      default:
        code = DiagnosticCode.TYPE_MISMATCH; // Generic semantic error
    }

    // Convert advanced location { line, column } to SourceLocation
    const location: SourceLocation = {
      start: {
        line: adv.location.line,
        column: adv.location.column,
        offset: 0, // Not available from advanced diagnostic
      },
      end: {
        line: adv.location.line,
        column: adv.location.column + 1,
        offset: 0,
      },
    };

    return {
      severity,
      code,
      message: adv.message,
      location,
    };
  }

  /**
   * Checks if a diagnostic should be included based on options
   */
  protected shouldIncludeDiagnostic(diag: AdvancedDiagnostic): boolean {
    if (diag.severity === AdvSeverity.Info) {
      return this.options.includeInfoDiagnostics ?? false;
    }
    return true;
  }

  /**
   * Creates a failed result (for early termination)
   */
  protected createFailedResult(
    moduleName: string,
    program: Program,
    symbolTable: SymbolTable,
    diagnostics: Diagnostic[],
    symbolTableResult: SymbolTableBuildResult,
    elapsedMs: number,
    typeResolutionResult?: TypeResolutionResult,
    typeCheckResult?: TypeCheckPassResult,
  ): AnalysisResult {
    return {
      success: false,
      moduleName,
      ast: program,
      symbolTable,
      typeSystem: this.typeSystem,
      cfgs: new Map(),
      callGraph: new CallGraph(),
      diagnostics,
      passResults: {
        symbolTableBuild: symbolTableResult,
        typeResolution: typeResolutionResult ?? {
          success: false,
          diagnostics: [],
          resolvedCount: 0,
          failedCount: 0,
        },
        typeCheck: typeCheckResult ?? {
          success: false,
          diagnostics: [],
          errorCount: 0,
          warningCount: 0,
          expressionsChecked: 0,
        },
        recursionErrors: [],
        advancedAnalysis: undefined,
      },
      stats: {
        totalDeclarations: this.countDeclarations(symbolTable),
        expressionsChecked: typeCheckResult?.expressionsChecked ?? 0,
        functionsAnalyzed: 0,
        errorCount: this.countErrors(diagnostics),
        warningCount: this.countWarnings(diagnostics),
        analysisTimeMs: elapsedMs,
      },
    };
  }

  // ============================================
  // PUBLIC ACCESSORS
  // ============================================

  /**
   * Gets the type system
   */
  public getTypeSystem(): TypeSystem {
    return this.typeSystem;
  }

  /**
   * Gets the current options
   */
  public getOptions(): SemanticAnalyzerOptions {
    return { ...this.options };
  }

  /**
   * Updates options
   */
  public setOptions(options: Partial<SemanticAnalyzerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}