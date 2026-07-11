/**
 * Expression and literal typing (Pass 3).
 *
 * `typeOfExpr` walks an expression, assigns every node a semantic {@link Type}
 * (memoised into `ctx.typeMap`), resolves identifiers (recording `ctx.symbolMap`
 * and emitting E10100 on a miss), and enforces the same-type arithmetic rule
 * (E10081 mixed-sign / E10080 boolean operand). Assignment expressions check
 * l-value mutability (E10191) and assignment compatibility. Every failure emits a
 * diagnostic and **poisons** with {@link ERROR_TYPE} instead of throwing.
 *
 * Scope is same-type only: implicit widening, casts, and non-arithmetic
 * operators (comparison / logical / shift) are out of this module's surface and
 * are typed defensively (operands still walked to populate `typeMap`) without a
 * result-type guarantee. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only, keeping the frontend independent of codegen.
 */

import {
  commonType,
  DiagCode,
  ERROR_TYPE,
  IceCode,
  isAssignableTo,
  isError,
  isInteger,
  isSigned,
  primitive,
  typeName,
} from "@blend65/core";
import type {
  AssignExprNode,
  AstNode,
  BinaryExprNode,
  CallExprNode,
  ExprNode,
  FieldAccessExprNode,
  FunctionDeclNode,
  IdentExprNode,
  IntrinsicCallExprNode,
  NumericLitExprNode,
  Scope,
  SourceSpan,
  Symbol,
  Type,
} from "@blend65/core";
import type { FnSignature, TypeCheckContext } from "./context.js";
import { enclosingFunctionSymbol, resolveName, resolveQualified } from "./name-resolution.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import { evalConst } from "../const-eval.js";
import type { ConstRefResolver } from "../const-eval.js";

/** The arithmetic operators, typed with the same-type rule (spec TS-3). */
const ARITHMETIC_OPS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);

/**
 * Types `expr` (FR-2), memoising the result into `ctx.typeMap`. Recursive; never
 * throws. When `contextType` is a primitive integer it drives literal adaptation
 * (spec TS-2): a bare numeric literal takes the context type.
 *
 * @param expr The expression to type.
 * @param scope The innermost scope the expression appears in (for name lookup).
 * @param ctx The Pass-3 context (bag + maps).
 * @param contextType The declared/target type providing literal adaptation, if any.
 * @returns The resolved type ({@link ERROR_TYPE} on any failure — poison).
 */
export function typeOfExpr(
  expr: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  const t = computeType(expr, scope, ctx, contextType);
  ctx.typeMap.set(expr, t);
  return t;
}

/** Computes an expression's type without memoising (the {@link typeOfExpr} core). */
function computeType(
  expr: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  switch (expr.kind) {
    case "NumericLitExpr":
      return typeNumericLiteral(expr, contextType);
    case "BoolLitExpr":
      return primitive("boolean");
    case "IdentExpr":
      return typeIdent(expr, scope, ctx);
    case "BinaryExpr":
      return typeBinary(expr, scope, ctx);
    case "AssignExpr":
      return typeAssign(expr, scope, ctx);
    case "IntrinsicCallExpr":
      return typeIntrinsicCall(expr, scope, ctx);
    case "CallExpr":
      return typeCall(expr, scope, ctx);
    case "FieldAccessExpr":
      return typeFieldAccess(expr, scope, ctx);
    default:
      // Index / cast / unary / struct-lit / etc. are not yet handled here;
      // poison without a diagnostic.
      return ERROR_TYPE;
  }
}

/**
 * Literal typing (spec TS-2): a numeric literal adapts to a primitive-integer
 * `contextType` when one is supplied; otherwise it takes its by-value default
 * (0–255 → byte, else word). The range check (E10084) is the caller's job (it
 * knows the declared/target type) — see `checkConstRange`.
 */
function typeNumericLiteral(expr: NumericLitExprNode, contextType?: Type): Type {
  if (contextType !== undefined && contextType.kind === "primitive" && isInteger(contextType)) {
    return contextType; // literal adaptation to the declared/target type
  }
  return expr.value <= 255 ? primitive("byte") : primitive("word");
}

/** Identifier typing: resolve the name; E10100 + poison on a miss. */
function typeIdent(expr: IdentExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const sym = resolveName(expr.name, scope);
  if (sym === null) {
    ctx.bag.addError(
      DiagCode.UndeclaredIdentifier,
      expr.span,
      `Undeclared identifier '${expr.name}'`,
    );
    return ERROR_TYPE;
  }
  ctx.symbolMap.set(expr, sym);
  return sym.type;
}

