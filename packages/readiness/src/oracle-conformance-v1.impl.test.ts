import { describe, expect, it } from "vitest";

import {
  oracleMutationDispatchMarker,
  requireOracleMutationDispatchMarker,
  runWithOracleMutationVariant,
  selectedOracleMutationVariant,
  type OracleMutationSelectionV1,
} from "./oracle-conformance-v1.js";

const BASE = Object.freeze({
  mutantId: "mutant.evaluator.binary.integer.add",
  operationId: "evaluator.binary",
  pathId: "evaluator.binary.integer.add",
  variantId: "integer-xor-one-v1",
});

describe("oracle mutation context internals", () => {
  it("rejects hostile selections and preserves every nested equality dimension", async () => {
    const hostile = new Proxy(BASE, {
      getPrototypeOf() {
        throw new Error("hostile selection");
      },
    });
    await expect(runWithOracleMutationVariant(hostile, () => undefined)).rejects.toThrow(
      "invalid oracle mutation selection",
    );

    await expect(
      runWithOracleMutationVariant(BASE, () => runWithOracleMutationVariant(BASE, () => "same")),
    ).resolves.toBe("same");

    const incompatible: readonly OracleMutationSelectionV1[] = [
      { ...BASE, operationId: "evaluator.unary" },
      { ...BASE, pathId: "evaluator.binary.integer.subtract" },
      { ...BASE, variantId: "boolean-negate-v1" },
    ];
    for (const nested of incompatible) {
      await expect(
        runWithOracleMutationVariant(BASE, () =>
          runWithOracleMutationVariant(nested, () => undefined),
        ),
      ).rejects.toThrow("incompatible nested oracle mutation selection");
    }
  });

  it("activates production selection only through matching marker metadata", async () => {
    const marker = oracleMutationDispatchMarker(BASE.operationId, BASE.pathId, BASE.variantId);

    await expect(
      runWithOracleMutationVariant(BASE, () => selectedOracleMutationVariant(marker)),
    ).resolves.toBe(BASE.variantId);
    const wrongVariant = oracleMutationDispatchMarker(
      BASE.operationId,
      BASE.pathId,
      "boolean-negate-v1",
    );
    await expect(
      runWithOracleMutationVariant(BASE, () => selectedOracleMutationVariant(wrongVariant)),
    ).resolves.toBeUndefined();
    expect(() =>
      requireOracleMutationDispatchMarker([], BASE.operationId, BASE.pathId, BASE.variantId),
    ).toThrow("missing oracle mutation dispatch marker");
  });
});
