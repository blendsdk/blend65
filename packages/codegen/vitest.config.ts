import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-09 introduces the first codegen *.impl.test.ts
    // (serialize-acme.impl.test.ts), so the glob is widened here, mirroring the
    // core package (AR-P8). The brace pattern is disjoint by filename suffix, so
    // spec tests are not double-counted.
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
