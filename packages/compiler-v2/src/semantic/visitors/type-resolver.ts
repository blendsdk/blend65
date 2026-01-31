/**
 * Type Resolver for Blend65 Compiler v2
 *
 * Pass 2 of semantic analysis: walks the symbol table and resolves
 * all type annotations to TypeInfo objects.
 *
 * This pass:
 * - Resolves type annotation strings to TypeInfo objects
 * - Handles built-in types (byte, word, bool, void, string)
 * - Handles array types (byte[10], word[])
 * - Creates function types for function symbols
 * - Reports unknown type errors
 * - Does NOT perform type checking (that's Pass 3)
 *
 * @module semantic/visitors/type-resolver
 */

import { ASTWalker } from '../../ast/walker/index.js';
import type {
  Program,
  FunctionDecl,
  VariableDecl,
  EnumDecl,
  TypeDecl,
  ForStatement,
  SourceLocation,
} from '../../ast/index.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Symbol } from '../symbol.js';
import { SymbolKind } from '../symbol.js';
import { TypeSystem } from '../type-system.js';
import type { TypeInfo } from '../types.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';

/**
 * Result of type resolution
 */
export interface TypeResolutionResult {
  /** Whether resolution succeeded without errors */
  success: boolean;

  /** Diagnostics collected during resolution */
  diagnostics: Diagnostic[];

  /** Number of types resolved */
  resolvedCount: number;

  /** Number of types that failed to resolve */
  failedCount: number;
}

/**
 * Diagnostic codes for type resolution
 */
export const TypeResolverDiagnosticCodes = {
  /** Unknown type name */
  UNKNOWN_TYPE: DiagnosticCode.UNKNOWN_TYPE,

  /** Invalid array size */
  INVALID_ARRAY_SIZE: DiagnosticCode.INVALID_ARRAY_SIZE,

  /** Invalid type annotation syntax */
  INVALID_TYPE_SYNTAX: DiagnosticCode.INVALID_TYPE,
} as const;

/**
 * Type Resolver - Pass 2 of semantic analysis
 *
 * Resolves type annotation strings to TypeInfo objects for all symbols.
 *
 * The resolver works by:
 * 1. Iterating through all symbols in the symbol table
 * 2. For each symbol, parsing its type annotation
 * 3. Creating TypeInfo objects from the annotations
 * 4. Updating the symbol's type field
 *
 * Type annotation syntax:
 * - `byte` - built-in type
 * - `word` - built-in type
 * - `bool` - built-in type
 * - `void` - function return type only
 * - `string` - string literal type
 * - `byte[10]` - fixed-size array of 10 bytes
 * - `byte[]` - unsized array of bytes
 *
 * Usage:
 * ```typescript
 * const resolver = new TypeResolver();
 * const result = resolver.resolve(symbolTable, program);
 *
 * if (result.success) {
 *   // All types resolved, proceed to type checking
 * } else {
 *   // Handle result.diagnostics
 * }
 * ```
 */
export class TypeResolver extends ASTWalker {
  /** The symbol table with symbols to resolve */
  protected symbolTable: SymbolTable;

  /** The type system for creating types */
  protected typeSystem: TypeSystem;

  /** Collected diagnostics */
  protected diagnostics: Diagnostic[];

  /** Count of successfully resolved types */
  protected resolvedCount: number;

  /** Count of types that failed to resolve */
  protected failedCount: number;

  /** Type alias registry (name -> resolved type) */
  protected typeAliases: Map<string, TypeInfo>;

  /** Enum type registry (name -> enum type) */
  protected enumTypes: Map<string, TypeInfo>;

  /**
   * Creates a new TypeResolver
   *
   * @param typeSystem - Optional TypeSystem instance (creates new if not provided)
   */
  constructor(typeSystem?: TypeSystem) {
    super();
    this.symbolTable = null!;
    this.typeSystem = typeSystem ?? new TypeSystem();
    this.diagnostics = [];
    this.resolvedCount = 0;
    this.failedCount = 0;
    this.typeAliases = new Map();
    this.enumTypes = new Map();
  }

