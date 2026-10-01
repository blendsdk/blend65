import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The RD-04/05 root release corpus and VICE monitor journeys belong to the
    // Linux host matrix. Windows runs the direct foundation/import boundaries
    // here; package suites still run on both hosts through `yarn test`.
    include:
      process.platform === "win32"
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
