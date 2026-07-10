/**
 * Statement typing + the Pass-3 driver.
 *
 * `typeCheckPrograms` walks every function/interrupt body and types every
 * statement it contains: `let` declarations (type the initialiser in its
 * declared-type context; range-check constants → E10084/E10082; assignment
 * compatibility → E10152/E10153/E10154), expression statements (assignments,
 * `poke`/`pokew`, …), `return`, and control-flow statements (if/while/for/switch,
 * handled by `typeStmt` below). Never throws.
 */

import { DiagCode, isError, isInteger, primitive, typeName } from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  ExprNode,
  FallthroughStmtNode,
  ForStmtNode,
  LetDeclNode,
  ProgramNode,
  ReturnStmtNode,
  Scope,
  StmtNode,
  SwitchStmtNode,
  Type,
} from "@blend65/core";
import type { IntRange } from "./type-resolution.js";
import type { TypeCheckContext } from "./context.js";
import {
  typeOfExpr,
  checkAssignable,
  checkConstRange,
  checkReturnAssignable,
} from "./expression-typing.js";
import { enclosingFunctionSymbol } from "./name-resolution.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import { evalConst } from "../const-eval.js";

/**
 * Runs Pass-3 type checking over every function/interrupt body in all programs.
 * The body scopes (with their ordered locals) come from the earlier
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
 * Types every statement in a body block, reusing the enclosing (flat) scope.
 * `loopDepth` records how many enclosing loops the block sits in, so
 * `break`/`continue` outside any loop are caught.
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

/** Types a single statement. Never throws. */
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
      // Flat scope model: reuse the enclosing scope; carry the loop depth.
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
    case "SwitchStmt":
      typeSwitch(stmt, scope, returnType, ctx, loopDepth);
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
      // const/error — outside the handled statement kinds; skipped (never throws).
      return;
  }
}

/**
 * Types a `switch (disc) { case ...: ...  default: ... }`. In order: (1) the
 * discriminant must be an integer type (`byte`/`sbyte`/`word`/`sword`) —
 * anything else (notably `boolean`) → E10075 and poison (skip the
 * dt-dependent case-value checks); (2) each case value is validated in
 * precedence order E10071 → E10084 → E10077 with cross-clause duplicate
 * detection (E10132); (3) `fallthrough` placement is checked (E10074
 * misplaced / E10073 no-effect warning); (4) every clause body is typed
 * (`break`/`continue` keep the enclosing `loopDepth` — switch is transparent
 * to loop context). `defaultClause` is always present (parser-synthesized).
 * Never throws.
 */
function typeSwitch(
  stmt: SwitchStmtNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
  loopDepth: number,
): void {
  // (1) Discriminant operand-type (E10075). `integerRange(dt) === null` covers
  // boolean/void/error/aggregate; a poisoned (ERROR_TYPE) discriminant stays
  // silent (cascade suppression — an already-reported error shouldn't cause a
  // second, misleading diagnostic) but still poisons the case checks.
  const dt = typeOfExpr(stmt.discriminant, scope, ctx);
  const range = integerRange(dt);
  if (range === null) {
    if (!isError(dt)) {
      ctx.bag.addError(
        DiagCode.InvalidSwitchOperandType, // E10075
        stmt.discriminant.span,
        `Cannot switch on type '${typeName(dt)}' — switch expression must be ` +
          `'byte', 'sbyte', 'word', 'sword', or an enum type`,
      );
    }
  } else {
    // (2) Per-value validation + cross-clause duplicate detection.
    const seen = new Set<number>();
    for (const clause of stmt.cases) {
      for (const value of clause.values) typeCaseValue(value, dt, range, seen, scope, ctx);
    }
  }

  // (3) `fallthrough` placement. `defaultClause` is always the last clause, so a
  // trailing `fallthrough` there (nothing to fall into) is the E10073 warning.
  const clauseBodies: readonly StmtNode[][] = [
    ...stmt.cases.map((c) => c.body),
    stmt.defaultClause.body,
  ];
  clauseBodies.forEach((body, i) =>
    checkFallthroughPlacement(body, i === clauseBodies.length - 1, ctx),
  );

  // (4) Type each clause body (switch does not raise `loopDepth` — transparency).
  for (const clause of stmt.cases) {
    for (const s of clause.body) typeStmt(s, scope, returnType, ctx, loopDepth);
  }
  for (const s of stmt.defaultClause.body) typeStmt(s, scope, returnType, ctx, loopDepth);
}

