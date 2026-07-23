import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/model.ts"],
      thresholds: {
        branches: 95,
      },
    },
  },
});
