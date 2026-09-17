import { BUILD_INFO } from "@blend65/compiler";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupFixtures,
  emptyFixture,
  manifestBytes,
  projectFixture,
} from "../test/cli-fixtures.js";

const bin = fileURLToPath(new URL("../dist/bin.js", import.meta.url));

afterEach(cleanupFixtures);

/** Execute the public built binary directly, capturing failure status without a shell. */
function invoke(
  argv: readonly string[],
  cwd: string,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [bin, ...argv],
      { cwd, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error && (typeof error.code !== "number" || error.signal)) {
          reject(error);
          return;
        }
        resolve({ status: error ? Number(error.code) : 0, stdout, stderr });
      },
    );
  });
}

describe("public built executable", () => {
  // Installed invocation must map to the same built executable exercised by these workflows.
  it("should expose the real package version and blendc binary", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.name).toBe("@blend65/cli");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.version).toBe(BUILD_INFO.version);
    expect(manifest.bin.blendc).toBe("dist/bin.js");
    expect(Object.keys(manifest.dependencies)).toEqual(["@blend65/compiler"]);
    expect(manifest.dependencies["@blend65/compiler"]).toBe("0.1.0");
  });

  // The real executable must provide truthful help and metadata even outside a project.
  it.each(["--help", "-h", "--version", "-v"])(
    "should support %s outside a project",
    async (flag) => {
      const root = await emptyFixture();
      const result = await invoke([flag], root);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      if (flag === "--help" || flag === "-h") {
        expect(result.stdout).toMatch(/usage/i);
        expect(result.stdout).toMatch(/compilation (?:is )?not implemented/i);
      } else expect(result.stdout).toContain(BUILD_INFO.version);
      expect(await readdir(root)).toEqual([]);
    },
  );

  // Source inventory succeeds without parsing or compiling opaque source contents.
  it.each(["root", "nested", "explicit-separate", "explicit-equals"])(
    "should load a real project with %s invocation",
    async (mode) => {
      const root = await projectFixture("foundation");
      const before = await manifestBytes(root);
      const cwd =
        mode === "nested"
          ? join(root, "src", "nested")
          : mode.startsWith("explicit")
            ? await emptyFixture()
            : root;
      const project = join(root, "blend65.json");
      const args =
        mode === "explicit-separate"
          ? ["--project", project, "--target", "c64-pal-prg-kernal-6581", "--entry", "Game.Render"]
          : mode === "explicit-equals"
            ? [`--project=${project}`, "--target=c64-pal-prg-kernal-6581", "--entry=Game.Render"]
            : [];
      const result = await invoke(args, cwd);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trimEnd()).toBe(
        "Project 'foundation' loaded (2 source files); no compilation performed",
      );
      expect(await manifestBytes(root)).toEqual(before);
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  // Invalid projects fail safely without changing prior output or disclosing terminal sequences.
  it("should return failure diagnostics and leave existing output untouched", async () => {
    const root = await projectFixture();
    await mkdir(join(root, "out"));
    await writeFile(join(root, "out", "previous.prg"), "prior output bytes");
    const manifest = JSON.parse((await manifestBytes(root)).toString());
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({ ...manifest, name: "bad\u001b[31m\nname" }),
    );
    const before = await manifestBytes(root);
    const result = await invoke([], root);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error[PROJECT_INVALID_NAME]:");
    expect(result.stderr).not.toContain(root);
    expect(result.stderr).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u);
    expect(result.stderr).not.toMatch(/\n\s+at /u);
    expect(await manifestBytes(root)).toEqual(before);
    expect(await readdir(join(root, "out"))).toEqual(["previous.prg"]);
    expect(await readFile(join(root, "out", "previous.prg"), "utf8")).toBe("prior output bytes");
  });

  // Exit two distinguishes invalid invocation from project-loading failure.
  it.each([
    ["check"],
    ["build"],
    ["run"],
    ["main.blend"],
    ["--unknown"],
    ["--entry"],
    ["--help", "--version"],
  ])("should reject unsupported invocation %j with exit two", async (...args: string[]) => {
    const root = await emptyFixture();
    const result = await invoke(args, root);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error[CLI_INVALID_ARGUMENT]:");
    expect(result.stderr).toMatch(/usage/i);
    expect(result.stderr).not.toContain("PROJECT_NOT_FOUND");
    expect(await readdir(root)).toEqual([]);
  });
});
