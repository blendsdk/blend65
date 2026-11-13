import { defineConfig } from "vitest/config";
import { filesForTier } from "./test/test-tiers";

/**
 * Host root tier: fast and integration tests together. This is the default
 * checkpoint tier before the serialized VICE journey.
 */
export default defineConfig({
  test: {
    include: [...filesForTier("fast"), ...filesForTier("integration")],
    environment: "node",
    setupFiles: ["test/setup-matchers.ts"],
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
