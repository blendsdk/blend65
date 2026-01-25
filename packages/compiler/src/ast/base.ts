/**
 * AST Base Types for Blend65 Compiler
 *
 * This module contains the foundational types and classes for the
 * Abstract Syntax Tree (AST) used throughout the compiler.
 */

import { SourcePosition } from '../lexer/types.js';

// Import TypeInfo for expression type annotation
import type { TypeInfo } from '../semantic/types.js';

// Import concrete node types for visitor interface
// Note: This creates a circular dependency (base → nodes → base)
// which is resolved at runtime because visitor interface only uses types
import type {
  ArrayLiteralExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ContinueStatement,
  EnumDecl,
  ExplicitStructMapDecl,
  ExportDecl,
  ExpressionStatement,
  ForStatement,
  FunctionDecl,
  IdentifierExpression,
  IfStatement,
  ImportDecl,
  IndexExpression,
  LiteralExpression,
  MatchStatement,
  MemberExpression,
  ModuleDecl,
  Program,
  RangeMapDecl,
  ReturnStatement,
  SequentialStructMapDecl,
  SimpleMapDecl,
  TypeDecl,
  UnaryExpression,
  VariableDecl,
  WhileStatement,
} from './nodes.js';

/**
 * Source location information for god-level error reporting
 *
 * Tracks exact position in source for:
 * - Error messages ("Error at line 5, column 12")
 * - Debug info generation (source maps for debugger)
 * - IDE features (go-to-definition, hover tooltips)
 * - Source code transformations (preserving location)
 *
 * Design: We reuse SourcePosition from the lexer since tokens
 * already have this information. AST nodes span from one position
 * to another (start to end).
 */
export interface SourceLocation {
  /** Starting position of this AST node in source */
  start: SourcePosition;

  /** Ending position of this AST node in source */
  end: SourcePosition;

  /**
   * Optional: source file path or name
   * Used for error messages to show which file the error occurred in
   * Example: "Error in main.blend at line 5, column 12"
   */
  file?: string;

  /**
   * Optional: actual source text for this node
   * Useful for error messages showing exact code
   * Example: "You wrote 'functino' - did you mean 'function'?"
   */
  source?: string;
}

/**
 * Node type discriminator for type-safe AST traversal
 *
 * Every concrete AST node must have a unique type from this enum.
 * This enables:
 * - Type discrimination (knowing what kind of node you have)
 * - Visitor pattern routing (calling the correct visitor method)
 * - Pattern matching in switch statements
 * - Debugging (readable node type names)
 *
 * Design note: We use string literals instead of numeric values
 * for better debugging and serialization.
 */
export enum ASTNodeType {
  // ============================================
  // PROGRAM STRUCTURE
  // ============================================

  /**
   * Root node of the entire program
   * Contains module declaration and all top-level declarations
   */
  PROGRAM = 'Program',

  /**
   * Module declaration (e.g., "module Game.Main")
   * Can be explicit or implicitly "module global"
   */
  MODULE = 'Module',

  // ============================================
  // DECLARATIONS
  // ============================================

  /**
   * Import declaration
   * e.g., "import foo, bar from some.lib"
   */
  IMPORT_DECL = 'ImportDecl',

  /**
   * Export wrapper for declarations
   * e.g., "export function main(): void"
   */
  EXPORT_DECL = 'ExportDecl',

  /**
   * Function declaration
   * e.g., "function doSomething(): void"
   */
  FUNCTION_DECL = 'FunctionDecl',

  /**
   * Variable declaration
   * e.g., "@zp let counter: byte = 0"
   */
  VARIABLE_DECL = 'VariableDecl',

  /**
   * Type alias declaration
   * e.g., "type SpriteId = byte"
   */
  TYPE_DECL = 'TypeDecl',

  /**
   * Enum declaration
   * e.g., "enum Direction { UP, DOWN, LEFT, RIGHT }"
   */
  ENUM_DECL = 'EnumDecl',

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Simple memory-mapped declaration
   * e.g., "@map vicBorderColor at $D020: byte;"
   */
  SIMPLE_MAP_DECL = 'SimpleMapDecl',

