import { BUILD_INFO } from "@blend65/compiler";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupFixtures, emptyFixture } from "../test/cli-fixtures.js";

const bin = fileURLToPath(new URL("../dist/bin.js", import.meta.url));

afterEach(cleanupFixtures);

/** Execute the built public binary directly, without a shell. */
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
  // Installed invocation maps to the package's built command entry.
  it("should expose the package version and blendc binary", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.name).toBe("@blend65/cli");
    expect(manifest.version).toBe(BUILD_INFO.version);
    expect(manifest.bin.blendc).toBe("dist/bin.js");
  });

  // Help and version work outside a project and advertise implemented commands.
  it.each(["--help", "-h", "--version", "-v"])(
    "should support %s outside a project",
    async (flag) => {
      const root = await emptyFixture();
      const result = await invoke([flag], root);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      if (flag === "--help" || flag === "-h") {
        expect(result.stdout).toContain("check|build|run");
        expect(result.stdout).not.toMatch(/not implemented/iu);
      } else expect(result.stdout).toContain(BUILD_INFO.version);
      expect(await readdir(root)).toEqual([]);
    },
  );

  // All three commands are accepted and fail as source errors when no project exists.
  it.each(["check", "build", "run"])("should execute the %s command route", async (command) => {
    const root = await emptyFixture();
    const result = await invoke([command], root);

    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("PROJECT_NOT_FOUND");
    expect(result.stderr).not.toContain(root);
    expect(result.stderr).not.toContain("CLI_INVALID_ARGUMENT");
    expect(await readdir(root)).toEqual([]);
  });

  // A relative manifest selection and the manifest's own relative outDir must
  // resolve against the invocation directory, so ACME never receives a path
  // that does not exist from its child working directory.
  it("should build with a relative project path and relative outDir", async () => {
    const base = await emptyFixture();
    const root = join(base, "game");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "main.blend"),
      "module Game; function main(): void { poke($D020, 1); }\n",
    );
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "relative-out",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "build",
        optimization: "none",
      }),
    );

    const relative = await invoke(["build", "--project", "game/blend65.json"], base);
    expect(relative.status, relative.stderr).toBe(0);
    await expect(access(join(root, "build", "current.json"))).resolves.toBeUndefined();

    const absolute = await invoke(["build", "--project", join(root, "blend65.json")], base);
    expect(absolute.status, absolute.stderr).toBe(0);
    await expect(access(join(root, "build", "current.json"))).resolves.toBeUndefined();
  });
});
