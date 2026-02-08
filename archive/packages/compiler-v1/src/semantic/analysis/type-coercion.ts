/**
 * Type Coercion Analysis (IL Readiness)
 *
 * Analyzes where type conversions are needed and marks AST nodes
 * with coercion metadata for IL generation. This allows the IL
 * generator to insert appropriate conversion operations without
 * re-analyzing types.
 *
 * **Purpose**: Identify WHERE type coercions occur, not just IF they're valid.
 * The type checker validates compatibility; this pass marks conversion points.
 *
 * **Coercion Types**:
 * - ZeroExtend: byte → word (add high byte of 0x00)
 * - Truncate: word → byte (take low byte only)
 * - BoolToByte: boolean → byte (false=0, true=1)
 * - ByteToBool: byte → boolean (0=false, non-zero=true)
 * - BoolToWord: boolean → word (false=0x0000, true=0x0001)
 * - WordToBool: word → boolean (0x0000=false, non-zero=true)
 *
 * **Analyzed Locations**:
 * - Assignments (value → target type)
 * - Function arguments (arg → parameter type)
 * - Return statements (expr → return type)
 * - Binary expressions (operand promotion)
 * - Array indices (must be numeric)
 *
 * @example
 * ```typescript
 * const analyzer = new TypeCoercionAnalyzer(symbolTable, typeSystem);
 * analyzer.analyze(ast);
 * // Nodes now have TypeCoercionRequired, TypeCoercionSourceType, etc.
 * ```
 */

import type { Program } from '../../ast/nodes.js';
import type {
  BinaryExpression,
  CallExpression,
  IndexExpression,
  FunctionDecl,
  VariableDecl,
  ReturnStatement,
  ExpressionStatement,
  AssignmentExpression,
} from '../../ast/nodes.js';
import type { ASTNode } from '../../ast/base.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey, TypeCoercionKind } from './optimization-metadata-keys.js';
import { TypeInfo, TypeKind } from '../types.js';
import { TypeSystem } from '../type-system.js';
import { SymbolTable } from '../symbol-table.js';
import { SymbolKind } from '../symbol.js';
import { isIdentifierExpression, isAssignmentExpression } from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import type { Diagnostic } from '../../ast/diagnostics.js';

/**
 * Information about a type coercion point
 */
export interface CoercionInfo {
  /** The kind of coercion needed */
  kind: TypeCoercionKind;

  /** Source type before coercion */
  sourceType: TypeInfo;

  /** Target type after coercion */
  targetType: TypeInfo;

  /** Is this an implicit coercion? (always true for this analyzer) */
  isImplicit: boolean;

  /** Estimated cost in CPU cycles */
  cost: number;
}

/**
 * Type Coercion Analyzer
 *
 * Traverses the AST after type checking and marks nodes where
 * type conversions are needed. This metadata is consumed by
 * the IL generator to insert appropriate conversion operations.
 */
