import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
    minWorkers: 1,
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 240_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/model.ts"],
      thresholds: {
        branches: 90,
      },
    },
  },
});
