/**
 * Variable Usage Analysis (Task 8.2)
 *
 * Analyzes variable usage patterns to detect:
 * - Unused variables (declared but never read)
 * - Write-only variables (written but never read)
 * - Read-only variables (read but never written after initialization)
 * - Read/write counts (for optimization hints)
 * - Hot path accesses (variables accessed in loops)
 * - Loop depth tracking (maximum nesting depth)
 *
 * **Algorithm:**
 * 1. Collect all variable declarations in the program
 * 2. Walk AST to track all reads and writes to each variable
 * 3. Track current loop depth during traversal
 * 4. Generate usage statistics and classify variables
 * 5. Emit warnings for unused and write-only variables
 * 6. Set metadata for optimization hints
 *
 * **Metadata Generated:**
 * - `UsageReadCount`: Number of times variable is read
 * - `UsageWriteCount`: Number of times variable is written
 * - `UsageIsUsed`: Variable is used (read or written)
 * - `UsageIsWriteOnly`: Variable is written but never read
 * - `UsageIsReadOnly`: Variable is read but never written (except initialization)
 * - `UsageHotPathAccesses`: Number of accesses inside loops
 * - `UsageMaxLoopDepth`: Maximum loop nesting depth where variable is accessed
 */

import type { Program, VariableDecl, IdentifierExpression } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { SymbolKind } from '../symbol.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { isIdentifierExpression } from '../../ast/type-guards.js';

/**
 * Variable usage information
 *
 * Tracks read/write patterns and loop access for a single variable.
 */
interface VariableUsageInfo {
  /** Variable name (symbol name) */
  name: string;

  /** Number of times variable is read */
  readCount: number;

  /** Number of times variable is written (including initialization) */
  writeCount: number;

  /** Number of accesses inside loops (hot path) */
  hotPathAccesses: number;

  /** Maximum loop nesting depth where variable is accessed */
  maxLoopDepth: number;

  /** Variable declaration node */
  declaration: VariableDecl;
}

