import { BUILD_INFO, loadProject } from "@blend65/compiler";
import { parseArguments } from "./args.js";
import { displayProjectName, renderDiagnostics } from "./render.js";

/** Explicit text sinks keep the library adapter testable without replacing project loading. */
export interface CliOutput {
  /** Receive informational/help/success text, including its newline. */
  readonly stdout: (text: string) => void;
  /** Receive invocation/project diagnostics and successful host observations. */
  readonly stderr: (text: string) => void;
}

/** Describe only the implemented load operation; no future command claims are made. */
const USAGE =
  "Usage: blendc [--project PATH] [--target PROFILE] [--entry MODULE]\n" +
  "       blendc --help (-h) | --version (-v)\n" +
  "Loads a project snapshot. Compilation is not implemented.\n";

/**
 * Run the load-only CLI using the compiler's public project service.
 * Invalid invocation is rejected before any project read. Expected host/project
 * errors return status 1; caller-owned output errors propagate to the caller.
 * This operation never compiles, starts tools or creates output directories.
 * @param argv Literal arguments after the executable/script names.
 * @param output Text sinks; this function does not own a process or stream.
 * @param cwd Native discovery directory, defaulting to process.cwd().
 * @returns 0 for load/help/version, 1 for project failure, 2 for invocation failure.
 * @example await runCli(["--help"], { stdout: console.log, stderr: console.error });
 */
export async function runCli(
  argv: readonly string[],
  output: CliOutput,
  cwd: string = process.cwd(),
): Promise<0 | 1 | 2> {
  const arguments_ = parseArguments(argv, cwd);
  if (arguments_ === null) {
    output.stderr("error[CLI_INVALID_ARGUMENT]: Invalid command line arguments\n" + USAGE);
    return 2;
  }
  if (arguments_.help) {
    output.stdout(USAGE);
    return 0;
  }
  if (arguments_.version) {
    output.stdout(`blendc ${BUILD_INFO.version}\n`);
    return 0;
  }
  const result = await loadProject(arguments_.options);
  if (result.kind === "failure") {
    output.stderr(renderDiagnostics(result.diagnostics));
    return 1;
  }
  if (result.observations.length > 0) output.stderr(renderDiagnostics(result.observations));
  output.stdout(
    `Project '${displayProjectName(result.snapshot.manifest.name)}' loaded ` +
      `(${result.snapshot.sources.length} source files); no compilation performed\n`,
  );
  return 0;
}
