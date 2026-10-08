import { describe, expect, it } from "vitest";
import { displayForExpertComparison } from "../m1/vice-display-comparison.js";
import type { M1DisplayFields } from "../m1/vice-display-comparison.js";

const generated: M1DisplayFields = {
  vicControl1: 0x1b,
  vicControl2: 0x08,
  vicMemory: 0x14,
  cia2Port: 0xd3,
  cia2Direction: 0xa4,
};
const expert: M1DisplayFields = {
  vicControl1: 0x1b,
  vicControl2: 0x08,
  vicMemory: 0x14,
  cia2Port: 0xd3,
  cia2Direction: 0xa7,
};
const upperBits = [4, 8, 16, 32, 64, 128];

describe("CIA2 generated display comparison", () => {
  it("returns a fresh expert-comparable copy while preserving the raw observation", () => {
    const observed = { ...generated };
    const before = { ...observed };
    const comparable = displayForExpertComparison(observed);
    expect(comparable).toEqual(expert);
    expect(comparable).not.toBe(observed);
    expect(observed).toEqual(before);
  });

  it.each([1, 2, 3])("rejects generated low direction bits %i", (low) => {
    expect(() => displayForExpertComparison({ ...generated, cia2Direction: 0xa4 | low })).toThrow();
  });

  it.each([0, 1, 2])("rejects generated physical low bank pins %i", (low) => {
    expect(() => displayForExpertComparison({ ...generated, cia2Port: 0xd0 | low })).toThrow();
  });

  it.each(upperBits)(
    "preserves differing upper direction bit %i so complete comparison rejects it",
    (bit) => {
      const observed = { ...generated, cia2Direction: 0xa4 ^ bit };
      const comparable = displayForExpertComparison(observed);
      expect(comparable).toEqual({ ...expert, cia2Direction: 0xa7 ^ bit });
      expect(comparable).not.toEqual(expert);
      expect(observed.cia2Direction).toBe(0xa4 ^ bit);
    },
  );

  it.each(upperBits)(
    "preserves differing upper port bit %i so complete comparison rejects it",
    (bit) => {
      const observed = { ...generated, cia2Port: 0xd3 ^ bit };
      const comparable = displayForExpertComparison(observed);
      expect(comparable).toEqual({ ...expert, cia2Port: 0xd3 ^ bit });
      expect(comparable).not.toEqual(expert);
      expect(observed.cia2Port).toBe(0xd3 ^ bit);
    },
  );

  it.each(["vicControl1", "vicControl2", "vicMemory"] as const)(
    "preserves differing %s so complete comparison rejects it",
    (field) => {
      const changed = generated[field] ^ 1;
      const observed = { ...generated, [field]: changed };
      const comparable = displayForExpertComparison(observed);
      expect(comparable).toEqual({ ...expert, [field]: changed });
      expect(comparable).not.toEqual(expert);
      expect(observed[field]).toBe(changed);
    },
  );

  it("preserves an enclosing pixel hash difference in the complete compared frame", () => {
    const observed = {
      display: { ...generated },
      pixelSha256: "cd".repeat(32),
    };
    const expected = { display: { ...expert }, pixelSha256: "ab".repeat(32) };
    const before = {
      display: { ...observed.display },
      pixelSha256: observed.pixelSha256,
    };
    const comparable = {
      ...observed,
      display: displayForExpertComparison(observed.display),
    };
    expect(comparable).toEqual({
      display: expert,
      pixelSha256: "cd".repeat(32),
    });
    expect(comparable).not.toEqual(expected);
    expect(observed).toEqual(before);
  });
});
