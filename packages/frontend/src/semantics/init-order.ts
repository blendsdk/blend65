/**
 * Module-variable initialization ordering (frozen spec Ch 10 §5.4).
 *
 * Every module `let` WITH an initializer occupies one position in a single
 * global initialization order. The order is per-variable dependency order: an
 * initializer that reads another initialized module variable (directly, via an
 * import alias, or via qualified `Module.member` access) runs after it.
 * Independent variables keep their base order — modules ordered by their
 * import edges (an imported module initializes before its importer; discovery
 * order breaks ties; circular imports are legal, falling back to discovery
 * order inside a cycle), then declaration order within each module (for a
 * module spanning several files: file discovery order × declaration order).
 *
 * A dependency cycle is exactly ONE circular-initializer error (E10194) per
 * cycle, anchored at the cycle's first-declared member and carrying the full
 * cycle path; its members drop from the order (the error gates codegen
 * downstream). Constants never appear here — they are compile-time values
 * with no init position; so do initializer-less variables (indeterminate
 * until assigned).
 *
 * Emit-diagnostics-never-throw; imports `@blend65/core` only.
 */

import { DiagCode, findCallCycles, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  DiagnosticBag,
  ExprNode,
  FieldAccessExprNode,
  IdentExprNode,
  Scope,
  Symbol,
} from "@blend65/core";

/** Everything {@link computeInitOrder} consumes. */
export interface InitOrderInput {
  /** The distinct modules in file-discovery order (name + shared scope). */
  readonly modules: ReadonlyArray<{ readonly name: string; readonly scope: Scope }>;
  /** Importer module name → the user-module names it imports. */
  readonly importEdges: ReadonlyMap<string, ReadonlySet<string>>;
  /** Module `let` symbols with initializers → the initializer expression. */
  readonly initializers: ReadonlyMap<Symbol, ExprNode>;
  /** Node → resolved symbol (filled by expression typing). */
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;
  /** The diagnostic accumulator (receives E10194). */
  readonly bag: DiagnosticBag;
}

/**
 * Computes the global module-variable initialization order (see the module
 * doc). Never throws.
 *
 * @param input Modules, import edges, initializers, and the symbol map.
 * @returns The initialization order — one entry per initialized variable,
 *   dependency-first; cycle members are omitted (each cycle is one E10194).
 */
export function computeInitOrder(input: InitOrderInput): readonly Symbol[] {
  // Module base order (import edges → Kahn, discovery-order priority).
  const moduleOrder = orderModules(input.modules, input.importEdges);

  // Per-variable base priority: (module order, declaration ordinal). The
  // ordinal counts only the module's OWN variables — an import alias is the
  // same symbol in another scope's map and must not mint a second ordinal.
  const priority = new Map<Symbol, number>();
  let nextPriority = 0;
  for (const { scope } of moduleOrder) {
    for (const sym of scope.symbols.values()) {
      if (sym.kind !== "variable" || sym.scope !== scope) continue;
      priority.set(sym, nextPriority++);
    }
  }

  // The ordered universe: initialized variables in base-priority order.
  const vars = [...input.initializers.keys()]
    .filter((sym) => priority.has(sym))
    .sort((a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0));

  // Dependency edges: reader → read variable (the read one initializes first).
  // Only initialized module variables form edges — constants fold at compile
  // time and initializer-less variables have no init position.
  const edges = new Map<Symbol, Set<Symbol>>();
  for (const sym of vars) {
    const init = input.initializers.get(sym);
    if (init === undefined) continue;
    const targets = new Set<Symbol>();
    for (const ref of collectNameRefs(init)) {
      const target = input.symbolMap.get(ref);
      if (target === undefined || target.kind !== "variable") continue;
      if (!input.initializers.has(target) || !priority.has(target)) continue;
      targets.add(target);
    }
    if (targets.size > 0) edges.set(sym, targets);
  }

  // ONE error per dependency cycle, anchored at its first-declared member;
  // the anchor is deterministic because `vars` is in base-priority order.
  const cycleMembers = new Set<Symbol>();
  for (const cycle of findCallCycles(new Set(vars), edges)) {
    if (cycle.length === 0) continue;
    const anchor = cycle[0];
    const path = [...cycle, anchor].map((s) => s.name).join(" → ");
    input.bag.addError(
      DiagCode.CircularInit,
      input.initializers.get(anchor)?.span ?? null,
      `Circular initializer detected — '${anchor.name}' depends on itself ` +
        `(directly or indirectly) through module-level initialization order — ` +
        `cycle: ${path}`,
    );
    for (const member of cycle) cycleMembers.add(member);
  }

  // Stable topological order: repeatedly emit the lowest-base-priority
  // variable whose dependencies are all satisfied. Cycle members are dropped;
  // a dependency on a dropped member counts as satisfied (the cycle error is
  // the root cause and gates codegen). Bounded: each pass emits one variable.
  const remaining = vars.filter((sym) => !cycleMembers.has(sym));
  const emitted = new Set<Symbol>();
  const order: Symbol[] = [];
  while (order.length < remaining.length) {
    let picked: Symbol | null = null;
    for (const sym of remaining) {
      if (emitted.has(sym)) continue;
      if (isReady(sym, edges.get(sym), emitted, cycleMembers)) {
        picked = sym;
        break;
      }
    }
    if (picked === null) break; // defensive — cycles are already excluded above
    emitted.add(picked);
    order.push(picked);
  }
  return order;
}

