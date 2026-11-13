import { defineConfig } from "vitest/config";

/** Fast compiler-package tier: implementation tests without public build journeys. */
export default defineConfig({
  test: {
    include: ["src/**/*.impl.test.ts"],
    environment: "node",
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 60_000,
  },
});
