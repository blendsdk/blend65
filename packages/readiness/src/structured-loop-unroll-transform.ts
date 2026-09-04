import {
  currentSemanticRelationFault,
  semanticRelationRewriteIsMutated,
  structuredLoopClosureRewriteIsMutated,
} from "./semantic-relation-conformance.js";
import { oracleFailure, type OracleFailure } from "./oracle-input.js";
import { validateStructuredGeneratorIrSyntax } from "./generator-ir-validator.js";
import type { GenStructuredModule } from "./generator-ir.js";
import { deriveStructuredConstructionUsageV2 } from "./modeled-construction-templates.js";
import type { StructuredGeneratedModeledCaseV1 } from "./modeled-generator-model.js";
import type { PreparedSemanticRelationRequestV2 } from "./semantic-relation-input.js";
import type { StructuredLoopTraceEntryV2 } from "./structured-oracle-evaluator.js";
import { validateStructuredModuleSemantics } from "./structured-ir-semantics.js";

/** Successful immutable structured loop rewrite. */
export interface StructuredLoopTransformSuccessV2 {
  readonly ok: true;
  readonly transformedCase: StructuredGeneratedModeledCaseV1;
  readonly transformedModule: GenStructuredModule;
}

function replaceLoopCounter(value: unknown, counter: string, replacement: bigint): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((member) => replaceLoopCounter(member, counter, replacement)));
  }
  if (typeof value !== "object" || value === null) return value;
  const record = Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      key,
      replaceLoopCounter(member, counter, replacement),
    ]),
  );
  if (record.kind === "name" && record.name === counter) {
    return Object.freeze({ kind: "literal", type: record.type, value: replacement });
  }
  return Object.freeze(record);
}

/**
 * Replaces one authenticated finite loop with its ordered body copies.
 *
 * @param prepared Authenticated top-level loop selection.
 * @param domain Exact source-domain trace produced by independent evaluation.
 * @returns Validated immutable transformed program or one closed relation failure.
 */
export function applyStructuredLoopUnrollingTransform(
  prepared: PreparedSemanticRelationRequestV2,
  domain: readonly StructuredLoopTraceEntryV2[],
): StructuredLoopTransformSuccessV2 | OracleFailure {
  const fault = currentSemanticRelationFault("relation.loop-unrolling.rewrite");
  if (
    fault?.faultId === "relation.fault.semantic-closure-invalid-rewrite" ||
    structuredLoopClosureRewriteIsMutated()
  ) {
    return oracleFailure(
      "oracle.relation.violated",
      "/transformedCase",
      "Loop rewrite violates structured semantic closure.",
    );
  }
  const mutated =
    fault?.faultId === "relation.fault.non-preserving-rewrite" ||
    semanticRelationRewriteIsMutated("relation.loop-unrolling", "unroll-exact-domain-v1");
  const selectedDomain = mutated ? domain.slice(0, -1) : domain;
  const selectedFunction = prepared.authority.oracleInput.module.functions[prepared.functionIndex];
  if (selectedFunction === undefined) {
    return oracleFailure(
      "oracle.relation.invalid",
      "/selectionPath",
      "Loop function is unavailable.",
    );
  }
  const replacement = selectedDomain.flatMap(({ value }) =>
    prepared.selectedLoop.body.map((statement) =>
      replaceLoopCounter(statement, prepared.selectedLoop.counter, value),
    ),
  );
  const candidate = {
    ...prepared.authority.oracleInput.module,
    functions: prepared.authority.oracleInput.module.functions.map((fn, index) =>
      index === prepared.functionIndex
        ? {
            ...fn,
            body: [
              ...fn.body.slice(0, prepared.statementIndex),
              ...replacement,
              ...fn.body.slice(prepared.statementIndex + 1),
            ],
          }
        : fn,
    ),
  };
  const validated = validateStructuredGeneratorIrSyntax(candidate);
  if (!validated.ok) {
    return oracleFailure(
      "oracle.relation.violated",
      "/transformedCase",
      "Loop rewrite does not produce valid structured syntax.",
    );
  }
  if (
    validateStructuredModuleSemantics(
      validated.module,
      prepared.authority.oracleInput.generationBudget,
    ) !== undefined
  ) {
    return oracleFailure(
      "oracle.relation.violated",
      "/transformedCase",
      "Loop rewrite does not preserve structured semantic closure.",
    );
  }
  const transformedCase: StructuredGeneratedModeledCaseV1 = Object.freeze({
    ...prepared.authority.generatedCase,
    projection: Object.freeze({ kind: "structured", module: validated.module }),
    constructionUsage: deriveStructuredConstructionUsageV2(validated.module),
  });
  return Object.freeze({ ok: true, transformedCase, transformedModule: validated.module });
}
