import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.{spec,impl}.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
