import { defineConfig } from "vitest/config";
import { hostWorkers } from "../../test/vitest-workers";

/** Fast compiler-package tier: implementation tests without public build journeys. */
export default defineConfig({
  test: {
    include: ["src/**/*.impl.test.ts"],
    environment: "node",
    fileParallelism: process.platform !== "win32",
    maxWorkers: process.platform === "win32" ? 1 : hostWorkers,
    minWorkers: 1,
    testTimeout: 60_000,
  },
});
