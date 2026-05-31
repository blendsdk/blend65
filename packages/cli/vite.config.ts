// packages/cli/vite.config.ts (placeholder — Node library build)
// Real CLI entry logic arrives in RD-15; this reserves the bundling path.
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    outDir: "dist",
  },
});
