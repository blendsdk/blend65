import type { ScalarType, StructuredGenerationBudgetV2 } from "./generator-ir.js";
import { isScalarType } from "./generator-ir.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";

const STRUCTURED_BUDGET_KEYS = [
  "schemaVersion",
  "maxModules",
  "maxDeclarations",
  "maxIrNodes",
  "maxStatements",
  "maxExpressionDepth",
  "maxLoopWork",
  "maxSourceBytes",
  "maxAttempts",
  "maxStatementDepth",
] as const;

/** Canonical domain named in malformed structured-budget diagnostics. */
export const STRUCTURED_BUDGET_DOMAIN = "blend65.readiness.structured-generation-budget.v2";

interface PendingInputValue {
  readonly value: unknown;
  readonly path: string;
  readonly scalar: boolean;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/**
 * Validates and snapshots a structured generation budget.
 *
 * @param input Unknown budget candidate.
 * @returns Immutable exact v2 budget, or `undefined` for any malformed field.
 */
export function closeStructuredGenerationBudget(
  input: unknown,
): StructuredGenerationBudgetV2 | undefined {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, STRUCTURED_BUDGET_KEYS) ||
    input.schemaVersion !== 2 ||
    typeof input.maxLoopWork !== "bigint" ||
    input.maxLoopWork <= 0n
  ) {
    return undefined;
  }
  const numericKeys = STRUCTURED_BUDGET_KEYS.filter(
    (key) => key !== "schemaVersion" && key !== "maxLoopWork",
  );
  for (const key of numericKeys) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return undefined;
  }
  return Object.freeze({
    schemaVersion: 2,
    maxModules: Number(input.maxModules),
    maxDeclarations: Number(input.maxDeclarations),
    maxIrNodes: Number(input.maxIrNodes),
    maxStatements: Number(input.maxStatements),
    maxExpressionDepth: Number(input.maxExpressionDepth),
    maxLoopWork: input.maxLoopWork,
    maxSourceBytes: Number(input.maxSourceBytes),
    maxAttempts: Number(input.maxAttempts),
    maxStatementDepth: Number(input.maxStatementDepth),
  });
}

function scalarRange(type: Exclude<ScalarType, "boolean">): {
  readonly minimum: bigint;
  readonly maximum: bigint;
} {
  switch (type) {
    case "byte":
      return { minimum: 0n, maximum: 255n };
    case "sbyte":
      return { minimum: -128n, maximum: 127n };
    case "word":
      return { minimum: 0n, maximum: 65_535n };
    case "sword":
      return { minimum: -32_768n, maximum: 32_767n };
  }
}

function elementBytes(type: ScalarType): bigint {
  return type === "word" || type === "sword" ? 2n : 1n;
}

function enqueueExpression(
  value: unknown,
  path: string,
  pending: PendingInputValue[],
  scalar = true,
): void {
  pending.push({ value, path, scalar });
}

function enqueueStatementList(value: unknown, path: string, pending: PendingInputValue[]): void {
  if (!Array.isArray(value)) return;
  value.forEach((statement, index) =>
    pending.push({ value: statement, path: `${path}/${index}`, scalar: false }),
  );
}

function enqueueCallArguments(value: unknown, path: string, pending: PendingInputValue[]): void {
  if (!Array.isArray(value)) return;
  value.forEach((argument, index) => {
    const isArrayReference = isRecord(argument) && argument.kind === "array-reference";
    pending.push({ value: argument, path: `${path}/${index}`, scalar: !isArrayReference });
  });
}

function enqueueChildren(
  value: Readonly<Record<string, unknown>>,
  path: string,
  pending: PendingInputValue[],
): void {
  switch (value.kind) {
    case "module":
      if (Array.isArray(value.functions)) {
        for (let index = value.functions.length - 1; index >= 0; index -= 1) {
          pending.push({
            value: value.functions[index],
            path: `/functions/${index}`,
            scalar: false,
          });
        }
      }
      if (Array.isArray(value.constants)) {
        for (let index = value.constants.length - 1; index >= 0; index -= 1) {
          pending.push({
            value: value.constants[index],
            path: `/constants/${index}`,
            scalar: false,
          });
        }
      }
      return;
    case "const":
      enqueueExpression(value.value, `${path}/value`, pending);
      return;
    case "function":
      enqueueStatementList(value.body, `${path}/body`, pending);
      return;
    case "local":
      enqueueExpression(value.initializer, `${path}/initializer`, pending);
      return;
    case "array":
      if (Array.isArray(value.initializer)) {
        value.initializer.forEach((item, index) =>
          enqueueExpression(item, `${path}/initializer/${index}`, pending),
        );
      }
      return;
    case "assign":
      if (isRecord(value.target) && value.target.kind === "index-target") {
        enqueueExpression(value.target.index, `${path}/target/index`, pending);
      }
      enqueueExpression(value.value, `${path}/value`, pending);
      return;
    case "memory-write":
      enqueueExpression(value.address, `${path}/address`, pending);
      enqueueExpression(value.value, `${path}/value`, pending);
      return;
    case "return":
      if (Object.hasOwn(value, "value")) enqueueExpression(value.value, `${path}/value`, pending);
      return;
    case "call-statement":
      enqueueCallArguments(value.arguments, `${path}/arguments`, pending);
      return;
    case "if":
      enqueueExpression(value.condition, `${path}/condition`, pending);
      enqueueStatementList(value.thenBody, `${path}/thenBody`, pending);
      enqueueStatementList(value.elseBody, `${path}/elseBody`, pending);
      return;
    case "while":
      enqueueExpression(value.condition, `${path}/condition`, pending);
      enqueueStatementList(value.body, `${path}/body`, pending);
      return;
    case "do-while":
      enqueueStatementList(value.body, `${path}/body`, pending);
      enqueueExpression(value.condition, `${path}/condition`, pending);
      return;
    case "for":
      enqueueExpression(value.start, `${path}/start`, pending);
      enqueueExpression(value.end, `${path}/end`, pending);
      enqueueStatementList(value.body, `${path}/body`, pending);
      return;
    case "unary":
      enqueueExpression(value.operand, `${path}/operand`, pending);
      return;
    case "binary":
      enqueueExpression(value.left, `${path}/left`, pending);
      enqueueExpression(value.right, `${path}/right`, pending);
      return;
    case "memory-read":
      enqueueExpression(value.address, `${path}/address`, pending);
      return;
    case "index":
      enqueueExpression(value.index, `${path}/index`, pending);
      return;
    case "call":
      enqueueCallArguments(value.arguments, `${path}/arguments`, pending);
      return;
  }
}

