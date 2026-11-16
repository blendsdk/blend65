import { describe, expect, it } from "vitest";
import { selectTargetProfile } from "../target/profile.js";
import { createC64Startup, createC64StartupStateData } from "./startup.js";
import type { C64StartupPolicy } from "./startup.js";

const policies: readonly C64StartupPolicy[] = [
  "full",
  "compact-unrolled",
  "compact-looped",
  "compact-stored",
];

describe("restore omission across existing startup constructions", () => {
  for (const startupPolicy of policies) {
    it(`should preserve the complete entry and borrowed-byte snapshots for ${startupPolicy}`, () => {
      const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
      if (selected.kind !== "complete") throw new Error("Expected cooperative profile");
      const input = {
        profile: selected.profile,
        startupPolicy,
        displayIndependent: true,
        initializerLabels: [],
        mainLabel: "main",
        borrowedZeroPage: [2, 3, 4],
      };
      const ordinary = createC64Startup(input);
      const omissionInput = { ...input, restoreRequired: false };
      const omitted = createC64Startup(omissionInput);
      if (ordinary.kind !== "complete" || omitted.kind !== "complete")
        throw new Error("Expected existing constructors");
      const entry = ordinary.startup.blocks.slice(
        0,
        ordinary.startup.blocks.findIndex(({ label }) => label === "startup.restore"),
      );
      expect(omitted.startup.blocks).toEqual(entry);
      expect(omitted.stackDemand).toEqual(ordinary.stackDemand);
      expect(omitted.stub).toEqual(ordinary.stub);
      expect(createC64StartupStateData(omissionInput)).toEqual(createC64StartupStateData(input));
    });
  }
});
