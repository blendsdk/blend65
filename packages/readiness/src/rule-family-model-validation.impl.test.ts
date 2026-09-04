import { describe, expect, it } from "vitest";

import {
  createFirstVerticalEmbeddedFixtureSetV2,
  createFirstVerticalPublicationCandidateV2,
  createFirstRuleModelRegistryV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
  validateRuleModelRegistryV2,
} from "./index.js";
import { validateRuleModelRegistryAgainstInventoryV2 } from "./rule-family-model.js";
import { getPublishedRuleFamilyRecordAuthorityV2 } from "./rule-family-publication-record.js";
import { projectRuleFamilySuccessorInventoryV2 } from "./rule-family-inventory.js";
import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";
import { readInventoryVersioned } from "./versioning.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("expected a record");
  }
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected an array");
  return value;
}

async function prepareModel() {
  const fixture = await createOraclePublicationSpecFixture();
  const source = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot: fixture.repositoryRoot,
    publicationDigest: fixture.publicationDigest,
  });
  if (!source.ok) throw new TypeError("passive predecessor was unavailable");
  const firstVertical = createFirstVerticalPublicationCandidateV2();
  const fixtureSet = createFirstVerticalEmbeddedFixtureSetV2(firstVertical);
  if (!fixtureSet.ok) throw new TypeError("fixture authority was unavailable");
  const model = createFirstRuleModelRegistryV2({
    sourceRecord: source.value,
    firstVertical,
    fixtureSet: fixtureSet.fixtureSet,
  });
  if (!model.ok) throw new TypeError(JSON.stringify(model));
  const sourceAuthority = getPublishedRuleFamilyRecordAuthorityV2(source.value);
  const inventoryBytes = sourceAuthority?.members.get("compiler-readiness-v1.json");
  const predecessor =
    inventoryBytes === undefined ? undefined : readInventoryVersioned(inventoryBytes);
  const inventory =
    predecessor?.ok && predecessor.inventory !== undefined
      ? projectRuleFamilySuccessorInventoryV2(predecessor.inventory)
      : undefined;
  if (inventory === undefined) throw new TypeError("successor inventory was unavailable");
  return { fixture, model, inventory: inventory.inventory };
}

describe("deep rule-model validation", () => {
  it("rejects nested shape and cross-identity substitutions", async () => {
    const setup = await prepareModel();
    try {
      const version = record(structuredClone(setup.model.model));
      record(version.version).extra = true;
      expect(validateRuleModelRegistryV2(version)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.unsupported-version", path: "/version" }],
      });

      const family = record(structuredClone(setup.model.model));
      array(record(array(family.families)[0]).memberRuleIds).pop();
      expect(validateRuleModelRegistryV2(family)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-family", path: "/families/0" }],
      });

      const reviewed = record(structuredClone(setup.model.model));
      const reviewedRows = array(reviewed.dispositions).map(record);
      const reviewedIndex = reviewedRows.findIndex(({ state }) => state === "reviewed");
      record(reviewedRows[reviewedIndex]?.result).evidenceDigest = `sha256:${"0".repeat(64)}`;
      expect(validateRuleModelRegistryV2(reviewed)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-disposition" }],
      });

      const caseIdentity = record(structuredClone(setup.model.model));
      record(array(caseIdentity.structuredCases)[0]).sourceDigest = `sha256:${"1".repeat(64)}`;
      expect(validateRuleModelRegistryV2(caseIdentity)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-case-binding" }],
      });

      const shortenedInventory = {
        ...setup.inventory,
        rules: setup.inventory.rules.slice(1),
      };
      expect(
        validateRuleModelRegistryAgainstInventoryV2(setup.model.model, shortenedInventory),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-cardinality" }],
      });
    } finally {
      await setup.fixture.cleanup();
    }
  });

  it("returns a detached deeply immutable model snapshot", async () => {
    const setup = await prepareModel();
    try {
      const input = structuredClone(setup.model.model);
      const validated = validateRuleModelRegistryV2(input);
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new TypeError("model replay was rejected");
      const originalRuleId = validated.model.dispositions[0]?.ruleId;
      record(array(record(input).dispositions)[0]).ruleId = "rule.replaced";
      expect(validated.model.dispositions[0]?.ruleId).toBe(originalRuleId);
      expect(Object.isFrozen(validated.model)).toBe(true);
      expect(Object.isFrozen(validated.model.dispositions)).toBe(true);
      expect(Object.isFrozen(validated.model.dispositions[0]?.result)).toBe(true);
      expect(Object.isFrozen(validated.model.structuredCases[0])).toBe(true);
    } finally {
      await setup.fixture.cleanup();
    }
  });

  it("rejects accessors without executing them", async () => {
    const setup = await prepareModel();
    try {
      const input = structuredClone(setup.model.model);
      let getterCalls = 0;
      Object.defineProperty(input, "families", {
        enumerable: true,
        get(): unknown {
          getterCalls += 1;
          return setup.model.model.families;
        },
      });

      expect(validateRuleModelRegistryV2(input)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-cardinality", path: "/" }],
      });
      expect(getterCalls).toBe(0);
    } finally {
      await setup.fixture.cleanup();
    }
  });

  it("rejects exotic prototypes, cycles, symbols, and sparse arrays", async () => {
    const setup = await prepareModel();
    try {
      const exotic = structuredClone(setup.model.model);
      Object.setPrototypeOf(exotic, { inherited: true });
      expect(validateRuleModelRegistryV2(exotic).ok).toBe(false);

      const cyclic = structuredClone(setup.model.model);
      record(cyclic).cycle = cyclic;
      expect(validateRuleModelRegistryV2(cyclic).ok).toBe(false);

      const symbolic = structuredClone(setup.model.model);
      Object.defineProperty(symbolic, Symbol("hidden"), { value: true, enumerable: true });
      expect(validateRuleModelRegistryV2(symbolic).ok).toBe(false);

      const sparse = structuredClone(setup.model.model);
      delete array(record(sparse).dispositions)[0];
      expect(validateRuleModelRegistryV2(sparse).ok).toBe(false);
    } finally {
      await setup.fixture.cleanup();
    }
  });
});
