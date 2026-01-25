/**
 * IL Statement Generator
 *
 * Generates IL for statements including control flow and return statements.
 * Extends ILDeclarationGenerator to add statement-level generation capabilities.
 *
 * This layer handles:
 * - Statement dispatch (routing to appropriate handler)
 * - If statement generation (branching)
 * - While statement generation (looping)
 * - For statement generation (lowered to while pattern)
 * - Return statement generation
 * - Break/continue statement generation
 * - Expression statement generation
 * - Block statement generation
 *
 * Expression generation is delegated to subclasses (ILExpressionGenerator).
 *
 * @module il/generator/statements
 */

import type { Statement, SourceLocation, Expression } from '../../ast/base.js';
import type { SymbolTable } from '../../semantic/symbol-table.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILFunction } from '../function.js';
import type { BasicBlock } from '../basic-block.js';
import type { VirtualRegister } from '../values.js';

import { ASTNodeType } from '../../ast/base.js';
import {
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
  SwitchStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
  VariableDecl,
} from '../../ast/nodes.js';
import { IL_BYTE } from '../types.js';
import { ILStorageClass } from '../function.js';
import { ILDeclarationGenerator } from './declarations.js';

// =============================================================================
// Loop Context Info
// =============================================================================

/**
 * Information about the current loop being generated.
 *
 * Used for break/continue statement resolution.
 */
export interface LoopInfo {
  /** Label for loop header (continue target) */
  readonly headerLabel: string;

  /** Label for loop exit (break target) */
  readonly exitLabel: string;

  /** Loop depth (1 = outermost loop) */
  readonly depth: number;

  /** Source location of the loop statement */
  readonly location: SourceLocation;
}

// =============================================================================
// ILStatementGenerator Class
// =============================================================================

/**
 * Generates IL for statements.
 *
 * This class extends ILDeclarationGenerator to provide statement-level
 * generation capabilities including:
 * - Control flow (if/else, while, for)
 * - Return statements
 * - Break/continue statements
 * - Expression statements
 *
 * For loops are lowered to while loop pattern for consistent optimization.
 *
 * Expression generation is handled by subclasses (Phase 4).
 *
 * @example
 * ```typescript
 * const generator = new ILStatementGenerator(symbolTable, targetConfig);
 * const result = generator.generateModule(program);
 *
 * if (result.success) {
 *   console.log(result.module.toDetailedString());
 * }
 * ```
 */
export class ILStatementGenerator extends ILDeclarationGenerator {
  /**
   * Counter for generating unique block labels.
   */
  protected blockLabelCounter = 0;

  /**
   * Creates a new statement generator.
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param targetConfig - Optional target configuration
   */
  constructor(symbolTable: SymbolTable, targetConfig: TargetConfig | null = null) {
    super(symbolTable, targetConfig);
  }

  // ===========================================================================
  // Statement Generation Entry Point
  // ===========================================================================

  /**
   * Generates IL for a list of statements.
   *
   * Overrides the hook from ILDeclarationGenerator to actually
   * generate statement IL.
   *
   * @param statements - Statements to generate
   * @param ilFunc - Current IL function
   */
  protected override generateStatements(
    statements: readonly Statement[],
    ilFunc: ILFunction,
  ): void {
    for (const stmt of statements) {
      // Skip if current block is terminated (unreachable code)
      if (this.context?.currentBlock?.hasTerminator()) {
        this.addWarning(
          'Unreachable code after terminator',
          stmt.getLocation(),
          'W_UNREACHABLE',
        );
        break;
      }

      this.generateStatement(stmt, ilFunc);
    }
  }

