/**
 * Control Flow Analyzer for Blend65 Compiler v2
 *
 * Builds control flow graphs (CFGs) for functions and performs reachability analysis.
 * This is Phase 5 (Pass 5) of the semantic analyzer implementation.
 *
 * **Responsibilities:**
 * - Build CFGs from AST
 * - Track control flow through statements
 * - Handle branches (if/else/else-if)
 * - Handle loops (while/for/do-while)
 * - Handle jumps (return/break/continue)
 * - Handle switch/match statements
 * - Perform reachability analysis
 * - Report dead code warnings
 *
 * **Architecture:**
 * Extends ContextWalker to automatically track function/loop contexts.
 * Uses CFGBuilder to construct CFGs incrementally during traversal.
 *
 * @module semantic/visitors/control-flow-analyzer
 */

import { ContextWalker, ContextType } from '../../ast/walker/context.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type { SymbolTable } from '../symbol-table.js';
import { ControlFlowGraph, CFGBuilder, CFGNodeKind, type CFGNode } from '../control-flow.js';
import type {
  FunctionDecl,
  BlockStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  DoWhileStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  VariableDecl,
  SwitchStatement,
  MatchStatement,
  Statement,
} from '../../ast/index.js';

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
 * 1. Create entry node for function
 * 2. Walk through statements, connecting them sequentially
 * 3. Handle branches by creating multiple successor edges
 * 4. Handle loops by creating back edges
 * 5. Handle returns by connecting to exit node
 * 6. Create exit node and connect final statement
 * 7. Compute reachability
 * 8. Report unreachable code
 *
 * **Current Node Pointer:**
 * The CFGBuilder's `currentNode` is the insertion point in the CFG.
 * When visiting a statement, we:
 * 1. Create a node for it
 * 2. Connect currentNode → new node
 * 3. Update currentNode = new node
 *
 * When currentNode is null, code is unreachable (after return/break/continue).
 */
export class ControlFlowAnalyzer extends ContextWalker {
  /** Symbol table for the program */
  protected readonly symbolTable: SymbolTable;

  /** Collected diagnostics (warnings about dead code) */
  protected diagnostics: Diagnostic[];

  /** Current CFG builder (null when not in function) */
  protected builder: CFGBuilder | null;

  /** CFGs by function name */
  protected cfgs: Map<string, ControlFlowGraph>;

  /** Track reported unreachable code locations to avoid duplicates */
  protected reportedLocations: Set<string>;

  /**
   * Create a new control flow analyzer
   *
   * @param symbolTable - Symbol table for the program
   */
  constructor(symbolTable: SymbolTable) {
    super();
    this.symbolTable = symbolTable;
    this.diagnostics = [];
    this.builder = null;
    this.cfgs = new Map();
    this.reportedLocations = new Set();
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
   * @param functionName - Name of the function
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
   * @param diagnostic - Diagnostic to report
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  /**
   * Report unreachable code warning
   *
   * Avoids duplicate warnings for the same location.
   *
   * @param stmt - The unreachable statement
   */
  protected reportUnreachableCode(stmt: Statement): void {
    const loc = stmt.getLocation();
    const key = `${loc.start.line}:${loc.start.column}`;

    if (this.reportedLocations.has(key)) {
      return;
    }

    this.reportedLocations.add(key);
    this.reportDiagnostic({
      severity: DiagnosticSeverity.WARNING,
      code: DiagnosticCode.UNREACHABLE_CODE,
      message: 'Unreachable code detected',
      location: loc,
    });
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
  public override visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;

    // Skip stub functions entirely - they have no body to analyze
    const body = node.getBody();
    if (!body) {
      return;
    }

    // Create new CFG builder for this function
    const functionName = node.getName();
    this.builder = new CFGBuilder(functionName);
    this.reportedLocations.clear();

    // Enter function context (ContextWalker handles this)
    this.context.enterContext(ContextType.FUNCTION, node);
    this.enterNode(node);

    // Build CFG from function body
    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of body) {
        if (this.shouldStop) break;

        // If builder says code is unreachable, report warning
        if (!this.builder.isReachable()) {
          this.reportUnreachableCode(stmt);
          // Continue analyzing to find more issues and build complete CFG
        }

        stmt.accept(this);
      }

      // Finalize the CFG
      const cfg = this.builder.finalize();

      // Check for unreachable nodes found by reachability analysis
      const unreachableNodes = cfg.getUnreachableNodes();
      for (const unreachable of unreachableNodes) {
        if (unreachable.statement) {
          this.reportUnreachableCode(unreachable.statement);
        }
      }

      // Store CFG
      this.cfgs.set(functionName, cfg);
    }

    // Clean up
    this.shouldSkip = false;
    this.exitNode(node);
    this.context.exitContext();

