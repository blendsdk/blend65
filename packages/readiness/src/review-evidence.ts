import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type { InventoryDiagnostic } from "./model.js";

/** Process evidence for one independently reviewed semantic population unit. */
export interface SemanticReviewRecord {
  readonly unitId: string;
  readonly reviewer: string;
  readonly specRevision: string;
  readonly semanticDigest: string;
  readonly dependencyDigests: Readonly<Record<string, string>>;
  readonly outcome: "accepted" | "blocked";
  readonly resolvedDisagreementIds: readonly string[];
}

export interface ReviewEvidenceResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
}

/** Current semantic state and the review units required for one evidence gate. */
export interface ReviewEvidenceContext {
  readonly expectedSpecRevision: string;
  readonly requiredUnitIds: readonly string[];
  readonly requiredDependencyIdsByUnit: Readonly<Record<string, readonly string[]>>;
  readonly currentDigests: Readonly<Record<string, string>>;
}

/**
 * Checks review records against the semantic and dependency digests they cover.
 *
 * Review evidence is a process gate, not semantic authority: callers choose
 * when a complete population unit requires it.
 */
export function validateReviewEvidence(
  records: readonly SemanticReviewRecord[],
  context: ReviewEvidenceContext,
): ReviewEvidenceResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const seen = new Set<string>();
  const required = new Set(context.requiredUnitIds);
  for (const unitId of required) {
    const dependencies = context.requiredDependencyIdsByUnit[unitId];
    if (
      dependencies === undefined ||
      dependencies.some((value, index) => index > 0 && value <= dependencies[index - 1])
    ) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.dependencies-contract",
          path: "$.requiredDependencyIdsByUnit",
          message: `Review unit ${unitId} requires one lexical unique dependency list.`,
        }),
      );
    }
  }
  records.forEach((record, index) => {
    const path = `$.reviews[${index}]`;
    if (seen.has(record.unitId)) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.duplicate",
          path,
          message: `Review unit ${record.unitId} is duplicated.`,
        }),
      );
    }
    seen.add(record.unitId);
    if (!required.has(record.unitId)) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.unexpected",
          path,
          message: `Review unit ${record.unitId} is not required.`,
        }),
      );
    }
    if (record.reviewer.trim().length === 0) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.reviewer-required",
          path,
          message: `Review unit ${record.unitId} must name a reviewer.`,
        }),
      );
    }
    if (record.specRevision !== context.expectedSpecRevision) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.revision-stale",
          path,
          message: `Review unit ${record.unitId} does not match the expected specification revision.`,
        }),
      );
    }
    if (record.outcome !== "accepted") {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.not-accepted",
          path,
          message: `Review unit ${record.unitId} has not been accepted.`,
        }),
      );
    }
    if (context.currentDigests[record.unitId] !== record.semanticDigest) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.stale",
          path,
          message: `Review unit ${record.unitId} does not match current semantics.`,
        }),
      );
    }
    const expectedDependencies = context.requiredDependencyIdsByUnit[record.unitId];
    const actualDependencies = Object.keys(record.dependencyDigests).sort();
    if (
      expectedDependencies !== undefined &&
      (actualDependencies.length !== expectedDependencies.length ||
        actualDependencies.some(
          (value, dependencyIndex) => value !== expectedDependencies[dependencyIndex],
        ))
    ) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.dependencies-mismatch",
          path,
          message: `Review unit ${record.unitId} does not declare its exact dependency set.`,
        }),
      );
    }
    for (const [dependency, digest] of Object.entries(record.dependencyDigests)) {
      if (context.currentDigests[dependency] !== digest) {
        diagnostics.push(
          createDiagnostic({
            phase: "ledger",
            code: "review.dependency-stale",
            path,
            message: `Review unit ${record.unitId} has stale dependency ${dependency}.`,
          }),
        );
      }
    }
    for (
      let disagreementIndex = 0;
      disagreementIndex < record.resolvedDisagreementIds.length;
      disagreementIndex += 1
    ) {
      const disagreementId = record.resolvedDisagreementIds[disagreementIndex];
      const previous = record.resolvedDisagreementIds[disagreementIndex - 1];
      if (previous !== undefined && disagreementId <= previous) {
        diagnostics.push(
          createDiagnostic({
            phase: "ledger",
            code: "review.disagreements-not-ordered",
            path,
            message: `Review unit ${record.unitId} disagreement IDs must be unique and lexically ordered.`,
          }),
        );
        break;
      }
    }
  });
  for (const unitId of required) {
    if (!seen.has(unitId)) {
      diagnostics.push(
        createDiagnostic({
          phase: "ledger",
          code: "review.missing",
          path: "$.reviews",
          message: `Review unit ${unitId} is required.`,
        }),
      );
    }
  }
  const ordered = sortDiagnostics(diagnostics);
  return { ok: ordered.length === 0, diagnostics: ordered };
}
