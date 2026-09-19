import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { CallEdge, SemanticBinding } from "./semantic-types.js";

/** Return a source-facing function name without its module prefix. */
function displayName(binding: SemanticBinding): string {
  return binding.qualifiedName?.split(".").at(-1) ?? binding.name;
}

/**
 * Detect direct-call recursion and return one deterministic diagnostic per
 * distinct cycle. Nested acyclic calls remain ordinary edges.
 */
export function recursionDiagnostics(
  calls: readonly CallEdge[],
  bindings: readonly SemanticBinding[],
): readonly ProjectDiagnostic[] {
  const functions = bindings.filter((binding) => binding.storage === "function");
  const byKey = new Map(functions.map((binding) => [bindingIdentityKey(binding.id), binding]));
  const outgoing = new Map<string, CallEdge[]>();
  for (const call of calls) {
    const key = bindingIdentityKey(call.caller);
    const edges = outgoing.get(key) ?? [];
    edges.push(call);
    outgoing.set(key, edges);
  }

  const diagnostics: ProjectDiagnostic[] = [];
  const emitted = new Set<string>();
  for (const functionBinding of functions) {
    findCycles(
      bindingIdentityKey(functionBinding.id),
      outgoing,
      byKey,
      [],
      [],
      new Set<string>(),
      emitted,
      diagnostics,
    );
  }
  return Object.freeze(diagnostics);
}

/** Walk one direct-call path and report a back edge with its complete edge sequence. */
function findCycles(
  current: string,
  outgoing: ReadonlyMap<string, readonly CallEdge[]>,
  bindings: ReadonlyMap<string, SemanticBinding>,
  nodes: readonly string[],
  edges: readonly CallEdge[],
  active: ReadonlySet<string>,
  emitted: Set<string>,
  diagnostics: ProjectDiagnostic[],
): void {
  if (active.has(current)) return;
  const nextNodes = [...nodes, current];
  const nextActive = new Set(active);
  nextActive.add(current);
  for (const edge of outgoing.get(current) ?? []) {
    const callee = bindingIdentityKey(edge.callee);
    const cycleStart = nextNodes.indexOf(callee);
    if (cycleStart >= 0) {
      emitCycle(
        [...nextNodes.slice(cycleStart), callee],
        [...edges.slice(cycleStart), edge],
        bindings,
        emitted,
        diagnostics,
      );
      continue;
    }
    findCycles(
      callee,
      outgoing,
      bindings,
      nextNodes,
      [...edges, edge],
      nextActive,
      emitted,
      diagnostics,
    );
  }
}

/** Canonicalize and emit one direct or indirect recursion diagnostic. */
function emitCycle(
  nodes: readonly string[],
  edges: readonly CallEdge[],
  bindings: ReadonlyMap<string, SemanticBinding>,
  emitted: Set<string>,
  diagnostics: ProjectDiagnostic[],
): void {
  const bodyNodes = nodes.slice(0, -1);
  const rotations = bodyNodes.map((_, index) => [
    ...bodyNodes.slice(index),
    ...bodyNodes.slice(0, index),
  ]);
  rotations.sort((left, right) => left.join("\0").localeCompare(right.join("\0")));
  const canonical = rotations[0]?.join("→") ?? "";
  if (emitted.has(canonical)) return;
  emitted.add(canonical);

  const first = bindings.get(nodes[0] ?? "");
  if (first === undefined || edges[0] === undefined) return;
  if (bodyNodes.length === 1) {
    diagnostics.push(
      projectDiagnostic(
        "E10180",
        `Direct recursion — function '${displayName(first)}' calls itself; use iteration or an explicit fixed-capacity work structure`,
        edges[0].span,
      ),
    );
    return;
  }

  const names = nodes.map((node) => {
    const binding = bindings.get(node);
    return binding === undefined ? "<unknown>" : displayName(binding);
  });
  diagnostics.push(
    projectDiagnostic(
      "E10181",
      `Indirect recursion detected — cycle: ${names.join(" → ")}`,
      edges[0].span,
      null,
      edges.map((edge) => Object.freeze({ span: edge.span, message: "Call edge in cycle" })),
    ),
  );
}
