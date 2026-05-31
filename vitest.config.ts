import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.spec.test.ts", "test/**/*.spec.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