  /**
   * Range memory-mapped declaration
   * e.g., "@map spriteRegisters from $D000 to $D02E: byte;"
   */
  RANGE_MAP_DECL = 'RangeMapDecl',

  /**
   * Sequential struct memory-mapped declaration
   * e.g., "@map sid at $D400 type ... end @map"
   */
  SEQUENTIAL_STRUCT_MAP_DECL = 'SequentialStructMapDecl',

  /**
   * Explicit struct memory-mapped declaration
   * e.g., "@map vic at $D000 layout ... end @map"
   */
  EXPLICIT_STRUCT_MAP_DECL = 'ExplicitStructMapDecl',

  // ============================================
  // EXPRESSIONS
  // ============================================

  /**
   * Binary expression (two operands with operator)
   * e.g., "2 + 3", "x * y", "a && b"
   */
  BINARY_EXPR = 'BinaryExpression',

  /**
   * Unary expression (one operand with operator)
   * e.g., "-x", "!flag", "~mask"
   */
  UNARY_EXPR = 'UnaryExpression',

  /**
   * Literal expression (constant value)
   * e.g., 42, "hello", true, $D000
   */
  LITERAL_EXPR = 'LiteralExpression',

  /**
   * Identifier expression (variable/function reference)
   * e.g., "counter", "myFunction"
   */
  IDENTIFIER_EXPR = 'IdentifierExpression',

  /**
   * Call expression (function invocation)
   * e.g., "doSomething()", "add(1, 2)"
   */
  CALL_EXPR = 'CallExpression',

  /**
   * Index expression (array access)
   * e.g., "array[0]", "sprites[i]"
   */
  INDEX_EXPR = 'IndexExpression',

  /**
   * Member expression (property access)
   * e.g., "player.health", "Game.score"
   */
  MEMBER_EXPR = 'MemberExpression',

  /**
   * Assignment expression
   * e.g., "x = 5", "counter += 1"
   */
  ASSIGNMENT_EXPR = 'AssignmentExpression',

  /**
   * Array literal expression
   * e.g., "[1, 2, 3]", "[[1, 2], [3, 4]]"
   */
  ARRAY_LITERAL_EXPR = 'ArrayLiteralExpression',

  // ============================================
  // STATEMENTS
  // ============================================

  /**
   * Return statement
   * e.g., "return 42", "return"
   */
  RETURN_STMT = 'ReturnStatement',

  /**
   * If statement (conditional)
   * e.g., "if x > 0 then ... end if"
   */
  IF_STMT = 'IfStatement',

  /**
   * While loop statement
   * e.g., "while running ... end while"
   */
  WHILE_STMT = 'WhileStatement',

  /**
   * For loop statement
   * e.g., "for i = 0 to 10 ... next i"
   */
  FOR_STMT = 'ForStatement',

  /**
   * Match statement (pattern matching)
   * e.g., "match value case 1: ... end match"
   */
  MATCH_STMT = 'MatchStatement',

  /**
   * Break statement (exit loop)
   * e.g., "break"
   */
  BREAK_STMT = 'BreakStatement',

  /**
   * Continue statement (next iteration)
   * e.g., "continue"
   */
  CONTINUE_STMT = 'ContinueStatement',

  /**
   * Expression statement (expression used as statement)
   * e.g., "doSomething()", "x = 5"
   */
  EXPR_STMT = 'ExpressionStatement',

  /**
   * Block statement (sequence of statements)
   * Used inside functions, if statements, loops, etc.
   */
  BLOCK_STMT = 'BlockStatement',
}

// Forward declarations removed - actual implementations are in nodes.ts

