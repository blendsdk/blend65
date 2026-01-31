/**
 * Declaration Type Checker for Blend65 Compiler v2
 *
 * Extends ExpressionTypeChecker to add type checking for all declaration types:
 * - Variable declarations (let/const with optional type annotation)
 * - Function declarations (parameters, return type, body)
 * - Import declarations (cross-module symbol resolution)
 * - Export declarations (wrapper around other declarations)
 * - Type declarations (type aliases)
 * - Enum declarations (enum members)
 *
 * This is the fourth layer of the type checker inheritance chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker → DeclarationTypeChecker → ...
 *
 * @module semantic/visitors/type-checker/declarations
 */

import type {
  VariableDecl,
  FunctionDecl,
  TypeDecl,
  EnumDecl,
  Parameter,
} from '../../../ast/declarations.js';
import type {
  ImportDecl,
  ExportDecl,
  ModuleDecl,
  Program,
} from '../../../ast/program.js';
import type { SourceLocation } from '../../../ast/base.js';
import { ExpressionTypeChecker } from './expressions.js';
import { TypeCheckDiagnosticCodes } from './base.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { SymbolKind } from '../../symbol.js';
import { DiagnosticCode } from '../../../ast/diagnostics.js';

/**
 * Diagnostic codes specific to declaration type checking
 */
export const DeclarationDiagnosticCodes = {
  /** Missing type annotation when required */
  MISSING_TYPE_ANNOTATION: 'S030' as DiagnosticCode,

  /** Invalid type annotation (type doesn't exist) */
  UNKNOWN_TYPE: 'S031' as DiagnosticCode,

  /** Duplicate declaration in same scope */
  DUPLICATE_DECLARATION: 'S032' as DiagnosticCode,

  /** Missing function return statement */
  MISSING_RETURN: 'S033' as DiagnosticCode,

  /** Return type mismatch */
  RETURN_TYPE_MISMATCH: 'S034' as DiagnosticCode,

  /** Invalid export (cannot export this kind of declaration) */
  INVALID_EXPORT: 'S035' as DiagnosticCode,

  /** Import from unknown module */
  UNKNOWN_MODULE: 'S036' as DiagnosticCode,

  /** Imported symbol not found in module */
  SYMBOL_NOT_EXPORTED: 'S037' as DiagnosticCode,

  /** Const declaration requires initializer */
  CONST_REQUIRES_INITIALIZER: 'S038' as DiagnosticCode,
} as const;

/**
 * Declaration Type Checker - Type checking for all declaration types
 *
 * Handles type checking for declarations:
 *
 * **Variable Declarations:**
 * - Resolves declared type annotation (byte, word, etc.)
 * - Type checks initializer expression
 * - Verifies initializer type is assignable to declared type
 * - Infers type from initializer if no annotation
 * - Validates const declarations have initializers
 *
 * **Function Declarations:**
 * - Resolves parameter types
 * - Resolves return type annotation
 * - Type checks function body
 * - Validates return statements match return type
 * - Creates function scope for body checking
 *
 * **Import Declarations:**
 * - Records imported symbols for later resolution
 * - Cross-module resolution happens in multi-module pass
 *
 * **Export Declarations:**
 * - Delegates to the wrapped declaration
 * - Marks declaration as exported in symbol table
 *
 * **Type Declarations:**
 * - Validates aliased type exists
 * - Creates type alias in type system
 *
 * **Enum Declarations:**
 * - Validates enum member values
 * - Creates enum type with members
 *
 * @example
 * ```typescript
 * class MyChecker extends DeclarationTypeChecker {
 *   // Override to add custom declaration checking
 *   override visitVariableDecl(node: VariableDecl): void {
 *     super.visitVariableDecl(node);
 *     // Custom logic here
 *   }
 * }
 * ```
 */
export abstract class DeclarationTypeChecker extends ExpressionTypeChecker {
  // ============================================
  // CONTEXT TRACKING
  // ============================================

  /**
   * Current function being type checked (for return type validation)
   */
  protected currentFunction: FunctionDecl | null = null;

  /**
   * Current function's return type (for return statement validation)
   */
  protected currentReturnType: TypeInfo | null = null;

