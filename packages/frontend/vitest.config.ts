import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
