/**
 * Expression Complexity Analysis (IL Readiness)
 *
 * Analyzes expression complexity to help the IL generator make decisions about:
 * - When to spill values to memory vs keep in registers
 * - How to allocate the limited 6502 registers (A, X, Y)
 * - How to create optimal temporaries for complex expressions
 *
 * **Complexity Scoring** (0-100):
 * - Literals: 1 (simplest - immediate value)
 * - Identifiers: 2 (variable load)
 * - Unary expressions: 3 + operand complexity
 * - Binary expressions: 5 + left + right complexity
 * - Array access: 8 + index complexity (memory access)
 * - Function calls: 20 + sum of argument complexities (expensive)
 *
 * **Register Pressure** (1-3):
 * The 6502 has only 3 general-purpose registers (A, X, Y).
 * This metric indicates how many registers are needed simultaneously.
 * - Literals/Identifiers: 1 (just need A)
 * - Binary expressions: max(left, right + 1) - capped at 3
 * - Complex expressions may need all 3 registers
 *
 * **Tree Depth**:
 * How deep the expression tree is. Deeper trees require more stack
 * management on the limited 6502 stack (256 bytes).
 *
 * **Metadata Set**:
 * - ExprComplexityScore: Overall complexity (0-100)
 * - ExprRegisterPressure: Max registers needed (1-3)
 * - ExprTreeDepth: Depth of expression tree
 * - ExprOperationCount: Number of operations
 * - ExprContainsCall: Has function call (boolean)
 * - ExprContainsMemoryAccess: Has memory access (boolean)
 *
 * @example
 * ```typescript
 * const analyzer = new ExpressionComplexityAnalyzer();
 * analyzer.analyze(ast);
 *
 * // Check if expression needs register spilling
 * const pressure = node.metadata?.get(OptimizationMetadataKey.ExprRegisterPressure);
 * if (pressure > 2) {
 *   // Need to use stack for intermediate values
 * }
 * ```
 */

import type { Program } from '../../ast/nodes.js';
import type {
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  LiteralExpression,
  IdentifierExpression,
  AssignmentExpression,
  ArrayLiteralExpression,
} from '../../ast/nodes.js';
import type { ASTNode, Expression } from '../../ast/base.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import {
  isExpression,
  isLiteralExpression,
  isIdentifierExpression,
} from '../../ast/type-guards.js';
import type { Diagnostic } from '../../ast/diagnostics.js';

/**
 * Information about expression complexity
 *
 * Detailed breakdown of complexity metrics for an expression.
 * Useful for debugging and optimization decision transparency.
 */
export interface ComplexityInfo {
  /** Overall complexity score (0-100) */
  score: number;

  /** Maximum registers needed simultaneously (1-3) */
  registerPressure: number;

  /** Depth of expression tree */
  treeDepth: number;

  /** Number of operations in expression */
  operationCount: number;

  /** Expression contains at least one function call */
  containsCall: boolean;

  /** Expression contains at least one memory access (array/member) */
  containsMemoryAccess: boolean;
}

/**
 * Expression Complexity Analyzer
 *
 * Traverses the AST and calculates complexity metrics for all expressions.
 * This information is used by the IL generator to make optimal code
 * generation decisions for the resource-constrained 6502 processor.
 *
 * Key responsibilities:
 * - Calculate complexity scores for expressions
 * - Determine register pressure
 * - Identify expressions that need stack-based evaluation
 * - Mark expressions containing function calls (require register saves)
 * - Mark expressions containing memory accesses (require addressing modes)
 */
