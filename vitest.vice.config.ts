import { defineConfig } from "vitest/config";
import { filesForTier } from "./test/test-tiers";

/**
 * VICE root tier: every file that launches or drives a real emulator. Files are
 * serialized so concurrent x64sc instances never contend for CPU or monitor ports.
 */
export default defineConfig({
  test: {
    include: [...filesForTier("vice")],
    environment: "node",
    setupFiles: ["test/setup-matchers.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 180_000,
  },
});
