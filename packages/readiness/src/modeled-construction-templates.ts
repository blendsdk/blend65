import { isDeepStrictEqual } from "node:util";

import type { GenExpression, GenIdentifier, GenModule, GenerationBudget } from "./generator-ir.js";
import { isGenIdentifier } from "./generator-ir.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { buildModeledModule } from "./modeled-case-builder.js";
import {
  createModeledChoices,
  modeledChoiceKey,
  MODELED_RULE_FACTS,
} from "./modeled-generator-facts.js";
import type {
  ConstructionUsage,
  GeneratedModeledCase,
  ModeledCaseChoice,
  ModeledCaseValidity,
} from "./modeled-generator-model.js";

/** One factory-reviewed construction paired with its authoritative structural usage. */
export interface PreparedModeledConstruction {
  readonly module: GenModule;
  readonly usage: ConstructionUsage;
}

/** Private finite index of every reviewed valid and invalid-neighbor construction. */
const PREPARED_REGISTRY_CAPABILITY: unique symbol = Symbol(
  "prepared-modeled-construction-registry",
);

export interface PreparedModeledConstructionRegistry {
  readonly [PREPARED_REGISTRY_CAPABILITY]: true;
}

/** Instantiated prepared module and its cached authoritative usage. */
export interface InstantiatedModeledConstruction {
  readonly module: GenModule;
  readonly usage: ConstructionUsage;
}

interface PublishedConstructionEvidence {
  readonly module: GenModule;
  readonly usage: ConstructionUsage;
}

const PREPARED_CONSTRUCTIONS = new WeakSet<object>();
const PREPARED_REGISTRIES = new WeakMap<object, ReadonlyMap<string, PreparedModeledConstruction>>();
const PUBLISHED_CASES = new WeakMap<object, PublishedConstructionEvidence>();

function templateModulePath(): readonly GenIdentifier[] {
  const name = "ModeledTemplate";
  if (!isGenIdentifier(name)) {
    throw new TypeError("Internal template module identifier is invalid.");
  }
  return Object.freeze([name]);
}

function expressionUsage(expression: GenExpression): {
  readonly nodes: bigint;
  readonly depth: bigint;
} {
  if (expression.kind === "unary") {
    const operand = expressionUsage(expression.operand);
    return { nodes: 1n + operand.nodes, depth: 1n + operand.depth };
  }
  if (expression.kind === "binary") {
    const left = expressionUsage(expression.left);
    const right = expressionUsage(expression.right);
    return {
      nodes: 1n + left.nodes + right.nodes,
      depth: 1n + (left.depth > right.depth ? left.depth : right.depth),
    };
  }
  if (expression.kind === "memory-read") {
    const address = expressionUsage(expression.address);
    return { nodes: 1n + address.nodes, depth: 1n + address.depth };
  }
  return { nodes: 1n, depth: 1n };
}

function validityKey(validity: ModeledCaseValidity): string {
  return validity.kind === "valid" ? "valid" : `invalid|${validity.neighborId}`;
}

function registryKey(choice: ModeledCaseChoice, validity: ModeledCaseValidity): string {
  return `${modeledChoiceKey(choice)}\u0000${validityKey(validity)}`;
}

function limitFor(budget: GenerationBudget, dimension: keyof ConstructionUsage): bigint {
  switch (dimension) {
    case "modules":
      return BigInt(budget.maxModules);
    case "declarations":
      return BigInt(budget.maxDeclarations);
    case "ir-nodes":
      return BigInt(budget.maxIrNodes);
    case "statements":
      return BigInt(budget.maxStatements);
    case "expression-depth":
      return BigInt(budget.maxExpressionDepth);
    case "loop-work":
      return budget.maxLoopWork;
  }
}

/**
 * Recounts the construction-only dimensions of one generator module.
 *
 * @param module Structurally valid generator module.
 * @returns Exact usage before source rendering and attempt accounting.
 */
export function deriveConstructionUsage(module: GenModule): ConstructionUsage {
  let declarations = 0n;
  let nodes = 1n;
  let statements = 0n;
  let depth = 0n;
  for (const constant of module.constants) {
    declarations += 1n;
    nodes += 1n;
    const usage = expressionUsage(constant.value);
    nodes += usage.nodes;
    if (usage.depth > depth) depth = usage.depth;
  }
  for (const fn of module.functions) {
    declarations += 1n + BigInt(fn.parameters.length);
    nodes += 1n + BigInt(fn.parameters.length);
    for (const statement of fn.body) {
      statements += 1n;
      nodes += 1n;
      const expressions =
        statement.kind === "local"
          ? [statement.initializer]
          : statement.kind === "assign"
            ? [statement.value]
            : statement.kind === "memory-write"
              ? [statement.address, statement.value]
              : statement.value === undefined
                ? []
                : [statement.value];
      for (const expression of expressions) {
        const usage = expressionUsage(expression);
        nodes += usage.nodes;
        if (usage.depth > depth) depth = usage.depth;
      }
    }
  }
  return Object.freeze({
    modules: 1n,
    declarations,
    "ir-nodes": nodes,
    statements,
    "expression-depth": depth,
    "loop-work": 0n,
  });
}

/**
 * Builds and validates the finite construction index retained by a suite capability.
 *
 * @returns Complete reviewed registry, or undefined if an internal template is invalid.
 */
