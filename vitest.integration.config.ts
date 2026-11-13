import { defineConfig } from "vitest/config";
import { filesForTier } from "./test/test-tiers";
import { hostWorkers } from "./test/vitest-workers";

/**
 * Integration root tier: real public builds, usually through ACME, without an
 * emulator. Files run in parallel because they own isolated temporary trees.
 */
export default defineConfig({
  test: {
    include: [...filesForTier("integration")],
    environment: "node",
    setupFiles: ["test/setup-matchers.ts"],
    fileParallelism: true,
    maxWorkers: hostWorkers,
    minWorkers: 1,
    testTimeout: 120_000,
  },
});
