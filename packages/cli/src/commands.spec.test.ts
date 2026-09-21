import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  BuildOptions,
  BuildResult,
  CheckOptions,
  CheckResult,
  FailureCategory,
  RunOptions,
  RunResult,
  ServiceFailure,
} from "@blend65/compiler";
import type { CliExitStatus, CommandContext, CommandServices } from "./run.js";

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
const FAILURE_EXITS = [
  ["source", 3],
  ["compiler", 4],
  ["assembler", 5],
  ["packaging", 6],
  ["tool-discovery", 7],
  ["emulator-start", 8],
  ["emulator-runtime", 9],
  ["recovery-required", 10],
  ["cancelled", 130],
] as const satisfies readonly (readonly [FailureCategory, CliExitStatus])[];

interface CapturedOutput {
  readonly stdout: string[];
  readonly stderr: string[];
}

/** Execute the co-located command seam while preserving a missing module as behavioral red. */
async function execute(argv: readonly string[], context: CommandContext): Promise<CliExitStatus> {
  const run = await import("./run.js");
  return run.executeCommand(argv, context);
}

/** Create a complete direct service set with no process or shell indirection. */
function successfulServices(overrides: Partial<CommandServices> = {}): CommandServices {
  return {
    checkProject: async () => CHECK_SUCCESS,
    buildProject: async () => BUILD_SUCCESS,
    runProject: async () => RUN_SUCCESS,
    ...overrides,
  };
}

/** Capture human output as complete sink writes. */
function commandContext(
  services: CommandServices = successfulServices(),
  signal: AbortSignal = new AbortController().signal,
): { readonly context: CommandContext; readonly output: CapturedOutput } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    context: {
      cwd: "/project",
      signal,
      services,
      output: {
        stdout: (text) => stdout.push(text),
        stderr: (text) => stderr.push(text),
      },
    },
    output: { stdout, stderr },
  };
}

/** Produce one safe diagnostic so failures also prove human rendering. */
function failure(category: FailureCategory): ServiceFailure {
  return {
    kind: "failure",
    category,
    diagnostics: [
      {
        code: "E10001",
        severity: "error",
        message: "The project could not be processed",
        primarySpan: null,
        related: [],
        help: null,
        pointer: null,
      },
    ],
  };
}

describe("command routing and output", () => {
  // Each command calls only its matching compiler service and emits one concise success summary.
  it("should route check, build, and run directly to their matching services", async () => {
    const calls: string[] = [];
    const services = successfulServices({
      checkProject: async () => {
        calls.push("check");
        return CHECK_SUCCESS;
      },
      buildProject: async () => {
        calls.push("build");
        return BUILD_SUCCESS;
      },
      runProject: async () => {
        calls.push("run");
        return RUN_SUCCESS;
      },
    });

    for (const command of ["check", "build", "run"] as const) {
      const { context, output } = commandContext(services);
      expect(await execute([command], context)).toBe(0);
      expect(output.stdout).toHaveLength(1);
      expect(output.stdout[0]?.trim().length).toBeGreaterThan(0);
      expect(output.stderr).toEqual([]);
    }
    expect(calls).toEqual(["check", "build", "run"]);
  });

  // Every public failure has one stable numeric process status and renders its diagnostic.
  it.each(FAILURE_EXITS)("should map %s failures to exit status %i", async (category, status) => {
    const services = successfulServices({ checkProject: async () => failure(category) });
    const { context, output } = commandContext(services);

    expect(await execute(["check"], context)).toBe(status);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join("\n")).toContain("The project could not be processed");
  });

  // Help and version are successful informational requests and never start compiler work.
  it.each(["--help", "--version"])("should handle %s without calling a service", async (flag) => {
    let called = false;
    const services = successfulServices({
      checkProject: async () => {
        called = true;
        return CHECK_SUCCESS;
      },
    });
    const { context, output } = commandContext(services);

    expect(await execute([flag], context)).toBe(0);
    expect(called).toBe(false);
    expect(output.stdout.join("").trim().length).toBeGreaterThan(0);
    expect(output.stderr).toEqual([]);
  });

  // Unexpected programmer failures remain internal while retaining their reserved exit status.
  it("should map an unexpected service exception to the internal-error status", async () => {
    const services = successfulServices({
      checkProject: async () => {
        throw new Error("private implementation detail");
      },
    });
    const { context, output } = commandContext(services);

    expect(await execute(["check"], context)).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join("\n")).not.toContain("private implementation detail");
  });
});

