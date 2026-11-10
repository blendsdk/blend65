import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { runCli } from "@blend65/cli";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** Create one valid minimal project and return its manifest path. */
async function project(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd09-evidence-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/game.blend"), "module Game;\n\nfunction main(): void {}\n");
  const manifest = join(root, "blend65.json");
  await writeFile(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      name,
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

/** Run one CLI invocation and collect its single output line. */
async function cli(argv: readonly string[], cwd: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runCli(
    argv,
    { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    cwd,
    new AbortController().signal,
  );
  return { status, stdout, stderr, envelope: stdout.length === 0 ? null : JSON.parse(stdout[0]!) };
}

describe("CLI evidence command", () => {
  it("should resolve the current generation and all artifact roles after a real build", async () => {
    const manifest = await project("evidence");
    const built = await buildProject({ project: manifest });
    expect(built.kind).toBe("success");
    const result = await cli(["evidence", "--project", manifest, "--json"], join(manifest, ".."));
    expect(result.status).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(result.envelope.evidence.current).toBe(true);
    const roles = result.envelope.evidence.artifacts.map(({ role }: { role: string }) => role);
    expect(roles).toEqual([
      "assembly",
      "assets",
      "build",
      "costs",
      "debug",
      "labels",
      "memory",
      "primary",
    ]);
    expect(
      result.envelope.evidence.artifacts.every(({ sha256 }: { sha256: string }) =>
        /^[0-9a-f]{64}$/u.test(sha256),
      ),
    ).toBe(true);
  }, 120_000);

  it("should fail closed when no current generation exists", async () => {
    const manifest = await project("evidence-empty");
    const result = await cli(["evidence", "--project", manifest, "--json"], join(manifest, ".."));
    expect(result.status).toBe(6);
    expect(result.envelope.outcome).toBe("failure");
    expect(result.envelope.failure.category).toBe("packaging");
    expect(result.envelope.evidence).toBeUndefined();
  }, 30_000);
});
