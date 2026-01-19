/**
 * Concrete AST Node Implementations
 *
 * This module contains all concrete AST node classes that represent
 * specific language constructs in Blend65.
 *
 * Each node:
 * - Extends the appropriate base class (Expression, Statement, Declaration)
 * - Implements the accept() method for visitor pattern
 * - Stores construct-specific data (operands, names, etc.)
 * - Tracks source location for error reporting
 */

import {
  ASTNode,
  ASTNodeType,
  ASTVisitor,
  Declaration,
  Expression,
  SourceLocation,
  Statement,
} from './base.js';
import { TokenType } from '../lexer/types.js';

// ============================================
// PROGRAM STRUCTURE
// ============================================

/**
 * Program node - root of the entire AST
 *
 * Represents a complete Blend65 source file.
 * Contains the module declaration and all top-level declarations.
 */
export class Program extends ASTNode {
  /**
   * Creates a Program node
   * @param module - The module declaration (explicit or implicit)
   * @param declarations - All top-level declarations in the file
   * @param location - Source location
   */
  constructor(
    protected readonly module: ModuleDecl,
    protected readonly declarations: Declaration[],
    location: SourceLocation
  ) {
    super(ASTNodeType.PROGRAM, location);
  }

  public getModule(): ModuleDecl {
    return this.module;
  }

  public getDeclarations(): Declaration[] {
    return this.declarations;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitProgram(this);
  }
}

/**
 * Module declaration node
 *
 * Represents: module Game.Main
 * Can be explicit or implicitly "module global"
 */
export class ModuleDecl extends Declaration {
  /**
   * Creates a Module declaration
   * @param namePath - Module name parts (e.g., ['Game', 'Main'])
   * @param location - Source location
   * @param isImplicit - True if synthesized "module global"
   */
  constructor(
    protected readonly namePath: string[],
    location: SourceLocation,
    protected readonly isImplicit: boolean = false
  ) {
    super(ASTNodeType.MODULE, location);
  }

  public getNamePath(): string[] {
    return this.namePath;
  }

  public getFullName(): string {
    return this.namePath.join('.');
  }

  public isImplicitModule(): boolean {
    return this.isImplicit;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitModule(this);
  }
}

// ============================================
// IMPORT/EXPORT
// ============================================

/**
 * Import declaration node
 *
 * Represents:
 * - import foo from bar.baz
 * - import foo, bar from baz
 * - import * from module
 */
export class ImportDecl extends Declaration {
  /**
   * Creates an Import declaration
   * @param identifiers - Names being imported (empty for wildcard)
   * @param modulePath - Module to import from (e.g., ['bar', 'baz'])
   * @param location - Source location
   * @param isWildcard - True for "import * from ..."
   */
  constructor(
    protected readonly identifiers: string[],
    protected readonly modulePath: string[],
    location: SourceLocation,
    protected readonly isWildcard: boolean = false
  ) {
    super(ASTNodeType.IMPORT_DECL, location);
  }

  public getIdentifiers(): string[] {
    return this.identifiers;
  }

  public getModulePath(): string[] {
    return this.modulePath;
  }

  public getModuleName(): string {
    return this.modulePath.join('.');
  }

  public isWildcardImport(): boolean {
    return this.isWildcard;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitImportDecl(this);
  }
}

/**
 * Export declaration node
 *
 * Wraps another declaration to mark it as exported.
 * Represents: export function foo() ...
 */
export class ExportDecl extends Declaration {
  /**
   * Creates an Export declaration
   * @param declaration - The declaration being exported
   * @param location - Source location
   */
  constructor(
    protected readonly declaration: Declaration,
    location: SourceLocation
  ) {
    super(ASTNodeType.EXPORT_DECL, location);
  }

  public getDeclaration(): Declaration {
    return this.declaration;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitExportDecl(this);
  }
}

// ============================================
// DECLARATIONS
// ============================================

/**
 * Function parameter
 */
export interface Parameter {
  name: string;
  typeAnnotation: string; // Will be replaced with proper Type node later
  location: SourceLocation;
}

/**
 * Function declaration node
 *
 * Represents:
 * - Regular function: function foo(x: byte): word ... end function
 * - Stub function: function foo(x: byte): word;
 */
