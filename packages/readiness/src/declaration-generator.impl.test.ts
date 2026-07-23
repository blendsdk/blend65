import { describe, expect, it } from "vitest";
import type { InventoryV1 } from "./model.js";
import { renderDeclarationModule } from "./declaration-generator.js";

function inventory(): InventoryV1 {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    specRevision: `sha256:${"a".repeat(64)}`,
    identityLedgerHead: `sha256:${"b".repeat(64)}`,
    fragmentationProfile: {
      profileId: "markdown-ebnf-v1",
      version: 1,
      contentHashAlgorithm: "sha256",
      newlinePolicy: "lf",
    },
    normativeSources: [],
    handlerDeclarations: [],
    evidenceCapabilityDeclarations: [],
    clauseLedger: [],
    conflicts: [],
    rules: [],
    evolutionGate: null,
  };
}

describe("declaration module rendering", () => {
  it("should render byte-identically and sort identities without mutating inventory order", () => {
    const fixture: InventoryV1 = {
      ...inventory(),
      handlerDeclarations: [
        { id: "handler.z", kind: "oracle", owner: "RD-03", contractVersion: "1", binding: "bound" },
        {
          id: "handler.a",
          kind: "generator",
          owner: "RD-02",
          contractVersion: "1",
          binding: "bound",
        },
      ],
      evidenceCapabilityDeclarations: [
        {
          id: "vice",
          owner: "RD-03",
          contractVersion: "1",
          binding: "bound",
          observableContract: "memory",
          prerequisiteRoute: "emulator",
        },
        {
          id: "acme",
          owner: "RD-02",
          contractVersion: "1",
          binding: "bound",
          observableContract: "assembly",
          prerequisiteRoute: "assembler",
        },
      ],
    };

    const first = renderDeclarationModule(fixture);
    expect(renderDeclarationModule(fixture)).toBe(first);
    expect(first.indexOf('"handler.a"')).toBeLessThan(first.indexOf('"handler.z"'));
    expect(fixture.handlerDeclarations[0]?.id).toBe("handler.z");
  });

  it("should render empty registries as never", () => {
    expect(renderDeclarationModule(inventory())).toContain("HandlerId = never");
  });
});
