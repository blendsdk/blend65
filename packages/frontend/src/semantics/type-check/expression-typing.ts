/**
 * Expression and literal typing (Pass 3).
 *
 * `typeOfExpr` walks an expression, assigns every node a semantic {@link Type}
 * (memoised into `ctx.typeMap`), resolves identifiers (recording `ctx.symbolMap`
 * and emitting E10100 on a miss), and types the full operator surface:
 * arithmetic/bitwise (mixed-width same-sign operands auto-promote to the wider
 * type; mixed-sign → E10081, boolean operand → E10080), shifts (result = the
 * left type; a signed amount → E10083; a constant amount at or beyond the
 * width → W10174), comparisons (result `boolean`; ordered comparison on
 * booleans → E10080), logical `&&`/`||` (boolean operands only), unary
 * `- ! ~` (negating an unsigned → E10087), casts (integer↔integer only;
 * boolean → E10086, void/aggregate → E10155), the conditional operator
 * (non-boolean condition → E10134; incompatible arms → E10088), and compound
 * assignment (expanded-form semantics; the result must assign back to the
 * target). Assignment expressions check l-value mutability (E10191) and
 * assignment compatibility. Every failure emits a diagnostic and **poisons**
 * with {@link ERROR_TYPE} instead of throwing.
 *
 * An expression's type comes from its operands, never from the destination —
 * narrow arithmetic feeding a wider target evaluates at the narrow width first
 * and only then widens, which is why the intermediate-overflow advisories
 * (W10160/W10161) exist. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only, keeping the frontend independent of codegen.
 */

import {
  bitWidth,
  byteSize,
  commonType,
  createDiagnosticBag,
  DiagCode,
  ERROR_TYPE,
  IceCode,
  isAssignableTo,
  isError,
  isInteger,
  isSigned,
  isUnsigned,
  primitive,
  typeName,
} from "@blend65/core";
import type {
  ArrayLitExprNode,
  AssignExprNode,
  AstNode,
  BinaryExprNode,
  CallExprNode,
  CastExprNode,
  ConditionalExprNode,
  ExprNode,
  FieldAccessExprNode,
  FunctionDeclNode,
  IdentExprNode,
  IndexExprNode,
  IntrinsicCallExprNode,
  NumericLitExprNode,
  StructLitExprNode,
  Scope,
  SourceSpan,
  Symbol,
  Type,
  TypeNode,
  UnaryExprNode,
} from "@blend65/core";
import { encoderFor } from "@blend65/core/platform";
import type { FnSignature, TypeCheckContext } from "./context.js";
import { enclosingFunctionSymbol, resolveName, resolveQualified } from "./name-resolution.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import type { TypeResolverContext } from "./type-resolution.js";
import { convertCharLiteral } from "../char-literal.js";
import { evalConst, fromBits, toBits } from "../const-eval.js";
import type { ConstRefResolver } from "../const-eval.js";

/** The deterministic fallback when a context carries no const/type engine. */
const RAW_ENCODER = encoderFor(undefined);

/** The arithmetic operators (integer operands; common-type result). */
const ARITHMETIC_OPS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);

/** The bitwise operators (integer operands; common-type result). */
const BITWISE_OPS: ReadonlySet<string> = new Set(["&", "|", "^"]);

/** The shift operators (integer left, unsigned right; left-type result). */
const SHIFT_OPS: ReadonlySet<string> = new Set(["<<", ">>"]);

/** The comparison operators (always produce `boolean`). */
const COMPARISON_OPS: ReadonlySet<string> = new Set(["==", "!=", "<", "<=", ">", ">="]);

/** The logical operators (boolean operands; short-circuit at runtime). */
const LOGICAL_OPS: ReadonlySet<string> = new Set(["&&", "||"]);

/**
 * The arithmetic operators the intermediate-overflow advisories watch. The
 * hazard is a value growing past the narrow width, so `+ - *` qualify while
 * `/`/`%` (never larger than their operands) and the bitwise class do not.
 */
const INTERMEDIATE_OVERFLOW_OPS: ReadonlySet<string> = new Set(["+", "-", "*"]);

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
  // A char literal becomes the numeric literal of its encoded byte before
  // the kind switch, so every arm (and every later AST re-walk) sees a
  // plain numeric literal. On failure the node is left untouched and falls
  // through to the untyped-node poison below — the failure is already
  // diagnosed (unencodable here, malformed at the lexer).
  if (expr.kind === "CharLitExpr") {
    convertCharLiteral(expr, ctx.engine?.encoder ?? RAW_ENCODER, ctx.bag);
  }
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
    case "UnaryExpr":
      return typeUnary(expr, scope, ctx, contextType);
    case "CastExpr":
      return typeCast(expr, scope, ctx);
    case "ConditionalExpr":
      return typeConditional(expr, scope, ctx, contextType);
    case "AssignExpr":
      return typeAssign(expr, scope, ctx);
    case "IntrinsicCallExpr":
      return typeIntrinsicCall(expr, scope, ctx);
    case "CallExpr":
      return typeCall(expr, scope, ctx);
    case "FieldAccessExpr":
      return typeFieldAccess(expr, scope, ctx);
    case "IndexExpr":
      return typeIndexExpr(expr, scope, ctx);
    case "StructLitExpr":
      return typeStructLit(expr, scope, ctx);
    case "ArrayLitExpr":
      return typeArrayLit(expr, scope, ctx, contextType);
    default:
      // String literals are not yet handled here; char literals only reach
      // this arm when their conversion failed (already diagnosed). Poison
      // without a further diagnostic.
      return ERROR_TYPE;
  }
}

/** The nearest enclosing module scope (the flat scope model guarantees one). */
function moduleScopeOf(scope: Scope): Scope {
  let current: Scope = scope;
  while (current.kind !== "module" && current.parent !== null) current = current.parent;
  return current;
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
 * Binary typing, dispatched by operator class. Operands are always walked
 * (populating `typeMap`); each class applies its own operand rule and result
 * type (see the module header). Unknown operator shapes poison defensively.
 */
function typeBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  if (LOGICAL_OPS.has(expr.op)) return typeLogicalBinary(expr, scope, ctx);
  if (SHIFT_OPS.has(expr.op)) return typeShiftBinary(expr, scope, ctx);
  if (COMPARISON_OPS.has(expr.op)) return typeComparisonBinary(expr, scope, ctx);
  if (ARITHMETIC_OPS.has(expr.op) || BITWISE_OPS.has(expr.op)) {
    return typeIntegerBinary(expr, scope, ctx);
  }
  // Unknown operator shape — walk operands for map coverage, poison silently.
  typeOfExpr(expr.left, scope, ctx);
  typeOfExpr(expr.right, scope, ctx);
  return ERROR_TYPE;
}

