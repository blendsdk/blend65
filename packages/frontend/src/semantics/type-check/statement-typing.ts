/**
 * Statement typing + the Pass-3 driver.
 *
 * `typeCheckPrograms` walks every function/interrupt body and types every
 * statement it contains: `let` declarations (type the initialiser in its
 * declared-type context; range-check constants → E10084/E10082; assignment
 * compatibility → E10152/E10153/E10154), expression statements (assignments,
 * `poke`/`pokew`, …), `return`, and control-flow statements (if/while/for/switch,
 * handled by `typeStmt` below).
 *
 * It also types the module-level declarations: module `let` initialisers are
 * checked with the same strict codes as a local `let` but must be CALL-FREE —
 * any call (user function, or a builtin intrinsic other than `lo`/`hi`) is a
 * loud not-supported rejection; module `const`s evaluate at compile time,
 * declaration-order independent (spec VAR-6), into `ctx.constValues` — a
 * non-constant initialiser is E10193, a const-const definition cycle is one
 * E10194 per cycle. Never throws.
 */

import {
  DiagCode,
  ERROR_TYPE,
  IceCode,
  isAssignableTo,
  isError,
  isInteger,
  primitive,
  typeName,
  walkChildren,
  walkNode,
} from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BlockNode,
  ConstDeclNode,
  EmbedExprNode,
  ExprNode,
  FallthroughStmtNode,
  ForStmtNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  ProgramNode,
  ReturnStmtNode,
  Scope,
  StmtNode,
  SwitchStmtNode,
  Symbol,
  ZeropageFieldNode,
  Type,
} from "@blend65/core";
import { encoderFor } from "@blend65/core/platform";
import type { CharEncoder } from "@blend65/core/platform";
import type { IntRange } from "./type-resolution.js";
import type { TypeCheckContext } from "./context.js";
import {
  typeOfExpr,
  checkAssignable,
  checkConstRange,
  checkIntermediateOverflow,
  checkReturnAssignable,
} from "./expression-typing.js";
import { enclosingFunctionSymbol } from "./name-resolution.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import { evalConst } from "../const-eval.js";
import { buildConstImage } from "../const-images.js";
import type { ConstRefResolver } from "../const-eval.js";
import { desugarStringInit } from "../string-literal.js";

/** The deterministic fallback when a context carries no const/type engine. */
const RAW_ENCODER = encoderFor(undefined);

/** The character encoder the context's engine carries (raw fallback). */
function encoderOf(ctx: TypeCheckContext): CharEncoder {
  return ctx.engine?.encoder ?? RAW_ENCODER;
}

/**
 * Runs Pass-3 type checking over every function/interrupt body — and every
 * module-level `let`/`const` declaration — in all programs. The body scopes
 * (with their ordered locals) come from the earlier `collectFunctions` pass
 * via `scopeByNode`; module declarations resolve against their module scope.
 * Module consts evaluate in a separate declaration-order-independent phase
 * (spec VAR-6) before the per-item walk. Never throws.
 *
 * @param programs The parsed program ASTs.
 * @param scopeByNode Decl node → its body scope (from Pass-1 collection).
 * @param moduleScopeByProgram Each program → its (shared) module scope.
 * @param ctx The Pass-3 context (bag + `typeMap`/`symbolMap`/`constValues`).
 */
export function typeCheckPrograms(
  programs: readonly ProgramNode[],
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  ctx: TypeCheckContext,
): void {
  evaluateModuleConsts(programs, moduleScopeByProgram, ctx);

  for (const program of programs) {
    const moduleScope = moduleScopeByProgram.get(program);
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
      } else if (item.kind === "LetDecl" && moduleScope !== undefined) {
        typeModuleLet(item, moduleScope, ctx);
      } else if (item.kind === "ZeropageBlock" && moduleScope !== undefined) {
        for (const field of item.fields) typeZeropageField(field, moduleScope, ctx);
      }
    }
  }
}

/**
 * Types a module-level `let name: T = init;`. The initialiser must be
 * CALL-FREE — module initializers run before `main` from a generated startup
 * stream, and calls would hide reads from the dependency analysis that orders
 * them — so ANY call (a user function, or a builtin intrinsic other than the
 * value-folding `lo`/`hi`, whose arguments are still searched) is rejected
 * loudly rather than silently miscompiled. A call-free initialiser is checked
 * exactly like a local `let`: typed in the declared-type context, constant
 * range-checked (E10084/E10082), and strictly assignable (E10152/53/54).
 */