/**
 * Abstract base class for all AST nodes in Blend65 compiler
 *
 * Design philosophy:
 * - **Immutable structure**: readonly fields for tree shape (never changes)
 * - **Mutable metadata**: type info, optimization data added later
 * - **Rich source tracking**: for god-level error messages and debugging
 * - **Visitor pattern**: for traversal and transformation
 *
 * Every concrete node class must:
 * 1. Call super() with appropriate node type
 * 2. Store its specific data (operands, names, etc.)
 * 3. Implement accept() to call the right visitor method
 *
 * Example inheritance chain:
 * ASTNode → Expression → BinaryExpression
 * ASTNode → Statement → IfStatement
 * ASTNode → Declaration → FunctionDecl
 *
 * @example
 * ```typescript
 * class BinaryExpression extends Expression {
 *   constructor(
 *     left: Expression,
 *     operator: TokenType,
 *     right: Expression,
 *     location: SourceLocation
 *   ) {
 *     super(ASTNodeType.BINARY_EXPR, location);
 *     this.left = left;
 *     this.operator = operator;
 *     this.right = right;
 *   }
 *
 *   public accept<R>(visitor: ASTVisitor<R>): R {
 *     return visitor.visitBinaryExpression(this);
 *   }
 * }
 * ```
 */
export abstract class ASTNode {
  /**
   * Discriminator for type-safe pattern matching
   *
   * Each concrete node class sets this to its specific type.
   * Used by:
   * - Visitor pattern (routing to correct method)
   * - Switch statements (pattern matching)
   * - Type guards (is this a BinaryExpression?)
   * - Debugging (console.log shows readable type name)
   */
  protected readonly nodeType: ASTNodeType;

  /**
   * Source location for error reporting and debugging
   *
   * Tracks where in the source code this node came from.
   * Used by:
   * - Error messages (showing exact line/column)
   * - IDE features (go-to-definition, hover)
   * - Source maps (debugging compiled code)
   * - Transformations (preserving location metadata)
   */
  protected readonly location: SourceLocation;

  /**
   * Metadata storage for analysis passes (Phase 8+)
   *
   * Stores optimization metadata generated by advanced analysis passes.
   * Pattern: Map<string, unknown> for flexible metadata storage.
   *
   * Used by:
   * - Phase 8: Advanced analysis (definite assignment, dead code, etc.)
   * - IL generator: Optimization hints for code generation
   * - Diagnostics: Warnings and optimization suggestions
   *
   * Keys should use OptimizationMetadataKey enum for type safety.
   */
  public metadata?: Map<string, unknown>;

  /**
   * Constructs a new AST node
   *
   * This constructor is called by all subclasses via super().
   * It initializes the two fundamental properties every node has.
   *
   * @param nodeType - The specific type of this node (from ASTNodeType enum)
   * @param location - Source location information
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    this.nodeType = nodeType;
    this.location = location;
  }

  /**
   * Gets the node type discriminator
   *
   * Public accessor for the node type. Used for:
   * - Type checking (if (node.getNodeType() === ASTNodeType.BINARY_EXPR))
   * - Pattern matching in switch statements
   * - Visitor pattern routing
   *
   * @returns The node type from ASTNodeType enum
   */
  public getNodeType(): ASTNodeType {
    return this.nodeType;
  }

  /**
   * Gets the source location of this node
   *
   * Public accessor for location information. Used for:
   * - Error reporting (showing where error occurred)
   * - IDE features (highlighting, tooltips)
   * - Debugging (tracing back to source)
   *
   * @returns The source location with start/end positions
   */
  public getLocation(): SourceLocation {
    return this.location;
  }

  /**
   * Accept a visitor for traversal/transformation
   *
   * This is the core of the Visitor pattern. Each concrete node
   * implements this to call the appropriate visitor method.
   *
   * Why visitor pattern?
   * - Separate tree structure from operations on it
   * - Easy to add new operations (just create new visitor)
   * - Type-safe dispatch (TypeScript knows which method to call)
   * - Used by all major compilers (LLVM, GCC, TypeScript, Rust)
   *
   * How it works:
   * 1. Caller passes a visitor to accept()
   * 2. Node calls the visitor method for its type
   * 3. Visitor performs operation and returns result
   *
   * Example operations via visitors:
   * - Type checking (returns TypeInfo)
   * - Pretty printing (returns string)
   * - Optimization (returns optimized Node)
   * - Code generation (returns Assembly)
   *
   * @param visitor - The visitor to accept
   * @returns Result of the visit operation (type R is generic)
   */
  public abstract accept<R>(visitor: ASTVisitor<R>): R;
}

