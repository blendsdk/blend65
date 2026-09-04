import { describe, expect, it, vi } from "vitest";

import { EXPECTED_FIRST_VERTICAL_RULE_IDS } from "./test-fixtures/structured-phase1-authority-spec-fixture.js";
import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";

const decoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function expectOk<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is T & { readonly ok: true } {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result));
  }
}

function expectDiagnostic(result: unknown, code: string, path?: string): void {
  const record = requireRecord(result, "rejected validation result");
  expect(record.ok).toBe(false);
  expect(record).not.toHaveProperty("model");
  expect(record).not.toHaveProperty("fixtureSet");
  expect(record.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code,
        ...(path === undefined ? {} : { path }),
      }),
    ]),
  );
}

async function resolverApi(): Promise<typeof import("./publication-resolver.js")> {
  return vi.importActual<typeof import("./publication-resolver.js")>("./publication-resolver.js");
}

async function firstVerticalApi(): Promise<typeof import("./first-vertical-publication.js")> {
  return vi.importActual<typeof import("./first-vertical-publication.js")>(
    "./first-vertical-publication.js",
  );
}

async function fixtureApi(): Promise<typeof import("./embed-case-fixtures.js")> {
  return vi.importActual<typeof import("./embed-case-fixtures.js")>("./embed-case-fixtures.js");
}

async function modelApi(): Promise<typeof import("./rule-family-model.js")> {
  return vi.importActual<typeof import("./rule-family-model.js")>("./rule-family-model.js");
}

async function createFirstModel() {
  const fixture = await createOraclePublicationSpecFixture();
  const [resolver, firstVertical, fixtures, models] = await Promise.all([
    resolverApi(),
    firstVerticalApi(),
    fixtureApi(),
    modelApi(),
  ]);
  const sourceResult = await resolver.resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot: fixture.repositoryRoot,
    publicationDigest: fixture.publicationDigest,
  });
  expectOk(sourceResult);
  const sourceRecord = sourceResult.value;
  const candidate = firstVertical.createFirstVerticalPublicationCandidateV2();
  const fixtureResult = fixtures.createFirstVerticalEmbeddedFixtureSetV2(candidate);
  expectOk(fixtureResult);
  const modelResult = models.createFirstRuleModelRegistryV2({
    sourceRecord,
    firstVertical: candidate,
    fixtureSet: fixtureResult.fixtureSet,
  });
  expectOk(modelResult);
  return { fixture, fixtures, models, candidate, fixtureResult, modelResult };
}

describe("authenticated embedded-case fixture references", () => {
  it("derives the first vertical's canonical authenticated empty fixture set", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const [firstVertical, fixtures] = await Promise.all([firstVerticalApi(), fixtureApi()]);
      const candidate = firstVertical.createFirstVerticalPublicationCandidateV2();
      const first = fixtures.createFirstVerticalEmbeddedFixtureSetV2(candidate);
      const second = fixtures.createFirstVerticalEmbeddedFixtureSetV2(candidate);
      expectOk(first);
      expectOk(second);

      expect(first.document).toEqual({
        schemaVersion: 2,
        kind: "embedded-case-fixtures-v2",
        fixtures: [],
      });
      expect(first.fixtureSetDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(JSON.parse(decoder.decode(first.canonicalBytes))).toEqual(first.document);
      expect(second.document).toEqual(first.document);
      expect(second.fixtureSetDigest).toBe(first.fixtureSetDigest);
      expect(second.canonicalBytes).toEqual(first.canonicalBytes);

      first.canonicalBytes.fill(0);
      const repeated = fixtures.createFirstVerticalEmbeddedFixtureSetV2(candidate);
      expectOk(repeated);
      expect(repeated.canonicalBytes).toEqual(second.canonicalBytes);
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects unsafe, forged, duplicate, and unknown fixture references at their fields", async () => {
    const fixtures = await fixtureApi();
    const digest = `sha256:${"1".repeat(64)}` as const;
    const reference = {
      fixtureId: "fixture.three-bytes",
      digest,
      relativePath: "fixtures/three-bytes.bin",
    };
    const document = {
      schemaVersion: 2,
      kind: "embedded-case-fixtures-v2",
      fixtures: [reference],
    };

    for (const relativePath of [
      "/fixtures/three-bytes.bin",
      "fixtures/../three-bytes.bin",
      "fixtures//three-bytes.bin",
      "fixtures\\three-bytes.bin",
    ]) {
      expectDiagnostic(
        fixtures.validateEmbeddedCaseFixtureDocumentV2({
          ...document,
          fixtures: [{ ...reference, relativePath }],
        }),
        "rule-model.invalid-fixture-path",
        "/fixtures/0/relativePath",
      );
    }

    expectDiagnostic(
      fixtures.validateEmbeddedCaseFixtureDocumentV2({
        ...document,
        fixtures: [{ ...reference, digest: `sha256:${"f".repeat(63)}` }],
      }),
      "rule-model.invalid-fixture-digest",
      "/fixtures/0/digest",
    );
    expectDiagnostic(
      fixtures.validateEmbeddedCaseFixtureDocumentV2({
        ...document,
        fixtures: [reference, reference],
      }),
      "rule-model.invalid-fixture-population",
      "/fixtures/1/fixtureId",
    );
    expectDiagnostic(
      fixtures.validateEmbeddedCaseFixtureDocumentV2(document),
      "rule-model.invalid-fixture-population",
      "/fixtures/0/fixtureId",
    );
  });
});

