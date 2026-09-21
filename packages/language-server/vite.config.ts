import { defineConfig } from "vite";

export default defineConfig({
  esbuild: { platform: "node" },
  ssr: { target: "node" },
  build: {
    target: "node22",
    ssr: "src/server.ts",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      external: [
        "@blend65/compiler/frontend",
        "vscode-languageserver/node",
        "vscode-languageserver-textdocument",
      ],
      output: { entryFileNames: "server.js" },
    },
  },
});
