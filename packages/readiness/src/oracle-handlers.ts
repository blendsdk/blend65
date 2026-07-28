import { evaluateOracleProgram } from "./oracle-evaluator.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import type {
  DiagnosticContextV1,
  OracleHandlerIdV1,
  OracleResultV1,
  OracleSuite,
} from "./oracle-model.js";
import { prepareOracleRequest, type PreparedOracleRequest } from "./oracle-request.js";
import { resolveOracleRoute } from "./oracle-routing.js";
import { diagnosticAuthorityKey, getOracleSuiteState, oracleAuthorityKey } from "./oracle-suite.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function canonicalIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) && String(index) === value ? index : undefined;
}

function deriveDiagnosticContext(prepared: PreparedOracleRequest): DiagnosticContextV1 | undefined {
  const projection = prepared.modeledCase.projection;
  if (projection.kind !== "invalid") return undefined;
  const transform = projection.transform;
  if (transform.kind === "parameter-binding-replace") return undefined;
  const path =
    transform.kind === "scalar-expression-replace" ? transform.expressionPath : transform.callPath;
  const segments = path.split("/");
  if (segments[0] !== "") return undefined;

  if (transform.kind === "scalar-expression-replace") {
    if (segments.length === 4 && segments[1] === "constants" && segments[3] === "value") {
      const constantIndex = canonicalIndex(segments[2]);
      return constantIndex !== undefined &&
        projection.baseline.constants[constantIndex] !== undefined
        ? "initializer"
        : undefined;
    }
    if (segments.length !== 6 || segments[1] !== "functions" || segments[3] !== "body") {
      return undefined;
    }
    const functionIndex = canonicalIndex(segments[2]);
    const statementIndex = canonicalIndex(segments[4]);
    if (functionIndex === undefined || statementIndex === undefined) return undefined;
    const statement = projection.baseline.functions[functionIndex]?.body[statementIndex];
    if (segments[5] === "initializer" && statement?.kind === "local") return "initializer";
    if (segments[5] === "value" && statement?.kind === "assign") return "assignment";
    if (segments[5] === "value" && statement?.kind === "return") return "return-expression";
    return undefined;
  }

  if (transform.kind !== "intrinsic-argument-replace") return undefined;
  if (
    (segments.length !== 5 && segments.length !== 6) ||
    segments[1] !== "functions" ||
    segments[3] !== "body"
  ) {
    return undefined;
  }
  const functionIndex = canonicalIndex(segments[2]);
  const statementIndex = canonicalIndex(segments[4]);
  if (functionIndex === undefined || statementIndex === undefined) return undefined;
  const statement = projection.baseline.functions[functionIndex]?.body[statementIndex];
  if (segments.length === 5 && statement?.kind === "memory-write") return "intrinsic-argument";
  return segments.length === 6 &&
    segments[5] === "value" &&
    statement?.kind === "return" &&
    statement.value?.kind === "memory-read"
    ? "intrinsic-argument"
    : undefined;
}

