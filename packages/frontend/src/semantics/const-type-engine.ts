/**
 * The unified const/type evaluation engine.
 *
 * Struct layouts, enum member values, module constants, and array-size
 * expressions are mutually recursive: an array size may reference a module
 * constant or `sizeof(Struct)`, a struct's size depends on its field arrays,
 * and a constant may reference `sizeof`/`offsetof`/`length` or enum members.
 * This engine evaluates all of them lazily and memoised, with ONE ordered
 * in-progress stack spanning the domains, so any definition cycle is
 * detected exactly and reported ONCE with the full path:
 *
 * - a pure struct-field cycle → E10165 (a self-reference is a 1-cycle);
 * - any cycle a constant participates in → E10194.
 *
 * Every participant of a reported cycle is poisoned (memoised as failed) so
 * dependents stay silent — one root cause per cycle. Memoisation bounds the
 * total work linearly in declarations + fields, so adversarial inputs cannot
 * blow up evaluation; there is no depth constant.
 *
 * Division of diagnostic labor: the engine owns cycle reports and the
 * declaration-shape diagnostics of layouts/enums (duplicate fields/members
 * E10003, `void` fields E10156, unknown field types E10151, non-const member
 * values E10230, out-of-range values E10143). It stays SILENT about a
 * constant's own initialiser problems — the typing pass owns E10193/E10084/
 * E10082 with full width-aware folding; the engine's constant evaluation is
 * the width-insensitive subset those recursive demands need.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { byteSize, DiagCode, ERROR_TYPE, primitive } from "@blend65/core";
import type { CharEncoder } from "@blend65/core/platform";
import { encoderFor } from "@blend65/core/platform";
import type {
  AstNode,
  ConstDeclNode,
  DiagnosticBag,
  EnumType,
  ExprNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  ModuleDeclNode,
  ParameterNode,
  Scope,
  SourceSpan,
  StructType,
  Symbol,
  Type,
  TypeNode,
} from "@blend65/core";
import { evalConst } from "./const-eval.js";
import type { ConstEvalResult, ConstIntrinsicFolder, ConstRefResolver } from "./const-eval.js";
import type { ModuleTypeRegistry } from "./declaration-collection.js";

/** The engine's evaluation result for a size/const expression. */
export type EngineValue =
  /** A folded compile-time value. */
  | { readonly kind: "value"; readonly value: number | boolean }
  /** Not a constant expression — the demanding position reports loudly. */
  | { readonly kind: "nonconst" }
  /** Failed for an already-reported reason (cycle, poisoned ref) — stay silent. */
  | { readonly kind: "poisoned" };

/** One frame of the cross-domain in-progress stack. */
interface StackFrame {
  readonly key: string;
  /** The human-readable path label (`N`, `S`, …). */
  readonly label: string;
  /** `true` when this frame is a `const:` demand (cycle classification). */
  readonly isConst: boolean;
}

/** Everything the engine needs at construction. */
export interface EngineInput {
  /** Module name → its registered struct/enum declarations + scope. */
  readonly registries: ReadonlyMap<string, ModuleTypeRegistry>;
  /** User-module name → its shared module scope. */
  readonly moduleScopes: ReadonlyMap<string, Scope>;
  /** The FQN tables to fill (the very instances the model exposes). */
  readonly structTypes: Map<string, StructType>;
  readonly enumTypes: Map<string, EnumType>;
  /** The diagnostic accumulator. */
  readonly bag: DiagnosticBag;
  /**
   * The character encoder for string/char literals. Absent (direct
   * construction in tests / non-compiler hosts) ⇒ the raw-ASCII encoder,
   * the same deterministic default the analyzer derives without a profile.
   */
  readonly encoder?: CharEncoder;
}

/**
 * The unified lazy const/type engine. Construct once per analysis (after
 * imports are bound), call {@link ConstTypeEngine.driveAll} from the
 * type-resolution pass, and share the instance with annotation resolution
 * and the typing pass.
 */
export class ConstTypeEngine {
  private readonly registries: ReadonlyMap<string, ModuleTypeRegistry>;
  private readonly moduleScopes: ReadonlyMap<string, Scope>;
  private readonly structTypes: Map<string, StructType>;
  private readonly enumTypes: Map<string, EnumType>;
  private readonly bag: DiagnosticBag;

