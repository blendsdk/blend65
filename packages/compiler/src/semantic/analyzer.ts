/**
 * Semantic Analyzer - Main Orchestrator
 *
 * Coordinates all semantic analysis passes and provides
 * a unified interface for semantic checking.
 *
 * Multi-Pass Architecture:
 * - Pass 1: Symbol Table Builder (collect declarations, build scopes)
 * - Pass 2: Type Resolution (resolve type annotations) [Phase 2]
 * - Pass 3: Type Checker (type check expressions/statements) [Phase 3]
 * - Pass 4: Statement Validator (control flow validation) [Phase 4]
 * - Pass 5-8: Advanced analysis passes [Phases 5-8]
 */

import { SymbolTableBuilder } from './visitors/symbol-table-builder.js';
import { TypeResolver } from './visitors/type-resolver.js';
import { TypeChecker } from './visitors/type-checker/type-checker.js';
import { ControlFlowAnalyzer } from './visitors/control-flow-analyzer.js';
import { AdvancedAnalyzer } from './analysis/advanced-analyzer.js';
import { SymbolTable } from './symbol-table.js';
import { TypeSystem } from './type-system.js';
import { ControlFlowGraph } from './control-flow.js';
import { Diagnostic, DiagnosticSeverity, DiagnosticCode } from '../ast/diagnostics.js';
import { ModuleRegistry } from './module-registry.js';
import { DependencyGraph } from './dependency-graph.js';
import { ImportResolver } from './import-resolver.js';
import { GlobalSymbolTable } from './global-symbol-table.js';
import { MemoryLayoutBuilder, type GlobalMemoryLayout } from './memory-layout.js';
import type { Program, ImportDecl } from '../ast/nodes.js';

/**
 * Result of single-module semantic analysis
 *
 * @deprecated Use ModuleAnalysisResult for new code
 */
export interface AnalysisResult {
  /** Symbol table with all symbols and scopes */
  symbolTable: SymbolTable;

  /** All diagnostics from all passes */
  diagnostics: Diagnostic[];

  /** True if analysis succeeded (no errors) */
  success: boolean;
}

/**
 * Result of analyzing a single module
 *
 * Contains all analysis artifacts for one module including
 * symbols, types, control flow graphs, and diagnostics.
 */
export interface ModuleAnalysisResult {
  /** Name of the analyzed module */
  moduleName: string;

  /** Symbol table with all symbols and scopes */
  symbolTable: SymbolTable;

  /** Type system with resolved types */
  typeSystem: TypeSystem;

  /** Control flow graphs for all functions */
  cfgs: Map<string, ControlFlowGraph>;

  /** All diagnostics from this module */
  diagnostics: Diagnostic[];

  /** True if module analysis succeeded (no errors) */
  success: boolean;
}

/**
 * Result of multi-module semantic analysis
 *
 * Contains aggregated analysis results for all modules
 * plus cross-module resolution and global resource allocation.
 */
export interface MultiModuleAnalysisResult {
  /** Per-module analysis results (keyed by module name) */
  modules: Map<string, ModuleAnalysisResult>;

  /** All diagnostics from all modules */
  diagnostics: Diagnostic[];

  /** True if entire multi-module analysis succeeded */
  success: boolean;

  /** Global symbol table aggregating all exports (Phase 6.2.1) */
  globalSymbolTable: GlobalSymbolTable;

  /** Module dependency graph (Phase 6.1.3) */
  dependencyGraph: DependencyGraph;

  /** Global memory layout (Phase 6.3) */
  memoryLayout?: GlobalMemoryLayout;
}

/**
 * Semantic analyzer orchestrator
 *
 * Coordinates multi-pass semantic analysis:
 * 1. Builds symbol tables and scopes (Phase 1)
 * 2. Resolves types (Phase 2)
 * 3. Type checks expressions and statements (Phase 3 + 4)
 * 4. Builds control flow graphs (Phase 5)
 * 5. Advanced optimization analysis (Phase 8)
 *
 * **Current Implementation:** Passes 1-5, 8 complete and integrated.
 */
export class SemanticAnalyzer {
  /** Symbol table (built during Pass 1) */
  protected symbolTable: SymbolTable | null = null;

