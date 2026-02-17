/**
 * IL Generator - Control Flow Layer
 *
 * Adds control flow generation:
 * - If/else statements
 * - While loops
 * - For loops (with counted loop detection)
 * - Return statements
 * - Break/continue (with label stack)
 *
 * Inheritance chain:
 * ILGeneratorBase → ILGeneratorExpressions → ILGeneratorControlFlow → ILGenerator
 *
 * @module il/generator/control-flow
 */

import { Statement, Expression } from '../../ast/base.js';
import {
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
} from '../../ast/statements.js';
import { BinaryExpression, IdentifierExpression, LiteralExpression } from '../../ast/expressions.js';
import { isBinaryExpression, isIdentifierExpression, isLiteralExpression } from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import { SlotKind } from '../../frame/enums.js';
import type { FrameSlot } from '../../frame/types.js';
import { createILLoop } from '../factories.js';
import { ILGeneratorExpressions } from './expressions.js';

// ============================================================================
// Loop Label Stack Entry
// ============================================================================

/**
 * Entry in the loop label stack for break/continue support.
 */
interface LoopLabelEntry {
  /** Label to jump to for 'break' */
  breakLabel: string;

  /** Label to jump to for 'continue' */
  continueLabel: string;
}

// ============================================================================
// ILGeneratorControlFlow Class
// ============================================================================

/**
 * Control flow generation layer.
 *
 * Adds if/else, while, for, return, and break/continue generation.
 * Tracks loop labels for break/continue to target the correct loop.
 *
 * @example
 * ```typescript
 * // if/else → jumpEq/jumpNe with labels
 * // while → header label, condition, body, jump back, exit label
 * // for → counted loop detection, optimized iteration
 * ```
 */
