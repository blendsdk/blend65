# Semantic Analyzer Phase 5: Control Flow Analysis

> **Phase**: 5 of 9
> **Focus**: Control flow graph construction and reachability analysis
> **Dependencies**: Phase 1-4 must be complete
> **Duration**: 4-5 days
> **Tasks**: 10
> **Tests**: 60+

---

## **Phase Overview**

Phase 5 implements the fifth semantic analysis pass: building control flow graphs (CFG) and performing reachability analysis to detect dead code and unreachable statements.

### **Objectives**

1. ✅ Build control flow graphs for functions
2. ✅ Perform reachability analysis
3. ✅ Detect dead code
4. ✅ Detect unreachable statements
5. ✅ Validate all paths return (for non-void functions)
6. ✅ Provide clear dead code warnings

### **What This Phase Produces**

- Control flow graphs for all functions
- Reachability information
- Dead code warnings
- Enhanced return path analysis
- Foundation for optimization hints

---

## **Control Flow Graph Architecture**

### **CFG Data Structures**

```typescript
/**
 * Control flow graph node
 */
export interface CFGNode {
  /** Unique node ID */
  id: string;

  /** Node kind */
  kind: CFGNodeKind;

  /** Associated AST statement (if any) */
  statement: Statement | null;

  /** Incoming edges */
  predecessors: CFGNode[];

  /** Outgoing edges */
  successors: CFGNode[];

  /** Is this node reachable from entry? */
  reachable: boolean;

  /** Node metadata */
  metadata?: CFGNodeMetadata;
}

/**
 * CFG node kinds
 */
export enum CFGNodeKind {
  Entry = 'Entry', // Function entry point
  Exit = 'Exit', // Function exit point
  Statement = 'Statement', // Regular statement
  Branch = 'Branch', // If condition
  Loop = 'Loop', // Loop condition
  Break = 'Break', // Break statement
  Continue = 'Continue', // Continue statement
  Return = 'Return', // Return statement
}

/**
 * Control flow graph for a function
 */
export class ControlFlowGraph {
  /** Entry node */
  public entry: CFGNode;

  /** Exit node */
  public exit: CFGNode;

  /** All nodes in the graph */
  protected nodes: Map<string, CFGNode>;

  /** Node counter for unique IDs */
  protected nodeCounter: number;

  constructor() {
    this.nodeCounter = 0;
    this.nodes = new Map();

    // Create entry and exit nodes
    this.entry = this.createNode(CFGNodeKind.Entry, null);
    this.exit = this.createNode(CFGNodeKind.Exit, null);
  }

  /**
   * Create a new CFG node
   */
  public createNode(kind: CFGNodeKind, statement: Statement | null): CFGNode {
    const node: CFGNode = {
      id: `node_${this.nodeCounter++}`,
      kind,
      statement,
      predecessors: [],
      successors: [],
      reachable: false,
    };

    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Add an edge between two nodes
   */
  public addEdge(from: CFGNode, to: CFGNode): void {
    if (!from.successors.includes(to)) {
      from.successors.push(to);
    }
    if (!to.predecessors.includes(from)) {
      to.predecessors.push(from);
    }
  }

  /**
   * Get all nodes
   */
  public getNodes(): CFGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Perform reachability analysis
   */
  public computeReachability(): void {
    // Mark all nodes as unreachable
    for (const node of this.nodes.values()) {
      node.reachable = false;
    }

    // Entry is always reachable
    this.entry.reachable = true;

    // DFS from entry to mark reachable nodes
    const visited = new Set<string>();
    const stack: CFGNode[] = [this.entry];

    while (stack.length > 0) {
      const node = stack.pop()!;

      if (visited.has(node.id)) {
        continue;
      }

      visited.add(node.id);
      node.reachable = true;

      for (const successor of node.successors) {
        if (!visited.has(successor.id)) {
          stack.push(successor);
        }
      }
    }
  }

  /**
   * Check if all paths from entry reach exit
   */
  public allPathsReachExit(): boolean {
    // Check if exit is reachable from entry
    return this.exit.reachable;
  }

  /**
   * Get unreachable nodes
   */
  public getUnreachableNodes(): CFGNode[] {
    return this.getNodes().filter(node => !node.reachable && node.kind !== CFGNodeKind.Exit);
  }
}
```

---

## **Control Flow Analyzer Visitor**

