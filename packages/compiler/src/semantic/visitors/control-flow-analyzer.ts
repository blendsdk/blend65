/**
 * Control Flow Analyzer for Blend65 Compiler
 *
 * Builds control flow graphs (CFGs) for functions and performs reachability analysis.
 * This is Phase 5 of the semantic analyzer implementation.
 *
 * **Responsibilities:**
 * - Build CFGs from AST
 * - Track control flow through statements
 * - Handle branches (if/else)
 * - Handle loops (while/for/match)
 * - Handle jumps (return/break/continue)
 * - Perform reachability analysis
 * - Report dead code warnings
 *
 * **Architecture:**
 * Extends ContextWalker to automatically track function/loop contexts.
 * Uses a "current node" pointer to build CFG incrementally during traversal.
 */

import { ContextWalker } from '../../ast/walker/context.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type { SymbolTable } from '../symbol-table.js';
import { ControlFlowGraph, CFGNode, CFGNodeKind } from '../control-flow.js';
import type {
  FunctionDecl,
  BlockStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  VariableDecl,
} from '../../ast/nodes.js';

/**
 * Loop context for break/continue handling
 *
 * Tracks the entry and exit points of a loop for connecting
 * break and continue statements.
 */
interface LoopContext {
  /** Loop entry node (where continue jumps to) */
  entry: CFGNode;
  /** Loop exit node (where break jumps to) */
  exit: CFGNode;
}

/**
 * Control Flow Analyzer
 *
 * Builds control flow graphs for all functions in the program
 * and performs reachability analysis to detect dead code.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new ControlFlowAnalyzer(symbolTable);
 * analyzer.walk(program);
 *
 * const diagnostics = analyzer.getDiagnostics();
 * const cfg = analyzer.getCFG('myFunction');
 * ```
 *
 * **CFG Construction Algorithm:**
 * 1. Create entry node
 * 2. Walk through statements, connecting them sequentially
 * 3. Handle branches by creating multiple successor edges
 * 4. Handle loops by creating back edges
 * 5. Handle returns by connecting to exit node
 * 6. Create exit node and connect final statement
 * 7. Compute reachability
 * 8. Report unreachable code
 *
 * **Current Node Pointer:**
 * The `currentNode` is the insertion point in the CFG.
 * When visiting a statement, we:
 * 1. Create a node for it
 * 2. Connect currentNode → new node
 * 3. Update currentNode = new node
 *
 * When currentNode is null, code is unreachable (after return/break/continue).
 */
export class ControlFlowAnalyzer extends ContextWalker {
  /** Symbol table for the program */
  protected symbolTable: SymbolTable;

  /** Collected diagnostics (warnings about dead code) */
  protected diagnostics: Diagnostic[];

  /** Current CFG being built (null when not in function) */
  protected currentCFG: ControlFlowGraph | null;

  /** Current insertion point (null means unreachable) */
  protected currentNode: CFGNode | null;

  /** Loop stack for break/continue (innermost loop at end) */
  protected loopStack: LoopContext[];

  /** CFGs by function name */
  protected cfgs: Map<string, ControlFlowGraph>;

  /**
   * Create a new control flow analyzer
   *
   * @param symbolTable Symbol table for the program
   */
  constructor(symbolTable: SymbolTable) {
    super();
    this.symbolTable = symbolTable;
    this.diagnostics = [];
    this.currentCFG = null;
    this.currentNode = null;
    this.loopStack = [];
    this.cfgs = new Map();
  }

  /**
   * Get collected diagnostics
   *
   * Returns warnings about unreachable code.
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Get CFG for a function
   *
   * Returns the control flow graph for the specified function,
   * or undefined if function not found.
   *
   * @param functionName Name of the function
   * @returns CFG for the function, or undefined
   */
  public getCFG(functionName: string): ControlFlowGraph | undefined {
    return this.cfgs.get(functionName);
  }

  /**
   * Get all CFGs
   *
   * Returns map of all function CFGs indexed by function name.
   *
   * @returns Map of function name to CFG
   */
  public getAllCFGs(): Map<string, ControlFlowGraph> {
    return this.cfgs;
  }

  /**
   * Report a diagnostic
   *
   * Adds a diagnostic to the collected list.
   *
   * @param diagnostic Diagnostic to report
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  // ============================================
  // FUNCTION DECLARATION
  // ============================================

  /**
   * Visit function declaration
   *
   * Creates a CFG for the function:
   * 1. Create entry node
   * 2. Build CFG from body
   * 3. Connect to exit node
   * 4. Compute reachability
   * 5. Report unreachable code
   * 6. Store CFG
   *
   * Note: Stub functions (functions without bodies) are skipped entirely.
   */
  public visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;