  /** Type system (built during Pass 2) */
  protected typeSystem: TypeSystem | null = null;

  /** Control flow graphs (built during Pass 5) */
  protected cfgs: Map<string, ControlFlowGraph> = new Map();

  /** All diagnostics from all passes */
  protected diagnostics: Diagnostic[] = [];

  /**
   * Analyze a single AST (backward compatibility)
   *
   * Runs all semantic analysis passes and returns results.
   *
   * @param ast - Program AST to analyze
   * @returns Analysis result with symbol table and diagnostics
   * @deprecated Use analyzeMultiple() for multi-module support
   */
  public analyze(ast: Program): AnalysisResult {
    // Reset state for new analysis
    this.symbolTable = null;
    this.typeSystem = null;
    this.cfgs.clear();
    this.diagnostics = [];

    // Run per-module analysis
    this.analyzeModule(ast);

    // Return legacy format
    return {
      symbolTable: this.symbolTable!,
      diagnostics: [...this.diagnostics],
      success: !this.hasErrors(),
    };
  }

  /**
   * Analyze multiple Program ASTs (multi-module support)
   *
   * **Multi-Pass Architecture (Phase 6.2.2):**
   *
   * **Phase A: Module Discovery & Validation**
   * 1. Build module registry (all modules by name)
   * 2. Build dependency graph from imports
   * 3. Detect circular dependencies (fail-fast)
   * 4. Validate imports (fail-fast on missing modules)
   *
   * **Phase B: Per-Module Analysis (in dependency order)**
   * 5. Get topological sort (compilation order)
   * 6. Analyze each module using existing Passes 1-5
   * 7. Collect per-module results (symbols, types, CFGs, diagnostics)
   *
   * **Phase C: Cross-Module Integration**
   * 8. Build global symbol table (aggregate all exports)
   * 9. Cross-module validation (Phase 6.2.3, future)
   * 10. Global resource allocation (Phase 6.3, future)
   *
   * @param programs - Array of Program ASTs to analyze
   * @returns Multi-module analysis results
   */
  public analyzeMultiple(programs: Program[]): MultiModuleAnalysisResult {
    // ============================================
    // PHASE A: Module Discovery & Validation
    // ============================================

    // Pass 0: Build module registry
    const registry = this.buildModuleRegistry(programs);

    // Pass 1: Build dependency graph (extracts imports)
    const depGraph = this.buildDependencyGraph(programs, registry);

    // Check for circular imports (fail-fast)
    const cycles = depGraph.detectCycles();
    if (cycles.length > 0) {
      return this.failWithCircularImports(cycles, depGraph);
    }

    // Pass 2: Validate imports (fail-fast on missing modules)
    const importErrors = this.validateImports(programs, registry);
    if (importErrors.length > 0) {
      return this.failWithImportErrors(importErrors, depGraph);
    }

    // ============================================
    // PHASE B: Per-Module Analysis (Dependency Order)
    // ============================================

    // Pass 3: Get compilation order (topological sort)
    const compilationOrder = depGraph.getTopologicalOrder();

    // Pass 4: Analyze each module in dependency order
    const moduleResults = this.analyzeModulesInOrder(compilationOrder, registry);

    // ============================================
    // PHASE C: Cross-Module Integration
    // ============================================

    // Pass 5: Build global symbol table
    const globalSymbols = this.buildGlobalSymbolTable(moduleResults);

    // Collect all diagnostics
    const allDiagnostics: Diagnostic[] = [];
    for (const result of moduleResults.values()) {
      allDiagnostics.push(...result.diagnostics);
    }

    // ============================================
    // PHASE D: Global Resource Management (Phase 6.3)
    // ============================================

    // Pass 6: Build global memory layout
    const memoryLayoutBuilder = new MemoryLayoutBuilder();
    const memoryLayout = memoryLayoutBuilder.buildLayout(moduleResults);

    // Add memory layout conflicts to diagnostics
    for (const conflict of memoryLayout.conflicts) {
      allDiagnostics.push({
        code: this.getConflictDiagnosticCode(conflict.type),
        severity: DiagnosticSeverity.ERROR,
        message: conflict.message,
        location: conflict.locations[0], // Use first location
      });
    }

    // Return aggregated results
    return {
      modules: moduleResults,
      diagnostics: allDiagnostics,
      success: !allDiagnostics.some(d => d.severity === 'error'),
      globalSymbolTable: globalSymbols,
      dependencyGraph: depGraph,
      memoryLayout,
    };
  }