  /** The character encoder shared by const evaluation and the typing pass. */
  readonly encoder: CharEncoder;

  /** Memo: layout/enum FQN → resolved type, or null when poisoned. */
  private readonly layoutMemo = new Map<string, StructType | null>();
  private readonly enumMemo = new Map<string, EnumType | null>();
  /** Memo: const symbol → its folded value, or null when poisoned/nonconst. */
  private readonly constMemo = new Map<Symbol, number | boolean | null>();
  /** The ordered cross-domain in-progress stack. */
  private readonly stack: StackFrame[] = [];
  private readonly inStack = new Set<string>();
  /** Keys already reported (or poisoned) by a cycle — never re-reported. */
  private readonly cyclePoisoned = new Set<string>();

  /** Const symbols poisoned by a reported cycle — typing skips them. */
  readonly poisonedConsts = new Set<Symbol>();

  constructor(input: EngineInput) {
    this.registries = input.registries;
    this.moduleScopes = input.moduleScopes;
    this.structTypes = input.structTypes;
    this.enumTypes = input.enumTypes;
    this.bag = input.bag;
    this.encoder = input.encoder ?? encoderFor(undefined);
  }

  /**
   * Drives every declared struct, enum, and module constant exhaustively in
   * module order, then declaration order — so all cycle/validation
   * diagnostics surface deterministically even for types nothing references.
   * Also patches each struct/enum symbol's placeholder type in place.
   */
  driveAll(): void {
    for (const [moduleName, registry] of this.registries) {
      for (const name of registry.structs.keys()) this.structLayout(moduleName, name);
      for (const name of registry.enums.keys()) this.enumValues(moduleName, name);
      for (const sym of registry.scope.symbols.values()) {
        if (sym.scope !== registry.scope) continue; // import alias — its declarer drives it
        if (sym.kind === "constant") this.constValue(sym);
      }
    }
    // Patch the type symbols now every layout is computed (or poisoned).
    for (const [moduleName, registry] of this.registries) {
      for (const name of registry.structs.keys()) {
        const sym = registry.scope.symbols.get(name);
        const layout = this.structTypes.get(`${moduleName}.${name}`);
        if (sym !== undefined && sym.kind === "struct" && layout !== undefined) sym.type = layout;
      }
      for (const name of registry.enums.keys()) {
        const sym = registry.scope.symbols.get(name);
        const values = this.enumTypes.get(`${moduleName}.${name}`);
        if (sym !== undefined && sym.kind === "enum" && values !== undefined) sym.type = values;
      }
    }
  }

  /** The resolved layout of `Module.Name`, or `null` (poisoned/unknown). */
  structLayout(moduleName: string, name: string): StructType | null {
    const fqn = `${moduleName}.${name}`;
    const memo = this.layoutMemo.get(fqn);
    if (memo !== undefined) return memo;
    const decl = this.registries.get(moduleName)?.structs.get(name);
    if (decl === undefined) return null;

    const key = `structLayout:${fqn}`;
    if (this.inStack.has(key)) {
      this.reportCycle(key);
      return null;
    }
    if (this.cyclePoisoned.has(key)) {
      this.layoutMemo.set(fqn, null);
      return null;
    }

    this.stack.push({ key, label: name, isConst: false });
    this.inStack.add(key);
    const fields = new Map<string, { type: Type; offset: number }>();
    let offset = 0;
    let poisoned = false;
    for (const field of decl.fields) {
      if (fields.has(field.name)) {
        this.bag.addError(
          DiagCode.DuplicateDecl,
          field.nameSpan,
          `Duplicate field '${field.name}' in struct '${name}'`,
        );
        continue;
      }
      const type = this.fieldType(moduleName, field.fieldType);
      if (type === null) {
        poisoned = true;
        continue;
      }
      fields.set(field.name, { type, offset });
      offset += byteSize(type);
    }
    this.stack.pop();
    this.inStack.delete(key);

    // A cycle reported somewhere under this frame poisons it too.
    if (poisoned || this.cyclePoisoned.has(key)) {
      this.layoutMemo.set(fqn, null);
      return null;
    }
    const resolved: StructType = { kind: "struct", name, decl, fields, byteSize: offset };
    this.layoutMemo.set(fqn, resolved);
    this.structTypes.set(fqn, resolved);
    return resolved;
  }