export class TypeCoercionAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Coercion info collected during analysis */
  protected coercions: Map<ASTNode, CoercionInfo> = new Map();

  /** Current function's return type (for return statement checking) */
  protected currentReturnType: TypeInfo | null = null;

  /**
   * Creates a type coercion analyzer
   *
   * @param symbolTable - Symbol table with variable/function info
   * @param typeSystem - Type system for type comparison
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly typeSystem: TypeSystem
  ) {
    super();
  }

  /**
   * Analyze type coercions for entire program
   *
   * Traverses the AST and marks nodes where type coercions are needed.
   * This pass should run AFTER type checking so that typeInfo is set on nodes.
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    // Reset state
    this.diagnostics = [];
    this.coercions.clear();
    this.currentReturnType = null;

    // Walk the AST using inherited walk() method
    this.walk(ast);
  }

  /**
   * Get all coercion information collected during analysis
   *
   * @returns Map of AST nodes to coercion info
   */
  public getCoercions(): Map<ASTNode, CoercionInfo> {
    return new Map(this.coercions);
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
   * Visit function declaration - track return type for return statements
   */
  public visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Store current return type for checking return statements
    const prevReturnType = this.currentReturnType;
    this.currentReturnType = this.getFunctionReturnType(node);

    // Visit function body (if present - stub functions have null body)
    if (!this.shouldSkip && !this.shouldStop) {
      const body = node.getBody();
      if (body) {
        for (const stmt of body) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    // Restore previous return type
    this.currentReturnType = prevReturnType;

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit variable declaration - check initializer coercion
   *
   * Example: let w: word = byteValue; // byte → word coercion
   */
  public visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit initializer if present
    if (!this.shouldSkip && !this.shouldStop) {
      const initializer = node.getInitializer();
      if (initializer) {
        // First visit the initializer
        initializer.accept(this);

        // Then check for coercion
        const targetType = this.getNodeTypeInfo(node);
        const sourceType = this.getNodeTypeInfo(initializer);

        if (targetType && sourceType) {
          this.checkAndMarkCoercion(initializer, sourceType, targetType);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit expression statement - check for assignment coercions
   */
  public visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      const expr = node.getExpression();
      expr.accept(this);

      // After visiting, check if it's an assignment
      if (isAssignmentExpression(expr)) {
        this.checkAssignmentCoercion(expr as AssignmentExpression);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit binary expression - check operand promotion
   *
   * Example: byte + word → both promoted to word
   */
  public visitBinaryExpression(node: BinaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit left and right operands
      node.getLeft().accept(this);
      if (!this.shouldStop) {
        node.getRight().accept(this);
      }

      // After visiting children, check for operand coercions
      const operator = node.getOperator();
      const left = node.getLeft();
      const right = node.getRight();

      const leftType = this.getNodeTypeInfo(left);
      const rightType = this.getNodeTypeInfo(right);

      if (leftType && rightType) {
        // For arithmetic and bitwise operators, operands may need promotion
        if (this.isArithmeticOrBitwiseOperator(operator)) {
          // If one is word and other is byte, byte needs zero-extension
          if (leftType.kind === TypeKind.Byte && rightType.kind === TypeKind.Word) {
            this.checkAndMarkCoercion(left, leftType, rightType);
          } else if (leftType.kind === TypeKind.Word && rightType.kind === TypeKind.Byte) {
            this.checkAndMarkCoercion(right, rightType, leftType);
          }
        }

        // For logical operators, operands should be boolean
        if (this.isLogicalOperator(operator)) {
          if (leftType.kind !== TypeKind.Boolean) {
            const boolType = this.typeSystem.getBuiltinType('boolean')!;
            this.checkAndMarkCoercion(left, leftType, boolType);
          }
          if (rightType.kind !== TypeKind.Boolean) {
            const boolType = this.typeSystem.getBuiltinType('boolean')!;
            this.checkAndMarkCoercion(right, rightType, boolType);
          }
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit call expression - check argument coercions
   *
   * Example: fn(word) called with byte argument → byte → word
   */
  public visitCallExpression(node: CallExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit callee
      node.getCallee().accept(this);

      // Visit arguments
      const args = node.getArguments();
      for (const arg of args) {
        if (this.shouldStop) break;
        arg.accept(this);
      }

      // After visiting, check argument coercions
      const callee = node.getCallee();
      if (isIdentifierExpression(callee)) {
        const funcName = callee.getName();
        const funcSymbol = this.symbolTable.lookup(funcName);

        if (funcSymbol && funcSymbol.kind === SymbolKind.Function) {
          const signature = funcSymbol.type?.signature;
          if (signature) {
            const params = signature.parameters || [];

            // Check each argument against its parameter type
            for (let i = 0; i < Math.min(args.length, params.length); i++) {
              const arg = args[i];
              const paramType = params[i];
              const argType = this.getNodeTypeInfo(arg);

              if (argType && paramType) {
                this.checkAndMarkCoercion(arg, argType, paramType);
              }
            }
          }
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit return statement - check return value coercion
   *
   * Example: function returns word, but returning byte → byte → word
   */
  public visitReturnStatement(node: ReturnStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      const value = node.getValue();
      if (value) {
        value.accept(this);

        // After visiting, check for return type coercion
        if (this.currentReturnType) {
          const exprType = this.getNodeTypeInfo(value);
          if (exprType) {
            this.checkAndMarkCoercion(value, exprType, this.currentReturnType);
          }
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit index expression - check index is numeric
   *
   * Example: array[boolIndex] → bool → byte for index
   */
  public visitIndexExpression(node: IndexExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getObject().accept(this);
      if (!this.shouldStop) {
        node.getIndex().accept(this);
      }

      // After visiting, check index type
      const index = node.getIndex();
      const indexType = this.getNodeTypeInfo(index);

      if (indexType) {
        // Index should be numeric (byte or word)
        if (indexType.kind === TypeKind.Boolean) {
          const byteType = this.typeSystem.getBuiltinType('byte')!;
          this.checkAndMarkCoercion(index, indexType, byteType);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check assignment and mark coercion on value if needed
   */
  protected checkAssignmentCoercion(node: AssignmentExpression): void {
    const target = node.getTarget();
    const value = node.getValue();

    const targetType = this.getNodeTypeInfo(target);
    const valueType = this.getNodeTypeInfo(value);

    if (targetType && valueType) {
      this.checkAndMarkCoercion(value, valueType, targetType);
    }
  }

  /**
   * Check if coercion is needed and mark the node if so
   *
   * @param node - AST node to potentially mark
   * @param sourceType - Current type of the expression
   * @param targetType - Required type
   */
  protected checkAndMarkCoercion(
    node: ASTNode,
    sourceType: TypeInfo,
    targetType: TypeInfo
  ): void {
    const coercionKind = this.determineCoercionKind(sourceType, targetType);

    if (coercionKind === TypeCoercionKind.None) {
      return; // No coercion needed
    }

    const cost = this.estimateCoercionCost(coercionKind);

    const info: CoercionInfo = {
      kind: coercionKind,
      sourceType,
      targetType,
      isImplicit: true,
      cost,
    };

    // Store in our map
    this.coercions.set(node, info);

    // Mark the node with metadata
    this.markNodeWithCoercion(node, info);
  }

  /**
   * Determine what kind of coercion is needed
   *
   * @param from - Source type
   * @param to - Target type
   * @returns Coercion kind, or None if no coercion needed
   */
  protected determineCoercionKind(from: TypeInfo, to: TypeInfo): TypeCoercionKind {
    // Same type = no coercion
    if (from.kind === to.kind) {
      return TypeCoercionKind.None;
    }

    // byte → word (zero extension)
    if (from.kind === TypeKind.Byte && to.kind === TypeKind.Word) {
      return TypeCoercionKind.ZeroExtend;
    }

    // word → byte (truncation)
    if (from.kind === TypeKind.Word && to.kind === TypeKind.Byte) {
      return TypeCoercionKind.Truncate;
    }

    // boolean → byte
    if (from.kind === TypeKind.Boolean && to.kind === TypeKind.Byte) {
      return TypeCoercionKind.BoolToByte;
    }

    // byte → boolean
    if (from.kind === TypeKind.Byte && to.kind === TypeKind.Boolean) {
      return TypeCoercionKind.ByteToBool;
    }

    // boolean → word
    if (from.kind === TypeKind.Boolean && to.kind === TypeKind.Word) {
      return TypeCoercionKind.BoolToWord;
    }

    // word → boolean
    if (from.kind === TypeKind.Word && to.kind === TypeKind.Boolean) {
      return TypeCoercionKind.WordToBool;
    }

    // No known coercion
    return TypeCoercionKind.None;
  }

  /**
   * Estimate the CPU cycle cost of a coercion operation
   *
   * These are approximate 6502 cycle costs:
   * - ZeroExtend: ~4 cycles (store to low byte, zero high byte)
   * - Truncate: ~2 cycles (just take low byte)
   * - BoolToByte: ~0 cycles (same representation)
   * - ByteToBool: ~4 cycles (compare to zero)
   * - BoolToWord: ~4 cycles (zero high byte)
   * - WordToBool: ~6 cycles (OR both bytes, compare)
   *
   * @param kind - Coercion kind
   * @returns Estimated cycle cost
   */
  protected estimateCoercionCost(kind: TypeCoercionKind): number {
    switch (kind) {
      case TypeCoercionKind.ZeroExtend:
        return 4;
      case TypeCoercionKind.Truncate:
        return 2;
      case TypeCoercionKind.BoolToByte:
        return 0; // Same representation in 6502
      case TypeCoercionKind.ByteToBool:
        return 4;
      case TypeCoercionKind.BoolToWord:
        return 4;
      case TypeCoercionKind.WordToBool:
        return 6;
      case TypeCoercionKind.None:
      default:
        return 0;
    }
  }

  /**
   * Mark an AST node with coercion metadata
   *
   * @param node - AST node to mark
   * @param info - Coercion information
   */
  protected markNodeWithCoercion(node: ASTNode, info: CoercionInfo): void {
    // Initialize metadata map if needed
    if (!(node as any).metadata) {
      (node as any).metadata = new Map<string, unknown>();
    }

    const metadata = (node as any).metadata as Map<string, unknown>;

    metadata.set(OptimizationMetadataKey.TypeCoercionRequired, info.kind);
    metadata.set(OptimizationMetadataKey.TypeCoercionSourceType, info.sourceType);
    metadata.set(OptimizationMetadataKey.TypeCoercionTargetType, info.targetType);
    metadata.set(OptimizationMetadataKey.TypeCoercionImplicit, info.isImplicit);
    metadata.set(OptimizationMetadataKey.TypeCoercionCost, info.cost);
  }

  /**
   * Get type info from a node (set by type checker)
   *
   * @param node - AST node
   * @returns TypeInfo or undefined
   */
  protected getNodeTypeInfo(node: ASTNode): TypeInfo | undefined {
    return (node as any).typeInfo;
  }

  /**
   * Get return type of a function declaration
   *
   * @param node - Function declaration node
   * @returns Return type or void
   */
  protected getFunctionReturnType(node: FunctionDecl): TypeInfo {
    // Try to get from typeInfo first
    const typeInfo = this.getNodeTypeInfo(node);
    if (typeInfo?.signature?.returnType) {
      return typeInfo.signature.returnType;
    }

    // Try to get from symbol table
    const funcName = node.getName();
    const symbol = this.symbolTable.lookup(funcName);
    if (symbol?.type?.signature?.returnType) {
      return symbol.type.signature.returnType;
    }

    // Default to void
    return this.typeSystem.getBuiltinType('void')!;
  }

  /**
   * Check if operator is arithmetic or bitwise
   */
  protected isArithmeticOrBitwiseOperator(op: TokenType): boolean {
    return [
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.MULTIPLY,
      TokenType.DIVIDE,
      TokenType.MODULO,
      TokenType.BITWISE_AND,
      TokenType.BITWISE_OR,
      TokenType.BITWISE_XOR,
      TokenType.LEFT_SHIFT,
      TokenType.RIGHT_SHIFT,
    ].includes(op);
  }

  /**
   * Check if operator is logical
   */
  protected isLogicalOperator(op: TokenType): boolean {
    return [TokenType.AND, TokenType.OR].includes(op);
  }
}