/**
 * Binary typing for the arithmetic operators (spec TS-3, same-type). Non-
 * arithmetic operators are out of surface: operands are still walked (to populate
 * `typeMap`) but the result poisons to {@link ERROR_TYPE}.
 */
function typeBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  let lt = typeOfExpr(expr.left, scope, ctx);
  let rt = typeOfExpr(expr.right, scope, ctx);

  if (!ARITHMETIC_OPS.has(expr.op)) return ERROR_TYPE; // comparison/logical/shift not yet typed

  // Literal adaptation in expressions (spec TS-2): a bare numeric-literal operand
  // adopts the other operand's integer type so `wordVar + 1` types as word.
  if (expr.left.kind === "NumericLitExpr" && rt.kind === "primitive" && isInteger(rt)) {
    lt = rt;
    ctx.typeMap.set(expr.left, lt);
  } else if (expr.right.kind === "NumericLitExpr" && lt.kind === "primitive" && isInteger(lt)) {
    rt = lt;
    ctx.typeMap.set(expr.right, rt);
  }

  const combined = commonType(lt, rt);
  if (combined !== null) return combined; // same-type (or poison → ERROR_TYPE)

  // Not combinable — pick the diagnostic (both operands are non-poison here,
  // since a poisoned operand yields ERROR_TYPE from commonType, not null).
  emitBinaryOperandError(expr, lt, rt, ctx);
  return ERROR_TYPE;
}

/** Emits E10080 (boolean operand) or E10081 (mixed signedness) for a bad binary. */
function emitBinaryOperandError(
  expr: BinaryExprNode,
  lt: Type,
  rt: Type,
  ctx: TypeCheckContext,
): void {
  const boolean = primitive("boolean");
  const leftBool = typeName(lt) === typeName(boolean);
  const rightBool = typeName(rt) === typeName(boolean);
  if (leftBool || rightBool) {
    const offending = leftBool ? lt : rt;
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return;
  }
  if (isInteger(lt) && isInteger(rt) && isSigned(lt) !== isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.MixedSignedUnsignedOperands, // E10081
      expr.span,
      `Cannot mix signed and unsigned types in '${expr.op}' — use an explicit cast`,
    );
    return;
  }
  // Same-sign different-width (widening) and non-primitive operands are not yet
  // supported here; the result is already poisoned to ERROR_TYPE, and no
  // diagnostic code is designated for this case, so none is emitted.
}

/**
 * Assignment typing: the target must be a mutable l-value (a `variable`; a
 * `constant` → E10191), and the value must be assignment-compatible with it
 * (same-type currently; otherwise E10152/E10153/E10154). Result = the target type.
 */
function typeAssign(expr: AssignExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const targetType = typeOfExpr(expr.target, scope, ctx);

  // L-value mutability: a resolved `constant` target cannot be assigned (E10191).
  if (expr.target.kind === "IdentExpr") {
    const sym = resolveName(expr.target.name, scope);
    if (sym !== null && sym.kind === "constant") {
      ctx.bag.addError(
        DiagCode.AssignToConst,
        expr.span,
        `Cannot assign to constant '${expr.target.name}'`,
      );
    }
  } else if (expr.target.kind === "FieldAccessExpr") {
    // A qualified target was resolved (and recorded in `symbolMap`) while it
    // was typed above; a failed or non-module resolution is already poisoned
    // or diagnosed there, and a function member is already rejected loudly.
    const sym = ctx.symbolMap.get(expr.target);
    if (sym !== undefined && sym.kind === "constant") {
      ctx.bag.addError(
        DiagCode.AssignToConst,
        expr.span,
        `Cannot assign to constant '${expr.target.field}'`,
      );
    }
  }

  const valueType = typeOfExpr(expr.value, scope, ctx, targetType);
  checkConstRange(expr.value, targetType, ctx);
  checkAssignable(valueType, targetType, expr.span, ctx);
  return targetType;
}

