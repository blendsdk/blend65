import { Buffer } from "node:buffer";

import { isRuleModelId } from "./rule-model-registry.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import {
  ORACLE_V1_LIMITS,
  type OracleHandlerIdV1,
  type OracleObservableV1,
  type OracleProjectionKindV1,
  type OracleRouteQueryV1,
  type OracleRouteResultV1,
  type OracleSuite,
  type OracleUnmodeledReason,
} from "./oracle-model.js";
import { getOracleSuiteState } from "./oracle-suite.js";

const QUERY_KEYS = ["handlerId", "ruleId", "observable", "projectionKind"] as const;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function isHandlerId(value: unknown): value is OracleHandlerIdV1 {
  return (
    value === "oracle.frontend-result" ||
    value === "oracle.compiler-result" ||
    value === "oracle.emitted-program" ||
    value === "oracle.runtime-state"
  );
}

function parseObservable(value: unknown): OracleObservableV1 | undefined {
  if (
    !isOracleRecord(value) ||
    !hasExactOracleKeys(value, ["kind"]) ||
    (value.kind !== "diagnostic" && value.kind !== "value-state")
  ) {
    return undefined;
  }
  return Object.freeze({ kind: value.kind });
}

function isProjectionKind(value: unknown): value is OracleProjectionKindV1 {
  return (
    value === "valid" ||
    value === "invalid-source-transform" ||
    value === "invalid-parameter-binding"
  );
}

function parseQuery(value: unknown): OracleRouteQueryV1 | OracleRouteResultV1 {
  const snapshot = snapshotOracleInput(value);
  if (!snapshot.ok) return snapshot;
  if (!isOracleRecord(snapshot.value) || !hasExactOracleKeys(snapshot.value, QUERY_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle route query must use the exact closed shape.",
    );
  }
  const query = snapshot.value;
  if (!isHandlerId(query.handlerId)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/handlerId",
      "Oracle handler ID is not supported.",
    );
  }
  if (
    !isRuleModelId(query.ruleId) ||
    Buffer.byteLength(query.ruleId, "utf8") > ORACLE_V1_LIMITS.identifierBytes
  ) {
    return oracleFailure("oracle.input.invalid", "/ruleId", "Oracle rule ID is not canonical.");
  }
  const observable = parseObservable(query.observable);
  if (observable === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/observable",
      "Oracle observable must use the exact closed shape.",
    );
  }
  if (!isProjectionKind(query.projectionKind)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/projectionKind",
      "Oracle projection kind is not supported.",
    );
  }
  return Object.freeze({
    handlerId: query.handlerId,
    ruleId: query.ruleId,
    observable,
    projectionKind: query.projectionKind,
  });
}

function unmodeled(reason: OracleUnmodeledReason): OracleRouteResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "oracle-unmodeled",
    reason,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Resolves one exact rule, façade, observable, and projection route without fallback.
 *
 * @param suite Factory-created source-authoring capability.
 * @param query Hostile route query.
 * @returns Exact route, explicit unmodeled reason, or a closed failure.
 *
 * @example
 * ```ts
 * const route = resolveOracleRoute(suite, {
 *   handlerId: "oracle.frontend-result",
 *   ruleId,
 *   observable: { kind: "diagnostic" },
 *   projectionKind: "invalid-source-transform",
 * });
 * ```
 */
export function resolveOracleRoute(suite: OracleSuite, query: unknown): OracleRouteResultV1 {
  const state = getOracleSuiteState(suite);
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/suite",
      "Oracle suite capability is not accepted.",
    );
  }
  const parsed = parseQuery(query);
  if ("ok" in parsed) return parsed;

  const expectedHandler = state.routesByRuleId.get(parsed.ruleId);
  if (expectedHandler === undefined) return unmodeled("rule-unavailable");
  if (parsed.handlerId !== expectedHandler) return unmodeled("route-unavailable");
  if (parsed.projectionKind === "valid") {
    if (parsed.observable.kind !== "value-state") return unmodeled("unsupported-observable");
    return Object.freeze({
      ok: true,
      outcome: "routed",
      ruleId: parsed.ruleId,
      handlerId: parsed.handlerId,
      observable: parsed.observable.kind,
      authority: "none",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (parsed.observable.kind !== "diagnostic") return unmodeled("unsupported-observable");
  const authority =
    parsed.projectionKind === "invalid-source-transform"
      ? "diagnostic-manifest"
      : "binding-rejections";
  if (
    authority === "binding-rejections" &&
    ![...state.bindingsByKey.values()].some((record) => record.ruleId === parsed.ruleId)
  ) {
    return unmodeled("unsupported-semantics");
  }
  return Object.freeze({
    ok: true,
    outcome: "routed",
    ruleId: parsed.ruleId,
    handlerId: parsed.handlerId,
    observable: parsed.observable.kind,
    authority,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