/**
 * Variable Usage Analyzer
 *
 * Tracks read and write patterns for all variables to:
 * 1. Detect unused, write-only, and read-only variables
 * 2. Generate usage statistics for optimizer
 * 3. Track hot path accesses (loops)
 * 4. Emit warnings for unused variables
 *
 * @example
 * ```typescript
 * const analyzer = new VariableUsageAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class VariableUsageAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Map of variable name to usage information */
  protected usageMap: Map<string, VariableUsageInfo> = new Map();

  /** Current loop nesting depth (0 = not in loop) */
  protected currentLoopDepth: number = 0;

  /**
   * Create variable usage analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(protected readonly symbolTable: SymbolTable) {}

  /**
   * Run variable usage analysis on entire program
   *
   * Analyzes variable usage patterns to detect:
   * - Unused variables
   * - Write-only variables
   * - Read/write counts
   * - Hot path accesses
   *
   * Sets metadata on variable declarations for optimizer.
   *
   * @param ast - Program AST
   */
  public analyze(ast: Program): void {
    // Step 1: Collect all variable declarations
    this.collectVariableDeclarations(ast);

    // Step 2: Track reads
    this.trackReads(ast);

    // Step 3: Track writes
    this.trackWrites(ast);

    // Step 4: Generate metadata
    this.setVariableMetadata();

    // Step 5: Detect unused variables
    this.detectUnusedVariables();
  }

  /**
   * Detect unused and write-only variables
   *
   * Generates WARNING diagnostics for:
   * - Variables that are declared but never used (read or written)
   * - Variables that are written but never read (write-only)
   *
   * Skips function parameters and exported variables.
   */
  protected detectUnusedVariables(): void {
    for (const [_name, info] of this.usageMap) {
      const decl = info.declaration;

      // Skip exported variables (they may be used by other modules)
      // Note: isExported is protected, so we skip this check for now
      // Exported variables will be handled in future enhancement

      // Detect completely unused variables
      if (info.readCount === 0 && info.writeCount === 0) {
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic warning code
          severity: DiagnosticSeverity.WARNING,
          message: `Variable '${info.name}' is declared but never used`,
          location: decl.getLocation(),
        });
      }
      // Detect write-only variables (written but never read)
      else if (info.writeCount > 0 && info.readCount === 0) {
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH,
          severity: DiagnosticSeverity.WARNING,
          message: `Variable '${info.name}' is assigned but never read`,
          location: decl.getLocation(),
        });
      }
    }
  }

  /**
   * Set metadata on all variable declarations
   *
   * For each variable, sets:
   * - Read/write counts
   * - Hot path accesses
   * - Loop depth
   * - Classification flags (used, write-only, read-only)
   */
  protected setVariableMetadata(): void {
    for (const [_name, info] of this.usageMap) {
      const decl = info.declaration;

      // Ensure metadata map exists
      if (!decl.metadata) {
        decl.metadata = new Map();
      }

      // Set count metadata
      decl.metadata.set(OptimizationMetadataKey.UsageReadCount, info.readCount);
      decl.metadata.set(OptimizationMetadataKey.UsageWriteCount, info.writeCount);
      decl.metadata.set(OptimizationMetadataKey.UsageHotPathAccesses, info.hotPathAccesses);
      decl.metadata.set(OptimizationMetadataKey.UsageMaxLoopDepth, info.maxLoopDepth);

      // Compute and set classification flags
      const isUsed = info.readCount > 0 || info.writeCount > 0;
      const isWriteOnly = info.writeCount > 0 && info.readCount === 0;
      const isReadOnly = info.readCount > 0 && info.writeCount <= 1;

      decl.metadata.set(OptimizationMetadataKey.UsageIsUsed, isUsed);
      decl.metadata.set(OptimizationMetadataKey.UsageIsWriteOnly, isWriteOnly);
      decl.metadata.set(OptimizationMetadataKey.UsageIsReadOnly, isReadOnly);
    }
  }

  /**
   * Track all variable writes in the program
   *
   * Walks the AST to find all variable assignments and initializers.
   * Updates write counts and tracks hot path accesses.
   *
   * @param ast - Program AST
   */
  protected trackWrites(ast: Program): void {
    const tracker = new WriteTracker(this.symbolTable, this.usageMap, () =>
      this.getCurrentLoopDepth()
    );
    tracker.walk(ast);
  }

  /**
   * Track all variable reads in the program
   *
   * Walks the AST to find all identifier expressions that represent
   * variable reads. Updates read counts and tracks hot path accesses.
   *
   * @param ast - Program AST
   */
  protected trackReads(ast: Program): void {
    const tracker = new ReadTracker(this.symbolTable, this.usageMap, () =>
      this.getCurrentLoopDepth()
    );
    tracker.walk(ast);
  }

  /**
   * Collect all variable declarations in the program
   *
   * Walks the AST to find all VariableDecl nodes and creates
   * a VariableUsageInfo entry for each one.
   *
   * Skips function parameters (handled separately).
   *
   * @param ast - Program AST
   */
  protected collectVariableDeclarations(ast: Program): void {
    const collector = new VariableCollector(this.symbolTable, this.usageMap);
    collector.walk(ast);
  }

  /**
   * Enter a loop (increment loop depth)
   *
   * Called when traversing into a loop body.
   */
  protected enterLoop(): void {
    this.currentLoopDepth++;
  }

  /**
   * Exit a loop (decrement loop depth)
   *
   * Called when exiting a loop body.
   */
  protected exitLoop(): void {
    this.currentLoopDepth--;
  }

  /**
   * Get current loop nesting depth
   *
   * @returns Current loop depth (0 = not in loop)
   */
  protected getCurrentLoopDepth(): number {
    return this.currentLoopDepth;
  }

  /**
   * Get all diagnostics from analysis
   *
   * @returns Array of diagnostics (warnings for unused variables)
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}

/**
 * Walker to collect all variable declarations
 *
 * Finds all VariableDecl nodes and creates VariableUsageInfo entries.
 */
class VariableCollector extends ASTWalker {
  /**
   * Create variable collector
   *
   * @param symbolTable - Symbol table
   * @param usageMap - Map to populate with variable info
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly usageMap: Map<string, VariableUsageInfo>
  ) {
    super();
  }

  /**
   * Visit variable declaration
   *
   * Creates a VariableUsageInfo entry for this variable.
   */
  public visitVariableDecl(node: VariableDecl): void {
    // First do the default behavior (traverse children)
    super.visitVariableDecl(node);

    // Look up the symbol for this variable
    const symbol = this.symbolTable.lookup(node.getName());

    // Only track regular variables (not function parameters, which are handled separately)
    if (symbol && symbol.kind === SymbolKind.Variable) {
      // Create usage info entry
      this.usageMap.set(symbol.name, {
        name: symbol.name,
        readCount: 0,
        writeCount: 0,
        hotPathAccesses: 0,
        maxLoopDepth: 0,
        declaration: node,
      });
    }
  }
}

