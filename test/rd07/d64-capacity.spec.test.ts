import { describe, expect, it } from "vitest";
import { buildD64Image, encodeD64Name } from "@blend65/compiler";
import type { D64InputFile } from "@blend65/compiler";

const boot: D64InputFile = {
  id: "boot",
  name: encodeD64Name("BOOT"),
  loadAddress: 0x0801,
  body: [1, 2, 3, 4],
  aliases: [],
  destinationCalls: [],
};

/** Build one tiny unique unit at `index`. */
function unit(index: number): D64InputFile {
  return {
    id: `unit-${index}`,
    name: encodeD64Name(`L${index.toString(16).toUpperCase().padStart(12, "0")}`),
    loadAddress: 0,
    body: [index & 0xff],
    aliases: [],
    destinationCalls: [],
  };
}

describe("D64 capacity and name limits", () => {
  // Exactly 144 directory entries fit; one more fails before producing an image.
  it("should accept 144 entries and reject 145", () => {
    const exact = buildD64Image({
      projectName: "CAP",
      semanticHash: "44".repeat(32),
      boot,
      units: Array.from({ length: 143 }, (_, index) => unit(index)),
    });
    expect(exact.files).toHaveLength(144);
    expect(() =>
      buildD64Image({
        projectName: "CAP",
        semanticHash: "55".repeat(32),
        boot,
        units: Array.from({ length: 144 }, (_, index) => unit(index)),
      }),
    ).toThrow(/D64_CAPACITY/u);
  });

  // Two different units may not share one directory name.
  it("should reject a duplicate directory name", () => {
    expect(() =>
      buildD64Image({
        projectName: "DUP",
        semanticHash: "66".repeat(32),
        boot,
        units: [unit(1), { ...unit(2), name: unit(1).name }],
      }),
    ).toThrow(/D64_NAME/u);
  });

  // A boot name that collides with a unit name is rejected, never rewritten.
  it("should reject a boot/unit name collision", () => {
    expect(() =>
      buildD64Image({
        projectName: "L000000000001",
        semanticHash: "77".repeat(32),
        boot: { ...boot, name: encodeD64Name("L000000000001") },
        units: [unit(1)],
      }),
    ).toThrow(/D64_NAME/u);
  });
});
