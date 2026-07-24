import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeInventoryReviewDigests,
  createSourceRepository,
  fragmentSource,
  INVENTORY_REVIEW_UNIT_IDS,
  INVENTORY_V1_LIMITS,
  parseInventoryJson,
  renderDeclarationModule,
  validateInventorySchema,
  validateReviewEvidence,
} from "./index.js";
import type {
  InventoryV1,
  ResolvedSourceFragment,
  SemanticReviewRecord,
  SourceDocument,
  SourceFragment,
} from "./index.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const INVENTORY_PATH = join(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const IDENTITY_LEDGER_PATH = join(
  REPOSITORY_ROOT,
  "readiness/inventory/rule-identities-v1.jsonl",
);
const REVIEW_PATH = join(
  REPOSITORY_ROOT,
  "readiness/reviews/compiler-readiness-v1-review.json",
);
const NON_NORMATIVE_REASONS = new Set([
  "canonical-carrier-child",
  "contextual-source",
  "deferred-source",
  "example-or-rationale",
  "section-context",
  "structural-ebnf-container",
  "structural-heading",
  "structural-markup",
  "structural-table-cell",
  "table-header",
  "table-separator",
]);
const CAPABILITY_IDS = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"];

function normalizedQuote(document: SourceDocument, fragment: SourceFragment): string {
  return new TextDecoder("utf-8", { fatal: true })
    .decode(document.bytes.subarray(fragment.startByte, fragment.endByte))
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .normalize("NFC");
}

async function loadInventory(): Promise<InventoryV1> {
  const parsed = parseInventoryJson(await readFile(INVENTORY_PATH), INVENTORY_V1_LIMITS);
  if (!parsed.ok) throw new TypeError("The authoritative inventory must be strict JSON.");
  const schema = validateInventorySchema(parsed.inventory);
  if (!schema.ok || schema.inventory === undefined) {
    throw new TypeError("The authoritative inventory must satisfy its closed schema.");
  }
  return schema.inventory;
}

async function resolvedFragments(
  inventory: InventoryV1,
): Promise<readonly ResolvedSourceFragment[]> {
  const repository = await createSourceRepository({
    repositoryRoot: REPOSITORY_ROOT,
    specRoot: join(REPOSITORY_ROOT, "spec"),
    limits: INVENTORY_V1_LIMITS,
  });
  const fragments: ResolvedSourceFragment[] = [];
  for (const source of inventory.normativeSources) {
    const document = await repository.read(source.path);
    const result = fragmentSource(document, inventory.fragmentationProfile, INVENTORY_V1_LIMITS);
    if (!result.ok) throw new TypeError(`Could not fragment ${source.path}.`);
    fragments.push(
      ...result.fragments.map((fragment) => ({
        sourcePath: source.path,
        fragment,
        quote: normalizedQuote(document, fragment),
      })),
    );
  }
  return fragments;
}

function reviewRecords(value: unknown): readonly SemanticReviewRecord[] {
  if (typeof value !== "object" || value === null || !("reviews" in value)) {
    throw new TypeError("Review evidence must contain a reviews collection.");
  }
  const reviews = value.reviews;
  if (!Array.isArray(reviews)) throw new TypeError("Review evidence must be an array.");
  return reviews.map((record) => {
    if (
      typeof record !== "object" ||
      record === null ||
      !("unitId" in record) ||
      typeof record.unitId !== "string" ||
      !("reviewer" in record) ||
      typeof record.reviewer !== "string" ||
      !("specRevision" in record) ||
      typeof record.specRevision !== "string" ||
      !("semanticDigest" in record) ||
      typeof record.semanticDigest !== "string" ||
      !("dependencyDigests" in record) ||
      typeof record.dependencyDigests !== "object" ||
      record.dependencyDigests === null ||
      Array.isArray(record.dependencyDigests) ||
      Object.values(record.dependencyDigests).some((digest) => typeof digest !== "string") ||
      !("outcome" in record) ||
      (record.outcome !== "accepted" && record.outcome !== "blocked") ||
      !("resolvedDisagreementIds" in record) ||
      !Array.isArray(record.resolvedDisagreementIds) ||
      record.resolvedDisagreementIds.some((id: unknown) => typeof id !== "string")
    ) {
      throw new TypeError("Review evidence contains an invalid record.");
    }
    return {
      unitId: record.unitId,
      reviewer: record.reviewer,
      specRevision: record.specRevision,
      semanticDigest: record.semanticDigest,
      dependencyDigests: Object.fromEntries(
        Object.entries(record.dependencyDigests).map(([key, digest]) => [key, String(digest)]),
      ),
      outcome: record.outcome,
      resolvedDisagreementIds: record.resolvedDisagreementIds,
    };
  });
}

