import { describe, expect, it } from "vitest";
import { createInventoryVersionDispatcherForTest, readInventoryVersioned } from "./index.js";
import type { EvolutionGateExpectation, InventoryMigration, MigrationResult } from "./index.js";

const EXPECTED_GATE: EvolutionGateExpectation = {
  owner: "RD-07",
  semanticRevision: "semantic-v2",
  acceptanceGate: "acceptance-v2",
};

function bytes(value: Readonly<unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function sourceInventory(
  evolutionGate: Readonly<Record<string, string>> | null,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    evolutionGate,
  };
}

const MIGRATION: InventoryMigration = {
  fromVersion: 1,
  toVersion: 2,
  migrate(): MigrationResult {
    return {
      ok: true,
      diagnostics: [],
      output: { schemaVersion: 2, migrated: true },
      invalidations: [
        { kind: "regression", identity: "regression.z", reasonCode: "changed" },
        { kind: "rule", identity: "rule.a", reasonCode: "changed" },
        { kind: "rule", identity: "rule.a", reasonCode: "changed" },
        { kind: "handler", identity: "handler.a", reasonCode: "changed" },
      ],
    };
  },
};

describe("inventory version dispatch", () => {
  it("should reject an unknown version before selecting a schema or producing inventory", () => {
    const result = readInventoryVersioned(bytes({ schemaVersion: 999 }));
    expect(result.ok).toBe(false);
    expect(result.inventory).toBeUndefined();
    expect(result.invalidations).toEqual([]);
    expect(result.diagnostics.some(({ code }) => code.startsWith("version."))).toBe(true);
  });

  it.each([
    ["absent", null],
    [
      "stale",
      {
        owner: "RD-07",
        semanticRevision: "old",
        acceptanceGate: "acceptance-v2",
        validatedAt: "2026-07-24T00:00:00.000Z",
      },
    ],
    [
      "invalid timestamp",
      {
        owner: "RD-07",
        semanticRevision: "semantic-v2",
        acceptanceGate: "acceptance-v2",
        validatedAt: "not-a-timestamp",
      },
    ],
  ])("should reject a %s evolution gate without migration output", (_name, evolutionGate) => {
    const dispatch = createInventoryVersionDispatcherForTest([MIGRATION], EXPECTED_GATE, 2);
    const result = dispatch(bytes(sourceInventory(evolutionGate)));
    expect(result.ok).toBe(false);
    expect(result.inventory).toBeUndefined();
    expect(result.invalidations).toEqual([]);
    expect(result.diagnostics.some(({ code }) => code.startsWith("evolution-gate."))).toBe(true);
  });

  it("should migrate deterministically with a current gate and canonical invalidations", () => {
    const dispatch = createInventoryVersionDispatcherForTest([MIGRATION], EXPECTED_GATE, 2);
    const input = bytes(
      sourceInventory({
        ...EXPECTED_GATE,
        validatedAt: "2026-07-24T00:00:00.000Z",
      }),
    );
    const first = dispatch(input);
    expect(first).toEqual(dispatch(input));
    expect(first.ok).toBe(true);
    expect(first.inventory).toEqual({ schemaVersion: 2, migrated: true });
    expect(first.invalidations).toEqual([
      { kind: "rule", identity: "rule.a", reasonCode: "changed" },
      { kind: "handler", identity: "handler.a", reasonCode: "changed" },
      { kind: "regression", identity: "regression.z", reasonCode: "changed" },
    ]);
  });

  it("should reject ambiguous registries and conflicting invalidations", () => {
    const duplicate = createInventoryVersionDispatcherForTest(
      [MIGRATION, MIGRATION],
      EXPECTED_GATE,
      2,
    );
    expect(
      duplicate(
        bytes(
          sourceInventory({
            ...EXPECTED_GATE,
            validatedAt: "2026-07-24T00:00:00.000Z",
          }),
        ),
      ).ok,
    ).toBe(false);

    const conflicting: InventoryMigration = {
      ...MIGRATION,
      migrate: () => ({
        ok: true,
        diagnostics: [],
        output: { schemaVersion: 2 },
        invalidations: [
          { kind: "rule", identity: "rule.a", reasonCode: "first" },
          { kind: "rule", identity: "rule.a", reasonCode: "second" },
        ],
      }),
    };
    const result = createInventoryVersionDispatcherForTest(
      [conflicting],
      EXPECTED_GATE,
      2,
    )(
      bytes(
        sourceInventory({
          ...EXPECTED_GATE,
          validatedAt: "2026-07-24T00:00:00.000Z",
        }),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.inventory).toBeUndefined();
    expect(result.diagnostics.some(({ code }) => code.startsWith("migration."))).toBe(true);
  });
});