describe("complete first rule-model registry", () => {
  it("derives one immutable row per inventory rule with exactly sixteen reviewed rows", async () => {
    const setup = await createFirstModel();
    try {
      const { modelResult, candidate } = setup;
      const model = modelResult.model;
      const dispositions = requireArray(model.dispositions, "terminal dispositions").map((row) =>
        requireRecord(row, "terminal disposition"),
      );
      const ruleIds = dispositions.map(({ ruleId }) => ruleId);
      const reviewed = dispositions.filter(({ state }) => state === "reviewed");
      const pending = dispositions.filter(({ state }) => state === "pending-review");

      expect(model).toMatchObject({
        schemaVersion: 2,
        kind: "rule-model-registry-v2",
        specRevision: "spec-v3.0",
      });
      expect(requireRecord(model.version, "model version")).toMatchObject({
        schemaVersion: 2,
        kind: "rule-model-version-v2",
        version: "2.0.0",
      });
      expect(dispositions).toHaveLength(2_112);
      expect(ruleIds).toEqual([...ruleIds].sort());
      expect(new Set(ruleIds)).toHaveLength(2_112);
      expect(reviewed.map(({ ruleId }) => ruleId)).toEqual(EXPECTED_FIRST_VERTICAL_RULE_IDS);
      expect(pending).toHaveLength(2_096);

      for (const row of pending) {
        expect(Object.keys(row).sort()).toEqual(["result", "ruleId", "state"]);
        expect(row.result).toEqual({ kind: "blocking", reason: "family-review-pending" });
      }
      for (const row of reviewed) {
        expect(Object.keys(row).sort()).toEqual([
          "claimRole",
          "result",
          "route",
          "ruleId",
          "state",
        ]);
        expect(row.claimRole).toMatch(/^(?:secondary-quality|semantic-gate)$/u);
        expect(requireRecord(row.route, "reviewed route").kind).toMatch(/^(?:non-source|source)$/u);
        expect(requireRecord(row.result, "reviewed result").kind).toMatch(
          /^(?:blocking|failing|passing)$/u,
        );
      }

      const expectedCaseDigests = new Map<string, unknown>();
      for (const bindingValue of requireArray(candidate.evidenceBindings, "evidence bindings")) {
        const binding = requireRecord(bindingValue, "evidence binding");
        for (const evidenceValue of requireArray(binding.evidence, "binding evidence")) {
          const evidence = requireRecord(evidenceValue, "evidence entry");
          if (typeof evidence.caseId !== "string") {
            throw new TypeError("expected a case identifier");
          }
          expectedCaseDigests.set(evidence.caseId, evidence.caseDigest);
        }
      }
      const structuredCases = requireArray(model.structuredCases, "structured cases").map((row) =>
        requireRecord(row, "structured case"),
      );
      for (const [caseId, caseDigest] of expectedCaseDigests) {
        expect(structuredCases).toEqual(
          expect.arrayContaining([expect.objectContaining({ caseId, caseDigest })]),
        );
      }
      const combined = structuredCases.filter(
        ({ caseId }) => caseId === "case.structured.vertical-combined-v1",
      );
      expect(combined).toHaveLength(1);
      expect(combined[0]?.executionEnvelopeDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(modelResult.modelDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(JSON.parse(decoder.decode(modelResult.canonicalBytes))).toEqual(model);

      const replayed = setup.models.validateRuleModelRegistryV2(model);
      expectOk(replayed);
      expect(replayed.modelDigest).toBe(modelResult.modelDigest);
      expect(replayed.canonicalBytes).toEqual(modelResult.canonicalBytes);
    } finally {
      await setup.fixture.cleanup();
    }
  });

  it("rejects incomplete and mixed disposition variants before persistence", async () => {
    const setup = await createFirstModel();
    try {
      const base = setup.modelResult.model;
      const dispositions = requireArray(base.dispositions, "terminal dispositions").map((row) =>
        requireRecord(row, "terminal disposition"),
      );
      const reviewedIndex = dispositions.findIndex(({ state }) => state === "reviewed");
      const pendingIndex = dispositions.findIndex(({ state }) => state === "pending-review");
      expect(reviewedIndex).toBeGreaterThanOrEqual(0);
      expect(pendingIndex).toBeGreaterThanOrEqual(0);

      const pendingWithClaim = requireRecord(structuredClone(base), "pending-claim model");
      requireRecord(
        requireArray(pendingWithClaim.dispositions, "pending dispositions")[pendingIndex],
        "pending row",
      ).claimRole = "semantic-gate";
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(pendingWithClaim),
        "rule-model.invalid-disposition",
        `/dispositions/${pendingIndex}/claimRole`,
      );

      const reviewedWithoutRoute = requireRecord(
        structuredClone(base),
        "reviewed-without-route model",
      );
      delete requireRecord(
        requireArray(reviewedWithoutRoute.dispositions, "reviewed dispositions")[reviewedIndex],
        "reviewed row",
      ).route;
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(reviewedWithoutRoute),
        "rule-model.invalid-disposition",
        `/dispositions/${reviewedIndex}/route`,
      );

      const mixedState = requireRecord(structuredClone(base), "mixed-state model");
      requireRecord(
        requireArray(mixedState.dispositions, "mixed dispositions")[pendingIndex],
        "mixed row",
      ).state = "reviewed";
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(mixedState),
        "rule-model.invalid-disposition",
      );

      const obsoleteReason = requireRecord(structuredClone(base), "obsolete-reason model");
      requireRecord(
        requireRecord(
          requireArray(obsoleteReason.dispositions, "obsolete dispositions")[pendingIndex],
          "obsolete row",
        ).result,
        "obsolete result",
      ).reason = "outside-initial-slice";
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(obsoleteReason),
        "rule-model.invalid-disposition",
        `/dispositions/${pendingIndex}/result/reason`,
      );

      const omitted = requireRecord(structuredClone(base), "omitted model");
      requireArray(omitted.dispositions, "omitted dispositions").pop();
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(omitted),
        "rule-model.invalid-cardinality",
        "/dispositions",
      );

      const alternateFields = requireRecord(structuredClone(base), "alternate-field model");
      alternateFields.rules = alternateFields.dispositions;
      delete alternateFields.dispositions;
      expectDiagnostic(
        setup.models.validateRuleModelRegistryV2(alternateFields),
        "rule-model.invalid-cardinality",
        "/dispositions",
      );
    } finally {
      await setup.fixture.cleanup();
    }
  });
});