describe("authoritative inventory population internals", () => {
  it("should use only the closed disposition taxonomy and canonical authority", async () => {
    const inventory = await loadInventory();
    const contextualPaths = new Set(
      inventory.normativeSources
        .filter(({ classification }) =>
          ["contextual", "deferred", "rejected"].includes(classification),
        )
        .map(({ path }) => path),
    );

    expect(
      inventory.clauseLedger.every(
        (entry) =>
          entry.disposition !== "non-normative" ||
          NON_NORMATIVE_REASONS.has(entry.reasonCode),
      ),
    ).toBe(true);
    expect(inventory.rules.some(({ source }) => contextualPaths.has(source.path))).toBe(false);
    expect(new Set(inventory.rules.map(({ ruleId }) => ruleId)).size).toBe(
      inventory.rules.length,
    );
    expect(inventory.rules.every(({ ruleId }) => !ruleId.includes("frag.v1"))).toBe(true);
  });

  it("should keep declarations, identities and universal projections closed", async () => {
    const inventory = await loadInventory();
    const ledgerText = await readFile(IDENTITY_LEDGER_PATH, "utf8");
    const events = ledgerText.trimEnd().split("\n").map((line) => JSON.parse(line));
    const projectedParents = new Set(
      inventory.rules.flatMap(({ universalProjection }) =>
        universalProjection === undefined ? [] : [universalProjection.parentRuleId],
      ),
    );

    expect(inventory.evidenceCapabilityDeclarations.map(({ id }) => id)).toEqual(CAPABILITY_IDS);
    expect(events.map(({ ruleId }) => ruleId)).toEqual(
      inventory.rules.map(({ ruleId }) => ruleId),
    );
    expect(events.every(({ operation }) => operation === "allocate")).toBe(true);
    expect(events.at(-1)?.eventHash).toBe(inventory.identityLedgerHead);
    expect(projectedParents.size).toBeGreaterThan(0);
    for (const parentRuleId of projectedParents) {
      expect(
        inventory.rules
          .filter(({ universalProjection }) => universalProjection?.parentRuleId === parentRuleId)
          .map(({ universalProjection }) => universalProjection?.target)
          .sort(),
      ).toEqual(["a7800", "a800xl", "c64", "c64u", "cx16"]);
    }
    expect(renderDeclarationModule(inventory)).toBe(renderDeclarationModule(inventory));
  });

  it("should require current independent unit and aggregate review evidence", async () => {
    const inventory = await loadInventory();
    const identityLedgerBytes = await readFile(IDENTITY_LEDGER_PATH);
    const digests = computeInventoryReviewDigests(
      inventory,
      await resolvedFragments(inventory),
      identityLedgerBytes,
    );
    const records = reviewRecords(JSON.parse(await readFile(REVIEW_PATH, "utf8")));
    const result = validateReviewEvidence(records, {
      expectedSpecRevision: inventory.specRevision,
      requiredUnitIds: INVENTORY_REVIEW_UNIT_IDS,
      requiredDependencyIdsByUnit: digests.requiredDependencyIdsByUnit,
      currentDigests: digests.currentDigests,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
