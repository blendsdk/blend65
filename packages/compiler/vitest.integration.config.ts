import { defineConfig } from "vitest/config";
import { hostWorkers } from "../../test/vitest-workers";

/** Compiler-package integration tier: public build/spec journeys without an emulator. */
export default defineConfig({
  test: {
    include: ["src/**/*.spec.test.ts"],
    environment: "node",
    fileParallelism: process.platform !== "win32",
    maxWorkers: process.platform === "win32" ? 1 : hostWorkers,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