/**
 * Abstract base class for all expression nodes
 *
 * Expressions are AST nodes that:
 * - Produce a value (have a type: byte, word, string, etc.)
 * - Can be used in larger expressions
 * - Can appear on right side of assignment
 * - Can be passed as function arguments
 *
 * Examples:
 * - Literals: 42, "hello", true, $D000
 * - Identifiers: counter, myFunction
 * - Binary ops: 2 + 3, x * y, a && b
 * - Function calls: doSomething(), add(1, 2)
 * - Array access: sprites[0], buffer[i]
 *
 * Design: Expressions extend ASTNode but don't add new fields.
 * This intermediate class exists for:
 * - Type hierarchy (is this an Expression?)
 * - Future: Type information (getType() method)
 * - Semantic analysis (type checking pass)
 */
export abstract class Expression extends ASTNode {
  /**
   * Constructs an expression node
   *
   * Simply forwards to ASTNode constructor.
   * Concrete expression classes call this via super().
   *
   * @param nodeType - The specific expression type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }

  /**
   * Optional: Type information for this expression
   *
   * Set during semantic analysis phase.
   * Examples: TypeInfo { kind: TypeKind.Byte }, TypeInfo { kind: TypeKind.Word }
   *
   * Design note: Mutable metadata (not part of tree structure).
   * The parser doesn't set this - the semantic analyzer does.
   */
  public typeInfo?: TypeInfo;

  /**
   * Gets the type of this expression (if analyzed)
   *
   * Returns undefined until semantic analysis runs.
   * After analysis, contains the expression's type.
   *
   * @returns Type information or undefined
   */
  public getTypeInfo(): TypeInfo | undefined {
    return this.typeInfo;
  }

  /**
   * Sets the type of this expression
   *
   * Called during semantic analysis to annotate the expression with its resolved type.
   *
   * @param type - The resolved type information
   */
  public setTypeInfo(type: TypeInfo): void {
    this.typeInfo = type;
  }
}

/**
 * Abstract base class for all statement nodes
 *
 * Statements are AST nodes that:
 * - Perform actions (don't produce values)
 * - Control program flow (if, while, for, return, etc.)
 * - Can appear in function bodies and blocks
 * - Execute sequentially (one after another)
 *
 * Examples:
 * - Return: return 42, return
 * - Control flow: if..., while..., for...
 * - Jumps: break, continue
 * - Expression statements: foo(), x = 5
 *
 * Design: Statements extend ASTNode but don't add new fields.
 * This intermediate class exists for:
 * - Type hierarchy (is this a Statement?)
 * - Future: Control flow analysis
 * - Code generation (statements → assembly blocks)
 */
