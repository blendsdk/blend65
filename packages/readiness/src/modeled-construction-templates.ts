import { isDeepStrictEqual } from "node:util";

import type {
  GenExpression,
  GenIdentifier,
  GenModule,
  GenStructuredExpression,
  GenStructuredModule,
  GenStructuredStatement,
  GenerationBudget,
} from "./generator-ir.js";
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
  StructuredConstructionUsageV2,
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

function structuredExpressionUsage(expression: GenStructuredExpression): {
  readonly nodes: bigint;
  readonly depth: bigint;
} {
  if (expression.kind === "literal" || expression.kind === "name") {
    return { nodes: 1n, depth: 1n };
  }
  if (
    expression.kind === "unary" ||
    expression.kind === "memory-read" ||
    expression.kind === "index"
  ) {
    const child = structuredExpressionUsage(
      expression.kind === "unary"
        ? expression.operand
        : expression.kind === "memory-read"
          ? expression.address
          : expression.index,
    );
    return { nodes: child.nodes + 1n, depth: child.depth + 1n };
  }
  if (expression.kind === "binary") {
    const left = structuredExpressionUsage(expression.left);
    const right = structuredExpressionUsage(expression.right);
    return {
      nodes: left.nodes + right.nodes + 1n,
      depth: (left.depth > right.depth ? left.depth : right.depth) + 1n,
    };
  }
  let nodes = 1n;
  let depth = 1n;
  for (const argument of expression.arguments) {
    if (argument.kind === "array-reference") {
      nodes += 1n;
      continue;
    }
    const usage = structuredExpressionUsage(argument);
    nodes += usage.nodes;
    if (usage.depth + 1n > depth) depth = usage.depth + 1n;
  }
  return { nodes, depth };
}

function structuredLoopDomain(statement: Extract<GenStructuredStatement, { kind: "for" }>): bigint {
  if (statement.start.kind !== "literal" || statement.end.kind !== "literal") return 0n;
  const start = statement.start.value;
  const end = statement.end.value;
  if (statement.direction === "until") {
    return end <= start ? 0n : (end - start + statement.step - 1n) / statement.step;
  }
  if (statement.direction === "to") {
    return end < start ? 0n : (end - start) / statement.step + 1n;
  }
  return start < end ? 0n : (start - end) / statement.step + 1n;
}

/**
 * Recounts every structured construction dimension independently from cached case metadata.
 *
 * @param module Structurally and semantically valid structured generator module.
 * @returns Exact immutable usage including nested-statement depth and static loop work.
 *
 * @example
 * ```ts
 * const usage = deriveStructuredConstructionUsageV2(module);
 * ```
 */
export function deriveStructuredConstructionUsageV2(
  module: GenStructuredModule,
): StructuredConstructionUsageV2 {
  const usage: Record<keyof StructuredConstructionUsageV2, bigint> = {
    modules: 1n,
    declarations: 0n,
    "ir-nodes": 1n,
    statements: 0n,
    "expression-depth": 0n,
    "loop-work": 0n,
    "source-bytes": 0n,
    attempts: 0n,
    "statement-depth": 0n,
  };
  const addExpression = (expression: GenStructuredExpression): void => {
    const counted = structuredExpressionUsage(expression);
    usage["ir-nodes"] += counted.nodes;
    if (counted.depth > usage["expression-depth"]) usage["expression-depth"] = counted.depth;
  };
  const addBody = (body: readonly GenStructuredStatement[], depth: bigint): void => {
    for (const statement of body) {
      usage.statements += 1n;
      usage["ir-nodes"] += 1n;
      if (depth > usage["statement-depth"]) usage["statement-depth"] = depth;
      if (statement.kind === "local") {
        usage.declarations += 1n;
        addExpression(statement.initializer);
      } else if (statement.kind === "array") {
        usage.declarations += 1n;
        statement.initializer.forEach(addExpression);
      } else if (statement.kind === "assign") {
        if (typeof statement.target !== "string") addExpression(statement.target.index);
        addExpression(statement.value);
      } else if (statement.kind === "memory-write") {
        addExpression(statement.address);
        addExpression(statement.value);
      } else if (statement.kind === "return" && statement.value !== undefined) {
        addExpression(statement.value);
      } else if (statement.kind === "call-statement") {
        statement.arguments.forEach((argument) => {
          if (argument.kind !== "array-reference") addExpression(argument);
        });
      } else if (statement.kind === "if") {
        addExpression(statement.condition);
        addBody(statement.thenBody, depth + 1n);
        addBody(statement.elseBody, depth + 1n);
      } else if (statement.kind === "while" || statement.kind === "do-while") {
        addExpression(statement.condition);
        addBody(statement.body, depth + 1n);
      } else if (statement.kind === "for") {
        addExpression(statement.start);
        addExpression(statement.end);
        usage["loop-work"] += structuredLoopDomain(statement);
        addBody(statement.body, depth + 1n);
      }
    }
  };
  module.constants.forEach((constant) => {
    usage.declarations += 1n;
    usage["ir-nodes"] += 1n;
    addExpression(constant.value);
  });
  module.functions.forEach((fn) => {
    usage.declarations += 1n + BigInt(fn.parameters.length);
    usage["ir-nodes"] += 1n + BigInt(fn.parameters.length);
    addBody(fn.body, 1n);
  });
  return Object.freeze({ ...usage });
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
