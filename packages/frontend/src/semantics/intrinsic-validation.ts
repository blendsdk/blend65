/**
 * The RD-17 intrinsic-validation pass (03-02) — the first real semantic checking.
 *
 * Implements RD-04's deferred intrinsic rules (R59/R100) plus RD-17's availability,
 * import-boundary, and decimal-mode checks. Everything dispatches on the descriptor
 * looked up in the registry — no individual intrinsic name is special-cased (AC-17).
 * The pass never throws; every problem is a diagnostic on the bag.
 *
 * Checks (03-02): V1 E10040 (args to parameterless), V2 E10041 (arg count),
 * V3 E10171 (literal arg range), V4 E10043 (availability), V5 E10101 (reserved-name
 * shadowing), V7 E10171 (sizeof/offsetof type/field resolves), V8 W10120 (asm_sed
 * without asm_cld). The T4 import-boundary checks (V6a E10046 / V6b E10043) are
 * wired in Phase 5.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` (+ its
 * `/platform` subpath) only — never `@blend65/codegen` (R15/AR-20).
 */

import { DiagCode, IceCode, RESERVED_BUILTINS, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  DiagnosticBag,
  IntrinsicCallExprNode,
  IntrinsicDescriptor,
  IntrinsicRegistry,
  ProgramNode,
  SourceSpan,
  TopLevelItem,
  TypeNode,
  TypeRef,
} from "@blend65/core";
import type { CpuVariant, PlatformProfile } from "@blend65/core/platform";
import type { DeclarationTables } from "./declaration-collection.js";

/** Everything the validation checks consult per program. */
export interface ValidationContext {
  /** The populated intrinsic registry (core catalog + any platform T4). */
  readonly registry: IntrinsicRegistry;
  /** The canonical target profile; when absent, availability checks are skipped. */
  readonly targetProfile?: PlatformProfile;
  /** Resolved struct/enum type tables (for `sizeof`/`offsetof`). */
  readonly tables: DeclarationTables;
  /** The diagnostic accumulator. */
  readonly bag: DiagnosticBag;
}

/** The known CPU variants, used to render the E10043 "required CPU" generically. */
const CPU_VARIANTS: readonly CpuVariant[] = ["nmos6502", "wdc65c02"];

/**
 * Validate every intrinsic call and reserved-name declaration across all programs.
 *
 * @param programs The parsed program ASTs.
 * @param ctx The registry, target profile, type tables, and diagnostic bag.
 */
export function validateIntrinsics(
  programs: readonly ProgramNode[],
  ctx: ValidationContext,
): void {
  for (const program of programs) {
    // V5: reserved-name shadowing on top-level declarations (+ function params).
    for (const item of program.items) {
      checkShadowing(item, ctx);
    }
    // V1–V4/V7: validate every intrinsic call site anywhere in the program.
    for (const call of collectIntrinsicCalls(program)) {
      validateCall(call, ctx);
    }
    // V8: per-function decimal-mode balance (asm_sed without asm_cld).
    for (const item of program.items) {
      if (item.kind === "FunctionDecl" || item.kind === "InterruptDecl") {
        checkDecimalMode(item, ctx);
      }
    }
  }
}

/** V5 — a declaration (or parameter) whose name shadows a reserved intrinsic. */
function checkShadowing(item: TopLevelItem, ctx: ValidationContext): void {
  const report = (name: string, span: SourceSpan): void => {
    if (ctx.registry.isReserved(name)) {
      ctx.bag.addError(
        DiagCode.NameShadows,
        span,
        `'${name}' shadows a reserved intrinsic name and cannot be redeclared`,
      );
    }
  };
  switch (item.kind) {
    case "FunctionDecl":
      report(item.name, item.nameSpan);
      for (const param of item.params) report(param.name, param.nameSpan);
      return;
    case "InterruptDecl":
    case "StructDecl":
    case "EnumDecl":
    case "LetDecl":
    case "ConstDecl":
      report(item.name, item.nameSpan);
      return;
    default:
      return;
  }
}

/** V1–V4/V7 — validate a single intrinsic call against its descriptor. */
function validateCall(node: IntrinsicCallExprNode, ctx: ValidationContext): void {
  const descriptor = ctx.registry.get(node.name);
  if (descriptor === undefined) {
    // Catalog/reserved-set drift is a compiler bug, not a user error (AC-01).
    if (RESERVED_BUILTINS.has(node.name)) {
      ctx.bag.addICE(
        IceCode.Unexpected,
        node.nameSpan,
        `intrinsic '${node.name}' is reserved but absent from the registry (catalog drift)`,
      );
    }
    return;
  }

  // V4 — availability on the active target (skipped when no profile is supplied).
  if (ctx.targetProfile !== undefined && !descriptor.availability(ctx.targetProfile)) {
    ctx.bag.addError(
      DiagCode.IntrinsicUnavailable,
      node.nameSpan,
      renderUnavailable(descriptor, ctx.targetProfile),
    );
    // Availability failure poisons the call; skip further arg checks.
    return;
  }

  // sizeof/offsetof carry a type argument (and optional field) — validate those.
  if (node.typeArg !== null) {
    checkTypeArg(node, ctx);
    return;
  }

  // Value-argument intrinsics: arity then literal-range checks.
  const paramCount = descriptor.signature.params.length;
  if (paramCount === 0 && node.args.length > 0) {
    ctx.bag.addError(
      DiagCode.ArgsToParameterlessIntrinsic,
      node.nameSpan,
      `'${node.name}' takes no arguments but ${node.args.length} were supplied`,
    );
    return;
  }
  if (node.args.length !== paramCount) {
    ctx.bag.addError(
      DiagCode.WrongIntrinsicArgCount,
      node.nameSpan,
      `'${node.name}' expects ${paramCount} argument(s) but ${node.args.length} were supplied`,
    );
    return;
  }
  // V3 — literal-argument kind/range vs the signature (non-literals pass through).
  descriptor.signature.params.forEach((param, index) => {
    const arg = node.args[index];
    if (arg !== undefined && arg.kind === "NumericLitExpr" && !inRange(arg.value, param.type)) {
      ctx.bag.addError(
        DiagCode.ArgTypeMismatch,
        arg.span,
        `literal ${arg.value} is out of range for parameter '${param.name}' of type ${typeRefName(param.type)}`,
      );
    }
  });
}

