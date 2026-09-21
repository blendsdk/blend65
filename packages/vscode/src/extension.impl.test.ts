import { createRequire } from "node:module";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");

/** Narrow a parsed manifest before inspecting dependency ownership. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("VS Code extension implementation bounds", () => {
  it("resolves the workspace package export to the executable server bundle", async () => {
    const require = createRequire(join(packageRoot, "dist/extension.js"));
    const resolved = require.resolve("@blend65/language-server");
    expect(resolved).toBe(join(packageRoot, "../language-server/dist/server.js"));
    await expect(access(resolved)).resolves.toBeUndefined();
  });

  it("keeps the exact runtime and build-only dependency sets", async () => {
    const parsed: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    if (!record(parsed) || !record(parsed.dependencies) || !record(parsed.devDependencies)) {
      throw new Error("Invalid extension manifest");
    }
    expect(parsed.dependencies).toEqual({
      "@blend65/language-server": "0.1.0",
      "vscode-languageclient": "10.1.1",
    });
    expect(parsed.devDependencies).toEqual({ "@types/vscode": "1.138.0", vite: "5.4.21" });
  });

  it("emits only the extension entry and its source map", async () => {
    await expect(access(join(packageRoot, "dist/extension.js"))).resolves.toBeUndefined();
    await expect(access(join(packageRoot, "dist/extension.js.map"))).resolves.toBeUndefined();
    const bundle = await readFile(join(packageRoot, "dist/extension.js"), "utf8");
    expect(bundle).toContain("TransportKind.stdio");
    expect(bundle).not.toMatch(/registerCommand|workspace\.getConfiguration|createWebviewPanel/);
  });
});
