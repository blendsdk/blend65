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
      exclude: [
        "src/**/*.test.ts",
        "src/test-fixtures/**",
        "src/index.ts",
        // The worker entry is exercised through real worker threads. Vitest's parent V8 provider
        // cannot merge worker-isolate coverage, so counting it here would report the proven path
        // as zero and distort the production-core threshold.
        "src/execution-worker-entry.ts",
        // The process anchor entry runs in a dedicated child V8 isolate for the same reason.
        "src/execution-process-anchor-entry.ts",
        // The record-then-exec launcher is exercised in its dedicated child V8 isolate.
        "src/execution-vice-launcher-entry.ts",
      ],
      thresholds: {
        branches: 90,
      },
    },
  },
});