```typescript
/**
 * Control flow analyzer - builds CFGs and analyzes reachability
 */
export class ControlFlowAnalyzer extends ContextAwareWalker {
  /** Symbol table */
  protected symbolTable: SymbolTable;

  /** Diagnostics collector */
  protected diagnostics: Diagnostic[];

  /** Current CFG being built */
  protected currentCFG: ControlFlowGraph | null;

  /** Current CFG node (insertion point) */
  protected currentNode: CFGNode | null;

  /** Loop entry/exit stack (for break/continue) */
  protected loopStack: Array<{ entry: CFGNode; exit: CFGNode }>;

  /** CFGs by function name */
  protected cfgs: Map<string, ControlFlowGraph>;

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
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Get CFG for a function
   */
  public getCFG(functionName: string): ControlFlowGraph | undefined {
    return this.cfgs.get(functionName);
  }

  /**
   * Report a diagnostic
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  //
  // Function Declaration
  //

  public visitFunctionDecl(node: FunctionDecl): void {
    // Create new CFG for this function
    this.currentCFG = new ControlFlowGraph();
    this.currentNode = this.currentCFG.entry;

    // Build CFG from function body
    if (node.body) {
      node.body.accept(this);

      // Connect current node to exit if not already connected
      if (this.currentNode) {
        this.currentCFG.addEdge(this.currentNode, this.currentCFG.exit);
      }
    } else {
      // No body, connect entry to exit
      this.currentCFG.addEdge(this.currentCFG.entry, this.currentCFG.exit);
    }

    // Compute reachability
    this.currentCFG.computeReachability();

    // Check for unreachable code
    const unreachableNodes = this.currentCFG.getUnreachableNodes();
    for (const unreachable of unreachableNodes) {
      if (unreachable.statement) {
        this.reportDiagnostic({
          severity: 'warning',
          message: 'Unreachable code detected',
          location: unreachable.statement.location,
          code: 'W5001',
        });
      }
    }

    // Store CFG
    this.cfgs.set(node.name, this.currentCFG);

    // Clear current CFG
    this.currentCFG = null;
    this.currentNode = null;
  }

  //
  // Block Statement
  //

  public visitBlockStatement(node: BlockStatement): void {
    for (const stmt of node.statements) {
      if (!this.currentNode) {
        // Current node is null, rest of block is unreachable
        this.reportDiagnostic({
          severity: 'warning',
          message: 'Unreachable code detected',
          location: stmt.location,
          code: 'W5001',
        });
        break;
      }

      stmt.accept(this);
    }
  }

  //
  // If Statement
  //

  public visitIfStatement(node: IfStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    // Create branch node for condition
    const branchNode = this.currentCFG.createNode(CFGNodeKind.Branch, node);
    this.currentCFG.addEdge(this.currentNode, branchNode);

    // Create then branch
    this.currentNode = branchNode;
    node.thenBranch.accept(this);
    const thenExit = this.currentNode;

    // Create else branch (if present)
    this.currentNode = branchNode;
    let elseExit: CFGNode | null = branchNode;
    if (node.elseBranch) {
      node.elseBranch.accept(this);
      elseExit = this.currentNode;
    }

    // Merge branches
    if (thenExit || elseExit) {
      const mergeNode = this.currentCFG.createNode(CFGNodeKind.Statement, null);
      if (thenExit) {
        this.currentCFG.addEdge(thenExit, mergeNode);
      }
      if (elseExit) {
        this.currentCFG.addEdge(elseExit, mergeNode);
      }
      this.currentNode = mergeNode;
    } else {
      // Both branches terminate (return/break), no merge needed
      this.currentNode = null;
    }
  }

  //
  // While Statement
  //

  public visitWhileStatement(node: WhileStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    // Create loop entry node
    const loopEntry = this.currentCFG.createNode(CFGNodeKind.Loop, node);
    this.currentCFG.addEdge(this.currentNode, loopEntry);

    // Create loop exit node
    const loopExit = this.currentCFG.createNode(CFGNodeKind.Statement, null);

    // Push loop context
    this.loopStack.push({ entry: loopEntry, exit: loopExit });

    // Build loop body
    this.currentNode = loopEntry;
    node.body.accept(this);

    // Back edge to loop entry
    if (this.currentNode) {
      this.currentCFG.addEdge(this.currentNode, loopEntry);
    }

    // Edge from loop entry to exit (loop may not execute)
    this.currentCFG.addEdge(loopEntry, loopExit);

    // Pop loop context
    this.loopStack.pop();

    this.currentNode = loopExit;
  }

  //
  // For Statement
  //

  public visitForStatement(node: ForStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    // Initialize
    if (node.init) {
      const initNode = this.currentCFG.createNode(CFGNodeKind.Statement, node.init as Statement);
      this.currentCFG.addEdge(this.currentNode, initNode);
      this.currentNode = initNode;
    }

    // Loop entry
    const loopEntry = this.currentCFG.createNode(CFGNodeKind.Loop, node);
    this.currentCFG.addEdge(this.currentNode, loopEntry);

    // Loop exit
    const loopExit = this.currentCFG.createNode(CFGNodeKind.Statement, null);

    // Push loop context
    this.loopStack.push({ entry: loopEntry, exit: loopExit });

    // Build loop body
    this.currentNode = loopEntry;
    node.body.accept(this);

    // Update
    if (node.update && this.currentNode) {
      const updateNode = this.currentCFG.createNode(
        CFGNodeKind.Statement,
        node.update as Statement
      );
      this.currentCFG.addEdge(this.currentNode, updateNode);
      this.currentNode = updateNode;
    }

    // Back edge to loop entry
    if (this.currentNode) {
      this.currentCFG.addEdge(this.currentNode, loopEntry);
    }

    // Edge from loop entry to exit
    this.currentCFG.addEdge(loopEntry, loopExit);

    // Pop loop context
    this.loopStack.pop();

    this.currentNode = loopExit;
  }

  //
  // Return Statement
  //

  public visitReturnStatement(node: ReturnStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    const returnNode = this.currentCFG.createNode(CFGNodeKind.Return, node);
    this.currentCFG.addEdge(this.currentNode, returnNode);
    this.currentCFG.addEdge(returnNode, this.currentCFG.exit);

    // After return, control flow terminates
    this.currentNode = null;
  }

  //
  // Break Statement
  //

  public visitBreakStatement(node: BreakStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    if (this.loopStack.length === 0) {
      return; // Error already reported in Phase 4
    }

    const breakNode = this.currentCFG.createNode(CFGNodeKind.Break, node);
    this.currentCFG.addEdge(this.currentNode, breakNode);

    // Connect to loop exit
    const loopContext = this.loopStack[this.loopStack.length - 1];
    this.currentCFG.addEdge(breakNode, loopContext.exit);

    // After break, control flow terminates
    this.currentNode = null;
  }

  //
  // Continue Statement
  //

  public visitContinueStatement(node: ContinueStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    if (this.loopStack.length === 0) {
      return; // Error already reported in Phase 4
    }

    const continueNode = this.currentCFG.createNode(CFGNodeKind.Continue, node);
    this.currentCFG.addEdge(this.currentNode, continueNode);

    // Connect to loop entry
    const loopContext = this.loopStack[this.loopStack.length - 1];
    this.currentCFG.addEdge(continueNode, loopContext.entry);

    // After continue, control flow terminates
    this.currentNode = null;
  }

  //
  // Expression Statement
  //

  public visitExpressionStatement(node: ExpressionStatement): void {
    if (!this.currentCFG || !this.currentNode) return;

    const stmtNode = this.currentCFG.createNode(CFGNodeKind.Statement, node);
    this.currentCFG.addEdge(this.currentNode, stmtNode);
    this.currentNode = stmtNode;
  }

  //
  // Variable Declaration
  //

  public visitVariableDecl(node: VariableDecl): void {
    if (!this.currentCFG || !this.currentNode) return;

    const declNode = this.currentCFG.createNode(CFGNodeKind.Statement, node as Statement);
    this.currentCFG.addEdge(this.currentNode, declNode);
    this.currentNode = declNode;
  }
}
```

