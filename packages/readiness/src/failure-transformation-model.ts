import { compareExecutionText } from "./execution-validation.js";

import type { ReductionSizeV1, ValidatedReductionCandidateV1 } from "./reduction-candidate.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Closed, non-empty version-one reduction edit catalog. */
export type FailureTransformationV1 =
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "typed-statement-delete";
      readonly path: string;
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "typed-expression-simplify";
      readonly path: string;
      readonly replacement: "zero" | "false" | "left" | "right" | "operand";
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "typed-literal-simplify";
      readonly path: string;
      readonly value: string;
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "invalid-baseline-delete" | "invalid-baseline-simplify";
      readonly path: string;
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "invalid-transform-target-rebase";
      readonly path: string;
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "invalid-unused-binding-remove";
      readonly parameterPath: string;
    }
  | {
      readonly revision: "failure-transformation-v1";
      readonly kind: "malformed-token-range-delete" | "malformed-byte-chunk-delete";
      readonly startByte: number;
      readonly endByte: number;
    };

/** Canonical trace entry for one accepted strictly decreasing edit. */
export interface FailureTransformationTraceEntryV1 {
  /** Closed trace schema. */
  readonly revision: "failure-transformation-trace-entry-v1";
  /** Zero-based canonical catalog position. */
  readonly catalogOrdinal: number;
  /** Exact accepted edit. */
  readonly transformation: FailureTransformationV1;
  /** Candidate size before the edit. */
  readonly beforeSize: ReductionSizeV1;
  /** Strictly smaller candidate size after the edit. */
  readonly afterSize: ReductionSizeV1;
  /** Digest of the accepted candidate. */
  readonly candidateDigest: Sha256Digest;
}

/** Result of the separate idempotent metadata normalization phase. */
export interface FailureNormalizationResultV1 {
  /** Closed result schema. */
  readonly revision: "failure-normalization-result-v1";
  /** Fully revalidated normalized candidate. */
  readonly candidate: ValidatedReductionCandidateV1;
  /** Whether canonical family data changed. */
  readonly changed: boolean;
  /** Digest before normalization. */
  readonly beforeDigest: Sha256Digest;
  /** Digest after normalization. */
  readonly afterDigest: Sha256Digest;
  /** Whether changed executable bytes require authenticated evaluation. */
  readonly requiresEvaluation: boolean;
}

/** One lazily prepared, fully validated and strictly smaller catalog proposal. */
export interface FailureTransformationProposalV1 {
  /** Closed proposal schema. */
  readonly revision: "failure-transformation-proposal-v1";
  /** Canonical position among applicable edits for this exact candidate. */
  readonly catalogOrdinal: number;
  /** Exact canonical transformation. */
  readonly transformation: FailureTransformationV1;
  /** Prevalidated candidate produced by the transformation. */
  readonly candidate: ValidatedReductionCandidateV1;
}

/** Closed lazy lookup outcome used by the reducer to prove catalog exhaustion. */
export type FailureTransformationProposalLookupV1 =
  | {
      readonly revision: "failure-transformation-proposal-lookup-v1";
      readonly outcome: "proposal";
      readonly proposal: FailureTransformationProposalV1;
    }
  | {
      readonly revision: "failure-transformation-proposal-lookup-v1";
      readonly outcome: "catalog-complete";
    };

const FAMILY_RANK = Object.freeze({ typed: 0, invalid: 1, malformed: 2 });
const KIND_RANK: Readonly<Record<FailureTransformationV1["kind"], number>> = Object.freeze({
  "typed-statement-delete": 0,
  "typed-expression-simplify": 1,
  "typed-literal-simplify": 2,
  "invalid-baseline-delete": 0,
  "invalid-baseline-simplify": 1,
  "invalid-transform-target-rebase": 2,
  "invalid-unused-binding-remove": 3,
  "malformed-byte-chunk-delete": 0,
  "malformed-token-range-delete": 1,
});
const REPLACEMENT_RANK = Object.freeze({ false: 0, left: 1, operand: 2, right: 3, zero: 4 });

function familyRank(transformation: FailureTransformationV1): number {
  if (transformation.kind.startsWith("typed-")) return FAMILY_RANK.typed;
  if (transformation.kind.startsWith("invalid-")) return FAMILY_RANK.invalid;
  return FAMILY_RANK.malformed;
}

function transformationPath(transformation: FailureTransformationV1): string | undefined {
  if ("path" in transformation) return transformation.path;
  return "parameterPath" in transformation ? transformation.parameterPath : undefined;
}

/**
 * Compares closed edits by candidate family, canonical pointer/range, kind, then replacement.
 *
 * Raw ranges compare their start first and their end in descending order. This makes a larger
 * chunk at one offset precede every smaller chunk at that same offset.
 */
export function compareFailureTransformationsV1(
  left: FailureTransformationV1,
  right: FailureTransformationV1,
): number {
  const familyDifference = familyRank(left) - familyRank(right);
  if (familyDifference !== 0) return familyDifference;
  if ("startByte" in left && "startByte" in right) {
    if (left.startByte !== right.startByte) return left.startByte - right.startByte;
    if (left.endByte !== right.endByte) return right.endByte - left.endByte;
  } else {
    const leftPath = transformationPath(left);
    const rightPath = transformationPath(right);
    if (leftPath !== undefined && rightPath !== undefined) {
      const pathDifference = compareExecutionText(leftPath, rightPath);
      if (pathDifference !== 0) return pathDifference;
    }
  }
  const kindDifference = KIND_RANK[left.kind] - KIND_RANK[right.kind];
  if (kindDifference !== 0) return kindDifference;
  if (left.kind === "typed-expression-simplify" && right.kind === left.kind) {
    return REPLACEMENT_RANK[left.replacement] - REPLACEMENT_RANK[right.replacement];
  }
  if (left.kind === "typed-literal-simplify" && right.kind === left.kind) {
    return compareExecutionText(left.value, right.value);
  }
  return 0;
}