  /** The resolved member values of enum `Module.Name`, or `null`. */
  enumValues(moduleName: string, name: string): EnumType | null {
    const fqn = `${moduleName}.${name}`;
    const memo = this.enumMemo.get(fqn);
    if (memo !== undefined) return memo;
    const decl = this.registries.get(moduleName)?.enums.get(name);
    if (decl === undefined) return null;

    const key = `enumValues:${fqn}`;
    if (this.inStack.has(key)) {
      this.reportCycle(key);
      return null;
    }
    if (this.cyclePoisoned.has(key)) {
      this.enumMemo.set(fqn, null);
      return null;
    }

    this.stack.push({ key, label: name, isConst: false });
    this.inStack.add(key);
    const scope = this.registries.get(moduleName)?.scope;
    const members = new Map<string, number>();
    let next = 0;
    for (const member of decl.members) {
      if (members.has(member.name)) {
        this.bag.addError(
          DiagCode.DuplicateDecl,
          member.nameSpan,
          `Duplicate member '${member.name}' in enum '${name}'`,
        );
        continue;
      }
      if (member.value !== null) {
        const result = scope !== undefined ? this.evalExpr(member.value, scope) : null;
        if (result?.kind === "value" && typeof result.value === "number") {
          next = result.value;
        } else if (result?.kind === "poisoned") {
          members.set(member.name, 0);
          next = 1;
          continue; // root cause already reported
        } else {
          this.bag.addError(
            DiagCode.EnumValueNotConst,
            member.value.span,
            `Enum member '${member.name}' must have a compile-time constant value`,
          );
          members.set(member.name, 0);
          next = 1;
          continue;
        }
      }
      if (next < 0 || next > 255) {
        this.bag.addError(
          DiagCode.EnumBackingOutOfRange,
          member.nameSpan,
          `Enum member '${member.name}' has backing value ${next} — enum values must fit 0..255`,
        );
        members.set(member.name, 0);
        next = 1;
        continue;
      }
      members.set(member.name, next);
      next += 1;
    }
    this.stack.pop();
    this.inStack.delete(key);

    if (this.cyclePoisoned.has(key)) {
      this.enumMemo.set(fqn, null);
      return null;
    }
    const resolved: EnumType = { kind: "enum", name, decl, members };
    this.enumMemo.set(fqn, resolved);
    this.enumTypes.set(fqn, resolved);
    return resolved;
  }

  /** The folded value of a module constant, or `null` (poisoned/nonconst). */
  constValue(sym: Symbol): number | boolean | null {
    const memo = this.constMemo.get(sym);
    if (memo !== undefined) return memo;
    const decl = sym.decl;
    if (decl.kind !== "ConstDecl") return null;

    const key = `const:${this.moduleOf(sym.scope)}.${sym.name}`;
    if (this.inStack.has(key)) {
      this.reportCycle(key);
      return null;
    }
    if (this.cyclePoisoned.has(key)) {
      this.constMemo.set(sym, null);
      this.poisonedConsts.add(sym);
      return null;
    }

    this.stack.push({ key, label: sym.name, isConst: true });
    this.inStack.add(key);
    const result = this.evalExpr((decl as ConstDeclNode).initialiser, sym.scope);
    this.stack.pop();
    this.inStack.delete(key);

    if (this.cyclePoisoned.has(key)) {
      this.constMemo.set(sym, null);
      this.poisonedConsts.add(sym);
      return null;
    }
    const value = result?.kind === "value" ? result.value : null;
    this.constMemo.set(sym, value);
    return value;
  }

