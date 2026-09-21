import type { BuildResult, CheckResult, RunResult } from "@blend65/compiler";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  checkProject: vi.fn(),
  buildProject: vi.fn(),
  runProject: vi.fn(),
}));

vi.mock("@blend65/compiler", () => serviceMocks);

import { runCli } from "./main.js";

const MEASUREMENTS = Object.freeze({ durationMilliseconds: 1, peakRssBytes: 1024 });
const GENERATION = Object.freeze({
  generationId: "11111111-1111-4111-8111-111111111111",
  directory: "/project/out/generations/11111111-1111-4111-8111-111111111111",
  buildJsonSha256: "0".repeat(64),
  primaryArtifact: "game.prg",
});
const CHECK_SUCCESS = Object.freeze({
  kind: "success",
  snapshotSha256: "1".repeat(64),
  profileId: "c64-pal-prg-kernal-6581",
  diagnostics: Object.freeze([]),
  measurements: MEASUREMENTS,
}) satisfies CheckResult;
const BUILD_SUCCESS = Object.freeze({
  kind: "success",
  generation: GENERATION,
  diagnostics: Object.freeze([]),
  measurements: MEASUREMENTS,
}) satisfies BuildResult;
const RUN_SUCCESS = Object.freeze({
  kind: "success",
  generation: GENERATION,
  status: "exited",
  verification: "interactive-unverified",
  diagnostics: Object.freeze([]),
  measurements: MEASUREMENTS,
}) satisfies RunResult;

/** Capture one public adapter invocation without replacing its command parser. */
async function invoke(argv: readonly string[], signal = new AbortController().signal) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runCli(
    argv,
    { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    "/project",
    signal,
  );
  return { status, stdout: stdout.join(""), stderr: stderr.join("") };
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.checkProject.mockResolvedValue(CHECK_SUCCESS);
  serviceMocks.buildProject.mockResolvedValue(BUILD_SUCCESS);
  serviceMocks.runProject.mockResolvedValue(RUN_SUCCESS);
});

describe("public CLI adapter", () => {
  // Help and version are truthful informational operations with no compiler work.
  it.each(["--help", "-h", "--version", "-v"])(
    "should handle %s without calling compiler services",
    async (flag) => {
      const result = await invoke([flag]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).not.toMatch(/not implemented/iu);
      expect(result.stdout.trim().length).toBeGreaterThan(0);
      expect(serviceMocks.checkProject).not.toHaveBeenCalled();
      expect(serviceMocks.buildProject).not.toHaveBeenCalled();
      expect(serviceMocks.runProject).not.toHaveBeenCalled();
    },
  );

  // Each accepted command reaches only its matching direct compiler service.
  it("should route check, build, and run through the public adapter", async () => {
    expect((await invoke(["check"])).status).toBe(0);
    expect((await invoke(["build"])).status).toBe(0);
    expect((await invoke(["run"])).status).toBe(0);

    expect(serviceMocks.checkProject).toHaveBeenCalledOnce();
    expect(serviceMocks.buildProject).toHaveBeenCalledOnce();
    expect(serviceMocks.runProject).toHaveBeenCalledOnce();
  });

  // Invocation-owned cwd and cancellation identity pass through unchanged.
  it("should pass exact project selections and the caller signal", async () => {
    const controller = new AbortController();
    const result = await invoke(
      ["check", "--project", "game/blend65.json", "--entry", "Game.Main"],
      controller.signal,
    );

    expect(result.status).toBe(0);
    expect(serviceMocks.checkProject).toHaveBeenCalledWith({
      cwd: "/project",
      project: "game/blend65.json",
      entry: "Game.Main",
      signal: controller.signal,
    });
  });

  // Invalid invocations stop before compiler work and retain the usage status.
  it.each([[[]], [["unknown"]], [["check", "--optimization", "none"]]])(
    "should reject invalid invocation %j before compiler work",
    async (argv) => {
      const result = await invoke(argv);

      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CLI_INVALID_ARGUMENT");
      expect(serviceMocks.checkProject).not.toHaveBeenCalled();
      expect(serviceMocks.buildProject).not.toHaveBeenCalled();
      expect(serviceMocks.runProject).not.toHaveBeenCalled();
    },
  );
});