/** Whether every dependency of `sym` is already emitted (or dropped). */
function isReady(
  sym: Symbol,
  deps: ReadonlySet<Symbol> | undefined,
  emitted: ReadonlySet<Symbol>,
  dropped: ReadonlySet<Symbol>,
): boolean {
  if (deps === undefined) return true;
  for (const dep of deps) {
    if (dep === sym) continue; // self-edges are cycle-reported, not ordering
    if (!emitted.has(dep) && !dropped.has(dep)) return false;
  }
  return true;
}

/**
 * Orders modules so an imported module precedes its importer, with discovery
 * order as the priority among the ready set. Cycle-tolerant: circular imports
 * are legal, so when no import-satisfied module remains the earliest-
 * discovered remaining module is pulled (falling back to discovery order
 * inside the cycle). Bounded: one module is emitted per iteration.
 */
function orderModules(
  modules: ReadonlyArray<{ readonly name: string; readonly scope: Scope }>,
  importEdges: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyArray<{ readonly name: string; readonly scope: Scope }> {
  const knownNames = new Set(modules.map((m) => m.name));
  const emittedNames = new Set<string>();
  const remaining = [...modules];
  const result: { readonly name: string; readonly scope: Scope }[] = [];

  while (remaining.length > 0) {
    let index = remaining.findIndex((m) => {
      const imports = importEdges.get(m.name);
      if (imports === undefined) return true;
      for (const dep of imports) {
        if (dep === m.name || !knownNames.has(dep)) continue;
        if (!emittedNames.has(dep)) return false;
      }
      return true;
    });
    if (index === -1) index = 0; // import cycle — earliest-discovered first
    const [module] = remaining.splice(index, 1);
    emittedNames.add(module.name);
    result.push(module);
  }
  return result;
}

/**
 * Collects every name-reference expression (bare identifier or `a.b` member
 * access) in a subtree, left-to-right. The caller resolves each through the
 * symbol map — unresolved references simply resolve to nothing.
 *
 * @param root The expression to search.
 * @returns The reference expressions in source order.
 */
export function collectNameRefs(
  root: ExprNode,
): ReadonlyArray<IdentExprNode | FieldAccessExprNode> {
  const found: (IdentExprNode | FieldAccessExprNode)[] = [];
  const visit = (node: AstNode): void => {
    if (node.kind === "IdentExpr") {
      found.push(node as IdentExprNode);
    } else if (node.kind === "FieldAccessExpr") {
      found.push(node as FieldAccessExprNode);
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}
