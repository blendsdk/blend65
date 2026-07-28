import { validateGeneratorIrSyntax } from "./generator-ir-validator.js";
import type { GenModule } from "./generator-ir.js";
import {
  resolveDeclarationSelection,
  isPureRelationExpression,
  localInitializerDependenciesAreLiftable,
  localIsReassigned,
} from "./semantic-relation-analysis.js";
import {
  compareSemanticRelationObservations,
  semanticRelationComparatorWitness,
} from "./semantic-relation-compare.js";
import {
  currentSemanticRelationFault,
  semanticRelationRewritePath,
} from "./semantic-relation-conformance.js";
import {
  isSemanticRelationResult,
  prepareSemanticRelationRequest,
  type PreparedSemanticRelationRequestV1,
} from "./semantic-relation-input.js";
import type {
  SemanticRelationModeledResultV1,
  SemanticRelationResultV1,
} from "./semantic-relation-model.js";
import {
  applySemanticRelationTransform,
  preflightSemanticRelationTransformBudget,
  type SemanticRelationTransformSuccessV1,
} from "./semantic-relation-transform.js";
import {
  evaluateOracleProgram,
  evaluateOracleProgramWithLocalCapture,
} from "./oracle-evaluator.js";
import { oracleFailure } from "./oracle-input.js";
import type {
  DiagnosticContextV1,
  OracleObservationV1,
  OracleResultV1,
  OracleSuite,
  OracleValueV1,
} from "./oracle-model.js";
import { validateOracleSemanticClosure } from "./oracle-semantic-closure.js";
import {
  diagnosticAuthorityKey,
  oracleAuthorityKey,
  type OracleSuiteState,
} from "./oracle-suite.js";
import type { GeneratedModeledCase } from "./modeled-generator-model.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function inapplicable(
  relationId: PreparedSemanticRelationRequestV1["request"]["relationId"],
): SemanticRelationResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "relation-inapplicable",
    relationId,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function primitiveValue(value: OracleValueV1 | null): bigint | boolean | undefined {
  return value === null ? undefined : value.value;
}

interface LocalLiftEvaluationV1 {
  readonly value: bigint | boolean;
  readonly sourceResult: OracleResultV1;
}

function liftInitializerValue(
  prepared: PreparedSemanticRelationRequestV1,
): LocalLiftEvaluationV1 | undefined {
  if (prepared.request.relationId !== "relation.local-to-parameter") return undefined;
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  if (selection?.kind !== "local" || selection.functionIndex !== prepared.entryFunctionIndex) {
    return undefined;
  }
  const fn = prepared.sourceModule.functions[selection.functionIndex];
  const statement = fn?.body[selection.statementIndex];
  if (
    fn === undefined ||
    statement?.kind !== "local" ||
    !isPureRelationExpression(statement.initializer) ||
    !localInitializerDependenciesAreLiftable(prepared.sourceModule, fn, statement.initializer) ||
    localIsReassigned(fn, statement.name, selection.statementIndex)
  ) {
    return undefined;
  }
  const captured = evaluateOracleProgramWithLocalCapture(
    {
      schemaVersion: 1,
      module: prepared.sourceModule,
      entryFunction: prepared.request.entryFunction,
      parameterBindings: prepared.generatedCase.effectiveParameterBindings,
      memory: prepared.request.memory,
      budget: prepared.request.budget,
    },
    selection.statementIndex,
  );
  const result = captured.result;
  const value = primitiveValue(captured.capturedValue ?? null);
  if (
    !result.ok ||
    result.outcome !== "modeled" ||
    result.observation.kind !== "value-state" ||
    value === undefined
  ) {
    return undefined;
  }
  return Object.freeze({ value, sourceResult: result });
}

function evaluateValidObservation(
  module: GenModule,
  entryFunction: string,
  parameterBindings: GeneratedModeledCase["parameterBindings"],
  prepared: PreparedSemanticRelationRequestV1,
): OracleResultV1 {
  return evaluateOracleProgram({
    schemaVersion: 1,
    module,
    entryFunction,
    parameterBindings,
    memory: prepared.request.memory,
    budget: prepared.request.budget,
  });
}

function canonicalIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) && String(index) === value ? index : undefined;
}

