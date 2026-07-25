import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { InventoryV1 } from "./model.js";
import { createModeledGeneratorSuite, getRuleGenerationDomain } from "./modeled-generator-suite.js";
import { applyModeledRuleNeighbor, generateFrontendCase } from "./modeled-generators.js";
import { INVENTORY_V1_LIMITS, parseInventoryJson, validateInventorySchema } from "./index.js";
import { isGenIdentifier, type GenerationBudget } from "./generator-ir.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { buildModeledModule } from "./modeled-case-builder.js";
import {
  createModeledChoices,
  MODELED_RULE_FACTS,
  modeledOperationIds,
} from "./modeled-generator-facts.js";
import type { ModeledCaseChoice, ModeledGeneratorSuite } from "./modeled-generator-model.js";

const BUDGET: GenerationBudget = {
  maxModules: 4,
  maxDeclarations: 128,
  maxIrNodes: 512,
  maxStatements: 256,
  maxExpressionDepth: 16,
  maxLoopWork: 1n,
  maxSourceBytes: 65_536,
  maxAttempts: 128,
};

interface SuiteFixture {
  readonly suite: ModeledGeneratorSuite;
  readonly seedBytes: Uint8Array;
  readonly modelBytes: Uint8Array;
  readonly reviewBytes: Uint8Array;
  readonly inventory: InventoryV1;
}

async function loadSuiteFixture(): Promise<SuiteFixture> {
  const [seedBytes, modelBytes, reviewBytes, inventoryBytes] = await Promise.all([
    readFile(new URL("../../../readiness/rule-models/rule-model-seed-v1.json", import.meta.url)),
    readFile(new URL("../../../readiness/rule-models/rule-models-v1.json", import.meta.url)),
    readFile(new URL("../../../readiness/reviews/rule-models-v1-review.json", import.meta.url)),
    readFile(new URL("../../../readiness/inventory/compiler-readiness-v1.json", import.meta.url)),
  ]);
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) {
    throw new TypeError("Inventory fixture must parse.");
  }
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("Inventory fixture must validate.");
  }
  const created = createModeledGeneratorSuite({
    seedContractBytes: seedBytes,
    ruleModelBytes: modelBytes,
    reviewEvidenceBytes: reviewBytes,
    inventory: validated.inventory,
  });
  if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics));
  return {
    suite: created.suite,
    seedBytes,
    modelBytes,
    reviewBytes,
    inventory: validated.inventory,
  };
}

let suiteFixturePromise: Promise<SuiteFixture> | undefined;

function suiteFixture(): Promise<SuiteFixture> {
  suiteFixturePromise ??= loadSuiteFixture();
  return suiteFixturePromise;
}

function validRequest(choice: ModeledCaseChoice) {
  return {
    handlerId:
      choice.kind === "scalar"
        ? ("generator.frontend-cases" as const)
        : ("generator.runtime-cases" as const),
    modulePath: ["ModeledInvariant"],
    choice,
    validity: { kind: "valid" as const },
    budget: BUDGET,
  };
}

function choiceKey(choice: ModeledCaseChoice): string {
  return choice.kind === "scalar"
    ? [
        choice.kind,
        choice.ruleId,
        choice.spelling,
        typeof choice.value === "bigint" ? choice.value.toString() : String(choice.value),
      ].join("|")
    : [
        choice.kind,
        choice.ruleId,
        choice.addressSpelling,
        choice.addressForm,
        choice.valueSpelling ?? "",
      ].join("|");
}