  /**
   * Analyze a single module (internal helper)
   *
   * This method contains the core per-module analysis logic
   * that was previously in analyze(). It's now reused by both
   * the legacy analyze() and the new analyzeMultiple().
   *
   * **Assumptions:**
   * - this.symbolTable, this.typeSystem, this.cfgs are already reset
   * - this.diagnostics is already cleared
   *
   * @param ast - Program AST to analyze
   */
  protected analyzeModule(ast: Program): void {
    // Pass 1: Build symbol table
    this.runPass1_SymbolTableBuilder(ast);

    // Pass 2: Type resolution (only if Pass 1 succeeded)
    if (!this.hasErrors()) {
      this.runPass2_TypeResolution(ast);
    }

    // Pass 3: Type checking (only if Pass 2 succeeded)
    if (!this.hasErrors()) {
      this.runPass3_TypeChecker(ast);
    }

    // Pass 5: Control flow analysis (only if Pass 1 succeeded)
    // Note: Can run independently of type checking
    if (!this.hasErrors()) {
      this.runPass5_ControlFlowAnalyzer(ast);
    }

    // Pass 8: Advanced analysis (only if all previous passes succeeded)
    if (!this.hasErrors()) {
      this.runPass8_AdvancedAnalysis(ast);
    }
  }

  /**
   * Build module registry from programs
   *
   * Registers all modules by name, detecting duplicate module declarations.
   *
   * @param programs - Array of Program ASTs
   * @returns Module registry
   */
  protected buildModuleRegistry(programs: Program[]): ModuleRegistry {
    const registry = new ModuleRegistry();

    for (const program of programs) {
      const moduleName = this.getModuleName(program);

      try {
        registry.register(moduleName, program);
      } catch (error) {
        // Duplicate module error
        this.diagnostics.push({
          code: DiagnosticCode.DUPLICATE_MODULE,
          severity: DiagnosticSeverity.ERROR,
          message: error instanceof Error ? error.message : String(error),
          location: program.getModule().getLocation(),
        });
      }
    }

    return registry;
  }

  /**
   * Build dependency graph from imports
   *
   * Extracts all import declarations and builds the module dependency graph.
   *
   * @param programs - Array of Program ASTs
   * @param registry - Module registry
   * @returns Dependency graph
   */
  protected buildDependencyGraph(programs: Program[], registry: ModuleRegistry): DependencyGraph {
    const graph = new DependencyGraph();

    for (const program of programs) {
      const moduleName = this.getModuleName(program);

      // Register module in graph (ensures it's included even without imports)
      graph.addNode(moduleName);

      // Extract all import declarations
      const imports = program
        .getDeclarations()
        .filter((d): d is ImportDecl => d.constructor.name === 'ImportDecl');

      for (const importDecl of imports) {
        const targetModule = importDecl.getModuleName();
        graph.addEdge(moduleName, targetModule, importDecl.getLocation());

        // Also track in registry for dependency tracking
        registry.addDependency(moduleName, targetModule);
      }
    }

    return graph;
  }

  /**
   * Validate imports across all modules
   *
   * Uses ImportResolver to check that all imported modules exist.
   *
   * @param programs - Array of Program ASTs
   * @param registry - Module registry
   * @returns Array of import validation errors
   */
  protected validateImports(programs: Program[], registry: ModuleRegistry): Diagnostic[] {
    const resolver = new ImportResolver(registry);
    return resolver.validateAllImports(programs);
  }