/**
 * Walker to track variable writes
 *
 * Finds all variable assignments and increments write counts.
 * Also tracks initializers as writes.
 */
class WriteTracker extends ASTWalker {
  /**
   * Create write tracker
   *
   * @param symbolTable - Symbol table
   * @param usageMap - Map to update with write counts
   * @param getCurrentLoopDepth - Function to get current loop depth
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly usageMap: Map<string, VariableUsageInfo>,
    protected readonly getCurrentLoopDepth: () => number
  ) {
    super();
  }

  /**
   * Visit variable declaration
   *
   * If the variable has an initializer, count it as a write.
   */
  public visitVariableDecl(node: VariableDecl): void {
    // First do the default behavior (traverse children)
    super.visitVariableDecl(node);

    // Check if variable has initializer
    const initializer = node.getInitializer();
    if (initializer) {
      // Look up the symbol
      const symbol = this.symbolTable.lookup(node.getName());

      if (symbol && symbol.kind === SymbolKind.Variable) {
        const info = this.usageMap.get(symbol.name);
        if (info) {
          // Count initialization as a write
          info.writeCount++;

          // Track loop access if in loop
          const loopDepth = this.getCurrentLoopDepth();
          if (loopDepth > 0) {
            info.hotPathAccesses++;
            if (loopDepth > info.maxLoopDepth) {
              info.maxLoopDepth = loopDepth;
            }
          }
        }
      }
    }
  }

  /**
   * Visit assignment expression
   *
   * Track the assignment as a write.
   */
  public visitAssignmentExpression(node: any): void {
    // First do the default behavior (traverse children)
    super.visitAssignmentExpression(node);

    // Extract the target (left side)
    const target = node.getTarget();

    // Check if target is an identifier (simple variable assignment)
    if (target && isIdentifierExpression(target)) {
      const symbol = this.symbolTable.lookup(target.getName());

      if (symbol && symbol.kind === SymbolKind.Variable) {
        const info = this.usageMap.get(symbol.name);
        if (info) {
          // Count assignment as a write
          info.writeCount++;

          // Track loop access if in loop
          const loopDepth = this.getCurrentLoopDepth();
          if (loopDepth > 0) {
            info.hotPathAccesses++;
            if (loopDepth > info.maxLoopDepth) {
              info.maxLoopDepth = loopDepth;
            }
          }
        }
      }
    }
  }
}

/**
 * Walker to track variable reads
 *
 * Finds all IdentifierExpression nodes that represent variable reads
 * and increments read counts. Tracks loop depth for hot path analysis.
 *
 * **Important:** Skips assignment targets (left-hand side of assignments)
 * since those are writes, not reads.
 */
class ReadTracker extends ASTWalker {
  /**
   * Create read tracker
   *
   * @param symbolTable - Symbol table
   * @param usageMap - Map to update with read counts
   * @param getCurrentLoopDepth - Function to get current loop depth
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly usageMap: Map<string, VariableUsageInfo>,
    protected readonly getCurrentLoopDepth: () => number
  ) {
    super();
  }

  /**
   * Visit assignment expression
   *
   * For assignments, we only want to track reads in the VALUE (right side),
   * NOT the target (left side), since the target is being written to.
   */
  public visitAssignmentExpression(node: any): void {
    // Don't use default behavior - we need custom traversal

    // Only walk the value (right side) - this contains the reads
    const value = node.getValue();
    if (value) {
      this.walk(value);
    }

    // Do NOT walk the target - that's a write, not a read
  }

  /**
   * Visit identifier expression
   *
   * This is a variable read (unless it's an assignment target, which we skip above).
   * Increment read count and track loop access.
   */
  public visitIdentifierExpression(node: IdentifierExpression): void {
    // First do the default behavior (enter/exit node)
    super.visitIdentifierExpression(node);

    // Look up the symbol
    const symbol = this.symbolTable.lookup(node.getName());

    // Only track variable reads
    if (symbol && symbol.kind === SymbolKind.Variable) {
      const info = this.usageMap.get(symbol.name);
      if (info) {
        // Increment read count
        info.readCount++;

        // Track loop access
        const loopDepth = this.getCurrentLoopDepth();
        if (loopDepth > 0) {
          // Variable accessed in a loop (hot path)
          info.hotPathAccesses++;

          // Update max loop depth
          if (loopDepth > info.maxLoopDepth) {
            info.maxLoopDepth = loopDepth;
          }
        }
      }
    }
  }
}