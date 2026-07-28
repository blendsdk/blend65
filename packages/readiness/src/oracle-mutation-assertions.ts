import { isDeepStrictEqual } from "node:util";

import {
  EXPECTED_BINDING_AUTHORITY,
  EXPECTED_DIAGNOSTIC_AUTHORITY,
  validateBindingAuthorityCandidate,
  validateDiagnosticAuthorityCandidate,
} from "./oracle-authority-policy.js";
import {
  runWithOracleMutationVariant,
  type OracleMutationSelectionV1,
} from "./oracle-conformance-v1.js";
import { evaluateOracleProgram } from "./oracle-evaluator.js";
import {
  oracleMutationIdForPath,
  oracleMutationPathRegistry,
  oracleMutationVectorIdForPath,
} from "./oracle-mutation-model.js";
import {
  loadOracleMutationAssertionPacket,
  normalizeOracleMutationAssertionData,
  type OracleMutationAssertionRowV1,
  type OracleMutationAssertionV1,
  type OracleMutationObservationV1,
} from "./oracle-mutation-packet.js";
import { hydrateOracleMutationSuite } from "./oracle-mutation-suite.js";
import { hasExactOracleKeys, isOracleRecord, oracleFailure } from "./oracle-input.js";
import type { OracleDiagnostic } from "./oracle-model.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";