/**
 * Validates one case value against the discriminant type `dt`, in precedence
 * order — the first failing check emits and returns (no cascade). Typing the
 * value in `dt`'s context memoises its adapted type into `typeMap` (so
 * lowering emits a discriminant-width immediate).
 *
 * (a) not an integer constant (non-const/identifier/bool) → E10071;
 * (b) an integer constant out of `dt`'s range → E10084 (a *range* error);
 * (c) a folded constant whose type is a genuinely different, non-adapting (non-
 *     integer) primitive vs `dt` → E10077 (bespoke — not the assignment path).
 *     Integer literals adapt to `dt` and integer constants are range-validated in
 *     (b), so (c) is unreachable while case values are integer-only; it becomes
 *     live once enum/other-primitive constants are supported as case values.
 * (d) a value equal to one already used across any clause → E10132.
 */
function typeCaseValue(
  value: ExprNode,
  dt: Type,
  range: IntRange,
  seen: Set<number>,
  scope: Scope,
  ctx: TypeCheckContext,
): void {
  const vt = typeOfExpr(value, scope, ctx, dt); // adapt + memoise for lowering width
  const folded = evalConst(value);
  if (folded.kind === "divByZero") {
    ctx.bag.addError(
      DiagCode.ConstDivisionByZero, // E10082
      folded.span,
      "Division by zero in constant expression",
    );
    return;
  }
  if (folded.kind !== "value" || typeof folded.value !== "number") {
    ctx.bag.addError(
      DiagCode.CaseValueNotConstant, // E10071
      value.span,
      "Case value must be a compile-time constant",
    );
    return;
  }
  if (folded.value < range.min || folded.value > range.max) {
    ctx.bag.addError(
      DiagCode.ValueOutOfRange, // E10084 (range, not type-mismatch)
      value.span,
      `Value ${folded.value} out of range for type '${typeName(dt)}' ` +
        `(range: ${range.min} to ${range.max})`,
    );
    return;
  }
  if (!isError(vt) && !isInteger(vt) && typeName(vt) !== typeName(dt)) {
    ctx.bag.addError(
      DiagCode.CaseValueTypeMismatch, // E10077 (bespoke; rarely reachable — most mismatches are caught earlier)
      value.span,
      `Case value type '${typeName(vt)}' does not match switch expression type ` +
        `'${typeName(dt)}'`,
    );
    return;
  }
  if (seen.has(folded.value)) {
    ctx.bag.addError(
      DiagCode.DuplicateCaseValue, // E10132
      value.span,
      `Duplicate case value ${folded.value}`,
    );
    return;
  }
  seen.add(folded.value);
}

/**
 * Checks `fallthrough` placement within one clause body (FR-6/FR-7, spec §8.3):
 * a `fallthrough` must be the **last** statement of the body and never nested
 * inside a child block/`if`/loop. A misplaced `fallthrough` (not last, or nested)
 * → E10074; a `fallthrough` that is the last statement of the **last** clause
 * (nothing to fall into) → E10073 *warning*. A `fallthrough` inside a NESTED
 * `switch` belongs to that switch and is not visited here.
 */
function checkFallthroughPlacement(
  body: readonly StmtNode[],
  isLastClause: boolean,
  ctx: TypeCheckContext,
): void {
  body.forEach((s, j) => {
    if (s.kind === "FallthroughStmt") {
      if (j !== body.length - 1) {
        ctx.bag.addError(DiagCode.FallthroughNotLast, s.span, FALLTHROUGH_POSITION_MSG); // E10074
      } else if (isLastClause) {
        ctx.bag.addWarning(
          DiagCode.FallthroughNoEffect, // E10073 (warning)
          s.span,
          "'fallthrough' has no effect — this is the last case in the switch",
        );
      }
      // else: a valid trailing `fallthrough` into the next clause's body.
      return;
    }
    const nested = findNestedFallthrough(s);
    if (nested !== null) {
      ctx.bag.addError(DiagCode.FallthroughNotLast, nested.span, FALLTHROUGH_POSITION_MSG); // E10074
    }
  });
}

