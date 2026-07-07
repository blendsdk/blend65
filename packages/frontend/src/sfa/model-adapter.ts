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

import { byteSize } from "@blend65/core";
import type {
  AstNode,
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
 * One entry per function in `model.callGraph.functions`: the module-qualified FQN
 * for `name`; no parameters (the current surface has no user params); locals =
 * the function body scope's `variable` symbols as `FrameVar[]` in declaration
 * order; interrupt handlers flagged; escaped/unreachable/callee data is not yet
 * populated (that arrives with call-graph analysis and address-of support).
 * Returns `[]` for the empty passthrough model.
 *
 * @param model The semantic model to project.
 * @returns The projected functions (`[]` under the empty passthrough).
 */
export function modelToFunctionInfo(model: SemanticModel): FunctionInfo[] {
  const result: FunctionInfo[] = [];
  for (const fn of model.callGraph.functions) {
    const scope = model.scopeOf(fn.decl); // the function body scope
    result.push({
      name: fqName(fn), // "<Module>.<function>"
      parameters: [], // no user params yet
      locals: collectLocals(scope), // ordered FrameVar[]
      isInterrupt: fn.kind === "interrupt",
      isEscaped: false, // `&fn` address-of support arrives later
      isReachable: true, // call-graph reachability arrives later; main is reachable
      callees: [], // no calls modeled yet
    });
  }
  return result;
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
 * Reads a scope's `kind: "variable"` symbols as ordered {@link FrameVar}[] (Map
 * insertion order == declaration order). Scalars are never by-reference.
 *
 * @param scope The function body scope.
 * @returns The locals as frame variables, in declaration order.
 */
function collectLocals(scope: Scope): FrameVar[] {
  const locals: FrameVar[] = [];
  for (const sym of scope.symbols.values()) {
    if (sym.kind === "variable") {
      locals.push({ name: sym.name, type: sym.type, byRef: false });
    }
  }
  return locals;
}
