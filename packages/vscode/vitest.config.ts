import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
