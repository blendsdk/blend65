import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The root tier discovers both the spec tier (*.spec.test.ts) and the
    // logic tier (*.impl.test.ts) — the parity scripts introduced the first
    // root impl tests, mirroring the per-package configs' widened globs.
    include: ["packages/*/src/**/*.spec.test.ts", "test/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
