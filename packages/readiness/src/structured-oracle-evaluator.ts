import { createHash } from "node:crypto";

import { validateStructuredGenerationBudgetV2 } from "./generation-budget.js";
import type {
  GenArrayPlacementFixtureV1,
  GenIdentifier,
  GenStructuredFunction,
  GenStructuredModule,
  GenStructuredStatement,
} from "./generator-ir.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { ParameterValueBinding } from "./modeled-generator-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { createOracleBudgetMeter, validateOracleBudget } from "./oracle-budget.js";
import {
  oracleMutationDispatchMarker,
  selectedOracleMutationVariant,
} from "./oracle-conformance-v1.js";
import { validateOracleMemoryFixture } from "./oracle-memory.js";
import type {
  OracleDiagnostic,
  OracleUnmodeledReason,
  ValueStateObservationV1,
} from "./oracle-model.js";
import type { StructuredOracleProgramInputV2 } from "./structured-case-families.js";
import {
  validateStructuredGeneratorProgram,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-validation.js";
import {
  executeStructuredOracleRuntimeV2,
  StructuredOracleBudgetError,
  type StructuredOracleRuntimeMutationsV2,
} from "./structured-oracle-runtime.js";

/** One exact finite-loop iteration recorded by the independent evaluator. */
export interface StructuredLoopTraceEntryV2 {
  readonly loopPath: string;
  readonly counter: string;
  readonly value: bigint;
}

/** One exact generated-array access recorded by the independent evaluator. */
export interface StructuredArrayAccessTraceEntryV2 {
  readonly expressionPath: string;
  readonly arrayName: string;
  readonly index: bigint;
  readonly effectiveAddress: bigint;
}

/** Closed result returned by independent structured evaluation. */
export type StructuredOracleProgramResultV2 =
  | {
      readonly ok: true;
      readonly outcome: "modeled";
      readonly observation: ValueStateObservationV1;
      readonly loopTrace: readonly StructuredLoopTraceEntryV2[];
      readonly arrayAccessTrace: readonly StructuredArrayAccessTraceEntryV2[];
      readonly evaluationIdentity: Sha256Digest;
      readonly arrayPlacementIdentity?: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "oracle-unmodeled";
      readonly reason: OracleUnmodeledReason;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly (OracleDiagnostic | StructuredGenerationDiagnosticV2)[];
    };

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const INPUT_KEYS = [
  "schemaVersion",
  "handlerId",
  "module",
  "entryFunction",
  "parameterBindings",
  "memory",
  "generationBudget",
  "budget",
  "expectationAuthority",
] as const;
const PLACED_INPUT_KEYS = [...INPUT_KEYS, "arrayPlacement"] as const;
const MUTATIONS = Object.freeze({
  unscaledIndex: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.index-address",
    "unscaled-index-v1",
  ),
  copyArray: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.array-parameter",
    "copy-argument-v1",
  ),
  aliasScalar: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.scalar-parameter",
    "alias-caller-v1",
  ),
  reverseArguments: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.call-arguments",
    "right-to-left-v1",
  ),
  oppositeBranch: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.branch-selection",
    "opposite-arm-v1",
  ),
  wrappedLoop: oracleMutationDispatchMarker(
    "oracle.structured-program",
    "oracle.structured.loop-domain",
    "wrapped-terminal-counter-v1",
  ),
});

/** Every independently observable mutation branch in structured evaluation. */
export const STRUCTURED_ORACLE_MUTATION_PATHS = Object.freeze(Object.values(MUTATIONS));

/** Every loop-relation mutation branch added with structured evaluation. */
export const STRUCTURED_RELATION_MUTATION_PATHS = Object.freeze([
  oracleMutationDispatchMarker(
    "relation.loop-unrolling",
    "relation.loop-unrolling.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.loop-unrolling",
    "relation.loop-unrolling.rewrite",
    "non-preserving.unroll-exact-domain-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.loop-unrolling",
    "relation.loop-unrolling.rewrite",
    "semantic-closure-invalid-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.loop-unrolling",
    "relation.loop-unrolling.comparator",
    "omit-required-observable-v1",
  ),
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function oracleFailure(
  code: OracleDiagnostic["code"],
  path: string,
  message: string,
): StructuredOracleProgramResultV2 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function scalarRange(type: Exclude<GenStructuredFunction["returnType"], "boolean" | "void">): {
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

function closeParameterBindings(
  input: readonly unknown[],
  entryFunction: GenStructuredFunction,
  functionIndex: number,
): readonly ParameterValueBinding[] | undefined {
  if (input.length !== entryFunction.parameters.length) return undefined;
  const bindings: ParameterValueBinding[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    const parameter = entryFunction.parameters[index];
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["kind", "parameterPath", "value"]) ||
      value.kind !== "parameter-value" ||
      value.parameterPath !== `/functions/${functionIndex}/parameters/${index}` ||
      parameter === undefined ||
      ("kind" in parameter && parameter.kind === "array-parameter")
    ) {
      return undefined;
    }
    if (parameter.type === "boolean") {
      if (typeof value.value !== "boolean") return undefined;
    } else {
      if (typeof value.value !== "bigint") return undefined;
      const range = scalarRange(parameter.type);
      if (value.value < range.minimum || value.value > range.maximum) return undefined;
    }
    bindings.push(
      Object.freeze({
        kind: "parameter-value",
        parameterPath: value.parameterPath,
        value: value.value,
      }),
    );
  }
  return Object.freeze(bindings);
}

function collectArrayDeclarationNames(module: GenStructuredModule): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const visit = (statements: readonly GenStructuredStatement[]): void => {
    for (const statement of statements) {
      if (statement.kind === "array") {
        counts.set(statement.name, (counts.get(statement.name) ?? 0) + 1);
      } else if (statement.kind === "if") {
        visit(statement.thenBody);
        visit(statement.elseBody);
      } else if (
        statement.kind === "while" ||
        statement.kind === "do-while" ||
        statement.kind === "for"
      ) {
        visit(statement.body);
      }
    }
  };
  module.functions.forEach((fn) => visit(fn.body));
  return counts;
}

