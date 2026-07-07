/**
 * RD-18 Slice 3b statement typing + the Pass-3 driver (FR-2/FR-5).
 *
 * `typeCheckPrograms` walks every function/interrupt body and types the
 * Slice-3b statement surface: `let` declarations (type the initialiser in its
 * declared-type context; range-check constants → E10084/E10082; assignment
 * compatibility → E10152/E10153/E10154), expression statements (assignments,
 * `poke`/`pokew`, …), and `return`. Control-flow statements (if/while/for/switch)
 * are out of the Slice-3b surface (Slice 4) and are skipped — a program using
 * them is not 3b-lowerable anyway. Never throws (FR-9).
 */

import { DiagCode, isError, primitive, typeName } from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  ExprNode,
  ForStmtNode,
  LetDeclNode,
  ProgramNode,
  ReturnStmtNode,
  Scope,
  StmtNode,
  Type,
} from "@blend65/core";
import type { TypeCheckContext } from "./context.js";
import { typeOfExpr, checkAssignable, checkConstRange } from "./expression-typing.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import { evalConst } from "../const-eval.js";

/**
 * Runs Pass-3 type checking over every function/interrupt body in all programs
 * (FR-2). The body scopes (with their ordered locals) come from the Slice-3a
 * `collectFunctions` pass via `scopeByNode`. Never throws.
 *
 * @param programs The parsed program ASTs.
 * @param scopeByNode Decl node → its body scope (from Pass-1 collection).
 * @param ctx The Pass-3 context (bag + `typeMap`/`symbolMap`).
 */
export function typeCheckPrograms(
  programs: readonly ProgramNode[],
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  ctx: TypeCheckContext,
): void {
  for (const program of programs) {
    for (const item of program.items) {
      if (item.kind === "FunctionDecl") {
        const bodyScope = scopeByNode.get(item);
        if (bodyScope !== undefined) {
          typeBody(item.body, bodyScope, resolveTypeNode(item.returnType), ctx, 0);
        }
      } else if (item.kind === "InterruptDecl") {
        const bodyScope = scopeByNode.get(item);
        if (bodyScope !== undefined) {
          typeBody(item.body, bodyScope, primitive("void"), ctx, 0);
        }
      }
    }
  }
}

/**
 * Types every statement in a body block, reusing the enclosing (flat) scope
 * (AR-9). `loopDepth` records how many enclosing loops the block sits in, so
 * `break`/`continue` outside any loop are caught (FR-5).
 */
function typeBody(
  body: BlockNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
  loopDepth: number,
): void {
  for (const stmt of body.statements) typeStmt(stmt, scope, returnType, ctx, loopDepth);
}

/** Types a single statement (RD-18 Slice 4a surface). Never throws. */
function typeStmt(
  stmt: StmtNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
  loopDepth: number,
): void {
  switch (stmt.kind) {
    case "LetDecl":
      typeLetDecl(stmt, scope, ctx);
      return;
    case "ExpressionStmt":
      typeOfExpr(stmt.expression, scope, ctx);
      return;
    case "ReturnStmt":
      typeReturn(stmt, scope, returnType, ctx);
      return;
    case "Block":
      // Flat model (AR-9): reuse the enclosing scope; carry the loop depth.
      typeBody(stmt, scope, returnType, ctx, loopDepth);
      return;
    case "IfStmt": {
      // Condition (E10134) + then-block + else (a Block, or a chained `else if`).
      typeCondition(stmt.condition, scope, ctx);
      typeBody(stmt.thenBlock, scope, returnType, ctx, loopDepth);
      if (stmt.elseClause !== null) {
        if (stmt.elseClause.kind === "Block") {
          typeBody(stmt.elseClause, scope, returnType, ctx, loopDepth);
        } else {
          typeStmt(stmt.elseClause, scope, returnType, ctx, loopDepth);
        }
      }
      return;
    }
    case "WhileStmt":
    case "DoWhileStmt":
      typeCondition(stmt.condition, scope, ctx);
      typeBody(stmt.body, scope, returnType, ctx, loopDepth + 1);
      return;
    case "ForStmt":
      typeFor(stmt, scope, returnType, ctx, loopDepth);
      return;
    case "BreakStmt":
      if (loopDepth === 0) {
        ctx.bag.addError(
          DiagCode.BreakOutsideLoopSwitch, // E10130
          stmt.span,
          "'break' can only appear inside a loop",
        );
      }
      return;
    case "ContinueStmt":
      if (loopDepth === 0) {
        ctx.bag.addError(
          DiagCode.ContinueOutsideLoop, // E10131
          stmt.span,
          "'continue' can only appear inside a loop",
        );
      }
      return;
    default:
      // switch/const/error — out of the 4a surface; skipped (never throws).
      return;
  }
}

/**
 * Types a control-flow condition (FR-1, spec Ch 05 §3). The condition must be
 * `boolean`; a non-boolean, non-poison type emits E10134 (AR-7). A poison
 * (`ERROR_TYPE`) condition stays silent — cascade suppression (3b R114). The
 * condition is recorded in `typeMap` by `typeOfExpr`.
 */