describe("modeled generator invariants", () => {
  it("expands the reviewed seed to a deterministic duplicate-free 120-case distribution", () => {
    const first = [...MODELED_RULE_FACTS.values()].flatMap(createModeledChoices);
    const second = [...MODELED_RULE_FACTS.values()].flatMap(createModeledChoices);
    const keys = first.map(choiceKey);

    expect(MODELED_RULE_FACTS.size).toBe(9);
    expect(first).toHaveLength(120);
    expect(new Set(keys).size).toBe(keys.length);
    expect(second.map(choiceKey)).toEqual(keys);
    expect(first.filter(({ kind }) => kind === "scalar")).toHaveLength(40);
    expect(first.filter(({ kind }) => kind === "memory")).toHaveLength(80);
  });

  it("keeps every executable operation identity unique", () => {
    const operationIds = modeledOperationIds();

    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(operationIds.every((operationId) => /^[a-z][a-z0-9.-]+$/u.test(operationId))).toBe(true);
  });

  it("constructs every canonical choice as independently valid generator IR", () => {
    const moduleName = "ModeledInvariant";
    if (!isGenIdentifier(moduleName)) {
      throw new TypeError("Test module name must satisfy the generator identifier grammar.");
    }

    for (const fact of MODELED_RULE_FACTS.values()) {
      const choices = createModeledChoices(fact);
      expect(Object.isFrozen(choices)).toBe(true);
      for (const choice of choices) {
        expect(choice.ruleId).toBe(fact.ruleId);
        expect(validateGeneratorIr(buildModeledModule(fact, choice, [moduleName]))).toMatchObject({
          ok: true,
          diagnostics: [],
        });
      }
    }
  });

  it("deep-freezes cached choices so callers cannot poison later domain lookups", async () => {
    const { suite } = await suiteFixture();
    const fact = [...MODELED_RULE_FACTS.values()][0];
    if (fact === undefined) throw new TypeError("Reviewed fact fixture must exist.");
    const first = getRuleGenerationDomain(suite, fact.ruleId);
    if (!first.ok || first.state !== "modeled") throw new TypeError("Rule must be modeled.");
    const choice = first.choices[0];
    if (choice === undefined) throw new TypeError("Modeled domain must have choices.");

    expect(Object.isFrozen(choice)).toBe(true);
    expect(Reflect.set(choice, "ruleId", "rule.mutated")).toBe(false);
    const second = getRuleGenerationDomain(suite, fact.ruleId);
    expect(second).toEqual(first);
  });

  it("resolves and proves every scalar and memory invalid neighbor over every choice", async () => {
    const { suite } = await suiteFixture();
    for (const fact of MODELED_RULE_FACTS.values()) {
      for (const choice of createModeledChoices(fact)) {
        for (const neighborId of fact.neighborIds) {
          const result = applyModeledRuleNeighbor(suite, {
            ...validRequest(choice),
            validity: { kind: "invalid", neighborId },
          });
          expect(result).toMatchObject({
            ok: true,
            outcome: "generated",
            case: { projection: { kind: "invalid" } },
          });
          if (
            !result.ok ||
            result.outcome !== "generated" ||
            result.case.projection.kind !== "invalid"
          ) {
            continue;
          }
          const transform = result.case.projection.transform;
          if (fact.kind === "scalar") {
            expect(transform.kind).toBe(
              choice.kind === "scalar" && choice.spelling === "parameter"
                ? "parameter-binding-replace"
                : "scalar-expression-replace",
            );
            continue;
          }
          expect(transform.kind).not.toBe("scalar-expression-replace");
          expect(transform.kind).not.toBe("parameter-binding-replace");
          if (
            transform.kind === "scalar-expression-replace" ||
            transform.kind === "parameter-binding-replace"
          ) {
            continue;
          }
          const match = /^\/functions\/0\/body\/([0-9]+)(?:\/value)?$/u.exec(transform.callPath);
          expect(match).not.toBeNull();
          const indexText = match?.[1];
          const statement =
            indexText === undefined
              ? undefined
              : result.case.projection.baseline.functions[0]?.body[Number(indexText)];
          expect(
            statement?.kind === "memory-write" ||
              (statement?.kind === "return" && statement.value?.kind === "memory-read"),
          ).toBe(true);
        }
      }
    }
  });

  it("retains distinct external values for scalar parameter boundaries", async () => {
    const { suite } = await suiteFixture();
    const fact = [...MODELED_RULE_FACTS.values()].find(
      (candidate) => candidate.kind === "scalar" && candidate.scalarType === "byte",
    );
    if (fact?.kind !== "scalar") throw new TypeError("Byte fact fixture must exist.");
    const choices = createModeledChoices(fact).filter(
      (choice) => choice.kind === "scalar" && choice.spelling === "parameter",
    );
    const cases = choices.map((choice) => generateFrontendCase(suite, validRequest(choice)));

    expect(cases).toHaveLength(2);
    expect(cases[0]).toMatchObject({
      ok: true,
      case: { parameterBindings: [{ value: 0n }] },
    });
    expect(cases[1]).toMatchObject({
      ok: true,
      case: { parameterBindings: [{ value: 255n }] },
    });
  });

  it("rejects duplicate authority keys and throwing top-level accessors", async () => {
    const fixture = await suiteFixture();
    const duplicateSeed = new TextEncoder().encode(
      new TextDecoder()
        .decode(fixture.seedBytes)
        .replace('"schemaVersion": 1,', '"schemaVersion": 1, "schemaVersion": 1,'),
    );
    const reviewValue: unknown = JSON.parse(new TextDecoder().decode(fixture.reviewBytes));
    if (
      typeof reviewValue !== "object" ||
      reviewValue === null ||
      typeof Reflect.get(reviewValue, "review") !== "object" ||
      Reflect.get(reviewValue, "review") === null
    ) {
      throw new TypeError("Review fixture must contain a review record.");
    }
    Reflect.set(
      Reflect.get(reviewValue, "review"),
      "seedContractDigest",
      `sha256:${createHash("sha256").update(duplicateSeed).digest("hex")}`,
    );
    expect(
      createModeledGeneratorSuite({
        seedContractBytes: duplicateSeed,
        ruleModelBytes: fixture.modelBytes,
        reviewEvidenceBytes: new TextEncoder().encode(JSON.stringify(reviewValue)),
        inventory: fixture.inventory,
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "modeled.input.invalid" }] });

    const hostile = Object.defineProperty({}, "seedContractBytes", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute");
      },
    });
    expect(() => createModeledGeneratorSuite(hostile)).not.toThrow();
    expect(createModeledGeneratorSuite(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "modeled.input.invalid" }],
    });
  });
});
