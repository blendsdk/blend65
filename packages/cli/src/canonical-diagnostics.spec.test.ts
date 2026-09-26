import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject, checkProject, runProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { executeCommand } from "./run.js";

describe("real compiler diagnostics in CLI output", () => {
  // The CLI renders the same canonical source errors produced by the actual public compiler service.
  it.each([
    ["missing name", "poke($0400, missing);", "E10239"],
    ["invalid call", "poke($0400);", "E10171"],
  ])("should retain compiler identity for %s", async (_name, body, code) => {
    const root = await mkdtemp(join(tmpdir(), "blend65-cli-canonical-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "src/game.blend"),
        `module Game; function main(): void { ${body} }`,
      );
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "cli-diagnostics",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      const checked = await checkProject({ cwd: root });
      expect(checked.kind).toBe("failure");
      const canonical = checked.diagnostics.find((diagnostic) => diagnostic.code === code);
      expect(canonical).toBeDefined();
      if (canonical === undefined) throw new Error("Expected canonical diagnostic");
      const stdout: string[] = [];
      const stderr: string[] = [];
      const status = await executeCommand(["check"], {
        cwd: root,
        signal: new AbortController().signal,
        output: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
        services: { checkProject, buildProject, runProject },
      });
      expect(status).toBe(3);
      expect(stdout).toEqual([]);
      expect(stderr.join("")).toContain(canonical.code);
      expect(stderr.join("")).toContain(canonical.message);
      expect(stderr.join("")).not.toMatch(/internal compiler error|not yet lowered/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