function typeCondition(expr: ExprNode, scope: Scope, ctx: TypeCheckContext): void {
  const t = typeOfExpr(expr, scope, ctx);
  if (!isError(t) && typeName(t) !== "boolean") {
    ctx.bag.addError(
      DiagCode.NonBooleanCondition, // E10134
      expr.span,
      `Condition must be type 'boolean' — found '${typeName(t)}'. Use an explicit comparison`,
    );
  }
}

/**
 * Types a `for (let i: T = init to|downto bound [step s]) body` (FR-3/FR-4, spec
 * Ch 05 §7). In order (§D): (1) the counter type must be an integer type —
 * `integerRange(T) === null` (a missing/non-integer annotation) emits E10065 and
 * poisons the counter (AR-15); (2) init + bound adapt to the counter type; (3) a
 * const end bound outside the counter's range emits E10064 (AR-10 — a non-const
 * bound is allowed and simply skips the check); (4) a `step`, if present, must
 * `evalConst` to an integer ≥ 1 else E10061 (AR-8). The body is always typed with
 * the counter in scope and the loop depth incremented.
 */
function typeFor(
  stmt: ForStmtNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
  loopDepth: number,
): void {
  const counterType = resolveTypeNode(stmt.varType);
  const range = integerRange(counterType);

  if (range === null) {
    // Covers both the omitted-annotation (`varType === null` → ERROR_TYPE) and the
    // non-integer-annotation (boolean/void) cases — do NOT rely on cascade
    // suppression, which would silently mis-lower (AR-15). Poison + type the body.
    ctx.bag.addError(
      DiagCode.ForCounterTypeNotInteger, // E10065
      stmt.varNameSpan,
      "For-loop counter must have an explicit integer type (byte/sbyte/word/sword)",
    );
    typeBody(stmt.body, scope, returnType, ctx, loopDepth + 1);
    return;
  }

  // (2) init + bound in the counter's context (literal adaptation, spec TS-2).
  typeOfExpr(stmt.init, scope, ctx, counterType);
  typeOfExpr(stmt.bound, scope, ctx, counterType);

  // (3) const end-bound range check (E10064); a non-const bound is allowed (AR-10).
  const bound = evalConst(stmt.bound);
  if (bound.kind === "value" && typeof bound.value === "number") {
    if (bound.value < range.min || bound.value > range.max) {
      ctx.bag.addError(
        DiagCode.ForEndBoundOutOfRange, // E10064
        stmt.bound.span,
        `For-loop end bound ${bound.value} out of range for type '${typeName(counterType)}' ` +
          `(range: ${range.min} to ${range.max})`,
      );
    }
  }

  // (4) step positivity (E10061): present → must fold to an integer ≥ 1.
  if (stmt.step !== null) {
    const step = evalConst(stmt.step);
    const ok =
      step.kind === "value" &&
      typeof step.value === "number" &&
      Number.isInteger(step.value) &&
      step.value >= 1;
    if (!ok) {
      ctx.bag.addError(
        DiagCode.StepValueNotPositive, // E10061
        stmt.step.span,
        "For-loop step must be a positive compile-time constant",
      );
    }
  }

  typeBody(stmt.body, scope, returnType, ctx, loopDepth + 1);
}

/**
 * Types a `let name: T = init;` (spec VAR-2). The declared type drives literal
 * adaptation of the initialiser; a constant initialiser is range-checked
 * (E10084/E10082) and its type must be assignment-compatible with `T`
 * (E10152/E10153/E10154). An initialiser-less `let` is valid — no init check.
 */
function typeLetDecl(decl: LetDeclNode, scope: Scope, ctx: TypeCheckContext): void {
  const declaredType = resolveTypeNode(decl.declaredType);

  // Record the introduced symbol (name-introducing node → its symbol), if the
  // Pass-1 collector placed it in this scope.
  const sym = scope.symbols.get(decl.name);
  if (sym !== undefined) ctx.symbolMap.set(decl, sym);

  if (decl.initialiser === null) return; // initialiser-less let (spec VAR-2) — no check

  const initType = typeOfExpr(decl.initialiser, scope, ctx, declaredType);
  checkConstRange(decl.initialiser, declaredType, ctx); // E10084 / E10082
  checkAssignable(initType, declaredType, decl.initialiser.span, ctx); // E10152/53/54
}

/**
 * Types a `return [expr];`. In a `void` function, `return expr;` is invalid
 * (E10173). The value is typed regardless (populating `typeMap`). Full
 * all-paths-return analysis (R80) is Slice 4.
 */
function typeReturn(
  stmt: ReturnStmtNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
): void {
  if (stmt.value === null) return;
  typeOfExpr(stmt.value, scope, ctx, returnType);
  if (typeName(returnType) === "void") {
    ctx.bag.addError(
      DiagCode.VoidFunctionReturnsValue, // E10173
      stmt.span,
      "A 'void' function cannot return a value",
    );
  }
}
