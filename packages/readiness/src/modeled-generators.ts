import { createBoundaryVariants } from "./boundary-variants.js";
import type { GenerationSpelling } from "./canonical-identity.js";
import {
  isGenIdentifier,
  type GenExpression,
  type GenIdentifier,
  type GenModule,
  type GenerationBudget,
} from "./generator-ir.js";
import { inspectGeneratorInput, validateGeneratorIr } from "./generator-ir-validator.js";
import { createGenerationBudgetTracker, validateGenerationBudget } from "./generation-budget.js";
import { buildModeledModule } from "./modeled-case-builder.js";
import {
  isModeledChoice,
  MODELED_RULE_FACTS,
  type MemoryRuleFact,
  type ModeledRuleFact,
} from "./modeled-generator-facts.js";
import {
  type ConstructionUsage,
  type GeneratedModeledCase,
  type GeneratorCaseResult,
  type InvalidSourceTransform,
  type MemoryCaseChoice,
  type ModeledCaseChoice,
  type ModeledCaseRequest,
  type ModeledCaseValidity,
  type ModeledGenerationDiagnostic,
  type ModeledGeneratorSuite,
  type ParameterValueBinding,
  type PredicateResult,
  type ScalarCaseChoice,
} from "./modeled-generator-model.js";
import { getModeledSuiteState } from "./modeled-generator-suite.js";

interface ClosedRequest {
  readonly handlerId: ModeledCaseRequest["handlerId"];
  readonly modulePath: readonly GenIdentifier[];
  readonly choice: ModeledCaseChoice;
  readonly validity: ModeledCaseValidity;
  readonly budget: GenerationBudget;
  readonly fact: ModeledRuleFact;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const SPELLINGS: ReadonlySet<string> = new Set(["const", "literal", "local", "parameter"]);
const REQUEST_KEYS = ["handlerId", "modulePath", "choice", "validity", "budget"] as const;
const CONSTRUCTION_DIMENSIONS: readonly (keyof ConstructionUsage)[] = Object.freeze([
  "modules",
  "declarations",
  "ir-nodes",
  "statements",
  "expression-depth",
  "loop-work",
]);

function diagnostic(
  code: ModeledGenerationDiagnostic["code"],
  path: string,
  message: string,
): ModeledGenerationDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  code: ModeledGenerationDiagnostic["code"],
  path: string,
  message: string,
): { readonly ok: false; readonly diagnostics: readonly ModeledGenerationDiagnostic[] } {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isSpelling(value: unknown): value is GenerationSpelling {
  return typeof value === "string" && SPELLINGS.has(value);
}

function parseChoice(value: unknown): ModeledCaseChoice | undefined {
  if (!isRecord(value) || typeof value.ruleId !== "string") return undefined;
  if (
    value.kind === "scalar" &&
    hasExactKeys(value, ["kind", "ruleId", "spelling", "value"]) &&
    isSpelling(value.spelling) &&
    (typeof value.value === "bigint" || typeof value.value === "boolean")
  ) {
    const choice: ScalarCaseChoice = {
      kind: "scalar",
      ruleId: value.ruleId,
      spelling: value.spelling,
      value: value.value,
    };
    return choice;
  }
  const keys = Object.hasOwn(value, "valueSpelling")
    ? ["kind", "ruleId", "addressSpelling", "addressForm", "valueSpelling"]
    : ["kind", "ruleId", "addressSpelling", "addressForm"];
  if (
    value.kind === "memory" &&
    hasExactKeys(value, keys) &&
    isSpelling(value.addressSpelling) &&
    (value.addressForm === "direct" || value.addressForm === "computed") &&
    (!Object.hasOwn(value, "valueSpelling") || isSpelling(value.valueSpelling))
  ) {
    const choice: MemoryCaseChoice = {
      kind: "memory",
      ruleId: value.ruleId,
      addressSpelling: value.addressSpelling,
      addressForm: value.addressForm,
      ...(isSpelling(value.valueSpelling) ? { valueSpelling: value.valueSpelling } : {}),
    };
    return choice;
  }
  return undefined;
}

function parseValidity(value: unknown): ModeledCaseValidity | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  if (value.kind === "valid" && hasExactKeys(value, ["kind"])) {
    return Object.freeze({ kind: "valid" });
  }
  if (
    value.kind === "invalid" &&
    hasExactKeys(value, ["kind", "neighborId"]) &&
    typeof value.neighborId === "string"
  ) {
    return Object.freeze({ kind: "invalid", neighborId: value.neighborId });
  }
  return undefined;
}

