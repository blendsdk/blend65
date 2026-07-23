import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, parseInventoryJson } from "./index.js";

const encoder = new TextEncoder();

function expectInputFailure(bytes: Uint8Array, expectedPath = ""): void {
  const result = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);

  expect(result.ok).toBe(false);
  expect(result.inventory).toBeUndefined();
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toEqual(
    expect.objectContaining({
      phase: "input",
      severity: "error",
      path: expectedPath,
      relatedPaths: [],
    }),
  );
}

describe("strict inventory JSON intake", () => {
  // Duplicate object keys are rejected before either value can become authoritative.
  it.each([
    [
      "rule identity",
      '{"schemaVersion":1,"rules":[{"ruleId":"rule.first","ruleId":"rule.last"}]}',
      "/rules/0/ruleId",
    ],
    [
      "nested citation",
      '{"schemaVersion":1,"rules":[{"source":{"quote":"first","quote":"last"}}]}',
      "/rules/0/source/quote",
    ],
  ])("should reject a duplicate %s key before materialization", (_name, json, path) => {
    const result = parseInventoryJson(encoder.encode(json), INVENTORY_V1_LIMITS);

    expect(result.ok).toBe(false);
    expect(result.inventory).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        phase: "input",
        code: "input.duplicate-key",
        severity: "error",
        path,
        relatedPaths: [],
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("rule.last");
    expect(JSON.stringify(result)).not.toContain('"last"');
  });

  // JSON extensions are not part of the authoritative inventory format.
  it.each([
    ["comment", '{"schemaVersion":1 // comment\n}'],
    ["trailing comma", '{"schemaVersion":1,}'],
  ])("should reject a %s in authoritative JSON", (_name, json) => {
    expectInputFailure(encoder.encode(json));
  });

  // Invalid byte sequences are rejected instead of being repaired with replacement characters.
  it("should reject malformed UTF-8", () => {
    expectInputFailure(
      new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]),
    );
  });

  // Nesting is bounded before a deeply nested value can be materialized.
  it("should reject nesting one level above the configured limit", () => {
    const depth = INVENTORY_V1_LIMITS.maxDepth + 1;
    const json = `${'{"nested":'.repeat(depth)}null${"}".repeat(depth)}`;

    expectInputFailure(encoder.encode(json), "/nested".repeat(INVENTORY_V1_LIMITS.maxDepth));
  });
});
