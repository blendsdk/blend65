import { BUILD_INFO } from "@blend65/compiler";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
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

  // Missing, unknown and extra input retain the distinct usage status.
  it.each([[[]], [["unknown"]], [["build", "extra"]], [["--help", "--version"]]])(
    "should reject invalid invocation %j with exit two",
    async (argv) => {
      const root = await emptyFixture();
      const result = await invoke(argv, root);

      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CLI_INVALID_ARGUMENT");
      expect(await readdir(root)).toEqual([]);
    },
  );
});
