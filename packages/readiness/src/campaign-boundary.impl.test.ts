import { describe, expect, it } from "vitest";

import { createBoundaryVariants } from "./boundary-variants.js";
import { campaignBoundaryAgrees } from "./campaign.js";
import type { CampaignBoundaryBindingV1 } from "./campaign-model.js";
import type { BoundaryVariantResult } from "./generator-ir.js";

const REVISION = `sha256:${"1".repeat(64)}` as const;
const RULE_ID = "rule.ch02.2-primitive-types.byte.range.0-255";
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function binding(
  implementation: CampaignBoundaryBindingV1["implementation"],
): CampaignBoundaryBindingV1 {
  return Object.freeze({
    handlerId: "transform.boundary-variants",
    contractVersion: "1.0.0",
    implementationRevision: REVISION,
    implementation,
  });
}

function changedVariant(
  input: unknown,
  member: "value" | "spelling" | "nestingDepth",
): BoundaryVariantResult {
  const result = createBoundaryVariants(input);
  if (!result.ok) return result;
  const index = result.variants.findIndex((variant) => member in variant);
  const variant = result.variants[index];
  if (index < 0 || variant === undefined) return result;
  const changed =
    member === "value"
      ? { ...variant, value: null }
      : member === "spelling"
        ? { ...variant, spelling: "const" as const }
        : { ...variant, nestingDepth: (variant.nestingDepth ?? 0) + 1 };
  return Object.freeze({
    ok: true,
    variants: Object.freeze(
      result.variants.map((candidate, candidateIndex) =>
        candidateIndex === index ? Object.freeze(changed) : candidate,
      ),
    ),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

describe("campaign boundary agreement", () => {
  it("accepts only the complete authoritative boundary result", () => {
    expect(
      campaignBoundaryAgrees(
        binding(createBoundaryVariants),
        RULE_ID,
        Object.freeze(["literal", "parameter"]),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "order",
      (input: unknown): BoundaryVariantResult => {
        const result = createBoundaryVariants(input);
        return result.ok
          ? Object.freeze({
              ...result,
              variants: Object.freeze([...result.variants].reverse()),
            })
          : result;
      },
    ],
    [
      "duplicate",
      (input: unknown): BoundaryVariantResult => {
        const result = createBoundaryVariants(input);
        return result.ok && result.variants[0] !== undefined
          ? Object.freeze({
              ...result,
              variants: Object.freeze([...result.variants, result.variants[0]]),
            })
          : result;
      },
    ],
    ["value", (input: unknown) => changedVariant(input, "value")],
    ["spelling", (input: unknown) => changedVariant(input, "spelling")],
    ["nesting depth", (input: unknown) => changedVariant(input, "nestingDepth")],
    [
      "diagnostics",
      (): BoundaryVariantResult =>
        Object.freeze({
          ok: false,
          diagnostics: Object.freeze([
            Object.freeze({
              code: "generation-input-invalid",
              path: "/fixture",
              message: "mutated",
            }),
          ]),
        }),
    ],
  ])("rejects a boundary result with changed %s", (_name, implementation) => {
    expect(
      campaignBoundaryAgrees(
        binding(implementation),
        RULE_ID,
        Object.freeze(["literal", "parameter"]),
      ),
    ).toBe(false);
  });
});