describe("command options and cancellation", () => {
  // Discovery and build selections reach the service as exact typed values plus the shared signal.
  it("should pass every valid build option as data", async () => {
    let received: BuildOptions | undefined;
    const controller = new AbortController();
    const services = successfulServices({
      buildProject: async (options) => {
        received = options;
        return BUILD_SUCCESS;
      },
    });
    const { context } = commandContext(services, controller.signal);

    expect(
      await execute(
        [
          "build",
          "--project",
          "games/demo/blend65.json",
          "--target",
          "c64-pal-prg-kernal-6581",
          "--entry",
          "Game.Main",
          "--optimization",
          "none",
          "--bounds-check",
          "true",
          "--division-zero-check",
          "false",
        ],
        context,
      ),
    ).toBe(0);
    expect(received).toEqual({
      cwd: "/project",
      project: "games/demo/blend65.json",
      target: "c64-pal-prg-kernal-6581",
      entry: "Game.Main",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: false,
      signal: controller.signal,
    });
  });

  // Check accepts only project discovery selections and rejects build-only switches.
  it("should pass valid check selections and reject build-only options", async () => {
    let received: CheckOptions | undefined;
    const services = successfulServices({
      checkProject: async (options) => {
        received = options;
        return CHECK_SUCCESS;
      },
    });
    const accepted = commandContext(services);
    expect(
      await execute(
        [
          "check",
          "--project",
          "blend65.json",
          "--target",
          "c64-pal-prg-kernal-6581",
          "--entry",
          "Game",
        ],
        accepted.context,
      ),
    ).toBe(0);
    expect(received).toMatchObject({
      cwd: "/project",
      project: "blend65.json",
      target: "c64-pal-prg-kernal-6581",
      entry: "Game",
    });

    received = undefined;
    const rejected = commandContext(services);
    expect(await execute(["check", "--optimization", "none"], rejected.context)).toBe(2);
    expect(received).toBeUndefined();
  });

  // Unknown, duplicate, incomplete, malformed, and positional inputs fail before any service call.
  it.each([
    [],
    ["unknown"],
    ["build", "extra"],
    ["build", "--unknown", "value"],
    ["build", "--project"],
    ["build", "--project", "one", "--project", "two"],
    ["build", "--optimization", "speed"],
    ["build", "--bounds-check", "yes"],
    ["run", "--division-zero-check", "0"],
  ])("should reject invalid arguments %#", async (...argv) => {
    let called = false;
    const services = successfulServices({
      buildProject: async () => {
        called = true;
        return BUILD_SUCCESS;
      },
    });
    const { context, output } = commandContext(services);

    expect(await execute(argv, context)).toBe(2);
    expect(called).toBe(false);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join("").trim().length).toBeGreaterThan(0);
  });

  // Option values remain inert data even when they contain familiar shell syntax.
  it("should never execute an unsafe-looking project value", async () => {
    const marker = join(process.cwd(), "blend65-cli-shell-marker");
    const project = `$(touch ${marker})`;
    let received: BuildOptions | undefined;
    const services = successfulServices({
      buildProject: async (options) => {
        received = options;
        return BUILD_SUCCESS;
      },
    });
    const { context } = commandContext(services);

    expect(await execute(["build", "--project", project], context)).toBe(0);
    expect(received?.project).toBe(project);
    await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  // Abort reaches the selected service unchanged, and the command waits for service cleanup.
  it("should wait for cancellation cleanup and return the signal status", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    let cleanupFinished = false;
    let reportServiceStarted: (() => void) | undefined;
    const serviceStarted = new Promise<void>((resolve) => {
      reportServiceStarted = resolve;
    });
    const services = successfulServices({
      runProject: async (options?: RunOptions): Promise<RunResult> => {
        observedSignal = options?.signal;
        reportServiceStarted?.();
        await new Promise<void>((resolve) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              cleanupFinished = true;
              resolve();
            },
            { once: true },
          );
        });
        return failure("cancelled");
      },
    });
    const { context } = commandContext(services, controller.signal);
    const pending = execute(["run"], context);
    await serviceStarted;
    controller.abort();

    expect(await pending).toBe(130);
    expect(observedSignal).toBe(controller.signal);
    expect(cleanupFinished).toBe(true);
  });
});