/**
 * Types both operands with cross-operand literal adaptation: a bare
 * numeric-literal operand adopts the other operand's integer type so
 * `wordVar + 1` types as word. Applies to every integer-operand class.
 */
function typeAdaptedOperands(
  expr: BinaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): { lt: Type; rt: Type } {
  let lt = typeOfExpr(expr.left, scope, ctx);
  let rt = typeOfExpr(expr.right, scope, ctx);

  if (expr.left.kind === "NumericLitExpr" && rt.kind === "primitive" && isInteger(rt)) {
    lt = rt;
    ctx.typeMap.set(expr.left, lt);
  } else if (expr.right.kind === "NumericLitExpr" && lt.kind === "primitive" && isInteger(lt)) {
    rt = lt;
    ctx.typeMap.set(expr.right, rt);
  }
  return { lt, rt };
}

/**
 * Arithmetic (`+ - * / %`) and bitwise (`& | ^`) typing: integer operands
 * only (a boolean operand → E10080), same-sign widths promote to the wider
 * type, mixed signedness → E10081.
 */
function typeIntegerBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const { lt, rt } = typeAdaptedOperands(expr, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  // Boolean is not numeric — reject before the common-type rule (which would
  // otherwise accept boolean OP boolean as a same-type pair).
  if (typeName(lt) === "boolean" || typeName(rt) === "boolean") {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx);
    return ERROR_TYPE;
  }

  const combined = commonType(lt, rt);
  // Enum operands operate as their byte backing — the arithmetic result is a
  // byte, never the enum.
  if (combined !== null) return combined.kind === "enum" ? primitive("byte") : combined;

  emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx);
  return ERROR_TYPE;
}

/**
 * Comparison typing: the result is always `boolean`. Integer operands follow
 * the arithmetic mixing rules (promotion in, mixed sign → E10081); booleans
 * support only `==`/`!=` — an ordered comparison on booleans, or a
 * boolean/integer mix, is E10080.
 */
function typeComparisonBinary(
  expr: BinaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  const { lt, rt } = typeAdaptedOperands(expr, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  // Arrays never compare (they are memory regions, not values) — a dedicated
  // code so the remedy (compare elements) is discoverable.
  if (lt.kind === "array" || rt.kind === "array") {
    ctx.bag.addError(
      DiagCode.ArrayComparisonNotAllowed,
      expr.span,
      "Arrays cannot be compared — compare elements individually",
    );
    return ERROR_TYPE;
  }

  const leftBool = typeName(lt) === "boolean";
  const rightBool = typeName(rt) === "boolean";
  if (leftBool && rightBool) {
    if (expr.op === "==" || expr.op === "!=") return primitive("boolean");
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // ordered on boolean
    return ERROR_TYPE;
  }
  if (leftBool || rightBool) {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // boolean vs integer
    return ERROR_TYPE;
  }

  if (commonType(lt, rt) === null) {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // mixed sign / non-primitive
    return ERROR_TYPE;
  }
  return primitive("boolean");
}

/**
 * Logical `&&`/`||` typing: both operands must be `boolean` (E10080
 * otherwise); the result is `boolean`. Short-circuit evaluation is a language
 * guarantee realised at lowering — typing only enforces the operand rule.
 */
function typeLogicalBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const lt = typeOfExpr(expr.left, scope, ctx);
  const rt = typeOfExpr(expr.right, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  const offending = typeName(lt) !== "boolean" ? lt : typeName(rt) !== "boolean" ? rt : null;
  if (offending !== null) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return ERROR_TYPE;
  }
  return primitive("boolean");
}

/**
 * Shift typing: the left operand must be an integer (boolean → E10080), the
 * amount must be an UNSIGNED integer (a signed amount → E10083; a boolean →
 * E10080), and the result is the LEFT operand's type. A constant amount at or
 * beyond the left type's bit width additionally warns W10174 (the result is
 * well-defined — always 0 — so the expression still types).
 */
function typeShiftBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const lt = typeOfExpr(expr.left, scope, ctx);
  // The amount's literal-adaptation context is byte (a bare `2` in `x << 2`).
  const rt = typeOfExpr(expr.right, scope, ctx, primitive("byte"));
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  if (lt.kind !== "primitive" || !isInteger(lt)) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(lt)}'`,
    );
    return ERROR_TYPE;
  }
  if (!isInteger(rt)) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(rt)}'`,
    );
    return ERROR_TYPE;
  }
  if (isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.ShiftAmountNotUnsigned, // E10083
      expr.right.span,
      `Shift amount must be unsigned ('byte' or 'word') — found '${typeName(rt)}'`,
    );
    return ERROR_TYPE;
  }

  // Advisory: a constant amount ≥ the operand width always yields 0.
  const width = bitWidth(lt);
  const amount = evalConst(expr.right, undefined, (e) => ctx.typeMap.get(e));
  if (amount.kind === "value" && typeof amount.value === "number" && amount.value >= width) {
    ctx.bag.addWarning(
      DiagCode.ShiftCountExceedsWidth, // W10174
      expr.right.span,
      `Shift amount ${amount.value} >= type width (${width} bits) — result is always 0`,
    );
  }
  return lt;
}

