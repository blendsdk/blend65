import { defineConfig } from "vitest/config";
import { hostWorkers } from "../../test/vitest-workers";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    fileParallelism: process.platform !== "win32",
    maxWorkers: process.platform === "win32" ? 1 : hostWorkers,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