---

## **Implementation Tasks**

### **Task 5.1: CFG Data Structures**

**Files to Create:**

- `src/semantic/control-flow.ts` - CFGNode, ControlFlowGraph

**Implementation:**

1. Define `CFGNode` interface
2. Define `CFGNodeKind` enum
3. Implement `ControlFlowGraph` class
4. Implement node creation
5. Implement edge creation
6. Implement reachability computation

**Tests:** (12 tests)

- Create CFG with entry/exit
- Create nodes
- Add edges
- Compute reachability
- Get unreachable nodes
- Check all paths reach exit

**Time Estimate:** 5 hours

---

### **Task 5.2: Control Flow Analyzer Base**

**Files to Create:**

- `src/semantic/visitors/control-flow-analyzer.ts`

**Implementation:**

1. Create `ControlFlowAnalyzer` class
2. Add CFG management
3. Add current node tracking
4. Add loop stack for break/continue
5. Add CFG storage by function

**Tests:** (8 tests)

- Analyzer instantiation
- CFG creation
- CFG retrieval
- Diagnostics collection

**Time Estimate:** 4 hours

---

### **Task 5.3: Function CFG Construction**

**Implementation:**

1. Implement `visitFunctionDecl()`
2. Create CFG for function
3. Build CFG from body
4. Compute reachability
5. Detect unreachable code
6. Store CFG