function closeRequest(
  suite: ModeledGeneratorSuite,
  input: unknown,
):
  | ClosedRequest
  | { readonly ok: false; readonly diagnostics: readonly ModeledGenerationDiagnostic[] } {
  if (getModeledSuiteState(suite) === undefined) {
    return failure("modeled.input.invalid", "/suite", "Generator suite capability is invalid.");
  }
  const structuralFailure = inspectGeneratorInput(input, "", () => false);
  if (structuralFailure !== undefined) {
    return failure("modeled.choice.invalid", structuralFailure.path, structuralFailure.message);
  }
  if (!isRecord(input) || !hasExactKeys(input, REQUEST_KEYS)) {
    return failure("modeled.choice.invalid", "", "Generation request must use the closed shape.");
  }
  if (
    input.handlerId !== "generator.frontend-cases" &&
    input.handlerId !== "generator.compiler-cases" &&
    input.handlerId !== "generator.runtime-cases"
  ) {
    return failure("modeled.choice.invalid", "/handlerId", "Generator handler is invalid.");
  }
  if (
    !Array.isArray(input.modulePath) ||
    input.modulePath.length < 1 ||
    input.modulePath.length > 8
  ) {
    return failure("modeled.choice.invalid", "/modulePath", "Module path is invalid.");
  }
  const modulePath: GenIdentifier[] = [];
  for (let index = 0; index < input.modulePath.length; index += 1) {
    const segment = input.modulePath[index];
    if (!isGenIdentifier(segment)) {
      return failure(
        "modeled.choice.invalid",
        `/modulePath/${index}`,
        "Module path segment is not an allowlisted identifier.",
      );
    }
    modulePath.push(segment);
  }
  const choice = parseChoice(input.choice);
  if (choice === undefined) {
    return failure("modeled.choice.invalid", "/choice", "Modeled construction choice is invalid.");
  }
  const fact = MODELED_RULE_FACTS.get(choice.ruleId);
  if (fact === undefined || !isModeledChoice(fact, choice)) {
    return failure(
      "modeled.choice.invalid",
      "/choice",
      "Choice is outside the reviewed rule domain.",
    );
  }
  const validity = parseValidity(input.validity);
  if (validity === undefined) {
    return failure("modeled.choice.invalid", "/validity", "Case validity request is invalid.");
  }
  const budget = validateGenerationBudget(input.budget);
  if (!budget.ok) {
    const problem = budget.diagnostics[0];
    return failure(
      "modeled.choice.invalid",
      problem?.path ?? "/budget",
      problem?.message ?? "Generation budget is invalid.",
    );
  }
  return Object.freeze({
    handlerId: input.handlerId,
    modulePath: Object.freeze(modulePath),
    choice,
    validity,
    budget: budget.budget,
    fact,
  });
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

function constructionUsage(module: GenModule): ConstructionUsage {
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

function accountConstruction(
  module: GenModule,
  budget: GenerationBudget,
):
  | ConstructionUsage
  | { readonly ok: false; readonly diagnostics: readonly ModeledGenerationDiagnostic[] } {
  const usage = constructionUsage(module);
  const tracker = createGenerationBudgetTracker(budget);
  for (const dimension of CONSTRUCTION_DIMENSIONS) {
    const amount = usage[dimension];
    const result = tracker.consume(dimension, dimension === "loop-work" ? amount : Number(amount));
    if (!result.ok) {
      const problem = result.diagnostics[0];
      return failure(
        "modeled.operation.failed",
        problem?.path ?? `/usage/${dimension}`,
        problem?.message ?? "Construction exceeded its budget.",
      );
    }
  }
  const finalized = tracker.finalize(module, 0, 0);
  if (!finalized.ok) {
    const problem = finalized.diagnostics[0];
    return failure(
      "modeled.operation.failed",
      problem?.path ?? "/usage",
      problem?.message ?? "Construction accounting failed.",
    );
  }
  return usage;
}

function invalidTransform(
  fact: MemoryRuleFact,
  module: GenModule,
  neighborId: string,
): InvalidSourceTransform | undefined {
  if (!fact.neighborIds.includes(neighborId)) return undefined;
  const call = resolveMemoryCall(fact, module);
  if (call === undefined) return undefined;
  const { callPath } = call;
  if (neighborId.endsWith("wrong-arity")) {
    return Object.freeze({
      kind: "intrinsic-argument-remove",
      callPath,
      argumentIndex: fact.parameterTypes.length - 1,
    });
  }
  const argumentIndex = neighborId.endsWith("wrong-value-type") ? 1 : 0;
  const argument: GenExpression = Object.freeze({
    kind: "literal",
    type: "boolean",
    value: 0n,
  });
  return Object.freeze({
    kind: "intrinsic-argument-replace",
    callPath,
    argumentIndex,
    argument,
  });
}

interface ResolvedMemoryCall {
  readonly callPath: string;
  readonly argumentTypes: readonly string[];
}

function resolveMemoryCall(
  fact: MemoryRuleFact,
  module: GenModule,
): ResolvedMemoryCall | undefined {
  const fn = module.functions[0];
  if (fn === undefined) return undefined;
  const statementIndex = fn.body.findIndex((statement) =>
    fact.intrinsic === "peek" || fact.intrinsic === "peekw"
      ? statement.kind === "return" && statement.value?.kind === "memory-read"
      : statement.kind === "memory-write",
  );
  if (statementIndex < 0) return undefined;
  const statement = fn.body[statementIndex];
  if (
    (fact.intrinsic === "peek" || fact.intrinsic === "peekw") &&
    statement?.kind === "return" &&
    statement.value?.kind === "memory-read"
  ) {
    return {
      callPath: `/functions/0/body/${statementIndex}/value`,
      argumentTypes: Object.freeze([statement.value.address.type]),
    };
  }
  return statement?.kind === "memory-write"
    ? {
        callPath: `/functions/0/body/${statementIndex}`,
        argumentTypes: Object.freeze([statement.address.type, statement.value.type]),
      }
    : undefined;
}

function transformViolatesNamedMemoryPredicate(
  fact: MemoryRuleFact,
  module: GenModule,
  neighborId: string,
  transform: InvalidSourceTransform,
): boolean {
  const baseline = resolveMemoryCall(fact, module);
  if (
    baseline === undefined ||
    transform.kind === "scalar-expression-replace" ||
    transform.kind === "parameter-binding-replace" ||
    transform.callPath !== baseline.callPath ||
    baseline.argumentTypes.length !== fact.parameterTypes.length ||
    !baseline.argumentTypes.every((type, index) => type === fact.parameterTypes[index])
  ) {
    return false;
  }
  const projectedTypes = [...baseline.argumentTypes];
  if (transform.kind === "intrinsic-argument-remove") {
    if (transform.argumentIndex < 0 || transform.argumentIndex >= projectedTypes.length) {
      return false;
    }
    projectedTypes.splice(transform.argumentIndex, 1);
  } else if (transform.kind === "intrinsic-argument-insert") {
    if (transform.argumentIndex < 0 || transform.argumentIndex > projectedTypes.length) {
      return false;
    }
    projectedTypes.splice(transform.argumentIndex, 0, transform.argument.type);
  } else {
    if (transform.argumentIndex < 0 || transform.argumentIndex >= projectedTypes.length) {
      return false;
    }
    projectedTypes[transform.argumentIndex] = transform.argument.type;
  }
  const projectedValid =
    projectedTypes.length === fact.parameterTypes.length &&
    projectedTypes.every((type, index) => type === fact.parameterTypes[index]);
  const namedShapeMatches = neighborId.endsWith("wrong-arity")
    ? projectedTypes.length !== fact.parameterTypes.length
    : neighborId.endsWith("wrong-value-type")
      ? projectedTypes.length === fact.parameterTypes.length &&
        projectedTypes[0] === "word" &&
        projectedTypes[1] !== fact.parameterTypes[1]
      : projectedTypes.length === fact.parameterTypes.length &&
        projectedTypes[0] !== "word" &&
        projectedTypes.slice(1).every((type, index) => type === fact.parameterTypes[index + 1]);
  return !projectedValid && namedShapeMatches;
}

function scalarExpressionPath(choice: ScalarCaseChoice): string | undefined {
  switch (choice.spelling) {
    case "const":
      return "/constants/0/value";
    case "literal":
      return "/functions/0/body/0/value";
    case "local":
      return "/functions/0/body/0/initializer";
    case "parameter":
      return undefined;
  }
}

function scalarInvalidValue(
  fact: Extract<ModeledRuleFact, { readonly kind: "scalar" }>,
  neighborId: string,
): bigint | undefined {
  if (!fact.neighborIds.includes(neighborId)) return undefined;
  if (fact.scalarType === "boolean") {
    return neighborId.endsWith("wrong-type") ? 0n : undefined;
  }
  const values = fact.values.filter((value): value is bigint => typeof value === "bigint");
  const minimum = values[0];
  const maximum = values[1];
  if (minimum === undefined || maximum === undefined) return undefined;
  if (neighborId.endsWith("below-min")) return minimum - 1n;
  if (neighborId.endsWith("above-max")) return maximum + 1n;
  return undefined;
}

function scalarInvalidTransform(
  fact: Extract<ModeledRuleFact, { readonly kind: "scalar" }>,
  choice: ScalarCaseChoice,
  neighborId: string,
): InvalidSourceTransform | undefined {
  const value = scalarInvalidValue(fact, neighborId);
  if (value === undefined) return undefined;
  if (choice.spelling === "parameter") {
    return Object.freeze({
      kind: "parameter-binding-replace",
      parameterPath: "/functions/0/parameters/0",
      replacement: Object.freeze({ kind: "integer-literal", value }),
    });
  }
  const expressionPath = scalarExpressionPath(choice);
  return expressionPath === undefined
    ? undefined
    : Object.freeze({
        kind: "scalar-expression-replace",
        expressionPath,
        replacement: Object.freeze({ kind: "integer-literal", value }),
      });
}

function transformViolatesNamedScalarPredicate(
  fact: Extract<ModeledRuleFact, { readonly kind: "scalar" }>,
  choice: ScalarCaseChoice,
  module: GenModule,
  bindings: readonly ParameterValueBinding[],
  neighborId: string,
  transform: InvalidSourceTransform,
): boolean {
  const sourcePath = scalarExpressionPath(choice);
  const sourcePathResolves =
    choice.spelling === "const"
      ? module.constants[0]?.value !== undefined
      : choice.spelling === "literal"
        ? module.functions[0]?.body[0]?.kind === "return"
        : choice.spelling === "local"
          ? module.functions[0]?.body[0]?.kind === "local"
          : false;
  const binding = bindings[0];
  const bindingPathResolves =
    choice.spelling === "parameter" &&
    bindings.length === 1 &&
    binding?.parameterPath === "/functions/0/parameters/0" &&
    binding.value === choice.value &&
    module.functions[0]?.parameters[0] !== undefined;
  const transformApplies =
    transform.kind === "scalar-expression-replace"
      ? sourcePath !== undefined && transform.expressionPath === sourcePath && sourcePathResolves
      : transform.kind === "parameter-binding-replace"
        ? transform.parameterPath === binding?.parameterPath && bindingPathResolves
        : false;
  if (!transformApplies || !fact.values.includes(choice.value)) {
    return false;
  }
  if (
    transform.kind !== "scalar-expression-replace" &&
    transform.kind !== "parameter-binding-replace"
  ) {
    return false;
  }
  const projected = transform.replacement.value;
  if (fact.scalarType === "boolean") {
    return neighborId.endsWith("wrong-type") && projected === 0n;
  }
  const values = fact.values.filter((value): value is bigint => typeof value === "bigint");
  const minimum = values[0];
  const maximum = values[1];
  if (minimum === undefined || maximum === undefined) return false;
  const projectedValid = projected >= minimum && projected <= maximum;
  const namedValueMatches =
    (neighborId.endsWith("below-min") && projected === minimum - 1n) ||
    (neighborId.endsWith("above-max") && projected === maximum + 1n);
  return !projectedValid && namedValueMatches;
}

function parameterBindings(request: ClosedRequest): readonly ParameterValueBinding[] {
  if (request.choice.kind !== "scalar" || request.choice.spelling !== "parameter") {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      kind: "parameter-value",
      parameterPath: "/functions/0/parameters/0",
      value: request.choice.value,
    }),
  ]);
}

