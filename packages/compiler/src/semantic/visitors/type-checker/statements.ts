/**
 * Statement Type Checker for Blend65 Compiler v2
 *
 * Extends DeclarationTypeChecker to add type checking for all statement types:
 * - If statements (condition must be bool or numeric)
 * - While statements (condition must be bool or numeric)
 * - Do-while statements (condition must be bool or numeric)
 * - For statements (validates range expressions, infers counter type)
 * - Switch statements (validates case types match switch value)
 * - Return statements (validates return type matches function)
 * - Break statements (validates inside loop or switch)
 * - Continue statements (validates inside loop)
 * - Expression statements (just evaluates the expression)
 * - Block statements (evaluates all statements in scope)
 *
 * This is the fifth layer of the type checker inheritance chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker →
 * DeclarationTypeChecker → StatementTypeChecker → TypeChecker
 *
 * @module semantic/visitors/type-checker/statements
 */

import type {
  IfStatement,
  WhileStatement,
  DoWhileStatement,
  ForStatement,
  SwitchStatement,
  MatchStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
} from '../../../ast/statements.js';
import type { SourceLocation } from '../../../ast/base.js';
import { DeclarationTypeChecker } from './declarations.js';
import { TypeCheckDiagnosticCodes } from './base.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticCode } from '../../../ast/diagnostics.js';

/**
 * Diagnostic codes specific to statement type checking
 */
export const StatementDiagnosticCodes = {
  /** Condition must be boolean or numeric */
  INVALID_CONDITION_TYPE: 'S040' as DiagnosticCode,

  /** Return type mismatch */
  RETURN_TYPE_MISMATCH: 'S041' as DiagnosticCode,

  /** Return with value in void function */
  RETURN_VALUE_IN_VOID: 'S042' as DiagnosticCode,

  /** Return without value in non-void function */
  MISSING_RETURN_VALUE: 'S043' as DiagnosticCode,

  /** Break outside loop or switch */
  BREAK_OUTSIDE_LOOP: 'S044' as DiagnosticCode,

  /** Continue outside loop */
  CONTINUE_OUTSIDE_LOOP: 'S045' as DiagnosticCode,

  /** For loop range type mismatch */
  FOR_RANGE_TYPE_MISMATCH: 'S046' as DiagnosticCode,

  /** For loop step must be positive */
  FOR_STEP_INVALID: 'S047' as DiagnosticCode,

  /** Switch case type mismatch */
  SWITCH_CASE_TYPE_MISMATCH: 'S048' as DiagnosticCode,

  /** Duplicate switch case value */
  DUPLICATE_SWITCH_CASE: 'S049' as DiagnosticCode,
} as const;

/**
 * Statement Type Checker - Type checking for all statement types
 *
 * Handles type checking for statements:
 *
 * **If Statements:**
 * - Condition must be bool or numeric type
 * - Type checks both then and else branches
 * - Creates scopes for each branch
 *
 * **While Statements:**
 * - Condition must be bool or numeric type
 * - Tracks loop depth for break/continue validation
 * - Type checks loop body
 *
 * **Do-While Statements:**
 * - Same as while, but body executes at least once
 * - Condition checked after first iteration
 *
 * **For Statements:**
 * - Validates start/end expressions are numeric
 * - Infers counter type based on range
 * - Validates step expression if present
 * - Tracks loop depth for break/continue
 *
 * **Switch Statements:**
 * - Value expression must be numeric
 * - All case values must match switch value type
 * - Tracks switch context for break validation
 *
 * **Return Statements:**
 * - Return type must match function declaration
 * - Void functions cannot return values
 * - Non-void functions must return a value
 *
 * **Break/Continue Statements:**
 * - Break must be inside loop or switch
 * - Continue must be inside loop only
 *
 * @example
 * ```typescript
 * class MyChecker extends StatementTypeChecker {
 *   // Override to add custom statement checking
 *   override visitIfStatement(node: IfStatement): void {
 *     super.visitIfStatement(node);
 *     // Custom logic here
 *   }
 * }
 * ```
 */
export abstract class StatementTypeChecker extends DeclarationTypeChecker {
  // ============================================
  // CONTEXT TRACKING
  // ============================================

