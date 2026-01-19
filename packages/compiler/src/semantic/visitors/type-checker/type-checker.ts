/**
 * TypeChecker - Final Concrete Implementation
 *
 * The complete type checker with all layers:
 * - Base: Infrastructure and helpers
 * - Literals: Literal expressions and identifiers
 * - Expressions: Binary and unary operations
 * - Assignments: Assignment and complex expressions
 * - Declarations: Variable, function, and @map declarations
 * - Statements: Control flow and statement validation
 *
 * This is the concrete class that should be instantiated for type checking.
 */

import { TypeCheckerStatements } from './statements.js';
import type { SymbolTable } from '../../symbol-table.js';
import type { TypeSystem } from '../../type-system.js';

/**
 * TypeChecker - Type checks all expressions and statements
 *
 * This visitor walks the AST and:
 * 1. Computes types for all expressions
 * 2. Validates type compatibility
 * 3. Annotates nodes with type information
 * 4. Validates statement-level semantics
 * 5. Collects comprehensive diagnostics
 *
 * **Design:**
 * - Extends TypeCheckerStatements (which extends the full chain)
 * - All visitor methods inherited from layers
 * - Provides public API for usage
 *
 * **Usage:**
 * ```typescript
 * const checker = new TypeChecker(symbolTable, typeSystem);
 * checker.walk(program);
 * const diagnostics = checker.getDiagnostics();
 * ```
 */
export class TypeChecker extends TypeCheckerStatements {
  /**
   * Creates a new TypeChecker
   *
   * @param symbolTable - Symbol table from Phase 1 (SymbolTableBuilder)
   * @param typeSystem - Type system from Phase 2 (TypeResolver)
   */
  constructor(symbolTable: SymbolTable, typeSystem: TypeSystem) {
    super(symbolTable, typeSystem);
  }

  // All visitor methods are inherited from the layer hierarchy:
  // - TypeCheckerBase: Helper methods and infrastructure
  // - TypeCheckerLiterals: visitLiteralExpression, visitArrayLiteralExpression, visitIdentifierExpression
  // - TypeCheckerExpressions: visitBinaryExpression, visitUnaryExpression
  // - TypeCheckerAssignments: visitAssignmentExpression, visitCallExpression, visitIndexExpression, visitMemberExpression
  // - TypeCheckerDeclarations: visitFunctionDecl, visitVariableDecl, visit*MapDecl
  // - TypeCheckerStatements: visitWhileStatement, visitForStatement, visitIfStatement, visitBreakStatement, visitContinueStatement, visitReturnStatement, visitExpressionStatement
}
