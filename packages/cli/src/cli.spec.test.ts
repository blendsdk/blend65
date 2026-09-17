import * as compiler from "@blend65/compiler";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupFixtures,
  emptyFixture,
  manifestBytes,
  projectFixture,
} from "../test/cli-fixtures.js";

beforeEach(() => {
  // Observe the public boundary while preserving the real project loader and native I/O.
  vi.spyOn(compiler, "loadProject");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupFixtures();
});

/** Import inside each case so an absent CLI produces an attributable red result. */
async function invoke(argv: readonly string[], cwd: string) {
  const { runCli } = await import("./main.js");
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runCli(
    argv,
    { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    cwd,
  );
  return { status, stdout: stdout.join(""), stderr: stderr.join("") };
}

/** Permit line breaks and tabs, but never terminal controls or host stack disclosure. */
function expectSafe(text: string, root: string) {
  expect(text).not.toContain(root);
  expect(text).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u);
  expect(text).not.toMatch(/\n\s+at (?:\S+|file:)/u);
}

describe("truthful informational invocation", () => {
  // Informational flags are valid without project discovery or compilation.
  it.each(["--help", "-h"])(
    "should explain load-only usage for %s without loading",
    async (flag) => {
      const result = await invoke([flag], await emptyFixture());
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/usage/i);
      for (const option of ["--project", "--target", "--entry"])
        expect(result.stdout).toContain(option);
      expect(result.stdout).toMatch(/compilation (?:is )?not implemented/i);
      expect(compiler.loadProject).not.toHaveBeenCalled();
    },
  );

  // The executable version must identify the real package, not a fabricated compiler release.
  it.each(["--version", "-v"])(
    "should report matching build metadata for %s without loading",
    async (flag) => {
      const result = await invoke([flag], await emptyFixture());
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(compiler.BUILD_INFO.version);
      expect(result.stdout).toContain("0.1.0");
      expect(compiler.loadProject).not.toHaveBeenCalled();
    },
  );
});

describe("thin project-load consumer", () => {
  // A default invocation loads the nearest project, including from nested directories.
  it.each([".", "src/nested"])(
    "should load from %s and report the exact source count",
    async (relative) => {
      const root = await projectFixture();
      const cwd = join(root, relative);
      const result = await invoke([], cwd);
      expect(result.status).toBe(0);
      expect(result.stdout.trimEnd()).toBe(
        "Project 'Game Ω 1.2' loaded (2 source files); no compilation performed",
      );
      expect(result.stderr).toBe("");
      expect(compiler.loadProject).toHaveBeenCalledOnce();
      expect(compiler.loadProject).toHaveBeenCalledWith({ cwd });
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  // Both standard string-option forms forward their literal values without editing the manifest.
  it.each(["separate", "equals"])(
    "should forward project target and entry options in %s form",
    async (form) => {
      const root = await projectFixture("foundation");
      const before = await manifestBytes(root);
      const cwd = await emptyFixture();
      const project = join(root, "blend65.json");
      const target = "c64-pal-prg-kernal-6581";
      const entry = "Game.Render";
      const args =
        form === "equals"
          ? [`--project=${project}`, `--target=${target}`, `--entry=${entry}`]
          : ["--project", project, "--target", target, "--entry", entry];
      const result = await invoke(args, cwd);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trimEnd()).toBe(
        "Project 'foundation' loaded (2 source files); no compilation performed",
      );
      expect(compiler.loadProject).toHaveBeenCalledOnce();
      expect(compiler.loadProject).toHaveBeenCalledWith({ cwd, project, target, entry });
      expect(await manifestBytes(root)).toEqual(before);
    },
  );
});

describe("shared safe failure rendering", () => {
  // Shell output preserves ordered service headers, locations, related spans and concrete help.
  it("should render real duplicate and independent field diagnostics without leaking roots", async () => {
    const root = await projectFixture();
    await writeFile(
      join(root, "blend65.json"),
      '{"schemaVersion":1,"name":"first","name":"second","sourceRoot":"src","entry":"Foundation","target":"invalid","outDir":"out","unknown":true}',
    );
    const shared = await compiler.loadProject({ cwd: root });
    expect(shared.kind).toBe("failure");
    if (shared.kind !== "failure") throw new Error("Invalid fixture unexpectedly loaded");
    vi.mocked(compiler.loadProject).mockClear();
    const result = await invoke([], root);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    let previous = -1;
    for (const diagnostic of shared.diagnostics) {
      const header = `error[${diagnostic.code}]: ${diagnostic.message}`;
      const index = result.stderr.indexOf(header);
      expect(index).toBeGreaterThan(previous);
      previous = index;
      if (diagnostic.primarySpan) expect(result.stderr).toContain(diagnostic.primarySpan.sourceId);
      if (diagnostic.pointer) expect(result.stderr).toContain(diagnostic.pointer);
      for (const related of diagnostic.related) {
        expect(result.stderr).toContain(related.span.sourceId);
        expect(result.stderr).toContain(related.message);
      }
      if (diagnostic.help) expect(result.stderr).toContain(diagnostic.help);
    }
    expectSafe(result.stderr, root);
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  // Expected project failures return typed errors, never a successful load or a raw exception.
  it.each(["missing-project", "invalid-path", "terminal-name"])(
    "should safely reject %s",
    async (scenario) => {
      const root = scenario === "missing-project" ? await emptyFixture() : await projectFixture();
      if (scenario === "invalid-path") {
        const manifest = JSON.parse((await manifestBytes(root)).toString());
        await writeFile(
          join(root, "blend65.json"),
          JSON.stringify({ ...manifest, sourceRoot: "../outside" }),
        );
      }
      if (scenario === "terminal-name") {
        const manifest = JSON.parse((await manifestBytes(root)).toString());
        await writeFile(
          join(root, "blend65.json"),
          JSON.stringify({ ...manifest, name: "bad\u001b[31m\nname" }),
        );
      }
      const result = await invoke([], root);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      const code =
        scenario === "missing-project"
          ? "PROJECT_NOT_FOUND"
          : scenario === "invalid-path"
            ? "PROJECT_PATH_INVALID"
            : "PROJECT_INVALID_NAME";
      expect(result.stderr).toContain(`error[${code}]:`);
      expectSafe(result.stderr, root);
    },
  );
});

describe("strict argument boundary", () => {
  // Invalid arguments are rejected before any project read, tool action or output publication.
  it.each([
    ["check"],
    ["build"],
    ["run"],
    ["main.blend"],
    ["--unknown"],
    ["--project"],
    ["--target"],
    ["--entry"],
    ["--project", "a", "--project", "b"],
    ["--target=a", "--target=b"],
    ["--entry=a", "--entry=b"],
    ["--help", "--help"],
    ["-v", "--version"],
    ["--help", "--version"],
    ["-h", "-v"],
    ["--json"],
    ["--color"],
    ["--tool", "acme"],
  ])("should reject invalid arguments %j without loading", async (...args: string[]) => {
    const root = await emptyFixture();
    const result = await invoke(args, root);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error[CLI_INVALID_ARGUMENT]:");
    expect(result.stderr).toMatch(/usage/i);
    expectSafe(result.stderr, root);
    expect(compiler.loadProject).not.toHaveBeenCalled();
  });
});