/** Emits E10080 (boolean operand) or E10081 (mixed signedness) for a bad binary. */
function emitBinaryOperandError(
  op: string,
  span: SourceSpan,
  lt: Type,
  rt: Type,
  ctx: TypeCheckContext,
): void {
  const leftBool = typeName(lt) === "boolean";
  const rightBool = typeName(rt) === "boolean";
  if (leftBool || rightBool) {
    const offending = leftBool ? lt : rt;
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      span,
      `Operator '${op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return;
  }
  if (isInteger(lt) && isInteger(rt) && isSigned(lt) !== isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.MixedSignedUnsignedOperands, // E10081
      span,
      `Cannot mix signed and unsigned types in '${op}' — use an explicit cast`,
    );
    return;
  }
  // Non-primitive operands: structs never combine, and enums only combine
  // with themselves or `byte` (both handled before this point) — anything
  // that reaches here is an invalid operand application.
  const offending = lt.kind !== "primitive" ? lt : rt;
  ctx.bag.addError(
    DiagCode.InvalidOperandType, // E10080
    span,
    `Operator '${op}' cannot be applied to type '${typeName(offending)}'`,
  );
}

/**
 * Unary typing.
 *
 * `-` is valid on signed integers only (an unsigned operand → E10087, a
 * boolean → E10080); a directly-nested numeric literal makes the whole
 * `-literal` a negative literal that adapts to an integer context type, or
 * defaults by value (`-1` → sbyte, `-300` → sword) — negating a *literal* is
 * never the unsigned-negation error. `!` requires a boolean operand and
 * yields boolean. `~` requires an integer operand and yields the operand's
 * own type — deliberately with NO context adaptation, so the complement is
 * computed at the operand's own width before any widening (`~1` is byte-wide
 * 254 even in a word context). `&` (address-of) classifies its operand and
 * yields `word` for every addressable shape — see {@link typeAddressOf}.
 */
function typeUnary(
  expr: UnaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  if (expr.op === "-") {
    if (expr.operand.kind === "NumericLitExpr") {
      // Negative-literal shape: the literal adapts to an integer context, or
      // defaults from the NEGATED value's range.
      const adapted =
        contextType !== undefined && contextType.kind === "primitive" && isInteger(contextType)
          ? contextType
          : primitive(-expr.operand.value >= -128 ? "sbyte" : "sword");
      ctx.typeMap.set(expr.operand, adapted);
      return adapted;
    }
    const t = typeOfExpr(expr.operand, scope, ctx, contextType);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (typeName(t) === "boolean" || !isInteger(t)) {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '-' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    if (isUnsigned(t)) {
      ctx.bag.addError(
        DiagCode.NegateUnsigned, // E10087
        expr.span,
        `Cannot negate unsigned type '${typeName(t)}' — use 'sbyte'/'sword' for ` +
          `signed arithmetic`,
      );
      return ERROR_TYPE;
    }
    return t; // signed integer
  }

  if (expr.op === "!") {
    const t = typeOfExpr(expr.operand, scope, ctx);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (typeName(t) !== "boolean") {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '!' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    return primitive("boolean");
  }

  if (expr.op === "~") {
    // No context: the complement happens at the operand's own width.
    const t = typeOfExpr(expr.operand, scope, ctx);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (!isInteger(t)) {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '~' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    return t;
  }

  return typeAddressOf(expr, scope, ctx);
}

/** The shared not-yet-supported rejection for `&field` / `&element` shapes. */
function addressOfElementError(ctx: TypeCheckContext, span: SourceSpan): Type {
  ctx.bag.addError(
    DiagCode.AddressOfElementDeferred,
    span,
    "Taking the address of a struct field or array element is not supported yet — " +
      "take the address of the whole aggregate instead",
  );
  return ERROR_TYPE;
}

/**
 * Address-of typing (`&x`): every addressable operand yields `word` — the
 * operand's compile-time memory address. Addressable: module-level and local
 * `let` variables, functions and interrupt functions (bare, or as a qualified
 * exported `Module.fn`), and `const` aggregates (they own a data-section
 * image). Taking a function's address records it in the context's
 * address-taken set so frame planning keeps its frame allocated and
 * unshared — the address may be installed at a hardware vector or handed to
 * a platform routine the compiler cannot see.
 *
 * Rejections: a scalar constant is inlined and has no storage (E10047), a
 * parameter has no stable home of its own (E10048), struct fields and array
 * elements are not yet addressable (E10042), and any other expression —
 * literal, call, arithmetic — has no address at all (E10049).
 */
function typeAddressOf(expr: UnaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const operand = expr.operand;

  if (operand.kind === "IdentExpr") {
    const ident = operand as IdentExprNode;
    const sym = resolveName(ident.name, scope);
    if (sym === null) {
      ctx.bag.addError(
        DiagCode.UndeclaredIdentifier,
        operand.span,
        `Undeclared identifier '${ident.name}'`,
      );
      return ERROR_TYPE;
    }
    ctx.symbolMap.set(operand, sym);
    if (sym.kind === "variable") return primitive("word");
    if (sym.kind === "parameter") {
      ctx.bag.addError(
        DiagCode.AddressOfParameter,
        expr.span,
        `Cannot take the address of parameter '${sym.name}' — copy it to a local ` +
          "variable first",
      );
      return ERROR_TYPE;
    }
    if (sym.kind === "constant") {
      if (sym.type.kind === "array" || sym.type.kind === "struct") return primitive("word");
      ctx.bag.addError(
        DiagCode.AddressOfConstScalar,
        expr.span,
        `Cannot take the address of const '${sym.name}' — scalar constants are ` +
          "inlined and have no storage",
      );
      return ERROR_TYPE;
    }
    if (sym.kind === "function" || sym.kind === "interrupt") {
      ctx.addressTakenFunctions.add(sym);
      return primitive("word");
    }
    ctx.bag.addError(
      DiagCode.AddressOfNonAddressable,
      expr.span,
      `Cannot take the address of '${sym.name}' — only variables, constants with ` +
        "storage, and functions have addresses",
    );
    return ERROR_TYPE;
  }

  if (operand.kind === "FieldAccessExpr") {
    const access = operand as FieldAccessExprNode;
    // A qualified exported function (`Module.fn`) is addressable: resolve it
    // directly, so the function-reference value rejection never fires for
    // the `&`-wrapped shape. Only an unshadowed head can name a module.
    if (
      access.object.kind === "IdentExpr" &&
      resolveName((access.object as IdentExprNode).name, scope) === null
    ) {
      const res = resolveQualified(access, scope, ctx.moduleScopes, ctx.bag);
      if (res.status === "poisoned") return ERROR_TYPE; // already diagnosed
      if (
        res.status === "resolved" &&
        (res.symbol.kind === "function" || res.symbol.kind === "interrupt")
      ) {
        ctx.symbolMap.set(operand, res.symbol);
        ctx.addressTakenFunctions.add(res.symbol);
        return primitive("word");
      }
    }
    return addressOfElementError(ctx, expr.span);
  }

  if (operand.kind === "IndexExpr") {
    return addressOfElementError(ctx, expr.span);
  }

  // Literals, calls, arbitrary expressions: type the operand so inner errors
  // still surface, then reject — such values have no address.
  const t = typeOfExpr(operand, scope, ctx);
  if (isError(t)) return ERROR_TYPE; // cascade suppression
  ctx.bag.addError(
    DiagCode.AddressOfNonAddressable,
    expr.span,
    "Cannot take the address of this expression — only named variables, constants " +
      "with storage, and functions have addresses",
  );
  return ERROR_TYPE;
}

/**
 * Cast typing (`<type>(expr)`): integer→integer casts (all pairs, identity
 * included) type as the target. A cast between boolean and an integer is
 * E10086; a cast involving void or an aggregate is E10155. The operand is
 * typed with NO context — the cast converts the operand's own-width value. An
 * unresolved named target type is already poisoned by type resolution and
 * stays a silent poison here.
 */
function typeCast(expr: CastExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  // Named cast targets (enums) resolve through the full resolver; primitive
  // targets resolve as before.
  const target =
    expr.targetType.kind === "NamedType"
      ? resolveTypeNode(expr.targetType, {
          moduleScope: moduleScopeOf(scope),
          moduleScopes: ctx.moduleScopes,
          bag: ctx.bag,
        })
      : resolveTypeNode(expr.targetType);
  const operand = typeOfExpr(expr.operand, scope, ctx);
  if (isError(operand) || isError(target)) return ERROR_TYPE; // cascade suppression

  // Enum casts are single-step and zero-cost: an enum reads as its byte
  // backing in either integer direction, and casting an integer INTO an enum
  // is legal without a member-value check. Enum→enum cross-casts are not —
  // route through the byte backing explicitly.
  if (target.kind === "enum" || operand.kind === "enum") {
    if (target === operand) return target; // identity
    const other = target.kind === "enum" ? operand : target;
    if (other.kind === "primitive" && isInteger(other)) return target;
    ctx.bag.addError(
      DiagCode.InvalidCast,
      expr.span,
      `Cannot cast '${typeName(operand)}' to '${typeName(target)}' — enums cast ` +
        `to/from integer types only`,
    );
    return ERROR_TYPE;
  }

  const targetBool = typeName(target) === "boolean";
  const operandBool = typeName(operand) === "boolean";
  if (isInteger(target) && isInteger(operand)) {
    warnNarrowingCastTruncation(expr, operand, target, ctx);
    return target;
  }
  if (targetBool && operandBool) return target; // identity cast

  if ((targetBool && isInteger(operand)) || (operandBool && isInteger(target))) {
    ctx.bag.addError(
      DiagCode.BooleanIntegerCast, // E10086
      expr.span,
      `Cannot cast '${typeName(operand)}' to '${typeName(target)}' — boolean is ` +
        `not convertible to/from integer types`,
    );
    return ERROR_TYPE;
  }

  ctx.bag.addError(
    DiagCode.InvalidCast, // E10155
    expr.span,
    `Cannot cast '${typeName(operand)}' to '${typeName(target)}' — only integer ` +
      `types support casts`,
  );
  return ERROR_TYPE;
}

/**
 * The narrowing-cast truncation advisory (W10101): when a 16-bit constant
 * operand casts down to an 8-bit type and the reinterpreted result differs
 * from the original value, bits were lost — the cast is the explicit opt-in,
 * so this warns rather than errors. Same-width reinterpretation (byte↔sbyte)
 * and widening never warn: no bits are lost.
 */
function warnNarrowingCastTruncation(
  expr: CastExprNode,
  operandType: Type,
  targetType: Type,
  ctx: TypeCheckContext,
): void {
  if (operandType.kind !== "primitive" || targetType.kind !== "primitive") return;
  if (bitWidth(operandType) !== 16 || bitWidth(targetType) !== 8) return;

  const folded = evalConst(expr.operand, undefined, (e) => ctx.typeMap.get(e));
  if (folded.kind !== "value" || typeof folded.value !== "number") return;
  const result = fromBits(toBits(folded.value, 8), 8, isSigned(targetType));
  if (result === folded.value) return; // the value survives — no bits lost

  ctx.bag.addWarning(
    DiagCode.NarrowingCastTruncates, // W10101
    expr.span,
    `Narrowing cast from '${typeName(operandType)}' to '${typeName(targetType)}' ` +
      `truncates value ${folded.value} to ${result}`,
  );
}

/**
 * Conditional-operator typing (`cond ? a : b`): the condition must be boolean
 * (E10134 otherwise — the arms still type, so the result is the arms' common
 * type rather than poison), both arms type in the INCOMING context (literal
 * arms adapt to the declared target), and the result is the arms' common type
 * under the same promotion rules as arithmetic. Arms with no common type are
 * E10088.
 */
function typeConditional(
  expr: ConditionalExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  const condType = typeOfExpr(expr.condition, scope, ctx);
  if (!isError(condType) && typeName(condType) !== "boolean") {
    ctx.bag.addError(
      DiagCode.NonBooleanCondition, // E10134
      expr.condition.span,
      `Condition must be type 'boolean' — found '${typeName(condType)}'. Use an ` +
        `explicit comparison`,
    );
  }

  const trueType = typeOfExpr(expr.whenTrue, scope, ctx, contextType);
  const falseType = typeOfExpr(expr.whenFalse, scope, ctx, contextType);
  if (isError(trueType) || isError(falseType)) return ERROR_TYPE; // cascade suppression

  const combined = commonType(trueType, falseType);
  if (combined === null) {
    ctx.bag.addError(
      DiagCode.TernaryArmMismatch, // E10088
      expr.span,
      `Conditional operator arms have incompatible types '${typeName(trueType)}' ` +
        `and '${typeName(falseType)}'`,
    );
    return ERROR_TYPE;
  }
  return combined;
}

/**
 * Assignment typing: the target must be a mutable l-value (a `variable`; a
 * `constant` → E10191), and the value must be assignment-compatible with it
 * (E10152/E10153/E10154 otherwise). A compound assignment (`x OP= e`) carries
 * the expanded form's semantics `x = x OP e`: the operator class's binary
 * rule applies to (target, value), and the expansion's result must be
 * assignable BACK to the target — `byte += word` promotes to word and then
 * fails the narrowing write-back. Result = the target type.
 */
function typeAssign(expr: AssignExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const targetType = typeOfExpr(expr.target, scope, ctx);

  // L-value mutability: a resolved `constant` target cannot be assigned
  // (E10191) — including element/field writes THROUGH a const aggregate,
  // whose root symbol is a constant. A const PARAMETER root rejects by the
  // same walk (E10123): direct writes, nested chains, indexed elements, and
  // compound assignment all reach here with the parameter as their root.
  const rootSym = assignmentRootSymbol(expr.target, scope, ctx);
  if (rootSym !== null && rootSym.kind === "constant") {
    ctx.bag.addError(
      DiagCode.AssignToConst,
      expr.span,
      `Cannot assign to constant '${rootSym.name}'`,
    );
  } else if (rootSym !== null && rootSym.kind === "parameter" && !rootSym.mutable) {
    ctx.bag.addError(
      DiagCode.ModifyConstParam,
      expr.span,
      `Cannot modify const parameter '${rootSym.name}' — const parameters are ` +
        `read-only for the whole call`,
    );
  }

  // Whole-array assignment never works — arrays are memory regions, not
  // values; copy elements individually (or restructure with a struct).
  if (targetType.kind === "array" && expr.target.kind !== "ArrayLitExpr") {
    ctx.bag.addError(
      DiagCode.ArrayAssignmentNotAllowed,
      expr.span,
      "Arrays cannot be assigned as wholes — copy elements individually",
    );
    typeOfExpr(expr.value, scope, ctx, targetType);
    return ERROR_TYPE;
  }

  const valueType = typeOfExpr(expr.value, scope, ctx, targetType);
  checkConstRange(expr.value, targetType, ctx);

  if (expr.op === "=") {
    checkAssignable(valueType, targetType, expr.span, ctx);
    checkIntermediateOverflow(expr.value, valueType, targetType, ctx);
    return targetType;
  }
  return typeCompoundAssign(expr, targetType, valueType, ctx);
}

/**
 * The root declared symbol of an assignment target: the base identifier of
 * an `a`, `a[i]`, `s.f`, `s.f[i].g` chain, or the module-qualified symbol a
 * `Mod.x` head resolves to. `null` for targets with no declared root.
 */
function assignmentRootSymbol(
  target: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Symbol | null {
  let node: ExprNode = target;
  while (node.kind === "IndexExpr" || node.kind === "FieldAccessExpr") {
    // A qualified head (`Mod.x…`) resolved to a symbol while it was typed.
    const qualified = ctx.symbolMap.get(node);
    if (qualified !== undefined && node.kind === "FieldAccessExpr") return qualified;
    node = node.kind === "IndexExpr" ? node.object : node.object;
  }
  return node.kind === "IdentExpr" ? resolveName(node.name, scope) : null;
}

/**
 * The compound-assignment expansion check for `x OP= e` (the `=` fast path is
 * handled by the caller). Shift compounds apply the unsigned-amount rule; the
 * arithmetic/bitwise compounds apply the integer common-type rule to
 * (target, value) and then require the (possibly promoted) result to narrow
 * back into the target without a cast.
 */
function typeCompoundAssign(
  expr: AssignExprNode,
  targetType: Type,
  valueType: Type,
  ctx: TypeCheckContext,
): Type {
  if (isError(targetType) || isError(valueType)) return targetType; // cascade suppression

  const baseOp = expr.op.slice(0, -1); // "+=" → "+", "<<=" → "<<"

  if (SHIFT_OPS.has(baseOp)) {
    if (targetType.kind !== "primitive" || !isInteger(targetType)) {
      emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
      return targetType;
    }
    if (!isInteger(valueType)) {
      emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
      return targetType;
    }
    if (isSigned(valueType)) {
      ctx.bag.addError(
        DiagCode.ShiftAmountNotUnsigned, // E10083
        expr.value.span,
        `Shift amount must be unsigned ('byte' or 'word') — found '${typeName(valueType)}'`,
      );
    }
    return targetType; // a shift's result is the left (target) type — always writes back
  }

  // Arithmetic/bitwise expansion: boolean operands are not numeric.
  if (typeName(targetType) === "boolean" || typeName(valueType) === "boolean") {
    emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
    return targetType;
  }
  const combined = commonType(targetType, valueType);
  if (combined === null) {
    emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
    return targetType;
  }

  // Write-back: the expansion's result must fit the target without a cast.
  checkAssignable(combined, targetType, expr.span, ctx);
  checkIntermediateOverflow(expr.value, valueType, targetType, ctx);
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
  // Head classification for a bare-identifier object: a value symbol makes
  // this struct-field access; an enum TYPE makes it member access; an
  // unresolved head falls to the qualified `Module.member` ladder.
  if (expr.object.kind === "IdentExpr") {
    const head = resolveName(expr.object.name, scope);
    if (head !== null && head.kind === "enum") {
      return typeEnumMemberAccess(expr, head, ctx);
    }
    if (head !== null && head.kind === "struct") {
      ctx.bag.addError(
        DiagCode.InvalidOperandType,
        expr.object.span,
        `'${expr.object.name}' names a struct type — member access needs a value`,
      );
      return ERROR_TYPE;
    }
    if (head === null) {
      return typeQualifiedAccess(expr, scope, ctx);
    }
    // A value symbol — fall through to struct-field typing below.
  } else if (expr.object.kind === "FieldAccessExpr") {
    // A chained head like `Mod.Enum.MEMBER`: type the inner access first; if
    // it resolved to an enum TYPE reference, this is member access on it.
    const objType = typeOfExpr(expr.object, scope, ctx);
    const objSym = ctx.symbolMap.get(expr.object);
    if (objSym !== undefined && objSym.kind === "enum" && objType.kind === "enum") {
      return typeEnumMemberAccess(expr, objSym, ctx);
    }
    return typeStructFieldOn(objType, expr, ctx);
  }

  const objType = typeOfExpr(expr.object, scope, ctx);
  return typeStructFieldOn(objType, expr, ctx);
}

/** Enum member access `Direction.UP` (the head names the enum TYPE). */
function typeEnumMemberAccess(
  expr: FieldAccessExprNode,
  enumSym: Symbol,
  ctx: TypeCheckContext,
): Type {
  ctx.symbolMap.set(expr.object, enumSym);
  const enumType = enumSym.type;
  if (enumType.kind !== "enum") return ERROR_TYPE; // layout poisoned — already reported
  if (!enumType.members.has(expr.field)) {
    ctx.bag.addError(
      DiagCode.UnknownField,
      expr.fieldSpan,
      `Enum '${enumType.name}' has no member '${expr.field}'`,
    );
    return ERROR_TYPE;
  }
  return enumType;
}

/** Struct-field access on an already-typed object. */
function typeStructFieldOn(
  objType: Type,
  expr: FieldAccessExprNode,
  ctx: TypeCheckContext,
): Type {
  if (isError(objType)) return ERROR_TYPE; // cascade suppression
  if (objType.kind !== "struct") {
    ctx.bag.addError(
      DiagCode.InvalidOperandType,
      expr.span,
      `Cannot access a member of type '${typeName(objType)}' — member access needs a struct`,
    );
    return ERROR_TYPE;
  }
  const field = objType.fields.get(expr.field);
  if (field === undefined) {
    ctx.bag.addError(
      DiagCode.UnknownField,
      expr.fieldSpan,
      `Struct '${objType.name}' has no field '${expr.field}'`,
    );
    return ERROR_TYPE;
  }
  return field.type;
}

/** The 5b qualified `Module.member` value surface (heads that resolve to nothing local). */
function typeQualifiedAccess(
  expr: FieldAccessExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  const res = resolveQualified(expr, scope, ctx.moduleScopes, ctx.bag);
  if (res.status !== "resolved") {
    // not-qualified → nothing local and no module: already impossible here
    // (the caller checked the head); poisoned → the diagnostic is out.
    return ERROR_TYPE;
  }

  const sym = res.symbol;
  if (sym.kind === "variable" || sym.kind === "constant") {
    ctx.symbolMap.set(expr, sym);
    return sym.type;
  }
  if (sym.kind === "enum" || sym.kind === "struct") {
    // A qualified TYPE reference (`Mod.Enum` / `Mod.Point`) — legal only as
    // the head of member access or a literal; record it so the outer access
    // can classify, and hand back the type itself.
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

/**
 * Index-expression typing (`a[i]`): the object must be an array (anything
 * else is E10080), the index an unsigned integer — a signed or boolean index
 * is E10114. The strict index-width tier rules key on the KNOWN total byte
 * size: a `word` index on a ≤256-byte array is E10117 (the byte index covers
 * it; the high byte would be dead weight), a `byte` index on a larger array
 * is E10118 (it cannot reach every element), and an UNSIZED parameter (no
 * known total) accepts both widths. Integer literals adapt through a
 * tier-matched contextual hint, so no cast is needed on either tier. A
 * constant index folds and is bounds-checked against the declared size
 * (E10115) when one exists. The result is the element type; the expression
 * is a legal l-value.
 */
function typeIndexExpr(expr: IndexExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const objType = typeOfExpr(expr.object, scope, ctx);

  // The index's contextual hint follows the tier: literals on a >256-byte
  // array type as `word`, everything else (incl. unsized) as `byte`.
  const knownTotal =
    objType.kind === "array" && objType.size !== null ? byteSize(objType) : null;
  const hint = knownTotal !== null && knownTotal > 256 ? primitive("word") : primitive("byte");
  const indexType = typeOfExpr(expr.index, scope, ctx, hint);

  if (isError(objType)) return ERROR_TYPE; // cascade suppression
  if (objType.kind !== "array") {
    ctx.bag.addError(
      DiagCode.InvalidOperandType,
      expr.span,
      `Cannot index a value of type '${typeName(objType)}' — indexing needs an array`,
    );
    return ERROR_TYPE;
  }

  if (!isError(indexType)) {
    const indexIsWord = indexType.kind === "primitive" && indexType.name === "word";
    const indexIsByte =
      (indexType.kind === "primitive" && indexType.name === "byte") ||
      indexType.kind === "enum"; // an enum index reads as its byte backing
    if (indexIsWord && knownTotal !== null && knownTotal <= 256) {
      // A byte index fully covers this array; a word index would silently
      // drop its high byte.
      ctx.bag.addError(
        DiagCode.WordIndexOnSmallArray,
        expr.index.span,
        `A 'word' index cannot be used on a ${knownTotal}-byte array — ` +
          `a 'byte' index covers it; use an explicit '<byte>(…)' cast`,
      );
      return ERROR_TYPE;
    }
    if (indexIsByte && knownTotal !== null && knownTotal > 256) {
      ctx.bag.addError(
        DiagCode.ByteIndexOnLargeArray,
        expr.index.span,
        `A 'byte' index cannot reach every element of a ${knownTotal}-byte array — ` +
          `use a 'word' index (cast with '<word>(…)')`,
      );
      return ERROR_TYPE;
    }
    if (!indexIsByte && !indexIsWord) {
      ctx.bag.addError(
        DiagCode.ArrayIndexTypeMismatch,
        expr.index.span,
        `Array index must be an unsigned integer — found '${typeName(indexType)}'`,
      );
      return ERROR_TYPE;
    }
  }

  // Constant indexes fold and bounds-check at compile time — only a KNOWN
  // size has a static bound (an unsized parameter's bound is the caller's).
  const folded = ctx.engine?.evalExpr(expr.index, scope);
  if (folded?.kind === "value" && typeof folded.value === "number" && objType.size !== null) {
    if (folded.value < 0 || folded.value >= objType.size) {
      ctx.bag.addError(
        DiagCode.StaticIndexOutOfBounds,
        expr.index.span,
        `Index ${folded.value} is out of bounds for an array of size ${objType.size}`,
      );
      return ERROR_TYPE;
    }
  }

  return objType.element;
}

/**
 * Struct-literal typing (`Point { x: 1, y: 2 }`): the type name must resolve
 * to a struct (unknown → E10151; a non-struct → E10080); every field must be
 * present (E10161), no extras (E10162), and the fields must appear in
 * declaration order (E10097); each value types in its field's context and
 * must be assignable to it. The result is the struct type.
 */
function typeStructLit(expr: StructLitExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const resolved = resolveTypeNode(
    { kind: "NamedType", name: expr.typeName, span: expr.typeNameSpan },
    { moduleScope: moduleScopeOf(scope), moduleScopes: ctx.moduleScopes, bag: ctx.bag },
  );
  if (isError(resolved)) return ERROR_TYPE; // E10151/E10012 already out
  if (resolved.kind !== "struct") {
    ctx.bag.addError(
      DiagCode.InvalidOperandType,
      expr.typeNameSpan,
      `'${expr.typeName}' is not a struct type — a struct literal needs one`,
    );
    return ERROR_TYPE;
  }

  const declaredOrder = [...resolved.fields.keys()];
  const seen = new Set<string>();
  for (const field of expr.fields) {
    const layout = resolved.fields.get(field.name);
    if (layout === undefined) {
      ctx.bag.addError(
        DiagCode.ExtraFieldInInit,
        field.nameSpan,
        `Struct '${resolved.name}' has no field '${field.name}'`,
      );
      typeOfExpr(field.value, scope, ctx);
      continue;
    }
    seen.add(field.name);
    const valueType = typeOfExpr(field.value, scope, ctx, layout.type);
    checkConstRange(field.value, layout.type, ctx);
    checkAssignable(valueType, layout.type, field.value.span, ctx);
  }
  for (const name of declaredOrder) {
    if (!seen.has(name)) {
      ctx.bag.addError(
        DiagCode.MissingFieldInInit,
        expr.span,
        `Struct literal for '${resolved.name}' is missing field '${name}'`,
      );
    }
  }
  // Declaration order: the given fields (extras excluded) must be a
  // subsequence of the declared order in the same relative positions.
  const givenKnown = expr.fields.filter((f) => resolved.fields.has(f.name));
  const expected = declaredOrder.filter((n) => seen.has(n));
  const inOrder = givenKnown.every((f, i) => f.name === expected[i]);
  if (!inOrder) {
    ctx.bag.addError(
      DiagCode.StructInitFieldOrder,
      expr.span,
      `Struct literal fields must be in declaration order — expected ` +
        `'${expected.join(", ")}', found '${givenKnown.map((f) => f.name).join(", ")}'`,
    );
  }
  return resolved;
}

/**
 * Array-literal typing: array literals are CONTEXTUAL — the expected type
 * comes from the annotation/field/assignment target; a literal with no
 * expected array type is E10080. Elements (and the fill value) type in the
 * element's context and must be assignable to it; more elements than the
 * declared size is the assignment mismatch; a fill on an unsized `[]`
 * annotation is E10126 (nothing determines how many slots it covers).
 * Under-coverage is the declaration's business (a warning for `let`, a hard
 * error for `const`). The result is the expected array type — sized by the
 * element count when the annotation was unsized.
 */
function typeArrayLit(
  expr: ArrayLitExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  if (contextType === undefined || contextType.kind !== "array") {
    for (const element of expr.elements) typeOfExpr(element, scope, ctx);
    if (expr.fill !== null) typeOfExpr(expr.fill, scope, ctx);
    if (contextType !== undefined && isError(contextType)) return ERROR_TYPE;
    ctx.bag.addError(
      DiagCode.InvalidOperandType,
      expr.span,
      "An array literal needs an array-typed context (a declaration or assignment target)",
    );
    return ERROR_TYPE;
  }

  const element = contextType.element;
  for (const item of expr.elements) {
    const itemType = typeOfExpr(item, scope, ctx, element);
    checkConstRange(item, element, ctx);
    checkAssignable(itemType, element, item.span, ctx);
  }
  if (expr.fill !== null) {
    if (contextType.size === null) {
      // An unsized annotation cannot say how many slots the fill covers.
      ctx.bag.addError(
        DiagCode.FillRequiresExplicitSize,
        expr.fill.span,
        "A '; fill' value needs an explicit declared array size",
      );
    } else {
      const fillType = typeOfExpr(expr.fill, scope, ctx, element);
      checkConstRange(expr.fill, element, ctx);
      checkAssignable(fillType, element, expr.fill.span, ctx);
    }
  }
  if (contextType.size !== null && expr.elements.length > contextType.size) {
    ctx.bag.addError(
      DiagCode.TypeMismatchAssignment,
      expr.span,
      `Array literal has ${expr.elements.length} elements but the declared size is ` +
        `${contextType.size}`,
    );
    return ERROR_TYPE;
  }
  // Size inference for an unsized annotation: the element count.
  if (contextType.size === null && expr.elements.length > 0) {
    return { kind: "array", element, size: expr.elements.length };
  }
  if (contextType.size === null) {
    ctx.bag.addError(DiagCode.ArraySizeZero, expr.span, "Array size must be at least 1");
    return ERROR_TYPE;
  }
  return contextType;
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

  // By-ref aliasing detection: the same root symbol feeding two by-ref
  // arguments of THIS call means the callee's writes through one name are
  // visible through the other (the "obvious case" — deeper overlap analysis
  // is deliberately out of scope). One warning per call, naming both params.
  let aliasWarned = false;
  const byRefRoots = new Map<Symbol, string>();

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
    checkIntermediateOverflow(arg, argType, param.type, ctx);

    if (param.byRef) {
      const root = assignmentRootSymbol(arg, scope, ctx);
      if (root !== null) {
        // A const root (a module constant — its image lives in read-only
        // data — or a const parameter being forwarded) must not bind to a
        // parameter the callee may write through.
        if (
          param.mutable &&
          (root.kind === "constant" || (root.kind === "parameter" && !root.mutable))
        ) {
          ctx.bag.addError(
            DiagCode.ConstToMutableParam,
            arg.span,
            `Cannot pass const '${root.name}' to mutable by-reference parameter ` +
              `'${param.name}' of '${name}()' — declare the parameter 'const', ` +
              `or pass a mutable copy`,
          );
        }
        const earlier = byRefRoots.get(root);
        if (earlier !== undefined && !aliasWarned) {
          aliasWarned = true;
          ctx.bag.addWarning(
            DiagCode.PossibleAliasing,
            arg.span,
            `'${root.name}' is passed by reference as both '${earlier}' and ` +
              `'${param.name}' — writes through one alias are visible through the other`,
          );
        }
        if (earlier === undefined) byRefRoots.set(root, param.name);
      }
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
 *
 * Parameter annotations resolve in FULL mode so signatures carry real
 * aggregate/unsized types (incl. dotted `Mod.Type` names and constant-
 * expression sizes). Any annotation error was already reported when the
 * parameter SYMBOLS were finalized in the type-resolution pass, so this
 * resolution runs against a throwaway bag — never a second report.
 */
function signatureOf(sym: Symbol, ctx: TypeCheckContext): FnSignature {
  const cached = ctx.signatures.get(sym);
  if (cached !== undefined) return cached;

  const decl = isFunctionDecl(sym.decl) ? sym.decl : null;
  let sig: FnSignature;
  if (decl === null) {
    sig = { params: [], returnType: primitive("void") };
  } else {
    const engine = ctx.engine;
    const resolverCtx: TypeResolverContext = {
      moduleScope: sym.scope,
      moduleScopes: ctx.moduleScopes,
      bag: createDiagnosticBag(),
      ...(engine !== undefined
        ? {
            evalSize: (expr: ExprNode): number | "poisoned" | null => {
              const result = engine.evalExpr(expr, sym.scope);
              if (result?.kind === "value" && typeof result.value === "number") {
                return result.value;
              }
              return result?.kind === "poisoned" ? "poisoned" : null;
            },
          }
        : {}),
    };
    sig = {
      params: decl.params.map((p) => {
        const type = resolveTypeNode(p.paramType, resolverCtx);
        return {
          name: p.name,
          type,
          byRef: type.kind === "array" || type.kind === "struct",
          mutable: !p.isConst,
        };
      }),
      returnType: resolveTypeNode(decl.returnType),
    };
  }
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
 * width-aware lowering); a `lo`/`hi` argument types in a `word` context (the
 * signature is `lo(value: word): byte` — narrower integers widen implicitly,
 * `sword` reinterprets at the same width, and a boolean argument is the
 * standard argument-mismatch error). Unknown intrinsics poison without a
 * diagnostic (the intrinsic-validation pass owns their errors); arity errors
 * are that pass's job too.
 */
function typeIntrinsicCall(
  expr: IntrinsicCallExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  if (expr.name === "lo" || expr.name === "hi") {
    for (const arg of expr.args) {
      const argType = typeOfExpr(arg, scope, ctx, primitive("word"));
      if (!isError(argType) && !isInteger(argType)) {
        ctx.bag.addError(
          DiagCode.ArgTypeMismatch, // E10171
          arg.span,
          `Argument type mismatch — parameter 'value' of '${expr.name}()' ` +
            `expects 'word', found '${typeName(argType)}'`,
        );
      }
    }
    return primitive("byte");
  }

  // Query intrinsics fold to compile-time constants; the result is typed by
  // representability — a value ≤255 fits `byte`, anything larger is `word`
  // (`length(byte[256])` is 256, which `byte` cannot hold).
  if (expr.name === "sizeof" || expr.name === "offsetof" || expr.name === "length") {
    for (const arg of expr.args) typeOfExpr(arg, scope, ctx);

    // No size exists for the unsized forms: `length()` on an unsized array
    // parameter (the caller must pass the length explicitly), and `sizeof`
    // of an unsized array type.
    if (expr.name === "length") {
      const arg = expr.args[0];
      const root = arg !== undefined ? assignmentRootSymbol(arg, scope, ctx) : null;
      if (root !== null && root.type.kind === "array" && root.type.size === null) {
        ctx.bag.addError(
          DiagCode.InvalidOperandType,
          expr.span,
          `length() is not available for unsized array parameter '${root.name}' — ` +
            `pass an explicit length parameter`,
        );
        return ERROR_TYPE;
      }
    }
    if (expr.name === "sizeof" && expr.typeArg !== null && hasUnsizedArray(expr.typeArg)) {
      ctx.bag.addError(
        DiagCode.InvalidOperandType,
        expr.span,
        "sizeof() is not available for an unsized array type — no size exists",
      );
      return ERROR_TYPE;
    }

    const folded = ctx.engine?.evalExpr(expr, scope);
    if (folded?.kind === "value" && typeof folded.value === "number") {
      return primitive(folded.value <= 255 ? "byte" : "word");
    }
    return ERROR_TYPE; // validation/engine already reported the root cause
  }

  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);

  switch (expr.name) {
    case "peek":
      return primitive("byte");
    case "peekw":
      return primitive("word");
    case "poke":
    case "pokew":
      return primitive("void");
    default:
      return ERROR_TYPE; // embed/etc. — not yet supported here
  }
}

/** True when a syntactic type annotation contains an unsized `[]` anywhere. */
function hasUnsizedArray(node: TypeNode): boolean {
  return node.kind === "ArrayType" && (node.size === null || hasUnsizedArray(node.elementType));
}

/**
 * Emits the assignment-compatibility diagnostic when `valueType` is not
 * assignable to `targetType`. Same-type, same-sign widening, and poison pass
 * silently; narrowing is E10154, cross-sign E10153, and boolean↔integer (or
 * any other mismatch) E10152 — always with the explicit-cast remedy implied
 * by the message.
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

/**
 * Intermediate-overflow advisories (W10160/W10161), called after an
 * assignability check at the four value-consuming sites (initialiser,
 * assignment, argument, return).
 *
 * An expression's type comes from its operands, not the destination — so
 * 8-bit `+ - *` arithmetic feeding a 16-bit target evaluates (and possibly
 * wraps) at 8 bits BEFORE widening. When the expression const-folds, a value
 * that provably wraps warns W10161 (with the wrapped value) and a provably
 * in-range value stays silent; a non-constant expression warns W10160 with
 * the cast-the-operands-first fix. Only same-sign narrow→wide flows qualify
 * (anything else already failed assignability). Bitwise/comparison results
 * never grow past their operands, so only `+ - *` are watched.
 *
 * @param valueExpr The value expression being consumed.
 * @param valueType The expression's (operand-derived) type.
 * @param targetType The declared/target type it flows into.
 * @param ctx The Pass-3 context.
 */
export function checkIntermediateOverflow(
  valueExpr: ExprNode,
  valueType: Type,
  targetType: Type,
  ctx: TypeCheckContext,
): void {
  if (valueExpr.kind !== "BinaryExpr") return;
  if (!INTERMEDIATE_OVERFLOW_OPS.has(valueExpr.op)) return;
  if (valueType.kind !== "primitive" || !isInteger(valueType)) return;
  if (targetType.kind !== "primitive" || !isInteger(targetType)) return;
  if (bitWidth(valueType) !== 8 || bitWidth(targetType) !== 16) return;
  if (isSigned(valueType) !== isSigned(targetType)) return; // cross-sign already errored

  const folded = evalConst(valueExpr, undefined, (e) => ctx.typeMap.get(e));
  if (folded.kind === "value" && typeof folded.value === "number") {
    const range = integerRange(valueType);
    if (range === null) return;
    if (folded.value >= range.min && folded.value <= range.max) return; // provably safe
    const wrapped = fromBits(toBits(folded.value, 8), 8, isSigned(valueType));
    ctx.bag.addWarning(
      DiagCode.ConstOverflowBeforeWidening, // W10161
      valueExpr.span,
      `Constant expression overflow — wraps to ${wrapped} ` +
        `at '${typeName(valueType)}' width before widening`,
    );
    return;
  }
  if (folded.kind !== "nonConst") return; // divByZero/poisonedRef — other checks own it

  const wide = typeName(targetType);
  ctx.bag.addWarning(
    DiagCode.IntermediateOverflow, // W10160
    valueExpr.span,
    `'${typeName(valueType)}' arithmetic may overflow before widening to '${wide}' ` +
      `— use <${wide}>(a) ${valueExpr.op} <${wide}>(b)`,
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
    return DiagCode.WidthNarrowingNoCast; // E10154 (same-sign widening never reaches here)
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
  const folded = evalConst(expr, resolveRef, (e) => ctx.typeMap.get(e));
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
