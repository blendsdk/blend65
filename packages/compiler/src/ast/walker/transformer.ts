/**
 * AST Transformer Infrastructure for Blend65 Compiler
 *
 * Provides reusable, type-safe AST transformation with immutable node replacement.
 * Unlike ASTWalker (which returns void), ASTTransformer returns modified AST nodes.
 *
 * Used for:
 * - Optimization passes (constant folding, dead code elimination)
 * - Desugaring (expanding syntactic sugar into basic forms)
 * - Code transformations (inlining, loop unrolling)
 * - AST normalization (converting to canonical form)
 */

import { ASTVisitor, ASTNode, Declaration, Expression, Statement } from '../base.js';
import {
  Program,
  ModuleDecl,
  ImportDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  TypeDecl,
  EnumDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  BinaryExpression,
  UnaryExpression,
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ArrayLiteralExpression,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
} from '../nodes.js';

/**
 * Base AST transformer for immutable tree transformations
 *
 * Implements the Visitor pattern with node replacement semantics.
 * Each visit method returns a potentially modified node.
 *
 * **Design Philosophy:**
 * - **Immutable transformations**: Returns new nodes, never modifies existing
 * - **Identity by default**: Returns same node if no transformation needed
 * - **Composable**: Multiple transformers can be chained
 * - **Type-safe**: TypeScript ensures correct node types
 *
 * **Key Differences from ASTWalker:**
 * - Returns `ASTNode` instead of `void`
 * - Automatically transforms children recursively
 * - Can replace entire subtrees
 * - Maintains structural sharing (unchanged nodes reused)
 *
 * **Usage Pattern:**
 * ```typescript
 * class ConstantFolder extends ASTTransformer {
 *   visitBinaryExpression(node: BinaryExpression): Expression {
 *     // First transform children
 *     const left = node.getLeft().accept(this) as Expression;
 *     const right = node.getRight().accept(this) as Expression;
 *
 *     // Then perform optimization
 *     if (isLiteral(left) && isLiteral(right)) {
 *       return computeConstant(left, node.getOperator(), right);
 *     }
 *
 *     // Return modified or original node
 *     return left === node.getLeft() && right === node.getRight()
 *       ? node
 *       : new BinaryExpression(left, node.getOperator(), right, node.getLocation());
 *   }
 * }
 *
 * const folder = new ConstantFolder();
 * const optimized = program.accept(folder); // Returns new optimized AST
 * ```
 *
 * **Transformation Strategies:**
 *
 * 1. **Identity transformation** (default):
 *    - Return original node unchanged
 *    - Used when no transformation needed
 *
 * 2. **Shallow transformation**:
 *    - Transform node properties, reuse children
 *    - Example: Rename variables
 *
 * 3. **Deep transformation**:
 *    - Transform children recursively
 *    - Example: Constant folding
 *
 * 4. **Structural transformation**:
 *    - Replace entire subtree with different structure
 *    - Example: Desugar for-loops into while-loops
 *
 * **Performance Notes:**
 * - Structural sharing minimizes memory allocation
 * - Only creates new nodes when transformation occurs
 * - Efficient for large ASTs with localized changes
 */
export abstract class ASTTransformer implements ASTVisitor<ASTNode> {
  /**
   * Transform entire AST starting from root node
   *
   * Entry point for transformation. Returns potentially modified AST.
   * Original AST remains unchanged (immutable semantics).
   *
   * @param node - Root node to transform
   * @returns Transformed AST (may be original if unchanged)
   *
   * @example
   * ```typescript
   * const transformer = new MyTransformer();
   * const originalAST = parser.parse(source);
   * const transformedAST = transformer.transform(originalAST);
   * // originalAST remains unchanged
   * ```
   */
  public transform(node: ASTNode): ASTNode {
    return node.accept(this);
  }