  /**
   * Generates IL for a single statement.
   *
   * Dispatches to the appropriate statement handler based on node type.
   *
   * @param stmt - Statement to generate
   * @param ilFunc - Current IL function
   */
  protected generateStatement(stmt: Statement, ilFunc: ILFunction): void {
    switch (stmt.getNodeType()) {
      case ASTNodeType.RETURN_STMT:
        this.generateReturnStatement(stmt as ReturnStatement, ilFunc);
        break;

      case ASTNodeType.IF_STMT:
        this.generateIfStatement(stmt as IfStatement, ilFunc);
        break;

      case ASTNodeType.WHILE_STMT:
        this.generateWhileStatement(stmt as WhileStatement, ilFunc);
        break;

      case ASTNodeType.FOR_STMT:
        this.generateForStatement(stmt as ForStatement, ilFunc);
        break;

      case ASTNodeType.MATCH_STMT:
        this.generateMatchStatement(stmt as MatchStatement, ilFunc);
        break;

      case ASTNodeType.SWITCH_STMT:
        this.generateSwitchStatement(stmt as SwitchStatement, ilFunc);
        break;

      case ASTNodeType.BREAK_STMT:
        this.generateBreakStatement(stmt as BreakStatement);
        break;

      case ASTNodeType.CONTINUE_STMT:
        this.generateContinueStatement(stmt as ContinueStatement);
        break;

      case ASTNodeType.EXPR_STMT:
        this.generateExpressionStatement(stmt as ExpressionStatement, ilFunc);
        break;

      case ASTNodeType.BLOCK_STMT:
        this.generateBlockStatement(stmt as BlockStatement, ilFunc);
        break;

      case ASTNodeType.VARIABLE_DECL:
        // Variable declarations in statement position - generate initializer
        this.generateVariableStatement(stmt as VariableDecl, ilFunc);
        break;

      default:
        this.addError(
          `Unsupported statement type: ${stmt.getNodeType()}`,
          stmt.getLocation(),
          'E_UNSUPPORTED_STMT',
        );
    }
  }

  // ===========================================================================
  // Return Statement Generation (Task 3.9)
  // ===========================================================================

  /**
   * Generates IL for a return statement.
   *
   * Emits RETURN or RETURN_VOID instruction based on whether
   * a value is provided.
   *
   * @param stmt - Return statement
   * @param ilFunc - Current IL function
   */
  protected generateReturnStatement(stmt: ReturnStatement, ilFunc: ILFunction): void {
    const value = stmt.getValue();

    if (value) {
      // Return with value
      const valueReg = this.generateExpression(value, ilFunc);

      if (valueReg) {
        // Type check: return value should match function return type
        const expectedType = ilFunc.returnType;
        if (expectedType.kind === 'void') {
          this.addError(
            'Cannot return a value from a void function',
            stmt.getLocation(),
            'E_RETURN_VALUE_VOID',
          );
        }

        this.builder?.emitReturn(valueReg);
      } else {
        // Expression generation failed - emit void return as fallback
        this.builder?.emitReturnVoid();
      }
    } else {
      // Return void
      if (!ilFunc.isVoid()) {
        this.addWarning(
          'Return statement without value in non-void function',
          stmt.getLocation(),
          'W_RETURN_NO_VALUE',
        );
      }

      this.builder?.emitReturnVoid();
    }
  }

  // ===========================================================================
  // If Statement Generation (Task 3.6)
  // ===========================================================================