  /**
   * Current loop nesting depth (for break/continue validation)
   * 0 = not in a loop, 1+ = nested loop depth
   */
  protected loopDepth: number = 0;

  /**
   * Current switch nesting depth (for break validation)
   * 0 = not in switch, 1+ = nested switch depth
   */
  protected switchDepth: number = 0;

  // ============================================
  // IF STATEMENT
  // ============================================

  /**
   * Type check an if statement
   *
   * Validates:
   * 1. Condition expression is bool or numeric
   * 2. Then branch statements type check correctly (in block scope)
   * 3. Else branch statements type check correctly (in block scope, if present)
   *
   * The SymbolTableBuilder creates separate block scopes for the then and else
   * branches, both using the same if statement node as the scope key. We use
   * enterChildScopeByNodeIndex to enter the correct scope (0 for then, 1 for else).
   *
   * @param node - The if statement node
   */
  override visitIfStatement(node: IfStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const condition = node.getCondition();
    const thenBranch = node.getThenBranch();
    const elseBranch = node.getElseBranch();

    // Type check the condition (in parent scope, before entering block scopes)
    condition.accept(this);
    const conditionType = this.getTypeOf(condition);

    // Validate condition type is bool or numeric
    if (conditionType && !this.isConditionType(conditionType)) {
      this.reportInvalidConditionType(conditionType, node.getLocation(), 'if');
    }

    // Type check then branch in its block scope
    // The then branch scope is the first scope created for this node (index 0)
    if (!this.shouldStop) {
      this.enterChildScopeByNodeIndex(node, 0);
      for (const stmt of thenBranch) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      this.exitScope();
    }

    // Type check else branch in its block scope (if present)
    // The else branch scope is the second scope created for this node (index 1)
    if (!this.shouldStop && elseBranch) {
      this.enterChildScopeByNodeIndex(node, 1);
      for (const stmt of elseBranch) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      this.exitScope();
    }

    this.exitNode(node);
  }

  // ============================================
  // WHILE STATEMENT
  // ============================================

  /**
   * Type check a while statement
   *
   * Validates:
   * 1. Condition expression is bool or numeric
   * 2. Body statements type check correctly (in loop scope)
   *
   * The SymbolTableBuilder creates a loop scope for the while body. We must
   * enter this scope for proper symbol resolution of variables declared in the loop.
   *
   * @param node - The while statement node
   */
  override visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const condition = node.getCondition();
    const body = node.getBody();

    // Type check the condition (in parent scope, before entering loop scope)
    condition.accept(this);
    const conditionType = this.getTypeOf(condition);

    // Validate condition type is bool or numeric
    if (conditionType && !this.isConditionType(conditionType)) {
      this.reportInvalidConditionType(conditionType, node.getLocation(), 'while');
    }

    // Enter the loop scope created by the symbol table builder
    // This scope contains any variables declared in the loop body
    this.enterChildScopeForNode(node);

    // Enter loop context for break/continue validation
    this.loopDepth++;

    // Type check body in the loop scope
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit loop context
    this.loopDepth--;

    // Exit the loop scope
    this.exitScope();

