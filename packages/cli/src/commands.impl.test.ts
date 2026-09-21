import type { CheckResult, ProjectDiagnostic } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { executeCommand } from "./run.js";
import type { CommandContext } from "./run.js";

const WARNING: ProjectDiagnostic = Object.freeze({
  code: "W10001",
  severity: "warning",
  message: "Safe warning",
  primarySpan: null,
  related: Object.freeze([]),
  help: null,
  pointer: null,
});

/** Build one command context with a focused check result. */
function context(result: CheckResult, stdout: string[], stderr: string[]): CommandContext {
  return {
    cwd: "/project",
    signal: new AbortController().signal,
    output: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    services: {
      checkProject: async () => result,
      buildProject: async () => {
        throw new Error("unexpected build");
      },
      runProject: async () => {
        throw new Error("unexpected run");
      },
    },
  };
}

describe("command rendering hardening", () => {
  it("should render successful warnings before one check summary", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const result: CheckResult = {
      kind: "success",
      snapshotSha256: "1".repeat(64),
      profileId: "c64-pal-prg-kernal-6581",
      diagnostics: [WARNING],
      measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" },
    };

    expect(await executeCommand(["check"], context(result, stdout, stderr))).toBe(0);
    expect(stderr.join("")).toContain("warning[W10001]: Safe warning");
    expect(stdout).toHaveLength(1);
  });

  it("should propagate a caller-owned output failure unchanged", async () => {
    const failure = new Error("sink failed");
    const result: CheckResult = {
      kind: "success",
      snapshotSha256: "1".repeat(64),
      profileId: "c64-pal-prg-kernal-6581",
      diagnostics: [],
      measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" },
    };
    const commandContext = context(result, [], []);
    const failingContext: CommandContext = {
      ...commandContext,
      output: {
        stdout: () => {
          throw failure;
        },
        stderr: commandContext.output.stderr,
      },
    };

    await expect(executeCommand(["check"], failingContext)).rejects.toBe(failure);
  });
});
