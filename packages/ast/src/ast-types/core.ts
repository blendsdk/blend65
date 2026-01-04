/**
 * Core AST Types for Blend65 - Fundamental Language Constructs
 *
 * Includes: Program, basic expressions, basic statements, identifiers, literals.
 * These types are required for any functioning Blend65 program.
 *
 * Adapted from blend-lang for the Blend65 multi-target 6502 language.
 */

import { SourcePosition } from '@blend65/lexer';

// ============================================================================
// Base Node Type
// ============================================================================

/**
 * Base interface for all AST nodes.
 * Every node has a literal `type` field for discriminated unions.
 */
export interface Blend65ASTNode {
  type: string;
  metadata?: {
    start: SourcePosition;
    end: SourcePosition;
  };
}

// ============================================================================
// Program Node
// ============================================================================

/**
 * The root node representing a complete Blend65 program.
 * Every Blend65 file contains exactly one module.
 */
export interface Program extends Blend65ASTNode {
  type: 'Program';
  module: ModuleDeclaration;
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  body: Declaration[];
}

/**
 * Module declaration: `module Game.Main`
 */
export interface ModuleDeclaration extends Blend65ASTNode {
  type: 'ModuleDeclaration';
  name: QualifiedName;
}

/**
 * Qualified name: `Game.Main` or `target.sprites`
 */
export interface QualifiedName extends Blend65ASTNode {
  type: 'QualifiedName';
  parts: string[];
}

// ============================================================================
// Core Expressions
// ============================================================================

/**
 * Union type for all expressions in the language.
 */
export type Expression =
  | BinaryExpr
  | UnaryExpr
  | UpdateExpr
  | AssignmentExpr
  | ConditionalExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | Identifier
  | Literal
  | ArrayLiteral
  | RecordLiteral;

/**
 * Binary expression: `left op right`
 * Examples: `a + b`, `x * y`, `flag and other`
 */
