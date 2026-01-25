/**
 * Type Resolver - Phase 2 Semantic Analysis Pass
 *
 * Resolves type annotations and annotates symbols with type information.
 * This is the second pass of semantic analysis, building on the symbol
 * table created in Phase 1.
 *
 * **Responsibilities:**
 * - Parse type annotation strings
 * - Resolve types for all declarations
 * - Annotate symbols with resolved TypeInfo
 * - Validate type names exist
 * - Report type resolution errors
 *
 * **Processing Order:**
 * 1. Variable declarations (@zp, @ram, @data)
 * 2. Memory-mapped declarations (@map)
 * 3. Function declarations (return type + parameters)
 *
 * **Type Annotation Format:**
 * - Simple types: "byte", "word", "boolean", "void", "string"
 * - Array types: "byte[]", "word[10]" (unsized or fixed-size)
 * - Future: callback types will need special handling
 */
import { ContextWalker } from '../../ast/walker/context.js';
import type { SourceLocation, Expression } from '../../ast/base.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type {
  VariableDecl,
  FunctionDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  ForStatement,
} from '../../ast/nodes.js';
import { isArrayLiteralExpression } from '../../ast/type-guards.js';
import { TypeSystem } from '../type-system.js';
import type { SymbolTable } from '../symbol-table.js';
import type { TypeInfo, FunctionSignature } from '../types.js';
import { TypeKind } from '../types.js';

/**
 * Type resolver visitor - resolves type annotations and annotates symbols
 *
 * This visitor walks the AST and resolves all type annotations, then
 * annotates the corresponding symbols in the symbol table with their
 * resolved TypeInfo.
 *
 * **Design:**
 * - Extends ContextWalker for scope awareness
 * - Uses TypeSystem for type creation and validation
 * - Reads from SymbolTable (created in Phase 1)
 * - Writes TypeInfo to Symbol.type field
 * - Collects diagnostics for type resolution errors
 *
 * **Usage:**
 * ```typescript
 * const resolver = new TypeResolver(symbolTable);
 * resolver.walk(programNode);
 * const diagnostics = resolver.getDiagnostics();
 * const typeSystem = resolver.getTypeSystem();
 * ```
 */
export class TypeResolver extends ContextWalker {
  /** Type system for type creation and validation */
  protected typeSystem: TypeSystem;

  /** Symbol table from Phase 1 */
  protected symbolTable: SymbolTable;

  /** Collected diagnostics (errors and warnings) */
  protected diagnostics: Diagnostic[];

  /**
   * Creates a new type resolver
   *
   * @param symbolTable - Symbol table from Phase 1 (Symbol Table Builder)
   */
  constructor(symbolTable: SymbolTable) {
    super();
    this.typeSystem = new TypeSystem();
    this.symbolTable = symbolTable;
    this.diagnostics = [];
  }

  /**
   * Get the type system instance
   *
   * Provides access to type system for subsequent analysis passes.
   *
   * @returns Type system with all built-in types and operations
   */
  public getTypeSystem(): TypeSystem {
    return this.typeSystem;
  }

  /**
   * Get collected diagnostics
   *
   * Returns all type resolution errors collected during traversal.
   *
   * @returns Array of diagnostic messages
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Report a diagnostic error or warning
   *
   * Adds diagnostic to the collection for later reporting.
   *
   * @param diagnostic - Diagnostic to report
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  // ============================================
  // VARIABLE DECLARATIONS
  // ============================================

  /**
   * Visit variable declaration - resolve type annotation
   *
   * Resolves the type annotation and annotates the symbol with the
   * resolved type. If no type annotation exists, the symbol is left
   * without a type (will be inferred in Phase 3).
   *
   * **Array Size Inference:**
   * If type annotation contains empty brackets (e.g., `byte[]`), the size
   * is inferred from the array literal initializer.
   *
   * @param node - Variable declaration node
   */
  public visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    const typeAnnotation = node.getTypeAnnotation();
    const initializer = node.getInitializer();