function closeArrayPlacement(
  input: unknown,
  module: GenStructuredModule,
): GenArrayPlacementFixtureV1 | undefined {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ["revision", "bindings"]) ||
    input.revision !== "structured-array-placement-v1" ||
    !Array.isArray(input.bindings) ||
    input.bindings.length === 0
  ) {
    return undefined;
  }
  const bindings: { readonly arrayName: GenIdentifier; readonly baseAddress: number }[] = [];
  const names = new Set<string>();
  const available = collectArrayDeclarationNames(module);
  for (const value of input.bindings) {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["arrayName", "baseAddress"]) ||
      !isGenIdentifier(value.arrayName) ||
      typeof value.baseAddress !== "number" ||
      !Number.isSafeInteger(value.baseAddress) ||
      value.baseAddress < 0 ||
      value.baseAddress > 0xffff ||
      names.has(value.arrayName) ||
      available.get(value.arrayName) !== 1
    ) {
      return undefined;
    }
    names.add(value.arrayName);
    bindings.push(Object.freeze({ arrayName: value.arrayName, baseAddress: value.baseAddress }));
  }
  return Object.freeze({
    revision: "structured-array-placement-v1",
    bindings: Object.freeze(bindings),
  });
}

function closeIdentifier(value: unknown) {
  return isGenIdentifier(value) ? value : undefined;
}

function digest(value: string): Sha256Digest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalIdentityJson(value: unknown): string {
  return JSON.stringify(value, (_key, member: unknown) =>
    typeof member === "bigint" ? { $bigint: member.toString(10) } : member,
  );
}

function deriveArrayPlacementIdentity(input: GenArrayPlacementFixtureV1): Sha256Digest {
  return digest(`blend65.readiness.structured-array-placement.v1\0${canonicalIdentityJson(input)}`);
}

/**
 * Derives the canonical identity of one already-closed structured oracle request.
 *
 * The function accepts a typed authority input so invalid-neighbor programs can still carry the
 * exact identity of the independent expectation that rejects them. Callers must authenticate the
 * input separately; a digest is evidence identity, not an authority capability.
 *
 * @param input Closed structured oracle request owned by an authenticated case.
 * @returns Domain-separated digest of every field that can affect validation or evaluation.
 *
 * @example
 * ```ts
 * const identity = deriveStructuredOracleEvaluationIdentityV2(authority.oracleInput);
 * ```
 */
export function deriveStructuredOracleEvaluationIdentityV2(
  input: StructuredOracleProgramInputV2,
): Sha256Digest {
  const placementIdentity =
    input.arrayPlacement === undefined ? null : deriveArrayPlacementIdentity(input.arrayPlacement);
  return digest(
    `blend65.readiness.structured-oracle-evaluation.v2\0${canonicalIdentityJson({
      schemaVersion: input.schemaVersion,
      handlerId: input.handlerId,
      expectationAuthority: input.expectationAuthority,
      module: input.module,
      entryFunction: input.entryFunction,
      parameterBindings: input.parameterBindings,
      memory: input.memory,
      arrayPlacementIdentity: placementIdentity,
      generationBudget: input.generationBudget,
      budget: input.budget,
    })}`,
  );
}

function selectedMutations(): StructuredOracleRuntimeMutationsV2 {
  return Object.freeze({
    unscaledIndex: selectedOracleMutationVariant(MUTATIONS.unscaledIndex) !== undefined,
    copyArray: selectedOracleMutationVariant(MUTATIONS.copyArray) !== undefined,
    aliasScalar: selectedOracleMutationVariant(MUTATIONS.aliasScalar) !== undefined,
    reverseArguments: selectedOracleMutationVariant(MUTATIONS.reverseArguments) !== undefined,
    oppositeBranch: selectedOracleMutationVariant(MUTATIONS.oppositeBranch) !== undefined,
    wrappedLoop: selectedOracleMutationVariant(MUTATIONS.wrappedLoop) !== undefined,
  });
}

