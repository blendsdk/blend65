import type {
  GenExpression,
  GenModule,
  GenerationBudget,
  GenerationBudgetDimension,
  GenerationBudgetResult,
  GenerationBudgetStepResult,
  GenerationBudgetTracker,
  GenerationDiagnostic,
  GenerationUsage,
  StructuredGenerationBudgetResultV2,
} from "./generator-ir.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";

interface MutableUsage {
  modules: bigint;
  declarations: bigint;
  "ir-nodes": bigint;
  statements: bigint;
  "expression-depth": bigint;
  "loop-work": bigint;
  "source-bytes": bigint;
  attempts: bigint;
}

const BUDGET_KEYS = [
  "maxModules",
  "maxDeclarations",
  "maxIrNodes",
  "maxStatements",
  "maxExpressionDepth",
  "maxLoopWork",
  "maxSourceBytes",
  "maxAttempts",
] as const;
const STRUCTURED_BUDGET_KEYS = ["schemaVersion", ...BUDGET_KEYS, "maxStatementDepth"] as const;

/** Canonical identity domain for a structured generation budget. */
export const STRUCTURED_GENERATION_BUDGET_DOMAIN_V2 =
  "blend65.readiness.structured-generation-budget.v2" as const;
const DIMENSIONS: ReadonlySet<string> = new Set([
  "modules",
  "declarations",
  "ir-nodes",
  "statements",
  "expression-depth",
  "loop-work",
  "source-bytes",
  "attempts",
]);
const MAX_LOOP_WORK = (1n << 64n) - 1n;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function diagnostic(
  code: GenerationDiagnostic["code"],
  path: string,
  message: string,
  dimension?: GenerationBudgetDimension,
): GenerationDiagnostic {
  return dimension === undefined
    ? Object.freeze({ code, path, message })
    : Object.freeze({ code, path, message, dimension });
}

function failedStep(diagnosticValue: GenerationDiagnostic): GenerationBudgetStepResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnosticValue]),
  });
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isDimension(value: unknown): value is GenerationBudgetDimension {
  return typeof value === "string" && DIMENSIONS.has(value);
}

function emptyMutableUsage(): MutableUsage {
  return {
    modules: 0n,
    declarations: 0n,
    "ir-nodes": 0n,
    statements: 0n,
    "expression-depth": 0n,
    "loop-work": 0n,
    "source-bytes": 0n,
    attempts: 0n,
  };
}

function snapshotUsage(usage: MutableUsage): GenerationUsage {
  return Object.freeze({
    modules: usage.modules,
    declarations: usage.declarations,
    "ir-nodes": usage["ir-nodes"],
    statements: usage.statements,
    "expression-depth": usage["expression-depth"],
    "loop-work": usage["loop-work"],
    "source-bytes": usage["source-bytes"],
    attempts: usage.attempts,
  });
}

function limitFor(budget: GenerationBudget, dimension: GenerationBudgetDimension): bigint {
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
    case "source-bytes":
      return BigInt(budget.maxSourceBytes);
    case "attempts":
      return BigInt(budget.maxAttempts);
  }
}

function countExpression(expression: GenExpression): {
  readonly nodes: bigint;
  readonly depth: bigint;
} {
  if (expression.kind === "unary") {
    const operand = countExpression(expression.operand);
    return { nodes: 1n + operand.nodes, depth: 1n + operand.depth };
  }
  if (expression.kind === "binary") {
    const left = countExpression(expression.left);
    const right = countExpression(expression.right);
    return {
      nodes: 1n + left.nodes + right.nodes,
      depth: 1n + (left.depth > right.depth ? left.depth : right.depth),
    };
  }
  if (expression.kind === "memory-read") {
    const address = countExpression(expression.address);
    return { nodes: 1n + address.nodes, depth: 1n + address.depth };
  }
  return { nodes: 1n, depth: 1n };
}

function recountModule(module: GenModule, sourceBytes: number, attempts: number): GenerationUsage {
  let declarations = 0n;
  let irNodes = 1n;
  let statements = 0n;
  let expressionDepth = 0n;

  for (const constant of module.constants) {
    declarations += 1n;
    irNodes += 1n;
    const value = countExpression(constant.value);
    irNodes += value.nodes;
    if (value.depth > expressionDepth) expressionDepth = value.depth;
  }
  for (const fn of module.functions) {
    declarations += 1n + BigInt(fn.parameters.length);
    irNodes += 1n + BigInt(fn.parameters.length);
    for (const statement of fn.body) {
      statements += 1n;
      irNodes += 1n;
      const expressions: GenExpression[] =
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
        const count = countExpression(expression);
        irNodes += count.nodes;
        if (count.depth > expressionDepth) expressionDepth = count.depth;
      }
    }
  }

  return Object.freeze({
    modules: 1n,
    declarations,
    "ir-nodes": irNodes,
    statements,
    "expression-depth": expressionDepth,
    "loop-work": 0n,
    "source-bytes": BigInt(sourceBytes),
    attempts: BigInt(attempts),
  });
}

