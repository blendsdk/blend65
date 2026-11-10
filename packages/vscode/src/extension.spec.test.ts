import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");
const repository = join(packageRoot, "../..");

/** Read the extension manifest as an untrusted JSON object. */
async function manifest(): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Extension manifest must be an object");
  }
  return Object.fromEntries(Object.entries(value));
}

describe("thin Blend65 VS Code extension", () => {
  it("contributes the language and exactly three explicit commands", async () => {
    const packageJson = await manifest();
    expect(packageJson.name).toBe("@blend65/vscode");
    expect(packageJson.type).toBe("module");
    expect(packageJson.main).toBe("./dist/extension.js");
    expect(packageJson.activationEvents).toEqual([
      "onLanguage:blend65",
      "onCommand:blend65.build",
      "onCommand:blend65.run",
      "onCommand:blend65.openEvidence",
    ]);
    const contributes = packageJson.contributes as Record<string, unknown>;
    expect(contributes.languages).toEqual([{ id: "blend65", extensions: [".blend"] }]);
    expect(contributes.commands).toEqual([
      { command: "blend65.build", title: "Blend65: Build" },
      { command: "blend65.run", title: "Blend65: Run in VICE" },
      { command: "blend65.openEvidence", title: "Blend65: Open Build Evidence" },
    ]);
    expect(JSON.stringify(contributes.commands)).not.toMatch(/build and run|rerun/i);
    expect(packageJson.capabilities).toEqual({
      untrustedWorkspaces: {
        supported: "limited",
        description:
          "Language analysis works without trust; build, run, and artifact reveal require a trusted workspace.",
      },
    });
    expect(packageJson).not.toHaveProperty("browser");
    expect(packageJson).not.toHaveProperty("icon");
    expect(packageJson).not.toHaveProperty("scripts.package");
    expect(JSON.stringify(packageJson)).not.toMatch(/configuration|themes|test-host|vsix/i);
    expect((packageJson.dependencies as Record<string, string>)["@blend65/cli"]).toBe("0.1.0");
  });

  it("ships real Node bundles for the extension and diagnostics server without backend imports", async () => {
    const extensionBundle = join(packageRoot, "dist/extension.js");
    const serverBundle = join(repository, "packages/language-server/dist/server.js");
    await expect(access(extensionBundle)).resolves.toBeUndefined();
    await expect(access(serverBundle)).resolves.toBeUndefined();
    const extensionText = await readFile(extensionBundle, "utf8");
    const serverText = await readFile(serverBundle, "utf8");
    expect(extensionText).toMatch(/LanguageClient/);
    expect(extensionText).toMatch(/@blend65\/language-server/);
    expect(extensionText).toMatch(/blend65\.build/);
    expect(extensionText).toMatch(/@blend65\/cli\/bin/);
    expect(serverText).toMatch(/createConnection/);
    expect(`${extensionText}\n${serverText}`).not.toMatch(
      /@blend65\/compiler(?:["']|\/(?:target|semantic|storage|machine|layout|artifacts|publication|tools|services))/,
    );
  });

  it("keeps Vite explicit and Node-only for both entry points", async () => {
    const extensionConfig = await readFile(join(packageRoot, "vite.config.ts"), "utf8");
    const serverConfig = await readFile(
      join(repository, "packages/language-server/vite.config.ts"),
      "utf8",
    );
    for (const [config, entry] of [
      [extensionConfig, "src/extension.ts"],
      [serverConfig, "src/server.ts"],
    ]) {
      expect(config).toContain(entry);
      expect(config).toMatch(/platform:\s*["']node["']/);
      expect(config).not.toMatch(/browser|webworker|library|multi/i);
    }
  });
});
