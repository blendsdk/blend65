/**
 * The symbol record for Blend65 semantic analysis.
 *
 * A {@link Symbol} is the resolved meaning of a declared name — a variable,
 * constant, function, struct, enum, parameter, enum member, or intrinsic. It
 * carries the name's resolved {@link Type}, its declaring AST node, its owning
 * {@link Scope}, and the flags downstream phases need (exported, mutable, by-ref,
 * optional constant value).
 *
 * The skeleton never *creates* symbols yet (the empty model has none); the
 * shape exists so the model contract and the future checker share one
 * representation.
 */

import type { AstNode } from "../ast/index.js";
import type { Type } from "./type.js";
import type { Scope } from "./scope.js";
import type { ConstValue } from "./const-value.js";

/** The kinds of declared entity a {@link Symbol} can represent. */
export type SymbolKind =
  | "variable"
  | "constant"
  | "function"
  | "interrupt"
  | "struct"
  | "enum"
  | "parameter"
  | "enumMember"
  | "intrinsic";

/**
 * The resolved meaning of a declared name.
 *
 * Note: this interface is intentionally named `Symbol`, shadowing the global
 * `Symbol` primitive. This is acceptable because the semantics modules do not
 * use the JS `Symbol` primitive. Consumers that need both can import this as
 * an alias (e.g. `Symbol as SemSymbol`).
 */
export interface Symbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly type: Type;
  /** The AST node that declared this symbol. */
  readonly decl: AstNode;
  /** The scope this symbol was declared in. */
  readonly scope: Scope;
  readonly exported: boolean;
  readonly mutable: boolean;
  /** Present for compile-time constants; absent otherwise. */
  readonly constValue?: ConstValue;
  /** `true` for struct-typed parameters passed by reference. */
  readonly byRef: boolean;
}