  /**
   * Whether current function has at least one return statement
   */
  protected hasReturnStatement: boolean = false;

  // ============================================
  // VARIABLE DECLARATION
  // ============================================

  /**
   * Type check a variable declaration
   *
   * Validates:
   * 1. Type annotation refers to a valid type
   * 2. Initializer expression type is compatible with declared type
   * 3. Const declarations have initializers
   * 4. Type can be inferred if no annotation
   *
   * @param node - The variable declaration node
   */
  override visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const typeAnnotation = node.getTypeAnnotation();
    const initializer = node.getInitializer();
    const isConst = node.isConst();

    // Const declarations require initializers
    if (isConst && !initializer) {
      this.reportError(
        DeclarationDiagnosticCodes.CONST_REQUIRES_INITIALIZER,
        `Const declaration '${name}' must have an initializer`,
        node.getLocation(),
        'Add an initial value: const x = 5'
      );
      this.exitNode(node);
      return;
    }

    // Resolve the declared type
    let declaredType: TypeInfo | null = null;

    if (typeAnnotation) {
      declaredType = this.resolveTypeAnnotation(typeAnnotation, node.getLocation());
    }

    // Type check the initializer if present
    let initializerType: TypeInfo | null = null;

    if (initializer) {
      initializer.accept(this);
      initializerType = this.getTypeOf(initializer);
    }

    // Determine the variable's type
    let resolvedType: TypeInfo | null = null;

    if (declaredType && initializerType) {
      // Both declared type and initializer - check compatibility
      if (!this.canAssign(initializerType, declaredType)) {
        this.reportTypeMismatch(declaredType, initializerType, node.getLocation(), `initializer for '${name}'`);
      }
      resolvedType = declaredType;
    } else if (declaredType) {
      // Only declared type - use it
      resolvedType = declaredType;
    } else if (initializerType) {
      // Only initializer - infer type
      resolvedType = initializerType;
    } else {
      // Neither - error (cannot determine type)
      this.reportError(
        DeclarationDiagnosticCodes.MISSING_TYPE_ANNOTATION,
        `Variable '${name}' needs a type annotation or initializer`,
        node.getLocation(),
        'Add a type annotation (e.g., let x: byte) or an initializer (e.g., let x = 0)'
      );
    }

    // Update the symbol with the resolved type
    if (resolvedType) {
      this.updateSymbolType(name, resolvedType);
    }