  // ============================================
  // VISITOR METHODS WITH DEFAULT IDENTITY
  // ============================================
  //
  // Each visit method follows this pattern:
  // 1. Transform children recursively
  // 2. Check if any child changed
  // 3. If changed, create new node with transformed children
  // 4. If unchanged, return original node (structural sharing)
  //
  // Default implementation: Identity transformation (return node as-is)
  // Subclasses override methods to perform actual transformations

  /**
   * Transform Program node (root of AST)
   *
   * Default: Recursively transforms all declarations
   * Override to transform program structure
   *
   * @param node - Program node to transform
   * @returns Transformed program node
   */
  visitProgram(node: Program): ASTNode {
    // Transform module and declarations
    const module = node.getModule().accept(this);
    const declarations = node.getDeclarations().map(decl => decl.accept(this));

    // Check if anything changed
    const moduleChanged = module !== node.getModule();
    const declsChanged = declarations.some((decl, i) => decl !== node.getDeclarations()[i]);

    // Return original if nothing changed, new Program if changed
    if (!moduleChanged && !declsChanged) {
      return node;
    }

    return new Program(module as ModuleDecl, declarations as Declaration[], node.getLocation());
  }

  /**
   * Transform Module declaration
   *
   * Default: Identity transformation
   * Override to transform module properties
   *
   * @param node - Module node to transform
   * @returns Transformed module node
   */
  visitModule(node: ModuleDecl): ASTNode {
    return node;
  }

  /**
   * Transform Import declaration
   *
   * Default: Identity transformation
   * Override to transform import properties
   *
   * @param node - Import node to transform
   * @returns Transformed import node
   */
  visitImportDecl(node: ImportDecl): ASTNode {
    return node;
  }

  /**
   * Transform Export declaration
   *
   * Default: Identity transformation
   * Override to transform exported declaration
   *
   * @param node - Export node to transform
   * @returns Transformed export node
   */
  visitExportDecl(node: ExportDecl): ASTNode {
    return node;
  }

  /**
   * Transform Variable declaration
   *
   * Default: Recursively transforms initializer
   * Override to transform initializer or properties
   *
   * @param node - Variable node to transform
   * @returns Transformed variable node
   */
  visitVariableDecl(node: VariableDecl): ASTNode {
    // Transform initializer if present
    const initializer = node.getInitializer();
    if (!initializer) {
      return node;
    }

    const transformedInit = initializer.accept(this) as Expression;

    // Return original if nothing changed
    if (transformedInit === initializer) {
      return node;
    }

    // Create new VariableDecl with transformed initializer
    return new VariableDecl(
      node.getName(),
      node.getTypeAnnotation(),
      transformedInit,
      node.getLocation(),
      node.getStorageClass(),
      node.isConst(),
      node.isExportedVariable()
    );
  }

  /**
   * Transform Type declaration
   *
   * Default: Identity transformation
   * Override to transform type properties
   *
   * @param node - Type node to transform
   * @returns Transformed type node
   */
  visitTypeDecl(node: TypeDecl): ASTNode {
    return node;
  }

  /**
   * Transform Enum declaration
   *
   * Default: Identity transformation
   * Override to transform enum properties
   *
   * @param node - Enum node to transform
   * @returns Transformed enum node
   */
  visitEnumDecl(node: EnumDecl): ASTNode {
    return node;
  }

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Transform Simple @map declaration
   *
   * Default: Identity transformation
   *
   * @param node - Simple map node to transform
   * @returns Transformed map node
   */
  visitSimpleMapDecl(node: SimpleMapDecl): ASTNode {
    return node;
  }

  /**
   * Transform Range @map declaration
   *
   * Default: Identity transformation
   *
   * @param node - Range map node to transform
   * @returns Transformed map node
   */
  visitRangeMapDecl(node: RangeMapDecl): ASTNode {
    return node;
  }

  /**
   * Transform Sequential struct @map declaration
   *
   * Default: Identity transformation
   *
   * @param node - Sequential map node to transform
   * @returns Transformed map node
   */
  visitSequentialStructMapDecl(node: SequentialStructMapDecl): ASTNode {
    return node;
  }

