/**
 * The single wiring seam between the semantic model and the SFA planner (spec
 * Ch 11).
 *
 * `modelToFunctionInfo` projects a populated {@link SemanticModel} into the flat
 * {@link FunctionInfo}[] the planner consumes. This is the **only** place the
 * "semantic checker not yet wired" deferral lived: every SFA algorithm operates on
 * `FunctionInfo` fixtures and is fully implemented and tested, so filling in this
 * adapter wires real functions to the planner without touching any SFA pass.
 *
 * Currently implements the scalar surface (functions + local scalars). Under the
 * empty passthrough model (`createEmptyModel()`) it still returns `[]` — an empty
 * `callGraph.functions` projects to an empty array.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen`.
 */

import { byteSize, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  CallExprNode,
  FrameVar,
  FunctionInfo,
  ModuleDeclNode,
  Scope,
  SemanticModel,
  Symbol,
} from "@blend65/core";
import type { ModuleVarInput } from "./zp-allocator.js";

/**
 * Projects a populated {@link SemanticModel} into the planner's
 * {@link FunctionInfo}[].
 *
 * One entry per function in `model.callGraph.functions`: the module-qualified
 * FQN for `name`; parameters = the body scope's `parameter` symbols in
 * declaration order (placed first in the frame); locals = its `variable`
 * symbols in declaration order; callees = the call graph's outgoing edges as
 * sorted FQNs; interrupt handlers flagged; `argWindowInterferes` = everything
 * reachable from calls nested in later arguments at this function's call
 * sites (see {@link computeArgWindows}). `isEscaped` stays `false` (no
 * address-of support yet) and `isReachable` stays `true` (liveness analysis
 * arrives later — an unreachable function costs frame bytes, which is correct
 * but unoptimized). Returns `[]` for the empty passthrough model.
 *
 * @param model The semantic model to project.
 * @returns The projected functions (`[]` under the empty passthrough).
 */
export function modelToFunctionInfo(model: SemanticModel): FunctionInfo[] {
  const windows = computeArgWindows(model);
  const result: FunctionInfo[] = [];
  for (const fn of model.callGraph.functions) {
    const scope = model.scopeOf(fn.decl); // the function body scope
    const callees = [...(model.callGraph.edges.get(fn) ?? [])].map(fqName).sort();
    const window = windows.get(fn);
    result.push({
      name: fqName(fn), // "<Module>.<function>"
      parameters: collectFrameVars(scope, "parameter"),
      locals: collectFrameVars(scope, "variable"),
      isInterrupt: fn.kind === "interrupt",
      isEscaped: false, // `&fn` address-of support arrives later
      isReachable: true, // liveness analysis arrives later; main is reachable
      callees,
      argWindowInterferes: window === undefined ? [] : [...window].sort(),
    });
  }
  return result;
}

/**
 * Computes each function's argument-window interference set.
 *
 * When a call `C(a1, …, aN)` is lowered, arguments are stored into `C`'s
 * frame slots one at a time; a call nested in any argument AFTER the first
 * executes while earlier arguments already sit in `C`'s frame. Everything
 * reachable from such a nested call must therefore never share frame bytes
 * with `C`. The first argument is exempt — nothing is stored before it.
 *
 * For every call site of `C` in any function body, every nested call `G(…)`
 * inside arguments 2..N contributes `reach(G)` (a visited-set-bounded DFS
 * over the call graph — terminates on any input, cyclic included, as
 * defense in depth; cycles are rejected upstream) to `C`'s set, keyed by
 * fully-qualified name. Deterministic: callers sort + dedupe on projection.
 *
 * @param model The semantic model (bodies, symbols, call graph).
 * @returns Per-callee sets of FQNs that may run during argument marshalling.
 */
function computeArgWindows(model: SemanticModel): Map<Symbol, Set<string>> {
  const windows = new Map<Symbol, Set<string>>();

  for (const fn of model.callGraph.functions) {
    for (const call of collectCalls(fn.decl)) {
      const callee = userCalleeOf(call, model);
      if (callee === null || call.args.length < 2) continue;

      for (const arg of call.args.slice(1)) {
        for (const nested of collectCalls(arg)) {
          const nestedCallee = userCalleeOf(nested, model);
          if (nestedCallee === null) continue;
          let window = windows.get(callee);
          if (window === undefined) {
            window = new Set();
            windows.set(callee, window);
          }
          for (const reached of reach(nestedCallee, model)) {
            window.add(fqName(reached));
          }
        }
      }
    }
  }
  return windows;
}

