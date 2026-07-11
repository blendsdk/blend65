/**
 * Type-node → semantic {@link Type} resolution + integer-range facts.
 *
 * Two resolution modes share one entry point:
 *
 * - **Scalar mode** (no resolver context): a `PrimitiveType` node resolves to
 *   `primitive(name)`; anything else → {@link ERROR_TYPE}. This is the
 *   provisional resolution collection uses before imports are bound — it
 *   emits no diagnostics.
 * - **Full mode** (with a {@link TypeResolverContext}): named types resolve
 *   through the module scope (module-local declarations AND import-bound
 *   aliases share the one namespace) or the dotted `Mod.Type` form; array
 *   types resolve their element and size. Unknown names are E10151, unknown
 *   module heads E10100, non-exported cross-module types E10012, `void`
 *   elements E10156, non-literal sizes E10110, zero sizes E10111, and arrays
 *   larger than 256 bytes are loudly rejected as not-yet-supported (they need
 *   the pointer-indexing tier).
 */

import { byteSize, DiagCode, ERROR_TYPE, IceCode, primitive } from "@blend65/core";
import type { DiagnosticBag, Scope, Type, TypeNode } from "@blend65/core";

/** Everything full-mode type resolution needs to resolve named types. */
export interface TypeResolverContext {
  /** The module scope of the file the annotation appears in. */
  readonly moduleScope: Scope;
  /** User-module name → its shared module scope (dotted `Mod.Type`). */
  readonly moduleScopes: ReadonlyMap<string, Scope>;
  /** The diagnostic accumulator (full mode emits; scalar mode never does). */
  readonly bag: DiagnosticBag;
}

/**
 * Resolves a declared {@link TypeNode} to its semantic {@link Type}. Without
 * `ctx` this is the scalar-mode provisional resolution (primitives only, no
 * diagnostics); with `ctx` it resolves the full annotation surface (see the
 * module doc). Never throws.
 *
 * @param node The declared type node, or `null` for an inferred declaration.
 * @param ctx The resolver context for full-mode resolution; omit for scalar mode.
 * @returns The resolved type, or {@link ERROR_TYPE}.
 */
export function resolveTypeNode(node: TypeNode | null, ctx?: TypeResolverContext): Type {
  if (node === null) return ERROR_TYPE;
  switch (node.kind) {
    case "PrimitiveType":
      return primitive(node.name);
    case "NamedType":
      return ctx !== undefined ? resolveNamed(node.name, node, ctx) : ERROR_TYPE;
    case "ArrayType": {
      if (ctx === undefined) return ERROR_TYPE;
      const element = resolveTypeNode(node.elementType, ctx);
      if (element.kind === "primitive" && element.name === "void") {
        ctx.bag.addError(
          DiagCode.VoidTypeNotAllowed,
          node.elementType.span,
          "'void' is not a value type — an array element cannot be 'void'",
        );
        return ERROR_TYPE;
      }
      if (element.kind === "error") return ERROR_TYPE;
      const size = resolveArraySize(node, ctx);
      if (size === null) return ERROR_TYPE;
      const total = byteSize(element) * size;
      if (total > 256) {
        ctx.bag.addError(
          IceCode.Unexpected,
          node.span,
          `array type is ${total} bytes — arrays larger than 256 bytes are not ` +
            "supported yet (they need pointer-tier indexing)",
        );
        return ERROR_TYPE;
      }
      return { kind: "array", element, size };
    }
    default:
      return ERROR_TYPE;
  }
}

/**
 * Resolves a named type through the one-namespace module scope, or through
 * the dotted `Mod.Type` cross-module form.
 */
function resolveNamed(
  name: string,
  node: TypeNode,
  ctx: TypeResolverContext,
): Type {
  const dot = name.lastIndexOf(".");
  if (dot >= 0) {
    const modulePath = name.slice(0, dot);
    const typeName = name.slice(dot + 1);
    const sourceScope = ctx.moduleScopes.get(modulePath);
    if (sourceScope === undefined) {
      ctx.bag.addError(
        DiagCode.UndeclaredIdentifier,
        node.span,
        `Unknown module '${modulePath}' in type '${name}'`,
      );
      return ERROR_TYPE;
    }
    const sym = sourceScope.symbols.get(typeName);
    if (sym === undefined || !sym.exported || !isTypeSymbol(sym.kind)) {
      ctx.bag.addError(
        DiagCode.ImportNonExported,
        node.span,
        `'${typeName}' is not an exported type of module '${modulePath}'`,
      );
      return ERROR_TYPE;
    }
    return sym.type;
  }

  const sym = ctx.moduleScope.symbols.get(name);
  if (sym === undefined || !isTypeSymbol(sym.kind)) {
    ctx.bag.addError(DiagCode.UnknownType, node.span, `Unknown type '${name}'`);
    return ERROR_TYPE;
  }
  return sym.type;
}

/** True for the symbol kinds that name a type. */
function isTypeSymbol(kind: string): boolean {
  return kind === "struct" || kind === "enum";
}

/**
 * Evaluates an array type's size (literal sizes for now — constant
 * expressions land with the const/type engine). Emits and returns `null` on
 * an invalid size; an unsized `[]` resolves to 0 here and the annotation
 * pass decides whether an initialiser justifies it.
 */
function resolveArraySize(
  node: Extract<TypeNode, { kind: "ArrayType" }>,
  ctx: { readonly bag: DiagnosticBag },
): number | null {
  if (node.size === null) return 0; // unsized `[]` — validated at the annotation
  if (node.size.kind !== "NumericLitExpr") {
    ctx.bag.addError(
      DiagCode.ArraySizeNotConst,
      node.size.span,
      "Array size must be a compile-time constant",
    );
    return null;
  }
  if (node.size.value < 1) {
    ctx.bag.addError(DiagCode.ArraySizeZero, node.size.span, "Array size must be at least 1");
    return null;
  }
  return node.size.value;
}

/** The inclusive value range of an integer primitive. */
export interface IntRange {
  readonly min: number;
  readonly max: number;
}

/**
 * The inclusive representable range of an integer primitive (spec 02 TS-2), or
 * `null` for a non-integer primitive (`boolean`/`void`) or a non-primitive type.
 *
 * @param t Any semantic type.
 * @returns The `{ min, max }` range, or `null` when `t` has no integer range.
 */
export function integerRange(t: Type): IntRange | null {
  if (t.kind !== "primitive") return null;
  switch (t.name) {
    case "byte":
      return { min: 0, max: 255 };
    case "sbyte":
      return { min: -128, max: 127 };
    case "word":
      return { min: 0, max: 65535 };
    case "sword":
      return { min: -32768, max: 32767 };
    default:
      return null; // boolean / void — no integer range
  }
}