function unmodeled(
  reason: Extract<OracleResultV1, { readonly outcome: "oracle-unmodeled" }>["reason"],
): OracleResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "oracle-unmodeled",
    reason,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function evaluateOracleHandler(
  suite: OracleSuite,
  expectedHandler: OracleHandlerIdV1,
  input: unknown,
  evaluateValidProjection: boolean,
): OracleResultV1 {
  try {
    const prepared = prepareOracleRequest(suite, expectedHandler, input);
    if ("ok" in prepared) return prepared;
    const state = getOracleSuiteState(suite);
    if (state === undefined) {
      return oracleFailure(
        "oracle.authority.not-accepted",
        "/suite",
        "Oracle suite capability is not accepted.",
      );
    }
    const route = resolveOracleRoute(suite, {
      handlerId: prepared.request.handlerId,
      ruleId: prepared.request.ruleId,
      observable: prepared.request.observable,
      projectionKind: prepared.projectionKind,
    });
    if (!route.ok) return route;
    if (route.outcome === "oracle-unmodeled") return route;
    if (prepared.projectionKind === "valid") {
      if (!evaluateValidProjection) return unmodeled("evaluator-unavailable");
      const module =
        prepared.modeledCase.projection.kind === "valid"
          ? prepared.modeledCase.projection.module
          : prepared.modeledCase.projection.baseline;
      return evaluateOracleProgram({
        schemaVersion: 1,
        module,
        entryFunction: prepared.request.entryFunction,
        parameterBindings: prepared.generatedCase.effectiveParameterBindings,
        memory: prepared.request.memory,
        budget: prepared.request.budget,
      });
    }
    if (prepared.modeledCase.validity.kind !== "invalid") {
      return oracleFailure(
        "oracle.contract.invalid",
        "/case/validity",
        "Invalid projection lacks its exact invalid-neighbor contract.",
      );
    }
    if (route.authority === "diagnostic-manifest") {
      const ruleId = prepared.modeledCase.primaryRuleId;
      const neighborId = prepared.modeledCase.validity.neighborId;
      const genericKey = diagnosticAuthorityKey(ruleId, neighborId, undefined);
      let record = state.diagnosticsByKey.get(genericKey);
      if (record === undefined) {
        const context = deriveDiagnosticContext(prepared);
        if (context === undefined) {
          return oracleFailure(
            "oracle.contract.invalid",
            "/case/projection/transform",
            "Generated source context cannot select qualified diagnostic authority.",
          );
        }
        record = state.diagnosticsByKey.get(diagnosticAuthorityKey(ruleId, neighborId, context));
      }
      if (record === undefined) {
        return oracleFailure(
          "oracle.authority.missing",
          "/diagnosticManifestBytes/records",
          "Diagnostic authority is missing the regenerated invalid neighbor.",
        );
      }
      return Object.freeze({
        ok: true,
        outcome: "modeled",
        observation: Object.freeze({
          kind: "diagnostic",
          ruleId: record.ruleId,
          neighborId: record.neighborId,
          code: record.diagnosticCode,
          phase: record.phase,
          severity: record.severity,
        }),
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    if (route.authority === "binding-rejections") {
      const key = oracleAuthorityKey(
        prepared.modeledCase.primaryRuleId,
        prepared.modeledCase.validity.neighborId,
      );
      const record = state.bindingsByKey.get(key);
      if (record === undefined) {
        return oracleFailure(
          "oracle.authority.missing",
          "/bindingRejectionBytes/records",
          "Binding authority is missing the regenerated invalid neighbor.",
        );
      }
      return Object.freeze({
        ok: true,
        outcome: "modeled",
        observation: Object.freeze({ kind: "binding-rejection", ...record }),
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    return oracleFailure(
      "oracle.contract.invalid",
      "/case/projection",
      "Invalid projection resolved without its required authority.",
    );
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle request could not be inspected safely.",
    );
  }
}

/**
 * Evaluates a raw frontend-result request through the legacy bootstrap façade.
 *
 * Valid value-state routes deliberately remain evaluator-unavailable. Use
 * {@link evaluateSourceOracleCase} for evaluator-backed source cases.
 *
 * @param suite Factory-created source-authoring suite.
 * @param request Hostile frontend oracle request.
 * @returns Closed raw result without published evidence.
 *
 * @example
 * ```ts
 * const result = evaluateFrontendResultOracle(suite, request);
 * ```
 */
export function evaluateFrontendResultOracle(suite: OracleSuite, request: unknown): OracleResultV1 {
  return evaluateOracleHandler(suite, "oracle.frontend-result", request, false);
}

/**
 * Evaluates a raw compiler-result request through the legacy bootstrap façade.
 *
 * Valid value-state routes deliberately remain evaluator-unavailable. Use
 * {@link evaluateSourceOracleCase} for evaluator-backed source cases.
 *
 * @param suite Factory-created source-authoring suite.
 * @param request Hostile compiler oracle request.
 * @returns Closed raw result without published evidence.
 *
 * @example
 * ```ts
 * const result = evaluateCompilerResultOracle(suite, request);
 * ```
 */
export function evaluateCompilerResultOracle(suite: OracleSuite, request: unknown): OracleResultV1 {
  return evaluateOracleHandler(suite, "oracle.compiler-result", request, false);
}

/**
 * Evaluates a raw emitted-program request through the legacy bootstrap façade.
 *
 * Valid value-state routes deliberately remain evaluator-unavailable. Use
 * {@link evaluateSourceOracleCase} for evaluator-backed source cases.
 *
 * @param suite Factory-created source-authoring suite.
 * @param request Hostile emitted-program oracle request.
 * @returns Closed raw result without published evidence.
 *
 * @example
 * ```ts
 * const result = evaluateEmittedProgramOracle(suite, request);
 * ```
 */
export function evaluateEmittedProgramOracle(suite: OracleSuite, request: unknown): OracleResultV1 {
  return evaluateOracleHandler(suite, "oracle.emitted-program", request, false);
}

/**
 * Evaluates a raw runtime-state request through the legacy bootstrap façade.
 *
 * Valid value-state routes deliberately remain evaluator-unavailable. Use
 * {@link evaluateSourceOracleCase} for evaluator-backed source cases.
 *
 * @param suite Factory-created source-authoring suite.
 * @param request Hostile runtime oracle request.
 * @returns Closed raw result without published evidence.
 *
 * @example
 * ```ts
 * const result = evaluateRuntimeStateOracle(suite, request);
 * ```
 */
export function evaluateRuntimeStateOracle(suite: OracleSuite, request: unknown): OracleResultV1 {
  return evaluateOracleHandler(suite, "oracle.runtime-state", request, false);
}

/**
 * Evaluates one replay-authenticated source case through its exact raw façade.
 *
 * The wrapper snapshots the request before reading its handler discriminator.
 * Valid cases then reach the same private evaluator used by conformance tests;
 * invalid projections retain their independently reviewed authority routes.
 *
 * @param suite Factory-created source-authoring suite.
 * @param request Hostile raw oracle request.
 * @returns Closed non-authoritative raw result.
 *
 * @example
 * ```ts
 * const result = evaluateSourceOracleCase(suite, request);
 * ```
 */
export function evaluateSourceOracleCase(suite: OracleSuite, request: unknown): OracleResultV1 {
  const snapshot = snapshotOracleInput(request);
  if (!snapshot.ok) return snapshot;
  if (
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, [
      "schemaVersion",
      "handlerId",
      "ruleId",
      "sourceProvenance",
      "case",
      "entryFunction",
      "memory",
      "budget",
      "observable",
    ])
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle request must use the exact closed shape.",
    );
  }
  const handlerId = snapshot.value.handlerId;
  if (
    handlerId !== "oracle.frontend-result" &&
    handlerId !== "oracle.compiler-result" &&
    handlerId !== "oracle.emitted-program" &&
    handlerId !== "oracle.runtime-state"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/handlerId",
      "Oracle handler ID is not supported.",
    );
  }
  return evaluateOracleHandler(suite, handlerId, snapshot.value, true);
}
