import { Buffer } from "node:buffer";

import type { GeneratedCase } from "./campaign-model.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { GenFunction, GenModule, ScalarType } from "./generator-ir.js";
import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import {
  ORACLE_V1_LIMITS,
  type MemoryFixtureV1,
  type OracleBudgetV1,
  type OracleHandlerIdV1,
  type OracleObservableV1,
  type OracleProjectionKindV1,
  type OracleRequestV1,
  type OracleResultV1,
  type OracleSuite,
} from "./oracle-model.js";
import { validateOracleReplay } from "./oracle-provenance.js";
import { getOracleSuiteState } from "./oracle-suite.js";
import { isRuleModelId } from "./rule-model-registry.js";

/** Immutable request state proven safe for raw oracle dispatch. */
export interface PreparedOracleRequest {
  /** Closed request reconstructed from exact replay authority. */
  readonly request: OracleRequestV1;
  /** Complete regenerated campaign case retaining external bindings. */
  readonly generatedCase: GeneratedCase;
  /** Regenerated modeled case selected by the request. */
  readonly modeledCase: GeneratedModeledCase;
  /** Unique entry function selected from the modeled module. */
  readonly entryFunction: GenFunction;
  /** Exact valid or invalid projection family used for authority routing. */
  readonly projectionKind: OracleProjectionKindV1;
}

const REQUEST_KEYS = [
  "schemaVersion",
  "handlerId",
  "ruleId",
  "sourceProvenance",
  "case",
  "entryFunction",
  "memory",
  "budget",
  "observable",
] as const;
const BUDGET_KEYS = [
  "inputNodes",
  "expressionDepth",
  "evaluationSteps",
  "frames",
  "memoryCells",
  "effects",
  "transformedNodes",
] as const;
const MEMORY_KEYS = ["schemaVersion", "cells"] as const;
const CELL_KEYS = ["address", "value"] as const;

function isHandlerId(value: unknown): value is OracleHandlerIdV1 {
  return (
    value === "oracle.frontend-result" ||
    value === "oracle.compiler-result" ||
    value === "oracle.emitted-program" ||
    value === "oracle.runtime-state"
  );
}

function parseObservable(value: unknown): OracleObservableV1 | undefined {
  return isOracleRecord(value) &&
    hasExactOracleKeys(value, ["kind"]) &&
    (value.kind === "diagnostic" || value.kind === "value-state")
    ? Object.freeze({ kind: value.kind })
    : undefined;
}

function positiveBudgetValue(value: unknown, maximum: bigint): value is bigint {
  return typeof value === "bigint" && value > 0n && value <= maximum;
}

function parseBudget(value: unknown): OracleBudgetV1 | OracleResultV1 {
  if (!isOracleRecord(value) || !hasExactOracleKeys(value, BUDGET_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/budget",
      "Oracle budget must use the exact closed shape.",
    );
  }
  const maxima: Readonly<Record<(typeof BUDGET_KEYS)[number], bigint>> = Object.freeze({
    inputNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
    expressionDepth: BigInt(ORACLE_V1_LIMITS.inputDepth),
    evaluationSteps: ORACLE_V1_LIMITS.executionEvents,
    frames: ORACLE_V1_LIMITS.executionEvents,
    memoryCells: ORACLE_V1_LIMITS.memoryCells,
    effects: ORACLE_V1_LIMITS.executionEvents,
    transformedNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
  });
  for (const key of BUDGET_KEYS) {
    if (!positiveBudgetValue(value[key], maxima[key])) {
      return oracleFailure(
        "oracle.input.invalid",
        `/budget/${key}`,
        "Oracle budget fields must be positive bounded integers.",
      );
    }
  }
  if (
    typeof value.inputNodes !== "bigint" ||
    typeof value.expressionDepth !== "bigint" ||
    typeof value.evaluationSteps !== "bigint" ||
    typeof value.frames !== "bigint" ||
    typeof value.memoryCells !== "bigint" ||
    typeof value.effects !== "bigint" ||
    typeof value.transformedNodes !== "bigint"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/budget",
      "Oracle budget fields must be integers.",
    );
  }
  return Object.freeze({
    inputNodes: value.inputNodes,
    expressionDepth: value.expressionDepth,
    evaluationSteps: value.evaluationSteps,
    frames: value.frames,
    memoryCells: value.memoryCells,
    effects: value.effects,
    transformedNodes: value.transformedNodes,
  });
}