function invalidTracker(problem: GenerationDiagnostic): GenerationBudgetTracker {
  const usage = emptyMutableUsage();
  return Object.freeze({
    consume: (): GenerationBudgetStepResult => failedStep(problem),
    finalize: (): GenerationBudgetStepResult => failedStep(problem),
    snapshot: (): GenerationUsage => snapshotUsage(usage),
  });
}

function createTracker(budget: GenerationBudget): GenerationBudgetTracker {
  const usage = emptyMutableUsage();

  const consume = (
    dimension: GenerationBudgetDimension,
    amount: number | bigint,
  ): GenerationBudgetStepResult => {
    if (!isDimension(dimension)) {
      return failedStep(
        diagnostic("generation-input-invalid", "/dimension", "Budget dimension is not supported."),
      );
    }
    const validAmount =
      dimension === "loop-work"
        ? typeof amount === "bigint" && amount >= 0n
        : typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0;
    if (!validAmount) {
      return failedStep(
        diagnostic(
          "generation-input-invalid",
          "/amount",
          "Budget amount has the wrong representation or range.",
        ),
      );
    }
    const increment = typeof amount === "bigint" ? amount : BigInt(amount);
    const current = usage[dimension];
    const limit = limitFor(budget, dimension);
    if (increment > limit - current) {
      return failedStep(
        diagnostic(
          "generation-budget",
          `/usage/${dimension}`,
          `Generation exceeded the ${dimension} budget.`,
          dimension,
        ),
      );
    }
    usage[dimension] = current + increment;
    return Object.freeze({
      ok: true,
      usage: snapshotUsage(usage),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  };

  const finalize = (
    module: GenModule,
    sourceBytes: number,
    attempts: number,
  ): GenerationBudgetStepResult => {
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0) {
      return failedStep(
        diagnostic(
          "generation-input-invalid",
          "/sourceBytes",
          "Rendered source byte count must be a non-negative safe integer.",
        ),
      );
    }
    if (!Number.isSafeInteger(attempts) || attempts < 0) {
      return failedStep(
        diagnostic(
          "generation-input-invalid",
          "/attempts",
          "Attempt count must be a non-negative safe integer.",
        ),
      );
    }
    const validated = validateGeneratorIr(module);
    if (!validated.ok) {
      return failedStep(
        diagnostic(
          "generation-invariant",
          "/usage/ir-nodes",
          "Completed generator module is not structurally valid.",
          "ir-nodes",
        ),
      );
    }
    const recounted = recountModule(validated.module, sourceBytes, attempts);
    for (const dimension of DIMENSIONS) {
      if (!isDimension(dimension)) continue;
      if (recounted[dimension] > limitFor(budget, dimension)) {
        return failedStep(
          diagnostic(
            "generation-budget",
            `/usage/${dimension}`,
            `Completed generation exceeded the ${dimension} budget.`,
            dimension,
          ),
        );
      }
    }
    for (const dimension of DIMENSIONS) {
      if (!isDimension(dimension)) continue;
      if (recounted[dimension] !== usage[dimension]) {
        return failedStep(
          diagnostic(
            "generation-invariant",
            `/usage/${dimension}`,
            `Incremental ${dimension} usage does not match the completed case recount.`,
            dimension,
          ),
        );
      }
    }
    return Object.freeze({
      ok: true,
      usage: snapshotUsage(usage),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  };

  return Object.freeze({
    consume,
    finalize,
    snapshot: (): GenerationUsage => snapshotUsage(usage),
  });
}

/**
 * Validates and snapshots a closed structural generation budget.
 *
 * @param input Unknown budget input.
 * @returns An immutable budget or stable diagnostics.
 *
 * @example
 * ```ts
 * validateGenerationBudget({
 *   maxModules: 1,
 *   maxDeclarations: 8,
 *   maxIrNodes: 64,
 *   maxStatements: 32,
 *   maxExpressionDepth: 8,
 *   maxLoopWork: 1n,
 *   maxSourceBytes: 4096,
 *   maxAttempts: 16,
 * });
 * ```
 */
export function validateGenerationBudget(input: unknown): GenerationBudgetResult {
  try {
    const structuralFailure = inspectGeneratorInput(input, "/budget", () => false);
    if (structuralFailure !== undefined) {
      return {
        ok: false,
        diagnostics: Object.freeze([
          diagnostic("generation-input-invalid", structuralFailure.path, structuralFailure.message),
        ]),
      };
    }
    if (!isRecord(input) || !hasExactKeys(input, BUDGET_KEYS)) {
      return {
        ok: false,
        diagnostics: Object.freeze([
          diagnostic(
            "generation-input-invalid",
            "/budget",
            "Generation budget must use the exact closed shape.",
          ),
        ]),
      };
    }
    for (const key of BUDGET_KEYS) {
      const value = input[key];
      const valid =
        key === "maxLoopWork"
          ? typeof value === "bigint" && value > 0n && value <= MAX_LOOP_WORK
          : isPositiveSafeInteger(value);
      if (!valid) {
        return {
          ok: false,
          diagnostics: Object.freeze([
            diagnostic(
              "generation-input-invalid",
              `/budget/${key}`,
              "Budget limit is outside its positive closed integer range.",
            ),
          ]),
        };
      }
    }
    if (
      !isPositiveSafeInteger(input.maxModules) ||
      !isPositiveSafeInteger(input.maxDeclarations) ||
      !isPositiveSafeInteger(input.maxIrNodes) ||
      !isPositiveSafeInteger(input.maxStatements) ||
      !isPositiveSafeInteger(input.maxExpressionDepth) ||
      typeof input.maxLoopWork !== "bigint" ||
      !isPositiveSafeInteger(input.maxSourceBytes) ||
      !isPositiveSafeInteger(input.maxAttempts)
    ) {
      return {
        ok: false,
        diagnostics: Object.freeze([
          diagnostic("generation-input-invalid", "/budget", "Generation budget is invalid."),
        ]),
      };
    }
    const budget = Object.freeze({
      maxModules: input.maxModules,
      maxDeclarations: input.maxDeclarations,
      maxIrNodes: input.maxIrNodes,
      maxStatements: input.maxStatements,
      maxExpressionDepth: input.maxExpressionDepth,
      maxLoopWork: input.maxLoopWork,
      maxSourceBytes: input.maxSourceBytes,
      maxAttempts: input.maxAttempts,
    });
    return Object.freeze({ ok: true, budget, diagnostics: EMPTY_DIAGNOSTICS });
  } catch {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          "generation-input-invalid",
          "/budget",
          "Generation budget could not be inspected safely.",
        ),
      ]),
    };
  }
}

