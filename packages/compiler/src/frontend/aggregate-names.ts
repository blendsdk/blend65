import { bindingIdentityKey } from "./semantic-types.js";
import type { BindingId, ModuleGraph } from "./semantic-types.js";
import type { Declaration } from "./syntax.js";

/** A declaration found through a local, qualified, or explicitly imported source name. */
export interface ResolvedAggregateDeclaration {
  /** Stable declaration identity. */
  readonly binding: BindingId;
  /** Original source declaration. */
  readonly declaration: Declaration;
  /** Module that owns the declaration. */
  readonly module: string;
}

/** Resolve one declaration spelling without inventing a module or type alias. */
export function resolveAggregateDeclaration(
  graph: ModuleGraph,
  declarations: ReadonlyMap<string, Declaration>,
  name: string,
  module: string,
  sourceId: string,
): ResolvedAggregateDeclaration | null {
  const imported = graph.imports.find(
    (candidate) => candidate.sourceSpan.sourceId === sourceId && candidate.alias === name,
  );
  const binding =
    imported === undefined
      ? graph.bindings.find(
          ({ qualifiedName }) =>
            qualifiedName === (name.includes(".") ? name : `${module}.${name}`),
        )
      : graph.bindings.find(
          (candidate) => bindingIdentityKey(candidate.id) === bindingIdentityKey(imported.binding),
        );
  if (binding === undefined) return null;
  const declaration = declarations.get(bindingIdentityKey(binding.id));
  if (declaration === undefined) return null;
  const owner = binding.qualifiedName?.slice(0, -(binding.name.length + 1)) ?? module;
  return { binding: binding.id, declaration, module: owner };
}
