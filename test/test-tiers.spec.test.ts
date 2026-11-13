import { describe, expect, it } from "vitest";
import { classifiedRootTests, classifyTestSource } from "./test-tiers.js";

describe("root test tier inventory", () => {
  // Every root test file must be assigned to exactly one execution tier.
  it("should classify every root test file exactly once", () => {
    const files = classifiedRootTests();
    expect(files.length).toBeGreaterThan(300);
    expect(new Set(files.map(({ file }) => file)).size).toBe(files.length);
    for (const { file, tier } of files) {
      expect(file, file).toMatch(/^test\/.+\.test\.ts$/u);
      expect(["fast", "integration", "vice"], file).toContain(tier);
    }
    expect(files.filter(({ tier }) => tier === "fast").length).toBeGreaterThanOrEqual(35);
    expect(files.filter(({ tier }) => tier === "integration").length).toBeGreaterThanOrEqual(150);
    expect(files.filter(({ tier }) => tier === "vice").length).toBeGreaterThanOrEqual(100);
  });

  // Representative files pin the classification contract used by the configs.
  it("should keep representative files in their intended tiers", () => {
    const tiers = new Map(classifiedRootTests().map(({ file, tier }) => [file, tier]));
    expect(tiers.get("test/foundation.spec.test.ts")).toBe("fast");
    expect(tiers.get("test/rd04/declaration-scope.spec.test.ts")).toBe("integration");
    expect(tiers.get("test/rd05/runtime-switch-vice.spec.test.ts")).toBe("vice");
    expect(tiers.get("test/rd05/input-saved-query-purity.spec.test.ts")).toBe("vice");
  });

  // Explicit helper imports outrank ordinary build imports. Spell the helper
  // names through concatenation so this meta-test does not classify itself.
  it("should prefer the emulator tier when a file imports both helper kinds", () => {
    const vice = ["start", "Vice"].join("");
    const build = ["build", "Project"].join("");
    expect(classifyTestSource(`import { ${build} } from "@blend65/compiler";\n${vice}();`)).toBe(
      "vice",
    );
    expect(classifyTestSource(`import { ${build} } from "@blend65/compiler";`)).toBe("integration");
    expect(classifyTestSource("export const value = 1;")).toBe("fast");
  });
});
