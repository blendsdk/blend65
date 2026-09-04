import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import {
  parseExecutionInitialStateFixtureV1,
  type ExecutionEnvelopeIrV1,
  type ExecutionInitialStateFixtureV1,
} from "./execution-envelope-contracts.js";
import { renderSourceModule } from "./source-renderer.js";
import {
  resolveStructuredCaseAuthorityV1,
  type StructuredCaseAuthorityV1,
} from "./structured-case-families.js";
import { evaluateStructuredOracleProgram } from "./structured-oracle-evaluator.js";

/** Stable identity of the reviewed combined structured execution case. */
export const STRUCTURED_EXECUTION_CASE_ID_V1 = "case.structured.vertical-combined-v1" as const;

/** Independently derived data used to mint the combined execution capability and publication. */
export interface StructuredExecutionCaseDataV1 {
  readonly authority: StructuredCaseAuthorityV1;
  readonly sourceBytes: Uint8Array;
  readonly envelope: ExecutionEnvelopeIrV1;
  readonly fixture: ExecutionInitialStateFixtureV1;
  readonly oracleEvaluationIdentity: `sha256:${string}`;
  readonly expectedObservation: {
    readonly kind: "direct-mmio";
    readonly address: 49152;
    readonly byteLength: 1;
    readonly value: 12;
  };
}

const STRUCTURED_OBSERVATION = Object.freeze({
  kind: "direct-mmio" as const,
  address: 49_152 as const,
  byteLength: 1 as const,
  projectionRevision: "c64-vic-color-observation-v1" as const,
});
const STRUCTURED_EXPECTED_OBSERVATION = Object.freeze({
  kind: "direct-mmio" as const,
  address: 49_152 as const,
  byteLength: 1 as const,
  value: 12 as const,
});

function failure(
  path: string,
  message: string,
): ExecutionOperationResultV1<StructuredExecutionCaseDataV1> {
  const issues = [
    Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
  ] as const;
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

/**
 * Derives the combined structured case from its registry and independent oracle authority.
 *
 * @returns Immutable source, expectation, fixture, and execution-envelope data.
 *
 * @example
 * ```ts
 * const result = createStructuredExecutionCaseDataV1();
 * ```
 */
export function createStructuredExecutionCaseDataV1(): ExecutionOperationResultV1<StructuredExecutionCaseDataV1> {
  const resolved = resolveStructuredCaseAuthorityV1(STRUCTURED_EXECUTION_CASE_ID_V1);
  if (!resolved.ok || resolved.authority.generatedCase.projection.kind !== "structured") {
    return failure("/request/caseId", "Structured execution authority is unavailable.");
  }
  const authority = resolved.authority;
  const evaluation = evaluateStructuredOracleProgram(authority.oracleInput);
  const cell =
    evaluation.ok && evaluation.outcome === "modeled"
      ? evaluation.observation.finalMemory.find(({ address }) => address === 0xc000n)
      : undefined;
  if (evaluation.ok !== true || evaluation.outcome !== "modeled" || cell?.value !== 12n) {
    return failure("/request/caseId", "Structured expectation authority did not resolve exactly.");
  }
  const rendered = renderSourceModule(authority.generatedCase.projection.module, {
    maxSourceBytes: authority.oracleInput.generationBudget.maxSourceBytes,
    literalSpellings: [],
  });
  if (!rendered.ok) {
    return failure("/request/caseId", "Structured source rendering failed.");
  }
  const fixture = parseExecutionInitialStateFixtureV1({
    revision: "c64-vic-color-readback-v1",
    cells: [],
  });
  if (!fixture.ok) return fixture;
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      authority,
      sourceBytes: rendered.sourceBytes.slice(),
      envelope: Object.freeze({
        revision: "execution-envelope-ir-v1",
        sourceCaseDigest: authority.caseDigest,
        arguments: Object.freeze([]),
        entryFunction: authority.oracleInput.entryFunction,
        observation: STRUCTURED_OBSERVATION,
        completionInitialValue: 0,
        completionSuccessValue: 165,
        postEntryStores: Object.freeze([
          Object.freeze({ kind: "completion" as const, value: 165 }),
        ]),
      }),
      fixture: fixture.value,
      oracleEvaluationIdentity: evaluation.evaluationIdentity,
      expectedObservation: STRUCTURED_EXPECTED_OBSERVATION,
    }),
  });
}