  /**
   * Generates IL for an if statement.
   *
   * Creates basic blocks for then, else, and merge paths.
   * Emits BRANCH instruction based on condition.
   *
   * CFG Structure:
   * ```
   *   [current] --condition--> [then_block]
   *       |                         |
   *       v                         v
   *   [else_block]            [merge_block]
   *       |                         ^
   *       +-------------------------+
   * ```
   *
   * @param stmt - If statement
   * @param ilFunc - Current IL function
   */
  protected generateIfStatement(stmt: IfStatement, ilFunc: ILFunction): void {
    const condition = stmt.getCondition();
    const thenBranch = stmt.getThenBranch();
    const elseBranch = stmt.getElseBranch();

    // Generate unique labels
    const labelId = this.nextBlockLabel();
    const thenLabel = `if_then_${labelId}`;
    const elseLabel = `if_else_${labelId}`;
    const mergeLabel = `if_merge_${labelId}`;

    // Create blocks
    const thenBlock = ilFunc.createBlock(thenLabel);
    const elseBlock = elseBranch ? ilFunc.createBlock(elseLabel) : null;
    const mergeBlock = ilFunc.createBlock(mergeLabel);

    // Generate condition expression
    const condReg = this.generateExpression(condition, ilFunc);

    if (condReg) {
      // Emit branch
      const targetElse = elseBlock ?? mergeBlock;
      this.builder?.emitBranch(condReg, thenBlock, targetElse);
    } else {
      // Condition generation failed - emit unconditional jump to merge
      this.addError(
        'Failed to generate if condition',
        condition.getLocation(),
        'E_IF_CONDITION',
      );
      this.builder?.emitJump(mergeBlock);
    }

    // Generate then branch
    this.context!.currentBlock = thenBlock;
    this.builder?.setCurrentBlock(thenBlock);
    this.generateStatements(thenBranch, ilFunc);

    // Jump to merge if then branch doesn't terminate
    if (!thenBlock.hasTerminator()) {
      this.builder?.emitJump(mergeBlock);
    }

    // Generate else branch if present
    if (elseBranch && elseBlock) {
      this.context!.currentBlock = elseBlock;
      this.builder?.setCurrentBlock(elseBlock);
      this.generateStatements(elseBranch, ilFunc);

      // Jump to merge if else branch doesn't terminate
      if (!elseBlock.hasTerminator()) {
        this.builder?.emitJump(mergeBlock);
      }
    }

    // Continue at merge block
    this.context!.currentBlock = mergeBlock;
    this.builder?.setCurrentBlock(mergeBlock);
  }

  // ===========================================================================
  // While Statement Generation (Task 3.7)
  // ===========================================================================

  /**
   * Generates IL for a while statement.
   *
   * Creates basic blocks for header, body, and exit.
   * Pushes loop context for break/continue resolution.
   *
   * CFG Structure:
   * ```
   *   [current] --> [header] --true--> [body]
   *                   |   ^              |
   *                   |   +--------------+
   *                   |
   *                   +--false--> [exit]
   * ```
   *
   * @param stmt - While statement
   * @param ilFunc - Current IL function
   */
  protected generateWhileStatement(stmt: WhileStatement, ilFunc: ILFunction): void {
    const condition = stmt.getCondition();
    const body = stmt.getBody();

    // Generate unique labels
    const labelId = this.nextBlockLabel();
    const headerLabel = `while_header_${labelId}`;
    const bodyLabel = `while_body_${labelId}`;
    const exitLabel = `while_exit_${labelId}`;

    // Create blocks
    const headerBlock = ilFunc.createBlock(headerLabel);
    const bodyBlock = ilFunc.createBlock(bodyLabel);
    const exitBlock = ilFunc.createBlock(exitLabel);

    // Jump to header from current block
    this.builder?.emitJump(headerBlock);

    // Generate header (condition check)
    this.context!.currentBlock = headerBlock;
    this.builder?.setCurrentBlock(headerBlock);

    const condReg = this.generateExpression(condition, ilFunc);

    if (condReg) {
      this.builder?.emitBranch(condReg, bodyBlock, exitBlock);
    } else {
      // Condition generation failed - exit loop
      this.addError(
        'Failed to generate while condition',
        condition.getLocation(),
        'E_WHILE_CONDITION',
      );
      this.builder?.emitJump(exitBlock);
    }

    // Push loop context for break/continue
    this.pushLoopContext(headerBlock, exitBlock);

    // Generate body
    this.context!.currentBlock = bodyBlock;
    this.builder?.setCurrentBlock(bodyBlock);
    this.generateStatements(body, ilFunc);

    // Pop loop context
    this.popLoopContext();

    // Jump back to header if body doesn't terminate
    if (!bodyBlock.hasTerminator()) {
      this.builder?.emitJump(headerBlock);
    }

    // Continue at exit block
    this.context!.currentBlock = exitBlock;
    this.builder?.setCurrentBlock(exitBlock);
  }

  // ===========================================================================
  // For Statement Generation (Task 3.8) - FOR → WHILE Lowering
  // ===========================================================================

