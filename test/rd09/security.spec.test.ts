import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { runCli } from "@blend65/cli";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** Create one valid project and return its manifest path and root. */
async function project(): Promise<{ manifest: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd09-security-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/game.blend"), "module Game;\n\nfunction main(): void {}\n");
  const manifest = join(root, "blend65.json");
  await writeFile(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      name: "security",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  return { manifest, root };
}

/** Run one CLI invocation and parse its single JSON line. */
async function cli(argv: readonly string[], cwd: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runCli(
    argv,
    { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    cwd,
    new AbortController().signal,
  );
  return {
    status,
    stderr,
    envelope: stdout.length === 0 ? null : JSON.parse(stdout[0]!),
  };
}

describe("tooling security boundaries", () => {
  it("should fail closed when a published artifact no longer matches its hash", async () => {
    const { manifest, root } = await project();
    const built = await buildProject({ project: manifest });
    expect(built.kind).toBe("success");
    if (built.kind !== "success") return;
    await appendFile(join(built.generation.directory, ".debug.json"), "\n");
    const result = await cli(["evidence", "--project", manifest, "--json"], root);
    expect(result.status).toBe(6);
    expect(result.envelope.outcome).toBe("failure");
    expect(result.envelope.failure.category).toBe("packaging");
    expect(result.envelope.evidence).toBeUndefined();
  }, 60_000);

  it("should reject an oversized current publication record before parsing it", async () => {
    const { manifest, root } = await project();
    const built = await buildProject({ project: manifest });
    expect(built.kind).toBe("success");
    await writeFile(join(root, "out/current.json"), "x".repeat(2 * 1024 * 1024));
    const result = await cli(["evidence", "--project", manifest, "--json"], root);
    expect(result.status).toBe(6);
    expect(result.envelope.outcome).toBe("failure");
    expect(result.envelope.evidence).toBeUndefined();
  }, 30_000);

  it("should reject a source root that escapes the project", async () => {
    const { root } = await project();
    const manifest = join(root, "blend65.json");
    const value = JSON.parse(await readFile(manifest, "utf8")) as Record<string, unknown>;
    value.sourceRoot = "../outside";
    await writeFile(manifest, JSON.stringify(value));
    const result = await cli(["evidence", "--project", manifest, "--json"], root);
    expect(result.status).toBe(6);
    expect(result.envelope.outcome).toBe("diagnostics");
    expect(result.envelope.evidence).toBeUndefined();
    expect(
      result.envelope.diagnostics.some(
        ({ code }: { code: string }) => code === "PROJECT_PATH_INVALID",
      ),
    ).toBe(true);
  }, 30_000);
});
