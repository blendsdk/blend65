import type {
  BuildOptions,
  BuildResult,
  CheckOptions,
  CheckResult,
  FailureCategory,
  RunOptions,
  RunResult,
} from "@blend65/compiler";
import { parseArguments } from "./args.js";
import { escapeTerminalText, renderDiagnostics, renderUsage } from "./render.js";

/** CLI package version, kept equal to the package manifest by executable qualification. */
const CLI_VERSION = "0.1.0";

/** Stable process statuses exposed by the Blend65 CLI. */
export type CliExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 130;

/** Caller-owned text destinations used by the command runner. */
export interface CommandOutput {
  /** Receive informational and success text. */
  readonly stdout: (text: string) => void;
  /** Receive usage errors, diagnostics and safe internal-error text. */
  readonly stderr: (text: string) => void;
}

/** Direct compiler-service dependencies used by command routing. */
export interface CommandServices {
  /** Run a fresh semantic compiler check. */
  readonly checkProject: (options?: CheckOptions) => Promise<CheckResult>;
  /** Build and publish one fresh immutable generation. */
  readonly buildProject: (options?: BuildOptions) => Promise<BuildResult>;
  /** Build and launch one fresh immutable generation. */
  readonly runProject: (options?: RunOptions) => Promise<RunResult>;
}

/** Complete invocation context supplied by the public CLI adapter. */
export interface CommandContext {
  /** Directory used for project discovery. */
  readonly cwd: string;
  /** Caller-owned text destinations. */
  readonly output: CommandOutput;
  /** Signal shared unchanged with the selected compiler service. */
  readonly signal: AbortSignal;
  /** Direct compiler services; no shell or command framework is involved. */
  readonly services: CommandServices;
}

const FAILURE_EXIT: Readonly<Record<FailureCategory, CliExitStatus>> = Object.freeze({
  source: 3,
  compiler: 4,
  assembler: 5,
  packaging: 6,
  "tool-discovery": 7,
  "emulator-start": 8,
  "emulator-runtime": 9,
  "recovery-required": 10,
  cancelled: 130,
});

/** Write diagnostics only when the service supplied at least one record. */
function writeDiagnostics(diagnostics: CheckResult["diagnostics"], output: CommandOutput): void {
  const rendered = renderDiagnostics(diagnostics);
  if (rendered.length > 0) output.stderr(rendered);
}

/** Add invocation-owned discovery and cancellation fields to parsed selections. */
function invocationOptions<T extends object>(
  options: T,
  context: CommandContext,
): T & { readonly cwd: string; readonly signal: AbortSignal } {
  return { ...options, cwd: context.cwd, signal: context.signal };
}

/**
 * Execute one validated command through its matching compiler service.
 * Expected failures remain typed results with stable exit statuses. Unexpected
 * exceptions are hidden behind status 1, while caller-owned output exceptions
 * still propagate to the caller.
 * @param argv Literal command-line arguments without executable names.
 * @param context Discovery, cancellation, output and compiler dependencies.
 * @returns The stable process status for the completed invocation.
 */
export async function executeCommand(
  argv: readonly string[],
  context: CommandContext,
): Promise<CliExitStatus> {
  const parsed = parseArguments(argv);
  if (parsed === null) {
    context.output.stderr(
      "error[CLI_INVALID_ARGUMENT]: Invalid command line arguments\n" + renderUsage(),
    );
    return 2;
  }
  if (parsed.kind === "help") {
    context.output.stdout(renderUsage());
    return 0;
  }
  if (parsed.kind === "version") {
    context.output.stdout(`blendc ${CLI_VERSION}\n`);
    return 0;
  }

  let result: CheckResult | BuildResult | RunResult;
  try {
    if (parsed.kind === "check") {
      result = await context.services.checkProject(invocationOptions(parsed.options, context));
    } else if (parsed.kind === "build") {
      result = await context.services.buildProject(invocationOptions(parsed.options, context));
    } else {
      result = await context.services.runProject(invocationOptions(parsed.options, context));
    }
  } catch {
    context.output.stderr("error[CLI_INTERNAL]: The command failed unexpectedly\n");
    return 1;
  }

  if (result.kind === "failure") {
    writeDiagnostics(result.diagnostics, context.output);
    return FAILURE_EXIT[result.category];
  }

  writeDiagnostics(result.diagnostics, context.output);
  if (parsed.kind === "check" && "snapshotSha256" in result) {
    context.output.stdout(
      `Check succeeded for ${escapeTerminalText(result.profileId)} (${escapeTerminalText(result.snapshotSha256)})\n`,
    );
  } else if (parsed.kind === "run" && "verification" in result) {
    context.output.stdout(
      `Run completed for generation ${escapeTerminalText(result.generation.generationId)} (${result.verification})\n`,
    );
  } else if ("generation" in result) {
    context.output.stdout(
      `Built generation ${escapeTerminalText(result.generation.generationId)} (${escapeTerminalText(result.generation.primaryArtifact)})\n`,
    );
  } else {
    context.output.stderr("error[CLI_INTERNAL]: The compiler returned an unexpected result\n");
    return 1;
  }
  return 0;
}
