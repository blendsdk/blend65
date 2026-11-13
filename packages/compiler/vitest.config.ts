import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
