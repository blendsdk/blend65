import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts) — RD-10 introduces the first platform logic tests.
    // The brace pattern is disjoint by filename suffix (no double-counting).
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
