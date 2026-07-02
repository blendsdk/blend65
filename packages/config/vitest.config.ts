import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-01 reserved *.impl.test.ts for real logic; RD-16
    // introduces this package's first such logic, so the glob is widened here
    // (same precedent as @blend65/core at RD-11a).
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
