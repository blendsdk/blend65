import { defineConfig } from "vitest/config";

/** Compiler-package integration tier: public build/spec journeys without an emulator. */
export default defineConfig({
  test: {
    include: ["src/**/*.spec.test.ts"],
    environment: "node",
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
