import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-15 introduces the first cli *.impl.test.ts (args/render
    // edge cases), so the glob is widened here (PF-005), mirroring compiler/core.
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
