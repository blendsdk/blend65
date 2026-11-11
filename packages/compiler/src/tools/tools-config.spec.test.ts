import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readToolsConfig, toolsConfigPath } from "./tools-config.js";

const roots: string[] = [];

/** Create one isolated configuration root. */
async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "blend65-tools-"));
  roots.push(value);
  return value;
}

/** Write one tools file under an XDG root. */
async function writeConfig(base: string, text: string): Promise<string> {
  await mkdir(join(base, "blend65"), { recursive: true });
  const path = join(base, "blend65", "tools.jsonc");
  await writeFile(path, text);
  return path;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("machine-local tools configuration", () => {
  it("resolves the Linux XDG path and ignores a relative XDG root", () => {
    expect(toolsConfigPath({ XDG_CONFIG_HOME: "/tmp/config" }, "linux", "/home/user")).toBe(
      join("/tmp/config", "blend65", "tools.jsonc"),
    );
    expect(toolsConfigPath({ XDG_CONFIG_HOME: "relative" }, "linux", "/home/user")).toBe(
      join("/home/user", ".config", "blend65", "tools.jsonc"),
    );
    expect(toolsConfigPath({}, "linux", "/home/user")).toBe(
      join("/home/user", ".config", "blend65", "tools.jsonc"),
    );
  });

  it("resolves the Windows APPDATA path with a roaming-profile fallback", () => {
    expect(toolsConfigPath({ APPDATA: "/appdata" }, "win32", "/home/user")).toBe(
      join("/appdata", "blend65", "tools.jsonc"),
    );
    expect(toolsConfigPath({}, "win32", "/home/user")).toBe(
      join("/home/user", "AppData", "Roaming", "blend65", "tools.jsonc"),
    );
  });

  it("treats an absent file as an empty selection", async () => {
    const base = await root();
    await expect(readToolsConfig({ XDG_CONFIG_HOME: base }, "linux", base)).resolves.toEqual({
      kind: "success",
      path: join(base, "blend65", "tools.jsonc"),
      config: {},
    });
  });

  it("accepts both absolute paths, comments, and a trailing comma", async () => {
    const base = await root();
    const path = await writeConfig(
      base,
      [
        "{",
        "  // machine-local tools",
        '  "schemaVersion": 1,',
        '  "acmePath": "/usr/bin/acme",',
        '  "x64scPath": "/opt/vice/bin/x64sc",',
        "}",
      ].join("\n"),
    );
    await expect(readToolsConfig({ XDG_CONFIG_HOME: base }, "linux", base)).resolves.toEqual({
      kind: "success",
      path,
      config: { acmePath: "/usr/bin/acme", x64scPath: "/opt/vice/bin/x64sc" },
    });
  });

  it.each([
    ["missing version", '{ "acmePath": "/usr/bin/acme" }'],
    ["wrong version", '{ "schemaVersion": 2 }'],
    ["string version", '{ "schemaVersion": "1" }'],
    ["fractional version", '{ "schemaVersion": 1.5 }'],
    ["unknown key", '{ "schemaVersion": 1, "target": "c64" }'],
    ["relative path", '{ "schemaVersion": 1, "acmePath": "bin/acme" }'],
    ["empty path", '{ "schemaVersion": 1, "acmePath": "" }'],
    ["wrong path type", '{ "schemaVersion": 1, "x64scPath": 3 }'],
    ["duplicate key", '{ "schemaVersion": 1, "acmePath": "/a", "acmePath": "/b" }'],
    ["malformed JSONC", '{ "schemaVersion": 1,'],
    ["non-object", "[]"],
  ])("rejects %s with a stable diagnostic", async (_name, text) => {
    const base = await root();
    const path = await writeConfig(base, text);
    const result = await readToolsConfig({ XDG_CONFIG_HOME: base }, "linux", base);
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a configuration failure");
    expect(result.path).toBe(path);
    expect(result.diagnostic.length).toBeGreaterThan(0);
  });
});