    // Skip stub functions entirely - they have no body to analyze
    // TODO(IL-GEN): Stub functions are skipped (no CFG created).
    // This is correct behavior - intrinsics have no control flow to analyze.
    // See: plans/il-generator-requirements.md
    const body = node.getBody();
    if (!body) {
      return;
    }

    // Create new CFG for this function
    this.currentCFG = new ControlFlowGraph();
    this.currentNode = this.currentCFG.entry;

    // Enter function context (ContextWalker handles this)
    this.context.enterContext(0 as any, node);
    this.enterNode(node);

    // Build CFG from function body
    if (!this.shouldSkip && !this.shouldStop) {
      if (body) {
        for (const stmt of body) {
          if (this.shouldStop) break;

          // If currentNode is null, rest of body is unreachable
          if (!this.currentNode) {
            this.reportDiagnostic({
              severity: DiagnosticSeverity.WARNING,
              code: DiagnosticCode.UNREACHABLE_CODE,
              message: 'Unreachable code detected',
              location: stmt.getLocation(),
            });
            // Don't break - continue analyzing to find more issues
          }

          stmt.accept(this);
        }
      }

      // Connect current node to exit if not already terminated
      if (this.currentNode && this.currentCFG) {
        this.currentCFG.addEdge(this.currentNode, this.currentCFG.exit);
      }
    }