/**
 * Derives the diagnostic-authority context encoded by one invalid projection.
 *
 * This remains outside the public package index; implementation tests exercise it directly
 * because malformed projection paths must fail closed without changing authority lookup.
 *
 * @param modeledCase Modeled case whose invalid transform may select a diagnostic context.
 * @returns Exact diagnostic context, or `undefined` when the projection does not name one.
 */
export function diagnosticContext(
  modeledCase: GeneratedModeledCase,
): DiagnosticContextV1 | undefined {
  const projection = modeledCase.projection;
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
    const statement =
      functionIndex === undefined || statementIndex === undefined
        ? undefined
        : projection.baseline.functions[functionIndex]?.body[statementIndex];
    if (segments[5] === "initializer" && statement?.kind === "local") return "initializer";
    if (segments[5] === "value" && statement?.kind === "assign") return "assignment";
    if (segments[5] === "value" && statement?.kind === "return") return "return-expression";
    return undefined;
  }
  if (transform.kind !== "intrinsic-argument-replace") return undefined;
  const functionIndex = canonicalIndex(segments[2]);
  const statementIndex = canonicalIndex(segments[4]);
  const statement =
    functionIndex === undefined || statementIndex === undefined
      ? undefined
      : projection.baseline.functions[functionIndex]?.body[statementIndex];
  return statement?.kind === "memory-write" ||
    (statement?.kind === "return" && statement.value?.kind === "memory-read")
    ? "intrinsic-argument"
    : undefined;
}

function invalidObservation(
  state: OracleSuiteState,
  modeledCase: GeneratedModeledCase,
): OracleObservationV1 | SemanticRelationResultV1 {
  if (modeledCase.validity.kind !== "invalid" || modeledCase.projection.kind !== "invalid") {
    return oracleFailure(
      "oracle.relation.invalid",
      "/sourceCase",
      "Invalid relation projection lacks its named neighbor.",
    );
  }
  const ruleId = modeledCase.primaryRuleId;
  const neighborId = modeledCase.validity.neighborId;
  if (modeledCase.projection.transform.kind === "parameter-binding-replace") {
    const record = state.bindingsByKey.get(oracleAuthorityKey(ruleId, neighborId));
    return record === undefined
      ? oracleFailure(
          "oracle.authority.missing",
          "/sourceCase",
          "Binding-rejection authority is unavailable.",
        )
      : Object.freeze({ kind: "binding-rejection", ...record });
  }
  const context = diagnosticContext(modeledCase);
  const record =
    state.diagnosticsByKey.get(diagnosticAuthorityKey(ruleId, neighborId, undefined)) ??
    (context === undefined
      ? undefined
      : state.diagnosticsByKey.get(diagnosticAuthorityKey(ruleId, neighborId, context)));
  return record === undefined
    ? oracleFailure(
        "oracle.authority.missing",
        "/sourceCase",
        "Diagnostic authority is unavailable.",
      )
    : Object.freeze({
        kind: "diagnostic",
        ruleId: record.ruleId,
        neighborId: record.neighborId,
        code: record.diagnosticCode,
        phase: record.phase,
        severity: record.severity,
      });
}

function isOracleResult(
  value: OracleObservationV1 | SemanticRelationResultV1,
): value is SemanticRelationResultV1 {
  return "ok" in value;
}

interface SemanticRelationObservationPairV1 {
  readonly source: OracleObservationV1;
  readonly transformed: OracleObservationV1;
}

