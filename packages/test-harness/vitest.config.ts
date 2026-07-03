import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-12 introduces the first test-harness *.impl.test.ts
    // (the VICE codec / PNG tests), so the glob is widened here, mirroring the
    // compiler/codegen packages. The brace pattern is disjoint by filename suffix,
    // so spec tests are not double-counted.
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