/**
 * Qualified `Module.member` access in value position.
 *
 * Resolution dispatches on `resolveQualified`: a non-module shape (struct
 * field access, a value-shadowed head) keeps today's silent poison; a failed
 * resolution is already diagnosed there. A resolved module `variable`/
 * `constant` types as that symbol (recorded in `symbolMap` — the SAME symbol
 * the module scope declares, so downstream symbol-keyed machinery works
 * unchanged). A resolved function/interrupt member is not a value — function
 * references are a future feature, so the shape is rejected loudly rather
 * than silently miscompiled.
 */
function typeFieldAccess(
  expr: FieldAccessExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  const res = resolveQualified(expr, scope, ctx.moduleScopes, ctx.bag);
  if (res.status !== "resolved") {
    // not-qualified → struct-field typing is a future surface (silent poison);
    // poisoned → the diagnostic is already out.
    return ERROR_TYPE;
  }

  const sym = res.symbol;
  if (sym.kind === "variable" || sym.kind === "constant") {
    ctx.symbolMap.set(expr, sym);
    return sym.type;
  }

  // function / interrupt (and, defensively, any other kind) in value position.
  ctx.bag.addError(
    IceCode.Unexpected,
    expr.span,
    `Qualified access to '${expr.field}' names a function — function references ` +
      `are not supported yet; call it instead`,
  );
  return ERROR_TYPE;
}

/** A resolved callee: its symbol plus the name/span used in diagnostics. */
interface ResolvedCallee {
  readonly sym: Symbol;
  readonly name: string;
  readonly span: SourceSpan;
}

/**
 * Resolves a call's callee to a declared symbol, for either supported shape:
 * a bare `IdentExpr` (lexical lookup; an unresolved non-registry name is
 * E10100) or a qualified `Module.member` (via `resolveQualified`, which owns
 * E10100/E10012 for that shape). Returns `null` when the call must poison —
 * the diagnostic, if any, has already been emitted (a `null` with no
 * diagnostic is the deliberate silent contract for unsupported callee shapes
 * and registry-owned platform intrinsics).
 */
function resolveCallee(
  callee: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): ResolvedCallee | null {
  if (callee.kind === "IdentExpr") {
    const sym = resolveName(callee.name, scope);
    if (sym === null) {
      // A platform-contributed intrinsic parses as a plain call and is never a
      // scope symbol — availability/import/arity checks belong to the platform
      // import boundary, so it is not an undeclared identifier here. A declared
      // name always wins over a registry name (checked above via the scopes).
      if (ctx.registry?.get(callee.name)?.platformId !== undefined) return null;
      ctx.bag.addError(
        DiagCode.UndeclaredIdentifier,
        callee.span,
        `Undeclared identifier '${callee.name}'`,
      );
      return null;
    }
    return { sym, name: callee.name, span: callee.span };
  }

  if (callee.kind === "FieldAccessExpr") {
    const res = resolveQualified(callee, scope, ctx.moduleScopes, ctx.bag);
    // not-qualified keeps the silent struct-field contract; poisoned is
    // already diagnosed — either way the call poisons.
    if (res.status !== "resolved") return null;
    return { sym: res.symbol, name: callee.field, span: callee.fieldSpan };
  }

  // Other callee shapes (index/call results, literals) are not callable
  // surfaces yet; poison silently.
  return null;
}

/**
 * User-function call typing.
 *
 * The callee resolves via {@link resolveCallee} (bare identifier or qualified
 * `Module.member` — both shapes feed ONE shared ladder below): an `interrupt`
 * → E10051 (interrupt bodies end in RTI — a user JSR would corrupt the
 * stack); the entry point → E10023; any non-function symbol → E10175. A
 * resolved callee records a call-graph edge from the enclosing function, then
 * checks arguments: a count mismatch is E10170 (arguments are still typed for
 * map coverage, but per-argument type checks are suppressed — one diagnostic
 * per root cause); otherwise every argument is typed in its parameter's
 * context, range-checked as a constant, and must be strictly assignable
 * (E10171). The call's type is the callee's declared return type; a poisoned
 * argument suppresses its own mismatch check.
 */
