import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, parseInventoryJson } from "./index.js";

const encoder = new TextEncoder();

describe("strict JSON traversal internals", () => {
  it("should abort before visiting a malformed suffix after a duplicate", () => {
    const bytes = encoder.encode('{"first":1,"first":2,"suffix":[invalid]}');

    const result = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "input.duplicate-key",
        path: "/first",
      }),
    ]);
  });

  it("should escape JSON Pointer tokens in duplicate-property paths", () => {
    const bytes = encoder.encode('{"a/b":{"~key":1,"~key":2}}');

    const result = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.duplicate-key",
        path: "/a~1b/~0key",
      }),
    );
  });

  it("should retain array indexes in duplicate-property paths", () => {
    const bytes = encoder.encode('{"items":[{"id":1,"id":2}]}');

    const result = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.duplicate-key",
        path: "/items/0/id",
      }),
    );
  });

  it("should return the parsed value only after structural validation", () => {
    const result = parseInventoryJson(encoder.encode('{"schemaVersion":1}'), INVENTORY_V1_LIMITS);

    expect(result).toEqual({
      ok: true,
      diagnostics: [],
      inventory: { schemaVersion: 1 },
      blockingReasons: [],
    });
  });

  it("should reject an empty object that opens beyond the depth limit", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxDepth: 1 };

    const result = parseInventoryJson(encoder.encode('{"nested":{}}'), limits);

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.depth-limit",
        path: "/nested",
      }),
    );
  });

  it("should reject an empty array that opens beyond the depth limit", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxDepth: 1 };

    const result = parseInventoryJson(encoder.encode("[[]]"), limits);

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.depth-limit",
        path: "/0",
      }),
    );
  });

  it("should reject extreme container nesting without throwing", () => {
    const json = `${"[".repeat(10_000)}null${"]".repeat(10_000)}`;

    expect(() => parseInventoryJson(encoder.encode(json), INVENTORY_V1_LIMITS)).not.toThrow();
    expect(parseInventoryJson(encoder.encode(json), INVENTORY_V1_LIMITS).diagnostics[0]).toEqual(
      expect.objectContaining({ code: "input.depth-limit" }),
    );
  });

  it("should enforce UTF-8 string bytes before materialization", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxStringBytes: 4 };

    expect(parseInventoryJson(encoder.encode('{"x":"éé"}'), limits).ok).toBe(true);
    expect(parseInventoryJson(encoder.encode('{"x":"ééé"}'), limits).diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.string-limit",
        path: "/x",
      }),
    );
  });

  it("should enforce UTF-8 property-name bytes before materialization", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxStringBytes: 4 };

    expect(parseInventoryJson(encoder.encode('{"éé":true}'), limits).ok).toBe(true);
    expect(parseInventoryJson(encoder.encode('{"ééé":true}'), limits).diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.string-limit",
        path: "/ééé",
      }),
    );
  });

  it("should enforce general array items before materialization", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxArrayItems: 2 };

    expect(parseInventoryJson(encoder.encode('{"values":[1,2]}'), limits).ok).toBe(true);
    expect(parseInventoryJson(encoder.encode('{"values":[1,2,3]}'), limits).diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.array-limit",
        path: "/values/2",
      }),
    );
  });

  it("should apply path-specific rule-array limits before materialization", () => {
    const limits = { ...INVENTORY_V1_LIMITS, maxRules: 1 };

    const result = parseInventoryJson(encoder.encode('{"rules":[{},{}]}'), limits);

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.array-limit",
        path: "/rules/1",
      }),
    );
  });

  it.each([
    ["sources", { maxSources: 1 }, '{"normativeSources":[{},{}]}', "/normativeSources/1"],
    [
      "source sections",
      { maxSectionsPerSource: 1 },
      '{"normativeSources":[{"sections":[{},{}]}]}',
      "/normativeSources/0/sections/1",
    ],
    ["fragments", { maxFragments: 1 }, '{"clauseLedger":[{},{}]}', "/clauseLedger/1"],
    [
      "prerequisites",
      { maxRelationshipsPerRule: 1 },
      '{"rules":[{"prerequisiteRuleIds":["a","b"]}]}',
      "/rules/0/prerequisiteRuleIds/1",
    ],
    [
      "related rules",
      { maxRelationshipsPerRule: 1 },
      '{"rules":[{"relatedRuleIds":["a","b"]}]}',
      "/rules/0/relatedRuleIds/1",
    ],
  ] as const)("should apply the path-specific %s limit", (_name, override, json, path) => {
    const result = parseInventoryJson(encoder.encode(json), {
      ...INVENTORY_V1_LIMITS,
      ...override,
    });

    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "input.array-limit",
        path,
      }),
    );
  });
});