  /**
   * Resolves all types in the symbol table
   *
   * Main entry point for Pass 2 of semantic analysis.
   *
   * @param symbolTable - The symbol table from Pass 1
   * @param program - The Program AST node (for walking)
   * @returns The resolution result
   */
  public resolve(symbolTable: SymbolTable, program: Program): TypeResolutionResult {
    // Initialize fresh state
    this.symbolTable = symbolTable;
    this.diagnostics = [];
    this.resolvedCount = 0;
    this.failedCount = 0;
    this.typeAliases.clear();
    this.enumTypes.clear();

    // Phase 1: Collect type aliases and enum types (they must be resolved first)
    this.collectTypeDefinitions(program);

    // Phase 2: Resolve all symbol types
    this.resolveAllSymbols();

    return {
      success: this.failedCount === 0,
      diagnostics: this.diagnostics,
      resolvedCount: this.resolvedCount,
      failedCount: this.failedCount,
    };
  }

  /**
   * Gets the type system (for testing)
   */
  public getTypeSystem(): TypeSystem {
    return this.typeSystem;
  }

  /**
   * Gets collected diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  // ============================================
  // PHASE 1: COLLECT TYPE DEFINITIONS
  // ============================================

  /**
   * Collects type aliases and enum types from the AST
   *
   * These must be resolved first because other types may reference them.
   */
  protected collectTypeDefinitions(program: Program): void {
    // Walk the AST to find TypeDecl and EnumDecl nodes
    this.walk(program);
  }

  /**
   * Visit Type declaration - register type alias
   */
  override visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const aliasedTypeName = node.getAliasedType();

    // Resolve the aliased type
    const resolvedType = this.resolveTypeName(aliasedTypeName, node.getLocation());

    if (resolvedType) {
      // Register the alias with the resolved type (but keep original name for error messages)
      this.typeAliases.set(name, {
        ...resolvedType,
        name: name, // Use alias name for this type
      });
    }