/**
 * Detects structured-only hostile shapes before the generic syntax parser normalizes them.
 *
 * The traversal is iterative because caller-owned input may be deeply nested. The generic input
 * inspector has already rejected accessors, cycles, sparse arrays, and excessive aggregate size.
 *
 * @param input Structurally inspectable unknown module.
 * @returns First deterministic structured failure, or `undefined`.
 */
export function findStructuredShapeFailure(
  input: unknown,
): StructuredGenerationDiagnosticV2 | undefined {
  const pending: PendingInputValue[] = [{ value: input, path: "", scalar: false }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || !isRecord(current.value)) continue;
    const value = current.value;
    if (
      current.path.startsWith("/constants/") &&
      current.path.includes("/value") &&
      (value.kind === "call" ||
        value.kind === "index" ||
        value.kind === "memory-read" ||
        value.kind === "array-reference")
    ) {
      return structuredDiagnostic(
        "generation-type-invalid",
        "constant-expression-not-constant",
        current.path,
        "Constant initializers must be pure compile-time expressions.",
        { expectedCompilerDiagnosticCode: "E10193" },
      );
    }
    if (current.scalar && value.kind === "array-reference") {
      return structuredDiagnostic(
        "generation-input-invalid",
        "array-scalar-context-invalid",
        current.path,
        "Array references are valid only as call arguments.",
      );
    }
    if (value.kind === "array") {
      if (value.extent === null) {
        return structuredDiagnostic(
          "generation-input-invalid",
          "array-unsized-local",
          `${current.path}/extent`,
          "Local arrays require a fixed extent.",
          { diagnosticFamily: "array-local-requires-fixed-extent" },
        );
      }
      if (value.extent === 0) {
        return structuredDiagnostic(
          "neighbor-invalid",
          "array-size-zero",
          `${current.path}/extent`,
          "Array extent must be at least one.",
          {
            diagnosticFamily: "array-size-at-least-one",
            expectedCompilerDiagnosticCode: "E10111",
          },
        );
      }
      if (
        typeof value.extent === "number" &&
        Number.isSafeInteger(value.extent) &&
        isScalarType(value.elementType) &&
        BigInt(value.extent) * elementBytes(value.elementType) > 65_535n
      ) {
        return structuredDiagnostic(
          "generation-budget",
          "array-extent-resource-limit",
          `${current.path}/extent`,
          "Array storage exceeds the C64 resource maximum.",
        );
      }
    }
    if (value.kind === "for") {
      if (!isScalarType(value.counterType) || value.counterType === "boolean") {
        return structuredDiagnostic(
          "generation-type-invalid",
          "loop-counter-type",
          `${current.path}/counterType`,
          "Loop counters require an integer scalar type.",
        );
      }
      const counterType = value.counterType;
      if (typeof value.step !== "bigint" || value.step <= 0n) {
        return structuredDiagnostic(
          "generation-type-invalid",
          "loop-step-invalid",
          `${current.path}/step`,
          "Loop steps must be positive compile-time integers.",
          { diagnosticFamily: "loop-step-positive", expectedCompilerDiagnosticCode: "E10061" },
        );
      }
      const range = scalarRange(counterType);
      for (const key of ["start", "end"] as const) {
        const bound = value[key];
        if (
          isRecord(bound) &&
          bound.kind === "literal" &&
          typeof bound.value === "bigint" &&
          (bound.value < range.minimum || bound.value > range.maximum)
        ) {
          return structuredDiagnostic(
            "generation-type-invalid",
            "loop-bound-out-of-range",
            `${current.path}/${key}`,
            "Loop bound lies outside the counter type.",
            {
              diagnosticFamily: "loop-bound-in-counter-range",
              expectedCompilerDiagnosticCode: "E10064",
            },
          );
        }
      }
    }
    enqueueChildren(value, current.path, pending);
  }
  return undefined;
}
