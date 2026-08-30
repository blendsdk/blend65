import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createFailureCampaignBudgetAuthorityV1,
  getFailureCampaignBudgetSnapshotV1,
} from "./failure-campaign-budget.js";
import {
  applyFailureTransformationV1,
  enumerateFailureTransformationsV1,
  getFailureTransformationProposalV1,
} from "./failure-transform-catalog.js";
import {
  createInitialReductionCandidateV1,
  getValidatedReductionCandidateProjectionV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";
import {
  createRawReductionImplFixture,
  createTypedInvalidReductionImplFixtures,
  createTypedReductionImplFixtures,
} from "./test-fixtures/failure-reduction-impl-fixture.js";

import type { RawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";

let genuine: RawReductionImplFixture;

beforeAll(async () => {
  genuine = await createRawReductionImplFixture();
}, 240_000);

afterAll(async () => genuine.cleanup());

function createBudget() {
  const budget = createFailureCampaignBudgetAuthorityV1(genuine.policy, {
    nonPassResults: 0,
    resolvableNonPassResults: 0,
  });
  if (!budget.ok) throw new TypeError("Expected a genuine failure campaign budget.");
  return budget.value;
}

describe("lazy failure transformation catalog", () => {
  it("should reject invalid ordinals and candidates before catalog traversal", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const foreign = createTypedReductionImplFixtures(genuine.context, 1)[0];
    expect(foreign).toBeDefined();
    if (foreign === undefined) return;

    for (const ordinal of [-1, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        getFailureTransformationProposalV1(
          genuine.envelope,
          initial.value,
          ordinal,
          createBudget(),
        ),
      ).toMatchObject({ ok: false, issues: [{ path: "/catalogOrdinal" }] });
    }
    expect(
      getFailureTransformationProposalV1(foreign.envelope, initial.value, 0, createBudget()),
    ).toMatchObject({
      ok: false,
      issues: [{ path: "/candidate" }],
    });
    expect(enumerateFailureTransformationsV1(null as never)).toEqual([]);
  });

  it("should order raw ranges canonically and reuse one prevalidated proposal", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;

    const budget = createBudget();
    const first = getFailureTransformationProposalV1(genuine.envelope, initial.value, 0, budget);
    const repeated = getFailureTransformationProposalV1(genuine.envelope, initial.value, 0, budget);
    expect(first).toMatchObject({ ok: true, value: { outcome: "proposal" } });
    expect(repeated).toMatchObject({ ok: true, value: { outcome: "proposal" } });
    if (
      !first.ok ||
      !repeated.ok ||
      first.value.outcome !== "proposal" ||
      repeated.value.outcome !== "proposal"
    )
      return;
    expect(getFailureCampaignBudgetSnapshotV1(budget)).toMatchObject({
      ok: true,
      value: { used: { transformationAttempts: 1 } },
    });
    expect(
      getFailureTransformationProposalV1(genuine.envelope, initial.value, 1, budget),
    ).toMatchObject({ ok: true, value: { outcome: "proposal" } });
    expect(
      getFailureTransformationProposalV1(genuine.envelope, initial.value, 0, budget),
    ).toMatchObject({ ok: true, value: { outcome: "proposal" } });
    expect(repeated.value.proposal.candidate).toBe(first.value.proposal.candidate);
    expect(
      applyFailureTransformationV1(
        genuine.envelope,
        initial.value,
        first.value.proposal.transformation,
      ),
    ).toMatchObject({ ok: true, value: first.value.proposal.candidate });

    const edits = enumerateFailureTransformationsV1(initial.value);
    const whole = edits.findIndex(
      (edit) => "startByte" in edit && edit.startByte === 0 && edit.endByte === 3,
    );
    const firstByte = edits.findIndex(
      (edit) => "startByte" in edit && edit.startByte === 0 && edit.endByte === 1,
    );
    expect(whole).toBeGreaterThanOrEqual(0);
    expect(firstByte).toBeGreaterThan(whole);
  });

  it("should refine raw catalogs beyond 128 code points to every individual boundary", async () => {
    const bytes = new TextEncoder().encode(`${"x".repeat(128)}y`);
    const fixture = await createRawReductionImplFixture(bytes);
    try {
      const initial = createInitialReductionCandidateV1(fixture.envelope);
      expect(initial).toMatchObject({ ok: true });
      if (!initial.ok) return;
      expect(enumerateFailureTransformationsV1(initial.value)).toContainEqual({
        revision: "failure-transformation-v1",
        kind: "malformed-byte-chunk-delete",
        startByte: 128,
        endByte: 129,
      });
    } finally {
      await fixture.cleanup();
    }
  }, 240_000);

  it("should prepare only the requested proposal for one-mebibyte shallow input", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    if (!initial.ok) return;
    const projected = getValidatedReductionCandidateProjectionV1(initial.value);
    if (!projected.ok || projected.value.draft.kind !== "raw-malformed") return;
    const sourceBytes = new Uint8Array(1_048_576).fill(0x61);
    const huge = validateReductionCandidateInvariantV1(genuine.envelope, {
      ...projected.value.draft,
      sourceBytes,
      tokens: [{ kind: "unknown", startByte: 0, endByte: sourceBytes.length }],
    });
    expect(huge).toMatchObject({ ok: true });
    if (!huge.ok) return;

    const budget = createBudget();
    const proposal = getFailureTransformationProposalV1(genuine.envelope, huge.value, 0, budget);
    expect(proposal).toMatchObject({
      ok: true,
      value: {
        outcome: "proposal",
        proposal: {
          catalogOrdinal: 0,
          transformation: { startByte: 0, endByte: 1_048_576 },
        },
      },
    });
    expect(getFailureCampaignBudgetSnapshotV1(budget)).toMatchObject({
      ok: true,
      value: { used: { transformationAttempts: 1 } },
    });
    expect(enumerateFailureTransformationsV1(huge.value)).toEqual([]);
    expect(
      applyFailureTransformationV1(genuine.envelope, huge.value, {
        revision: "failure-transformation-v1",
        kind: "malformed-byte-chunk-delete",
        startByte: 1,
        endByte: 2,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution-plan-capacity" }] });
  }, 30_000);

  it("should order a statement before edits under its child pointer", () => {
    const fixture = createTypedReductionImplFixtures(genuine.context, 1)[0];
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    if (!initial.ok) return;
    const edits = enumerateFailureTransformationsV1(initial.value);
    const statementIndex = edits.findIndex(
      (edit) => edit.kind === "typed-statement-delete" && /\/body\/\d+$/u.test(edit.path),
    );
    if (statementIndex < 0) return;
    const statement = edits[statementIndex];
    if (statement === undefined || !("path" in statement)) return;
    const childIndex = edits.findIndex(
      (edit) => "path" in edit && edit.path.startsWith(`${statement.path}/`),
    );
    expect(childIndex).toBeGreaterThan(statementIndex);
  });

  it("should expose every invalid descriptor arm and return only applicable proposals", () => {
    const fixture = createTypedInvalidReductionImplFixtures(genuine.context, 1)[0];
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const edits = enumerateFailureTransformationsV1(initial.value);
    expect(new Set(edits.map(({ kind }) => kind))).toEqual(
      new Set([
        "invalid-baseline-delete",
        "invalid-baseline-simplify",
        "invalid-transform-target-rebase",
        "invalid-unused-binding-remove",
      ]),
    );
    const budget = createBudget();
    for (let ordinal = 0; ordinal <= edits.length; ordinal += 1) {
      const lookup = getFailureTransformationProposalV1(
        fixture.envelope,
        initial.value,
        ordinal,
        budget,
      );
      expect(lookup).toMatchObject({ ok: true });
      if (!lookup.ok || lookup.value.outcome === "catalog-complete") break;
      expect(
        applyFailureTransformationV1(
          fixture.envelope,
          initial.value,
          lookup.value.proposal.transformation,
        ),
      ).toMatchObject({ ok: true, value: lookup.value.proposal.candidate });
    }
  });
});