    // Compute reachability
    if (this.currentCFG) {
      this.currentCFG.computeReachability();

      // Check for unreachable nodes
      const unreachableNodes = this.currentCFG.getUnreachableNodes();
      for (const unreachable of unreachableNodes) {
        if (unreachable.statement) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.WARNING,
            code: DiagnosticCode.UNREACHABLE_CODE,
            message: 'Unreachable code detected',
            location: unreachable.statement.getLocation(),
          });
        }
      }

      // Store CFG
      this.cfgs.set(node.getName(), this.currentCFG);
    }

    // Clean up
    this.shouldSkip = false;
    this.exitNode(node);
    this.context.exitContext();

    this.currentCFG = null;
    this.currentNode = null;
  }

  // ============================================
  // BLOCK STATEMENT
  // ============================================

  /**
   * Visit block statement
   *
   * Processes statements sequentially.
   * If currentNode becomes null, rest of block is unreachable.
   */
  public visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getStatements()) {
        if (this.shouldStop) break;

        // If currentNode is null, rest of block is unreachable
        if (!this.currentNode) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.WARNING,
            code: DiagnosticCode.UNREACHABLE_CODE,
            message: 'Unreachable code detected',
            location: stmt.getLocation(),
          });
          continue; // Continue to analyze rest of block
        }

        stmt.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // IF STATEMENT
  // ============================================

  /**
   * Visit if statement
   *
   * Creates a branch in the CFG:
   * 1. Create branch node for condition
   * 2. Build then branch from branch node
   * 3. Build else branch from branch node (if present)
   * 4. Create merge node
   * 5. Connect both branches to merge
   * 6. If both branches terminate, currentNode = null
   */
  public visitIfStatement(node: IfStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Create branch node
    const branchNode = this.currentCFG.createNode(CFGNodeKind.Branch, node as any);
    this.currentCFG.addEdge(this.currentNode, branchNode);

    // Build then branch
    this.currentNode = branchNode;
    const thenBranch = node.getThenBranch();
    for (const stmt of thenBranch) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }
    const thenExit = this.currentNode;

    // Build else branch (if present)
    this.currentNode = branchNode;
    let elseExit: CFGNode | null = branchNode;

    const elseBranch = node.getElseBranch();
    if (elseBranch) {
      for (const stmt of elseBranch) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      elseExit = this.currentNode;
    }

    // Merge branches
    if (thenExit || elseExit) {
      // At least one branch doesn't terminate, create merge node
      const mergeNode = this.currentCFG.createNode(CFGNodeKind.Statement, null);

      if (thenExit) {
        this.currentCFG.addEdge(thenExit, mergeNode);
      }
      if (elseExit) {
        this.currentCFG.addEdge(elseExit, mergeNode);
      }

      this.currentNode = mergeNode;
    } else {
      // Both branches terminate (return/break/continue)
      this.currentNode = null;
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // WHILE STATEMENT
  // ============================================

  /**
   * Visit while statement
   *
   * Creates a loop in the CFG:
   * 1. Create loop entry node
   * 2. Create loop exit node
   * 3. Push loop context for break/continue
   * 4. Build loop body from entry
   * 5. Add back edge from body to entry
   * 6. Add forward edge from entry to exit
   * 7. Pop loop context
   * 8. Continue from exit
   */
  public visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Create loop entry node (condition)
    const loopEntry = this.currentCFG.createNode(CFGNodeKind.Loop, node as any);
    this.currentCFG.addEdge(this.currentNode, loopEntry);

    // Create loop exit node
    const loopExit = this.currentCFG.createNode(CFGNodeKind.Statement, null);

    // Push loop context
    this.loopStack.push({ entry: loopEntry, exit: loopExit });

    // Build loop body
    this.currentNode = loopEntry;
    const body = node.getBody();
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Add back edge to loop entry
    if (this.currentNode) {
      this.currentCFG.addEdge(this.currentNode, loopEntry);
    }

    // Add forward edge from entry to exit (loop may not execute)
    this.currentCFG.addEdge(loopEntry, loopExit);

    // Pop loop context
    this.loopStack.pop();

    // Continue from exit
    this.currentNode = loopExit;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // FOR STATEMENT
  // ============================================

  /**
   * Visit for statement
   *
   * Similar to while loop with initialization step.
   */
  public visitForStatement(node: ForStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Note: For loop variable initialization is handled by parser's scope manager
    // We don't need to create a separate init node

    // Create loop entry node (condition check)
    const loopEntry = this.currentCFG.createNode(CFGNodeKind.Loop, node as any);
    this.currentCFG.addEdge(this.currentNode, loopEntry);

    // Create loop exit node
    const loopExit = this.currentCFG.createNode(CFGNodeKind.Statement, null);

    // Push loop context
    this.loopStack.push({ entry: loopEntry, exit: loopExit });

    // Build loop body
    this.currentNode = loopEntry;
    const body = node.getBody();
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Add back edge to loop entry (for loop continues)
    if (this.currentNode) {
      this.currentCFG.addEdge(this.currentNode, loopEntry);
    }

    // Add forward edge from entry to exit
    this.currentCFG.addEdge(loopEntry, loopExit);

    // Pop loop context
    this.loopStack.pop();

    // Continue from exit
    this.currentNode = loopExit;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // RETURN STATEMENT
  // ============================================

  /**
   * Visit return statement
   *
   * Connects to exit node and terminates control flow.
   */
  public visitReturnStatement(node: ReturnStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Create return node
    const returnNode = this.currentCFG.createNode(CFGNodeKind.Return, node as any);
    this.currentCFG.addEdge(this.currentNode, returnNode);

    // Connect to exit
    this.currentCFG.addEdge(returnNode, this.currentCFG.exit);

    // Terminate control flow
    this.currentNode = null;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // BREAK STATEMENT
  // ============================================

  /**
   * Visit break statement
   *
   * Connects to loop exit and terminates control flow.
   */
  public visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Error checking is done in Phase 4, just build CFG here
    if (this.loopStack.length === 0) {
      // Invalid break, but still create node for CFG completeness
      const breakNode = this.currentCFG.createNode(CFGNodeKind.Break, node as any);
      this.currentCFG.addEdge(this.currentNode, breakNode);
      this.currentNode = null;
    } else {
      // Create break node
      const breakNode = this.currentCFG.createNode(CFGNodeKind.Break, node as any);
      this.currentCFG.addEdge(this.currentNode, breakNode);

      // Connect to loop exit
      const loopContext = this.loopStack[this.loopStack.length - 1];
      this.currentCFG.addEdge(breakNode, loopContext.exit);

      // Terminate control flow
      this.currentNode = null;
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // CONTINUE STATEMENT
  // ============================================

  /**
   * Visit continue statement
   *
   * Connects to loop entry and terminates control flow.
   */
  public visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Error checking is done in Phase 4, just build CFG here
    if (this.loopStack.length === 0) {
      // Invalid continue, but still create node for CFG completeness
      const continueNode = this.currentCFG.createNode(CFGNodeKind.Continue, node as any);
      this.currentCFG.addEdge(this.currentNode, continueNode);
      this.currentNode = null;
    } else {
      // Create continue node
      const continueNode = this.currentCFG.createNode(CFGNodeKind.Continue, node as any);
      this.currentCFG.addEdge(this.currentNode, continueNode);

      // Connect to loop entry
      const loopContext = this.loopStack[this.loopStack.length - 1];
      this.currentCFG.addEdge(continueNode, loopContext.entry);

      // Terminate control flow
      this.currentNode = null;
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // EXPRESSION STATEMENT
  // ============================================

  /**
   * Visit expression statement
   *
   * Creates a statement node and continues control flow.
   */
  public visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Create statement node
    const stmtNode = this.currentCFG.createNode(CFGNodeKind.Statement, node as any);
    this.currentCFG.addEdge(this.currentNode, stmtNode);
    this.currentNode = stmtNode;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // VARIABLE DECLARATION
  // ============================================

  /**
   * Visit variable declaration
   *
   * Creates a statement node and continues control flow.
   */
  public visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop || !this.currentCFG || !this.currentNode) return;

    this.enterNode(node);

    // Create statement node for declaration
    const declNode = this.currentCFG.createNode(CFGNodeKind.Statement, node as any);
    this.currentCFG.addEdge(this.currentNode, declNode);
    this.currentNode = declNode;

    this.shouldSkip = false;
    this.exitNode(node);
  }
}