  /**
   * Evaluates a size/const expression as seen from `scope` (a module or
   * function scope — resolution walks the parent chain). Width-insensitive:
   * the typing pass re-evaluates constant DECLARATIONS with full width-aware
   * folding; this entry serves recursive demands (sizes, member values).
   */
  evalExpr(expr: ExprNode, scope: Scope): EngineValue | null {
    let sawPoison = false;
    const resolveRef: ConstRefResolver = (ref) => {
      const resolved = this.resolveRef(ref, scope);
      if (resolved.kind === "poisoned") sawPoison = true;
      return resolved;
    };
    const result = evalConst(expr, resolveRef, undefined, this.intrinsicFolder(scope));
    if (result.kind === "value") return { kind: "value", value: result.value };
    if (result.kind === "poisonedRef" || sawPoison) return { kind: "poisoned" };
    return { kind: "nonconst" };
  }

  /**
   * The injected `sizeof`/`offsetof`/`length` folder (shared with the typing
   * pass so constant initialisers fold query results too).
   */
  intrinsicFolder(scope: Scope): ConstIntrinsicFolder {
    return (expr) => this.foldQueryIntrinsic(expr, scope);
  }

  /** Folds one query intrinsic, or returns `null` for non-query intrinsics. */
  private foldQueryIntrinsic(expr: IntrinsicCallExprNode, scope: Scope): ConstEvalResult | null {
    switch (expr.name) {
      case "sizeof": {
        if (expr.typeArg === null) return { kind: "nonConst" };
        const size = this.sizeOfTypeNode(expr.typeArg, scope);
        return size === null ? { kind: "poisonedRef" } : { kind: "value", value: size };
      }
      case "offsetof": {
        if (expr.typeArg === null || expr.fieldArg === null) return { kind: "nonConst" };
        const layout = this.namedLayout(expr.typeArg, scope);
        const offset = layout?.fields.get(expr.fieldArg.name)?.offset;
        return offset === undefined ? { kind: "nonConst" } : { kind: "value", value: offset };
      }
      case "length": {
        const size = this.lengthOf(expr.args[0], scope);
        return size === null ? { kind: "nonConst" } : { kind: "value", value: size };
      }
      default:
        return null; // lo/hi — the built-in folding owns them
    }
  }

  /** The byte size a `sizeof` type argument denotes, or `null` when poisoned. */
  private sizeOfTypeNode(node: TypeNode, scope: Scope): number | null {
    switch (node.kind) {
      case "PrimitiveType":
        return byteSize(primitive(node.name));
      case "NamedType": {
        const sym = this.lookupTypeSymbol(node.name, scope);
        if (sym === null) return null;
        if (sym.kind === "enum") return 1;
        const layout = this.structLayout(this.moduleOf(sym.scope), sym.name);
        return layout === null ? null : layout.byteSize;
      }
      case "ArrayType": {
        const element = this.sizeOfTypeNode(node.elementType, scope);
        if (element === null || node.size === null) return null;
        const size = this.evalExpr(node.size, scope);
        if (size?.kind !== "value" || typeof size.value !== "number") return null;
        return element * size.value;
      }
      default:
        return null;
    }
  }

  /** The struct layout a type argument names, or `null`. */
  private namedLayout(node: TypeNode, scope: Scope): StructType | null {
    if (node.kind !== "NamedType") return null;
    const sym = this.lookupTypeSymbol(node.name, scope);
    if (sym === null || sym.kind !== "struct") return null;
    return this.structLayout(this.moduleOf(sym.scope), sym.name);
  }

  /**
   * The element count `length(x)` denotes: `x` names a fixed-size array —
   * a variable/constant with a sized (or element-list-inferred) annotation,
   * or a PARAMETER with a sized array annotation. Unsized parameters have no
   * length (`null` — the caller passes one explicitly).
   */
  private lengthOf(arg: ExprNode | undefined, scope: Scope): number | null {
    const sym = this.arraySymbolOf(arg, scope);
    const decl = sym?.decl;
    if (decl === undefined) return null;

    if (decl.kind === "Parameter") {
      const annotation = (decl as ParameterNode).paramType;
      if (annotation.kind !== "ArrayType" || annotation.size === null) return null;
      const size = this.evalExpr(annotation.size, scope);
      return size?.kind === "value" && typeof size.value === "number" ? size.value : null;
    }

    if (!isVarDecl(decl)) return null;
    const annotation = decl.declaredType;
    if (annotation === null || annotation.kind !== "ArrayType") return null;
    if (annotation.size === null) {
      // An unsized declaration's size is its full element-list initialiser's
      // count (the same inference the declaration itself receives); reading
      // the initialiser keeps this fold independent of pass ordering.
      const init = decl.initialiser;
      if (
        init !== null &&
        init.kind === "ArrayLitExpr" &&
        init.fill === null &&
        init.elements.length > 0
      ) {
        return init.elements.length;
      }
      return null;
    }
    const size = this.evalExpr(annotation.size, scope);
    return size?.kind === "value" && typeof size.value === "number" ? size.value : null;
  }

