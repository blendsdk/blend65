import { defineConfig } from "vitest/config";
import { filesForTier } from "./test/test-tiers";

/**
 * Fast root tier: no real compiler build and no emulator. Use this for the
 * innermost edit loop. Impacted build and VICE tests are selected separately.
 */
export default defineConfig({
  test: {
    include: [...filesForTier("fast")],
    environment: "node",
    setupFiles: ["test/setup-matchers.ts"],
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 60_000,
  },
});