  /**
   * Generates IL for a for statement by lowering to while pattern.
   *
   * Lowering:
   * ```
   * for i = start to end
   *   body
   * next i
   * ```
   * becomes:
   * ```
   * i = start
   * while i <= end
   *   body
   *   i = i + 1
   * end while
   * ```
   *
   * This lowering enables standard loop optimizations to work on for loops.
   *
   * @param stmt - For statement
   * @param ilFunc - Current IL function
   */
  protected generateForStatement(stmt: ForStatement, ilFunc: ILFunction): void {
    const variable = stmt.getVariable();
    const start = stmt.getStart();
    const end = stmt.getEnd();
    const body = stmt.getBody();

    // Generate unique labels
    const labelId = this.nextBlockLabel();
    const headerLabel = `for_header_${labelId}`;
    const bodyLabel = `for_body_${labelId}`;
    const incrLabel = `for_incr_${labelId}`;
    const exitLabel = `for_exit_${labelId}`;

    // Create blocks
    const headerBlock = ilFunc.createBlock(headerLabel);
    const bodyBlock = ilFunc.createBlock(bodyLabel);
    const incrBlock = ilFunc.createBlock(incrLabel);
    const exitBlock = ilFunc.createBlock(exitLabel);

    // Step 1: Initialize loop variable (i = start)
    const startReg = this.generateExpression(start, ilFunc);
    if (startReg) {
      // Get or create the loop variable register
      const loopVarReg = this.getOrCreateLoopVariable(variable, ilFunc);
      if (loopVarReg) {
        // Store start value to loop variable
        this.builder?.emitStoreVar(variable, startReg);
      }
    }

    // Jump to header
    this.builder?.emitJump(headerBlock);

    // Step 2: Header (condition check: i <= end)
    this.context!.currentBlock = headerBlock;
    this.builder?.setCurrentBlock(headerBlock);

    // Generate end expression
    const endReg = this.generateExpression(end, ilFunc);

    // Load current value of loop variable
    const currentReg = this.builder?.emitLoadVar(variable, IL_BYTE);

    if (currentReg && endReg) {
      // Compare: i <= end
      const condReg = this.builder?.emitCmpLe(currentReg, endReg);
      if (condReg) {
        this.builder?.emitBranch(condReg, bodyBlock, exitBlock);
      } else {
        this.builder?.emitJump(exitBlock);
      }
    } else {
      // Failed to generate condition - exit
      this.addError(
        'Failed to generate for loop condition',
        stmt.getLocation(),
        'E_FOR_CONDITION',
      );
      this.builder?.emitJump(exitBlock);
    }

    // Push loop context - continue goes to increment, break goes to exit
    this.pushLoopContext(incrBlock, exitBlock);

    // Step 3: Generate body
    this.context!.currentBlock = bodyBlock;
    this.builder?.setCurrentBlock(bodyBlock);
    this.generateStatements(body, ilFunc);

    // Pop loop context
    this.popLoopContext();

    // Jump to increment if body doesn't terminate
    if (!bodyBlock.hasTerminator()) {
      this.builder?.emitJump(incrBlock);
    }

    // Step 4: Increment (i = i + 1)
    this.context!.currentBlock = incrBlock;
    this.builder?.setCurrentBlock(incrBlock);

    // Load current value
    const incrCurrentReg = this.builder?.emitLoadVar(variable, IL_BYTE);
    if (incrCurrentReg) {
      // Add 1
      const oneReg = this.builder?.emitConstByte(1);
      if (oneReg) {
        const newValueReg = this.builder?.emitAdd(incrCurrentReg, oneReg);
        if (newValueReg) {
          // Store back
          this.builder?.emitStoreVar(variable, newValueReg);
        }
      }
    }

    // Jump back to header
    this.builder?.emitJump(headerBlock);

    // Continue at exit block
    this.context!.currentBlock = exitBlock;
    this.builder?.setCurrentBlock(exitBlock);
  }