function typeModuleLet(decl: LetDeclNode, moduleScope: Scope, ctx: TypeCheckContext): void {
  const sym = moduleScope.symbols.get(decl.name);
  // A duplicate declaration's loser was never registered — already E10003.
  if (sym === undefined || sym.decl !== decl) return;
  ctx.symbolMap.set(decl, sym);

  const declaredType = letDeclaredType(decl, sym);
  // String initialisers desugar into their encoded byte elements before any
  // shape-sensitive check, so the coverage advisory and size inference see
  // the element list the string denotes.
  if (desugarStringInit(decl, declaredType, encoderOf(ctx), ctx.bag)) return;
  checkArrayInitCoverage(decl, declaredType, ctx); // W10140/W10141
  if (decl.initialiser === null) return; // indeterminate until assigned (spec VAR-2)

  const call = findInitializerCall(decl.initialiser);
  if (call !== null) {
    ctx.bag.addError(
      IceCode.Unexpected,
      call.span,
      "call-bearing module initializers are not supported yet — assign in main() instead",
    );
    ctx.typeMap.set(decl.initialiser, ERROR_TYPE);
    return;
  }

  const initType = typeOfExpr(decl.initialiser, moduleScope, ctx, declaredType);
  checkConstRange(decl.initialiser, declaredType, ctx); // E10084 / E10082
  checkAssignable(initType, declaredType, decl.initialiser.span, ctx); // E10152/53/54
  checkIntermediateOverflow(decl.initialiser, initType, declaredType, ctx); // W10160/61
  inferUnsizedArray(sym, declaredType, initType);
}

/**
 * Types one zeropage field — module-`let` parity throughout: the initialiser
 * must be call-free (it joins the same pre-`main` startup stream), string
 * array initialisers keep their loud rejection, and a call-free initialiser
 * is typed in the declared-type context with the same range/assignability/
 * overflow checks. An uninitialized field is indeterminate until written —
 * zero page gets NO zero-fill.
 */
function typeZeropageField(
  field: ZeropageFieldNode,
  moduleScope: Scope,
  ctx: TypeCheckContext,
): void {
  const sym = moduleScope.symbols.get(field.name);
  // A duplicate declaration's loser was never registered — already E10003.
  if (sym === undefined || sym.decl !== field) return;
  ctx.symbolMap.set(field, sym);

  // Declared type: the resolved annotation, falling back to the symbol's
  // finalized type for named/aggregate annotations (same rule as lets).
  const scalar = resolveTypeNode(field.fieldType);
  const declaredType =
    !isError(scalar) || sym.type.kind === "primitive" || sym.type.kind === "error"
      ? scalar
      : sym.type;

  // String initialisers desugar before the shape-sensitive checks — same
  // ordering as module lets, so zeropage fields get full string parity.
  if (desugarStringInit(field, declaredType, encoderOf(ctx), ctx.bag)) return;
  checkArrayInitCoverage(field, declaredType, ctx); // W10140/W10141
  if (field.initialiser === null) return; // indeterminate until written (spec ZP rule)

  const call = findInitializerCall(field.initialiser);
  if (call !== null) {
    ctx.bag.addError(
      IceCode.Unexpected,
      call.span,
      "call-bearing module initializers are not supported yet — assign in main() instead",
    );
    ctx.typeMap.set(field.initialiser, ERROR_TYPE);
    return;
  }

  const initType = typeOfExpr(field.initialiser, moduleScope, ctx, declaredType);
  checkConstRange(field.initialiser, declaredType, ctx); // E10084 / E10082
  checkAssignable(initType, declaredType, field.initialiser.span, ctx); // E10152/53/54
  checkIntermediateOverflow(field.initialiser, initType, declaredType, ctx); // W10160/61
  inferUnsizedArray(sym, declaredType, initType);
}

/**
 * The first call anywhere in a module initializer, or `null`. Both call node
 * kinds count — user/platform calls, and builtin intrinsics other than
 * `lo`/`hi` (builtins parse as their own node kind, so a plain-call search
 * would miss them). `lo`/`hi` themselves fold to values, but their arguments
 * are still searched — a call nested inside `lo(...)` is still a call.
 */
