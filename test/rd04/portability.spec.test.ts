import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Find the four C64 firmware vector-byte addresses that must come from selected-platform facts.
 * Boundaries distinguish complete hexadecimal literals from unrelated larger addresses.
 */
function c64VectorLiterals(source: string): readonly string[] {
  return [...source.matchAll(/\b0x0*31[4589]n?\b/giu)].map(([literal]) => literal);
}

describe("shared frontend platform ownership", () => {
  // Shared code consumes platform facts; only the selected-profile owner supplies their values.
  it.each([
    { area: "semantic", excluded: [] },
    { area: "frontend", excluded: ["profile.ts"] },
  ])(
    "should contain no hard-coded C64 vector-byte addresses in $area sources",
    async ({ area, excluded }) => {
      const directory = new URL(`../../packages/compiler/src/${area}/`, import.meta.url);
      const entries = await readdir(directory, { withFileTypes: true });
      const files = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith(".ts") &&
            !entry.name.endsWith(".test.ts") &&
            !excluded.includes(entry.name),
        )
        .map(({ name }) => name)
        .sort();
      expect(files.length).toBeGreaterThan(0);
      const violations: string[] = [];
      for (const file of files) {
        const source = await readFile(new URL(file, directory), "utf8");
        if (c64VectorLiterals(source).length > 0) violations.push(file);
      }
      expect(violations).toEqual([]);
    },
  );

  // Each low and high byte is platform-owned, regardless of padding, case or bigint spelling.
  it.each([
    { name: "padded hexadecimal", literals: ["0x0314", "0x0315", "0x0318", "0x0319"] },
    { name: "unpadded hexadecimal", literals: ["0x314", "0x315", "0x318", "0x319"] },
    { name: "uppercase bigint", literals: ["0X00314n", "0X00315n", "0X00318n", "0X00319n"] },
  ])("should detect all vector bytes written as $name", ({ literals }) => {
    expect(c64VectorLiterals(`const addresses = [${literals.join(", ")}];`)).toEqual(literals);
  });

  // Consuming a platform fact introduces no machine address into shared semantics.
  it("should accept vector locations read from platform facts", () => {
    expect(c64VectorLiterals("const low = route.sink.vector; const high = low + 1;")).toEqual([]);
  });

  // Nearby and larger hexadecimal values are not any of the four restricted byte addresses.
  it("should leave unrelated numeric literals unclassified", () => {
    expect(
      c64VectorLiterals("const values = [0x0313, 0x0316, 0x0317, 0x031A, 0x1314, 0x03140n];"),
    ).toEqual([]);
  });
});
