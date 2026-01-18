/**
 * Call Graph Analysis (Phase 8 - Task 8.12)
 *
 * Builds complete call graph for interprocedural optimization including:
 * - Direct and indirect function call tracking
 * - Recursion detection (direct and mutual)
 * - Inlining candidate identification
 * - Dead function elimination hints
 * - Call count statistics
 *
 * **Analysis Only**: Marks opportunities; IL optimizer performs transformations.
 *
 * @example
 * ```typescript
 * const analyzer = new CallGraphAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 *
 * // Check if function is inline candidate
 * const canInline = func.metadata?.get(OptimizationMetadataKey.CallGraphInlineCandidate);
 * ```
 */

import type { Program, FunctionDecl, IdentifierExpression } from '../../ast/nodes.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { ASTWalker } from '../../ast/walker/base.js';

/**
 * Call graph node representing a function
 */
interface CallGraphNode {
  /** Function name */
  name: string;

  /** Function declaration */
  declaration: FunctionDecl;

  /** Functions this function calls */
  callees: Set<string>;

  /** Functions that call this function */
  callers: Set<string>;

  /** Number of call sites */
  callCount: number;

  /** Is this function recursive? */
  isRecursive: boolean;

  /** Recursion depth (0 = not recursive) */
  recursionDepth: number;

  /** Function size in lines */
  size: number;

  /** Is this an inline candidate? */
  inlineCandidate: boolean;
}

/**
 * Call graph analyzer implementation
 *
 * Builds a directed graph of function calls and analyzes
 * it for optimization opportunities.
 *
 * Analysis includes:
 * - Call count tracking
 * - Recursion detection
 * - Inlining candidate scoring
 * - Dead function detection
 */