    this.exitNode(node);
  }

  // ============================================
  // DO-WHILE STATEMENT
  // ============================================

  /**
   * Type check a do-while statement
   *
   * Validates:
   * 1. Body statements type check correctly (in loop scope)
   * 2. Condition expression is bool or numeric
   *
   * The SymbolTableBuilder creates a loop scope for the do-while body. We must
   * enter this scope for proper symbol resolution of variables declared in the loop.
   *
   * @param node - The do-while statement node
   */
  override visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const body = node.getBody();
    const condition = node.getCondition();

    // Enter the loop scope created by the symbol table builder
    // This scope contains any variables declared in the loop body
    this.enterChildScopeForNode(node);

    // Enter loop context for break/continue validation
    this.loopDepth++;

    // Type check body first in the loop scope (executed before condition check)
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit loop context
    this.loopDepth--;

    // Exit the loop scope
    this.exitScope();

    // Type check the condition (in parent scope, after exiting loop scope)
    condition.accept(this);
    const conditionType = this.getTypeOf(condition);

    // Validate condition type is bool or numeric
    if (conditionType && !this.isConditionType(conditionType)) {
      this.reportInvalidConditionType(conditionType, node.getLocation(), 'do-while');
    }

    this.exitNode(node);
  }

  // ============================================
  // FOR STATEMENT
  // ============================================

  /**
   * Type check a for statement
   *
   * Validates:
   * 1. Start expression is numeric
   * 2. End expression is numeric
   * 3. Step expression is numeric (if present)
   * 4. Infers counter variable type based on range
   * 5. Body statements type check correctly
   *
   * @param node - The for statement node
   */
  override visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const variable = node.getVariable();
    const variableType = node.getVariableType();
    const start = node.getStart();
    const end = node.getEnd();
    const step = node.getStep();
    const body = node.getBody();

    // Type check start expression
    start.accept(this);
    const startType = this.getTypeOf(start);

    if (startType && !this.isNumericType(startType)) {
      this.reportError(
        StatementDiagnosticCodes.FOR_RANGE_TYPE_MISMATCH,
        `For loop start value must be numeric, got '${startType.name}'`,
        start.getLocation(),
        'For loop requires numeric start and end values'
      );
    }

    // Type check end expression
    end.accept(this);
    const endType = this.getTypeOf(end);

    if (endType && !this.isNumericType(endType)) {
      this.reportError(
        StatementDiagnosticCodes.FOR_RANGE_TYPE_MISMATCH,
        `For loop end value must be numeric, got '${endType.name}'`,
        end.getLocation(),
        'For loop requires numeric start and end values'
      );
    }

    // Type check step expression if present
    if (step) {
      step.accept(this);
      const stepType = this.getTypeOf(step);

      if (stepType && !this.isNumericType(stepType)) {
        this.reportError(
          StatementDiagnosticCodes.FOR_STEP_INVALID,
          `For loop step value must be numeric, got '${stepType.name}'`,
          step.getLocation(),
          'Step value must be a positive integer'
        );
      }
    }

    // Infer counter type if not explicitly declared
    let counterType: TypeInfo;
    if (variableType) {
      // Use explicitly declared type
      const resolved = this.resolveTypeAnnotation(variableType, node.getLocation());
      counterType = resolved ?? this.getBuiltinType('byte')!;
    } else {
      // Infer from range - if either start or end needs word, use word
      const needsWord = this.needsWordType(startType, endType);
      counterType = needsWord ? this.getBuiltinType('word')! : this.getBuiltinType('byte')!;
      
      // Set inferred type on the node for code generation
      node.setInferredCounterType(needsWord ? 'word' : 'byte');
    }

    // Enter the loop scope created by the symbol table builder
    // This scope contains the loop variable declaration
    this.enterChildScopeForNode(node);

    // Update counter variable type in symbol table
    this.updateSymbolType(variable, counterType);

    // Enter loop context for break/continue validation
    this.loopDepth++;

    // Type check body
    for (const stmt of body) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit loop context
    this.loopDepth--;

    // Exit the loop scope
    this.exitScope();

    this.exitNode(node);
  }

  /**
   * Determines if a for loop counter needs word type based on range
   *
   * @param startType - The start expression type
   * @param endType - The end expression type
   * @returns True if word type is needed
   */
  protected needsWordType(startType: TypeInfo | null, endType: TypeInfo | null): boolean {
    // If either type is word, use word
    if (startType?.kind === TypeKind.Word || endType?.kind === TypeKind.Word) {
      return true;
    }
    return false;
  }

  // ============================================
  // SWITCH STATEMENT
  // ============================================

  /**
   * Type check a switch statement
   *
   * Validates:
   * 1. Switch value is numeric
   * 2. All case values are numeric and match switch value type
   * 3. Case bodies type check correctly
   * 4. Default case body type checks correctly (if present)
   *
   * @param node - The switch statement node
   */
  override visitSwitchStatement(node: SwitchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const value = node.getValue();
    const cases = node.getCases();
    const defaultCase = node.getDefaultCase();

    // Type check switch value
    value.accept(this);
    const valueType = this.getTypeOf(value);

    // Validate switch value is numeric
    if (valueType && !this.isNumericType(valueType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Switch value must be numeric, got '${valueType.name}'`,
        value.getLocation(),
        'Switch statements require byte or word values'
      );
    }

    // Track case values for duplicate detection
    const caseValues = new Set<number>();

    // Enter switch context
    this.switchDepth++;

    // Type check each case
    for (const caseClause of cases) {
      // Type check case value
      caseClause.value.accept(this);
      const caseType = this.getTypeOf(caseClause.value);

      // Validate case type matches switch value type
      if (caseType && valueType && !this.canAssign(caseType, valueType)) {
        this.reportError(
          StatementDiagnosticCodes.SWITCH_CASE_TYPE_MISMATCH,
          `Case value type '${caseType.name}' doesn't match switch type '${valueType.name}'`,
          caseClause.location,
          'All case values must be compatible with the switch value type'
        );
      }

      // Check for duplicate case values (if we can determine the value)
      const caseResult = this.getExpressionType(caseClause.value);
      if (caseResult?.isConstant && typeof caseResult.constantValue === 'number') {
        if (caseValues.has(caseResult.constantValue)) {
          this.reportError(
            StatementDiagnosticCodes.DUPLICATE_SWITCH_CASE,
            `Duplicate case value: ${caseResult.constantValue}`,
            caseClause.location,
            'Each case value must be unique'
          );
        }
        caseValues.add(caseResult.constantValue);
      }

      // Type check case body
      for (const stmt of caseClause.body) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    // Type check default case if present
    if (defaultCase) {
      for (const stmt of defaultCase) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    // Exit switch context
    this.switchDepth--;

    this.exitNode(node);
  }

  // ============================================
  // MATCH STATEMENT (DEPRECATED)
  // ============================================

  /**
   * Type check a match statement (deprecated alias for switch)
   *
   * @param node - The match statement node
   * @deprecated Use visitSwitchStatement instead
   */
  override visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Match statements work identically to switch statements
    const value = node.getValue();
    const cases = node.getCases();
    const defaultCase = node.getDefaultCase();

    // Type check switch value
    value.accept(this);
    const valueType = this.getTypeOf(value);

    // Validate switch value is numeric
    if (valueType && !this.isNumericType(valueType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Match value must be numeric, got '${valueType.name}'`,
        value.getLocation(),
        'Match statements require byte or word values'
      );
    }

    // Enter switch context (match uses same break handling)
    this.switchDepth++;

    // Type check each case
    for (const caseClause of cases) {
      caseClause.value.accept(this);

      for (const stmt of caseClause.body) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    // Type check default case if present
    if (defaultCase) {
      for (const stmt of defaultCase) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    // Exit switch context
    this.switchDepth--;

    this.exitNode(node);
  }

  // ============================================
  // RETURN STATEMENT
  // ============================================

  /**
   * Type check a return statement
   *
   * Validates:
   * 1. Return is inside a function
   * 2. Return value type matches function return type
   * 3. Void functions don't return values
   * 4. Non-void functions return values
   *
   * @param node - The return statement node
   */
  override visitReturnStatement(node: ReturnStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const returnValue = node.getValue();
    const expectedReturnType = this.getCurrentReturnType();

    // Mark that we found a return statement
    this.markReturnFound();

    if (returnValue) {
      // Return with value
      returnValue.accept(this);
      const actualReturnType = this.getTypeOf(returnValue);

      if (expectedReturnType && this.isVoidType(expectedReturnType)) {
        // Void function returning a value - error
        this.reportError(
          StatementDiagnosticCodes.RETURN_VALUE_IN_VOID,
          'Cannot return a value from a void function',
          node.getLocation(),
          'Remove the return value or change the function return type'
        );
      } else if (actualReturnType && expectedReturnType) {
        // Check return type matches
        if (!this.canAssign(actualReturnType, expectedReturnType)) {
          this.reportError(
            StatementDiagnosticCodes.RETURN_TYPE_MISMATCH,
            `Return type '${actualReturnType.name}' is not assignable to '${expectedReturnType.name}'`,
            node.getLocation(),
            `Function expects return type '${expectedReturnType.name}'`
          );
        }
      }
    } else {
      // Return without value
      if (expectedReturnType && !this.isVoidType(expectedReturnType)) {
        // Non-void function returning without value - error
        this.reportError(
          StatementDiagnosticCodes.MISSING_RETURN_VALUE,
          `Function must return a value of type '${expectedReturnType.name}'`,
          node.getLocation(),
          'Add a return value'
        );
      }
    }

    this.exitNode(node);
  }

  // ============================================
  // BREAK STATEMENT
  // ============================================

  /**
   * Type check a break statement
   *
   * Validates:
   * 1. Break is inside a loop or switch statement
   *
   * @param node - The break statement node
   */
  override visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Break is valid in loops or switch statements
    if (this.loopDepth === 0 && this.switchDepth === 0) {
      this.reportError(
        StatementDiagnosticCodes.BREAK_OUTSIDE_LOOP,
        'Break statement must be inside a loop or switch statement',
        node.getLocation(),
        'Move the break inside a while, for, do-while, or switch block'
      );
    }

    this.exitNode(node);
  }

  // ============================================
  // CONTINUE STATEMENT
  // ============================================

  /**
   * Type check a continue statement
   *
   * Validates:
   * 1. Continue is inside a loop (not switch)
   *
   * @param node - The continue statement node
   */
  override visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Continue is only valid in loops (not switch)
    if (this.loopDepth === 0) {
      this.reportError(
        StatementDiagnosticCodes.CONTINUE_OUTSIDE_LOOP,
        'Continue statement must be inside a loop',
        node.getLocation(),
        'Move the continue inside a while, for, or do-while block'
      );
    }

    this.exitNode(node);
  }

  // ============================================
  // EXPRESSION STATEMENT
  // ============================================

  /**
   * Type check an expression statement
   *
   * Simply evaluates the expression for side effects and type errors.
   *
   * @param node - The expression statement node
   */
  override visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Type check the expression
    const expr = node.getExpression();
    expr.accept(this);

    this.exitNode(node);
  }

  // ============================================
  // BLOCK STATEMENT
  // ============================================

  /**
   * Type check a block statement
   *
   * Evaluates all statements in the block sequentially within the block's scope.
   *
   * The SymbolTableBuilder creates a block scope for standalone block statements.
   * We must enter this scope for proper symbol resolution of variables declared
   * in the block.
   *
   * @param node - The block statement node
   */
  override visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Enter the block scope created by the symbol table builder
    // This scope contains any variables declared in the block
    this.enterChildScopeForNode(node);

    // Type check all statements in the block
    for (const stmt of node.getStatements()) {
      if (this.shouldStop) break;
      stmt.accept(this);
    }

    // Exit the block scope
    this.exitScope();

    this.exitNode(node);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Checks if a type is valid for a condition (bool or numeric)
   *
   * @param type - The type to check
   * @returns True if the type can be used as a condition
   */
  protected isConditionType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Bool || this.isNumericType(type);
  }

  /**
   * Reports an invalid condition type error
   *
   * @param type - The invalid type
   * @param location - The source location
   * @param context - The statement context (if, while, etc.)
   */
  protected reportInvalidConditionType(
    type: TypeInfo,
    location: SourceLocation,
    context: string
  ): void {
    this.reportError(
      StatementDiagnosticCodes.INVALID_CONDITION_TYPE,
      `Condition in '${context}' must be bool or numeric, got '${type.name}'`,
      location,
      'Conditions must evaluate to bool, byte, or word'
    );
  }

  // ============================================
  // CONTEXT ACCESSORS
  // ============================================

  /**
   * Checks if currently inside a loop
   *
   * @returns True if inside a loop
   */
  public isInLoop(): boolean {
    return this.loopDepth > 0;
  }

  /**
   * Checks if currently inside a switch statement
   *
   * @returns True if inside a switch
   */
  public isInSwitch(): boolean {
    return this.switchDepth > 0;
  }

  /**
   * Gets the current loop nesting depth
   *
   * @returns The loop depth (0 = not in loop)
   */
  public getLoopDepth(): number {
    return this.loopDepth;
  }

  /**
   * Gets the current switch nesting depth
   *
   * @returns The switch depth (0 = not in switch)
   */
  public getSwitchDepth(): number {
    return this.switchDepth;
  }
}