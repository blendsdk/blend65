import { defineConfig } from "vitest/config";

import { rd05CoverageFiles } from "./src/test-fixtures/rd05-coverage-sources.js";

export default defineConfig({
  test: {
    include: ["src/failure-*.{spec,impl}.test.ts", "src/reduction-*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
    minWorkers: 1,
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 240_000,
    coverage: {
      provider: "v8",
      include:
        rd05CoverageFiles.length === 0
          ? ["src/__rd05-no-production-core__.ts"]
          : [...rd05CoverageFiles],
      exclude: [
        "src/**/*.test.ts",
        "src/test-fixtures/**",
        "src/index.ts",
        "src/execution-handler-catalog.generated.ts",
      ],
      thresholds: {
        perFile: true,
        branches: 90,
      },
    },
  },
});