  /**
   * Gets or creates a register for a loop variable.
   *
   * @param name - Variable name
   * @param ilFunc - Current IL function
   * @returns Virtual register for the variable
   */
  protected getOrCreateLoopVariable(name: string, ilFunc: ILFunction): VirtualRegister | null {
    // Check if already exists as a local
    const existingReg = this.getLocalRegister(name);
    if (existingReg) {
      return existingReg;
    }

    // Create new register for loop variable
    const register = ilFunc.createRegister(IL_BYTE, name);

    // Record in locals
    this.currentLocals.set(name, {
      name,
      type: IL_BYTE,
      register,
      storageClass: ILStorageClass.Ram,
      isConst: false,
    });

    // Record variable mapping
    const symbol = this.symbolTable.lookup(name);
    if (symbol) {
      this.recordVariableMapping(symbol, register, false);
    }

    return register;
  }

  // ===========================================================================
  // Match Statement Generation
  // ===========================================================================

  /**
   * Generates IL for a match statement.
   *
   * Lowered to a series of if-else comparisons.
   *
   * @param stmt - Match statement
   * @param ilFunc - Current IL function
   */
  protected generateMatchStatement(stmt: MatchStatement, ilFunc: ILFunction): void {
    const value = stmt.getValue();
    const cases = stmt.getCases();
    const defaultCase = stmt.getDefaultCase();

    // Generate unique labels
    const labelId = this.nextBlockLabel();
    const mergeLabel = `match_merge_${labelId}`;
    const defaultLabel = `match_default_${labelId}`;

    // Create merge block
    const mergeBlock = ilFunc.createBlock(mergeLabel);

    // Generate the value being matched once
    const valueReg = this.generateExpression(value, ilFunc);

    if (!valueReg) {
      this.addError(
        'Failed to generate match value',
        value.getLocation(),
        'E_MATCH_VALUE',
      );
      return;
    }

    // Create blocks for each case
    const caseBlocks: BasicBlock[] = [];
    const caseBodyBlocks: BasicBlock[] = [];

    for (let i = 0; i < cases.length; i++) {
      caseBlocks.push(ilFunc.createBlock(`match_case_${labelId}_${i}`));
      caseBodyBlocks.push(ilFunc.createBlock(`match_body_${labelId}_${i}`));
    }

    // Create default block if needed
    const defaultBlock = defaultCase ? ilFunc.createBlock(defaultLabel) : mergeBlock;

    // Generate case comparisons as a chain
    for (let i = 0; i < cases.length; i++) {
      const caseClause = cases[i];
      const caseBlock = caseBlocks[i];
      const bodyBlock = caseBodyBlocks[i];
      const nextCaseBlock = i + 1 < cases.length ? caseBlocks[i + 1] : defaultBlock;

      // Switch to case comparison block
      if (i === 0) {
        this.builder?.emitJump(caseBlock);
      }

      this.context!.currentBlock = caseBlock;
      this.builder?.setCurrentBlock(caseBlock);

      // Generate case value
      const caseValueReg = this.generateExpression(caseClause.value, ilFunc);

      if (caseValueReg) {
        // Compare: value == caseValue
        const condReg = this.builder?.emitCmpEq(valueReg, caseValueReg);
        if (condReg) {
          this.builder?.emitBranch(condReg, bodyBlock, nextCaseBlock);
        } else {
          this.builder?.emitJump(nextCaseBlock);
        }
      } else {
        this.builder?.emitJump(nextCaseBlock);
      }

      // Generate case body
      this.context!.currentBlock = bodyBlock;
      this.builder?.setCurrentBlock(bodyBlock);
      this.generateStatements(caseClause.body, ilFunc);

      // Jump to merge if body doesn't terminate
      if (!bodyBlock.hasTerminator()) {
        this.builder?.emitJump(mergeBlock);
      }
    }

    // Generate default case if present
    if (defaultCase) {
      this.context!.currentBlock = defaultBlock;
      this.builder?.setCurrentBlock(defaultBlock);
      this.generateStatements(defaultCase, ilFunc);

      // Jump to merge if default doesn't terminate
      if (!defaultBlock.hasTerminator()) {
        this.builder?.emitJump(mergeBlock);
      }
    }

    // Continue at merge block
    this.context!.currentBlock = mergeBlock;
    this.builder?.setCurrentBlock(mergeBlock);
  }