function generatedCase(
  request: ClosedRequest,
  module: GenModule,
  usage: ConstructionUsage,
): GeneratorCaseResult {
  const spelling =
    request.choice.kind === "scalar" ? request.choice.spelling : request.choice.addressSpelling;
  const bindings = parameterBindings(request);
  if (request.validity.kind === "valid") {
    const modeledCase: GeneratedModeledCase = Object.freeze({
      projection: Object.freeze({ kind: "valid", module }),
      parameterBindings: bindings,
      primaryRuleId: request.choice.ruleId,
      claimedRuleIds: Object.freeze([request.choice.ruleId]),
      spelling,
      validity: Object.freeze({ kind: "valid" }),
      constructionUsage: usage,
    });
    return Object.freeze({
      ok: true,
      outcome: "generated",
      case: modeledCase,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const transform =
    request.fact.kind === "memory" && request.choice.kind === "memory"
      ? invalidTransform(request.fact, module, request.validity.neighborId)
      : request.fact.kind === "scalar" && request.choice.kind === "scalar"
        ? scalarInvalidTransform(request.fact, request.choice, request.validity.neighborId)
        : undefined;
  const violatesOnlyNamedPredicate =
    transform !== undefined &&
    (request.fact.kind === "memory"
      ? transformViolatesNamedMemoryPredicate(
          request.fact,
          module,
          request.validity.neighborId,
          transform,
        )
      : request.choice.kind === "scalar" &&
        transformViolatesNamedScalarPredicate(
          request.fact,
          request.choice,
          module,
          bindings,
          request.validity.neighborId,
          transform,
        ));
  if (transform === undefined || !violatesOnlyNamedPredicate) {
    return failure(
      "modeled.choice.invalid",
      "/validity/neighborId",
      "Neighbor does not belong to the reviewed rule.",
    );
  }
  const invalidCase: GeneratedModeledCase = Object.freeze({
    projection: Object.freeze({ kind: "invalid", baseline: module, transform }),
    parameterBindings: bindings,
    primaryRuleId: request.choice.ruleId,
    claimedRuleIds: Object.freeze([request.choice.ruleId]),
    spelling,
    validity: Object.freeze({
      kind: "invalid",
      neighborId: request.validity.neighborId,
      violatedPredicateId: request.fact.predicateId,
      expectedDiagnosticFamily:
        request.fact.kind === "memory"
          ? "intrinsic.signature"
          : request.fact.scalarType === "boolean"
            ? "type.domain"
            : "type.range",
    }),
    constructionUsage: usage,
  });
  return Object.freeze({
    ok: true,
    outcome: "generated",
    case: invalidCase,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function constructClosed(request: ClosedRequest): GeneratorCaseResult {
  const module = buildModeledModule(request.fact, request.choice, request.modulePath);
  const validation = validateGeneratorIr(module);
  if (!validation.ok) {
    const problem = validation.diagnostics[0];
    return failure(
      "modeled.operation.failed",
      problem?.path ?? "",
      problem?.message ?? "Constructed module is invalid.",
    );
  }
  const usage = accountConstruction(validation.module, request.budget);
  return "ok" in usage ? usage : generatedCase(request, validation.module, usage);
}

/**
 * Constructs a reviewed modeled case without selecting a handler route.
 *
 * @param suite Validated authority capability.
 * @param input Closed modeled-case request.
 * @returns A generated projection or stable diagnostic.
 */
export function constructModeledCase(
  suite: ModeledGeneratorSuite,
  input: unknown,
): GeneratorCaseResult {
  const request = closeRequest(suite, input);
  return "ok" in request ? request : constructClosed(request);
}

/**
 * Evaluates whether a canonical request satisfies its reviewed primary predicate.
 *
 * @param suite Validated authority capability.
 * @param input Closed modeled-case request.
 * @returns Predicate identity and validity, or a stable diagnostic.
 */
export function evaluateModeledRule(suite: ModeledGeneratorSuite, input: unknown): PredicateResult {
  const request = closeRequest(suite, input);
  if ("ok" in request) return request;
  if (request.validity.kind === "invalid") {
    const generated = constructClosed(request);
    if (!generated.ok) return generated;
    if (generated.outcome !== "generated" || generated.case.projection.kind !== "invalid") {
      return failure(
        "modeled.operation.failed",
        "/validity",
        "Invalid predicate evaluation did not produce one structural delta.",
      );
    }
  }
  return Object.freeze({
    ok: true,
    predicateId: request.fact.predicateId,
    valid: request.validity.kind === "valid",
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Applies one reviewed invalid-neighbor delta over a valid generated baseline.
 *
 * @param suite Validated authority capability.
 * @param input Request naming the invalid neighbor.
 * @returns The valid baseline and one closed structural source transform.
 */
export function applyModeledRuleNeighbor(
  suite: ModeledGeneratorSuite,
  input: unknown,
): GeneratorCaseResult {
  const request = closeRequest(suite, input);
  if ("ok" in request) return request;
  if (request.validity.kind !== "invalid") {
    return failure(
      "modeled.choice.invalid",
      "/validity",
      "Neighbor application requires an invalid-case request.",
    );
  }
  return constructClosed(request);
}

function routedCase(
  suite: ModeledGeneratorSuite,
  input: unknown,
  handlerId: ClosedRequest["handlerId"],
): GeneratorCaseResult {
  const request = closeRequest(suite, input);
  if ("ok" in request) return request;
  if (request.handlerId !== handlerId || request.fact.handlerId !== handlerId) {
    return failure(
      "modeled.handler.route",
      "/handlerId",
      "Rule domain is not assigned to this generator handler.",
    );
  }
  return constructClosed(request);
}

/** Generates one reviewed scalar case through the frontend-only route. */
export function generateFrontendCase(
  suite: ModeledGeneratorSuite,
  input: unknown,
): GeneratorCaseResult {
  return routedCase(suite, input, "generator.frontend-cases");
}

/** Keeps compiler composition explicitly empty until composition rules are reviewed. */
export function generateCompilerCase(
  suite: ModeledGeneratorSuite,
  input: unknown,
): GeneratorCaseResult {
  const request = closeRequest(suite, input);
  if ("ok" in request) return request;
  return failure(
    "modeled.handler.route",
    "/handlerId",
    "No rule is directly assigned to compiler composition.",
  );
}

/** Generates one reviewed volatile-memory case through the runtime-only route. */
export function generateRuntimeCase(
  suite: ModeledGeneratorSuite,
  input: unknown,
): GeneratorCaseResult {
  return routedCase(suite, input, "generator.runtime-cases");
}

/** Candidate-only boundary transform callable paired with modeled generators. */
export const boundaryVariantsHandler = createBoundaryVariants;

/**
 * Executes one ID-bound neighbor proof without suite or registry authority.
 *
 * This internal semantic probe lets suite construction prove that a registered neighbor callable
 * can build a valid baseline and independently flip its exact reviewed predicate.
 *
 * @param fact Exact reviewed rule fact bound to the operation ID.
 * @param choice Canonical choice owned by that fact.
 * @param neighborId Neighbor identity bound to the operation callable.
 * @returns Whether the baseline and projected predicate proof both succeed.
 */
export function executeModeledNeighborOperation(
  fact: ModeledRuleFact,
  choice: ModeledCaseChoice,
  neighborId: string,
): boolean {
  const moduleName = "OperationProbe";
  if (!isGenIdentifier(moduleName)) return false;
  const module = buildModeledModule(fact, choice, [moduleName]);
  if (!validateGeneratorIr(module).ok) return false;
  if (fact.kind === "memory" && choice.kind === "memory") {
    const transform = invalidTransform(fact, module, neighborId);
    return (
      transform !== undefined &&
      transformViolatesNamedMemoryPredicate(fact, module, neighborId, transform)
    );
  }
  if (fact.kind === "scalar" && choice.kind === "scalar") {
    const transform = scalarInvalidTransform(fact, choice, neighborId);
    const bindings: readonly ParameterValueBinding[] =
      choice.spelling === "parameter"
        ? Object.freeze([
            Object.freeze({
              kind: "parameter-value",
              parameterPath: "/functions/0/parameters/0",
              value: choice.value,
            }),
          ])
        : Object.freeze([]);
    return (
      transform !== undefined &&
      transformViolatesNamedScalarPredicate(fact, choice, module, bindings, neighborId, transform)
    );
  }
  return false;
}
