import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildOptions, CheckOptions, RunOptions } from "@blend65/compiler";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeCommand } from "./run.js";
import type { CommandContext } from "./run.js";

const roots: string[] = [];

/** Create one isolated configuration root. */
async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "blend65-cli-tools-"));
  roots.push(value);
  return value;
}

/** Write a tools file at the platform-specific configuration location. */
async function writeConfig(base: string, text: string): Promise<void> {
  const directory = join(process.platform === "win32" ? join(base, "appdata") : base, "blend65");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "tools.jsonc"), text);
}

/** Point both supported configuration roots at the isolated test tree. */
function isolate(base: string): void {
  vi.stubEnv("XDG_CONFIG_HOME", base);
  vi.stubEnv("APPDATA", join(base, "appdata"));
}

/** Build one context with recording service stubs. */
function context(record: { stdout: string[]; stderr: string[] }): CommandContext {
  const success = {
    kind: "success" as const,
    generation: {
      generationId: "00000000-0000-4000-8000-000000000000",
      directory: "/project/out/00000000-0000-4000-8000-000000000000",
      buildJsonSha256: "a".repeat(64),
      primaryArtifact: "game.prg",
    },
    diagnostics: [],
    measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" as const },
  };
  return {
    cwd: "/project",
    signal: new AbortController().signal,
    output: {
      stdout: (text) => record.stdout.push(text),
      stderr: (text) => record.stderr.push(text),
    },
    services: {
      checkProject: async (_options?: CheckOptions) => ({
        kind: "success",
        snapshotSha256: "b".repeat(64),
        profileId: "c64-pal-prg-kernal-6581",
        diagnostics: [],
        measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" },
      }),
      buildProject: async (_options?: BuildOptions) => success,
      runProject: async (_options?: RunOptions) => ({
        ...success,
        status: "exited",
        verification: "interactive-unverified",
      }),
      readEvidence: async () => {
        throw new Error("not used");
      },
    },
  };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("CLI tools-file loading", () => {
  it("fails build before any service work when the tools file is invalid", async () => {
    const base = await root();
    isolate(base);
    await writeConfig(base, '{ "schemaVersion": 2 }');
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["build", "--project", "game"], context(record))).toBe(7);
    expect(record.stdout).toEqual([]);
    expect(record.stderr.join("")).toContain("TOOLS_CONFIG");
  });

  it("does not load the tools file for check", async () => {
    const base = await root();
    isolate(base);
    await writeConfig(base, '{ "schemaVersion": 2 }');
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["check", "--project", "game"], context(record))).toBe(0);
    expect(record.stdout.join("")).toContain("Check succeeded");
  });

  it("passes configured absolute paths to build and run", async () => {
    const base = await root();
    isolate(base);
    await writeConfig(
      base,
      '{ "schemaVersion": 1, "acmePath": "/usr/bin/acme", "x64scPath": "/opt/vice/x64sc" }',
    );
    const seen: RunOptions[] = [];
    const record = { stdout: [] as string[], stderr: [] as string[] };
    const baseContext = context(record);
    const invoked: CommandContext = {
      ...baseContext,
      services: {
        ...baseContext.services,
        runProject: async (options?: RunOptions) => {
          seen.push(options ?? {});
          return {
            kind: "success",
            generation: {
              generationId: "00000000-0000-4000-8000-000000000000",
              directory: "/project/out/00000000-0000-4000-8000-000000000000",
              buildJsonSha256: "a".repeat(64),
              primaryArtifact: "game.prg",
            },
            status: "exited",
            verification: "interactive-unverified",
            diagnostics: [],
            measurements: { durationMilliseconds: 1, peakRssBytes: "Unknown" },
          };
        },
      },
    };
    expect(await executeCommand(["run", "--project", "game"], invoked)).toBe(0);
    expect(seen[0]).toMatchObject({
      project: "game",
      acmePath: "/usr/bin/acme",
      x64scPath: "/opt/vice/x64sc",
    });
  });

  it("reports an invalid tools file through the JSON envelope", async () => {
    const base = await root();
    isolate(base);
    await writeConfig(base, '{ "schemaVersion": 2 }');
    const record = { stdout: [] as string[], stderr: [] as string[] };
    expect(await executeCommand(["build", "--project", "game", "--json"], context(record))).toBe(7);
    const value = JSON.parse(record.stdout[0]!) as {
      outcome: string;
      failure: { category: string };
      exitStatus: number;
    };
    expect(value.outcome).toBe("diagnostics");
    expect(value.failure.category).toBe("tool-discovery");
    expect(value.exitStatus).toBe(7);
  });
});