function parseMemory(value: unknown, budget: OracleBudgetV1): MemoryFixtureV1 | OracleResultV1 {
  if (
    !isOracleRecord(value) ||
    !hasExactOracleKeys(value, MEMORY_KEYS) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.cells)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/memory",
      "Memory fixture must use the exact version-one shape.",
    );
  }
  if (BigInt(value.cells.length) > ORACLE_V1_LIMITS.memoryCells) {
    return oracleFailure(
      "oracle.input.limit",
      "/memory/cells",
      "Memory fixture exceeds the initialized-cell hard limit.",
    );
  }
  if (BigInt(value.cells.length) > budget.memoryCells) {
    return oracleFailure(
      "oracle.budget",
      "/memory/cells",
      "Memory fixture exceeds the selected memory-cell budget.",
    );
  }
  const cells: { readonly address: bigint; readonly value: bigint }[] = [];
  let previousAddress = -1n;
  for (let index = 0; index < value.cells.length; index += 1) {
    const cell = value.cells[index];
    const path = `/memory/cells/${index}`;
    if (!isOracleRecord(cell) || !hasExactOracleKeys(cell, CELL_KEYS)) {
      return oracleFailure(
        "oracle.input.invalid",
        path,
        "Memory cell must use the exact closed shape.",
      );
    }
    if (typeof cell.address !== "bigint" || cell.address < 0n || cell.address > 65_535n) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/address`,
        "Memory address must be an unsigned 16-bit integer.",
      );
    }
    if (typeof cell.value !== "bigint" || cell.value < 0n || cell.value > 255n) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/value`,
        "Memory cell value must be an unsigned byte.",
      );
    }
    if (cell.address <= previousAddress) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/address`,
        "Memory cells must be unique and ordered by address.",
      );
    }
    previousAddress = cell.address;
    cells.push(Object.freeze({ address: cell.address, value: cell.value }));
  }
  return Object.freeze({ schemaVersion: 1, cells: Object.freeze(cells) });
}

function moduleForCase(modeledCase: GeneratedModeledCase): GenModule {
  return modeledCase.projection.kind === "valid"
    ? modeledCase.projection.module
    : modeledCase.projection.baseline;
}

function projectionKind(modeledCase: GeneratedModeledCase): OracleProjectionKindV1 {
  return modeledCase.projection.kind === "valid"
    ? "valid"
    : modeledCase.projection.transform.kind === "parameter-binding-replace"
      ? "invalid-parameter-binding"
      : "invalid-source-transform";
}

function scalarRange(type: ScalarType): readonly [bigint, bigint] | undefined {
  switch (type) {
    case "byte":
      return [0n, 255n];
    case "sbyte":
      return [-128n, 127n];
    case "word":
      return [0n, 65_535n];
    case "sword":
      return [-32_768n, 32_767n];
    case "boolean":
      return undefined;
  }
}

function bindingMatchesType(value: bigint | boolean, type: ScalarType): boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (typeof value !== "bigint") return false;
  const range = scalarRange(type);
  return range !== undefined && value >= range[0] && value <= range[1];
}

function validateEntryBindings(
  generatedCase: GeneratedCase,
  fn: GenFunction,
  functionIndex: number,
  allowInvalidBinding: boolean,
): OracleResultV1 | undefined {
  const bindings = generatedCase.effectiveParameterBindings;
  if (bindings.length !== fn.parameters.length) {
    return oracleFailure(
      "oracle.input.invalid",
      "/case/parameterBindings",
      "Entry parameters require one exact external binding each.",
    );
  }
  for (let index = 0; index < fn.parameters.length; index += 1) {
    const parameter = fn.parameters[index];
    const binding = bindings[index];
    if (
      parameter === undefined ||
      binding === undefined ||
      binding.parameterPath !== `/functions/${functionIndex}/parameters/${index}`
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        "/case/parameterBindings",
        "External parameter bindings must follow entry declaration order.",
      );
    }
    if (!allowInvalidBinding && !bindingMatchesType(binding.value, parameter.type)) {
      return oracleFailure(
        "oracle.input.invalid",
        `/case/parameterBindings/${index}/value`,
        "External parameter value does not match its declared type.",
      );
    }
  }
  return undefined;
}

/**
 * Snapshots and validates one hostile raw oracle request before authority dispatch.
 *
 * @param suite Factory-created source-authoring suite.
 * @param expectedHandler Façade identity selected by the invoked public function.
 * @param input Hostile request candidate.
 * @returns Immutable replay-verified request state or a closed oracle failure.
 *
 * @example
 * ```ts
 * const prepared = prepareOracleRequest(suite, "oracle.frontend-result", request);
 * ```
 */
export function prepareOracleRequest(
  suite: OracleSuite,
  expectedHandler: OracleHandlerIdV1,
  input: unknown,
): PreparedOracleRequest | OracleResultV1 {
  const state = getOracleSuiteState(suite);
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/suite",
      "Oracle suite capability is not accepted.",
    );
  }
  const snapshot = snapshotOracleInput(input);
  if (!snapshot.ok) return snapshot;
  if (BigInt(snapshot.nodes) > ORACLE_V1_LIMITS.executionEvents) {
    return oracleFailure("oracle.input.limit", "", "Oracle request exceeds the hard node limit.");
  }
  if (!isOracleRecord(snapshot.value) || !hasExactOracleKeys(snapshot.value, REQUEST_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle request must use the exact closed shape.",
    );
  }
  const value = snapshot.value;
  if (value.schemaVersion !== 1) {
    return oracleFailure(
      "oracle.input.invalid",
      "/schemaVersion",
      "Oracle request schema version must be one.",
    );
  }
  if (!isHandlerId(value.handlerId)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/handlerId",
      "Oracle handler ID is not supported.",
    );
  }
  if (value.handlerId !== expectedHandler) {
    return oracleFailure(
      "oracle.route.invalid",
      "/handlerId",
      "Request handler does not match the invoked oracle façade.",
    );
  }
  if (
    !isRuleModelId(value.ruleId) ||
    Buffer.byteLength(value.ruleId, "utf8") > ORACLE_V1_LIMITS.identifierBytes
  ) {
    return oracleFailure("oracle.input.invalid", "/ruleId", "Oracle rule ID is not canonical.");
  }
  if (
    !isGenIdentifier(value.entryFunction) ||
    Buffer.byteLength(value.entryFunction, "utf8") > ORACLE_V1_LIMITS.identifierBytes
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function name is not canonical.",
    );
  }
  const observable = parseObservable(value.observable);
  if (observable === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/observable",
      "Oracle observable must use the exact closed shape.",
    );
  }
  const budget = parseBudget(value.budget);
  if ("ok" in budget) return budget;
  if (
    BigInt(snapshot.nodes) > budget.inputNodes ||
    BigInt(snapshot.depth) > budget.expressionDepth
  ) {
    return oracleFailure(
      "oracle.budget",
      "",
      "Oracle request exceeds the selected structural budget.",
    );
  }
  const memory = parseMemory(value.memory, budget);
  if ("ok" in memory) return memory;
  const replay = validateOracleReplay({
    sourceProvenance: value.sourceProvenance,
    generatedCase: value.case,
    registry: state.replayRegistry,
    modeledSuite: state.modeledSuite,
    inventoryVersion: state.inventory.inventoryVersion,
  });
  if (!replay.ok) return replay;

  const modeledCase = replay.generatedCase.modeledCase;
  if (modeledCase.primaryRuleId !== value.ruleId) {
    return oracleFailure(
      "oracle.input.invalid",
      "/ruleId",
      "Request rule does not match the regenerated case.",
    );
  }
  const module = moduleForCase(modeledCase);
  const entries = module.functions
    .map((fn, index) => ({ fn, index }))
    .filter(({ fn }) => fn.name === value.entryFunction);
  if (entries.length !== 1 || entries[0] === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function must resolve exactly once.",
    );
  }
  const kind = projectionKind(modeledCase);
  const bindingFailure = validateEntryBindings(
    replay.generatedCase,
    entries[0].fn,
    entries[0].index,
    kind === "invalid-parameter-binding",
  );
  if (bindingFailure !== undefined) return bindingFailure;
  const request: OracleRequestV1 = Object.freeze({
    schemaVersion: 1,
    handlerId: value.handlerId,
    ruleId: value.ruleId,
    sourceProvenance: replay.provenance,
    case: modeledCase,
    entryFunction: value.entryFunction,
    memory,
    budget,
    observable,
  });
  return Object.freeze({
    request,
    generatedCase: replay.generatedCase,
    modeledCase,
    entryFunction: entries[0].fn,
    projectionKind: kind,
  });
}