/** The shared E10074 message (spec §8.3 / F009:513). */
const FALLTHROUGH_POSITION_MSG =
  "'fallthrough' must be the last statement in a case body — it cannot be inside " +
  "an if/while/for block, and no statements may follow it";

/**
 * Finds a `FallthroughStmt` nested inside a case-body statement's child blocks
 * (`Block`/`if`/`while`/`do-while`/`for`), or `null`. Deliberately does NOT descend
 * into a nested `SwitchStmt` — a `fallthrough` there belongs to the inner switch.
 */
function findNestedFallthrough(stmt: StmtNode): FallthroughStmtNode | null {
  switch (stmt.kind) {
    case "FallthroughStmt":
      return stmt;
    case "Block":
      return firstNestedFallthrough(stmt.statements);
    case "IfStmt": {
      const thenHit = firstNestedFallthrough(stmt.thenBlock.statements);
      if (thenHit !== null) return thenHit;
      if (stmt.elseClause !== null) {
        return stmt.elseClause.kind === "Block"
          ? firstNestedFallthrough(stmt.elseClause.statements)
          : findNestedFallthrough(stmt.elseClause);
      }
      return null;
    }
    case "WhileStmt":
    case "DoWhileStmt":
    case "ForStmt":
      return firstNestedFallthrough(stmt.body.statements);
    default:
      // SwitchStmt (inner switch owns its own fallthroughs) / leaf statements.
      return null;
  }
}

/** The first nested `fallthrough` across a statement list, or `null`. */
function firstNestedFallthrough(stmts: readonly StmtNode[]): FallthroughStmtNode | null {
  for (const s of stmts) {
    const hit = findNestedFallthrough(s);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Types a control-flow condition. The condition must be `boolean`; a
 * non-boolean, non-poison type emits E10134. A poison (`ERROR_TYPE`) condition
 * stays silent to avoid cascading a diagnostic that already fired on the
 * expression itself. The condition is recorded in `typeMap` by `typeOfExpr`.
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
 * Types a `for (let i: T = init to|downto bound [step s]) body`. In order:
 * (1) the counter type must be an integer type — `integerRange(T) === null`
 * (a missing/non-integer annotation) emits E10065 and poisons the counter;
 * (2) init + bound adapt to the counter type; (3) a const end bound outside
 * the counter's range emits E10064 (a non-const bound is allowed and simply
 * skips the check); (4) a `step`, if present, must `evalConst` to an integer
 * ≥ 1 else E10061. The body is always typed with the counter in scope and the
 * loop depth incremented.
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
    // suppression, which would silently mis-lower. Poison + type the body.
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

  // (3) const end-bound range check (E10064); a non-const bound is allowed.
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
 * (E10173) and a bare `return;` is an early exit. In a non-void function, a
 * bare `return;` is E10172, and a returned value must be strictly assignable
 * to the declared return type (the assignment family, return-context
 * wording) after constant range checking. The value is typed regardless
 * (populating `typeMap`); a poisoned value or return type suppresses the
 * dependent checks. Full all-paths-return analysis is a post-check pass.
 */
function typeReturn(
  stmt: ReturnStmtNode,
  scope: Scope,
  returnType: Type,
  ctx: TypeCheckContext,
): void {
  const isVoid = typeName(returnType) === "void";

  if (stmt.value === null) {
    if (!isVoid && !isError(returnType)) {
      const fnName = enclosingFunctionSymbol(scope)?.name ?? "?";
      ctx.bag.addError(
        DiagCode.MissingReturnValue, // E10172
        stmt.span,
        `Missing return value — function '${fnName}' returns ` +
          `'${typeName(returnType)}' but 'return' has no expression`,
      );
    }
    return;
  }

  const valueType = typeOfExpr(stmt.value, scope, ctx, returnType);
  if (isVoid) {
    ctx.bag.addError(
      DiagCode.VoidFunctionReturnsValue, // E10173
      stmt.span,
      "A 'void' function cannot return a value",
    );
    return;
  }
  if (isError(returnType)) return; // poisoned declaration — nothing to check against

  checkConstRange(stmt.value, returnType, ctx); // E10084 / E10082
  const fnName = enclosingFunctionSymbol(scope)?.name ?? "?";
  checkReturnAssignable(valueType, returnType, fnName, stmt.value.span, ctx);
}