function observations(
  prepared: PreparedSemanticRelationRequestV1,
  transformed: SemanticRelationTransformSuccessV1,
  precomputedSource?: OracleResultV1,
): SemanticRelationObservationPairV1 | SemanticRelationResultV1 {
  if (prepared.request.sourceCase.projection.kind === "invalid") {
    const source = invalidObservation(prepared.suiteState, prepared.request.sourceCase);
    if (isOracleResult(source)) return source;
    let target = invalidObservation(prepared.suiteState, transformed.transformedCase);
    if (isOracleResult(target)) return target;
    const rewriteFault = currentSemanticRelationFault(
      semanticRelationRewritePath(prepared.request.relationId),
    );
    if (rewriteFault?.faultId === "relation.fault.non-preserving-rewrite") {
      target =
        target.kind === "diagnostic"
          ? Object.freeze({ ...target, code: `${target.code}.rewrite-witness` })
          : target.kind === "binding-rejection"
            ? Object.freeze({
                ...target,
                rejectionCode:
                  target.rejectionCode === "binding.value.type-invalid"
                    ? "binding.value.range-invalid"
                    : "binding.value.type-invalid",
              })
            : target;
    }
    return Object.freeze({ source, transformed: target });
  }
  const source =
    precomputedSource ??
    evaluateValidObservation(
      prepared.sourceModule,
      prepared.request.entryFunction,
      prepared.generatedCase.effectiveParameterBindings,
      prepared,
    );
  if (!source.ok || source.outcome !== "modeled") return source;
  const target = evaluateValidObservation(
    transformed.transformedModule,
    transformed.transformedEntryFunction,
    transformed.transformedCase.parameterBindings,
    prepared,
  );
  if (!target.ok || target.outcome !== "modeled") return target;
  return Object.freeze({
    source: source.observation,
    transformed: target.observation,
  });
}

function relationModeled(
  prepared: PreparedSemanticRelationRequestV1,
  transformed: SemanticRelationTransformSuccessV1,
  sourceObservation: OracleObservationV1,
  transformedObservation: OracleObservationV1,
): SemanticRelationModeledResultV1 {
  return Object.freeze({
    ok: true,
    outcome: "modeled",
    relationId: prepared.request.relationId,
    sourceCase: prepared.request.sourceCase,
    transformedCase: transformed.transformedCase,
    sourceObservation,
    transformedObservation,
    observation: transformedObservation,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Applies and independently proves one semantics-preserving source relation.
 *
 * @param suite Factory-created source-authoring authority.
 * @param request Hostile relation request.
 * @returns Rich modeled proof, inapplicable/unmodeled result, or closed failure.
 *
 * @example
 * ```ts
 * const result = evaluateSemanticRelation(suite, request);
 * ```
 */
export function evaluateSemanticRelation(
  suite: OracleSuite,
  request: unknown,
): SemanticRelationResultV1 {
  try {
    const prepared = prepareSemanticRelationRequest(suite, request);
    if (isSemanticRelationResult(prepared)) return prepared;
    const sourceClosure = validateOracleSemanticClosure(
      prepared.sourceModule,
      prepared.request.entryFunction,
    );
    if (!sourceClosure.ok) {
      return oracleFailure(
        "oracle.relation.invalid",
        "/sourceCase",
        "Source case violates oracle semantic closure.",
      );
    }
    const budgetFailure = preflightSemanticRelationTransformBudget(prepared);
    if (budgetFailure !== undefined) return budgetFailure;
    const lift = liftInitializerValue(prepared);
    const transformed = applySemanticRelationTransform(prepared, lift?.value);
    if (!transformed.ok) return transformed;
    if ("outcome" in transformed) return inapplicable(prepared.request.relationId);

    const structural = validateGeneratorIrSyntax(transformed.transformedModule);
    if (!structural.ok) {
      return oracleFailure(
        "oracle.relation.invalid",
        "/transformedCase",
        "Transformed case is not structurally valid.",
      );
    }
    const closure = validateOracleSemanticClosure(
      structural.module,
      transformed.transformedEntryFunction,
    );
    if (!closure.ok) {
      return oracleFailure(
        "oracle.relation.invalid",
        "/transformedCase",
        "Transformed case violates oracle semantic closure.",
      );
    }
    const compared = observations(prepared, transformed, lift?.sourceResult);
    if ("ok" in compared) return compared;
    const sourceObservation = compared.source;
    const witnessed = semanticRelationComparatorWitness(
      prepared.request.relationId,
      compared.transformed,
    );
    if (
      !compareSemanticRelationObservations(
        prepared.request.relationId,
        sourceObservation,
        witnessed,
      )
    ) {
      return oracleFailure(
        "oracle.relation.violated",
        "/transformedCase",
        "Transformed observation violates the selected relation.",
      );
    }
    return relationModeled(prepared, transformed, sourceObservation, witnessed);
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Semantic relation request could not be inspected safely.",
    );
  }
}