  /**
   * Analyze modules in dependency order
   *
   * Analyzes each module using existing Passes 1-5, processing modules
   * in topological order (dependencies first).
   *
   * **Cross-Module Symbol Resolution:**
   * Makes imported symbols from previously-analyzed modules available
   * during type checking. This enables basic cross-module type checking
   * before the full validation pass (Task 6.2.3).
   *
   * @param compilationOrder - Module names in compilation order
   * @param registry - Module registry
   * @returns Map of module name → analysis result
   */
  protected analyzeModulesInOrder(
    compilationOrder: string[],
    registry: ModuleRegistry
  ): Map<string, ModuleAnalysisResult> {
    const moduleResults = new Map<string, ModuleAnalysisResult>();
    const globalSymbols = new GlobalSymbolTable();

    for (const moduleName of compilationOrder) {
      const program = registry.getModule(moduleName);

      // Module must exist (registry ensures this)
      if (!program) {
        throw new Error(`Module '${moduleName}' not found in registry (internal error)`);
      }

      // Reset state for this module
      this.symbolTable = null;
      this.typeSystem = null;
      this.cfgs.clear();
      this.diagnostics = [];

      // Analyze this module using existing passes
      // Note: Pass 1 (Symbol Table Builder) will use global symbols for imports
      this.analyzeModuleWithContext(program, globalSymbols);

      // Collect results for this module
      const moduleResult: ModuleAnalysisResult = {
        moduleName,
        symbolTable: this.symbolTable!,
        typeSystem: this.typeSystem!,
        cfgs: new Map(this.cfgs),
        diagnostics: [...this.diagnostics],
        success: !this.hasErrors(),
      };

      moduleResults.set(moduleName, moduleResult);

      // Register this module's symbols for next modules to use
      globalSymbols.registerModule(moduleName, this.symbolTable!);
    }

    return moduleResults;
  }

  /**
   * Analyze a single module with cross-module context
   *
   * Similar to analyzeModule(), but makes imported symbols from
   * previously-analyzed modules available via the global symbol table.
   *
   * @param ast - Program AST to analyze
   * @param globalSymbols - Global symbol table with previously-analyzed modules
   */
  protected analyzeModuleWithContext(ast: Program, globalSymbols: GlobalSymbolTable): void {
    // Pass 1: Build symbol table
    // TODO: Pass global symbols to symbol table builder for import resolution
    this.runPass1_SymbolTableBuilder(ast);

    // Import cross-module symbols into this module's symbol table
    this.resolveImports(ast, globalSymbols);

    // Pass 2: Type resolution (only if Pass 1 succeeded)
    if (!this.hasErrors()) {
      this.runPass2_TypeResolution(ast);
    }

    // Pass 3: Type checking (only if Pass 2 succeeded)
    if (!this.hasErrors()) {
      this.runPass3_TypeChecker(ast);
    }

    // Pass 5: Control flow analysis (only if Pass 1 succeeded)
    if (!this.hasErrors()) {
      this.runPass5_ControlFlowAnalyzer(ast);
    }

    // Phase 7 (Task 7.2): Unused import detection (after type checking)
    // This runs even if there are errors, as usage tracking is complete
    const unusedImportHints = this.detectUnusedImports(ast, this.symbolTable!);
    this.diagnostics.push(...unusedImportHints);

    // Pass 8: Advanced analysis (only if all previous passes succeeded)
    if (!this.hasErrors()) {
      this.runPass8_AdvancedAnalysis(ast);
    }
  }

