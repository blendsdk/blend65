import { defineConfig } from "vite";

export default defineConfig({
  esbuild: { platform: "node" },
  ssr: { target: "node" },
  build: {
    target: "node22",
    ssr: "src/extension.ts",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      external: ["vscode", "vscode-languageclient/node", "@blend65/language-server"],
      output: { entryFileNames: "extension.js" },
    },
  },
});
