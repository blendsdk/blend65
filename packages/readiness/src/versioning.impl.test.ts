import { describe, expect, it } from "vitest";
import { createDiagnostic } from "./diagnostics.js";
import {
  createInventoryVersionDispatcherForTest,
  readInventoryVersioned,
  type EvolutionGateExpectation,
  type InventoryMigration,
} from "./versioning.js";

const GATE: EvolutionGateExpectation = {
  owner: "RD-07",
  semanticRevision: "v3",
  acceptanceGate: "gate-v3",
};
const CURRENT_GATE = { ...GATE, validatedAt: "2026-07-24T00:00:00.000Z" };
const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

function migration(fromVersion: number, toVersion: number): InventoryMigration {
  return {
    fromVersion,
    toVersion,
    migrate(input) {
      return {
        ok: true,
        diagnostics: [],
        output: {
          ...(typeof input === "object" && input !== null ? input : {}),
          schemaVersion: toVersion,
        },
        invalidations: [
          {
            kind: toVersion === 2 ? "campaign" : "capability",
            identity: `identity.${toVersion}`,
            reasonCode: "changed",
          },
        ],
      };
    },
  };
}

describe("versioning implementation", () => {
  it("should execute a complete migration chain and sort combined invalidations", () => {
    const dispatch = createInventoryVersionDispatcherForTest(
      [migration(1, 2), migration(2, 3)],
      GATE,
      3,
    );
    const result = dispatch(bytes({ schemaVersion: 1, evolutionGate: CURRENT_GATE }));
    expect(result.ok).toBe(true);
    expect(result.inventory).toMatchObject({ schemaVersion: 3 });
    expect(result.invalidations.map(({ kind }) => kind)).toEqual(["capability", "campaign"]);
  });

  it("should sort identities within one invalidation kind", () => {
    const sameKind: InventoryMigration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: () => ({
        ok: true,
        diagnostics: [],
        output: { schemaVersion: 2 },
        invalidations: [
          { kind: "rule", identity: "rule.z", reasonCode: "changed" },
          { kind: "rule", identity: "rule.a", reasonCode: "changed" },
        ],
      }),
    };
    const result = createInventoryVersionDispatcherForTest(
      [sameKind],
      GATE,
      2,
    )(bytes({ schemaVersion: 1, evolutionGate: CURRENT_GATE }));
    expect(result.invalidations.map(({ identity }) => identity)).toEqual(["rule.a", "rule.z"]);
  });

  it.each([
    ["gap", [migration(1, 2)], 3],
    ["reverse", [{ ...migration(2, 3), toVersion: 1 }], 3],
    ["outside target", [migration(1, 2), migration(2, 3)], 2],
  ])("should reject a %s registry", (_name, migrations, targetVersion) => {
    const result = createInventoryVersionDispatcherForTest(
      migrations,
      GATE,
      targetVersion,
    )(bytes({ schemaVersion: 1, evolutionGate: CURRENT_GATE }));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("migration.invalid-registry");
  });

  it("should preserve migration diagnostics and reject a step-version mismatch", () => {
    const explicitFailure: InventoryMigration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: () => ({
        ok: false,
        diagnostics: [
          createDiagnostic({
            phase: "evolution",
            code: "migration.injected",
            path: "$",
            message: "Injected failure.",
          }),
        ],
        invalidations: [],
      }),
    };
    const failed = createInventoryVersionDispatcherForTest(
      [explicitFailure],
      GATE,
      2,
    )(bytes({ schemaVersion: 1, evolutionGate: CURRENT_GATE }));
    expect(failed.diagnostics.map(({ code }) => code)).toEqual(["migration.injected"]);

    const wrongVersion: InventoryMigration = {
      ...explicitFailure,
      migrate: () => ({
        ok: true,
        diagnostics: [],
        output: { schemaVersion: 1 },
        invalidations: [],
      }),
    };
    const mismatch = createInventoryVersionDispatcherForTest(
      [wrongVersion],
      GATE,
      2,
    )(bytes({ schemaVersion: 1, evolutionGate: CURRENT_GATE }));
    expect(mismatch.diagnostics[0]?.code).toBe("migration.step-version");
    expect(mismatch.inventory).toBeUndefined();
  });

  it("should reject malformed input, absent versions, and non-positive targets", () => {
    const dispatch = createInventoryVersionDispatcherForTest([], GATE, 1);
    expect(dispatch(new TextEncoder().encode("{")).diagnostics[0]?.code).toBe("input.invalid-json");
    expect(dispatch(bytes({})).diagnostics[0]?.code).toBe("version.unsupported");
    expect(
      createInventoryVersionDispatcherForTest([], GATE, 0)(bytes({ schemaVersion: 1 }))
        .diagnostics[0]?.code,
    ).toBe("migration.invalid-registry");
  });

  it("should preserve production-reader parse and schema failures", () => {
    expect(readInventoryVersioned(new TextEncoder().encode("{")).diagnostics[0]?.code).toBe(
      "input.invalid-json",
    );
    const schemaFailure = readInventoryVersioned(
      bytes({ schemaVersion: 1, inventoryVersion: "incomplete" }),
    );
    expect(schemaFailure.ok).toBe(false);
    expect(schemaFailure.diagnostics[0]?.code.startsWith("schema.")).toBe(true);
  });

  it.each([null, "not-an-object"])(
    "should reject a malformed evolution gate value %j",
    (evolutionGate) => {
      const result = createInventoryVersionDispatcherForTest(
        [migration(1, 2)],
        GATE,
        2,
      )(bytes({ schemaVersion: 1, evolutionGate }));
      expect(result.diagnostics[0]?.code).toBe("evolution-gate.stale");
    },
  );
});
