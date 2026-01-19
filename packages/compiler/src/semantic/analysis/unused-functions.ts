/**
 * Unused Function Detection (Task 8.3)
 *
 * Analyzes function usage patterns to detect:
 * - Functions that are never called (unused functions)
 * - Call counts for each function
 * - Entry point functions (main, interrupt handlers)
 * - Exported functions (may be used by other modules)
 *
 * **Algorithm:**
 * 1. Collect all function declarations in the program
 * 2. Walk AST to track all function calls
 * 3. Handle special cases:
 *    - Entry points (main function) - always considered used
 *    - Exported functions - always considered used
 *    - Recursive functions - mark as used if called externally
 * 4. Generate call count statistics
 * 5. Emit warnings for unused functions
 * 6. Set metadata for optimization hints
 *
 * **Metadata Generated:**
 * - `CallGraphUnused`: Function is never called (boolean)
 * - `CallGraphCallCount`: Number of times function is called (number)
 */

import type { Program, FunctionDecl, CallExpression } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { SymbolKind } from '../symbol.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { isIdentifierExpression } from '../../ast/type-guards.js';

/**
 * Function usage information
 *
 * Tracks call patterns for a single function.
 */
interface FunctionUsageInfo {
  /** Function name (symbol name) */
  name: string;

  /** Number of times function is called */
  callCount: number;

  /** Is this an entry point function? (e.g., main) */
  isEntryPoint: boolean;

  /** Is this function exported to other modules? */
  isExported: boolean;

  /** Is this a stub function (no body)? */
  isStub: boolean;

  /** Function declaration node */
  declaration: FunctionDecl;
}

/**
 * Unused Function Analyzer
 *
 * Tracks function call patterns to:
 * 1. Detect unused functions
 * 2. Generate call statistics for optimizer
 * 3. Handle entry points and exported functions
 * 4. Emit warnings for unused functions
 *
 * @example
 * ```typescript
 * const analyzer = new UnusedFunctionAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class UnusedFunctionAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Map of function name to usage information */
  protected usageMap: Map<string, FunctionUsageInfo> = new Map();

  /**
   * Create unused function analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(protected readonly symbolTable: SymbolTable) {}

  /**
   * Run unused function analysis on entire program
   *
   * Analyzes function usage patterns to detect:
   * - Unused functions
   * - Call counts
   * - Entry point handling
   *
   * Sets metadata on function declarations for optimizer.
   *
   * @param ast - Program AST
   */
  public analyze(ast: Program): void {
    // Step 1: Collect all function declarations
    this.collectFunctionDeclarations(ast);

    // Step 2: Track function calls
    this.trackFunctionCalls(ast);

    // Step 3: Generate metadata
    this.setFunctionMetadata();

    // Step 4: Detect unused functions
    this.detectUnusedFunctions();
  }

  /**
   * Detect unused functions
   *
   * Generates WARNING diagnostics for functions that are:
   * - Declared but never called
   * - Not entry points
   * - Not exported
   *
   * Entry points and exported functions are always considered used.
   */
  protected detectUnusedFunctions(): void {
    for (const [_name, info] of this.usageMap) {
      // Skip entry points, exported functions, and stub functions
      if (info.isEntryPoint || info.isExported || info.isStub) {
        continue;
      }

      // Detect completely unused functions
      if (info.callCount === 0) {
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic warning code
          severity: DiagnosticSeverity.WARNING,
          message: `Function '${info.name}' is declared but never used`,
          location: info.declaration.getLocation(),
        });
      }
    }
  }

  /**
   * Set metadata on all function declarations
   *
   * For each function, sets:
   * - Call count
   * - Unused flag
   */
  protected setFunctionMetadata(): void {
    for (const [_name, info] of this.usageMap) {
      const decl = info.declaration;

      // Ensure metadata map exists
      if (!decl.metadata) {
        decl.metadata = new Map();
      }

      // Set call count metadata
      decl.metadata.set(OptimizationMetadataKey.CallGraphCallCount, info.callCount);

      // Compute unused flag
      // A function is unused if:
      // - It has zero calls
      // - AND it's not an entry point
      // - AND it's not exported
      const isUnused = info.callCount === 0 && !info.isEntryPoint && !info.isExported;
      decl.metadata.set(OptimizationMetadataKey.CallGraphUnused, isUnused);
    }
  }

  /**
   * Track all function calls in the program
   *
   * Walks the AST to find all CallExpression nodes and increments
   * the call count for the target function.
   *
   * @param ast - Program AST
   */
  protected trackFunctionCalls(ast: Program): void {
    const tracker = new FunctionCallTracker(this.symbolTable, this.usageMap);
    tracker.walk(ast);
  }

  /**
   * Collect all function declarations in the program
   *
   * Walks the AST to find all FunctionDecl nodes and creates
   * a FunctionUsageInfo entry for each one.
   *
   * Identifies entry points (main function) and exported functions.
   *
   * @param ast - Program AST
   */
  protected collectFunctionDeclarations(ast: Program): void {
    const collector = new FunctionCollector(this.symbolTable, this.usageMap);
    collector.walk(ast);
  }

  /**
   * Get all diagnostics from analysis
   *
   * @returns Array of diagnostics (warnings for unused functions)
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}

/**
 * Walker to collect all function declarations
 *
 * Finds all FunctionDecl nodes and creates FunctionUsageInfo entries.
 * Identifies entry points and exported functions.
 */
