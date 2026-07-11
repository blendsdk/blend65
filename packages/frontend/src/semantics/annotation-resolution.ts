/**
 * Declared-type annotation resolution — the type-resolution pass.
 *
 * Collection assigns every variable/constant symbol a provisional type
 * (primitive annotations resolve immediately; named and array annotations
 * cannot resolve until imports are bound). This pass runs once imports ARE
 * bound and finalizes each symbol's type in place through the full resolver:
 * module-local names, import-bound aliases, and dotted `Mod.Type` forms all
 * resolve; `void` in a value position is E10156, unknown names E10151,
 * non-exported cross-module types E10012, and an unsized `[]` annotation
 * without an initialiser is E10110 (nothing determines its size).
 *
 * Symbol identity is preserved — the type field is patched, never the symbol
 * replaced — because downstream maps (initializers, const values, call edges)
 * key by the symbol object.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { DiagCode, IceCode } from "@blend65/core";
import type {
  AstNode,
  ConstDeclNode,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  Scope,
  Symbol,
  TypeNode,
} from "@blend65/core";
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
      finalizeSymbol(sym, ctx);
    }
  }

  for (const [declNode, bodyScope] of scopeByNode) {
    const moduleScope = bodyScope.parent;
    if (moduleScope === null || moduleScope.kind !== "module") continue;
    const ctx = makeCtx(moduleScope, bodyScope);
    checkFunctionBoundary(declNode, ctx);
    for (const sym of bodyScope.symbols.values()) {
      finalizeSymbol(sym, ctx);
    }
  }
}

/**
 * The aggregate function boundary: array and struct RETURN types are
 * permanently illegal (E10120/E10093 — the calling convention has no
 * aggregate return channel; return through a module variable instead), and
 * aggregate PARAMETERS are loudly rejected until the by-reference parameter
 * surface lands. Enum returns/params are byte-sized and legal.
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

  for (const param of decl.params) {
    const kind = annotationKind(param.paramType, ctx);
    if (kind === "array" || kind === "struct") {
      ctx.bag.addError(
        IceCode.Unexpected,
        param.nameSpan,
        `parameter '${param.name}' has an aggregate type — struct/array parameters ` +
          "are not supported yet (they need by-reference passing)",
      );
    }
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
function finalizeSymbol(sym: Symbol, ctx: TypeResolverContext): void {
  if (sym.kind !== "variable" && sym.kind !== "constant") return;
  const decl = sym.decl;
  if (!isVarDecl(decl)) return;
  const annotation = decl.declaredType;
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
      // An unsized `[]` annotation needs an initialiser to determine its
      // size; without one the declaration is unsizable.
      if (
        annotation.kind === "ArrayType" &&
        annotation.size === null &&
        decl.initialiser === null
      ) {
        ctx.bag.addError(
          DiagCode.ArraySizeNotConst,
          annotation.span,
          "An unsized array declaration needs an initialiser to determine its size",
        );
      }
      return;
    }
    default:
      return; // ErrorType — the parser already reported
  }
}