export class CallGraphAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  private diagnostics: Diagnostic[] = [];

  /** Call graph nodes (function name → node) */
  private nodes = new Map<string, CallGraphNode>();

  /** Current function being analyzed */
  private currentFunction: string | null = null;

  /** Exported function names (cannot be dead) */
  private exportedFunctions = new Set<string>();
  
  /** Functions with indirect calls (conservative analysis) */
  private hasIndirectCalls = new Set<string>();

  constructor() {
    super();
  }


  /**
   * Analyze program to build call graph
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    // Phase 1: Collect all function declarations
    this.collectFunctions(ast);

    // Phase 2: Build call graph edges
    this.buildCallGraph(ast);

    // Phase 3: Analyze call graph
    this.analyzeCallGraph();

    // Phase 4: Set metadata on AST nodes
    this.setCallGraphMetadata();
  }

  /**
   * Collect all function declarations
   *
   * Builds initial call graph nodes and tracks exported functions.
   * Exported functions are excluded from dead code elimination and inlining.
   */
  private collectFunctions(ast: Program): void {
    const declarations = ast.getDeclarations();

    for (const decl of declarations) {
      if (decl.constructor.name === 'FunctionDecl') {
        const funcDecl = decl as FunctionDecl;
        const funcName = funcDecl.getName();

        // Create call graph node
        this.nodes.set(funcName, {
          name: funcName,
          declaration: funcDecl,
          callees: new Set(),
          callers: new Set(),
          callCount: 0,
          isRecursive: false,
          recursionDepth: 0,
          size: this.calculateFunctionSize(funcDecl),
          inlineCandidate: false,
        });

        // Track exported functions using public getter
        if (funcDecl.isExportedFunction()) {
          this.exportedFunctions.add(funcName);
        }
      }
      else if (decl.constructor.name === 'ExportDecl') {
        // Handle export declarations that wrap functions
        const exportDecl = decl as any;
        const innerDecl = exportDecl.getDeclaration();
        
        if (innerDecl && innerDecl.constructor.name === 'FunctionDecl') {
          const funcDecl = innerDecl as FunctionDecl;
          const funcName = funcDecl.getName();
          
          // Create call graph node
          this.nodes.set(funcName, {
            name: funcName,
            declaration: funcDecl,
            callees: new Set(),
            callers: new Set(),
            callCount: 0,
            isRecursive: false,
            recursionDepth: 0,
            size: this.calculateFunctionSize(funcDecl),
            inlineCandidate: false,
          });
          
          // Mark as exported
          this.exportedFunctions.add(funcName);
        }
      }
    }
  }


  /**
   * Build call graph by analyzing function calls
   */
  private buildCallGraph(ast: Program): void {
    // Visit all functions to find call expressions
    const declarations = ast.getDeclarations();

    for (const decl of declarations) {
      if (decl.constructor.name === 'FunctionDecl') {
        this.visitFunctionDecl(decl);
      }
    }
  }

  /**
   * Visit function declaration
   */
  public visitFunctionDecl(node: any): void {
    this.currentFunction = node.getName();

    // Continue traversal to find calls
    super.visitFunctionDecl(node);

    this.currentFunction = null;
  }

  /**
   * Visit call expression
   *
   * Handles both direct calls (foo()) and indirect calls (ptr(), obj.method()).
   * Indirect calls are tracked conservatively - they prevent inlining.
   */
  public visitCallExpression(node: any): void {
    if (!this.currentFunction) {
      // Module-level call or error
      super.visitCallExpression(node);
      return;
    }

    const callee = node.getCallee();
    const calleeType = callee.constructor.name;

    // Extract callee name for direct calls
    let calleeName: string | null = null;

    if (calleeType === 'IdentifierExpression') {
      // Direct call: foo()
      calleeName = (callee as IdentifierExpression).getName();
    } else {
      // Indirect call: ptr(), obj.method(), array[i](), etc.
      // Mark current function as having indirect calls
      this.hasIndirectCalls.add(this.currentFunction);
      
      // Cannot determine call target statically, so no edge added
      // Conservative analysis: assume it could call anything
    }

    if (calleeName && this.nodes.has(calleeName)) {
      // Add edge to call graph for direct calls
      const caller = this.nodes.get(this.currentFunction)!;
      const calleeNode = this.nodes.get(calleeName)!;

      caller.callees.add(calleeName);
      calleeNode.callers.add(this.currentFunction);
      calleeNode.callCount++;
    }

    // Continue traversal
    super.visitCallExpression(node);
  }


  /**
   * Analyze call graph for optimization opportunities
   */
  private analyzeCallGraph(): void {
    // 1. Detect recursion
    this.detectRecursion();

    // 2. Identify inline candidates
    this.identifyInlineCandidates();

    // 3. Detect dead functions
    this.detectDeadFunctions();
  }

  /**
   * Detect recursive functions
   *
   * Uses DFS to find cycles in call graph.
   */
  private detectRecursion(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [funcName] of this.nodes) {
      if (!visited.has(funcName)) {
        this.dfsRecursion(funcName, visited, recursionStack, 0);
      }
    }
  }

  /**
   * DFS helper for recursion detection
   */
  private dfsRecursion(
    funcName: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    depth: number
  ): void {
    visited.add(funcName);
    recursionStack.add(funcName);

    const node = this.nodes.get(funcName)!;

    for (const callee of node.callees) {
      if (!visited.has(callee)) {
        this.dfsRecursion(callee, visited, recursionStack, depth + 1);
      } else if (recursionStack.has(callee)) {
        // Found cycle - recursion!
        node.isRecursive = true;
        node.recursionDepth = depth + 1;

        // Mark all functions in cycle as recursive
        this.markRecursiveCycle(callee, recursionStack);
      }
    }

    recursionStack.delete(funcName);
  }

  /**
   * Mark all functions in recursive cycle
   */
  private markRecursiveCycle(_start: string, stack: Set<string>): void {
    for (const funcName of stack) {
      const node = this.nodes.get(funcName);
      if (node) {
        node.isRecursive = true;
      }
    }
  }

  /**
   * Identify functions suitable for inlining
   *
   * Inline candidates must meet ALL criteria:
   * - Small function size (< 10 statements)
   * - Not recursive
   * - Called few times (< 5 call sites)
   * - Not exported (not part of public API)
   * - No indirect calls (conservative safety)
   * - Simple control flow (no loops)
   *
   * @remarks
   * Conservative analysis ensures inlining is always safe and beneficial.
   * The IL optimizer will make the final inlining decisions.
   */
  private identifyInlineCandidates(): void {
    for (const [_funcName, node] of this.nodes) {
      // Criteria for inlining
      const isSmall = node.size < 10;
      const notRecursive = !node.isRecursive;
      const fewCallSites = node.callCount < 5 && node.callCount > 0;
      const notExported = !this.exportedFunctions.has(node.name);
      const noIndirectCalls = !this.hasIndirectCalls.has(node.name);
      const simpleControlFlow = this.hasSimpleControlFlow(node.declaration);

      if (isSmall && notRecursive && fewCallSites && notExported && noIndirectCalls && simpleControlFlow) {
        node.inlineCandidate = true;
      }
    }
  }

  /**
   * Check if function has simple control flow (suitable for inlining)
   *
   * Simple control flow means:
   * - No loops (for/while)
   * - Basic if/else is acceptable
   * - No match statements (complex branching)
   *
   * @param func - Function to analyze
   * @returns True if control flow is simple
   */
  private hasSimpleControlFlow(func: FunctionDecl): boolean {
    const body = func.getBody();
    
    if (!body) {
      // Stub function - considered simple
      return true;
    }
    
    return this.checkStatementsForComplexity(body);
  }

  /**
   * Recursively check statements for control flow complexity
   *
   * @param statements - Statements to check
   * @returns True if all statements are simple
   */
  private checkStatementsForComplexity(statements: any[]): boolean {
    for (const stmt of statements) {
      const stmtType = stmt.constructor.name;
      
      // Loops are complex (prevent inlining)
      if (stmtType === 'WhileStatement' || stmtType === 'ForStatement') {
        return false;
      }
      
      // Match statements are complex (many branches)
      if (stmtType === 'MatchStatement') {
        return false;
      }
      
      // Recursively check nested statements
      if (stmtType === 'IfStatement') {
        const thenOk = this.checkStatementsForComplexity(stmt.getThenBranch());
        const elseBranch = stmt.getElseBranch();
        const elseOk = elseBranch ? this.checkStatementsForComplexity(elseBranch) : true;
        
        if (!thenOk || !elseOk) {
          return false;
        }
      }
      
      if (stmtType === 'BlockStatement') {
        if (!this.checkStatementsForComplexity(stmt.getStatements())) {
          return false;
        }
      }
    }
    
    return true;
  }


  /**
   * Detect functions that are never called (dead code)
   */
  private detectDeadFunctions(): void {
    // TODO: Implement dead function detection
    // Currently disabled to avoid conflicting with existing unused function analysis
    // This stub implementation just marks metadata without emitting diagnostics
    for (const [funcName, node] of this.nodes) {
      // Skip exported functions (public API)
      if (this.exportedFunctions.has(funcName)) {
        continue;
      }

      // Skip entry point (main, if exists)
      if (funcName === 'main') {
        continue;
      }

      // Mark as unused in metadata only (no diagnostic)
      if (node.callCount === 0) {
        // Metadata will be set by setCallGraphMetadata()
      }
    }
  }

  /**
   * Set call graph metadata on function declarations
   */
  private setCallGraphMetadata(): void {
    for (const [_funcName, node] of this.nodes) {
      const metadata = node.declaration.metadata || new Map();
      node.declaration.metadata = metadata;

      // Set metadata
      metadata.set(OptimizationMetadataKey.CallGraphCallCount, node.callCount);
      metadata.set(OptimizationMetadataKey.CallGraphInlineCandidate, node.inlineCandidate);
      // Note: CallGraphUnused NOT set - handled by UnusedFunctionAnalyzer (Task 8.3)

      // Optional: Set recursion info
      if (node.isRecursive) {
        metadata.set(OptimizationMetadataKey.CallGraphRecursionDepth, node.recursionDepth);
      }
    }
  }

  /**
   * Calculate function size in lines
   *
   * Counts the total number of statements in the function body,
   * recursively counting nested statements in control flow structures.
   *
   * @param func - Function declaration to measure
   * @returns Number of statements (0 for stub functions)
   *
   * @example
   * ```typescript
   * function foo()
   *   let x = 5;        // 1 statement
   *   if (x > 0)       // 1 statement + nested
   *     return x;       // 1 statement
   *   }
   * end function
   * // Returns: 3
   * ```
   */
  private calculateFunctionSize(func: FunctionDecl): number {
    const body = func.getBody();

    // Stub functions have no body
    if (!body) {
      return 0;
    }

    // Count all statements recursively
    return this.countStatements(body);
  }

  /**
   * Recursively count statements in a statement list
   *
   * Handles nested statements in control structures:
   * - If statements (then branch + else branch)
   * - While/For loops (body)
   * - Match statements (all case bodies)
   * - Block statements (nested statements)
   *
   * @param statements - List of statements to count
   * @returns Total statement count
   */
  private countStatements(statements: any[]): number {
    let count = 0;

    for (const stmt of statements) {
      // Count this statement
      count++;

      // Get statement type from constructor name
      const stmtType = stmt.constructor.name;

      // Recursively count nested statements
      switch (stmtType) {
        case 'IfStatement':
          // Count then branch
          count += this.countStatements(stmt.getThenBranch());

          // Count else branch if present
          const elseBranch = stmt.getElseBranch();
          if (elseBranch) {
            count += this.countStatements(elseBranch);
          }
          break;

        case 'WhileStatement':
          count += this.countStatements(stmt.getBody());
          break;

        case 'ForStatement':
          count += this.countStatements(stmt.getBody());
          break;

        case 'MatchStatement':
          // Count all case bodies
          const cases = stmt.getCases();
          for (const caseClause of cases) {
            count += this.countStatements(caseClause.body);
          }

          // Count default case if present
          const defaultCase = stmt.getDefaultCase();
          if (defaultCase) {
            count += this.countStatements(defaultCase);
          }
          break;

        case 'BlockStatement':
          // Block statements contain nested statements
          count += this.countStatements(stmt.getStatements());
          break;

        // Other statement types (return, break, continue, expression) have no nested statements
        default:
          // No nested statements to count
          break;
      }
    }

    return count;
  }

  /**
   * Get all diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get call graph for debugging
   */
  public getCallGraph(): Map<string, CallGraphNode> {
    return new Map(this.nodes);
  }
}