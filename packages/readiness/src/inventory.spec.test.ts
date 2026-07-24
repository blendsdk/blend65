import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createSourceRepository,
  fragmentSource,
  INVENTORY_V1_LIMITS,
  parseInventoryJson,
  validateInventorySchema,
  validateInventorySemantics,
  validateInventorySources,
} from "./index.js";
import type {
  InventoryV1,
  ResolvedSourceFragment,
  SemanticValidationContext,
  SourceDocument,
  SourceFragment,
} from "./index.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SPEC_ROOT = join(REPOSITORY_ROOT, "spec");
const INVENTORY_PATH = join(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const IDENTITY_LEDGER_PATH = join(REPOSITORY_ROOT, "readiness/inventory/rule-identities-v1.jsonl");
const BLOCKING_REASON_ORDER = [
  "blocked-errata",
  "unresolved-source-conflict",
  "unbound-handler",
  "unbound-evidence-capability",
] as const;
const EMISSION_RULE_IDS = [
  "rule.ch03.5-2-startup-cost.struct-initializer-n-bytes.rom-cost.4n-bytes",
  "rule.ch03.5-2-startup-cost.fill-array-n-bytes.rom-cost.7-bytes-loop",
  "rule.ch03.5-2-startup-cost.explicit-array-n-values.rom-cost.4n-bytes",
  "rule.ch03.5-2-startup-cost.uninitialized-variable.rom-cost.0-bytes",
  "rule.ch07.6-cost-summary.zp-per-active-struct.cost.2-bytes",
] as const;
const RUNTIME_RULE_IDS = [
  "rule.ch05.5-2-rules.condition-evaluated-before-each-iteration-false",
  "rule.ch05.6-2-rules.body-executes-least-once-condition-evaluated",
  "rule.ch05.7-2-direction-bounds.until.meaning.loop-visits-start-end",
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
  "rule.ch05.7-2-direction-bounds.downto.meaning.loop-visits-start-end",
  "rule.ch05.7-7-6502-code-generation.comparing-against-256-impossible-8-bits",
] as const;
const REJECTION_RULE_IDS = [
  "rule.ch06.fn-4.struct-type.allowed.root",
  "rule.ch06.fn-4.array-type.allowed.root",
  "rule.ch08.str-3.petscii.atari-800xl.root",
  "rule.ch08.str-3.petscii.atari-7800.root",
  "rule.ch08.str-3.screen-codes.atari-800xl.root",
  "rule.ch08.str-3.screen-codes.atari-7800.root",
  "rule.ch08.str-3.atascii.c64.root",
  "rule.ch08.str-3.atascii.cx16.root",
  "rule.ch08.str-3.atascii.atari-7800.root",
  "rule.ch08.str-3.internal-codes.c64.root",
  "rule.ch08.str-3.internal-codes.cx16.root",
  "rule.ch08.str-3.internal-codes.atari-7800.root",
  "rule.ch10.4-3-import-rules.bit-you-import-multiply.explicit-bit.value",
] as const;

function normalizedQuote(document: SourceDocument, fragment: SourceFragment): string {
  return new TextDecoder("utf-8", { fatal: true })
    .decode(document.bytes.subarray(fragment.startByte, fragment.endByte))
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .normalize("NFC");
}

async function loadInventory(): Promise<InventoryV1> {
  const parsed = parseInventoryJson(await readFile(INVENTORY_PATH), INVENTORY_V1_LIMITS);
  expect(parsed.ok).toBe(true);
  const schema = validateInventorySchema(parsed.inventory);
  expect(schema.ok).toBe(true);
  if (schema.inventory === undefined) {
    throw new TypeError("The authoritative inventory must satisfy its closed schema.");
  }
  return schema.inventory;
}

async function semanticContext(inventory: InventoryV1): Promise<SemanticValidationContext> {
  const repository = await createSourceRepository({
    repositoryRoot: REPOSITORY_ROOT,
    specRoot: SPEC_ROOT,
    limits: INVENTORY_V1_LIMITS,
  });
  const fragments: ResolvedSourceFragment[] = [];
  for (const source of inventory.normativeSources) {
    const document = await repository.read(source.path);
    const result = fragmentSource(document, inventory.fragmentationProfile, INVENTORY_V1_LIMITS);
    expect(result.ok).toBe(true);
    fragments.push(
      ...result.fragments.map((fragment) => ({
        sourcePath: source.path,
        fragment,
        quote: normalizedQuote(document, fragment),
      })),
    );
  }
  return {
    fragments,
    identityLedgerBytes: await readFile(IDENTITY_LEDGER_PATH),
    limits: INVENTORY_V1_LIMITS,
  };
}

describe("authoritative compiler-readiness inventory", () => {
  it("should classify every specification file and dispose every included fragment", async () => {
    const inventory = await loadInventory();
    const repository = await createSourceRepository({
      repositoryRoot: REPOSITORY_ROOT,
      specRoot: SPEC_ROOT,
      limits: INVENTORY_V1_LIMITS,
    });

    expect(inventory.normativeSources.map((source) => source.path)).toEqual(
      await repository.listSpecFiles(),
    );

    const sourceValidation = await validateInventorySources(repository, inventory);
    expect(sourceValidation.diagnostics).toEqual([]);
    expect(sourceValidation.ok).toBe(true);
    expect(inventory.clauseLedger.length).toBeGreaterThan(0);
  });

  it("should preserve every explicit readiness blocker while validating the denominator", async () => {
    const inventory = await loadInventory();
    const result = validateInventorySemantics(inventory, await semanticContext(inventory));

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.inventory?.rules.length).toBeGreaterThan(0);
    expect(result.blockingReasons).toEqual(
      [...result.blockingReasons].sort((left, right) => {
        const leftKey = `${String(BLOCKING_REASON_ORDER.indexOf(left.kind)).padStart(2, "0")}\u0000${left.identity}`;
        const rightKey = `${String(BLOCKING_REASON_ORDER.indexOf(right.kind)).padStart(2, "0")}\u0000${right.identity}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
    );
  });

  it("should expose only stable independently falsifiable semantic rules", async () => {
    const inventory = await loadInventory();
    const structuralRequirement =
      /^(?:Rationale:|This chapter (?:defines|specifies|covers)|All error codes defined)|\b(?:This chapter|Document History|Related Documents)\b/i;
    const rejectionLanguage =
      /\b(?:cannot|must not|not allowed|not permitted|prohibited|invalid|no —|→\s*E\d{5}|E\d{5})\b/i;

    expect(inventory.rules.some(({ ruleId }) => /\.variant-\d+$/.test(ruleId))).toBe(false);
    expect(inventory.rules.some(({ requirement }) => structuralRequirement.test(requirement))).toBe(
      false,
    );
    expect(
      inventory.rules.some(
        ({ polarity, requirement }) =>
          polarity === "positive" && rejectionLanguage.test(requirement),
      ),
    ).toBe(false);
  });

  it("should require sufficient executable evidence for emitted and runtime claims", async () => {
    const inventory = await loadInventory();
    const emittedClaim =
      /\b(?:opcode|machine code|assembly|instructions?|bytes? and \d+ cycles?|zero instructions|runtime cost|emits?\s+(?:an?\s+)?(?:opcode|instruction|assembly|binary|byte))\b/i;
    const runtimeClaim =
      /\b(?:processor flags?|status flags?|hardware stack|execute|runtime|interrupt|memory-mapped|cycles?)\b/i;

    for (const rule of inventory.rules) {
      if (emittedClaim.test(rule.requirement)) {
        expect(rule.evidenceObligations, rule.ruleId).toContain("emit");
        expect(rule.evidenceObligations, rule.ruleId).toContain("acme");
      }
      if (runtimeClaim.test(rule.requirement) && rule.applicability === "mandatory-c64") {
        expect(rule.evidenceObligations, rule.ruleId).toContain("vice");
      }
    }
  });

  it("should preserve rejection polarity and executable evidence for reviewed rules", async () => {
    const inventory = await loadInventory();
    const rules = new Map(inventory.rules.map((rule) => [rule.ruleId, rule]));

    for (const ruleId of EMISSION_RULE_IDS) {
      const rule = rules.get(ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.evidenceObligations, ruleId).toEqual([
        "acme",
        "compiler-api",
        "emit",
        "frontend",
      ]);
      expect(rule?.generatorIds, ruleId).toEqual(["generator.compiler-cases"]);
      expect(rule?.oracleIds, ruleId).toEqual(["oracle.emitted-program"]);
      expect(rule?.transformIds, ruleId).toEqual(["transform.boundary-variants"]);
    }

    for (const ruleId of RUNTIME_RULE_IDS) {
      const rule = rules.get(ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.evidenceObligations, ruleId).toEqual([
        "acme",
        "compiler-api",
        "emit",
        "frontend",
        "vice",
      ]);
      expect(rule?.generatorIds, ruleId).toEqual(["generator.runtime-cases"]);
      expect(rule?.oracleIds, ruleId).toEqual(["oracle.runtime-state"]);
      expect(rule?.transformIds, ruleId).toEqual(["transform.boundary-variants"]);
    }

    for (const ruleId of REJECTION_RULE_IDS) {
      const rule = rules.get(ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.polarity, ruleId).toBe("negative-rejection");
      expect(rule?.evidenceObligations, ruleId).toEqual(["frontend"]);
      expect(rule?.generatorIds, ruleId).toEqual(["generator.frontend-cases"]);
      expect(rule?.oracleIds, ruleId).toEqual(["oracle.frontend-result"]);
      expect(rule?.transformIds, ruleId).toEqual(["transform.boundary-variants"]);
    }
  });

  it("should keep concrete non-C64 target facts outside the C64 denominator", async () => {
    const inventory = await loadInventory();
    const otherTarget = /^\|\s*`?(c64u|cx16|a800xl|a7800)`?\s*\|/i;

    for (const rule of inventory.rules.filter(({ source }) => otherTarget.test(source.quote))) {
      expect(rule.applicability, rule.ruleId).toBe("out-of-claim-target");
      expect(rule.applicabilityReason?.target, rule.ruleId).toMatch(/^(?:c64u|cx16|a800xl|a7800)$/);
      expect(rule.evidenceObligations, rule.ruleId).not.toContain("vice");
    }
  });
});
