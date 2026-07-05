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

import { DiagCode, primitive, typeName } from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  LetDeclNode,
  ProgramNode,
  ReturnStmtNode,
  Scope,
  StmtNode,
  Type,
} from "@blend65/core";
import type { TypeCheckContext } from "./context.js";
import { typeOfExpr, checkAssignable, checkConstRange } from "./expression-typing.js";
import { resolveTypeNode } from "./type-resolution.js";

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
          typeBody(item.body, bodyScope, resolveTypeNode(item.returnType), ctx);
        }
      } else if (item.kind === "InterruptDecl") {
        const bodyScope = scopeByNode.get(item);
        if (bodyScope !== undefined) {
          typeBody(item.body, bodyScope, primitive("void"), ctx);
        }
      }
    }
  }
}

/** Types every statement in a function body block. */
function typeBody(body: BlockNode, scope: Scope, returnType: Type, ctx: TypeCheckContext): void {
  for (const stmt of body.statements) typeStmt(stmt, scope, returnType, ctx);
}

/** Types a single statement (the Slice-3b surface; others are skipped). */
function typeStmt(stmt: StmtNode, scope: Scope, returnType: Type, ctx: TypeCheckContext): void {
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
      // Slice 3b builds no nested block scopes (Slice 4); reuse the enclosing
      // scope so straight-line blocks still type without crashing.
      typeBody(stmt, scope, returnType, ctx);
      return;
    default:
      // if/while/for/switch/do-while/break/continue/const/error — out of the 3b
      // surface; a program using them is not 3b-lowerable. Skipped (never throws).
      return;
  }
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