/** V7 — `sizeof`/`offsetof` type argument resolves; `offsetof` field exists. */
function checkTypeArg(node: IntrinsicCallExprNode, ctx: ValidationContext): void {
  const typeArg = node.typeArg;
  if (typeArg === null) return;
  const typeName = namedTypeName(typeArg);

  // A primitive type argument (e.g. `sizeof(byte)`) always resolves.
  if (typeName === null) return;

  const structType = ctx.tables.structTypes.get(typeName);
  const enumType = ctx.tables.enumTypes.get(typeName);
  if (structType === undefined && enumType === undefined) {
    ctx.bag.addError(
      DiagCode.ArgTypeMismatch,
      typeArg.span,
      `'${node.name}' references unknown type '${typeName}'`,
    );
    return;
  }

  // offsetof(Type, field): the field must exist on the (struct) type.
  if (node.fieldArg !== null) {
    if (structType === undefined) {
      ctx.bag.addError(
        DiagCode.ArgTypeMismatch,
        node.fieldArg.span,
        `'${node.name}' requires a struct type, but '${typeName}' is not a struct`,
      );
      return;
    }
    if (!structType.fields.has(node.fieldArg.name)) {
      ctx.bag.addError(
        DiagCode.ArgTypeMismatch,
        node.fieldArg.span,
        `struct '${typeName}' has no field '${node.fieldArg.name}'`,
      );
    }
  }
}

/** V8 — a function using `asm_sed` without a matching `asm_cld` warns (W10120). */
function checkDecimalMode(item: TopLevelItem, ctx: ValidationContext): void {
  const calls = collectIntrinsicCalls(item);
  const sed = calls.find((c) => c.name === "asm_sed");
  const hasCld = calls.some((c) => c.name === "asm_cld");
  if (sed !== undefined && !hasCld) {
    ctx.bag.addWarning(
      DiagCode.DecimalModeWithoutCld,
      sed.nameSpan,
      "decimal mode is set with 'asm_sed' but never cleared with 'asm_cld' in this function",
    );
  }
}

/**
 * Render the E10043 message (AR-P11). The required CPU is discovered generically by
 * probing which {@link CPU_VARIANTS} would satisfy the descriptor's availability —
 * no intrinsic name is special-cased (AC-17).
 */
function renderUnavailable(descriptor: IntrinsicDescriptor, profile: PlatformProfile): string {
  const requiredCpus = CPU_VARIANTS.filter((cpu) => descriptor.availability({ ...profile, cpu }));
  const requirement =
    requiredCpus.length > 0
      ? `CPU ${requiredCpus.join(" or ")}`
      : "a different target platform";
  return `'${descriptor.name}' requires ${requirement}, but the target is '${profile.platformId}' (CPU ${profile.cpu})`;
}

/** Whether a numeric literal fits the range of a scalar {@link TypeRef}. */
function inRange(value: number, type: TypeRef): boolean {
  switch (type) {
    case "byte":
    case "boolean":
      return value >= 0 && value <= 255;
    case "sbyte":
      return value >= -128 && value <= 127;
    case "word":
      return value >= 0 && value <= 65535;
    case "sword":
      return value >= -32768 && value <= 32767;
    default:
      // void / pointer / array — no literal-range constraint to check.
      return true;
  }
}

/** A human-readable name for a {@link TypeRef} (for diagnostics). */
function typeRefName(type: TypeRef): string {
  if (typeof type === "string") return type;
  return `${type.kind}<${typeRefName(type.elementType)}>`;
}

/** The declared name of a `NamedType` argument, or `null` for a primitive/array. */
function namedTypeName(node: TypeNode): string | null {
  return node.kind === "NamedType" ? node.name : null;
}

/**
 * Collect every {@link IntrinsicCallExprNode} in a subtree. Uses the core traversal
 * helpers with a uniform visitor (the established `lower.ts` pattern) so no node
 * kind is missed, including calls nested in expressions.
 */
function collectIntrinsicCalls(root: AstNode): IntrinsicCallExprNode[] {
  const found: IntrinsicCallExprNode[] = [];
  const visit = (node: AstNode): void => {
    if (node.kind === "IntrinsicCallExpr") {
      found.push(node as IntrinsicCallExprNode);
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}