  /**
   * Transform Explicit struct @map declaration
   *
   * Default: Identity transformation
   *
   * @param node - Explicit map node to transform
   * @returns Transformed map node
   */
  visitExplicitStructMapDecl(node: ExplicitStructMapDecl): ASTNode {
    return node;
  }

  // ============================================
  // EXPRESSIONS
  // ============================================

  /**
   * Transform Binary expression
   *
   * Default: Recursively transforms left and right operands
   * Override to transform operands or perform optimizations
   *
   * Example transformation (constant folding):
   * ```typescript
   * visitBinaryExpression(node: BinaryExpression): ASTNode {
   *   const left = super.visitBinaryExpression(node).getLeft();
   *   const right = node.getRight().accept(this) as Expression;
   *
   *   // Optimization: fold constant expressions
   *   if (isLiteral(left) && isLiteral(right)) {
   *     return foldConstants(left, node.getOperator(), right);
   *   }
   *
   *   return node;
   * }
   * ```
   *
   * @param node - Binary expression to transform
   * @returns Transformed expression
   */
  visitBinaryExpression(node: BinaryExpression): ASTNode {
    // Transform operands
    const left = node.getLeft().accept(this) as Expression;
    const right = node.getRight().accept(this) as Expression;

    // Return original if nothing changed
    if (left === node.getLeft() && right === node.getRight()) {
      return node;
    }

    // Create new BinaryExpression with transformed operands
    return new BinaryExpression(left, node.getOperator(), right, node.getLocation());
  }

  /**
   * Transform Unary expression
   *
   * Default: Identity transformation
   * Override to transform operand or perform optimizations
   *
   * @param node - Unary expression to transform
   * @returns Transformed expression
   */
  visitUnaryExpression(node: UnaryExpression): ASTNode {
    return node;
  }

  /**
   * Transform Literal expression
   *
   * Default: Identity transformation
   * Override to transform literal values
   *
   * @param node - Literal expression to transform
   * @returns Transformed expression
   */
  visitLiteralExpression(node: LiteralExpression): ASTNode {
    return node;
  }

  /**
   * Transform Identifier expression
   *
   * Default: Identity transformation
   * Override to rename identifiers
   *
   * @param node - Identifier expression to transform
   * @returns Transformed expression
   */
  visitIdentifierExpression(node: IdentifierExpression): ASTNode {
    return node;
  }

  /**
   * Transform Call expression
   *
   * Default: Identity transformation
   * Override to transform callee or arguments
   *
   * @param node - Call expression to transform
   * @returns Transformed expression
   */
  visitCallExpression(node: CallExpression): ASTNode {
    return node;
  }

  /**
   * Transform Index expression
   *
   * Default: Identity transformation
   * Override to transform object or index
   *
   * @param node - Index expression to transform
   * @returns Transformed expression
   */
  visitIndexExpression(node: IndexExpression): ASTNode {
    return node;
  }

  /**
   * Transform Member expression
   *
   * Default: Identity transformation
   * Override to transform object
   *
   * @param node - Member expression to transform
   * @returns Transformed expression
   */
  visitMemberExpression(node: MemberExpression): ASTNode {
    return node;
  }

  /**
   * Transform Assignment expression
   *
   * Default: Identity transformation
   * Override to transform target or value
   *
   * @param node - Assignment expression to transform
   * @returns Transformed expression
   */
  visitAssignmentExpression(node: AssignmentExpression): ASTNode {
    return node;
  }

  /**
   * Transform Array literal expression
   *
   * Default: Identity transformation
   * Override to transform elements
   *
   * @param node - Array literal to transform
   * @returns Transformed expression
   */
  visitArrayLiteralExpression(node: ArrayLiteralExpression): ASTNode {
    return node;
  }

