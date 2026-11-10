import { describe, expect, it } from "vitest";
import type { CheckResult, ProjectDiagnostic } from "@blend65/compiler";
import { executeCommand } from "./run.js";
import type { CommandContext, CommandServices } from "./run.js";
import type { EvidenceResult } from "./evidence.js";
import type { CliJsonEnvelope } from "./json.js";

const DIAGNOSTIC: ProjectDiagnostic = {
  code: "E10001",
  severity: "error",
  message: "broken source",
  primarySpan: { sourceId: "src/game.blend", start: 0, end: 1 },
  related: [],
  help: null,
  pointer: null,
};

/** Build one command context with a scripted evidence result and silent output sinks. */
function context(
  services: Partial<CommandServices>,
  record: { stdout: string[]; stderr: string[] },
): CommandContext {
  return {
    cwd: "/project",
    signal: new AbortController().signal,
    output: {
      stdout: (text) => record.stdout.push(text),
      stderr: (text) => record.stderr.push(text),
    },
    services: {
      checkProject: async () => ({
        kind: "success",
        snapshotSha256: "a".repeat(64),
        profileId: "c64-pal-prg-kernal-6581",
        diagnostics: [],
        measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" },
      }),
      buildProject: async () => ({
        kind: "failure",
        category: "compiler",
        diagnostics: [],
      }),
      runProject: async () => ({
        kind: "failure",
        category: "compiler",
        diagnostics: [],
      }),
      readEvidence: async (): Promise<EvidenceResult> => ({
        kind: "success",
        generationId: "00000000-0000-4000-8000-000000000000",
        directory: "/project/out/00000000-0000-4000-8000-000000000000",
        buildJsonSha256: "b".repeat(64),
        primaryArtifact: "game.prg",
        artifacts: [{ role: "primary", path: "game.prg", sha256: "c".repeat(64) }],
      }),
      ...services,
    },
  };
}

/** Parse the one JSON line written to stdout. */
function envelope(record: { stdout: string[] }): CliJsonEnvelope {
  expect(record.stdout).toHaveLength(1);
  return JSON.parse(record.stdout[0]!) as CliJsonEnvelope;
}

describe("CLI JSON adapter", () => {
  it("should emit one version-one envelope for a successful check", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["check", "--json"], context({}, record))).toBe(0);
    expect(record.stderr).toEqual([]);
    const value = envelope(record);
    expect(value.kind).toBe("blend65.cli");
    expect(value.schemaVersion).toBe(1);
    expect(value.command).toBe("check");
    expect(value.outcome).toBe("success");
    expect(value.profileId).toBe("c64-pal-prg-kernal-6581");
    expect(value.diagnostics).toEqual([]);
  });

  it("should preserve diagnostic and failure categories", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    const failure: CheckResult = {
      kind: "failure",
      category: "source",
      diagnostics: [DIAGNOSTIC],
    };
    expect(
      await executeCommand(
        ["check", "--json"],
        context({ checkProject: async () => failure }, record),
      ),
    ).toBe(3);
    const value = envelope(record);
    expect(value.outcome).toBe("diagnostics");
    expect(value.exitStatus).toBe(3);
    expect(value.failure).toEqual({ category: "source", message: "broken source" });
    expect(value.diagnostics[0]?.code).toBe("E10001");
  });

  it("should reject invalid arguments and duplicate flags with a bounded envelope", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["check", "--json", "extra"], context({}, record))).toBe(2);
    expect(envelope(record).outcome).toBe("invalid-arguments");

    const duplicate = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["check", "--json", "--json"], context({}, duplicate))).toBe(2);
    expect(envelope(duplicate).outcome).toBe("invalid-arguments");
  });

  it("should return validated evidence without publishing anything", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["evidence", "--json"], context({}, record))).toBe(0);
    const value = envelope(record);
    expect(value.command).toBe("evidence");
    expect(value.evidence).toEqual({
      current: true,
      generationId: "00000000-0000-4000-8000-000000000000",
      directory: "/project/out/00000000-0000-4000-8000-000000000000",
      artifacts: [{ role: "primary", path: "game.prg", sha256: "c".repeat(64) }],
    });
  });

  it("should report an internal failure with process status 1", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    const status = await executeCommand(
      ["check", "--json"],
      context(
        {
          checkProject: async () => {
            throw new Error("boom");
          },
        },
        record,
      ),
    );
    expect(status).toBe(1);
    const value = envelope(record);
    expect(value.outcome).toBe("failure");
    expect(value.exitStatus).toBe(1);
    expect(value.failure?.category).toBe("compiler");
  });

  it("should keep human output unchanged without the flag", async () => {
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["check"], context({}, record))).toBe(0);
    expect(record.stdout.join("")).toContain("Check succeeded");
    expect(record.stdout.join("")).not.toContain("blend65.cli");
  });
});