export class ILGeneratorControlFlow extends ILGeneratorExpressions {
  // ═══════════════════════════════════════════════════════════════════
  // Loop Label Stack
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Stack of loop labels for break/continue resolution.
   * Each loop pushes its break/continue labels on entry,
   * pops on exit.
   */
  protected loopLabelStack: LoopLabelEntry[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // Comparison Condition Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if a token type is a comparison operator.
   *
   * Used to detect comparison conditions in if/while statements
   * so we can emit direct conditional branches instead of the
   * generic CMP_IMM 0 + JUMP_EQ pattern.
   *
   * @param op - Token type to check
   * @returns true if the token is a comparison operator
   */
  protected isComparisonOperator(op: TokenType): boolean {
    return (
      op === TokenType.EQUAL ||
      op === TokenType.NOT_EQUAL ||
      op === TokenType.LESS_THAN ||
      op === TokenType.LESS_EQUAL ||
      op === TokenType.GREATER_THAN ||
      op === TokenType.GREATER_EQUAL
    );
  }

  /**
   * Emit the inverted conditional jump for a comparison operator.
   *
   * When we have `if (A op B)`, we want to branch to the else/exit label
   * when the condition is FALSE. This requires inverting the comparison:
   *
   * | Source op | Branch to else when NOT true |
   * |----------|------------------------------|
   * | ==       | JUMP_NE (not equal)          |
   * | !=       | JUMP_EQ (equal)              |
   * | <        | JUMP_GE (greater or equal)   |
   * | <=       | JUMP_GT (greater than)       |
   * | >        | JUMP_LE (less or equal)      |
   * | >=       | JUMP_LT (less than)          |
   *
   * @param op - The comparison operator from the source code
   * @param label - The label to jump to when condition is false
   */
  protected emitInvertedJump(op: TokenType, label: string): void {
    switch (op) {
      case TokenType.EQUAL:
        this.builder.jumpNe(label, 'skip if not equal');
        break;
      case TokenType.NOT_EQUAL:
        this.builder.jumpEq(label, 'skip if equal');
        break;
      case TokenType.LESS_THAN:
        this.builder.jumpGe(label, 'skip if >= (not less)');
        break;
      case TokenType.LESS_EQUAL:
        this.builder.jumpGt(label, 'skip if > (not less/equal)');
        break;
      case TokenType.GREATER_THAN:
        this.builder.jumpLe(label, 'skip if <= (not greater)');
        break;
      case TokenType.GREATER_EQUAL:
        this.builder.jumpLt(label, 'skip if < (not greater/equal)');
        break;
    }
  }

  /**
   * Generate a condition with direct conditional branching.
   *
   * For comparison conditions (e.g., `color > 15`), generates the
   * left operand, the CMP instruction, and the inverted branch
   * directly — avoiding the broken CMP_IMM 0 pattern that clobbers
   * CPU flags from the comparison.
   *
   * For non-comparison conditions (booleans, function calls, etc.),
   * falls back to the generic CMP_IMM 0 + JUMP_EQ pattern.
   *
   * For literal `true`, emits nothing (unconditional — always enters body).
   * For literal `false`, emits JUMP to skip label (never enters body).
   *
   * @param condition - The condition expression
   * @param skipLabel - Label to jump to when condition is false
   * @returns true if a condition was generated, false if unconditionally true
   */
  protected generateConditionWithBranch(
    condition: Expression,
    skipLabel: string
  ): boolean {
    // Optimization: detect literal true/false conditions
    if (isLiteralExpression(condition)) {
      const value = (condition as LiteralExpression).getValue();
      if (value === true) {
        // Unconditionally true — no condition check needed
        return false;
      }
      if (value === false) {
        // Unconditionally false — jump directly to skip label
        this.builder.jump(skipLabel, 'condition is false');
        return true;
      }
    }

    // Optimization: detect comparison expressions (e.g., color > 15)
    // Generate direct CMP + conditional branch instead of generic CMP 0 + JUMP_EQ
    // This avoids the bug where CMP_IMM 0 clobbers the flags from the comparison.
    if (isBinaryExpression(condition)) {
      const binExpr = condition as BinaryExpression;
      const op = binExpr.getOperator();

      if (this.isComparisonOperator(op)) {
        // Generate left operand (result in A)
        this.generateExpression(binExpr.getLeft());

        // Generate the CMP with the right operand
        // We reuse the same logic as generateBinaryImmediate/Slot/Complex
        // but only emit the CMP, not the generic boolean check
        const right = binExpr.getRight();

        if (isLiteralExpression(right)) {
          const rightVal = (right as LiteralExpression).getValue();
          if (typeof rightVal === 'number') {
            this.builder.cmpImm(rightVal, 'compare');
          } else {
            // Non-numeric literal — fallback
            this.generateExpression(right);
            // Complex comparison needs CMP_BYTE
          }
        } else if (isIdentifierExpression(right)) {
          // Check for constant identifier first (e.g., NUM_FRAMES = 4).
          // Constants should resolve to immediate CMP, not slot CMP.
          // This mirrors the pattern in generateBinary() where constant
          // identifiers are inlined as immediates.
          const constValue = this.tryResolveConstantIdentifier(right);
          if (constValue !== undefined) {
            this.builder.cmpImm(constValue, 'compare with const');
          } else {
            // Mutable variable — use slot comparison
            const identRight = right as IdentifierExpression;
            const slot = this.tryResolveVariable(identRight.getName());
            if (slot) {
              this.builder.cmpSlot(slot, 'compare');
            } else {
              // Variable not found — fallback to generic pattern
              this.generateExpression(condition);
              this.builder.cmpImm(0, 'condition (fallback)');
              this.builder.jumpEq(skipLabel, 'skip if false');
              return true;
            }
          }
        } else {
          // Complex right operand — fallback to generic pattern
          this.generateExpression(condition);
          this.builder.cmpImm(0, 'condition (fallback)');
          this.builder.jumpEq(skipLabel, 'skip if false');
          return true;
        }

        // Emit the inverted conditional jump
        this.emitInvertedJump(op, skipLabel);
        return true;
      }
    }

    // Generic pattern for non-comparison conditions
    // (boolean variables, function calls, logical operators, etc.)
    this.generateExpression(condition);
    this.builder.cmpImm(0, 'condition');
    this.builder.jumpEq(skipLabel, 'skip if false');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // If/Else Generation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for an if/else statement.
   *
   * Pattern without else:
   * ```
   *   [condition]       ; result in A
   *   CMP_IMM 0         ; compare with false
   *   JUMP_EQ else_lbl  ; skip then if false
   *   [then body]
   * else_lbl:
   * ```
   *
   * Pattern with else:
   * ```
   *   [condition]       ; result in A
   *   CMP_IMM 0         ; compare with false
   *   JUMP_EQ else_lbl  ; jump to else if false
   *   [then body]
   *   JUMP end_lbl      ; skip else
   * else_lbl:
   *   [else body]
   * end_lbl:
   * ```
   *
   * @param stmt - If statement to generate
   */
  protected generateIfStatement(stmt: IfStatement): void {
    this.setLocation(stmt.getLocation());

    const elseBranch = stmt.getElseBranch();
    const hasElse = elseBranch !== null && elseBranch.length > 0;

    // Create labels
    const elseLabel = this.builder.newLabel('else');
    const endLabel = hasElse ? this.builder.newLabel('endif') : elseLabel;

    // Generate condition with direct conditional branching
    // This detects comparison expressions (e.g., color > 15) and emits
    // CMP + inverted branch directly, avoiding the double-CMP bug where
    // CMP_IMM 0 would clobber the flags from the comparison instruction.
    this.generateConditionWithBranch(stmt.getCondition(), elseLabel);

    // Generate then branch
    for (const s of stmt.getThenBranch()) {
      this.generateStatementDispatch(s);
    }

    // If we have an else, jump over it after then
    if (hasElse) {
      this.builder.jump(endLabel, 'skip else');
    }

    // Else label
    this.builder.label(elseLabel);

    // Generate else branch if present
    if (hasElse && elseBranch) {
      for (const s of elseBranch) {
        this.generateStatementDispatch(s);
      }
    }

    // End label (only if we had else, otherwise elseLabel is the end)
    if (hasElse) {
      this.builder.label(endLabel);
    }

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // While Loop Generation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a while loop.
   *
   * Pattern:
   * ```
   * header_lbl:
   *   [condition]       ; result in A
   *   CMP_IMM 0         ; compare with false
   *   JUMP_EQ exit_lbl  ; exit if false
   *   [body]
   *   JUMP header_lbl   ; loop back
   * exit_lbl:
   * ```
   *
   * @param stmt - While statement to generate
   */
  protected generateWhileStatement(stmt: WhileStatement): void {
    this.setLocation(stmt.getLocation());

    // Create labels
    const headerLabel = this.builder.newLabel('while');
    const exitLabel = this.builder.newLabel('endwhile');

    // Enter loop (tracking)
    this.enterLoop();
    this.pushLoopLabels(exitLabel, headerLabel);

    // Header label
    this.builder.label(headerLabel);

    // Generate condition with direct conditional branching
    // Detects while(true) → no condition check (unconditional loop)
    // Detects comparisons → direct CMP + inverted branch
    // Falls back to CMP 0 + JUMP_EQ for other conditions
    this.generateConditionWithBranch(stmt.getCondition(), exitLabel);

    // Generate body
    for (const s of stmt.getBody()) {
      this.generateStatementDispatch(s);
    }

    // Jump back to header
    this.builder.jump(headerLabel, 'loop back');

    // Exit label
    this.builder.label(exitLabel);

    // Record loop for optimization hints
    this.recordLoop(
      createILLoop(headerLabel, exitLabel, this.currentLoopDepth, {
        isCountedLoop: false,
      })
    );

    // Exit loop (tracking)
    this.popLoopLabels();
    this.exitLoop();

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // For Loop Generation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a for loop.
   *
   * Blend for loops use: `for (i = start to end)` or `for (i = start downto end)`
   *
   * Pattern (ascending, 'to'):
   * ```
   *   [start]           ; evaluate start
   *   STORE_BYTE i      ; i = start
   * header_lbl:
   *   LOAD_BYTE i
   *   CMP_IMM end+1     ; compare i with end+1 (for <)
   *   JUMP_GE exit_lbl  ; exit if i >= end+1
   *   [body]
   *   INC_BYTE i        ; i++ (or add step)
   *   JUMP header_lbl
   * exit_lbl:
   * ```
   *
   * Pattern (descending, 'downto'):
   * ```
   *   [start]           ; evaluate start
   *   STORE_BYTE i      ; i = start
   * header_lbl:
   *   LOAD_BYTE i
   *   CMP_IMM end       ; compare i with end
   *   JUMP_LT exit_lbl  ; exit if i < end
   *   [body]
   *   DEC_BYTE i        ; i-- (or sub step)
   *   JUMP header_lbl
   * exit_lbl:
   * ```
   *
   * @param stmt - For statement to generate
   */
  protected generateForStatement(stmt: ForStatement): void {
    this.setLocation(stmt.getLocation());

    // Create labels
    const headerLabel = this.builder.newLabel('for');
    const exitLabel = this.builder.newLabel('endfor');

    // Resolve loop variable slot
    const counterSlot = this.resolveVariable(stmt.getVariable());
    const direction = stmt.getDirection();
    const isAscending = direction === 'to';

    // Analyze for counted loop optimization
    const loopInfo = this.analyzeForLoop(stmt);

    // Detect if this loop needs the post-body exit pattern.
    // Byte counter ascending to 255 can't use CMP #(255+1) = CMP #256
    // because 256 overflows an 8-bit immediate operand. Instead, the exit
    // check is placed after the body but before the increment:
    //   header: [body] → [exit check] → [increment] → JMP header
    const constEnd = this.tryGetConstantValue(stmt.getEnd());
    const isWord = counterSlot.size === 2;
    const usesPostBodyExit = constEnd === 255 && !isWord && isAscending;

    // For post-body exit, create a separate continue label that jumps to the
    // exit check (before increment), not the header (which would skip both
    // the check and the increment, causing an infinite loop on continue).
    const continueLabel = usesPostBodyExit
      ? this.builder.newLabel('for_cont')
      : headerLabel;

    // Enter loop (tracking)
    this.enterLoop();
    this.pushLoopLabels(exitLabel, continueLabel);

    // Initialize loop variable: i = start
    // Use word-width store for 2-byte (word) counter slots
    this.generateExpression(stmt.getStart());
    if (counterSlot.size === 2) {
      this.builder.storeSlotWord(counterSlot, `${stmt.getVariable()} = start (word)`);
    } else {
      this.builder.storeSlot(counterSlot, `${stmt.getVariable()} = start`);
    }

    // Header label
    this.builder.label(headerLabel);

    // Generate termination condition (skipped for post-body exit — returns early)
    this.generateForCondition(stmt, counterSlot, exitLabel, isAscending);

    // Generate body
    for (const s of stmt.getBody()) {
      this.generateStatementDispatch(s);
    }

    // Post-body exit check for byte counter ending at 255.
    // After the body executes, check if the counter has reached a value where
    // incrementing would overflow the byte: counter >= (256 - step).
    // For step=1: CMP #255, exit if counter == 255 (last value processed).
    // For step=N: CMP #(256-N), exit if incrementing would wrap past 0.
    if (usesPostBodyExit) {
      this.builder.label(continueLabel);
      this.generateByte255ExitCheck(stmt, counterSlot, exitLabel);
    }

    // Increment/decrement loop variable
    this.generateForIncrement(stmt, counterSlot, isAscending);

    // Jump back to header
    this.builder.jump(headerLabel, 'loop back');

    // Exit label
    this.builder.label(exitLabel);

    // Record loop for optimization hints
    this.recordLoop(
      createILLoop(headerLabel, exitLabel, this.currentLoopDepth, {
        isCountedLoop: loopInfo.isCountedLoop,
        counterSlot: counterSlot,
        boundValue: loopInfo.boundValue,
        estimatedIterations: loopInfo.estimatedIterations,
      })
    );

    // Exit loop (tracking)
    this.popLoopLabels();
    this.exitLoop();

    this.clearLocation();
  }

  /**
   * Generate the termination condition for a for loop.
   *
   * Routes to either the constant-bound or dynamic-bound condition generator.
   * These are architecturally separated to prevent dynamic-bound logic
   * (PHA/PLA, ZP temp slots) from leaking into the simpler constant-bound
   * path, and vice versa.
   *
   * @param stmt - For statement
   * @param counterSlot - Loop counter slot
   * @param exitLabel - Label to jump to when loop ends
   * @param isAscending - True for 'to', false for 'downto'
   */
  protected generateForCondition(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    exitLabel: string,
    isAscending: boolean
  ): void {
    const endExpr = stmt.getEnd();
    const isWord = counterSlot.size === 2;
    const constEnd = this.tryGetConstantValue(endExpr);

    // Special case: byte counter ascending to 255 uses post-body exit pattern.
    // CMP #(255+1) = CMP #256 overflows an 8-bit immediate operand, producing
    // CMP #$00 which exits immediately. Instead, the exit check is emitted
    // after the loop body in generateForStatement() using CMP #(256-step).
    if (constEnd === 255 && !isWord && isAscending) {
      return;
    }

    // Route to specialized generators based on whether the end bound
    // is a compile-time constant or a dynamic expression.
    if (constEnd !== undefined) {
      this.generateForConditionConstant(stmt, counterSlot, exitLabel, isAscending, constEnd, isWord);
    } else {
      this.generateForConditionDynamic(stmt, counterSlot, exitLabel, isAscending, isWord);
    }
  }

  /**
   * Generate the termination condition for a constant-bound for loop.
   *
   * When the loop end is a compile-time constant, we can emit a simple
   * `LOAD counter / CMP #immediate / JUMP` sequence with no stack
   * operations (PHA/PLA) and no ZP temp slots. This produces cleaner
   * IL and smaller/faster 6502 code.
   *
   * Ascending pattern (for i = 0 to 9):
   * ```
   *   LOAD i            ; load counter
   *   CMP_IMM 10        ; compare with end+1
   *   JUMP_GE exit      ; exit if i >= end+1 (i.e., i > end)
   * ```
   *
   * Descending pattern (for i = 9 downto 0):
   * ```
   *   LOAD i            ; load counter
   *   CMP_IMM 0         ; compare with end
   *   JUMP_LT exit      ; exit if i < end
   * ```
   *
   * @param stmt - For statement (for variable name in comments)
   * @param counterSlot - Loop counter slot
   * @param exitLabel - Label to jump to when loop ends
   * @param isAscending - True for 'to', false for 'downto'
   * @param constEnd - The constant end value (guaranteed defined)
   * @param isWord - True if counter is word-sized (2 bytes)
   */
  protected generateForConditionConstant(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    exitLabel: string,
    isAscending: boolean,
    constEnd: number,
    isWord: boolean
  ): void {
    // Load counter — use word load for 2-byte counters
    if (isWord) {
      this.builder.loadSlotWord(counterSlot, `load ${stmt.getVariable()} (word)`);
    } else {
      this.builder.loadSlot(counterSlot, `load ${stmt.getVariable()}`);
    }

    if (isAscending) {
      // for i = 0 to 9: exit when i > 9 (i.e., i >= 10)
      if (isWord) {
        this.builder.cmpWordImm(constEnd + 1, `cmp word with end+1`);
      } else {
        this.builder.cmpImm(constEnd + 1, `cmp with end+1`);
      }
      this.builder.jumpGe(exitLabel, 'exit if i > end');
    } else {
      // Descending: exit when i < end
      if (isWord) {
        this.builder.cmpWordImm(constEnd, `cmp word with end`);
      } else {
        this.builder.cmpImm(constEnd, `cmp with end`);
      }
      this.builder.jumpLt(exitLabel, 'exit if i < end');
    }
  }

  /**
   * Generate the termination condition for a dynamic-bound for loop.
   *
   * When the loop end is a runtime expression (variable, function call, etc.),
   * we must:
   * 1. Save the current counter value (PHA)
   * 2. Evaluate the end expression (result in A)
   * 3. Store end value to a ZP temp slot
   * 4. Restore the counter (PLA — balanced with the PHA in step 1)
   * 5. Compare counter with the stored end value (CMP slot)
   * 6. Branch based on comparison result
   *
   * This ensures exactly one PHA/PLA pair per condition check (balanced stack).
   *
   * Ascending pattern:
   * ```
   *   LOAD counter      ; load counter
   *   PUSH_A            ; save counter on stack
   *   [generate end]    ; evaluate end expression → A
   *   STORE zpTemp      ; save end to ZP temp slot
   *   POP_A             ; restore counter (balanced PLA)
   *   CMP zpTemp        ; compare counter with stored end
   *   JUMP_GT exit      ; exit if counter > end
   * ```
   *
   * @param stmt - For statement
   * @param counterSlot - Loop counter slot
   * @param exitLabel - Label to jump to when loop ends
   * @param isAscending - True for 'to', false for 'downto'
   * @param isWord - True if counter is word-sized (2 bytes)
   */
  protected generateForConditionDynamic(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    exitLabel: string,
    isAscending: boolean,
    isWord: boolean
  ): void {
    const endExpr = stmt.getEnd();

    // Load counter — use word load for 2-byte counters
    if (isWord) {
      this.builder.loadSlotWord(counterSlot, `load ${stmt.getVariable()} (word)`);
    } else {
      this.builder.loadSlot(counterSlot, `load ${stmt.getVariable()}`);
    }

    // Dynamic bound strategy: save counter to stack, generate end expression
    // into A, store end to a ZP temp slot, restore counter from stack, then
    // CMP counter with the stored end value. This gives balanced PHA/PLA
    // (exactly 1 push, 1 pop) and avoids the cmpImm(255) fallback.
    this.builder.pushA('save counter');
    this.generateExpression(endExpr);

    // Store end value to ZP temp so we can compare counter with it.
    // createZpTempSlot() is inherited from ILGeneratorExpressions.
    const zpTemp = this.createZpTempSlot();
    this.builder.storeSlot(zpTemp, 'save end bound');

    // Restore counter from stack — balanced PLA matching the PHA above.
    this.builder.popA('restore counter');

    // Compare counter with stored end value
    this.builder.cmpSlot(zpTemp, 'counter cmp end');

    if (isAscending) {
      // Ascending: exit when counter > end (all iterations including end are done)
      this.builder.jumpGt(exitLabel, 'exit if counter > end');
    } else {
      // Descending: exit when counter < end
      this.builder.jumpLt(exitLabel, 'exit if counter < end');
    }
  }

  /**
   * Generate the post-body exit check for byte loops ending at 255.
   *
   * Instead of CMP #256 (which overflows an 8-bit immediate), this checks
   * if the counter has reached a value where incrementing would overflow:
   *   counter >= (256 - step)
   *
   * For step=1: CMP #255, BCS exit → exits when counter == 255
   * For step=2: CMP #254, BCS exit → exits when counter >= 254
   * For step=N: CMP #(256-N), BCS exit → exits when next increment overflows
   *
   * This is placed after the loop body but before the increment, so:
   * - The body runs for the current counter value (including the last value)
   * - The exit check prevents the counter from wrapping past 255
   * - The increment only runs for values where it's safe
   *
   * @param stmt - For statement (for variable name and step)
   * @param counterSlot - Loop counter slot (byte-sized)
   * @param exitLabel - Label to jump to when loop is done
   */
  protected generateByte255ExitCheck(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    exitLabel: string
  ): void {
    const step = stmt.getStep();
    const constStep = step ? this.tryGetConstantValue(step) : 1;

    // Compute the exit threshold: the lowest counter value where
    // incrementing by step would overflow a byte (wrap past 255).
    // For step=1: threshold=255 (255+1=256 → overflow)
    // For step=2: threshold=254 (254+2=256 → overflow)
    // If step is dynamic (constStep undefined), default to 255 (step=1 assumption)
    const threshold = 256 - (constStep ?? 1);

    this.builder.loadSlot(counterSlot, `check ${stmt.getVariable()} before increment`);
    this.builder.cmpImm(threshold, `exit threshold (256 - step)`);
    this.builder.jumpGe(exitLabel, 'exit: incrementing would overflow byte');
  }

  /**
   * Generate the increment/decrement for a for loop.
   *
   * @param stmt - For statement
   * @param counterSlot - Loop counter slot
   * @param isAscending - True for 'to', false for 'downto'
   */
  protected generateForIncrement(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    isAscending: boolean
  ): void {
    const step = stmt.getStep();
    const isWord = counterSlot.size === 2;

    if (step) {
      // Custom step value
      const constStep = this.tryGetConstantValue(step);

      if (constStep !== undefined) {
        // Constant step - use optimized increment
        if (isWord) {
          // Word counter: use word-width load/add/store for custom steps
          this.generateForIncrementWord(stmt, counterSlot, isAscending, constStep);
        } else {
          // Byte counter: existing byte-width operations
          this.generateForIncrementByte(stmt, counterSlot, isAscending, constStep);
        }
      } else {
        // Dynamic step - generate expression (byte path only for now)
        this.builder.loadSlot(counterSlot);
        this.generateExpression(step);

        if (isAscending) {
          this.builder.pushA('save step');
          this.builder.loadSlot(counterSlot);
          this.builder.popA('get step');
          this.builder.addImm(1, 'fallback +1');
        } else {
          this.builder.subImm(1, 'fallback -1');
        }
        this.builder.storeSlot(counterSlot, `${stmt.getVariable()} step`);
      }
    } else {
      // Default step of 1
      if (isWord) {
        // Word counter: INC_WORD for in-place 16-bit increment/decrement
        if (isAscending) {
          this.builder.incWord(counterSlot, `${stmt.getVariable()}++ (word)`);
        } else {
          this.builder.decWord(counterSlot, `${stmt.getVariable()}-- (word)`);
        }
      } else {
        // Byte counter: INC_BYTE / DEC_BYTE
        if (isAscending) {
          this.builder.incSlot(counterSlot, `${stmt.getVariable()}++`);
        } else {
          this.builder.decSlot(counterSlot, `${stmt.getVariable()}--`);
        }
      }
    }
  }

  /**
   * Generate word-width increment for a for loop with constant step.
   *
   * For step=1, uses INC_WORD (in-place 16-bit increment).
   * For step>1, loads word, adds word-byte-imm, stores word.
   *
   * @param stmt - For statement (for variable name in comments)
   * @param counterSlot - Word counter slot (size=2)
   * @param isAscending - True for 'to', false for 'downto'
   * @param constStep - Constant step value
   */
  protected generateForIncrementWord(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    isAscending: boolean,
    constStep: number
  ): void {
    if (isAscending) {
      if (constStep === 1) {
        this.builder.incWord(counterSlot, `${stmt.getVariable()}++ (word)`);
      } else {
        // Load word into A:X, add step, store back
        this.builder.loadSlotWord(counterSlot, `load ${stmt.getVariable()} (word)`);
        if (constStep <= 0xFF) {
          this.builder.addWordByteImm(constStep, `word + step ${constStep}`);
        } else {
          this.builder.addWordImm(constStep, `word + step ${constStep}`);
        }
        this.builder.storeSlotWord(counterSlot, `${stmt.getVariable()} += ${constStep} (word)`);
      }
    } else {
      if (constStep === 1) {
        this.builder.decWord(counterSlot, `${stmt.getVariable()}-- (word)`);
      } else {
        // Load word into A:X, subtract step, store back
        this.builder.loadSlotWord(counterSlot, `load ${stmt.getVariable()} (word)`);
        if (constStep <= 0xFF) {
          this.builder.subWordByteImm(constStep, `word - step ${constStep}`);
        } else {
          this.builder.subWordImm(constStep, `word - step ${constStep}`);
        }
        this.builder.storeSlotWord(counterSlot, `${stmt.getVariable()} -= ${constStep} (word)`);
      }
    }
  }

  /**
   * Generate byte-width increment for a for loop with constant step.
   *
   * @param stmt - For statement (for variable name in comments)
   * @param counterSlot - Byte counter slot (size=1)
   * @param isAscending - True for 'to', false for 'downto'
   * @param constStep - Constant step value
   */
  protected generateForIncrementByte(
    stmt: ForStatement,
    counterSlot: FrameSlot,
    isAscending: boolean,
    constStep: number
  ): void {
    if (isAscending) {
      if (constStep === 1) {
        this.builder.incSlot(counterSlot, `${stmt.getVariable()}++`);
      } else {
        this.builder.loadSlot(counterSlot);
        this.builder.addImm(constStep, `add step ${constStep}`);
        this.builder.storeSlot(counterSlot, `${stmt.getVariable()} += ${constStep}`);
      }
    } else {
      if (constStep === 1) {
        this.builder.decSlot(counterSlot, `${stmt.getVariable()}--`);
      } else {
        this.builder.loadSlot(counterSlot);
        this.builder.subImm(constStep, `sub step ${constStep}`);
        this.builder.storeSlot(counterSlot, `${stmt.getVariable()} -= ${constStep}`);
      }
    }
  }

  /**
   * Analyze a for loop to detect counted loop patterns.
   *
   * A counted loop has:
   * - Constant start value
   * - Constant end value
   * - Constant or default step
   *
   * @param stmt - For statement to analyze
   * @returns Loop analysis result
   */
  protected analyzeForLoop(stmt: ForStatement): {
    isCountedLoop: boolean;
    boundValue?: number;
    estimatedIterations?: number;
  } {
    const startConst = this.tryGetConstantValue(stmt.getStart());
    const endConst = this.tryGetConstantValue(stmt.getEnd());
    const step = stmt.getStep();
    const stepConst = step ? this.tryGetConstantValue(step) : 1;

    // Check if this is a counted loop (all values constant)
    if (startConst !== undefined && endConst !== undefined && stepConst !== undefined) {
      const isAscending = stmt.getDirection() === 'to';

      // Calculate estimated iterations
      let iterations: number;
      if (isAscending) {
        iterations = Math.max(0, Math.ceil((endConst - startConst + 1) / stepConst));
      } else {
        iterations = Math.max(0, Math.ceil((startConst - endConst + 1) / stepConst));
      }

      return {
        isCountedLoop: true,
        boundValue: endConst,
        estimatedIterations: iterations,
      };
    }

    // Not a counted loop (has dynamic values)
    return {
      isCountedLoop: false,
    };
  }

  /**
   * Try to get a constant value from an expression.
   *
   * @param expr - Expression to evaluate
   * @returns Constant value or undefined if not constant
   */
  protected tryGetConstantValue(expr: Expression): number | undefined {
    if (isLiteralExpression(expr)) {
      const value = (expr as LiteralExpression).getValue();
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
    }
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Return Statement
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a return statement.
   *
   * For byte returns:
   * ```
   *   [value]           ; result in A
   *   RETURN            ; return with value in A
   * ```
   *
   * For word returns:
   * ```
   *   [value]           ; result in A:X (word) or A (byte needing promotion)
   *   PROMOTE_BYTE_WORD ; (only if value is byte but function returns word)
   *   RETURN            ; return with value in A:X
   * ```
   *
   * Pattern (void):
   * ```
   *   RETURN            ; return void
   * ```
   *
   * When a function returns word but the return expression is byte-typed,
   * PROMOTE_BYTE_WORD (LDX #0) is emitted to ensure the high byte in X
   * is zeroed. Without this, X would contain garbage from a previous
   * operation and the caller would store an incorrect high byte.
   *
   * @param stmt - Return statement to generate
   */
  protected generateReturnStatement(stmt: ReturnStatement): void {
    this.setLocation(stmt.getLocation());

    const value = stmt.getValue();
    if (value) {
      // Return with value - generate expression (result in A or A:X for word)
      this.generateExpression(value);

      // If the function returns word but the expression is byte-typed,
      // promote A → A:X (LDX #0) to ensure the high byte is zeroed.
      // Word-typed expressions already produce A:X via LOAD_WORD or word arithmetic.
      const frame = this.getCurrentFrame();
      const returnSlot = frame.slots.find(s => s.kind === SlotKind.Return);
      if (returnSlot && returnSlot.size === 2 && !this.isWordTyped(value)) {
        this.builder.promoteByteWord('return byte→word');
      }
    }

    // Emit return instruction
    this.builder.return_(value ? 'return value' : 'return void');

    this.clearLocation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Break/Continue
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate IL for a break statement.
   *
   * Jumps to the exit label of the nearest enclosing loop.
   */
  protected generateBreakStatement(): void {
    const entry = this.peekLoopLabels();
    if (!entry) {
      throw new Error('break statement outside of loop');
    }
    this.builder.jump(entry.breakLabel, 'break');
  }

  /**
   * Generate IL for a continue statement.
   *
   * Jumps to the header label of the nearest enclosing loop.
   */
  protected generateContinueStatement(): void {
    const entry = this.peekLoopLabels();
    if (!entry) {
      throw new Error('continue statement outside of loop');
    }
    this.builder.jump(entry.continueLabel, 'continue');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Loop Label Stack Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Push loop labels onto the stack (called when entering a loop).
   *
   * @param breakLabel - Label to jump to for 'break'
   * @param continueLabel - Label to jump to for 'continue'
   */
  protected pushLoopLabels(breakLabel: string, continueLabel: string): void {
    this.loopLabelStack.push({ breakLabel, continueLabel });
  }

  /**
   * Pop loop labels from the stack (called when exiting a loop).
   */
  protected popLoopLabels(): void {
    this.loopLabelStack.pop();
  }

  /**
   * Peek at the current loop labels without removing.
   *
   * @returns Current loop labels or undefined if not in a loop
   */
  protected peekLoopLabels(): LoopLabelEntry | undefined {
    return this.loopLabelStack[this.loopLabelStack.length - 1];
  }

  // ═══════════════════════════════════════════════════════════════════
  // Statement Dispatch (to be overridden in final class)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Dispatch to statement generator.
   * This is overridden in the final ILGenerator class.
   *
   * @param stmt - Statement to generate
   */
  protected generateStatementDispatch(stmt: Statement): void {
    // This will be overridden by ILGenerator
    throw new Error(`Statement dispatch not implemented: ${stmt.getNodeType()}`);
  }
}