/**
 * Independently evaluates one validated structured program without consulting compiler output.
 *
 * @param input Unknown closed structured-oracle request.
 * @returns Exact value-state observation and traces, or stable validation diagnostics.
 *
 * @example
 * ```ts
 * const result = evaluateStructuredOracleProgram(input);
 * ```
 */
export function evaluateStructuredOracleProgram(input: unknown): StructuredOracleProgramResultV2 {
  if (!isRecord(input)) {
    return oracleFailure("oracle.input.invalid", "", "Structured oracle input must be a record.");
  }
  if (input.expectationAuthority !== "independent-structured-oracle-v2") {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/expectationAuthority",
      "Expectation authority is not accepted.",
    );
  }
  const expectedKeys = Object.hasOwn(input, "arrayPlacement") ? PLACED_INPUT_KEYS : INPUT_KEYS;
  if (
    !hasExactKeys(input, expectedKeys) ||
    input.schemaVersion !== 2 ||
    input.handlerId !== "oracle.structured-program"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Structured oracle input must use the exact closed shape.",
    );
  }
  const validation = validateStructuredGeneratorProgram(input.module, input.generationBudget);
  if (!validation.ok) return validation;
  const generationBudget = validateStructuredGenerationBudgetV2(input.generationBudget);
  const budget = validateOracleBudget(input.budget);
  const memory = validateOracleMemoryFixture(input.memory);
  const entryFunction = closeIdentifier(input.entryFunction);
  if (!generationBudget.ok || !budget.ok || !memory.ok || entryFunction === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Structured oracle scalar inputs are invalid.",
    );
  }
  const entryIndex = validation.module.functions.findIndex((fn) => fn.name === entryFunction);
  const entry = validation.module.functions[entryIndex];
  if (entry === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function is unavailable.",
    );
  }
  const parameterBindings = Array.isArray(input.parameterBindings)
    ? closeParameterBindings(input.parameterBindings, entry, entryIndex)
    : undefined;
  if (parameterBindings === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/parameterBindings",
      "Entry parameter bindings must exactly match scalar parameters in declaration order.",
    );
  }
  const hasPlacement = Object.hasOwn(input, "arrayPlacement");
  const arrayPlacement = hasPlacement
    ? closeArrayPlacement(input.arrayPlacement, validation.module)
    : undefined;
  if (hasPlacement && arrayPlacement === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/arrayPlacement",
      "Array placement must name a non-empty unique population of module arrays.",
    );
  }
  const closedInput: StructuredOracleProgramInputV2 = Object.freeze({
    schemaVersion: 2,
    handlerId: "oracle.structured-program",
    module: validation.module,
    entryFunction,
    parameterBindings,
    memory: memory.memory,
    ...(arrayPlacement === undefined ? {} : { arrayPlacement }),
    generationBudget: generationBudget.budget,
    budget: budget.budget,
    expectationAuthority: "independent-structured-oracle-v2",
  });
  const meter = createOracleBudgetMeter(budget.budget);
  const initialCharges = [
    {
      dimension: "inputNodes" as const,
      amount:
        validation.usage["ir-nodes"] +
        BigInt(parameterBindings.length) +
        BigInt(memory.memory.cells.length),
      path: "/module",
    },
    {
      dimension: "expressionDepth" as const,
      amount: validation.usage["expression-depth"],
      path: "/module",
    },
    {
      dimension: "memoryCells" as const,
      amount: BigInt(memory.memory.cells.length),
      path: "/memory/cells",
    },
  ];
  for (const charge of initialCharges) {
    if (charge.amount === 0n) continue;
    const charged = meter.charge(charge.dimension, charge.amount, charge.path);
    if (!charged.ok) return Object.freeze({ ok: false, diagnostics: charged.diagnostics });
  }
  try {
    const runtime = executeStructuredOracleRuntimeV2(closedInput, selectedMutations(), meter);
    const evaluationIdentity = deriveStructuredOracleEvaluationIdentityV2(closedInput);
    const placementIdentity =
      closedInput.arrayPlacement === undefined
        ? undefined
        : deriveArrayPlacementIdentity(closedInput.arrayPlacement);
    return Object.freeze({
      ok: true,
      outcome: "modeled",
      observation: runtime.observation,
      loopTrace: runtime.loopTrace,
      arrayAccessTrace: runtime.arrayAccessTrace,
      evaluationIdentity,
      ...(placementIdentity === undefined ? {} : { arrayPlacementIdentity: placementIdentity }),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch (error) {
    return error instanceof StructuredOracleBudgetError
      ? oracleFailure("oracle.budget", "/budget", "Structured oracle budget was exceeded.")
      : oracleFailure(
          "oracle.input.invalid",
          "",
          "Structured oracle evaluation could not be completed.",
        );
  }
}