export class FunctionDecl extends Declaration {
  /**
   * Creates a Function declaration
   * @param name - Function name
   * @param parameters - Function parameters
   * @param returnType - Return type annotation
   * @param body - Function body statements (null for stub functions)
   * @param location - Source location
   * @param isExported - True if exported
   * @param isCallback - True if marked as callback
   * @param isStub - True if stub function (no body)
   */
  constructor(
    protected readonly name: string,
    protected readonly parameters: Parameter[],
    protected readonly returnType: string | null,
    protected readonly body: Statement[] | null,
    location: SourceLocation,
    protected readonly isExported: boolean = false,
    protected readonly isCallback: boolean = false,
    protected readonly isStub: boolean = false
  ) {
    super(ASTNodeType.FUNCTION_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getParameters(): Parameter[] {
    return this.parameters;
  }

  public getReturnType(): string | null {
    return this.returnType;
  }

  public getBody(): Statement[] | null {
    return this.body;
  }

  public isExportedFunction(): boolean {
    return this.isExported;
  }

  public isCallbackFunction(): boolean {
    return this.isCallback;
  }

  public isStubFunction(): boolean {
    return this.isStub;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitFunctionDecl(this);
  }
}

/**
 * Variable declaration node
 *
 * Represents: @zp let counter: byte = 0
 */
export class VariableDecl extends Declaration {
  /**
   * Creates a Variable declaration
   * @param name - Variable name
   * @param typeAnnotation - Type annotation
   * @param initializer - Initial value expression (optional)
   * @param location - Source location
   * @param storageClass - Storage class (@zp, @ram, @data)
   * @param isConstant - True if const, false if let
   * @param isExported - True if exported
   */
  constructor(
    protected readonly name: string,
    protected readonly typeAnnotation: string | null,
    protected readonly initializer: Expression | null,
    location: SourceLocation,
    protected readonly storageClass: TokenType | null = null,
    protected readonly isConstant: boolean = false,
    protected readonly isExported: boolean = false
  ) {
    super(ASTNodeType.VARIABLE_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getTypeAnnotation(): string | null {
    return this.typeAnnotation;
  }

  public getInitializer(): Expression | null {
    return this.initializer;
  }

  public getStorageClass(): TokenType | null {
    return this.storageClass;
  }

  public isConst(): boolean {
    return this.isConstant;
  }

  public isExportedVariable(): boolean {
    return this.isExported;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitVariableDecl(this);
  }
}

/**
 * Type alias declaration node
 *
 * Represents: type SpriteId = byte
 */
export class TypeDecl extends Declaration {
  /**
   * Creates a Type declaration
   * @param name - Type alias name
   * @param aliasedType - Type being aliased
   * @param location - Source location
   * @param isExported - True if exported
   */
  constructor(
    protected readonly name: string,
    protected readonly aliasedType: string,
    location: SourceLocation,
    protected readonly isExported: boolean = false
  ) {
    super(ASTNodeType.TYPE_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getAliasedType(): string {
    return this.aliasedType;
  }

  public isExportedType(): boolean {
    return this.isExported;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitTypeDecl(this);
  }
}

/**
 * Enum member
 */
export interface EnumMember {
  name: string;
  value: number | null; // null means auto-increment
  location: SourceLocation;
}

/**
 * Enum declaration node
 *
 * Represents: enum Direction { UP, DOWN, LEFT, RIGHT }
 */
export class EnumDecl extends Declaration {
  /**
   * Creates an Enum declaration
   * @param name - Enum name
   * @param members - Enum members
   * @param location - Source location
   * @param isExported - True if exported
   */
  constructor(
    protected readonly name: string,
    protected readonly members: EnumMember[],
    location: SourceLocation,
    protected readonly isExported: boolean = false
  ) {
    super(ASTNodeType.ENUM_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getMembers(): EnumMember[] {
    return this.members;
  }

  public isExportedEnum(): boolean {
    return this.isExported;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitEnumDecl(this);
  }
}

// ============================================
// EXPRESSIONS
// ============================================

/**
 * Binary expression node
 *
 * Represents: 2 + 3, x * y, a && b
 */
export class BinaryExpression extends Expression {
  /**
   * Creates a Binary expression
   * @param left - Left operand
   * @param operator - Operator token type
   * @param right - Right operand
   * @param location - Source location
   */
  constructor(
    protected readonly left: Expression,
    protected readonly operator: TokenType,
    protected readonly right: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.BINARY_EXPR, location);
  }

  public getLeft(): Expression {
    return this.left;
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getRight(): Expression {
    return this.right;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBinaryExpression(this);
  }
}

/**
 * Unary expression node
 *
 * Represents: -x, !flag, ~mask
 */
export class UnaryExpression extends Expression {
  /**
   * Creates a Unary expression
   * @param operator - Operator token type
   * @param operand - Operand expression
   * @param location - Source location
   */
  constructor(
    protected readonly operator: TokenType,
    protected readonly operand: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.UNARY_EXPR, location);
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getOperand(): Expression {
    return this.operand;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitUnaryExpression(this);
  }
}

/**
 * Literal value type
 */
export type LiteralValue = number | string | boolean;

/**
 * Literal expression node
 *
 * Represents: 42, "hello", true, $D000
 */
export class LiteralExpression extends Expression {
  /**
   * Creates a Literal expression
   * @param value - The literal value
   * @param location - Source location
   */
  constructor(
    protected readonly value: LiteralValue,
    location: SourceLocation
  ) {
    super(ASTNodeType.LITERAL_EXPR, location);
  }

  public getValue(): LiteralValue {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitLiteralExpression(this);
  }
}

/**
 * Identifier expression node
 *
 * Represents: counter, myFunction
 */
export class IdentifierExpression extends Expression {
  /**
   * Creates an Identifier expression
   * @param name - Identifier name
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.IDENTIFIER_EXPR, location);
  }

  public getName(): string {
    return this.name;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIdentifierExpression(this);
  }
}

/**
 * Call expression node
 *
 * Represents: foo(), add(1, 2)
 */
export class CallExpression extends Expression {
  /**
   * Creates a Call expression
   * @param callee - Function being called
   * @param args - Argument expressions
   * @param location - Source location
   */
  constructor(
    protected readonly callee: Expression,
    protected readonly args: Expression[],
    location: SourceLocation
  ) {
    super(ASTNodeType.CALL_EXPR, location);
  }

  public getCallee(): Expression {
    return this.callee;
  }

  public getArguments(): Expression[] {
    return this.args;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitCallExpression(this);
  }
}

/**
 * Index expression node
 *
 * Represents: array[0], sprites[i]
 */
export class IndexExpression extends Expression {
  /**
   * Creates an Index expression
   * @param object - Object being indexed
   * @param index - Index expression
   * @param location - Source location
   */
  constructor(
    protected readonly object: Expression,
    protected readonly index: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.INDEX_EXPR, location);
  }

  public getObject(): Expression {
    return this.object;
  }

  public getIndex(): Expression {
    return this.index;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIndexExpression(this);
  }
}

/**
 * Member expression node
 *
 * Represents: player.health, Game.score
 */
export class MemberExpression extends Expression {
  /**
   * Creates a Member expression
   * @param object - Object being accessed
   * @param property - Property name
   * @param location - Source location
   */
  constructor(
    protected readonly object: Expression,
    protected readonly property: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.MEMBER_EXPR, location);
  }

  public getObject(): Expression {
    return this.object;
  }

  public getProperty(): string {
    return this.property;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitMemberExpression(this);
  }
}

/**
 * Assignment expression node
 *
 * Represents: x = 5, counter += 1
 */
export class AssignmentExpression extends Expression {
  /**
   * Creates an Assignment expression
   * @param target - Assignment target (lvalue)
   * @param operator - Assignment operator
   * @param value - Value to assign
   * @param location - Source location
   */
  constructor(
    protected readonly target: Expression,
    protected readonly operator: TokenType,
    protected readonly value: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.ASSIGNMENT_EXPR, location);
  }

  public getTarget(): Expression {
    return this.target;
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getValue(): Expression {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitAssignmentExpression(this);
  }
}

/**
 * Array literal expression node
 *
 * Represents: [1, 2, 3], [x, y], [[1, 2], [3, 4]]
 *
 * Array literals provide a concise syntax for initializing arrays inline.
 * Supports:
 * - Empty arrays: []
 * - Single/multiple elements: [42], [1, 2, 3]
 * - Nested arrays (multidimensional): [[1, 2], [3, 4]]
 * - Expressions as elements: [x, y + 1, foo()]
 *
 * Note: Multidimensional arrays are syntactic sugar - they compile to
 * flat arrays with calculated offsets for 6502 efficiency.
 */
export class ArrayLiteralExpression extends Expression {
  /**
   * Creates an Array Literal expression
   * @param elements - Array element expressions (can be any expression including nested arrays)
   * @param location - Source location
   */
  constructor(
    protected readonly elements: Expression[],
    location: SourceLocation
  ) {
    super(ASTNodeType.ARRAY_LITERAL_EXPR, location);
  }

  /**
   * Gets the array elements
   * @returns Array of element expressions
   */
  public getElements(): Expression[] {
    return this.elements;
  }

  /**
   * Gets the number of elements in the array
   * @returns Element count
   */
  public getElementCount(): number {
    return this.elements.length;
  }

  /**
   * Checks if this is an empty array literal
   * @returns True if array has no elements
   */
  public isEmpty(): boolean {
    return this.elements.length === 0;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitArrayLiteralExpression(this);
  }
}

// ============================================
// STATEMENTS
// ============================================

/**
 * Return statement node
 *
 * Represents: return, return 42
 */
export class ReturnStatement extends Statement {
  /**
   * Creates a Return statement
   * @param value - Return value expression (null for void return)
   * @param location - Source location
   */
  constructor(
    protected readonly value: Expression | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.RETURN_STMT, location);
  }

  public getValue(): Expression | null {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitReturnStatement(this);
  }
}

/**
 * If statement node
 *
 * Represents: if x > 0 then ... else ... end if
 */
export class IfStatement extends Statement {
  /**
   * Creates an If statement
   * @param condition - Condition expression
   * @param thenBranch - Statements if condition is true
   * @param elseBranch - Statements if condition is false (optional)
   * @param location - Source location
   */
  constructor(
    protected readonly condition: Expression,
    protected readonly thenBranch: Statement[],
    protected readonly elseBranch: Statement[] | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.IF_STMT, location);
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public getThenBranch(): Statement[] {
    return this.thenBranch;
  }

  public getElseBranch(): Statement[] | null {
    return this.elseBranch;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIfStatement(this);
  }
}

/**
 * While statement node
 *
 * Represents: while running ... end while
 */
export class WhileStatement extends Statement {
  /**
   * Creates a While statement
   * @param condition - Loop condition
   * @param body - Loop body statements
   * @param location - Source location
   */
  constructor(
    protected readonly condition: Expression,
    protected readonly body: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.WHILE_STMT, location);
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public getBody(): Statement[] {
    return this.body;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitWhileStatement(this);
  }
}

/**
 * For statement node
 *
 * Represents: for i = 0 to 10 ... next i
 */
export class ForStatement extends Statement {
  /**
   * Creates a For statement
   * @param variable - Loop variable name
   * @param start - Start value expression
   * @param end - End value expression
   * @param body - Loop body statements
   * @param location - Source location
   */
  constructor(
    protected readonly variable: string,
    protected readonly start: Expression,
    protected readonly end: Expression,
    protected readonly body: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.FOR_STMT, location);
  }

  public getVariable(): string {
    return this.variable;
  }

  public getStart(): Expression {
    return this.start;
  }

  public getEnd(): Expression {
    return this.end;
  }

  public getBody(): Statement[] {
    return this.body;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitForStatement(this);
  }
}

/**
 * Match case clause
 */
export interface CaseClause {
  value: Expression;
  body: Statement[];
  location: SourceLocation;
}

/**
 * Match statement node
 *
 * Represents: match value case 1: ... case 2: ... default: ... end match
 */
export class MatchStatement extends Statement {
  /**
   * Creates a Match statement
   * @param value - Value being matched
   * @param cases - Case clauses
   * @param defaultCase - Default case body (optional)
   * @param location - Source location
   */
  constructor(
    protected readonly value: Expression,
    protected readonly cases: CaseClause[],
    protected readonly defaultCase: Statement[] | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.MATCH_STMT, location);
  }

  public getValue(): Expression {
    return this.value;
  }

  public getCases(): CaseClause[] {
    return this.cases;
  }

  public getDefaultCase(): Statement[] | null {
    return this.defaultCase;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitMatchStatement(this);
  }
}

/**
 * Break statement node
 *
 * Represents: break
 */
export class BreakStatement extends Statement {
  /**
   * Creates a Break statement
   * @param location - Source location
   */
  constructor(location: SourceLocation) {
    super(ASTNodeType.BREAK_STMT, location);
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBreakStatement(this);
  }
}

/**
 * Continue statement node
 *
 * Represents: continue
 */
export class ContinueStatement extends Statement {
  /**
   * Creates a Continue statement
   * @param location - Source location
   */
  constructor(location: SourceLocation) {
    super(ASTNodeType.CONTINUE_STMT, location);
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitContinueStatement(this);
  }
}

/**
 * Expression statement node
 *
 * Represents: foo(), x = 5 (expression used as statement)
 */
export class ExpressionStatement extends Statement {
  /**
   * Creates an Expression statement
   * @param expression - The expression
   * @param location - Source location
   */
  constructor(
    protected readonly expression: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.EXPR_STMT, location);
  }

  public getExpression(): Expression {
    return this.expression;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitExpressionStatement(this);
  }
}

/**
 * Block statement node
 *
 * Represents a sequence of statements (used in functions, if/else, loops)
 */
export class BlockStatement extends Statement {
  /**
   * Creates a Block statement
   * @param statements - Statements in the block
   * @param location - Source location
   */
  constructor(
    protected readonly statements: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.BLOCK_STMT, location);
  }

  public getStatements(): Statement[] {
    return this.statements;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBlockStatement(this);
  }
}

// ============================================
// MEMORY-MAPPED DECLARATIONS (@map)
// ============================================

/**
 * Simple memory-mapped declaration node
 *
 * Represents: @map vicBorderColor at $D020: byte;
 * Maps a single variable to a specific memory address.
 */
export class SimpleMapDecl extends Declaration {
  /**
   * Creates a Simple @map declaration
   * @param name - Variable name
   * @param address - Memory address expression
   * @param typeAnnotation - Type annotation (byte, word, etc.)
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    protected readonly address: Expression,
    protected readonly typeAnnotation: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.SIMPLE_MAP_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getAddress(): Expression {
    return this.address;
  }

  public getTypeAnnotation(): string {
    return this.typeAnnotation;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitSimpleMapDecl(this);
  }
}

/**
 * Range memory-mapped declaration node
 *
 * Represents: @map spriteRegisters from $D000 to $D02E: byte;
 * Maps a contiguous memory range to an array-like accessor.
 */
export class RangeMapDecl extends Declaration {
  /**
   * Creates a Range @map declaration
   * @param name - Variable name
   * @param startAddress - Start address expression
   * @param endAddress - End address expression
   * @param typeAnnotation - Type annotation (byte, word, etc.)
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    protected readonly startAddress: Expression,
    protected readonly endAddress: Expression,
    protected readonly typeAnnotation: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.RANGE_MAP_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getStartAddress(): Expression {
    return this.startAddress;
  }

  public getEndAddress(): Expression {
    return this.endAddress;
  }

  public getTypeAnnotation(): string {
    return this.typeAnnotation;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitRangeMapDecl(this);
  }
}

/**
 * Field in a sequential struct map declaration
 */
export interface MapField {
  /** Field name */
  name: string;
  /** Base type (byte, word, etc.) */
  baseType: string;
  /** Array size (null for non-array) */
  arraySize: number | null;
  /** Source location */
  location: SourceLocation;
}

/**
 * Sequential struct memory-mapped declaration node
 *
 * Represents: @map sid at $D400 type ... end @map
 * Fields are auto-laid-out sequentially from base address.
 */
export class SequentialStructMapDecl extends Declaration {
  /**
   * Creates a Sequential Struct @map declaration
   * @param name - Variable name
   * @param baseAddress - Base address expression
   * @param fields - Field definitions
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    protected readonly baseAddress: Expression,
    protected readonly fields: MapField[],
    location: SourceLocation
  ) {
    super(ASTNodeType.SEQUENTIAL_STRUCT_MAP_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getBaseAddress(): Expression {
    return this.baseAddress;
  }

  public getFields(): MapField[] {
    return this.fields;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitSequentialStructMapDecl(this);
  }
}

/**
 * Single address specification for explicit map field
 */
export interface SingleAddress {
  kind: 'single';
  address: Expression;
}

/**
 * Address range specification for explicit map field
 */
export interface AddressRange {
  kind: 'range';
  startAddress: Expression;
  endAddress: Expression;
}

/**
 * Field in an explicit struct map declaration
 */
export interface ExplicitMapField {
  /** Field name */
  name: string;
  /** Address specification (single address or range) */
  addressSpec: SingleAddress | AddressRange;
  /** Type annotation */
  typeAnnotation: string;
  /** Source location */
  location: SourceLocation;
}

/**
 * Explicit struct memory-mapped declaration node
 *
 * Represents: @map vic at $D000 layout ... end @map
 * Fields have explicitly specified addresses (allows gaps).
 */
export class ExplicitStructMapDecl extends Declaration {
  /**
   * Creates an Explicit Struct @map declaration
   * @param name - Variable name
   * @param baseAddress - Base address expression
   * @param fields - Field definitions with explicit addresses
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    protected readonly baseAddress: Expression,
    protected readonly fields: ExplicitMapField[],
    location: SourceLocation
  ) {
    super(ASTNodeType.EXPLICIT_STRUCT_MAP_DECL, location);
  }

  public getName(): string {
    return this.name;
  }

  public getBaseAddress(): Expression {
    return this.baseAddress;
  }

  public getFields(): ExplicitMapField[] {
    return this.fields;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitExplicitStructMapDecl(this);
  }
}