    // Resolve type annotation if present
    if (typeAnnotation) {
      let type = this.resolveTypeAnnotation(typeAnnotation, node.getLocation());

      // Check if array size needs to be inferred (type has undefined size)
      if (type.kind === TypeKind.Array && type.arraySize === undefined) {
        // Array size inference required
        if (!initializer) {
          // Error: empty brackets without initializer
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Cannot infer array size for '${node.getName()}': no initializer provided. Use explicit size (e.g., byte[10]) or provide an initializer.`,
            location: node.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        } else {
          // Infer size from initializer
          const inferredSize = this.inferArraySize(initializer, node.getLocation());
          if (inferredSize !== null) {
            // Create new array type with inferred size
            type = this.typeSystem.createArrayType(type.elementType!, inferredSize);
          }
          // If inference failed, type remains with undefined size (error already reported)
        }
      }

      // Annotate symbol with resolved type (with inferred size if applicable)
      const symbol = this.symbolTable.lookup(node.getName());
      if (symbol) {
        symbol.type = type;
      }
    }

    // Visit initializer if present (will be type-checked in Phase 3)
    if (initializer && !this.shouldSkip && !this.shouldStop) {
      initializer.accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Visit simple @map declaration - resolve type annotation
   *
   * Resolves type annotation for simple memory-mapped variable.
   *
   * @param node - Simple @map declaration node
   */
  public visitSimpleMapDecl(node: SimpleMapDecl): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    // Resolve type annotation
    const type = this.resolveTypeAnnotation(node.getTypeAnnotation(), node.getLocation());

    // Annotate symbol with resolved type
    const symbol = this.symbolTable.lookup(node.getName());
    if (symbol) {
      symbol.type = type;
    }

    // Visit address expression
    node.getAddress().accept(this);

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit range @map declaration - resolve type annotation
   *
   * Resolves type annotation for range memory-mapped variable.
   * The type represents the element type, not the full array.
   *
   * @param node - Range @map declaration node
   */
  public visitRangeMapDecl(node: RangeMapDecl): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    // Resolve element type annotation
    const elementType = this.resolveTypeAnnotation(node.getTypeAnnotation(), node.getLocation());

    // Create array type (size unknown at compile time from addresses)
    const arrayType = this.typeSystem.createArrayType(elementType);

    // Annotate symbol with array type
    const symbol = this.symbolTable.lookup(node.getName());
    if (symbol) {
      symbol.type = arrayType;
    }

    // Visit address expressions
    node.getStartAddress().accept(this);
    if (!this.shouldStop) {
      node.getEndAddress().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit sequential struct @map declaration - resolve field types
   *
   * Resolves type annotations for all fields in the struct.
   *
   * @param node - Sequential struct @map declaration node
   */
  public visitSequentialStructMapDecl(node: SequentialStructMapDecl): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    // Visit base address expression
    node.getBaseAddress().accept(this);

    // Process fields (type resolution handled when accessing fields)
    // Symbol for the struct itself doesn't need type annotation
    // Fields will be accessed as members

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit explicit struct @map declaration - resolve field types
   *
   * Resolves type annotations for all fields in the struct.
   *
   * @param node - Explicit struct @map declaration node
   */
  public visitExplicitStructMapDecl(node: ExplicitStructMapDecl): void {
    if (this.shouldStop) return;

    this.enterNode(node);

    // Visit base address expression
    node.getBaseAddress().accept(this);

    // Process fields (type resolution handled when accessing fields)
    // Symbol for the struct itself doesn't need type annotation
    // Fields will be accessed as members

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // FOR STATEMENT - LOOP VARIABLE TYPE RESOLUTION
  // ============================================

  /** Visit for statement - resolve loop variable type */
  public visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    const varName = node.getVariable();
    const startType = this.resolveExpressionType(node.getStart());
    const endType = this.resolveExpressionType(node.getEnd());
    let varType: TypeInfo;
    if (startType.kind === TypeKind.Word || endType.kind === TypeKind.Word) {
      varType = this.typeSystem.getBuiltinType('word')!;
    } else {
      varType = this.typeSystem.getBuiltinType('byte')!;
    }
    const symbol = this.symbolTable.lookup(varName);
    if (symbol) symbol.type = varType;
    if (!this.shouldSkip && !this.shouldStop) node.getStart().accept(this);
    if (!this.shouldSkip && !this.shouldStop) node.getEnd().accept(this);
    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }
    this.shouldSkip = false;
    this.exitNode(node);
  }

  /** Resolve type of expression for loop variable inference */
  protected resolveExpressionType(expr: Expression): TypeInfo {
    const anyExpr = expr as any;
    if (typeof anyExpr.getValue === 'function') {
      const value = anyExpr.getValue();
      if (typeof value === 'number' && (value > 255 || value < 0)) return this.typeSystem.getBuiltinType('word')!;
      if (typeof value === 'number') return this.typeSystem.getBuiltinType('byte')!;
    }
    if (typeof anyExpr.getName === 'function') {
      const symbol = this.symbolTable.lookup(anyExpr.getName());
      if (symbol?.type) return symbol.type;
    }
    return this.typeSystem.getBuiltinType('byte')!;
  }

  // ============================================
  // FUNCTION DECLARATIONS
  // ============================================

  /**
   * Visit function declaration - resolve return type and parameters
   *
   * Resolves:
   * - Return type annotation (defaults to void if not specified)
   * - Parameter type annotations
   * - Creates function signature
   * - Creates callback type for function
   * - Annotates function symbol and parameter symbols
   *
   * **Critical:** This method must enter the function's scope to annotate
   * parameter symbols, which are declared in the function scope by Phase 1.
   *
   * @param node - Function declaration node
   */
  public visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;

    // Resolve return type (default to void if not specified)
    const returnTypeStr = node.getReturnType();
    const returnType = returnTypeStr
      ? this.resolveTypeAnnotation(returnTypeStr, node.getLocation())
      : this.typeSystem.getBuiltinType('void')!;

    // Resolve parameter types
    const parameters = node.getParameters();
    const parameterTypes: TypeInfo[] = [];
    const parameterNames: string[] = [];

    for (const param of parameters) {
      const paramType = this.resolveTypeAnnotation(param.typeAnnotation, param.location);
      parameterTypes.push(paramType);
      parameterNames.push(param.name);
    }

    // Create function signature
    const signature: FunctionSignature = {
      parameters: parameterTypes,
      returnType,
      parameterNames,
    };

    // Create callback type for function
    const functionType = this.typeSystem.createCallbackType(signature);

    // Annotate function symbol with type (in current/module scope)
    const symbol = this.symbolTable.lookup(node.getName());
    if (symbol) {
      symbol.type = functionType;
    }

    // Find the function's scope created in Phase 1
    // Parameters are declared in this scope, so we must enter it to annotate them
    const currentScope = this.symbolTable.getCurrentScope();
    const childScopes = currentScope.children || [];
    const functionScope = childScopes.find(scope => scope.node === node);

    if (!functionScope) {
      // This shouldn't happen if Phase 1 ran correctly
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error: Function scope not found for '${node.getName()}'`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Still call parent to maintain context
      super.visitFunctionDecl(node);
      return;
    }

    // Enter function scope to access parameters
    // NOTE: SymbolTable scope and WalkerContext are separate concepts:
    // - SymbolTable.enterScope: Gives access to symbols declared in this scope
    // - WalkerContext.enterContext: Tracks what kind of construct we're in (function, loop, etc.)
    // We manage symbolTable scope manually here; super.visitFunctionDecl manages context.
    this.symbolTable.enterScope(functionScope);

    try {
      // Now annotate parameter symbols with their types
      // Parameters are in the current (function) scope
      for (let i = 0; i < parameters.length; i++) {
        const param = parameters[i];
        const paramType = parameterTypes[i];

        const paramSymbol = this.symbolTable.lookup(param.name);
        if (paramSymbol) {
          paramSymbol.type = paramType;
        }
      }

      // Visit function body with ContextWalker handling
      // (ContextWalker will automatically manage function context)
      super.visitFunctionDecl(node);
    } finally {
      // Exit function scope - guaranteed even if visiting throws
      this.symbolTable.exitScope();
    }
  }

  // ============================================
  // TYPE ANNOTATION RESOLUTION
  // ============================================

  /**
   * Resolve a type annotation string to TypeInfo
   *
   * Parses type annotation strings and resolves them to TypeInfo objects.
   *
   * **Supported formats:**
   * - Simple types: "byte", "word", "boolean", "void", "string"
   * - Unsized arrays: "byte[]", "word[]"
   * - Sized arrays: "byte[10]", "word[256]"
   *
   * **Future:**
   * - Callback types (when AST representation is available)
   * - Custom type aliases
   *
   * @param annotation - Type annotation string
   * @param location - Source location for error reporting
   * @returns Resolved TypeInfo or unknown type if resolution fails
   */
  protected resolveTypeAnnotation(annotation: string, location: SourceLocation): TypeInfo {
    // Trim whitespace
    const trimmed = annotation.trim();

    // Check for array type syntax: type[] or type[size]
    const arrayMatch = trimmed.match(/^(\w+)\[(\d*)\]$/);
    if (arrayMatch) {
      const [, elementTypeName, sizeStr] = arrayMatch;

      // Resolve element type
      const elementType = this.typeSystem.getBuiltinType(elementTypeName);
      if (!elementType) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Unknown element type '${elementTypeName}' in array type`,
          location,
          code: DiagnosticCode.TYPE_MISMATCH,
        });

        return {
          kind: TypeKind.Unknown,
          name: 'unknown',
          size: 0,
          isSigned: false,
          isAssignable: false,
        };
      }

      // Parse size if present
      const size = sizeStr ? parseInt(sizeStr, 10) : undefined;

      return this.typeSystem.createArrayType(elementType, size);
    }

    // Simple type (byte, word, boolean, void, string)
    const builtinType = this.typeSystem.getBuiltinType(trimmed);
    if (builtinType) {
      return builtinType;
    }

    // Unknown type - report error
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `Unknown type '${trimmed}'`,
      location,
      code: DiagnosticCode.TYPE_MISMATCH,
    });

    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }

  // ============================================
  // ARRAY SIZE INFERENCE
  // ============================================

  /**
   * Infer array size from initializer expression
   *
   * Analyzes the initializer to determine the array size. Only array
   * literal expressions can be used for size inference.
   *
   * **Inference Rules:**
   * 1. Must be an array literal expression: `[1, 2, 3]`
   * 2. Size is the number of elements in the literal
   * 3. Nested arrays are supported (recursive inference)
   * 4. Non-literal expressions cannot be used for inference
   *
   * **Examples:**
   * - `[1, 2, 3]` � size 3
   * - `[[1, 2], [3, 4]]` � size 2 (outer dimension)
   * - `variable` � cannot infer (error)
   *
   * @param initializer - Initializer expression to analyze
   * @param location - Source location for error reporting
   * @returns Inferred size, or null if inference failed
   */
  protected inferArraySize(initializer: Expression, location: SourceLocation): number | null {
    // Only array literals can be used for size inference
    if (!isArrayLiteralExpression(initializer)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message:
          'Cannot infer array size from non-literal initializer. Array size inference requires an array literal (e.g., [1, 2, 3]).',
        location,
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      return null;
    }

    // Get element count from array literal
    const size = initializer.getElementCount();

    // Validate size is reasonable (at least 1)
    if (size === 0) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message:
          'Cannot infer size from empty array literal. Specify explicit size (e.g., byte[0]) or add elements.',
        location,
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      return null;
    }

    return size;
  }
}