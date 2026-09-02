import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/execution-publication-conformance.impl.test.ts",
      "src/execution-publication-model.impl.test.ts",
      "src/execution-validation.impl.test.ts",
      "src/failure-contracts.impl.test.ts",
      "src/failure-contracts.spec.test.ts",
      "src/failure-envelope-helpers.impl.test.ts",
      "src/failure-history.impl.test.ts",
      "src/failure-predicate-ingredients.impl.test.ts",
      "src/published-oracle-boundary.impl.test.ts",
      "src/published-runtime-evaluation.impl.test.ts",
    ],
    environment: "node",
    passWithNoTests: false,
    minWorkers: 1,
    maxWorkers: 2,
  },
});
