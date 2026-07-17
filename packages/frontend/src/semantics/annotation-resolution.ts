/**
 * Declared-type annotation resolution — the type-resolution pass.
 *
 * Collection assigns every variable/constant/parameter symbol a provisional
 * type (primitive annotations resolve immediately; named and array
 * annotations cannot resolve until imports are bound). This pass runs once
 * imports ARE bound and finalizes each symbol's type in place through the
 * full resolver: module-local names, import-bound aliases, and dotted
 * `Mod.Type` forms all resolve; `void` in a value position is E10156,
 * unknown names E10151, non-exported cross-module types E10012. An unsized
 * `[]` annotation survives only on parameter symbols; on a variable/constant
 * it needs a full element-list initialiser to infer a size from (checked in
 * body typing) — without any initialiser it is E10126.
 *
 * Parameter finalization also patches `byRef` (struct/array parameters pass
 * by reference; enums and scalars by value) and emits the declared-array
 * size advisories: W10142 above the 256-byte direct-addressing tier, W10143
 * when a single array consumes ≥25% of the target platform's RAM budget
 * (skipped when no target profile is supplied).
 *
 * Symbol identity is preserved — the type field is patched, never the symbol
 * replaced — because downstream maps (initializers, const values, call edges)
 * key by the symbol object.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { byteSize, DiagCode } from "@blend65/core";
import type {
  AstNode,
  ConstDeclNode,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ParameterNode,
  Scope,
  Symbol,
  Type,
  TypeNode,
  ZeropageFieldNode,
} from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { resolveTypeNode } from "./type-check/type-resolution.js";
import type { TypeResolverContext } from "./type-check/type-resolution.js";
import type { ConstTypeEngine } from "./const-type-engine.js";

/** Narrows a symbol's declaring node to a let/const declaration. */
function isVarDecl(node: AstNode): node is LetDeclNode | ConstDeclNode {
  return node.kind === "LetDecl" || node.kind === "ConstDecl";
}

/**
 * Finalizes the declared types of module-level and function-local
 * variable/constant symbols (see the module doc). Never throws.
 *
 * @param moduleScopes User-module name → its shared module scope.
 * @param scopeByNode Function decl → its body scope (holding params + locals).
 * @param bag The diagnostic accumulator.
 */
export function resolveDeclaredTypes(
  moduleScopes: ReadonlyMap<string, Scope>,
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  bag: DiagnosticBag,
  engine?: ConstTypeEngine,
  targetProfile?: PlatformProfile,
): void {
  const makeCtx = (moduleScope: Scope, evalScope: Scope): TypeResolverContext => ({
    moduleScope,
    moduleScopes,
    bag,
    ...(engine !== undefined
      ? {
          evalSize: (expr: ExprNode): number | "poisoned" | null => {
            const result = engine.evalExpr(expr, evalScope);
            if (result?.kind === "value" && typeof result.value === "number") {
              return result.value;
            }
            return result?.kind === "poisoned" ? "poisoned" : null;
          },
        }
      : {}),
  });

  for (const moduleScope of moduleScopes.values()) {
    const ctx = makeCtx(moduleScope, moduleScope);
    for (const sym of moduleScope.symbols.values()) {
      // Import-bound aliases point at symbols declared in ANOTHER module's
      // scope — the declaring module finalizes them; resolving here twice
      // would double-report.
      if (sym.scope !== moduleScope) continue;
      finalizeSymbol(sym, ctx, targetProfile);
    }
  }

  for (const [declNode, bodyScope] of scopeByNode) {
    const moduleScope = bodyScope.parent;
    if (moduleScope === null || moduleScope.kind !== "module") continue;
    const ctx = makeCtx(moduleScope, bodyScope);
    checkFunctionBoundary(declNode, ctx);
    for (const sym of bodyScope.symbols.values()) {
      finalizeSymbol(sym, ctx, targetProfile);
    }
  }
}

/**
 * The aggregate function boundary: array and struct RETURN types are
 * permanently illegal (E10120/E10093 — the calling convention has no
 * aggregate return channel; return through a module variable instead).
 * Aggregate PARAMETERS are legal — they pass by reference (FN-3) — so no
 * parameter check remains here; parameter types finalize with every other
 * symbol below.
 */
function checkFunctionBoundary(declNode: AstNode, ctx: TypeResolverContext): void {
  if (declNode.kind !== "FunctionDecl") return;
  const decl = declNode as FunctionDeclNode;

  const returnKind = annotationKind(decl.returnType, ctx);
  if (returnKind === "array") {
    ctx.bag.addError(
      DiagCode.ArrayReturnNotAllowed,
      decl.returnType.span,
      `Function '${decl.name}' cannot return an array — write into a module variable instead`,
    );
  } else if (returnKind === "struct") {
    ctx.bag.addError(
      DiagCode.StructReturnNotAllowed,
      decl.returnType.span,
      `Function '${decl.name}' cannot return a struct — write into a module variable instead`,
    );
  }
}

/**
 * Classifies an annotation as array/struct/other WITHOUT emitting: arrays
 * are syntactic; named types resolve through the scope silently (a broken
 * name is someone else's diagnostic).
 */
