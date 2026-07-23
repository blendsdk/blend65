import { describe, expect, it } from "vitest";
import { validateReviewEvidence } from "./review-evidence.js";

describe("semantic review evidence", () => {
  it("should accept current unit and dependency digests", () => {
    const result = validateReviewEvidence(
      [
        {
          unitId: "chapter-01",
          reviewer: "reviewer",
          specRevision: "revision",
          semanticDigest: "unit-digest",
          dependencyDigests: { grammar: "grammar-digest" },
          outcome: "accepted",
          resolvedDisagreementIds: [],
        },
      ],
      {
        expectedSpecRevision: "revision",
        requiredUnitIds: ["chapter-01"],
        requiredDependencyIdsByUnit: { "chapter-01": ["grammar"] },
        currentDigests: { "chapter-01": "unit-digest", grammar: "grammar-digest" },
      },
    );

    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it("should reject duplicate, stale unit, and stale dependency evidence deterministically", () => {
    const record = {
      unitId: "chapter-01",
      reviewer: "reviewer",
      specRevision: "revision",
      semanticDigest: "old-unit",
      dependencyDigests: { grammar: "old-grammar" },
      outcome: "accepted" as const,
      resolvedDisagreementIds: [],
    };
    const result = validateReviewEvidence([record, record], {
      expectedSpecRevision: "revision",
      requiredUnitIds: ["chapter-01"],
      requiredDependencyIdsByUnit: { "chapter-01": ["grammar"] },
      currentDigests: {
        "chapter-01": "new-unit",
        grammar: "new-grammar",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "review.dependency-stale",
      "review.dependency-stale",
      "review.duplicate",
      "review.stale",
      "review.stale",
    ]);
  });

  it("should require exact unit coverage and accepted, attributable, current evidence", () => {
    const result = validateReviewEvidence(
      [
        {
          unitId: "chapter-02",
          reviewer: " ",
          specRevision: "old-revision",
          semanticDigest: "chapter-02-digest",
          dependencyDigests: {},
          outcome: "blocked",
          resolvedDisagreementIds: ["D-02", "D-01", "D-01"],
        },
      ],
      {
        expectedSpecRevision: "current-revision",
        requiredUnitIds: ["chapter-01"],
        requiredDependencyIdsByUnit: { "chapter-01": [] },
        currentDigests: { "chapter-02": "chapter-02-digest" },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "review.disagreements-not-ordered",
      "review.missing",
      "review.not-accepted",
      "review.reviewer-required",
      "review.revision-stale",
      "review.unexpected",
    ]);
  });

  it("should reject duplicate disagreement IDs even when otherwise lexically ordered", () => {
    const result = validateReviewEvidence(
      [
        {
          unitId: "chapter-01",
          reviewer: "reviewer",
          specRevision: "revision",
          semanticDigest: "unit-digest",
          dependencyDigests: {},
          outcome: "accepted",
          resolvedDisagreementIds: ["D-01", "D-01"],
        },
      ],
      {
        expectedSpecRevision: "revision",
        requiredUnitIds: ["chapter-01"],
        requiredDependencyIdsByUnit: { "chapter-01": [] },
        currentDigests: { "chapter-01": "unit-digest" },
      },
    );

    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "review.disagreements-not-ordered",
    ]);
  });

  it("should require exact declared dependency keys and a lexical context contract", () => {
    const record = {
      unitId: "chapter-01",
      reviewer: "reviewer",
      specRevision: "revision",
      semanticDigest: "unit-digest",
      dependencyDigests: { extra: "extra-digest" },
      outcome: "accepted" as const,
      resolvedDisagreementIds: [],
    };
    const result = validateReviewEvidence([record], {
      expectedSpecRevision: "revision",
      requiredUnitIds: ["chapter-01"],
      requiredDependencyIdsByUnit: { "chapter-01": ["grammar", "grammar"] },
      currentDigests: {
        "chapter-01": "unit-digest",
        extra: "extra-digest",
        grammar: "grammar-digest",
      },
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "review.dependencies-contract",
      "review.dependencies-mismatch",
    ]);
  });
});
