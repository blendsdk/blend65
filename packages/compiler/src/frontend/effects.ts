import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { CallEdge, ModuleGraph, SemanticBinding } from "./semantic-types.js";
import type { Declaration, Expr, VariableDeclaration } from "./syntax.js";

/** One source declaration paired with its resolved module. */
export interface ScalarDeclarationWork {
  /** Module which owns the declaration. */
  readonly module: string;
  /** Parsed declaration to analyze. */
  readonly declaration: Declaration;
}

/** A declaration work item known to own a scalar constant. */
interface ScalarConstantWork extends ScalarDeclarationWork {
  readonly declaration: VariableDeclaration & { readonly declarationKind: "const" };
}

/** Return a source-facing function name without its module prefix. */
function displayName(binding: SemanticBinding): string {
  return binding.qualifiedName?.split(".").at(-1) ?? binding.name;
}

/** Return whether a declaration is a compile-time scalar constant. */
function isConstantDeclaration(
  declaration: Declaration,
): declaration is VariableDeclaration & { readonly declarationKind: "const" } {
  return declaration.kind === "variable" && declaration.declarationKind === "const";
}

/** Narrow a work item to a compile-time scalar constant. */
function isConstantWork(item: ScalarDeclarationWork): item is ScalarConstantWork {
  return isConstantDeclaration(item.declaration);
}

/** Collect value names read by the admitted scalar expression forms. */
function expressionNames(expression: Expr): readonly string[] {
  switch (expression.kind) {
    case "name":
      return [expression.name];
    case "unary":
    case "cast":
      return expressionNames(expression.operand);
    case "binary":
      return [...expressionNames(expression.left), ...expressionNames(expression.right)];
    case "conditional":
      return [
        ...expressionNames(expression.condition),
        ...expressionNames(expression.whenTrue),
        ...expressionNames(expression.whenFalse),
      ];
    case "assignment":
      return [...expressionNames(expression.target), ...expressionNames(expression.value)];
    case "call":
      return [
        ...expressionNames(expression.callee),
        ...expression.arguments.flatMap((argument) => expressionNames(argument)),
      ];
    default:
      return [];
  }
}

/**
 * Analyze compile-time constants before their users while preserving source
 * order for runtime declarations and functions.
 */
export function orderScalarDeclarations(graph: ModuleGraph): readonly ScalarDeclarationWork[] {
  const work: ScalarDeclarationWork[] = graph.modules.flatMap((module) =>
    module.units.flatMap((unit) =>
      unit.declarations.map((declaration) => ({ module: module.name, declaration })),
    ),
  );
  const constants = work.filter(isConstantWork);
  const byQualifiedName = new Map(
    constants.map((item) => [`${item.module}.${item.declaration.name}`, item]),
  );
  const imports = new Map(
    graph.imports.map((item) => [
      `${item.sourceSpan.sourceId}\0${item.alias}`,
      bindingIdentityKey(item.binding),
    ]),
  );
  const byBinding = new Map(
    constants.flatMap((item) => {
      const binding = graph.bindings.find(
        (candidate) =>
          candidate.qualifiedName === `${item.module}.${item.declaration.name}` &&
          candidate.id.sourceId === item.declaration.span.sourceId &&
          candidate.id.span.start === item.declaration.span.start,
      );
      return binding === undefined ? [] : [[bindingIdentityKey(binding.id), item] as const];
    }),
  );
  const ordered: ScalarDeclarationWork[] = [];
  const visited = new Set<ScalarDeclarationWork>();
  const active = new Set<ScalarDeclarationWork>();

  const visit = (item: ScalarDeclarationWork): void => {
    if (visited.has(item) || active.has(item)) return;
    active.add(item);
    const declaration = item.declaration;
    if (isConstantDeclaration(declaration) && declaration.initializer !== null) {
      for (const name of expressionNames(declaration.initializer)) {
        const imported = imports.get(`${declaration.span.sourceId}\0${name}`);
        const dependency =
          (imported === undefined ? undefined : byBinding.get(imported)) ??
          byQualifiedName.get(`${item.module}.${name}`);
        if (dependency !== undefined) visit(dependency);
      }
    }
    active.delete(item);
    visited.add(item);
    ordered.push(item);
  };

  for (const item of constants) visit(item);
  return Object.freeze([
    ...ordered,
    ...work.filter(({ declaration }) => !isConstantDeclaration(declaration)),
  ]);
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
      const cycleNodes = [...nextNodes.slice(cycleStart), callee];
      const cycleEdges = [...edges.slice(cycleStart), edge];
      emitCycle(cycleNodes, cycleEdges, bindings, emitted, diagnostics);
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