  /** Resolves `length`'s argument (`arr` / `Mod.arr`) to its symbol. */
  private arraySymbolOf(arg: ExprNode | undefined, scope: Scope): Symbol | null {
    if (arg === undefined) return null;
    if (arg.kind === "IdentExpr") return this.lookupChain(arg.name, scope);
    if (arg.kind === "FieldAccessExpr" && arg.object.kind === "IdentExpr") {
      const sourceScope = this.moduleScopes.get(arg.object.name);
      const sym = sourceScope?.symbols.get(arg.field);
      return sym !== undefined && sym.exported ? sym : null;
    }
    return null;
  }

  /** Resolves a name reference during constant evaluation. */
  private resolveRef(
    ref: Parameters<ConstRefResolver>[0],
    scope: Scope,
  ): ReturnType<ConstRefResolver> {
    if (ref.kind === "IdentExpr") {
      const sym = this.lookupChain(ref.name, scope);
      if (sym === null) return { kind: "nonconst" };
      if (sym.kind !== "constant") return { kind: "nonconst" };
      const value = this.constValue(sym);
      return value === null ? { kind: "poisoned" } : { kind: "value", value };
    }
    // FieldAccess: `Mod.constName` or `Enum.MEMBER`.
    if (ref.object.kind !== "IdentExpr") return { kind: "nonconst" };
    const head = ref.object.name;

    const headSym = this.lookupChain(head, scope);
    if (headSym !== undefined && headSym !== null && headSym.kind === "enum") {
      const values = this.enumValues(this.moduleOf(headSym.scope), headSym.name);
      if (values === null) return { kind: "poisoned" };
      const member = values.members.get(ref.field);
      return member === undefined ? { kind: "nonconst" } : { kind: "value", value: member };
    }

    const sourceScope = this.moduleScopes.get(head);
    const sym = sourceScope?.symbols.get(ref.field);
    if (sym === undefined || !sym.exported) return { kind: "nonconst" };
    if (sym.kind === "constant") {
      const value = this.constValue(sym);
      return value === null ? { kind: "poisoned" } : { kind: "value", value };
    }
    return { kind: "nonconst" };
  }

  /** Scope-chain lookup (function scope → module → global). */
  private lookupChain(name: string, scope: Scope): Symbol | null {
    let current: Scope | null = scope;
    while (current !== null) {
      const sym = current.symbols.get(name);
      if (sym !== undefined) return sym;
      current = current.parent;
    }
    return null;
  }

  /** Resolves a (possibly dotted) type name to its struct/enum symbol. */
  private lookupTypeSymbol(name: string, scope: Scope): Symbol | null {
    const dot = name.lastIndexOf(".");
    if (dot >= 0) {
      const sourceScope = this.moduleScopes.get(name.slice(0, dot));
      const sym = sourceScope?.symbols.get(name.slice(dot + 1));
      if (sym === undefined || !sym.exported) return null;
      return sym.kind === "struct" || sym.kind === "enum" ? sym : null;
    }
    const sym = this.lookupChain(name, scope);
    if (sym === null) return null;
    return sym.kind === "struct" || sym.kind === "enum" ? sym : null;
  }