/**
 * The resolved user-function symbol a call targets, or `null`. Both callee
 * shapes — a bare identifier and a qualified `Module.member` access — carry
 * their resolved symbol in the model's symbol map, so one lookup serves both.
 */
function userCalleeOf(call: CallExprNode, model: SemanticModel): Symbol | null {
  const kind = call.callee.kind;
  if (kind !== "IdentExpr" && kind !== "FieldAccessExpr") return null;
  const sym = model.symbolOf(call.callee);
  return sym !== null && sym.kind === "function" ? sym : null;
}

/**
 * Everything reachable from `start` along call edges, INCLUDING `start`
 * itself (the nested callee runs too). Visited-set-bounded: terminates on
 * any graph, cyclic included.
 */
function reach(start: Symbol, model: SemanticModel): Set<Symbol> {
  const visited = new Set<Symbol>([start]);
  const stack: Symbol[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    for (const callee of model.callGraph.edges.get(current) ?? []) {
      if (visited.has(callee)) continue;
      visited.add(callee);
      stack.push(callee);
    }
  }
  return visited;
}

/** Collects every plain call expression in a subtree (uniform visitor walk). */
function collectCalls(root: AstNode): CallExprNode[] {
  const found: CallExprNode[] = [];
  const visit = (node: AstNode): void => {
    if (node.kind === "CallExpr") {
      found.push(node as CallExprNode);
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}

/**
 * Projects the module-scope scalar `variable` symbols of a populated
 * {@link SemanticModel} into the planner's {@link ModuleVarInput}[]. One entry per
 * `kind: "variable"` symbol in each module scope (`globalScope.children`),
 * carrying its module name, variable name, resolved type, and `byteSize`.
 * Functions and constants are excluded (only RAM-backed variables get a
 * `__var_*` slot). Deterministic order = module order × declaration order.
 * Returns `[]` for the empty passthrough model.
 *
 * @param model The semantic model to project.
 * @returns The module variables as planner inputs (`[]` when there are none).
 */
export function modelToModuleVars(model: SemanticModel): ModuleVarInput[] {
  const result: ModuleVarInput[] = [];
  for (const moduleScope of model.globalScope.children) {
    if (moduleScope.kind !== "module") continue;
    const modNode = moduleScope.node;
    const moduleName = isModuleDecl(modNode) ? modNode.name : "";
    for (const sym of moduleScope.symbols.values()) {
      if (sym.kind !== "variable") continue; // functions / constants are not RAM-backed
      // An imported variable is the SAME symbol aliased into the importing
      // scope — only its declaring module projects a RAM slot; a second
      // (importer-side) slot would double-count the variable in the layout.
      if (sym.scope !== moduleScope) continue;
      result.push({
        moduleName,
        variableName: sym.name,
        type: sym.type,
        size: byteSize(sym.type),
      });
    }
  }
  return result;
}

/** Narrows a scope's introducing node to a {@link ModuleDeclNode}. */
function isModuleDecl(node: AstNode | null): node is ModuleDeclNode {
  return node !== null && node.kind === "ModuleDecl";
}

/**
 * The module-qualified FQN matching the IL lowering pass's
 * `` `${moduleName}.${fn.name}` ``, so `plan.frames` is keyed identically and the
 * emitted `__frame_*` reference resolves. The module is read from the function
 * symbol's declaring **module** `Scope` (`fn.scope.node`, a `ModuleDeclNode`) —
 * model-only, no AST re-walk, no core-type change. A mis-wired module scope yields
 * a `".<fn>"` name, which the assemble-clean test catches at ACME time.
 *
 * @param fn The function symbol.
 * @returns The fully-qualified `Module.function` name.
 */
function fqName(fn: Symbol): string {
  const modNode = fn.scope.node; // the declaring ModuleDeclNode
  const moduleName = isModuleDecl(modNode) ? modNode.name : "";
  return `${moduleName}.${fn.name}`;
}

/**
 * Reads a scope's symbols of `kind` as ordered {@link FrameVar}[] (Map
 * insertion order == declaration order; parameters are inserted before
 * locals at collection). Scalars are never by-reference.
 *
 * @param scope The function body scope.
 * @param kind The symbol kind to project (`"parameter"` or `"variable"`).
 * @returns The matching symbols as frame variables, in declaration order.
 */
function collectFrameVars(scope: Scope, kind: "parameter" | "variable"): FrameVar[] {
  const vars: FrameVar[] = [];
  for (const sym of scope.symbols.values()) {
    if (sym.kind === kind) {
      vars.push({ name: sym.name, type: sym.type, byRef: false });
    }
  }
  return vars;
}
