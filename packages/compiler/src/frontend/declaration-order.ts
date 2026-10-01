import { bindingIdentityKey } from "./semantic-types.js";
import { qualifiedCallName } from "./direct-calls.js";
import type { BindingId, ModuleGraph } from "./semantic-types.js";
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

/** Collect names from every value-bearing child, including aggregate construction. */
function expressionNames(expression: Expr): readonly string[] {
  switch (expression.kind) {
    case "name":
      return [expression.name];
    case "unary":
    case "cast":
    case "length":
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
    case "member": {
      const name = qualifiedCallName(expression);
      return [...(name === null ? [] : [name]), ...expressionNames(expression.object)];
    }
    case "index":
      return [...expressionNames(expression.object), ...expressionNames(expression.index)];
    case "array-literal":
      return [
        ...expression.elements,
        ...(expression.fill === null ? [] : [expression.fill]),
      ].flatMap(expressionNames);
    case "struct-literal":
      return expression.fields.flatMap(({ value }) => expressionNames(value));
    default:
      return [];
  }
}

/**
 * Analyze compile-time constants before their users while preserving source
 * order for runtime declarations and functions.
 */
export function orderScalarDeclarations(
  graph: ModuleGraph,
  functionDependencies: ReadonlyMap<string, readonly BindingId[]> = new Map(),
): readonly ScalarDeclarationWork[] {
  const work: ScalarDeclarationWork[] = graph.modules.flatMap((module) =>
    module.units.flatMap((unit) =>
      unit.declarations.map((declaration) => ({ module: module.name, declaration })),
    ),
  );
  const constants = work.filter(isConstantWork);
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
  // A rejected duplicate has no binding. It must not displace the accepted constant's
  // dependency, or its users would be checked before that constant has a value.
  const byQualifiedName = new Map(
    [...byBinding.values()].map((item) => [`${item.module}.${item.declaration.name}`, item]),
  );
  const functions = new Map(
    graph.bindings.flatMap((binding) =>
      binding.storage === "function" && binding.qualifiedName !== null
        ? [[binding.qualifiedName, bindingIdentityKey(binding.id)] as const]
        : [],
    ),
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
          byQualifiedName.get(name.includes(".") ? name : `${item.module}.${name}`);
        if (dependency !== undefined) visit(dependency);
        const functionKey =
          imported ?? functions.get(name.includes(".") ? name : `${item.module}.${name}`);
        for (const constant of functionDependencies.get(functionKey ?? "") ?? []) {
          const required = byBinding.get(bindingIdentityKey(constant));
          if (required !== undefined) visit(required);
        }
      }
    }
    active.delete(item);
    visited.add(item);
    ordered.push(item);
  };

  for (const item of [...constants].sort((left, right) =>
    Buffer.compare(
      Buffer.from(`${left.module}.${left.declaration.name}`, "utf8"),
      Buffer.from(`${right.module}.${right.declaration.name}`, "utf8"),
    ),
  ))
    visit(item);
  return Object.freeze([
    ...ordered,
    ...work.filter(({ declaration }) => !isConstantDeclaration(declaration)),
  ]);
}