    this.builder = null;
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
  public override visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop || !this.builder) return;

    // Don't push context for block - we're already in a function
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getStatements()) {
        if (this.shouldStop) break;

        // If code is unreachable, report warning
        if (!this.builder.isReachable()) {
          this.reportUnreachableCode(stmt);
          // Continue to analyze rest of block
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
  public override visitIfStatement(node: IfStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      // If unreachable, still create nodes for the CFG but they'll be marked unreachable
      if (this.builder && !this.builder.isReachable()) {
        // Add the if statement as an unreachable node
        this.builder.addNode(CFGNodeKind.Branch, node as any);
        this.builder.setCurrentNode(null);
      }
      return;
    }

    this.enterNode(node);

    // Create branch node
    const branchNode = this.builder.startBranch(node as any);

    // Build then branch
    const thenBranch = node.getThenBranch();
    for (const stmt of thenBranch) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }
    const thenExit = this.builder.getCurrentNode();

    // Build else branch (if present)
    this.builder.startAlternate(branchNode);
    let elseExit: CFGNode | null = branchNode;

    const elseBranch = node.getElseBranch();
    if (elseBranch) {
      for (const stmt of elseBranch) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      elseExit = this.builder.getCurrentNode();
    }

    // Merge branches
    this.builder.mergeBranches([thenExit, elseExit]);

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
  public override visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      return;
    }

    this.enterNode(node);

    // Start the loop - this creates entry and exit nodes
    const { entry, exit } = this.builder.startLoop(node as any);

    // Enter loop context (ContextWalker tracks this)
    this.context.enterContext(ContextType.LOOP, node);

    // Build loop body
    const body = node.getBody();
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit loop context
    this.context.exitContext();

    // End the loop - this adds back edge and continues from exit
    this.builder.endLoop(entry, exit);

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // FOR STATEMENT
  // ============================================

  /**
   * Visit for statement
   *
   * Similar to while loop. In Blend65, for loops are:
   * `for (i = start to end) { body }`
   */
  public override visitForStatement(node: ForStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      return;
    }

    this.enterNode(node);

    // Start the loop
    const { entry, exit } = this.builder.startLoop(node as any);

    // Enter loop context
    this.context.enterContext(ContextType.LOOP, node);

    // Build loop body
    const body = node.getBody();
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit loop context
    this.context.exitContext();

    // End the loop
    this.builder.endLoop(entry, exit);

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // DO-WHILE STATEMENT
  // ============================================

  /**
   * Visit do-while statement
   *
   * Creates a loop in the CFG where the body executes at least once:
   * 1. Create loop entry node (body start)
   * 2. Build loop body
   * 3. Create condition node
   * 4. Add back edge from condition to entry (if true)
   * 5. Continue to exit (if false)
   */
  public override visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      return;
    }

    this.enterNode(node);

    // For do-while, we create a custom structure:
    // entry → body → condition → (back to body | exit)

    // Create the body entry node (this is where continue jumps to)
    const bodyEntry = this.builder.addNode(CFGNodeKind.Loop, node as any);

    // Create loop exit node (where break jumps to)
    const loopExit = this.builder.cfg.createNode(CFGNodeKind.Statement, null);

    // Manually manage the loop context for break/continue
    // Note: Using protected property access through cast
    (this.builder as any).loopStack.push({ entry: bodyEntry, exit: loopExit });

    // Enter loop context
    this.context.enterContext(ContextType.LOOP, node);

    // Build loop body
    const body = node.getBody();
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // After body, add back edge to entry (condition is checked at end)
    if (this.builder.isReachable()) {
      this.builder.cfg.addEdge(this.builder.getCurrentNode()!, bodyEntry);
    }

    // Add edge to exit (when condition is false)
    this.builder.cfg.addEdge(bodyEntry, loopExit);

    // Exit loop context
    this.context.exitContext();

    // Pop loop context
    (this.builder as any).loopStack.pop();

    // Continue from exit
    this.builder.setCurrentNode(loopExit);

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // SWITCH STATEMENT
  // ============================================

  /**
   * Visit switch statement
   *
   * Creates a multi-way branch in the CFG.
   * In Blend65, switch cases fall through by default (like C).
   */
  public override visitSwitchStatement(node: SwitchStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      return;
    }

    this.enterNode(node);

    // Create switch entry node
    const switchEntry = this.builder.addNode(CFGNodeKind.Case, node as any);

    // Create switch exit node (where break jumps to)
    const switchExit = this.builder.cfg.createNode(CFGNodeKind.Statement, null);

    // Push "loop" context for break (switch uses break like loops)
    (this.builder as any).loopStack.push({ entry: switchEntry, exit: switchExit });

    // Enter switch context
    this.context.enterContext(ContextType.LOOP, node);

    const cases = node.getCases();
    const defaultCase = node.getDefaultCase();

    // Track exit nodes from each case
    const caseExits: (CFGNode | null)[] = [];

    // Build each case
    for (const caseClause of cases) {
      // Each case starts from switch entry
      this.builder.setCurrentNode(switchEntry);

      // Create case node
      this.builder.addNode(CFGNodeKind.Case, null);

      // Build case body
      for (const stmt of caseClause.body) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      caseExits.push(this.builder.getCurrentNode());
    }

    // Build default case if present
    if (defaultCase) {
      this.builder.setCurrentNode(switchEntry);
      this.builder.addNode(CFGNodeKind.Case, null);

      for (const stmt of defaultCase) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      caseExits.push(this.builder.getCurrentNode());
    } else {
      // No default case - switch entry can fall through
      caseExits.push(switchEntry);
    }

    // Exit switch context
    this.context.exitContext();

    // Pop loop context
    (this.builder as any).loopStack.pop();

    // Merge all case exits
    const validExits = caseExits.filter((e): e is CFGNode => e !== null);

    if (validExits.length === 0) {
      // All cases terminate
      this.builder.setCurrentNode(switchExit);
    } else {
      // Connect all exits to switch exit
      for (const exit of validExits) {
        this.builder.cfg.addEdge(exit, switchExit);
      }
      this.builder.setCurrentNode(switchExit);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // MATCH STATEMENT
  // ============================================

  /**
   * Visit match statement
   *
   * Similar to switch but without fall-through.
   * Each case is a separate branch that must break or return.
   */
  public override visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop || !this.builder || !this.builder.isReachable()) {
      return;
    }

    this.enterNode(node);

    // Create match entry node
    const matchEntry = this.builder.addNode(CFGNodeKind.Case, node as any);

    // Create match exit node
    const matchExit = this.builder.cfg.createNode(CFGNodeKind.Statement, null);

    // Push "loop" context for break
    (this.builder as any).loopStack.push({ entry: matchEntry, exit: matchExit });

    // Enter match context
    this.context.enterContext(ContextType.LOOP, node);

    const cases = node.getCases();
    const defaultCase = node.getDefaultCase();

    // Track exit nodes from each case
    const caseExits: (CFGNode | null)[] = [];

    // Build each case
    for (const caseClause of cases) {
      // Each case starts from match entry
      this.builder.setCurrentNode(matchEntry);

      // Create case node
      this.builder.addNode(CFGNodeKind.Case, null);

      // Build case body
      for (const stmt of caseClause.body) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      caseExits.push(this.builder.getCurrentNode());
    }

    // Build default case if present
    if (defaultCase) {
      this.builder.setCurrentNode(matchEntry);
      this.builder.addNode(CFGNodeKind.Case, null);

      for (const stmt of defaultCase) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      caseExits.push(this.builder.getCurrentNode());
    }

    // Exit match context
    this.context.exitContext();

    // Pop loop context
    (this.builder as any).loopStack.pop();

    // Merge all case exits
    const validExits = caseExits.filter((e): e is CFGNode => e !== null);

    if (validExits.length === 0) {
      // All cases terminate
      this.builder.setCurrentNode(null);
    } else {
      // Connect all exits to match exit
      for (const exit of validExits) {
        this.builder.cfg.addEdge(exit, matchExit);
      }
      this.builder.setCurrentNode(matchExit);
    }

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
  public override visitReturnStatement(node: ReturnStatement): void {
    if (this.shouldStop || !this.builder) return;

    this.enterNode(node);

    if (this.builder.isReachable()) {
      this.builder.addReturn(node as any);
    } else {
      // Still create node for unreachable code tracking
      this.builder.addNode(CFGNodeKind.Return, node as any);
      this.builder.setCurrentNode(null);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // BREAK STATEMENT
  // ============================================

  /**
   * Visit break statement
   *
   * Connects to loop/switch exit and terminates control flow.
   */
  public override visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop || !this.builder) return;

    this.enterNode(node);

    if (this.builder.isReachable()) {
      this.builder.addBreak(node as any);
    } else {
      // Still create node for unreachable code tracking
      this.builder.addNode(CFGNodeKind.Break, node as any);
      this.builder.setCurrentNode(null);
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
  public override visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop || !this.builder) return;

    this.enterNode(node);

    if (this.builder.isReachable()) {
      this.builder.addContinue(node as any);
    } else {
      // Still create node for unreachable code tracking
      this.builder.addNode(CFGNodeKind.Continue, node as any);
      this.builder.setCurrentNode(null);
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
  public override visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop || !this.builder) return;

    this.enterNode(node);

    // Create statement node (even if unreachable - for CFG completeness)
    this.builder.addStatement(node as any);

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
  public override visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop || !this.builder) return;

    this.enterNode(node);

    // Create statement node for declaration
    this.builder.addStatement(node as any);

    this.shouldSkip = false;
    this.exitNode(node);
  }
}