export class ExpressionComplexityAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Complexity info for all analyzed expressions */
  protected complexityMap: Map<Expression, ComplexityInfo> = new Map();

  /**
   * Analyze expression complexity for entire program
   *
   * Traverses the AST and calculates complexity metrics for all expressions.
   * Stores results in AST node metadata for IL generator consumption.
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    // Reset state
    this.diagnostics = [];
    this.complexityMap.clear();

    // Walk the AST using inherited walk() method
    this.walk(ast);
  }

  /**
   * Get all complexity information collected during analysis
   *
   * @returns Map of expressions to complexity info
   */
  public getComplexityMap(): Map<Expression, ComplexityInfo> {
    return new Map(this.complexityMap);
  }

  /**
   * Get complexity info for a specific expression
   *
   * @param expr - Expression to get info for
   * @returns Complexity info, or null if not analyzed
   */
  public getComplexityInfo(expr: Expression): ComplexityInfo | null {
    return this.complexityMap.get(expr) ?? null;
  }

  /**
   * Get diagnostics generated during analysis
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  // ============================================
  // VISITOR METHODS (Override ASTWalker methods)
  // ============================================

  /**
   * Visit binary expression - calculate complexity
   */
  public visitBinaryExpression(node: BinaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit children
      node.getLeft().accept(this);
      if (!this.shouldStop) {
        node.getRight().accept(this);
      }

      // Then calculate complexity after children are analyzed
      if (!this.shouldStop) {
        const info = this.calculateBinaryComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit unary expression - calculate complexity
   */
  public visitUnaryExpression(node: UnaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit operand
      node.getOperand().accept(this);

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateUnaryComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit call expression - calculate complexity (high cost)
   */
  public visitCallExpression(node: CallExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit callee and arguments
      node.getCallee().accept(this);
      for (const arg of node.getArguments()) {
        if (this.shouldStop) break;
        arg.accept(this);
      }

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateCallComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit index expression - calculate complexity (memory access)
   */
  public visitIndexExpression(node: IndexExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit object and index
      node.getObject().accept(this);
      if (!this.shouldStop) {
        node.getIndex().accept(this);
      }

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateIndexComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit member expression - calculate complexity (memory access)
   */
  public visitMemberExpression(node: MemberExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit object
      node.getObject().accept(this);

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateMemberComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit literal expression - simplest case
   */
  public visitLiteralExpression(node: LiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      const info = this.calculateLiteralComplexity(node);
      this.storeComplexityInfo(node, info);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit identifier expression - variable access
   */
  public visitIdentifierExpression(node: IdentifierExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      const info = this.calculateIdentifierComplexity(node);
      this.storeComplexityInfo(node, info);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit assignment expression - calculate complexity
   */
  public visitAssignmentExpression(node: AssignmentExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit target and value
      node.getTarget().accept(this);
      if (!this.shouldStop) {
        node.getValue().accept(this);
      }

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateAssignmentComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit array literal expression - calculate complexity
   */
  public visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // First visit all elements
      for (const element of node.getElements()) {
        if (this.shouldStop) break;
        element.accept(this);
      }

      // Then calculate complexity
      if (!this.shouldStop) {
        const info = this.calculateArrayLiteralComplexity(node);
        this.storeComplexityInfo(node, info);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // COMPLEXITY CALCULATION METHODS
  // ============================================

  /**
   * Calculate complexity for literal expression
   *
   * Literals are the simplest - just an immediate value.
   * Score: 1, Register pressure: 1, Depth: 1
   */
  protected calculateLiteralComplexity(_node: LiteralExpression): ComplexityInfo {
    return {
      score: 1,
      registerPressure: 1,
      treeDepth: 1,
      operationCount: 0,
      containsCall: false,
      containsMemoryAccess: false,
    };
  }

  /**
   * Calculate complexity for identifier expression
   *
   * Variable access - slightly more complex than literal.
   * Score: 2, Register pressure: 1, Depth: 1
   */
  protected calculateIdentifierComplexity(_node: IdentifierExpression): ComplexityInfo {
    return {
      score: 2,
      registerPressure: 1,
      treeDepth: 1,
      operationCount: 0,
      containsCall: false,
      containsMemoryAccess: false,
    };
  }

  /**
   * Calculate complexity for unary expression
   *
   * Unary operations add small overhead to operand complexity.
   * Score: 3 + operand, Register pressure: operand (same register)
   */
  protected calculateUnaryComplexity(node: UnaryExpression): ComplexityInfo {
    const operandInfo = this.getChildComplexity(node.getOperand());

    return {
      score: Math.min(100, 3 + operandInfo.score),
      registerPressure: operandInfo.registerPressure,
      treeDepth: 1 + operandInfo.treeDepth,
      operationCount: 1 + operandInfo.operationCount,
      containsCall: operandInfo.containsCall,
      containsMemoryAccess: operandInfo.containsMemoryAccess,
    };
  }

  /**
   * Calculate complexity for binary expression
   *
   * Binary operations require evaluating both sides.
   * Score: 5 + left + right
   * Register pressure: max(left, right + 1) - need one register for result
   * while other side is being computed
   */
  protected calculateBinaryComplexity(node: BinaryExpression): ComplexityInfo {
    const leftInfo = this.getChildComplexity(node.getLeft());
    const rightInfo = this.getChildComplexity(node.getRight());

    // Register pressure: need to hold left result while computing right
    // Then need register for operation result
    const registerPressure = Math.min(
      3,
      Math.max(leftInfo.registerPressure, rightInfo.registerPressure + 1)
    );

    return {
      score: Math.min(100, 5 + leftInfo.score + rightInfo.score),
      registerPressure,
      treeDepth: 1 + Math.max(leftInfo.treeDepth, rightInfo.treeDepth),
      operationCount: 1 + leftInfo.operationCount + rightInfo.operationCount,
      containsCall: leftInfo.containsCall || rightInfo.containsCall,
      containsMemoryAccess: leftInfo.containsMemoryAccess || rightInfo.containsMemoryAccess,
    };
  }

  /**
   * Calculate complexity for call expression
   *
   * Function calls are expensive:
   * - Must save registers before call
   * - Push arguments to stack
   * - JSR/RTS overhead
   * - Restore registers after return
   *
   * Score: 20 + sum of argument complexities
   * Register pressure: 3 (all registers potentially clobbered)
   */
  protected calculateCallComplexity(node: CallExpression): ComplexityInfo {
    const calleeInfo = this.getChildComplexity(node.getCallee());
    
    let argScore = 0;
    let argOperations = 0;
    let maxArgDepth = 0;
    let argContainsCall = false;
    let argContainsMemory = false;

    for (const arg of node.getArguments()) {
      const argInfo = this.getChildComplexity(arg);
      argScore += argInfo.score;
      argOperations += argInfo.operationCount;
      maxArgDepth = Math.max(maxArgDepth, argInfo.treeDepth);
      argContainsCall = argContainsCall || argInfo.containsCall;
      argContainsMemory = argContainsMemory || argInfo.containsMemoryAccess;
    }

    return {
      score: Math.min(100, 20 + calleeInfo.score + argScore),
      registerPressure: 3, // Function calls clobber all registers
      treeDepth: 1 + Math.max(calleeInfo.treeDepth, maxArgDepth),
      operationCount: 1 + calleeInfo.operationCount + argOperations,
      containsCall: true, // This IS a call
      containsMemoryAccess: calleeInfo.containsMemoryAccess || argContainsMemory,
    };
  }

  /**
   * Calculate complexity for index expression (array access)
   *
   * Array access requires:
   * - Computing base address
   * - Computing index
   * - Memory load with indexed addressing
   *
   * Score: 8 + object + index
   */
  protected calculateIndexComplexity(node: IndexExpression): ComplexityInfo {
    const objectInfo = this.getChildComplexity(node.getObject());
    const indexInfo = this.getChildComplexity(node.getIndex());

    // Need registers for both base and index
    const registerPressure = Math.min(
      3,
      Math.max(objectInfo.registerPressure, indexInfo.registerPressure + 1)
    );

    return {
      score: Math.min(100, 8 + objectInfo.score + indexInfo.score),
      registerPressure,
      treeDepth: 1 + Math.max(objectInfo.treeDepth, indexInfo.treeDepth),
      operationCount: 1 + objectInfo.operationCount + indexInfo.operationCount,
      containsCall: objectInfo.containsCall || indexInfo.containsCall,
      containsMemoryAccess: true, // This IS a memory access
    };
  }

  /**
   * Calculate complexity for member expression
   *
   * Member access (struct field) requires:
   * - Computing base address
   * - Adding field offset
   * - Memory load
   *
   * Score: 6 + object complexity
   */
  protected calculateMemberComplexity(node: MemberExpression): ComplexityInfo {
    const objectInfo = this.getChildComplexity(node.getObject());

    return {
      score: Math.min(100, 6 + objectInfo.score),
      registerPressure: objectInfo.registerPressure,
      treeDepth: 1 + objectInfo.treeDepth,
      operationCount: 1 + objectInfo.operationCount,
      containsCall: objectInfo.containsCall,
      containsMemoryAccess: true, // This IS a memory access
    };
  }

  /**
   * Calculate complexity for assignment expression
   *
   * Assignment requires:
   * - Computing the value
   * - Computing target address (if not simple variable)
   * - Memory store
   *
   * Score: 4 + target + value
   */
  protected calculateAssignmentComplexity(node: AssignmentExpression): ComplexityInfo {
    const targetInfo = this.getChildComplexity(node.getTarget());
    const valueInfo = this.getChildComplexity(node.getValue());

    const registerPressure = Math.min(
      3,
      Math.max(targetInfo.registerPressure, valueInfo.registerPressure + 1)
    );

    return {
      score: Math.min(100, 4 + targetInfo.score + valueInfo.score),
      registerPressure,
      treeDepth: 1 + Math.max(targetInfo.treeDepth, valueInfo.treeDepth),
      operationCount: 1 + targetInfo.operationCount + valueInfo.operationCount,
      containsCall: targetInfo.containsCall || valueInfo.containsCall,
      containsMemoryAccess: true, // Assignment is a memory write
    };
  }

  /**
   * Calculate complexity for array literal expression
   *
   * Array literals require:
   * - Computing each element
   * - Storing elements sequentially
   *
   * Score: 5 + sum of element complexities
   */
  protected calculateArrayLiteralComplexity(node: ArrayLiteralExpression): ComplexityInfo {
    let elementScore = 0;
    let elementOperations = 0;
    let maxElementDepth = 0;
    let elementContainsCall = false;
    let elementContainsMemory = false;
    let maxPressure = 1;

    for (const element of node.getElements()) {
      const elementInfo = this.getChildComplexity(element);
      elementScore += elementInfo.score;
      elementOperations += elementInfo.operationCount;
      maxElementDepth = Math.max(maxElementDepth, elementInfo.treeDepth);
      elementContainsCall = elementContainsCall || elementInfo.containsCall;
      elementContainsMemory = elementContainsMemory || elementInfo.containsMemoryAccess;
      maxPressure = Math.max(maxPressure, elementInfo.registerPressure);
    }

    return {
      score: Math.min(100, 5 + elementScore),
      registerPressure: maxPressure,
      treeDepth: 1 + maxElementDepth,
      operationCount: node.getElements().length + elementOperations,
      containsCall: elementContainsCall,
      containsMemoryAccess: true, // Array construction is memory operation
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get complexity info for a child expression
   *
   * Returns stored complexity info if available, otherwise calculates
   * a default complexity based on expression type.
   *
   * @param node - Child expression node
   * @returns Complexity info for the child
   */
  protected getChildComplexity(node: ASTNode): ComplexityInfo {
    // Try to get stored complexity info
    if (isExpression(node)) {
      const stored = this.complexityMap.get(node);
      if (stored) {
        return stored;
      }
    }

    // Fallback: calculate based on expression type
    if (isLiteralExpression(node)) {
      return this.calculateLiteralComplexity(node);
    }
    if (isIdentifierExpression(node)) {
      return this.calculateIdentifierComplexity(node);
    }

    // Default for unknown expressions
    return {
      score: 5,
      registerPressure: 1,
      treeDepth: 1,
      operationCount: 1,
      containsCall: false,
      containsMemoryAccess: false,
    };
  }

  /**
   * Store complexity info for an expression and set AST metadata
   *
   * @param node - Expression node
   * @param info - Complexity info to store
   */
  protected storeComplexityInfo(node: Expression, info: ComplexityInfo): void {
    // Store in our map
    this.complexityMap.set(node, info);

    // Initialize metadata map if needed
    if (!(node as any).metadata) {
      (node as any).metadata = new Map<string, unknown>();
    }

    const metadata = (node as any).metadata as Map<string, unknown>;

    // Set all complexity metadata
    metadata.set(OptimizationMetadataKey.ExprComplexityScore, info.score);
    metadata.set(OptimizationMetadataKey.ExprRegisterPressure, info.registerPressure);
    metadata.set(OptimizationMetadataKey.ExprTreeDepth, info.treeDepth);
    metadata.set(OptimizationMetadataKey.ExprOperationCount, info.operationCount);
    metadata.set(OptimizationMetadataKey.ExprContainsCall, info.containsCall);
    metadata.set(OptimizationMetadataKey.ExprContainsMemoryAccess, info.containsMemoryAccess);
  }

  // ============================================
  // PUBLIC QUERY METHODS
  // ============================================

  /**
   * Get all expressions with high complexity (score >= threshold)
   *
   * Useful for identifying expressions that may need special handling
   * during code generation (e.g., temporary storage, register spilling).
   *
   * @param threshold - Minimum complexity score (default: 50)
   * @returns Array of [expression, info] pairs sorted by complexity descending
   */
  public getHighComplexityExpressions(threshold: number = 50): Array<[Expression, ComplexityInfo]> {
    const results: Array<[Expression, ComplexityInfo]> = [];

    for (const [expr, info] of this.complexityMap) {
      if (info.score >= threshold) {
        results.push([expr, info]);
      }
    }

    // Sort by complexity descending
    results.sort((a, b) => b[1].score - a[1].score);

    return results;
  }

  /**
   * Get all expressions that need register spilling
   *
   * On the 6502, if register pressure exceeds 2, we likely need to
   * spill values to zero-page or stack for intermediate storage.
   *
   * @returns Array of [expression, info] pairs that need spilling
   */
  public getExpressionsNeedingSpill(): Array<[Expression, ComplexityInfo]> {
    const results: Array<[Expression, ComplexityInfo]> = [];

    for (const [expr, info] of this.complexityMap) {
      if (info.registerPressure > 2) {
        results.push([expr, info]);
      }
    }

    return results;
  }

  /**
   * Get all expressions containing function calls
   *
   * Expressions with function calls require special handling:
   * - Save registers before call
   * - Restore after call
   * - Handle return value
   *
   * @returns Array of [expression, info] pairs containing calls
   */
  public getExpressionsWithCalls(): Array<[Expression, ComplexityInfo]> {
    const results: Array<[Expression, ComplexityInfo]> = [];

    for (const [expr, info] of this.complexityMap) {
      if (info.containsCall) {
        results.push([expr, info]);
      }
    }

    return results;
  }

  /**
   * Get all expressions containing memory accesses
   *
   * Expressions with memory accesses may need:
   * - Addressing mode selection
   * - Index register allocation
   * - Potential page-crossing cycle penalty
   *
   * @returns Array of [expression, info] pairs with memory access
   */
  public getExpressionsWithMemoryAccess(): Array<[Expression, ComplexityInfo]> {
    const results: Array<[Expression, ComplexityInfo]> = [];

    for (const [expr, info] of this.complexityMap) {
      if (info.containsMemoryAccess) {
        results.push([expr, info]);
      }
    }

    return results;
  }

  /**
   * Get complexity summary statistics
   *
   * Provides an overview of expression complexity across the program.
   * Useful for optimization reports and debugging.
   *
   * @returns Summary statistics
   */
  public getComplexitySummary(): {
    totalExpressions: number;
    averageScore: number;
    maxScore: number;
    averageDepth: number;
    maxDepth: number;
    expressionsWithCalls: number;
    expressionsWithMemoryAccess: number;
    expressionsNeedingSpill: number;
  } {
    let totalScore = 0;
    let maxScore = 0;
    let totalDepth = 0;
    let maxDepth = 0;
    let withCalls = 0;
    let withMemory = 0;
    let needSpill = 0;

    for (const [_expr, info] of this.complexityMap) {
      totalScore += info.score;
      maxScore = Math.max(maxScore, info.score);
      totalDepth += info.treeDepth;
      maxDepth = Math.max(maxDepth, info.treeDepth);
      if (info.containsCall) withCalls++;
      if (info.containsMemoryAccess) withMemory++;
      if (info.registerPressure > 2) needSpill++;
    }

    const count = this.complexityMap.size;

    return {
      totalExpressions: count,
      averageScore: count > 0 ? Math.round(totalScore / count) : 0,
      maxScore,
      averageDepth: count > 0 ? Math.round(totalDepth / count) : 0,
      maxDepth,
      expressionsWithCalls: withCalls,
      expressionsWithMemoryAccess: withMemory,
      expressionsNeedingSpill: needSpill,
    };
  }
}