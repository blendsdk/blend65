import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-01 reserved *.impl.test.ts for real logic arriving
    // with RD-02+; RD-11a introduces the first such logic, so the glob is
    // widened here. The brace pattern is disjoint by filename suffix, so spec
    // tests are not double-counted (see plan 02 Gap 2, AR-P8).
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
