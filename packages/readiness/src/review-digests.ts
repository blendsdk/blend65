import { createHash } from "node:crypto";
import type {
  ConflictRecord,
  InventoryRule,
  InventoryV1,
  ResolvedSourceFragment,
  SourceCitation,
} from "./model.js";

const CHAPTER_UNIT_IDS = Array.from(
  { length: 16 },
  (_, index) => `chapter-${String(index).padStart(2, "0")}`,
);

/** Population units that require independent semantic review. */
export const INVENTORY_REVIEW_UNIT_IDS = [
  ...CHAPTER_UNIT_IDS,
  "grammar",
  "c64-target",
  "contextual",
  "aggregate",
] as const;

/** Reproducible digest inputs for the semantic-review evidence gate. */
export interface InventoryReviewDigests {
  readonly currentDigests: Readonly<Record<string, string>>;
  readonly requiredDependencyIdsByUnit: Readonly<Record<string, readonly string[]>>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(source)
      .filter((key) => key !== "displayLine")
      .sort()
      .map((key) => [key, canonicalize(source[key])]),
  );
}

function digest(label: string, value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(label)
    .update(Buffer.from([0]))
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

function sourceUnit(path: string, classification: string): string {
  const chapter = path.match(/^spec\/(\d{2})-/)?.[1];
  if (chapter !== undefined && Number(chapter) <= 15) return `chapter-${chapter}`;
  if (path === "spec/grammar.ebnf.md") return "grammar";
  if (path === "spec/appendix-c64.md") return "c64-target";
  return classification === "normative-target" ? "c64-target" : "contextual";
}

function citationPath(citation: SourceCitation): string {
  return citation.path;
}

function ruleBelongsToUnit(rule: InventoryRule, unitId: string): boolean {
  if (unitId === "c64-target") {
    return rule.source.path === "spec/appendix-c64.md" || rule.universalProjection !== undefined;
  }
  return false;
}

function conflictBelongsToPaths(
  conflict: ConflictRecord,
  paths: ReadonlySet<string>,
): boolean {
  return conflict.citations.some((citation) => paths.has(citationPath(citation)));
}

/**
 * Computes canonical semantic and dependency digests for inventory review.
 *
 * Display line numbers are intentionally excluded because they are derived
 * presentation metadata rather than citation identity.
 */
export function computeInventoryReviewDigests(
  inventory: InventoryV1,
  fragments: readonly ResolvedSourceFragment[],
  identityLedgerBytes: Uint8Array,
): InventoryReviewDigests {
  const fragmentPathById = new Map(
    fragments.map(({ sourcePath, fragment }) => [fragment.fragmentId, sourcePath] as const),
  );
  const sourcesByUnit = new Map<string, string[]>();
  for (const source of inventory.normativeSources) {
    const unitId = sourceUnit(source.path, source.classification);
    const paths = sourcesByUnit.get(unitId) ?? [];
    paths.push(source.path);
    sourcesByUnit.set(unitId, paths);
  }

  const currentDigests: Record<string, string> = {};
  for (const unitId of INVENTORY_REVIEW_UNIT_IDS.filter((id) => id !== "aggregate")) {
    const paths = new Set(sourcesByUnit.get(unitId) ?? []);
    const unit = {
      sources: inventory.normativeSources.filter(({ path }) => paths.has(path)),
      fragments: fragments
        .filter(({ sourcePath }) => paths.has(sourcePath))
        .map(({ sourcePath, fragment, quote }) => ({ sourcePath, fragment, quote })),
      dispositions: inventory.clauseLedger.filter((entry) => {
        const path = fragmentPathById.get(entry.fragmentId);
        return path !== undefined && paths.has(path);
      }),
      rules: inventory.rules.filter(
        (rule) => paths.has(rule.source.path) || ruleBelongsToUnit(rule, unitId),
      ),
      conflicts: inventory.conflicts.filter((conflict) =>
        conflictBelongsToPaths(conflict, paths),
      ),
    };
    currentDigests[unitId] = digest(`blend65.inventory-review.${unitId}.v1`, unit);
  }

  currentDigests["shared-contracts"] = digest("blend65.inventory-review.contracts.v1", {
    handlerDeclarations: inventory.handlerDeclarations,
    evidenceCapabilityDeclarations: inventory.evidenceCapabilityDeclarations,
  });
  currentDigests["identity-ledger"] = digest(
    "blend65.inventory-review.identities.v1",
    new TextDecoder("utf-8", { fatal: true }).decode(identityLedgerBytes),
  );
  currentDigests.aggregate = digest("blend65.inventory-review.aggregate.v1", {
    inventory,
    identityLedger: new TextDecoder("utf-8", { fatal: true }).decode(identityLedgerBytes),
  });

  const ordinaryDependencies = ["identity-ledger", "shared-contracts"] as const;
  const requiredDependencyIdsByUnit: Record<string, readonly string[]> = {};
  for (const unitId of CHAPTER_UNIT_IDS) {
    requiredDependencyIdsByUnit[unitId] = ordinaryDependencies;
  }
  requiredDependencyIdsByUnit.grammar = ordinaryDependencies;
  requiredDependencyIdsByUnit["c64-target"] = [
    "chapter-00",
    "chapter-15",
    "identity-ledger",
    "shared-contracts",
  ];
  requiredDependencyIdsByUnit.contextual = [
    ...CHAPTER_UNIT_IDS,
    "c64-target",
    "grammar",
    "identity-ledger",
    "shared-contracts",
  ].sort();
  requiredDependencyIdsByUnit.aggregate = [
    ...INVENTORY_REVIEW_UNIT_IDS.filter((id) => id !== "aggregate"),
    "identity-ledger",
    "shared-contracts",
  ].sort();

  return { currentDigests, requiredDependencyIdsByUnit };
}