  /**
   * Transform Function declaration
   *
   * Default: Recursively transforms function body (if present)
   * Override to transform function body or properties
   * Handles stub functions (which have no body)
   *
   * @param node - Function node to transform
   * @returns Transformed function node
   */
  visitFunctionDecl(node: FunctionDecl): ASTNode {
    // Handle stub functions (no body)
    const originalBody = node.getBody();
    if (!originalBody) {
      return node; // Stub function - no transformation needed
    }

    // Transform body statements
    const body = originalBody.map(stmt => stmt.accept(this));

    // Check if any statement changed
    const bodyChanged = body.some((stmt, i) => stmt !== originalBody[i]);

    // Return original if nothing changed
    if (!bodyChanged) {
      return node;
    }

    // Create new FunctionDecl with transformed body
    return new FunctionDecl(
      node.getName(),
      node.getParameters(),
      node.getReturnType(),
      body as Statement[],
      node.getLocation(),
      node.isExportedFunction(),
      node.isCallbackFunction(),
      node.isStubFunction()
    );
  }

  // ============================================
  // STATEMENTS
  // ============================================

  /**
   * Transform Return statement
   *
   * Default: Recursively transforms return value
   * Override to transform return value
   *
   * @param node - Return statement to transform
   * @returns Transformed statement
   */
  visitReturnStatement(node: ReturnStatement): ASTNode {
    // Transform return value if present
    const value = node.getValue();
    if (!value) {
      return node;
    }

    const transformedValue = value.accept(this) as Expression;

    // Return original if nothing changed
    if (transformedValue === value) {
      return node;
    }

    // Create new ReturnStatement with transformed value
    return new ReturnStatement(transformedValue, node.getLocation());
  }

  /**
   * Transform If statement
   *
   * Default: Identity transformation
   * Override to transform condition or branches
   *
   * @param node - If statement to transform
   * @returns Transformed statement
   */
  visitIfStatement(node: IfStatement): ASTNode {
    return node;
  }

  /**
   * Transform While statement
   *
   * Default: Identity transformation
   * Override to transform condition or body
   *
   * @param node - While statement to transform
   * @returns Transformed statement
   */
  visitWhileStatement(node: WhileStatement): ASTNode {
    return node;
  }

  /**
   * Transform For statement
   *
   * Default: Identity transformation
   * Override to transform range or body
   *
   * Example: Desugar for-loop into while-loop
   * ```typescript
   * visitForStatement(node: ForStatement): ASTNode {
   *   // Convert: for i = start to end ... next
   *   // Into: i = start; while i <= end ... i = i + 1
   *   return this.desugarForLoop(node);
   * }
   * ```
   *
   * @param node - For statement to transform
   * @returns Transformed statement
   */
  visitForStatement(node: ForStatement): ASTNode {
    return node;
  }

  /**
   * Transform Match statement
   *
   * Default: Identity transformation
   * Override to transform value or cases
   *
   * @param node - Match statement to transform
   * @returns Transformed statement
   */
  visitMatchStatement(node: MatchStatement): ASTNode {
    return node;
  }

  /**
   * Transform Break statement
   *
   * Default: Identity transformation
   * Override to transform break behavior
   *
   * @param node - Break statement to transform
   * @returns Transformed statement
   */
  visitBreakStatement(node: BreakStatement): ASTNode {
    return node;
  }

  /**
   * Transform Continue statement
   *
   * Default: Identity transformation
   * Override to transform continue behavior
   *
   * @param node - Continue statement to transform
   * @returns Transformed statement
   */
  visitContinueStatement(node: ContinueStatement): ASTNode {
    return node;
  }

  /**
   * Transform Expression statement
   *
   * Default: Identity transformation
   * Override to transform wrapped expression
   *
   * @param node - Expression statement to transform
   * @returns Transformed statement
   */
  visitExpressionStatement(node: ExpressionStatement): ASTNode {
    return node;
  }

  /**
   * Transform Block statement
   *
   * Default: Identity transformation
   * Override to transform statements
   *
   * @param node - Block statement to transform
   * @returns Transformed statement
   */
  visitBlockStatement(node: BlockStatement): ASTNode {
    return node;
  }
}