  // ===========================================================================
  // Switch Statement Generation (C-style)
  // ===========================================================================

  /**
   * Generates IL for a switch statement (C-style syntax).
   *
   * Lowered to a series of if-else comparisons, similar to match statements.
   *
   * @param stmt - Switch statement
   * @param ilFunc - Current IL function
   */
  protected generateSwitchStatement(stmt: SwitchStatement, ilFunc: ILFunction): void {
    const value = stmt.getValue();
    const cases = stmt.getCases();
    const defaultCase = stmt.getDefaultCase();

    // Generate unique labels
    const labelId = this.nextBlockLabel();
    const mergeLabel = `switch_merge_${labelId}`;
    const defaultLabel = `switch_default_${labelId}`;

    // Create merge block
    const mergeBlock = ilFunc.createBlock(mergeLabel);

    // Generate the value being switched on once
    const valueReg = this.generateExpression(value, ilFunc);

    if (!valueReg) {
      this.addError(
        'Failed to generate switch value',
        value.getLocation(),
        'E_SWITCH_VALUE',
      );
      return;
    }

    // Create blocks for each case
    const caseBlocks: BasicBlock[] = [];
    const caseBodyBlocks: BasicBlock[] = [];

    for (let i = 0; i < cases.length; i++) {
      caseBlocks.push(ilFunc.createBlock(`switch_case_${labelId}_${i}`));
      caseBodyBlocks.push(ilFunc.createBlock(`switch_body_${labelId}_${i}`));
    }

    // Create default block if needed
    const defaultBlock = defaultCase ? ilFunc.createBlock(defaultLabel) : mergeBlock;

    // Generate case comparisons as a chain
    for (let i = 0; i < cases.length; i++) {
      const caseClause = cases[i];
      const caseBlock = caseBlocks[i];
      const bodyBlock = caseBodyBlocks[i];
      const nextCaseBlock = i + 1 < cases.length ? caseBlocks[i + 1] : defaultBlock;

      // Switch to case comparison block
      if (i === 0) {
        this.builder?.emitJump(caseBlock);
      }

      this.context!.currentBlock = caseBlock;
      this.builder?.setCurrentBlock(caseBlock);

      // Generate case value
      const caseValueReg = this.generateExpression(caseClause.value, ilFunc);

      if (caseValueReg) {
        // Compare: value == caseValue
        const condReg = this.builder?.emitCmpEq(valueReg, caseValueReg);
        if (condReg) {
          this.builder?.emitBranch(condReg, bodyBlock, nextCaseBlock);
        } else {
          this.builder?.emitJump(nextCaseBlock);
        }
      } else {
        this.builder?.emitJump(nextCaseBlock);
      }

      // Generate case body
      this.context!.currentBlock = bodyBlock;
      this.builder?.setCurrentBlock(bodyBlock);
      this.generateStatements(caseClause.body, ilFunc);

      // Jump to merge if body doesn't terminate
      if (!bodyBlock.hasTerminator()) {
        this.builder?.emitJump(mergeBlock);
      }
    }

    // Generate default case if present
    if (defaultCase) {
      this.context!.currentBlock = defaultBlock;
      this.builder?.setCurrentBlock(defaultBlock);
      this.generateStatements(defaultCase, ilFunc);

      // Jump to merge if default doesn't terminate
      if (!defaultBlock.hasTerminator()) {
        this.builder?.emitJump(mergeBlock);
      }
    }

    // Continue at merge block
    this.context!.currentBlock = mergeBlock;
    this.builder?.setCurrentBlock(mergeBlock);
  }

  // ===========================================================================
  // Break/Continue Statement Generation
  // ===========================================================================