    this.exitNode(node);
  }

  // ============================================
  // FUNCTION DECLARATION
  // ============================================

  /**
   * Type check a function declaration
   *
   * Validates:
   * 1. Parameter types are valid
   * 2. Return type annotation is valid
   * 3. Function body type checks correctly
   * 4. Return statements match declared return type
   * 5. Non-void functions have return statements
   *
   * @param node - The function declaration node
   */
  override visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const parameters = node.getParameters();
    const returnTypeAnnotation = node.getReturnType();
    const body = node.getBody();
    const isStub = node.isStubFunction();

    // Save previous context
    const previousFunction = this.currentFunction;
    const previousReturnType = this.currentReturnType;
    const previousHasReturn = this.hasReturnStatement;

    // Set new context
    this.currentFunction = node;
    this.hasReturnStatement = false;

    // Resolve return type
    let returnType: TypeInfo;
    if (returnTypeAnnotation) {
      const resolved = this.resolveTypeAnnotation(returnTypeAnnotation, node.getLocation());
      returnType = resolved ?? this.getBuiltinType('void')!;
    } else {
      returnType = this.getBuiltinType('void')!;
    }
    this.currentReturnType = returnType;

    // Validate and resolve parameter types
    const parameterTypes: TypeInfo[] = [];
    for (const param of parameters) {
      const paramType = this.checkParameter(param);
      parameterTypes.push(paramType ?? this.getBuiltinType('byte')!);
    }

    // Create function type and update symbol
    const functionType = this.typeSystem.createFunctionType(
      parameterTypes,
      returnType,
      parameters.map((p) => p.name)
    );
    this.updateSymbolType(name, functionType);

    // Type check body if not a stub function
    if (body && !isStub) {
      // Enter function scope
      this.enterScope(`function:${name}`);

      // Type check body statements
      for (const statement of body) {
        if (this.shouldStop) break;
        statement.accept(this);
      }

      // Check if non-void function has return
      if (!this.isVoidType(returnType) && !this.hasReturnStatement) {
        this.reportWarning(
          DeclarationDiagnosticCodes.MISSING_RETURN,
          `Function '${name}' may not return a value on all paths`,
          node.getLocation(),
          `Function declared as returning '${returnType.name}' but no return statement found`
        );
      }

      // Exit function scope
      this.exitScope();
    }

    // Restore previous context
    this.currentFunction = previousFunction;
    this.currentReturnType = previousReturnType;
    this.hasReturnStatement = previousHasReturn;

    this.exitNode(node);
  }

  /**
   * Check a function parameter declaration
   *
   * Validates the parameter's type annotation and returns the resolved type.
   *
   * @param param - The parameter to check
   * @returns The resolved parameter type, or null if invalid
   */
  protected checkParameter(param: Parameter): TypeInfo | null {
    const typeAnnotation = param.typeAnnotation;

    if (!typeAnnotation) {
      this.reportError(
        DeclarationDiagnosticCodes.MISSING_TYPE_ANNOTATION,
        `Parameter '${param.name}' requires a type annotation`,
        param.location,
        'Add a type annotation (e.g., x: byte)'
      );
      return null;
    }

    const resolvedType = this.resolveTypeAnnotation(typeAnnotation, param.location);

    if (!resolvedType) {
      // Error already reported by resolveTypeAnnotation
      return null;
    }

    // Update parameter symbol type
    this.updateSymbolType(param.name, resolvedType);

    return resolvedType;
  }

  // ============================================
  // IMPORT DECLARATION
  // ============================================

  /**
   * Type check an import declaration
   *
   * For single-module analysis, this is a no-op since we can't resolve
   * cross-module references yet. The multi-module analyzer handles
   * actual import validation.
   *
   * @param node - The import declaration node
   */
  override visitImportDecl(node: ImportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Import validation happens in multi-module analysis pass
    // For now, we just record that the import exists
    // The symbols were already registered by the symbol table builder

    this.exitNode(node);
  }

  // ============================================
  // EXPORT DECLARATION
  // ============================================

  /**
   * Type check an export declaration
   *
   * Delegates to the wrapped declaration's type checking.
   * The export wrapper doesn't add any type checking of its own.
   *
   * @param node - The export declaration node
   */
  override visitExportDecl(node: ExportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Type check the wrapped declaration
    const declaration = node.getDeclaration();
    declaration.accept(this);

    this.exitNode(node);
  }

  // ============================================
  // TYPE DECLARATION
  // ============================================

  /**
   * Type check a type alias declaration
   *
   * Validates that the aliased type exists.
   *
   * @param node - The type declaration node
   */
  override visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const aliasedTypeName = node.getAliasedType();

    // Resolve the aliased type
    const aliasedType = this.resolveTypeAnnotation(aliasedTypeName, node.getLocation());

    if (!aliasedType) {
      // Error already reported by resolveTypeAnnotation
      this.exitNode(node);
      return;
    }

    // Create type alias (for now, just update symbol with the aliased type)
    // A full implementation would register the alias in the type system
    this.updateSymbolType(name, aliasedType);

    this.exitNode(node);
  }

  // ============================================
  // ENUM DECLARATION
  // ============================================

  /**
   * Type check an enum declaration
   *
   * Validates enum member values and creates the enum type.
   *
   * @param node - The enum declaration node
   */
  override visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const members = node.getMembers();

    // Build member map with values
    const memberMap = new Map<string, number>();
    let nextValue = 0;

    for (const member of members) {
      const memberValue = member.value ?? nextValue;

      // Validate value fits in byte (enums are byte-sized)
      if (memberValue < 0 || memberValue > 255) {
        this.reportError(
          TypeCheckDiagnosticCodes.NUMERIC_OVERFLOW as DiagnosticCode,
          `Enum member '${member.name}' value ${memberValue} out of range (0-255)`,
          member.location,
          'Enum values must fit in a byte'
        );
      }

      memberMap.set(member.name, memberValue);
      nextValue = memberValue + 1;
    }

    // Create enum type
    const enumType = this.typeSystem.createEnumType(name, memberMap);

    // Update symbol with enum type
    this.updateSymbolType(name, enumType);

    this.exitNode(node);
  }

  // ============================================
  // MODULE DECLARATION
  // ============================================

  /**
   * Visit a module declaration
   *
   * Module declarations don't require type checking - they just define
   * the namespace for the file.
   *
   * @param node - The module declaration node
   */
  override visitModule(node: ModuleDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Module declarations don't need type checking
    this.exitNode(node);
  }

  // ============================================
  // PROGRAM
  // ============================================

  /**
   * Visit a program node (root of AST)
   *
   * Type checks all declarations in the program.
   *
   * @param node - The program node
   */
  override visitProgram(node: Program): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit module declaration
    const module = node.getModule();
    module.accept(this);

    // Visit all top-level declarations
    for (const declaration of node.getDeclarations()) {
      if (this.shouldStop) break;
      declaration.accept(this);
    }

    this.exitNode(node);
  }

  // ============================================
  // TYPE RESOLUTION UTILITIES
  // ============================================

  /**
   * Resolves a type annotation string to a TypeInfo
   *
   * Handles:
   * - Built-in types (byte, word, bool, void, string)
   * - Array types (byte[], word[10])
   * - User-defined types (from type declarations)
   *
   * @param annotation - The type annotation string
   * @param location - Source location for error reporting
   * @returns The resolved TypeInfo, or null if invalid
   */
  protected resolveTypeAnnotation(annotation: string, location: SourceLocation): TypeInfo | null {
    // Handle array types
    if (annotation.endsWith('[]')) {
      const elementTypeName = annotation.slice(0, -2);
      const elementType = this.resolveTypeAnnotation(elementTypeName, location);

      if (!elementType) {
        return null;
      }

      return this.typeSystem.createArrayType(elementType);
    }

    // Handle sized arrays (e.g., byte[10])
    const arraySizeMatch = annotation.match(/^(.+)\[(\d+)\]$/);
    if (arraySizeMatch) {
      const elementTypeName = arraySizeMatch[1];
      const size = parseInt(arraySizeMatch[2], 10);
      const elementType = this.resolveTypeAnnotation(elementTypeName, location);

      if (!elementType) {
        return null;
      }

      return this.typeSystem.createArrayType(elementType, size);
    }

    // Check built-in types
    const builtinType = this.getBuiltinType(annotation);
    if (builtinType) {
      return builtinType;
    }

    // Check user-defined types (from symbol table)
    const symbol = this.lookupSymbol(annotation);
    if (symbol && symbol.type && (symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Variable)) {
      // If it's a type alias, return its type
      return symbol.type;
    }

    // Unknown type
    this.reportError(
      DeclarationDiagnosticCodes.UNKNOWN_TYPE,
      `Unknown type '${annotation}'`,
      location,
      `Valid types are: byte, word, bool, void, string, or array types (e.g., byte[])`
    );
    return null;
  }

  /**
   * Updates a symbol's type in the symbol table
   *
   * @param name - The symbol name
   * @param type - The resolved type
   */
  protected updateSymbolType(name: string, type: TypeInfo): void {
    const symbol = this.lookupSymbol(name);
    if (symbol) {
      symbol.type = type;
    }
  }

  // ============================================
  // VOID TYPE CHECK
  // ============================================

  /**
   * Checks if a type is the void type
   *
   * @param type - The type to check
   * @returns True if the type is void
   */
  protected isVoidType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Void;
  }

  // ============================================
  // CURRENT FUNCTION CONTEXT
  // ============================================

  /**
   * Gets the current function being type checked
   *
   * @returns The current function, or null if not in a function
   */
  public getCurrentFunction(): FunctionDecl | null {
    return this.currentFunction;
  }

  /**
   * Gets the expected return type for the current function
   *
   * @returns The return type, or null if not in a function
   */
  public getCurrentReturnType(): TypeInfo | null {
    return this.currentReturnType;
  }

  /**
   * Marks that a return statement was found in the current function
   */
  protected markReturnFound(): void {
    this.hasReturnStatement = true;
  }
}