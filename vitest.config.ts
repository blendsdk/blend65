import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // CI and Windows run the direct foundation/import boundaries here.
    // Local Linux runs the full release corpus, including emulator journeys.
    // Package suites still run in full through `yarn test` on either tier.
    include:
      process.env.BLEND65_FOUNDATION_CI === "1" || process.platform === "win32"
        ? [
            "test/foundation.spec.test.ts",
            "test/import-boundary.impl.test.ts",
            "test/import-boundary.spec.test.ts",
            "test/rd03-import-boundary.spec.test.ts",
          ]
        : ["test/**/*.{spec,impl}.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