  /**
   * Generates IL for a break statement.
   *
   * Emits a jump to the current loop's exit block.
   *
   * @param stmt - Break statement
   */
  protected generateBreakStatement(stmt: BreakStatement): void {
    const loopContext = this.getCurrentLoopContext();

    if (!loopContext) {
      this.addError(
        'Break statement outside of loop',
        stmt.getLocation(),
        'E_BREAK_OUTSIDE_LOOP',
      );
      return;
    }

    // Jump to loop exit
    this.builder?.emitJump(loopContext.breakBlock);
  }

  /**
   * Generates IL for a continue statement.
   *
   * Emits a jump to the current loop's header block.
   *
   * @param stmt - Continue statement
   */
  protected generateContinueStatement(stmt: ContinueStatement): void {
    const loopContext = this.getCurrentLoopContext();

    if (!loopContext) {
      this.addError(
        'Continue statement outside of loop',
        stmt.getLocation(),
        'E_CONTINUE_OUTSIDE_LOOP',
      );
      return;
    }

    // Jump to loop header (continue block)
    this.builder?.emitJump(loopContext.continueBlock);
  }

  // ===========================================================================
  // Expression Statement Generation
  // ===========================================================================

  /**
   * Generates IL for an expression statement.
   *
   * Evaluates the expression for its side effects (e.g., function calls).
   *
   * @param stmt - Expression statement
   * @param ilFunc - Current IL function
   */
  protected generateExpressionStatement(stmt: ExpressionStatement, ilFunc: ILFunction): void {
    const expr = stmt.getExpression();

    // Generate the expression - result is discarded
    this.generateExpression(expr, ilFunc);
  }

  /**
   * Generates IL for a block statement.
   *
   * Simply generates all statements in the block.
   *
   * @param stmt - Block statement
   * @param ilFunc - Current IL function
   */
  protected generateBlockStatement(stmt: BlockStatement, ilFunc: ILFunction): void {
    this.generateStatements(stmt.getStatements(), ilFunc);
  }

  /**
   * Generates IL for a variable declaration in statement position.
   *
   * Handles the initializer if present.
   *
   * @param stmt - Variable declaration
   * @param ilFunc - Current IL function
   */
  protected generateVariableStatement(stmt: VariableDecl, ilFunc: ILFunction): void {
    const name = stmt.getName();
    const initializer = stmt.getInitializer();

    if (initializer) {
      // Generate initializer
      const valueReg = this.generateExpression(initializer, ilFunc);

      if (valueReg) {
        // Store to variable
        this.builder?.emitStoreVar(name, valueReg);
      }
    }
    // If no initializer, the register was already created in processLocalVariable
    // and will be undefined until assigned
  }

  // ===========================================================================
  // Expression Generation (Hook for Subclass)
  // ===========================================================================

  /**
   * Generates IL for an expression.
   *
   * This is a hook for subclasses (ILExpressionGenerator) to implement.
   * The base implementation returns null (expression generation not yet implemented).
   *
   * @param expr - Expression to generate
   * @param _ilFunc - Current IL function (used by subclasses)
   * @returns Virtual register containing result, or null if not implemented
   */
  protected generateExpression(
    expr: Expression,
    _ilFunc: ILFunction,
  ): VirtualRegister | null {
    // Hook for subclasses - base implementation does nothing
    // ILExpressionGenerator will override this to generate actual expressions
    
    // For now, emit a placeholder constant for testing
    // This allows statement generation to be tested before expression generation is implemented
    this.addWarning(
      `Expression generation not yet implemented for node type: ${expr.getNodeType()}`,
      expr.getLocation(),
      'W_EXPR_NOT_IMPLEMENTED',
    );

    // Return a placeholder boolean for conditions
    return this.builder?.emitConstBool(true) ?? null;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generates a unique block label counter.
   *
   * @returns Next unique label ID
   */
  protected nextBlockLabel(): number {
    return this.blockLabelCounter++;
  }

  /**
   * Resets the block label counter.
   *
   * Called at the start of each function.
   */
  protected resetBlockLabels(): void {
    this.blockLabelCounter = 0;
  }
}