**Tests:** (10 tests)

- Empty function CFG
- Function with statements
- Function with return
- Function with unreachable code
- Multiple functions

**Time Estimate:** 4 hours

---

### **Task 5.4: Block Statement CFG**

**Implementation:**

1. Implement `visitBlockStatement()`
2. Process statements sequentially
3. Detect unreachable code in block
4. Handle empty blocks

**Tests:** (8 tests)

- Block with multiple statements
- Block with unreachable code
- Empty block
- Nested blocks

**Time Estimate:** 3 hours

---

### **Task 5.5: If Statement CFG**

**Implementation:**

1. Implement `visitIfStatement()`
2. Create branch node
3. Build then/else branches
4. Merge branches
5. Handle missing else branch

**Tests:** (10 tests)

- If without else
- If with else
- Both branches return
- One branch returns
- Nested if statements

**Time Estimate:** 4 hours

---

### **Task 5.6: Loop Statement CFG**

**Implementation:**

1. Implement `visitWhileStatement()`
2. Implement `visitForStatement()`
3. Create loop entry/exit nodes
4. Add back edges
5. Track loop context

**Tests:** (12 tests)

- While loop CFG
- For loop CFG
- Nested loops
- Loop with break
- Loop with continue
- Empty loop body

**Time Estimate:** 5 hours

---

### **Task 5.7: Return Statement CFG**

**Implementation:**

1. Implement `visitReturnStatement()`
2. Create return node
3. Connect to exit
4. Terminate current control flow

**Tests:** (8 tests)

- Return statement CFG
- Multiple returns
- Return in loop
- Return in if
- Unreachable after return

**Time Estimate:** 3 hours

---

### **Task 5.8: Break/Continue CFG**

**Implementation:**

1. Implement `visitBreakStatement()`
2. Implement `visitContinueStatement()`
3. Connect to loop exit/entry
4. Terminate control flow

**Tests:** (10 tests)

- Break CFG
- Continue CFG
- Break in nested loop
- Continue in nested loop
- Multiple breaks

**Time Estimate:** 4 hours

---

### **Task 5.9: Reachability Analysis**

**Implementation:**

1. Implement DFS reachability algorithm
2. Mark reachable nodes
3. Detect unreachable nodes
4. Report warnings

**Tests:** (12 tests)

- Simple reachability
- Unreachable after return
- Unreachable in branch
- Complex control flow
- All paths analysis

**Time Estimate:** 5 hours

---

### **Task 5.10: Integration and Testing**

**Files to Create:**

- `src/semantic/__tests__/control-flow.test.ts`
- `src/semantic/__tests__/control-flow-analysis.test.ts`

**Tests:** (20+ integration tests)

- End-to-end CFG construction
- Complex control flow patterns
- Dead code detection
- All paths reach exit
- Real-world scenarios

**Time Estimate:** 6 hours

---

## **Task Implementation Checklist**

| Task | Description                | Dependencies | Status |
| ---- | -------------------------- | ------------ | ------ |
| 5.1  | CFG data structures        | Phase 4      | [ ]    |
| 5.2  | Control flow analyzer base | 5.1          | [ ]    |
| 5.3  | Function CFG construction  | 5.2          | [ ]    |
| 5.4  | Block statement CFG        | 5.2          | [ ]    |
| 5.5  | If statement CFG           | 5.2          | [ ]    |
| 5.6  | Loop statement CFG         | 5.2          | [ ]    |
| 5.7  | Return statement CFG       | 5.2          | [ ]    |
| 5.8  | Break/continue CFG         | 5.2, 5.6     | [ ]    |
| 5.9  | Reachability analysis      | 5.1-5.8      | [ ]    |
| 5.10 | Integration testing        | 5.1-5.9      | [ ]    |

**Total**: 10 tasks, 60+ tests, ~4-5 days

---

## **Success Criteria**

Phase 5 is complete when:

- ✅ All 10 tasks completed
- ✅ 60+ tests passing
- ✅ CFGs correctly built
- ✅ Reachability correctly computed
- ✅ Dead code detected
- ✅ Unreachable code warnings
- ✅ All paths analysis working
- ✅ Ready for Phase 6

---

## **Next Phase**

**After Phase 5 completion:**

Proceed to **Phase 6: Memory Analysis**

- Zero page tracking and allocation
- @map address validation
- Memory overlap detection
- Storage class enforcement

---

**Ready to analyze control flow! 📊**