  /** Resolves a field's type node during layout computation. */
  private fieldType(moduleName: string, node: TypeNode): Type | null {
    switch (node.kind) {
      case "PrimitiveType": {
        if (node.name === "void") {
          this.bag.addError(
            DiagCode.VoidTypeNotAllowed,
            node.span,
            "'void' is not a value type — a struct field cannot be 'void'",
          );
          return ERROR_TYPE;
        }
        return primitive(node.name);
      }
      case "NamedType": {
        const scope = this.registries.get(moduleName)?.scope;
        const sym = scope !== undefined ? this.lookupTypeSymbol(node.name, scope) : null;
        if (sym === null) {
          this.bag.addError(DiagCode.UnknownType, node.span, `Unknown type '${node.name}'`);
          return ERROR_TYPE;
        }
        if (sym.kind === "enum") {
          const values = this.enumValues(this.moduleOf(sym.scope), sym.name);
          return values ?? null;
        }
        return this.structLayout(this.moduleOf(sym.scope), sym.name);
      }
      case "ArrayType": {
        const element = this.fieldType(moduleName, node.elementType);
        if (element === null || element.kind === "error") return element;
        if (node.size === null) {
          this.bag.addError(
            DiagCode.ArraySizeNotConst,
            node.span,
            "A struct field array needs an explicit size",
          );
          return ERROR_TYPE;
        }
        const scope = this.registries.get(moduleName)?.scope;
        const size = scope !== undefined ? this.evalExpr(node.size, scope) : null;
        if (size?.kind === "poisoned") return null; // cycle under this size
        if (size?.kind !== "value" || typeof size.value !== "number") {
          this.bag.addError(
            DiagCode.ArraySizeNotConst,
            node.size.span,
            "Array size must be a compile-time constant",
          );
          return ERROR_TYPE;
        }
        if (size.value < 1) {
          this.bag.addError(DiagCode.ArraySizeZero, node.size.span, "Array size must be at least 1");
          return ERROR_TYPE;
        }
        return { kind: "array", element, size: size.value };
      }
      default:
        return ERROR_TYPE;
    }
  }

  /** Reports ONE cycle (the stack slice from the re-entered key) and poisons it. */
  private reportCycle(reenteredKey: string): void {
    const start = this.stack.findIndex((f) => f.key === reenteredKey);
    if (start < 0) return;
    const frames = this.stack.slice(start);
    for (const frame of frames) this.cyclePoisoned.add(frame.key);

    const anchor = frames[0]!;
    const path = [...frames.map((f) => f.label), anchor.label].join(" → ");
    const constInvolved = frames.some((f) => f.isConst);
    if (constInvolved) {
      this.bag.addError(
        DiagCode.CircularInit,
        this.spanOfFrame(anchor),
        `Circular initializer detected — '${anchor.label}' depends on itself ` +
          `(directly or indirectly) — cycle: ${path}`,
      );
    } else {
      this.bag.addError(
        DiagCode.RecursiveStructLayout,
        this.spanOfFrame(anchor),
        `Recursive struct layout — '${anchor.label}' contains itself ` +
          `(directly or indirectly), so its size is undefined — cycle: ${path}`,
      );
    }
  }

  /** The best span for a cycle anchor frame (its declaration's name). */
  private spanOfFrame(frame: StackFrame): SourceSpan | null {
    const [domain, fqn] = frame.key.split(":") as [string, string];
    const dot = fqn.lastIndexOf(".");
    const moduleName = fqn.slice(0, dot);
    const name = fqn.slice(dot + 1);
    const registry = this.registries.get(moduleName);
    if (registry === undefined) return null;
    if (domain === "structLayout") return registry.structs.get(name)?.nameSpan ?? null;
    if (domain === "enumValues") return registry.enums.get(name)?.nameSpan ?? null;
    const sym = registry.scope.symbols.get(name);
    return sym !== undefined && sym.decl.kind === "ConstDecl"
      ? (sym.decl as ConstDeclNode).initialiser.span
      : null;
  }

  /** The declaring module's name for a module scope. */
  private moduleOf(scope: Scope): string {
    const node = scope.node;
    return node !== null && node.kind === "ModuleDecl" ? (node as ModuleDeclNode).name : "";
  }
}

/** Narrows a symbol's declaring node to a let/const declaration. */
function isVarDecl(node: AstNode): node is LetDeclNode | ConstDeclNode {
  return node.kind === "LetDecl" || node.kind === "ConstDecl";
}