export abstract class Statement extends ASTNode {
  /**
   * Constructs a statement node
   *
   * Simply forwards to ASTNode constructor.
   * Concrete statement classes call this via super().
   *
   * @param nodeType - The specific statement type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }
}

/**
 * Abstract base class for all declaration nodes
 *
 * Declarations are special statements that:
 * - Introduce new names into scope (variables, functions, types, etc.)
 * - Can be exported (visible to other modules)
 * - Appear at module scope or inside functions
 * - Create symbol table entries
 *
 * Examples:
 * - Variables: @zp let counter: byte = 0
 * - Functions: function main(): void
 * - Types: type SpriteId = byte
 * - Enums: enum Direction { UP, DOWN }
 * - Modules: module Game.Main
 * - Imports: import foo from bar
 *
 * Design: Declarations extend Statement (they can execute).
 * Examples of executable declarations:
 * - Variable with initializer: let x = computeValue()
 * - Function declaration (defines code to execute later)
 */
export abstract class Declaration extends Statement {
  /**
   * Constructs a declaration node
   *
   * Simply forwards to Statement constructor (which forwards to ASTNode).
   * Concrete declaration classes call this via super().
   *
   * @param nodeType - The specific declaration type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }
}

/**
 * Visitor interface for AST traversal and transformation
 *
 * The Visitor pattern enables operations on AST without modifying node classes.
 * Each visitor method corresponds to a concrete node type and defines what
 * operation to perform on that type of node.
 *
 * How to use:
 * 1. Create a class that implements ASTVisitor<R>
 * 2. Implement a visit method for each node type
 * 3. Call node.accept(yourVisitor) to perform the operation
 * 4. The node calls back to the appropriate visit method
 * 5. Your visitor method returns result of type R
 *
 * Example visitors:
 * - ASTVisitor<string> for pretty printing
 * - ASTVisitor<TypeInfo> for type checking
 * - ASTVisitor<ASTNode> for transformations (optimization)
 * - ASTVisitor<Assembly> for code generation
 * - ASTVisitor<void> for analysis (no return value needed)
 *
 * Generic type R:
 * - The return type of all visit methods
 * - Varies by operation (string, TypeInfo, Node, void, etc.)
 * - Enforced by TypeScript (type safety!)
 *
 * @template R The return type of all visit methods
 *
 * @example
 * ```typescript
 * class PrettyPrinter implements ASTVisitor<string> {
 *   visitBinaryExpression(node: BinaryExpression): string {
 *     const left = node.getLeft().accept(this);
 *     const right = node.getRight().accept(this);
 *     return `(${node.getOperator()} ${left} ${right})`;
 *   }
 *   // ... implement all other visit methods
 * }
 *
 * const ast: Expression = parser.parse("2 + 3");
 * const printer = new PrettyPrinter();
 * const output = ast.accept(printer); // Returns "(+ 2 3)"
 * ```
 */
export interface ASTVisitor<R> {
  // ============================================
  // PROGRAM STRUCTURE
  // ============================================

  /**
   * Visit a Program node (root of AST)
   * @param node - The program node to visit
   * @returns Result of visiting this node
   */
  visitProgram(node: Program): R;

  /**
   * Visit a Module declaration
   * @param node - The module node to visit
   * @returns Result of visiting this node
   */
  visitModule(node: ModuleDecl): R;

  // ============================================
  // IMPORT/EXPORT
  // ============================================

  /**
   * Visit an Import declaration
   * @param node - The import node to visit
   * @returns Result of visiting this node
   */
  visitImportDecl(node: ImportDecl): R;

  /**
   * Visit an Export declaration
   * @param node - The export node to visit
   * @returns Result of visiting this node
   */
  visitExportDecl(node: ExportDecl): R;

  // ============================================
  // DECLARATIONS
  // ============================================

  /**
   * Visit a Function declaration
   * @param node - The function declaration to visit
   * @returns Result of visiting this node
   */
  visitFunctionDecl(node: FunctionDecl): R;

  /**
   * Visit a Variable declaration
   * @param node - The variable declaration to visit
   * @returns Result of visiting this node
   */
  visitVariableDecl(node: VariableDecl): R;

  /**
   * Visit a Type alias declaration
   * @param node - The type declaration to visit
   * @returns Result of visiting this node
   */
  visitTypeDecl(node: TypeDecl): R;

  /**
   * Visit an Enum declaration
   * @param node - The enum declaration to visit
   * @returns Result of visiting this node
   */
  visitEnumDecl(node: EnumDecl): R;

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Visit a Simple memory-mapped declaration
   * @param node - The simple @map declaration to visit
   * @returns Result of visiting this node
   */
  visitSimpleMapDecl(node: SimpleMapDecl): R;

  /**
   * Visit a Range memory-mapped declaration
   * @param node - The range @map declaration to visit
   * @returns Result of visiting this node
   */
  visitRangeMapDecl(node: RangeMapDecl): R;

  /**
   * Visit a Sequential struct memory-mapped declaration
   * @param node - The sequential struct @map declaration to visit
   * @returns Result of visiting this node
   */
  visitSequentialStructMapDecl(node: SequentialStructMapDecl): R;

