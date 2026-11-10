import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCliAdapter, parseCliEnvelope } from "./cli-client.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** Create one valid minimal project and return its manifest path. */
async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-vscode-cli-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/game.blend"), "module Game;\n\nfunction main(): void {}\n");
  const manifest = join(root, "blend65.json");
  await writeFile(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      name: "vscode-cli",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  return manifest;
}

describe("packaged CLI adapter", () => {
  it("should resolve the packaged blendc and parse one JSON result", async () => {
    const manifest = await project();
    const envelope = await createCliAdapter().run(
      ["check", "--project", manifest, "--json"],
      new AbortController().signal,
    );
    expect(envelope.kind).toBe("blend65.cli");
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.command).toBe("check");
    expect(envelope.outcome).toBe("success");
    expect(envelope.exitStatus).toBe(0);
  }, 20_000);

  it("should reject malformed CLI envelopes before use", () => {
    expect(() => parseCliEnvelope(null)).toThrow(/non-object/u);
    expect(() => parseCliEnvelope({ kind: "other" })).toThrow(/unsupported/u);
    expect(() =>
      parseCliEnvelope({
        kind: "blend65.cli",
        schemaVersion: 2,
        command: "check",
        outcome: "success",
        exitStatus: 0,
        diagnostics: [],
      }),
    ).toThrow(/unsupported/u);
  });

  it("should reject a cancelled command without returning a result", async () => {
    const manifest = await project();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createCliAdapter().run(["check", "--project", manifest, "--json"], controller.signal),
    ).rejects.toThrow(/cancelled|no result/u);
  }, 20_000);
});