  /**
   * Resolve imports by updating cross-module symbol types
   *
   * Extracts import declarations and looks up symbols from the global
   * symbol table, updating the type information of imported symbols
   * in the current module's symbol table.
   *
   * This enables full cross-module type checking with complete type
   * information from analyzed dependency modules.
   *
   * **Implementation (Task 6.2.3):**
   * - Looks up imported symbols that were created during Pass 1
   * - Updates their type information from the analyzed source module
   * - Validates that imported symbols exist and are exported
   * - Creates diagnostics for missing or non-exported symbols
   *
   * **Validation Rules:**
   * - Import of non-exported symbol → IMPORT_NOT_EXPORTED error (P107)
   * - Import of non-existent symbol → IMPORT_SYMBOL_NOT_FOUND error (P108)
   * - Import of symbol with no type info → IMPORT_SYMBOL_NOT_FOUND error (P108)
   *
   * @param ast - Program AST
   * @param globalSymbols - Global symbol table with analyzed modules
   */
  protected resolveImports(ast: Program, globalSymbols: GlobalSymbolTable): void {
    if (!this.symbolTable) {
      return;
    }

    // Extract import declarations
    const imports = ast
      .getDeclarations()
      .filter((d): d is ImportDecl => d.constructor.name === 'ImportDecl');

    for (const importDecl of imports) {
      const targetModule = importDecl.getModuleName();
      const identifiers = importDecl.getIdentifiers();

      for (const identifier of identifiers) {
        // Lookup the imported symbol that was created during Pass 1
        // (SymbolTableBuilder creates ImportedSymbol with undefined type)
        const localImportedSymbol = this.symbolTable.lookup(identifier);

        if (!localImportedSymbol) {
          // Symbol wasn't created during Pass 1 (shouldn't happen)
          continue;
        }

        // Lookup the actual symbol definition in the source module
        const globalSymbol = globalSymbols.lookupInModule(identifier, targetModule);

        if (globalSymbol && globalSymbol.typeInfo) {
          // Update the imported symbol's type with the actual type
          // from the analyzed source module
          localImportedSymbol.type = globalSymbol.typeInfo;

          // Validate export status
          if (!globalSymbol.isExported) {
            this.diagnostics.push({
              code: DiagnosticCode.IMPORT_NOT_EXPORTED,
              severity: DiagnosticSeverity.ERROR,
              message: `Cannot import '${identifier}' from module '${targetModule}': symbol is not exported`,
              location: importDecl.getLocation(),
            });
          }
        } else {
          // Create diagnostic for missing symbol
          if (!globalSymbol) {
            // Symbol doesn't exist in target module
            this.diagnostics.push({
              code: DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND,
              severity: DiagnosticSeverity.ERROR,
              message: `Cannot import '${identifier}' from module '${targetModule}': symbol not found in module`,
              location: importDecl.getLocation(),
            });
          } else if (!globalSymbol.typeInfo) {
            // Symbol exists but has no type information
            this.diagnostics.push({
              code: DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND,
              severity: DiagnosticSeverity.ERROR,
              message: `Cannot import '${identifier}' from module '${targetModule}': symbol has no type information`,
              location: importDecl.getLocation(),
            });
          }
        }
      }
    }
  }

  /**
   * Build global symbol table from module results
   *
   * Aggregates symbols from all module-level symbol tables into
   * a global symbol table for cross-module lookup.
   *
   * @param moduleResults - Per-module analysis results
   * @returns Global symbol table
   */
  protected buildGlobalSymbolTable(
    moduleResults: Map<string, ModuleAnalysisResult>
  ): GlobalSymbolTable {
    const globalSymbols = new GlobalSymbolTable();

    for (const [moduleName, result] of moduleResults) {
      globalSymbols.registerModule(moduleName, result.symbolTable);
    }

    return globalSymbols;
  }