function annotationKind(node: TypeNode, ctx: TypeResolverContext): "array" | "struct" | "other" {
  if (node.kind === "ArrayType") return "array";
  if (node.kind !== "NamedType") return "other";
  const dot = node.name.lastIndexOf(".");
  const scope = dot >= 0 ? ctx.moduleScopes.get(node.name.slice(0, dot)) : ctx.moduleScope;
  const sym = scope?.symbols.get(dot >= 0 ? node.name.slice(dot + 1) : node.name);
  return sym?.kind === "struct" ? "struct" : "other";
}

/** Re-resolves one symbol's declared annotation and patches its type. */
function finalizeSymbol(
  sym: Symbol,
  ctx: TypeResolverContext,
  targetProfile?: PlatformProfile,
): void {
  if (sym.kind === "parameter") {
    finalizeParameter(sym, ctx);
    return;
  }
  if (sym.kind !== "variable" && sym.kind !== "constant") return;
  const decl = sym.decl;
  let annotation: TypeNode | null;
  let initialiser: ExprNode | null;
  let declName: string;
  if (isVarDecl(decl)) {
    annotation = decl.declaredType;
    initialiser = decl.initialiser;
    declName = decl.name;
  } else if (decl.kind === "ZeropageField") {
    // A zeropage field's annotation finalizes exactly like a module let's.
    const field = decl as ZeropageFieldNode;
    annotation = field.fieldType;
    initialiser = field.initialiser;
    declName = field.name;
  } else {
    return;
  }
  if (annotation === null) return; // inferred/missing — other checks own it

  switch (annotation.kind) {
    case "PrimitiveType":
      if (annotation.name === "void") {
        ctx.bag.addError(
          DiagCode.VoidTypeNotAllowed,
          annotation.span,
          "'void' is not a value type — a variable cannot be 'void'",
        );
      }
      return; // provisional resolution already handled primitives
    case "NamedType":
    case "ArrayType": {
      sym.type = resolveTypeNode(annotation, ctx);
      // An unsized `[]` annotation on a variable/constant is legal only when
      // a full element-list initialiser determines the size (body typing
      // infers it); with no initialiser at all nothing can.
      if (
        annotation.kind === "ArrayType" &&
        annotation.size === null &&
        initialiser === null
      ) {
        ctx.bag.addError(
          DiagCode.FillRequiresExplicitSize,
          annotation.span,
          "array size required — an unsized array type is legal only as a function " +
            "parameter or with a full element-list initializer",
        );
      }
      checkDeclaredArraySize(sym.type, declName, annotation.span, ctx, targetProfile);
      return;
    }
    default:
      return; // ErrorType — the parser already reported
  }
}

/**
 * Finalizes a parameter symbol: the annotation resolves through the full
 * resolver (unsized `T[]` survives — parameters are its one legal home), and
 * `byRef` is patched now that a named annotation can be classified (struct →
 * by-ref, enum → by-value; arrays were known syntactically).
 */
function finalizeParameter(sym: Symbol, ctx: TypeResolverContext): void {
  const decl = sym.decl;
  if (decl.kind !== "Parameter") return;
  const annotation = (decl as ParameterNode).paramType;
  if (annotation.kind === "PrimitiveType") {
    if (annotation.name === "void") {
      ctx.bag.addError(
        DiagCode.VoidTypeNotAllowed,
        annotation.span,
        "'void' is not a value type — a parameter cannot be 'void'",
      );
    }
    return; // provisional resolution already handled primitives
  }
  if (annotation.kind !== "NamedType" && annotation.kind !== "ArrayType") return;
  sym.type = resolveTypeNode(annotation, ctx);
  sym.byRef = sym.type.kind === "array" || sym.type.kind === "struct";
}

/**
 * The declared-array size advisories (never on parameters — an unsized
 * parameter has no size to judge): a total above the 256-byte tier boundary
 * costs pointer-formation overhead on every runtime access (W10142), and a
 * single array at ≥25% of the target platform's usable RAM deserves a budget
 * check (W10143 — platform-relative, skipped without a target profile).
 */
function checkDeclaredArraySize(
  type: Type,
  name: string,
  span: TypeNode["span"],
  ctx: TypeResolverContext,
  targetProfile?: PlatformProfile,
): void {
  if (type.kind !== "array" || type.size === null) return;
  const total = byteSize(type);
  if (total > 256) {
    ctx.bag.addWarning(
      DiagCode.Tier2Overhead,
      span,
      `Array '${name}' is ${total} bytes — beyond the 256-byte direct-addressing tier, ` +
        "every runtime access pays pointer-formation overhead",
    );
  }
  if (targetProfile !== undefined && total >= targetProfile.maxRam * 0.25) {
    ctx.bag.addWarning(
      DiagCode.LargeArrayOnPlatform,
      span,
      `Array '${name}' is ${total} bytes — ≥25% of the platform's ${targetProfile.maxRam}-byte ` +
        "RAM budget; consider the total RAM budget",
    );
  }
}