class FunctionCollector extends ASTWalker {
  /**
   * Create function collector
   *
   * @param symbolTable - Symbol table
   * @param usageMap - Map to populate with function info
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly usageMap: Map<string, FunctionUsageInfo>
  ) {
    super();
  }

  /**
   * Visit function declaration
   *
   * Creates a FunctionUsageInfo entry for this function.
   * Checks if function is an entry point or exported.
   */
  public visitFunctionDecl(node: FunctionDecl): void {
    // First do the default behavior (traverse children)
    super.visitFunctionDecl(node);

    // Look up the symbol for this function
    const symbol = this.symbolTable.lookup(node.getName());

    if (symbol && symbol.kind === SymbolKind.Function) {
      // Check if this is an entry point
      // Entry points are:
      // 1. Functions named "main"
      // 2. Interrupt handlers (future enhancement)
      const isEntryPoint = node.getName() === 'main';

      // Check if this function is exported
      // Exported functions may be used by other modules
      const isExported = node.isExportedFunction();

      // Check if this is a stub function (no body)
      // Stub functions are external declarations, may be provided at link time
      const isStub = node.isStubFunction();

      // Create usage info entry
      this.usageMap.set(symbol.name, {
        name: symbol.name,
        callCount: 0,
        isEntryPoint,
        isExported,
        isStub,
        declaration: node,
      });
    }
  }
}

/**
 * Walker to track function calls
 *
 * Finds all CallExpression nodes and increments call counts
 * for the called functions.
 */
class FunctionCallTracker extends ASTWalker {
  /**
   * Create function call tracker
   *
   * @param symbolTable - Symbol table
   * @param usageMap - Map to update with call counts
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly usageMap: Map<string, FunctionUsageInfo>
  ) {
    super();
  }

  /**
   * Visit call expression
   *
   * Track the function call by incrementing the call count.
   */
  public visitCallExpression(node: CallExpression): void {
    // First do the default behavior (traverse children)
    super.visitCallExpression(node);

    // Extract the callee (function being called)
    const callee = node.getCallee();

    // Check if callee is an identifier (simple function call)
    if (callee && isIdentifierExpression(callee)) {
      const functionName = callee.getName();
      const symbol = this.symbolTable.lookup(functionName);

      if (symbol && symbol.kind === SymbolKind.Function) {
        const info = this.usageMap.get(symbol.name);
        if (info) {
          // Increment call count
          info.callCount++;
        }
      }
    }

    // Note: Member expressions (obj.method()) are not yet supported
    // in Blend65, so we don't need to handle them here
  }
}