    this.exitNode(node);
  }

  /**
   * Visit Enum declaration - register enum type
   */
  override visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const members = new Map<string, number>();

    // Calculate enum member values
    let nextValue = 0;
    for (const member of node.getMembers()) {
      if (member.value !== null) {
        nextValue = member.value;
      }
      members.set(member.name, nextValue);
      nextValue++;
    }

    // Create and register the enum type
    const enumType = this.typeSystem.createEnumType(name, members);
    this.enumTypes.set(name, enumType);

    this.exitNode(node);
  }

  // ============================================
  // PHASE 2: RESOLVE ALL SYMBOLS
  // ============================================

  /**
   * Resolves types for all symbols in the symbol table
   */
  protected resolveAllSymbols(): void {
    // Get all scopes and their symbols
    const allScopes = this.symbolTable.getAllScopes();

    for (const scope of allScopes.values()) {
      for (const symbol of scope.symbols.values()) {
        this.resolveSymbolType(symbol);
      }
    }
  }

  /**
   * Resolves the type for a single symbol
   *
   * @param symbol - The symbol to resolve
   */
  protected resolveSymbolType(symbol: Symbol): void {
    // Skip if already resolved (may have been resolved as dependency)
    if (symbol.type !== null) {
      return;
    }

    switch (symbol.kind) {
      case SymbolKind.Variable:
      case SymbolKind.Constant:
        this.resolveVariableType(symbol);
        break;

      case SymbolKind.Parameter:
        this.resolveParameterType(symbol);
        break;

      case SymbolKind.Function:
        this.resolveFunctionType(symbol);
        break;

      case SymbolKind.EnumMember:
        this.resolveEnumMemberType(symbol);
        break;

      case SymbolKind.ImportedSymbol:
        // Imported symbols are resolved during cross-module analysis
        // For now, leave as null
        break;

      case SymbolKind.Intrinsic:
        // Intrinsics have pre-defined types
        break;
    }
  }

  /**
   * Resolves the type for a variable or constant symbol
   */
  protected resolveVariableType(symbol: Symbol): void {
    const scope = symbol.scope;

    // Check if this is a for-loop variable (symbol is in a loop scope and
    // the scope's node is a ForStatement with a matching variable name)
    if (scope.kind === 'loop' && scope.node) {
      const forLoopType = this.resolveForLoopVariableType(symbol, scope.node);
      if (forLoopType !== null) {
        return; // Successfully resolved from for-loop
      }
    }

    // Find the corresponding AST node to get the type annotation
    // We need to find this through the symbol table's node reference
    const declaration = this.findVariableDeclaration(symbol.name, scope.node);

    if (!declaration) {
      // This shouldn't happen if the symbol table was built correctly
      // The symbol exists but we can't find its declaration
      return;
    }

    const typeAnnotation = declaration.getTypeAnnotation();

    if (!typeAnnotation) {
      // Type inference would happen here in a more sophisticated compiler
      // For now, we report an error if no type annotation is provided
      // Note: The type might be inferred from the initializer in Pass 3
      this.addError(
        DiagnosticCode.INVALID_TYPE,
        `Variable '${symbol.name}' has no type annotation`,
        symbol.location,
      );
      this.failedCount++;
      return;
    }

    const resolvedType = this.resolveTypeName(typeAnnotation, symbol.location);

    if (resolvedType) {
      symbol.type = resolvedType;
      this.resolvedCount++;
    } else {
      this.failedCount++;
    }
  }

  /**
   * Resolves the type for a for-loop variable
   *
   * For-loop variables get their type from the ForStatement node, not a VariableDecl.
   *
   * @param symbol - The loop variable symbol
   * @param node - The scope node (should be a ForStatement)
   * @returns true if this was a for-loop variable and type was resolved/failed,
   *          null if this is not a for-loop variable
   */
  protected resolveForLoopVariableType(symbol: Symbol, node: unknown): boolean | null {
    // Check if the node is a ForStatement and the variable matches
    if (
      node &&
      typeof node === 'object' &&
      'getVariable' in node &&
      'getVariableType' in node
    ) {
      const forStmt = node as ForStatement;
      const varName = forStmt.getVariable();

      // Check if this symbol is the for-loop's variable
      if (varName === symbol.name) {
        const typeAnnotation = forStmt.getVariableType();

        if (!typeAnnotation) {
          // For-loop without explicit type - default to byte
          const byteType = this.typeSystem.getBuiltinType('byte');
          if (byteType) {
            symbol.type = byteType;
            this.resolvedCount++;
            return true;
          }
          return true; // Handled (with failure)
        }

        const resolvedType = this.resolveTypeName(typeAnnotation, symbol.location);

        if (resolvedType) {
          symbol.type = resolvedType;
          this.resolvedCount++;
        } else {
          this.failedCount++;
        }

        return true; // Handled
      }
    }

    return null; // Not a for-loop variable
  }

  /**
   * Resolves the type for a parameter symbol
   */
  protected resolveParameterType(symbol: Symbol): void {
    // Parameters get their type annotation from the function declaration
    // Find the containing function to get the parameter info
    const functionScope = this.findContainingFunctionScope(symbol.scope);

    if (!functionScope || !functionScope.node) {
      return;
    }

    const funcDecl = functionScope.node as FunctionDecl;
    const param = funcDecl.getParameters().find((p) => p.name === symbol.name);

    if (!param) {
      return;
    }

    const resolvedType = this.resolveTypeName(param.typeAnnotation, param.location);

    if (resolvedType) {
      symbol.type = resolvedType;
      this.resolvedCount++;
    } else {
      this.failedCount++;
    }
  }

  /**
   * Resolves the type for a function symbol
   *
   * Creates a function type from parameter types and return type.
   */
  protected resolveFunctionType(symbol: Symbol): void {
    const funcDecl = symbol.declaration;

    if (!funcDecl) {
      return;
    }

    // Resolve parameter types first
    const parameterTypes: TypeInfo[] = [];
    for (const param of funcDecl.getParameters()) {
      const paramType = this.resolveTypeName(param.typeAnnotation, param.location);
      if (paramType) {
        parameterTypes.push(paramType);
      } else {
        // If any parameter type fails, we can't create the function type
        this.failedCount++;
        return;
      }
    }

    // Resolve return type
    const returnTypeName = funcDecl.getReturnType() ?? 'void';
    const returnType = this.resolveTypeName(returnTypeName, funcDecl.getLocation());

    if (!returnType) {
      this.failedCount++;
      return;
    }

    // Create function type
    const functionType = this.typeSystem.createFunctionType(
      parameterTypes,
      returnType,
      funcDecl.getParameters().map((p) => p.name),
    );

    symbol.type = functionType;
    this.resolvedCount++;

    // Also update the parameter symbols' types if not already resolved
    if (symbol.parameters) {
      for (let i = 0; i < symbol.parameters.length; i++) {
        const paramSymbol = symbol.parameters[i];
        if (paramSymbol.type === null && i < parameterTypes.length) {
          paramSymbol.type = parameterTypes[i];
        }
      }
    }
  }

  /**
   * Resolves the type for an enum member symbol
   *
   * Enum members have the type of their containing enum.
   */
  protected resolveEnumMemberType(symbol: Symbol): void {
    // Find the enum this member belongs to by looking at the scope
    // Enum members are declared in module scope, but we need to find
    // the associated enum declaration

    // For now, enum members are byte type (enums compile to bytes)
    symbol.type = this.typeSystem.getBuiltinType('byte') ?? null;
    if (symbol.type) {
      this.resolvedCount++;
    }
  }

  // ============================================
  // TYPE NAME RESOLUTION
  // ============================================

  /**
   * Resolves a type name string to a TypeInfo object
   *
   * Handles:
   * - Built-in types: byte, word, bool, void, string
   * - Type aliases: SpriteId -> byte
   * - Enum types: Direction
   * - Array types: byte[10], word[]
   *
   * @param typeName - The type name to resolve
   * @param location - Source location for error reporting
   * @returns The resolved TypeInfo, or undefined if resolution failed
   */
  protected resolveTypeName(typeName: string, location: SourceLocation): TypeInfo | undefined {
    // Handle array types first (e.g., "byte[10]", "word[]")
    const arrayMatch = typeName.match(/^(\w+)\[(\d*)\]$/);
    if (arrayMatch) {
      return this.resolveArrayType(arrayMatch[1], arrayMatch[2], location);
    }

    // Check built-in types
    const builtinType = this.typeSystem.getBuiltinType(typeName);
    if (builtinType) {
      return builtinType;
    }

    // Check type aliases
    const aliasedType = this.typeAliases.get(typeName);
    if (aliasedType) {
      return aliasedType;
    }

    // Check enum types
    const enumType = this.enumTypes.get(typeName);
    if (enumType) {
      return enumType;
    }

    // Unknown type
    this.addError(
      TypeResolverDiagnosticCodes.UNKNOWN_TYPE,
      `Unknown type '${typeName}'`,
      location,
      `Valid types: byte, word, bool, void, string, or defined type aliases and enums`,
    );

    return undefined;
  }

  /**
   * Resolves an array type
   *
   * @param elementTypeName - The element type name
   * @param sizeStr - The array size as a string (empty for unsized)
   * @param location - Source location for error reporting
   * @returns The resolved array TypeInfo, or undefined if resolution failed
   */
  protected resolveArrayType(
    elementTypeName: string,
    sizeStr: string,
    location: SourceLocation,
  ): TypeInfo | undefined {
    // Resolve the element type
    const elementType = this.resolveTypeName(elementTypeName, location);
    if (!elementType) {
      return undefined;
    }

    // Parse the size
    let size: number | undefined;
    if (sizeStr !== '') {
      size = parseInt(sizeStr, 10);
      if (isNaN(size) || size <= 0) {
        this.addError(
          TypeResolverDiagnosticCodes.INVALID_ARRAY_SIZE,
          `Invalid array size '${sizeStr}' - must be a positive integer`,
          location,
        );
        return undefined;
      }
    }

    return this.typeSystem.createArrayType(elementType, size);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Finds a variable declaration in an AST node
   *
   * Searches through the node's children to find the declaration.
   */
  protected findVariableDeclaration(name: string, node: unknown): VariableDecl | null {
    if (!node) {
      return null;
    }

    // Type check for VariableDecl
    if (node && typeof node === 'object' && 'getName' in node && 'getTypeAnnotation' in node) {
      const decl = node as VariableDecl;
      if (decl.getName() === name) {
        return decl;
      }
    }

    // Search through declarations in Program or statements in blocks
    if (node && typeof node === 'object') {
      const nodeObj = node as Record<string, unknown>;

      // Check declarations array (for Program)
      if (Array.isArray(nodeObj['declarations'])) {
        for (const decl of nodeObj['declarations']) {
          const found = this.findVariableDeclaration(name, decl);
          if (found) return found;
        }
      }

      // Check body array (for functions, blocks)
      if (Array.isArray(nodeObj['body'])) {
        for (const stmt of nodeObj['body']) {
          const found = this.findVariableDeclaration(name, stmt);
          if (found) return found;
        }
      }

      // Check statements array (for blocks)
      if (Array.isArray(nodeObj['statements'])) {
        for (const stmt of nodeObj['statements']) {
          const found = this.findVariableDeclaration(name, stmt);
          if (found) return found;
        }
      }
    }

    return null;
  }

  /**
   * Finds the containing function scope
   */
  protected findContainingFunctionScope(
    scope: Symbol['scope'],
  ): Symbol['scope'] | null {
    let current: Symbol['scope'] | null = scope;

    while (current) {
      if (current.kind === 'function') {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Adds an error diagnostic
   */
  protected addError(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string,
  ): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
  }

  /**
   * Adds a warning diagnostic
   */
  protected addWarning(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string,
  ): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
  }
}