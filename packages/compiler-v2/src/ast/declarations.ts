/**
 * Declaration AST Node Implementations for Blend65 Compiler v2
 *
 * This module contains all declaration node classes that represent
 * name-introducing constructs in Blend65.
 *
 * Declarations:
 * - Introduce new names into scope (variables, functions, types, etc.)
 * - Can be exported (visible to other modules)
 * - Appear at module scope or inside functions
 * - Create symbol table entries
 */

import { ASTNodeType, ASTVisitor, Declaration, Expression, SourceLocation, Statement } from './base.js';
import { TokenType } from '../lexer/types.js';

// ============================================
// FUNCTION DECLARATIONS
// ============================================

/**
 * Function parameter definition
 */
export interface Parameter {
  /** Parameter name */
  name: string;
  /** Type annotation (e.g., "byte", "word") */
  typeAnnotation: string;
  /** Source location for error reporting */
  location: SourceLocation;
}

/**
 * Function declaration node
 *
 * Represents:
 * - Regular function: function foo(x: byte): word { ... }
 * - Stub function: function foo(x: byte): word;
 * - Callback function: callback function handler(): void { ... }
 */
export class FunctionDecl extends Declaration {
  /**
   * Creates a Function declaration
   * @param name - Function name
   * @param parameters - Function parameters
   * @param returnType - Return type annotation (null for void)
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

// ============================================
// VARIABLE DECLARATIONS
// ============================================

/**
 * Variable declaration node
 *
 * Represents: @zp let counter: byte = 0
 *
 * Features:
 * - Storage class: @zp (zero page), @ram, @data
 * - Mutability: let (mutable) or const (immutable)
 * - Optional initializer expression
 * - Optional export modifier
 */
export class VariableDecl extends Declaration {
  /**
   * Creates a Variable declaration
   * @param name - Variable name
   * @param typeAnnotation - Type annotation (e.g., "byte", "word")
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

// ============================================
// TYPE DECLARATIONS
// ============================================

/**
 * Type alias declaration node
 *
 * Represents: type SpriteId = byte
 *
 * Creates a new name for an existing type. Useful for:
 * - Self-documenting code (type SpriteId = byte)
 * - Abstracting platform differences
 * - Future struct/enum extensions
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

// ============================================
// ENUM DECLARATIONS
// ============================================

/**
 * Enum member definition
 */
export interface EnumMember {
  /** Member name */
  name: string;
  /** Explicit value (null means auto-increment from previous) */
  value: number | null;
  /** Source location for error reporting */
  location: SourceLocation;
}

/**
 * Enum declaration node
 *
 * Represents: enum Direction { UP, DOWN, LEFT, RIGHT }
 *
 * Enums provide named constants:
 * - Auto-incrementing values starting from 0
 * - Explicit values: enum Flags { A = 1, B = 2, C = 4 }
 * - Compiles to byte constants (efficient on 6502)
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