  /**
   * Visit an Explicit struct memory-mapped declaration
   * @param node - The explicit struct @map declaration to visit
   * @returns Result of visiting this node
   */
  visitExplicitStructMapDecl(node: ExplicitStructMapDecl): R;

  // ============================================
  // EXPRESSIONS
  // ============================================

  /**
   * Visit a Binary expression (e.g., 2 + 3, x * y)
   * @param node - The binary expression to visit
   * @returns Result of visiting this node
   */
  visitBinaryExpression(node: BinaryExpression): R;

  /**
   * Visit a Unary expression (e.g., -x, !flag)
   * @param node - The unary expression to visit
   * @returns Result of visiting this node
   */
  visitUnaryExpression(node: UnaryExpression): R;

  /**
   * Visit a Literal expression (e.g., 42, "hello", true)
   * @param node - The literal expression to visit
   * @returns Result of visiting this node
   */
  visitLiteralExpression(node: LiteralExpression): R;

  /**
   * Visit an Identifier expression (e.g., counter, myFunc)
   * @param node - The identifier expression to visit
   * @returns Result of visiting this node
   */
  visitIdentifierExpression(node: IdentifierExpression): R;

  /**
   * Visit a Call expression (e.g., foo(), add(1, 2))
   * @param node - The call expression to visit
   * @returns Result of visiting this node
   */
  visitCallExpression(node: CallExpression): R;

  /**
   * Visit an Index expression (e.g., array[0], sprites[i])
   * @param node - The index expression to visit
   * @returns Result of visiting this node
   */
  visitIndexExpression(node: IndexExpression): R;

  /**
   * Visit a Member expression (e.g., obj.property)
   * @param node - The member expression to visit
   * @returns Result of visiting this node
   */
  visitMemberExpression(node: MemberExpression): R;

  /**
   * Visit an Assignment expression (e.g., x = 5, counter += 1)
   * @param node - The assignment expression to visit
   * @returns Result of visiting this node
   */
  visitAssignmentExpression(node: AssignmentExpression): R;

  /**
   * Visit an Array literal expression (e.g., [1, 2, 3], [[1, 2], [3, 4]])
   * @param node - The array literal expression to visit
   * @returns Result of visiting this node
   */
  visitArrayLiteralExpression(node: ArrayLiteralExpression): R;

  // ============================================
  // STATEMENTS
  // ============================================

  /**
   * Visit a Return statement
   * @param node - The return statement to visit
   * @returns Result of visiting this node
   */
  visitReturnStatement(node: ReturnStatement): R;

  /**
   * Visit an If statement
   * @param node - The if statement to visit
   * @returns Result of visiting this node
   */
  visitIfStatement(node: IfStatement): R;

  /**
   * Visit a While statement
   * @param node - The while statement to visit
   * @returns Result of visiting this node
   */
  visitWhileStatement(node: WhileStatement): R;

  /**
   * Visit a For statement
   * @param node - The for statement to visit
   * @returns Result of visiting this node
   */
  visitForStatement(node: ForStatement): R;

  /**
   * Visit a Match statement
   * @param node - The match statement to visit
   * @returns Result of visiting this node
   */
  visitMatchStatement(node: MatchStatement): R;

  /**
   * Visit a Break statement
   * @param node - The break statement to visit
   * @returns Result of visiting this node
   */
  visitBreakStatement(node: BreakStatement): R;

  /**
   * Visit a Continue statement
   * @param node - The continue statement to visit
   * @returns Result of visiting this node
   */
  visitContinueStatement(node: ContinueStatement): R;

  /**
   * Visit an Expression statement
   * @param node - The expression statement to visit
   * @returns Result of visiting this node
   */
  visitExpressionStatement(node: ExpressionStatement): R;

  /**
   * Visit a Block statement
   * @param node - The block statement to visit
   * @returns Result of visiting this node
   */
  visitBlockStatement(node: BlockStatement): R;
}