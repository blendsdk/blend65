import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  RULE_MODEL_V1_LIMITS,
  parseRuleModelRegistry,
  validateRuleModelRegistry,
} from "./index.js";

const encoder = new TextEncoder();

function unmodeledRegistry(ruleIds: readonly string[] = ["rule.fixture.one"]): string {
  return JSON.stringify({
    schemaVersion: 1,
    registryVersion: "fixture-v1",
    rules: ruleIds.map((ruleId) => ({
      ruleId,
      state: "unmodeled",
      reason: "outside-initial-slice",
    })),
  });
}

describe("rule-model input", () => {
  it("parses a closed version-one registry", () => {
    const result = parseRuleModelRegistry(encoder.encode(unmodeledRegistry()));

    expect(result).toMatchObject({
      ok: true,
      input: {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
      },
      diagnostics: [],
    });
  });

  it("rejects invalid UTF-8 before JSON parsing", () => {
    const result = parseRuleModelRegistry(Uint8Array.from([0xc3, 0x28]));

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "model.input.invalid-utf8",
          path: "",
        }),
      ],
    });
  });

  it("enforces the byte limit exactly", () => {
    const bytes = encoder.encode(unmodeledRegistry());

    expect(
      parseRuleModelRegistry(bytes, {
        ...RULE_MODEL_V1_LIMITS,
        maxInputBytes: bytes.byteLength,
      }).ok,
    ).toBe(true);
    expect(
      parseRuleModelRegistry(bytes, {
        ...RULE_MODEL_V1_LIMITS,
        maxInputBytes: bytes.byteLength - 1,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.limit", path: "" }],
    });
  });

  it("rejects duplicate keys before a malformed suffix", () => {
    const bytes = encoder.encode(
      '{"schemaVersion":1,"schemaVersion":1,"registryVersion":"fixture-v1","rules":[invalid]}',
    );

    expect(parseRuleModelRegistry(bytes)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "model.input.invalid-json",
          path: "/schemaVersion",
        },
      ],
    });
  });

  it.each([
    ["comments", '{"schemaVersion":1/* no comments */}'],
    ["trailing commas", '{"schemaVersion":1,}'],
    ["malformed JSON", '{"schemaVersion":'],
  ])("rejects %s as strict JSON", (_name, source) => {
    expect(parseRuleModelRegistry(encoder.encode(source))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.invalid-json" }],
    });
  });

  it("enforces structural depth before materialization", () => {
    const bytes = encoder.encode(unmodeledRegistry());

    expect(parseRuleModelRegistry(bytes, { ...RULE_MODEL_V1_LIMITS, maxDepth: 3 }).ok).toBe(true);
    expect(parseRuleModelRegistry(bytes, { ...RULE_MODEL_V1_LIMITS, maxDepth: 2 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.limit", path: "/rules/0" }],
    });
  });

  it("enforces the rule count before materialization", () => {
    const bytes = encoder.encode(unmodeledRegistry(["rule.fixture.one", "rule.fixture.two"]));

    expect(parseRuleModelRegistry(bytes, { ...RULE_MODEL_V1_LIMITS, maxRules: 1 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.limit", path: "/rules/1" }],
    });
  });

  it("enforces general collection limits inside modeled facts", () => {
    const value = {
      schemaVersion: 1,
      registryVersion: "fixture-v1",
      rules: [
        {
          ruleId: "rule.fixture.one",
          state: "modeled",
          citations: [
            { sourcePath: "fixtures/model.md", contentHash: `sha256:${"a".repeat(64)}` },
            { sourcePath: "fixtures/other.md", contentHash: `sha256:${"b".repeat(64)}` },
          ],
        },
      ],
    };

    expect(
      parseRuleModelRegistry(encoder.encode(JSON.stringify(value)), {
        ...RULE_MODEL_V1_LIMITS,
        maxArrayItems: 1,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.limit", path: "/rules/0/citations/1" }],
    });
  });

  it("enforces UTF-8 string bytes before materialization", () => {
    const bytes = encoder.encode(unmodeledRegistry());

    expect(
      parseRuleModelRegistry(bytes, {
        ...RULE_MODEL_V1_LIMITS,
        maxStringBytes: 14,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.input.limit", path: "/registryVersion" }],
    });
  });

  it.each([
    [
      "a missing envelope field",
      {
        schemaVersion: 1,
        rules: [],
      },
      "/registryVersion",
    ],
    [
      "an unknown envelope field",
      {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
        rules: [],
        extra: true,
      },
      "/extra",
    ],
    [
      "an unsupported state",
      {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
        rules: [{ ruleId: "rule.fixture.one", state: "future", reason: "outside-initial-slice" }],
      },
      "/rules/0/state",
    ],
    [
      "a traversal-bearing citation path",
      {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
        rules: [
          {
            ruleId: "rule.fixture.one",
            state: "modeled",
            citations: [
              {
                sourcePath: "../outside.md",
                contentHash: `sha256:${"a".repeat(64)}`,
              },
            ],
            constructionPreconditions: [{ kind: "type-in", subject: "operand", values: ["byte"] }],
            typedDomains: [{ subject: "operand", type: "byte", values: ["0"] }],
            invalidContracts: [
              {
                contractId: "operand.range",
                diagnosticFamily: "type.range",
                neighborIds: ["neighbor.fixture.above"],
              },
            ],
            constructorIds: ["constructor.fixture.scalar"],
            predicateIds: ["predicate.fixture.range"],
            neighborIds: ["neighbor.fixture.above"],
            boundaryFamilyIds: ["boundary.fixture.range"],
            spellings: ["literal"],
          },
        ],
      },
      "/rules/0/citations/0/sourcePath",
    ],
  ])("rejects %s through the closed schema", (_name, value, path) => {
    expect(parseRuleModelRegistry(encoder.encode(JSON.stringify(value)))).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.schema.invalid",
          path,
          message: expect.any(String),
        },
      ]),
    });
  });

  it("parses and validates the exhaustive checked-in skeleton", async () => {
    const [manifestBytes, inventoryBytes] = await Promise.all([
      readFile(new URL("../../../readiness/rule-models/rule-models-v1.json", import.meta.url)),
      readFile(new URL("../../../readiness/inventory/compiler-readiness-v1.json", import.meta.url)),
    ]);
    const parsedInventory: unknown = JSON.parse(inventoryBytes.toString("utf8"));
    if (
      typeof parsedInventory !== "object" ||
      parsedInventory === null ||
      !Array.isArray(Reflect.get(parsedInventory, "rules"))
    ) {
      throw new TypeError("Inventory fixture must contain rules.");
    }
    const inventoryRuleIds = Reflect.get(parsedInventory, "rules").map((rule: unknown) => {
      if (
        typeof rule !== "object" ||
        rule === null ||
        typeof Reflect.get(rule, "ruleId") !== "string"
      ) {
        throw new TypeError("Inventory rule must contain a rule ID.");
      }
      return Reflect.get(rule, "ruleId");
    });

    const parsedManifest = parseRuleModelRegistry(manifestBytes);
    expect(parsedManifest.ok).toBe(true);
    if (!parsedManifest.ok) return;

    expect(validateRuleModelRegistry(parsedManifest.input, inventoryRuleIds, [])).toMatchObject({
      ok: true,
      counts: {
        modeled: 0,
        unmodeled: 2_112,
        "not-generatable": 0,
      },
    });
  });
});