  /**
   * Fail with circular import errors
   *
   * Creates a failure result when circular dependencies are detected.
   *
   * @param cycles - Detected circular dependency chains
   * @param depGraph - Dependency graph
   * @returns Failed multi-module analysis result
   */
  protected failWithCircularImports(
    cycles: string[][],
    depGraph: DependencyGraph
  ): MultiModuleAnalysisResult {
    const diagnostics: Diagnostic[] = [];

    for (const cycle of cycles) {
      const cycleString = cycle.join(' → ');
      diagnostics.push({
        code: DiagnosticCode.CIRCULAR_IMPORT,
        severity: DiagnosticSeverity.ERROR,
        message: `Circular import detected: ${cycleString}`,
        location: {
          source: '',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
    }

    return {
      modules: new Map(),
      diagnostics,
      success: false,
      globalSymbolTable: new GlobalSymbolTable(),
      dependencyGraph: depGraph,
      memoryLayout: undefined,
    };
  }

  /**
   * Fail with import validation errors
   *
   * Creates a failure result when import validation fails (missing modules).
   *
   * @param importErrors - Import validation errors
   * @param depGraph - Dependency graph
   * @returns Failed multi-module analysis result
   */
  protected failWithImportErrors(
    importErrors: Diagnostic[],
    depGraph: DependencyGraph
  ): MultiModuleAnalysisResult {
    return {
      modules: new Map(),
      diagnostics: importErrors,
      success: false,
      globalSymbolTable: new GlobalSymbolTable(),
      dependencyGraph: depGraph,
      memoryLayout: undefined, // No memory layout on early failure
    };
  }

  /**
   * Get diagnostic code for memory conflict type
   *
   * @param conflictType - Type of memory conflict
   * @returns Appropriate diagnostic code
   */
  protected getConflictDiagnosticCode(
    conflictType: 'zp_overflow' | 'map_overlap' | 'zp_map_overlap'
  ): DiagnosticCode {
    switch (conflictType) {
      case 'zp_overflow':
        return DiagnosticCode.ZERO_PAGE_OVERFLOW;
      case 'map_overlap':
        return DiagnosticCode.MEMORY_MAP_OVERLAP;
      case 'zp_map_overlap':
        return DiagnosticCode.ZERO_PAGE_MAP_OVERLAP;
    }
  }

  /**
   * Get module name from Program AST
   *
   * Extracts the module name from the module declaration.
   * Falls back to 'main' if module is implicit/unnamed.
   *
   * @param program - Program AST
   * @returns Module name
   */
  protected getModuleName(program: Program): string {
    const moduleDecl = program.getModule();
    const fullName = moduleDecl.getFullName();

    // If implicit module or empty name, use 'main'
    if (moduleDecl.isImplicitModule() || !fullName || fullName === '') {
      return 'main';
    }

    return fullName;
  }

  /**
   * Detect unused imports (Phase 7 - Task 7.2)
   *
   * Checks which imported symbols were never marked as used
   * during type checking (Phase 3).
   *
   * Reports HINT-level diagnostics for unused imports to help
   * developers keep import lists clean without being intrusive.
   *
   * **Why Hints (not Warnings):**
   * - Unused imports don't affect correctness
   * - They're style/cleanliness issues
   * - Gentle feedback encourages cleanup
   *
   * @param ast - Program AST
   * @param symbolTable - Module's symbol table
   * @returns Array of hint diagnostics for unused imports
   */
  protected detectUnusedImports(ast: Program, symbolTable: SymbolTable): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Extract all import declarations
    const imports = ast
      .getDeclarations()
      .filter((d): d is ImportDecl => d.constructor.name === 'ImportDecl');

    for (const importDecl of imports) {
      const identifiers = importDecl.getIdentifiers();

      for (const identifier of identifiers) {
        const symbol = symbolTable.lookup(identifier);

        // Check if symbol is an imported symbol that was never used
        if (symbol && symbol.kind === 'ImportedSymbol' && !symbol.metadata?.isUsed) {
          diagnostics.push({
            code: DiagnosticCode.UNUSED_IMPORT,
            severity: DiagnosticSeverity.HINT,
            message: `Unused import: '${identifier}' is imported but never used`,
            location: importDecl.getLocation(),
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Pass 1: Symbol Table Builder
   *
   * Collects all declarations and builds the symbol table with
   * proper scope hierarchy. This is the foundation for all
   * subsequent analysis passes.
   *
   * @param ast - Program AST
   */
  protected runPass1_SymbolTableBuilder(ast: Program): void {
    const builder = new SymbolTableBuilder();

    // Visit the entire AST to collect declarations
    ast.accept(builder);

    // Extract results
    this.symbolTable = builder.getSymbolTable();
    this.diagnostics.push(...builder.getDiagnostics());
  }

  /**
   * Pass 2: Type Resolution
   *
   * Resolves type annotations and annotates symbols with type information.
   * Creates the type system with all built-in types and operations.
   *
   * @param ast - Program AST
   */
  protected runPass2_TypeResolution(ast: Program): void {
    if (!this.symbolTable) {
      throw new Error('Pass 1 must be run before Pass 2');
    }

    const resolver = new TypeResolver(this.symbolTable);

    // Visit the entire AST to resolve types
    ast.accept(resolver);

    // Extract results
    this.typeSystem = resolver.getTypeSystem();
    this.diagnostics.push(...resolver.getDiagnostics());
  }

  /**
   * Pass 3: Type Checking
   *
   * Type checks all expressions and statements, validates type compatibility,
   * and performs statement-level semantic validation (break/continue, returns, etc.).
   *
   * Note: Statement validation (Phase 4) is integrated into the TypeChecker.
   *
   * @param ast - Program AST
   */
  protected runPass3_TypeChecker(ast: Program): void {
    if (!this.symbolTable || !this.typeSystem) {
      throw new Error('Pass 1 and Pass 2 must be run before Pass 3');
    }

    const checker = new TypeChecker(this.symbolTable, this.typeSystem);

    // Visit the entire AST to type check
    ast.accept(checker);

    // Extract diagnostics
    this.diagnostics.push(...checker.getDiagnostics());
  }

  /**
   * Pass 5: Control Flow Analysis
   *
   * Builds control flow graphs for all functions, performs reachability analysis,
   * and detects dead code.
   *
   * @param ast - Program AST
   */
  protected runPass5_ControlFlowAnalyzer(ast: Program): void {
    if (!this.symbolTable) {
      throw new Error('Pass 1 must be run before Pass 5');
    }

    const analyzer = new ControlFlowAnalyzer(this.symbolTable);

    // Visit the entire AST to build CFGs
    ast.accept(analyzer);

    // Extract results
    this.cfgs = analyzer.getAllCFGs();
    this.diagnostics.push(...analyzer.getDiagnostics());
  }

  /**
   * Pass 8: Advanced Analysis (Phase 8)
   *
   * Performs god-level optimization analysis and generates metadata
   * for IL optimizer. Only runs if all previous passes succeeded.
   *
   * Analysis includes:
   * - Tier 1: Definite assignment, usage analysis, dead code
   * - Tier 2: Reaching definitions, liveness, constant propagation
   * - Tier 3: Alias analysis, purity, loops, 6502 hints
   *
   * Results are stored in AST node metadata using OptimizationMetadataKey enum.
   *
   * @param ast - Program AST
   */
  protected runPass8_AdvancedAnalysis(ast: Program): void {
    if (!this.symbolTable || !this.typeSystem) {
      throw new Error('Pass 1 and Pass 2 must be run before Pass 8');
    }

    const analyzer = new AdvancedAnalyzer(this.symbolTable, this.cfgs, this.typeSystem);

    // Run all analyses (Tiers 1-3)
    analyzer.analyze(ast);

    // Collect diagnostics (warnings about unused code, optimization hints)
    this.diagnostics.push(...analyzer.getDiagnostics());
  }

  /**
   * Get the symbol table
   *
   * @returns Symbol table (null if analyze() not called yet)
   */
  public getSymbolTable(): SymbolTable | null {
    return this.symbolTable;
  }

  /**
   * Get the type system
   *
   * @returns Type system (null if analyze() not called yet or Pass 2 failed)
   */
  public getTypeSystem(): TypeSystem | null {
    return this.typeSystem;
  }

  /**
   * Get control flow graph for a specific function
   *
   * @param functionName - Name of the function
   * @returns CFG for the function, or undefined if not found
   */
  public getCFG(functionName: string): ControlFlowGraph | undefined {
    return this.cfgs.get(functionName);
  }

  /**
   * Get all control flow graphs
   *
   * @returns Map of function names to CFGs
   */
  public getAllCFGs(): Map<string, ControlFlowGraph> {
    return this.cfgs;
  }

  /**
   * Get all diagnostics
   *
   * @returns Array of diagnostics from all passes
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Check if any errors occurred during analysis
   *
   * @returns True if any error-level diagnostics exist
   */
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === 'error');
  }

  /**
   * Get count of diagnostics by severity
   *
   * @returns Counts of errors, warnings, info, hints
   */
  public getDiagnosticCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    return {
      errors: this.diagnostics.filter(d => d.severity === 'error').length,
      warnings: this.diagnostics.filter(d => d.severity === 'warning').length,
      info: this.diagnostics.filter(d => d.severity === 'info').length,
      hints: this.diagnostics.filter(d => d.severity === 'hint').length,
    };
  }
}