function typeCall(expr: CallExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const resolved = resolveCallee(expr.callee, scope, ctx);
  if (resolved === null) return walkArgsAndPoison(expr, scope, ctx);
  const { sym, name, span } = resolved;

  if (sym.kind === "interrupt") {
    ctx.bag.addError(
      DiagCode.CallToInterruptFunction,
      span,
      `Cannot call interrupt function '${name}' — interrupt handlers are ` +
        `invoked by hardware, not by user code`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }
  if (sym === ctx.mainFunction) {
    ctx.bag.addError(
      DiagCode.CallingMainDirectly,
      span,
      `Cannot call 'main()' directly — it is the program entry point, not a ` +
        `callable function`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }
  if (sym.kind !== "function") {
    ctx.bag.addError(
      DiagCode.NotCallable,
      span,
      `'${name}' is not a function — cannot call a '${typeName(sym.type)}' ` +
        `value as a function`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }

  // Resolved user function: record the reference and the call-graph edge.
  ctx.symbolMap.set(expr.callee, sym);
  recordCallEdge(scope, sym, span, ctx);

  const sig = signatureOf(sym, ctx);

  if (expr.args.length !== sig.params.length) {
    ctx.bag.addError(
      DiagCode.WrongArgCount,
      expr.span,
      `Wrong argument count — '${name}()' expects ${sig.params.length} ` +
        `parameter(s), got ${expr.args.length}`,
    );
    // Arguments are still typed (map coverage), but per-argument checks are
    // suppressed: the count failure is the root cause.
    for (const arg of expr.args) typeOfExpr(arg, scope, ctx);
    return sig.returnType;
  }

  for (let i = 0; i < expr.args.length; i++) {
    const arg = expr.args[i];
    const param = sig.params[i];
    const argType = typeOfExpr(arg, scope, ctx, param.type);
    checkConstRange(arg, param.type, ctx);
    if (!isAssignableTo(argType, param.type)) {
      ctx.bag.addError(
        DiagCode.ArgTypeMismatch,
        arg.span,
        `Argument type mismatch — parameter '${param.name}' of '${name}()' ` +
          `expects '${typeName(param.type)}', found '${typeName(argType)}'`,
      );
    }
  }

  return sig.returnType;
}

/** Types every argument (map coverage) and poisons a failed call. */
function walkArgsAndPoison(expr: CallExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);
  return ERROR_TYPE;
}

/** Narrows a symbol's declaring node to a {@link FunctionDeclNode}. */
function isFunctionDecl(node: AstNode): node is FunctionDeclNode {
  return node.kind === "FunctionDecl";
}

/**
 * The callee's cached {@link FnSignature}, computed from its declaration on
 * first use. Function symbols always carry a `FunctionDecl`; a defensive
 * mismatch yields an empty void signature rather than a crash.
 */
function signatureOf(sym: Symbol, ctx: TypeCheckContext): FnSignature {
  const cached = ctx.signatures.get(sym);
  if (cached !== undefined) return cached;

  const decl = isFunctionDecl(sym.decl) ? sym.decl : null;
  const sig: FnSignature =
    decl === null
      ? { params: [], returnType: primitive("void") }
      : {
          params: decl.params.map((p) => ({
            name: p.name,
            type: resolveTypeNode(p.paramType),
          })),
          returnType: resolveTypeNode(decl.returnType),
        };
  ctx.signatures.set(sym, sig);
  return sig;
}

/**
 * Records the call-graph edge from the enclosing function to `callee`, plus
 * the first call-site span per edge (anchoring the recursion diagnostic).
 * Module-level contexts (no enclosing function) record nothing.
 */
function recordCallEdge(
  scope: Scope,
  callee: Symbol,
  span: SourceSpan,
  ctx: TypeCheckContext,
): void {
  const caller = enclosingFunctionSymbol(scope);
  if (caller === null) return;

  let callees = ctx.callEdges.get(caller);
  if (callees === undefined) {
    callees = new Set();
    ctx.callEdges.set(caller, callees);
  }
  callees.add(callee);

  let spans = ctx.callSiteSpans.get(caller);
  if (spans === undefined) {
    spans = new Map();
    ctx.callSiteSpans.set(caller, spans);
  }
  if (!spans.has(callee)) spans.set(callee, span);
}

/**
 * Intrinsic-call typing: `peek`→byte, `peekw`→word, `lo`/`hi`→byte,
 * `poke`/`pokew`→void. Arguments are always walked (to populate `typeMap` for
 * width-aware lowering). Unknown intrinsics poison without a diagnostic (the
 * intrinsic-validation pass owns their errors).
 */
function typeIntrinsicCall(
  expr: IntrinsicCallExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);

  switch (expr.name) {
    case "peek":
    case "lo":
    case "hi":
      return primitive("byte");
    case "peekw":
      return primitive("word");
    case "poke":
    case "pokew":
      return primitive("void");
    default:
      return ERROR_TYPE; // sizeof/offsetof/embed/etc. — not yet supported here
  }
}

/**
 * Emits the assignment-compatibility diagnostic when `valueType` is not
 * assignable to `targetType`. Same-type / poison → no diagnostic. Widening
 * (same-sign different-width) is also rejected here and reported through the
 * width code — no fixture reaches it, so the (narrowing-worded) message never
 * surfaces in the supported surface.
 *
 * @param valueType The type of the value being assigned.
 * @param targetType The declared/target type.
 * @param span The span to anchor the diagnostic to.
 * @param ctx The Pass-3 context.
 */
export function checkAssignable(
  valueType: Type,
  targetType: Type,
  span: AssignExprNode["span"],
  ctx: TypeCheckContext,
): void {
  if (isAssignableTo(valueType, targetType)) return; // same-type or poison → ok

  ctx.bag.addError(
    assignmentMismatchCode(valueType, targetType),
    span,
    `Cannot assign a value of type '${typeName(valueType)}' to '${typeName(targetType)}'`,
  );
}

/**
 * The return-statement variant of {@link checkAssignable}: same code family
 * (E10152/E10153/E10154), return-context wording naming the function.
 *
 * @param valueType The type of the returned value.
 * @param returnType The function's declared return type.
 * @param fnName The enclosing function's name (for the message).
 * @param span The span to anchor the diagnostic to.
 * @param ctx The Pass-3 context.
 */
export function checkReturnAssignable(
  valueType: Type,
  returnType: Type,
  fnName: string,
  span: SourceSpan,
  ctx: TypeCheckContext,
): void {
  if (isAssignableTo(valueType, returnType)) return; // same-type or poison → ok

  ctx.bag.addError(
    assignmentMismatchCode(valueType, returnType),
    span,
    `Cannot return a value of type '${typeName(valueType)}' — the return type ` +
      `of '${fnName}' is '${typeName(returnType)}'`,
  );
}

/** Chooses the assignment-mismatch code for two non-assignable, non-poison types. */
function assignmentMismatchCode(value: Type, target: Type): string {
  const boolean = primitive("boolean");
  const valueBool = typeName(value) === typeName(boolean);
  const targetBool = typeName(target) === typeName(boolean);
  if (valueBool || targetBool) return DiagCode.TypeMismatchAssignment; // E10152 boolean↔int
  if (isInteger(value) && isInteger(target)) {
    if (isSigned(value) !== isSigned(target)) return DiagCode.SignedUnsignedMismatch; // E10153
    return DiagCode.WidthNarrowingNoCast; // E10154 (narrowing; widening isn't distinguished yet)
  }
  return DiagCode.TypeMismatchAssignment; // E10152 — generic mismatch fallback
}

/**
 * Range/div-by-zero check for a constant-foldable value against a target integer
 * type (FR-6): folds `expr`; a constant out of the target's range → E10084; a
 * constant division/remainder by zero → E10082. Non-constant / non-integer-target
 * expressions are skipped (checked dynamically or out of surface).
 *
 * @param expr The value expression.
 * @param targetType The declared/target integer type.
 * @param ctx The Pass-3 context.
 * @param resolveRef Optional reference resolver, so a value computed from
 *   evaluated constants is range-checked too (the module-const phase uses it).
 * @returns `false` when a diagnostic was emitted; `true` when the value is in
 *   range or the check does not apply.
 */
export function checkConstRange(
  expr: ExprNode,
  targetType: Type,
  ctx: TypeCheckContext,
  resolveRef?: ConstRefResolver,
): boolean {
  const folded = evalConst(expr, resolveRef);
  if (folded.kind === "divByZero") {
    ctx.bag.addError(
      DiagCode.ConstDivisionByZero, // E10082
      folded.span,
      "Division by zero in constant expression",
    );
    return false;
  }
  if (folded.kind !== "value" || typeof folded.value !== "number") return true;
  if (isError(targetType)) return true;
  const range = integerRange(targetType);
  if (range === null) return true; // boolean/void/non-integer target — no range check
  if (folded.value < range.min || folded.value > range.max) {
    ctx.bag.addError(
      DiagCode.ValueOutOfRange, // E10084
      expr.span,
      `Value ${folded.value} out of range for type '${typeName(targetType)}' ` +
        `(range: ${range.min} to ${range.max})`,
    );
    return false;
  }
  return true;
}