function findInitializerCall(root: ExprNode): ExprNode | null {
  let found: ExprNode | null = null;
  const visit = (node: AstNode): void => {
    if (found !== null) return;
    if (node.kind === "CallExpr") {
      found = node as ExprNode;
      return;
    }
    if (node.kind === "IntrinsicCallExpr") {
      const intrinsic = node as IntrinsicCallExprNode;
      if (intrinsic.name !== "lo" && intrinsic.name !== "hi") {
        found = intrinsic;
        return;
      }
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}

/**
 * Evaluates every module `const` at compile time (spec VAR-6 — declaration-
 * order independent), filling `ctx.constValues`.
 *
 * Phases: (1) collect const symbols + type every initialiser (recording
 * `symbolMap` entries for its references; a type-incompatible initialiser
 * gets the assignment-family diagnostic and evaluates no value); (2) build
 * const→const reference edges and reject every definition cycle with ONE
 * E10194 carrying the cycle path (members poison — no value); (3) evaluate
 * the acyclic remainder dependency-first through a resolver that folds
 * references to already-evaluated consts. A non-constant initialiser (a
 * variable read, an unsupported shape) is E10193 with the spec message; a
 * reference whose own failure is already diagnosed stays silent (one root
 * cause). Values are range-checked against the declared type (E10084) before
 * they are recorded.
 */
function evaluateModuleConsts(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  ctx: TypeCheckContext,
): void {
  // (1) Collect + type. Duplicate-declaration losers were never registered.
  // Aggregate-typed consts (arrays/structs) skip the scalar typing check —
  // their literal initialisers are typed by the aggregate typing surface and
  // their values are memory IMAGES built below.
  const consts = new Map<Symbol, { decl: ConstDeclNode; moduleScope: Scope }>();
  const typePoisoned = new Set<Symbol>();
  const aggregates = new Set<Symbol>();
  for (const program of programs) {
    const moduleScope = moduleScopeByProgram.get(program);
    if (moduleScope === undefined) continue;
    for (const item of program.items) {
      if (item.kind !== "ConstDecl") continue;
      const sym = moduleScope.symbols.get(item.name);
      if (sym === undefined || sym.decl !== item) continue;
      ctx.symbolMap.set(item, sym);
      consts.set(sym, { decl: item, moduleScope });

      // String initialisers desugar into their encoded byte elements before
      // anything reads the initialiser's shape, so the unsized-inference
      // check and the const-image builder see a plain element list.
      if (desugarStringInit(item, letDeclaredType(item, sym), encoderOf(ctx), ctx.bag)) {
        typePoisoned.add(sym);
        continue;
      }

      // An embed() initialiser is fully handled here (the ONLY position it
      // is legal in); its value comes from the asset reader, not folding.
      // A failed embed marks the symbol so the evaluation phase below never
      // treats the initialiser as a foldable scalar.
      if (item.initialiser.kind === "EmbedExpr") {
        typeEmbedConst(item, item.initialiser, sym, program.moduleDecl?.name, ctx);
        if (!ctx.constValues.has(sym)) typePoisoned.add(sym);
        continue;
      }

      // The symbol's type was finalized by the type-resolution pass.
      if (sym.type.kind === "array" || sym.type.kind === "struct") {
        aggregates.add(sym);
        continue;
      }

      const declaredType = resolveTypeNode(item.declaredType);
      const initType = typeOfExpr(item.initialiser, moduleScope, ctx, declaredType);
      checkAssignable(initType, declaredType, item.initialiser.span, ctx);
      if (!isAssignableTo(initType, declaredType)) typePoisoned.add(sym);
    }
  }
  if (consts.size === 0) return;

  // (2) Definition cycles were detected by the const/type engine (its
  // in-progress stack spans constants, struct layouts, and enum values, so
  // mixed cycles report exactly once); the members it poisoned evaluate no
  // value here.
  const cycleMembers: ReadonlySet<Symbol> = ctx.engine?.poisonedConsts ?? new Set<Symbol>();

  // (3) Dependency-first evaluation (recursive + memoised; cycles excluded, so
  // the recursion is bounded by the acyclic dependency depth).
  const evaluating = new Set<Symbol>();
  const evaluateOne = (sym: Symbol): void => {
    if (
      ctx.constValues.has(sym) ||
      cycleMembers.has(sym) ||
      typePoisoned.has(sym) ||
      evaluating.has(sym)
    ) {
      return;
    }
    const info = consts.get(sym);
    if (info === undefined) return;
    evaluating.add(sym);

    // Aggregate consts fold into a memory image through the engine. An
    // unsized const annotation infers its size from a full element-list
    // initialiser FIRST (the image is sized by the initialiser, not the
    // annotation); the fill form and any other initialiser shape cannot
    // determine a size (E10126).
    if (aggregates.has(sym)) {
      if (sym.type.kind === "array" && sym.type.size === null) {
        const init = info.decl.initialiser;
        if (init.kind === "ArrayLitExpr" && init.fill === null && init.elements.length > 0) {
          sym.type = { kind: "array", element: sym.type.element, size: init.elements.length };
        } else {
          ctx.bag.addError(
            DiagCode.FillRequiresExplicitSize,
            init.span,
            init.kind === "ArrayLitExpr"
              ? "A '; fill' value needs an explicit declared array size"
              : "array size required — an unsized array type is legal only as a function " +
                "parameter or with a full element-list initializer",
          );
          evaluating.delete(sym);
          return;
        }
      }
      if (ctx.engine !== undefined) {
        const image = buildConstImage(sym.type, info.decl.initialiser, {
          engine: ctx.engine,
          scope: info.moduleScope,
          bag: ctx.bag,
          constName: sym.name,
        });
        if (image !== null) {
          ctx.constValues.set(sym, { type: sym.type, value: 0, bytes: image });
        }
      }
      evaluating.delete(sym);
      return;
    }

    const resolveRef: ConstRefResolver = (ref) => {
      const target = ctx.symbolMap.get(ref);
      if (target === undefined) return { kind: "poisoned" }; // unresolved — already diagnosed
      if (target.kind !== "constant") return { kind: "nonconst" }; // runtime entity
      if (consts.has(target)) evaluateOne(target);
      const value = ctx.constValues.get(target);
      // A const without a value failed for an already-reported reason.
      return value === undefined
        ? { kind: "poisoned" }
        : { kind: "value", value: value.value };
    };

    const declaredType = resolveTypeNode(info.decl.declaredType);
    // The initialisers were all typed during collection, so the type lookup
    // is populated — the width-sensitive folds (~, shifts, casts) engage.
    // Query intrinsics (`sizeof`/`offsetof`/`length`) fold via the engine.
    const result = evalConst(
      info.decl.initialiser,
      resolveRef,
      (e) => ctx.typeMap.get(e),
      ctx.engine?.intrinsicFolder(info.moduleScope),
    );
    evaluating.delete(sym);

    if (result.kind === "poisonedRef") return; // root cause already reported
    if (result.kind === "nonConst") {
      ctx.bag.addError(
        DiagCode.NonConstInit,
        info.decl.initialiser.span,
        `Initializer for const '${sym.name}' is not a compile-time constant expression`,
      );
      return;
    }
    // value or divByZero: one shared range/div-zero check (E10084/E10082).
    if (!checkConstRange(info.decl.initialiser, declaredType, ctx, resolveRef)) return;
    if (result.kind !== "value") return;
    ctx.constValues.set(sym, { type: declaredType, value: result.value });
  };
  for (const sym of consts.keys()) evaluateOne(sym);
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
      // Only calls are valid expression statements (grammar §5.4). The
      // aggregate literals are rejected here so they can never fall through
      // to code generation; the general rule for other expressions is a
      // separate, later enforcement.
      if (stmt.expression.kind === "StructLitExpr" || stmt.expression.kind === "ArrayLitExpr") {
        ctx.bag.addError(
          DiagCode.ExpressionStatementNotACall,
          stmt.expression.span,
          "An aggregate literal is not a statement — only calls are valid expression statements",
        );
        return;
      }
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
  // An enum discriminant is legal — its values are its byte backing.
  const range = dt.kind === "enum" ? { min: 0, max: 255 } : integerRange(dt);
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
  let folded = evalConst(value);
  if (folded.kind === "nonConst" && ctx.engine !== undefined) {
    // Enum members and module constants fold through the engine.
    const viaEngine = ctx.engine.evalExpr(value, scope);
    if (viaEngine?.kind === "value") folded = { kind: "value", value: viaEngine.value };
  }
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
  if (dt.kind === "enum" && vt !== dt && !isError(vt)) {
    // An enum switch takes only members of THAT enum (or explicit casts to it).
    ctx.bag.addError(
      DiagCode.CaseValueTypeMismatch, // E10077
      value.span,
      `Case value type '${typeName(vt)}' does not match switch expression type ` +
        `'${typeName(dt)}' — use a member of '${typeName(dt)}'`,
    );
    return;
  }
  if (!isError(vt) && vt.kind === "enum" && dt.kind !== "enum" && typeName(dt) !== "byte") {
    // An enum member widens to byte only; wider/signed discriminants mismatch.
    ctx.bag.addError(
      DiagCode.CaseValueTypeMismatch, // E10077
      value.span,
      `Case value type '${typeName(vt)}' does not match switch expression type '${typeName(dt)}'`,
    );
    return;
  }
  if (!isError(vt) && vt.kind !== "enum" && !isInteger(vt) && typeName(vt) !== typeName(dt)) {
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
  // Record the introduced symbol (name-introducing node → its symbol), if the
  // Pass-1 collector placed it in this scope.
  const sym = scope.symbols.get(decl.name);
  if (sym !== undefined) ctx.symbolMap.set(decl, sym);

  const declaredType = letDeclaredType(decl, sym);
  // String initialisers desugar before the shape-sensitive checks (same
  // ordering as module lets), so locals get identical string behavior.
  if (desugarStringInit(decl, declaredType, encoderOf(ctx), ctx.bag)) return;
  checkArrayInitCoverage(decl, declaredType, ctx); // W10140/W10141

  if (decl.initialiser === null) return; // initialiser-less let (spec VAR-2) — no check

  const initType = typeOfExpr(decl.initialiser, scope, ctx, declaredType);
  checkConstRange(decl.initialiser, declaredType, ctx); // E10084 / E10082
  checkAssignable(initType, declaredType, decl.initialiser.span, ctx); // E10152/53/54
  checkIntermediateOverflow(decl.initialiser, initType, declaredType, ctx); // W10160/61
  inferUnsizedArray(sym, declaredType, initType);
}

/**
 * Types a module-level `const name: byte[N?] = embed("path");` — the ONLY
 * position an embed is legal in.
 *
 * The declared type must be a byte-element array (sized or unsized). The
 * injected reader supplies the bytes at analysis time; reader failures map
 * to the embed diagnostic family. An absent reader (editors, tests — no
 * disk policy) poisons silently: a diagnostic would make editor analysis
 * noisy, and a fabricated size would poison downstream layout worse than
 * none. On success the symbol receives the exact file size (unsized forms
 * infer it) and the const value carries the bytes with embed provenance,
 * so `length()` folding, index-tier checks, and data emission see a normal
 * sized const array.
 */
function typeEmbedConst(
  decl: ConstDeclNode,
  embed: EmbedExprNode,
  sym: Symbol,
  moduleName: string | undefined,
  ctx: TypeCheckContext,
): void {
  if (embed.format !== null) {
    ctx.bag.addError(
      IceCode.Unexpected,
      embed.formatSpan ?? embed.span,
      "format-aware embed() is not supported yet — use raw embed(path)",
    );
    sym.type = ERROR_TYPE;
    return;
  }

  const declaredType = letDeclaredType(decl, sym);
  if (
    declaredType.kind !== "array" ||
    declaredType.element.kind !== "primitive" ||
    declaredType.element.name !== "byte"
  ) {
    ctx.bag.addError(
      DiagCode.EmbedNonConst,
      embed.span,
      "embed() is only legal as the full initializer of a module-level " +
        "'const' byte-array declaration",
    );
    sym.type = ERROR_TYPE;
    return;
  }

  if (ctx.assetReader === undefined) {
    sym.type = ERROR_TYPE;
    return;
  }

  const result = ctx.assetReader.readAsset(embed.span.sourceId, embed.path);
  if (result.kind === "not-found") {
    ctx.bag.addError(
      DiagCode.EmbedFileNotFound,
      embed.pathSpan,
      `Embedded file not found: '${embed.path}'`,
    );
    sym.type = ERROR_TYPE;
    return;
  }
  if (result.kind === "outside-root") {
    ctx.bag.addError(
      DiagCode.EmbedPathEscapesRoot,
      embed.pathSpan,
      `Embedded path '${embed.path}' resolves outside the project root`,
    );
    sym.type = ERROR_TYPE;
    return;
  }
  if (result.kind === "too-large") {
    ctx.bag.addError(
      DiagCode.EmbedSizeMismatch,
      embed.pathSpan,
      `Embedded file '${embed.path}' is ${result.size} bytes — larger than the ` +
        "65536-byte cap (nothing larger fits the address space)",
    );
    sym.type = ERROR_TYPE;
    return;
  }

  const bytes = result.bytes;
  if (declaredType.size !== null && declaredType.size !== bytes.byteLength) {
    ctx.bag.addError(
      DiagCode.EmbedSizeMismatch,
      embed.pathSpan,
      `Embedded file size (${bytes.byteLength} bytes) does not match the ` +
        `declared array size (${declaredType.size})`,
    );
    sym.type = ERROR_TYPE;
    return;
  }

  const sized: Type = {
    kind: "array",
    element: declaredType.element,
    size: bytes.byteLength,
  };
  sym.type = sized;
  ctx.typeMap.set(embed, sized);
  ctx.constValues.set(sym, { type: sized, value: 0, bytes, source: "embed" });
  if (moduleName !== undefined) {
    ctx.embeddedAssets?.set(`${moduleName}.${sym.name}`, result.resolvedPath);
  }
}

/**
 * The declared type a `let`/`const` checks against: primitives resolve
 * directly; named/array annotations were finalized onto the SYMBOL by the
 * type-resolution pass, so the symbol's type is authoritative for them.
 */
function letDeclaredType(
  decl: LetDeclNode | ConstDeclNode,
  sym: Symbol | undefined,
): Type {
  const scalar = resolveTypeNode(decl.declaredType);
  if (!isError(scalar)) return scalar;
  if (sym !== undefined && sym.type.kind !== "primitive" && sym.type.kind !== "error") {
    return sym.type;
  }
  return scalar;
}

/**
 * The array-initialisation advisories: a `let` array with no initialiser is
 * entirely undefined until written (W10141); one initialised with fewer
 * elements than its size and no fill leaves the remainder undefined
 * (W10140). Both compile.
 */
function checkArrayInitCoverage(
  decl: LetDeclNode | ZeropageFieldNode,
  declaredType: Type,
  ctx: TypeCheckContext,
): void {
  if (declaredType.kind !== "array") return;
  // An unsized declaration either infers its size from a full element list
  // (full coverage by construction) or is already an error — no advisory.
  if (declaredType.size === null) return;
  if (decl.initialiser === null) {
    ctx.bag.addWarning(
      DiagCode.UninitializedArray,
      decl.nameSpan,
      `Array '${decl.name}' has no initialiser — its contents are undefined until written`,
    );
    return;
  }
  const init = decl.initialiser;
  if (
    init.kind === "ArrayLitExpr" &&
    init.fill === null &&
    declaredType.size > 0 &&
    init.elements.length < declaredType.size
  ) {
    ctx.bag.addWarning(
      DiagCode.PartialArrayInit,
      init.span,
      `Array initialiser covers ${init.elements.length} of ${declaredType.size} elements — ` +
        "the rest are undefined (add a '; fill' value)",
    );
  }
}

/**
 * Patches an unsized `[]` declaration's symbol with the size the literal
 * inferred, so downstream layout/lowering sees a fully-sized array type.
 * The unsized type survives only on parameter symbols — every variable
 * either receives an inferred size here or was already rejected.
 */
function inferUnsizedArray(sym: Symbol | undefined, declaredType: Type, initType: Type): void {
  if (sym === undefined) return;
  if (declaredType.kind !== "array" || declaredType.size !== null) return;
  if (initType.kind === "array" && initType.size !== null && initType.size > 0) {
    sym.type = initType;
  }
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
  checkIntermediateOverflow(stmt.value, valueType, returnType, ctx); // W10160/61
}