export interface BinaryExpr extends Blend65ASTNode {
  type: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

/**
 * Unary expression: `op operand`
 * Examples: `-x`, `not flag`, `~bits`
 */
export interface UnaryExpr extends Blend65ASTNode {
  type: 'UnaryExpr';
  operator: string;
  operand: Expression;
}

/**
 * Update expression: `++x`, `x++`, `--x`, `x--`
 * Note: May not be supported in Blend65 v0.1
 */
export interface UpdateExpr extends Blend65ASTNode {
  type: 'UpdateExpr';
  operator: '++' | '--';
  operand: Expression;
  prefix: boolean; // true for ++x, false for x++
}

/**
 * Assignment expression: `left = right`
 * Also includes compound assignments: `+=`, `-=`, etc.
 */
export interface AssignmentExpr extends Blend65ASTNode {
  type: 'AssignmentExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

/**
 * Conditional (ternary) expression: `test ? consequent : alternate`
 * Note: Blend65 may use different syntax
 */
export interface ConditionalExpr extends Blend65ASTNode {
  type: 'ConditionalExpr';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/**
 * Function call expression: `callee(arg1, arg2, ...)`
 */
export interface CallExpr extends Blend65ASTNode {
  type: 'CallExpr';
  callee: Expression;
  args: Expression[];
}

/**
 * Member access expression: `object.property`
 */
export interface MemberExpr extends Blend65ASTNode {
  type: 'MemberExpr';
  object: Expression;
  property: string;
}

/**
 * Index access expression: `array[index]`
 */
export interface IndexExpr extends Blend65ASTNode {
  type: 'IndexExpr';
  object: Expression;
  index: Expression;
}

/**
 * Identifier: variable or function name
 */
export interface Identifier extends Blend65ASTNode {
  type: 'Identifier';
  name: string;
}

/**
 * Literal value: number, string, boolean
 */
export interface Literal extends Blend65ASTNode {
  type: 'Literal';
  value: string | number | boolean;
  raw: string; // Original source representation
}

/**
 * Array literal: `[1, 2, 3]` or `[0x00, 0x06, 0x0E]`
 */
export interface ArrayLiteral extends Blend65ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

/**
 * Record literal: `{x: 1, y: 2}` (if supported in Blend65)
 */
export interface RecordLiteral extends Blend65ASTNode {
  type: 'RecordLiteral';
  properties: Array<{
    key: string;
    value: Expression;
  }>;
}

// ============================================================================
// Core Statements
// ============================================================================

/**
 * Union type for all statements
 */
export type Statement =
  | ExpressionStatement
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | MatchStatement
  | BlockStatement
  | BreakStatement
  | ContinueStatement;

/**
 * Expression statement: any expression followed by newline
 */
export interface ExpressionStatement extends Blend65ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

/**
 * Return statement: `return value`
 */
export interface ReturnStatement extends Blend65ASTNode {
  type: 'ReturnStatement';
  value: Expression | null;
}

/**
 * If statement: `if condition then ... else ... end if`
 */
export interface IfStatement extends Blend65ASTNode {
  type: 'IfStatement';
  condition: Expression;
  thenBody: Statement[];
  elseBody: Statement[] | null;
}

/**
 * While loop: `while condition ... end while`
 */
export interface WhileStatement extends Blend65ASTNode {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

/**
 * For loop: `for variable = start to end ... next`
 */
export interface ForStatement extends Blend65ASTNode {
  type: 'ForStatement';
  variable: string;
  start: Expression;
  end: Expression;
  step: Expression | null;
  body: Statement[];
}

/**
 * Match statement: `match expression case value: ... end match`
 */
export interface MatchStatement extends Blend65ASTNode {
  type: 'MatchStatement';
  discriminant: Expression;
  cases: MatchCase[];
  defaultCase: MatchCase | null;
}

/**
 * Individual case in a match statement
 */
export interface MatchCase extends Blend65ASTNode {
  type: 'MatchCase';
  test: Expression | null; // null for default case
  consequent: Statement[];
}

/**
 * Block statement: collection of statements
 */
export interface BlockStatement extends Blend65ASTNode {
  type: 'BlockStatement';
  statements: Statement[];
}

/**
 * Break statement: `break`
 * Exits the containing loop
 */
export interface BreakStatement extends Blend65ASTNode {
  type: 'BreakStatement';
  // No additional properties needed
}

/**
 * Continue statement: `continue`
 * Skips to next iteration of containing loop
 */
export interface ContinueStatement extends Blend65ASTNode {
  type: 'ContinueStatement';
  // No additional properties needed
}

// ============================================================================
// Declarations
// ============================================================================

/**
 * Union type for declarations
 */
export type Declaration =
  | FunctionDeclaration
  | VariableDeclaration
  | TypeDeclaration
  | EnumDeclaration;

/**
 * Parameter definition for functions
 */
export interface Parameter extends Blend65ASTNode {
  type: 'Parameter';
  name: string;
  paramType: TypeAnnotation;
  optional: boolean;
  defaultValue: Expression | null;
}

/**
 * Function declaration with optional callback modifier
 * Enhanced to support callback functions for interrupts and function pointers
 */
export interface FunctionDeclaration extends Blend65ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  returnType: TypeAnnotation;
  body: Statement[];
  exported: boolean;
  callback: boolean; // NEW: Callback function flag
}

/**
 * Variable declaration with storage class
 * Examples: `var x: byte`, `zp var counter: byte`, `data var palette: byte[16]`
 */
export interface VariableDeclaration extends Blend65ASTNode {
  type: 'VariableDeclaration';
  storageClass: StorageClass | null;
  name: string;
  varType: TypeAnnotation;
  initializer: Expression | null;
  exported: boolean;
}

/**
 * Storage class for variables
 */
export type StorageClass = 'zp' | 'ram' | 'data' | 'const' | 'io';

/**
 * Type declaration: `type Player extends HasPos ... end type`
 */
export interface TypeDeclaration extends Blend65ASTNode {
  type: 'TypeDeclaration';
  name: string;
  extends: TypeAnnotation[];
  fields: TypeField[];
  exported: boolean;
}

/**
 * Field in a type declaration
 */
export interface TypeField extends Blend65ASTNode {
  type: 'TypeField';
  name: string;
  fieldType: TypeAnnotation;
}

/**
 * Enum declaration: `enum Name value1 = 1, value2, value3 = 5 end enum`
 */
export interface EnumDeclaration extends Blend65ASTNode {
  type: 'EnumDeclaration';
  name: string;
  members: EnumMember[];
  exported: boolean;
}

/**
 * Individual enum member
 */
export interface EnumMember extends Blend65ASTNode {
  type: 'EnumMember';
  name: string;
  value: Expression | null; // null for auto-increment
}

// ============================================================================
// Import/Export System
// ============================================================================

/**
 * Import declaration: `import setSpritePosition from c64.sprites`
 */
export interface ImportDeclaration extends Blend65ASTNode {
  type: 'ImportDeclaration';
  specifiers: ImportSpecifier[];
  source: QualifiedName;
}

/**
 * Individual import specifier
 */
export interface ImportSpecifier extends Blend65ASTNode {
  type: 'ImportSpecifier';
  imported: string;
  local: string | null; // null if same as imported
}

/**
 * Export declaration: `export function main()` or `export const SCREEN_W`
 */
export interface ExportDeclaration extends Blend65ASTNode {
  type: 'ExportDeclaration';
  declaration: Declaration;
}

// ============================================================================
// Type System
// ============================================================================

/**
 * Union type for all type annotations
 */
export type TypeAnnotation = PrimitiveType | ArrayType | RecordType | NamedType;

/**
 * Primitive type annotation - add callback type
 */
export interface PrimitiveType extends Blend65ASTNode {
  type: 'PrimitiveType';
  name: 'byte' | 'word' | 'boolean' | 'void' | 'callback'; // Add 'callback'
}

/**
 * Array type: `byte[8]` or `word[256]`
 */
export interface ArrayType extends Blend65ASTNode {
  type: 'ArrayType';
  elementType: TypeAnnotation;
  size: Expression; // Must be compile-time constant
}

/**
 * Record type: user-defined type
 */
export interface RecordType extends Blend65ASTNode {
  type: 'RecordType';
  name: string;
}

/**
 * Named type: reference to a type declaration
 */
export interface NamedType extends Blend65ASTNode {
  type: 'NamedType';
  name: string;
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type ASTNode = Blend65ASTNode;
export type CoreNode = Program | Expression | Statement | Declaration | TypeAnnotation;