/**
 * Validates and snapshots a structured budget without widening the historical budget shape.
 *
 * @param input Unknown version-two budget input.
 * @returns An immutable structured budget or stable diagnostics.
 *
 * @example
 * ```ts
 * const result = validateStructuredGenerationBudgetV2({
 *   schemaVersion: 2,
 *   maxModules: 1,
 *   maxDeclarations: 8,
 *   maxIrNodes: 64,
 *   maxStatements: 32,
 *   maxExpressionDepth: 8,
 *   maxLoopWork: 16n,
 *   maxSourceBytes: 4096,
 *   maxAttempts: 4,
 *   maxStatementDepth: 4,
 * });
 * ```
 */
export function validateStructuredGenerationBudgetV2(
  input: unknown,
): StructuredGenerationBudgetResultV2 {
  try {
    const structuralFailure = inspectGeneratorInput(input, "/budget", () => false);
    if (structuralFailure !== undefined) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          diagnostic("generation-input-invalid", structuralFailure.path, structuralFailure.message),
        ]),
      });
    }
    if (
      !isRecord(input) ||
      !hasExactKeys(input, STRUCTURED_BUDGET_KEYS) ||
      input.schemaVersion !== 2 ||
      !isPositiveSafeInteger(input.maxStatementDepth)
    ) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          diagnostic(
            "generation-input-invalid",
            "/budget",
            "Structured generation budget must use the exact version-two shape.",
          ),
        ]),
      });
    }
    const base = validateGenerationBudget({
      maxModules: input.maxModules,
      maxDeclarations: input.maxDeclarations,
      maxIrNodes: input.maxIrNodes,
      maxStatements: input.maxStatements,
      maxExpressionDepth: input.maxExpressionDepth,
      maxLoopWork: input.maxLoopWork,
      maxSourceBytes: input.maxSourceBytes,
      maxAttempts: input.maxAttempts,
    });
    if (!base.ok) return base;
    return Object.freeze({
      ok: true,
      budget: Object.freeze({
        schemaVersion: 2,
        ...base.budget,
        maxStatementDepth: input.maxStatementDepth,
      }),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          "generation-input-invalid",
          "/budget",
          "Structured generation budget could not be inspected safely.",
        ),
      ]),
    });
  }
}

/**
 * Creates a transactional tracker over an independently snapshotted budget.
 *
 * Invalid runtime budgets produce a tracker whose operations return the validation failure.
 *
 * @param budget Validated generation budget.
 * @returns An immutable tracker capability with private mutable accounting.
 *
 * @example
 * ```ts
 * const tracker = createGenerationBudgetTracker(budget);
 * tracker.consume("modules", 1);
 * ```
 */
export function createGenerationBudgetTracker(budget: GenerationBudget): GenerationBudgetTracker {
  const validated = validateGenerationBudget(budget);
  return validated.ok
    ? createTracker(validated.budget)
    : invalidTracker(
        validated.diagnostics[0] ??
          diagnostic("generation-input-invalid", "/budget", "Generation budget is invalid."),
      );
}