/** Successful or failed execution of one complete canonical mutation vector. */
export type OracleMutationVectorResultV1 =
  | {
      readonly ok: true;
      readonly observation: OracleMutationObservationV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Result of evaluating one literal independent assertion. */
export type OracleMutationAssertionResultV1 =
  | { readonly ok: true; readonly passed: boolean }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const ASSERTION_KEYS = ["kind", "expected"] as const;

function vectorFailure(path: string, message: string): OracleMutationVectorResultV1 {
  return oracleFailure("oracle.contract.invalid", path, message);
}

function mappingObservation(
  row: OracleMutationAssertionRowV1,
): OracleMutationObservationV1 | undefined {
  const fixture = row.fixture;
  if (fixture.kind === "diagnostic-mapping") {
    const hasContext = Object.hasOwn(fixture, "diagnosticContext");
    const record = EXPECTED_DIAGNOSTIC_AUTHORITY.find(
      (candidate) =>
        candidate.ruleId === fixture.ruleId &&
        candidate.neighborId === fixture.neighborId &&
        Object.hasOwn(candidate, "diagnosticContext") === hasContext &&
        candidate.diagnosticContext === fixture.diagnosticContext,
    );
    if (record === undefined) return undefined;
    const validation = validateDiagnosticAuthorityCandidate(EXPECTED_DIAGNOSTIC_AUTHORITY);
    return Object.freeze({
      kind: "diagnostic-mapping",
      diagnosticCode: validation?.diagnostics[0]?.code ?? record.diagnosticCode,
    });
  }
  if (fixture.kind !== "binding-rejection-mapping") return undefined;
  const record = EXPECTED_BINDING_AUTHORITY.find(
    (candidate) =>
      candidate.ruleId === fixture.ruleId &&
      candidate.neighborId === fixture.neighborId &&
      candidate.spelling === "parameter",
  );
  if (record === undefined || fixture.parameterPath !== "/functions/0/parameters/0") {
    return undefined;
  }
  const validation = validateBindingAuthorityCandidate(EXPECTED_BINDING_AUTHORITY);
  return Object.freeze({
    kind: "binding-rejection-mapping",
    rejectionCode: validation?.diagnostics[0]?.code ?? record.rejectionCode,
  });
}

async function executeFixture(
  row: OracleMutationAssertionRowV1,
): Promise<OracleMutationVectorResultV1> {
  const fixture = row.fixture;
  if (fixture.kind === "program-evaluation") {
    return Object.freeze({
      ok: true,
      observation: evaluateOracleProgram(fixture.input),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (fixture.kind === "diagnostic-mapping" || fixture.kind === "binding-rejection-mapping") {
    const observation = mappingObservation(row);
    return observation === undefined
      ? vectorFailure("/mutationFixture", "Mutation mapping fixture is not authoritative.")
      : Object.freeze({ ok: true, observation, diagnostics: EMPTY_DIAGNOSTICS });
  }
  const hydrated = await hydrateOracleMutationSuite(
    fixture.suite,
    fixture.request.sourceProvenance.configuration,
  );
  if (!hydrated.ok) return hydrated;
  const result = evaluateSemanticRelation(hydrated.suite, fixture.request);
  let observation: OracleMutationObservationV1;
  if (!result.ok) {
    observation = Object.freeze({
      kind: "semantic-relation-failure",
      diagnostics: result.diagnostics,
    });
  } else if (result.outcome === "relation-inapplicable") {
    observation = Object.freeze({
      kind: "semantic-relation-inapplicable",
      relationId: result.relationId,
    });
  } else if (result.outcome === "oracle-unmodeled") {
    observation = Object.freeze({
      kind: "semantic-relation-unmodeled",
      reason: result.reason,
    });
  } else {
    observation = Object.freeze({
      kind: "semantic-relation-modeled",
      relationId: result.relationId,
      sourceObservation: result.sourceObservation,
      transformedObservation: result.transformedObservation,
    });
  }
  return Object.freeze({ ok: true, observation, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Resolves the immutable assertion row for one exact stable vector ID.
 *
 * @param vectorId Canonical vector ID.
 * @returns Exact packet row or a closed failure.
 *
 * @example
 * ```ts
 * const row = await resolveOracleMutationAssertionRow(vectorId);
 * ```
 */
export async function resolveOracleMutationAssertionRow(
  vectorId: string,
): Promise<
  | { readonly ok: true; readonly row: OracleMutationAssertionRowV1 }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] }
> {
  const packet = await loadOracleMutationAssertionPacket();
  if (!packet.ok) return packet;
  const paths = oracleMutationPathRegistry().paths;
  if (packet.rows.length !== paths.length) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/mutationAssertions",
      "Mutation assertion packet does not cover the complete production registry.",
    );
  }
  const row = packet.rows.find((candidate) => candidate.vectorId === vectorId);
  const path = paths.find((candidate) => oracleMutationVectorIdForPath(candidate) === vectorId);
  if (
    row === undefined ||
    path === undefined ||
    row.family !== path.family ||
    packet.rows.some(
      (candidate, index) =>
        paths.find(
          (registered) =>
            oracleMutationVectorIdForPath(registered) === candidate.vectorId &&
            registered.family === candidate.family,
        ) === undefined ||
        packet.rows.findIndex((other) => other.vectorId === candidate.vectorId) !== index,
    )
  ) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/mutationAssertions",
      "Mutation assertion packet does not exact-join production vectors.",
    );
  }
  return Object.freeze({ ok: true, row });
}

/**
 * Executes one complete real production fixture by stable vector ID.
 *
 * @param vectorId Canonical stable vector ID.
 * @param selection Optional exact mutation selection for the same vector.
 * @returns Canonical observation or one closed vector failure.
 *
 * @example
 * ```ts
 * const baseline = await runOracleMutationVectorForConformance(vectorId);
 * ```
 */
export async function runOracleMutationVectorForConformance(
  vectorId: string,
  selection?: OracleMutationSelectionV1,
): Promise<OracleMutationVectorResultV1> {
  try {
    const resolved = await resolveOracleMutationAssertionRow(vectorId);
    if (!resolved.ok) return resolved;
    const path = oracleMutationPathRegistry().paths.find(
      (candidate) => oracleMutationVectorIdForPath(candidate) === vectorId,
    );
    if (path === undefined) {
      return vectorFailure("/vectorId", "Mutation vector does not name a production path.");
    }
    if (selection !== undefined) {
      if (
        selection.mutantId !== oracleMutationIdForPath(path) ||
        selection.operationId !== path.operationId ||
        selection.pathId !== path.pathId ||
        selection.variantId !== path.variantId
      ) {
        return vectorFailure("/selection", "Mutation selection does not match its vector.");
      }
      return runWithOracleMutationVariant(selection, () => executeFixture(resolved.row));
    }
    return executeFixture(resolved.row);
  } catch {
    return vectorFailure("", "Mutation vector could not be executed safely.");
  }
}

/**
 * Evaluates one exact literal assertion against one canonical observation.
 *
 * @param assertion Literal exact-observation assertion.
 * @param observation Canonical production observation.
 * @returns Whether the assertion passes, or a closed validation failure.
 *
 * @example
 * ```ts
 * const result = evaluateOracleMutationAssertion(assertion, observation);
 * ```
 */
export function evaluateOracleMutationAssertion(
  assertion: unknown,
  observation: unknown,
): OracleMutationAssertionResultV1 {
  const normalizedAssertion = normalizeOracleMutationAssertionData(assertion);
  if (!normalizedAssertion.ok) return normalizedAssertion;
  const normalizedObservation = normalizeOracleMutationAssertionData(observation);
  if (!normalizedObservation.ok) return normalizedObservation;
  if (
    !isOracleRecord(normalizedAssertion.value) ||
    !hasExactOracleKeys(normalizedAssertion.value, ASSERTION_KEYS) ||
    normalizedAssertion.value.kind !== "exact-observation"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/mutationAssertion",
      "Mutation assertion must use the exact closed shape.",
    );
  }
  return Object.freeze({
    ok: true,
    passed: isDeepStrictEqual(normalizedAssertion.value.expected, normalizedObservation.value),
  });
}

/**
 * Creates a module-owned impossible assertion for the finite mismatch probe.
 *
 * @param row Real canonical vector row.
 * @returns Exact assertion that cannot equal that row's canonical observation.
 *
 * @example
 * ```ts
 * const mismatch = impossibleOracleMutationAssertion(row);
 * ```
 */
export function impossibleOracleMutationAssertion(
  row: OracleMutationAssertionRowV1,
): OracleMutationAssertionV1 {
  return Object.freeze({
    kind: "exact-observation",
    expected: Object.freeze({
      kind: "diagnostic-mapping",
      diagnosticCode: `impossible.${row.vectorId}`,
    }),
  });
}