export function prepareModeledConstructionRegistry():
  | PreparedModeledConstructionRegistry
  | undefined {
  const entries = new Map<string, PreparedModeledConstruction>();
  const modulePath = templateModulePath();
  for (const fact of MODELED_RULE_FACTS.values()) {
    for (const choice of createModeledChoices(fact)) {
      const validated = validateGeneratorIr(buildModeledModule(fact, choice, modulePath));
      if (!validated.ok) return undefined;
      const usage = deriveConstructionUsage(validated.module);
      const validities: readonly ModeledCaseValidity[] = Object.freeze([
        Object.freeze({ kind: "valid" as const }),
        ...fact.neighborIds.map((neighborId) =>
          Object.freeze({ kind: "invalid" as const, neighborId }),
        ),
      ]);
      for (const validity of validities) {
        const key = registryKey(choice, validity);
        if (entries.has(key)) return undefined;
        const prepared = Object.freeze({ module: validated.module, usage });
        PREPARED_CONSTRUCTIONS.add(prepared);
        entries.set(key, prepared);
      }
    }
  }
  const registry: PreparedModeledConstructionRegistry = Object.freeze({
    [PREPARED_REGISTRY_CAPABILITY]: true as const,
  });
  PREPARED_REGISTRIES.set(registry, entries);
  return registry;
}

/**
 * Resolves one prepared construction and substitutes only its validated module path.
 *
 * @param registry Factory-owned reviewed construction registry.
 * @param choice Canonical reviewed choice.
 * @param validity Valid case or exact reviewed invalid neighbor.
 * @param modulePath Closed caller-selected module path.
 * @returns Instantiated prepared evidence, or undefined for unreviewed input.
 */
export function instantiateModeledConstruction(
  registry: PreparedModeledConstructionRegistry,
  choice: ModeledCaseChoice,
  validity: ModeledCaseValidity,
  modulePath: readonly GenIdentifier[],
): InstantiatedModeledConstruction | undefined {
  const entries = PREPARED_REGISTRIES.get(registry);
  if (entries === undefined) return undefined;
  const prepared = entries.get(registryKey(choice, validity));
  if (prepared === undefined || !PREPARED_CONSTRUCTIONS.has(prepared)) return undefined;
  return Object.freeze({
    module: Object.freeze({ ...prepared.module, path: Object.freeze([...modulePath]) }),
    usage: prepared.usage,
  });
}

/**
 * Checks a cached construction total against a closed request budget.
 *
 * @param usage Factory-reviewed structural usage.
 * @param budget Validated request budget.
 * @returns First exceeded construction dimension, if any.
 */
export function exceededConstructionDimension(
  usage: ConstructionUsage,
  budget: GenerationBudget,
): keyof ConstructionUsage | undefined {
  const dimensions: readonly (keyof ConstructionUsage)[] = Object.freeze([
    "modules",
    "declarations",
    "ir-nodes",
    "statements",
    "expression-depth",
    "loop-work",
  ]);
  return dimensions.find((dimension) => usage[dimension] > limitFor(budget, dimension));
}

/**
 * Publishes trusted construction evidence for one final generated case object.
 *
 * @param generatedCase Newly closed generated case.
 * @param instantiated Factory-prepared construction consumed by its handler.
 * @returns Whether the case retained the exact prepared module and usage.
 */
export function publishPreparedGeneratedCase(
  generatedCase: GeneratedModeledCase,
  instantiated: InstantiatedModeledConstruction,
): boolean {
  const module =
    generatedCase.projection.kind === "valid"
      ? generatedCase.projection.module
      : generatedCase.projection.baseline;
  if (module !== instantiated.module || generatedCase.constructionUsage !== instantiated.usage) {
    return false;
  }
  PUBLISHED_CASES.set(
    generatedCase,
    Object.freeze({ module: instantiated.module, usage: instantiated.usage }),
  );
  return true;
}

/**
 * Validates construction evidence, avoiding a recount only for factory-published cases.
 *
 * @param generatedCase Closed generated case returned by a handler.
 * @returns Whether its baseline and structural usage agree exactly.
 */
export function validateGeneratedConstruction(generatedCase: unknown): boolean {
  if (typeof generatedCase !== "object" || generatedCase === null) return false;
  let projection: unknown;
  let usage: unknown;
  try {
    const projectionDescriptor = Reflect.getOwnPropertyDescriptor(generatedCase, "projection");
    const usageDescriptor = Reflect.getOwnPropertyDescriptor(generatedCase, "constructionUsage");
    if (
      projectionDescriptor === undefined ||
      !("value" in projectionDescriptor) ||
      usageDescriptor === undefined ||
      !("value" in usageDescriptor)
    ) {
      return false;
    }
    projection = projectionDescriptor.value;
    usage = usageDescriptor.value;
  } catch {
    return false;
  }
  if (typeof projection !== "object" || projection === null) return false;
  let module: unknown;
  try {
    const kind = Reflect.getOwnPropertyDescriptor(projection, "kind");
    const moduleDescriptor = Reflect.getOwnPropertyDescriptor(
      projection,
      kind !== undefined && "value" in kind && kind.value === "valid" ? "module" : "baseline",
    );
    if (moduleDescriptor === undefined || !("value" in moduleDescriptor)) return false;
    module = moduleDescriptor.value;
  } catch {
    return false;
  }
  const published = PUBLISHED_CASES.get(generatedCase);
  if (published !== undefined) {
    return module === published.module && usage === published.usage;
  }
  const validated = validateGeneratorIr(module);
  return validated.ok && isDeepStrictEqual(usage, deriveConstructionUsage(validated.module));
}
