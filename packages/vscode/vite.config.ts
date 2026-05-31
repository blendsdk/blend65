// packages/vscode/vite.config.ts (placeholder — extension bundle build)
// Real extension/webview entry logic arrives in RD-14; this reserves the bundling path.
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    outDir: "dist",
  },
});
