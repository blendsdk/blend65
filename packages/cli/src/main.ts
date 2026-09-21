import { buildProject, checkProject, runProject } from "@blend65/compiler";
import { executeCommand } from "./run.js";
import type { CliExitStatus, CommandOutput, CommandServices } from "./run.js";

/** Public text-output contract for embedding the CLI adapter. */
export type CliOutput = CommandOutput;

const COMPILER_SERVICES: CommandServices = Object.freeze({
  checkProject,
  buildProject,
  runProject,
});

/**
 * Run one Blend65 CLI invocation through the public compiler services.
 * The function owns no process listeners or streams, so applications may embed
 * it with their own output and cancellation lifecycle.
 * @param argv Literal arguments after executable and script names.
 * @param output Caller-owned text destinations.
 * @param cwd Directory used for project discovery.
 * @param signal Caller-owned cancellation signal.
 * @returns The stable process status for the completed invocation.
 * @example
 * const controller = new AbortController();
 * const status = await runCli(
 *   ["check"],
 *   { stdout: console.log, stderr: console.error },
 *   process.cwd(),
 *   controller.signal,
 * );
 */
export async function runCli(
  argv: readonly string[],
  output: CliOutput,
  cwd: string = process.cwd(),
  signal: AbortSignal = new AbortController().signal,
): Promise<CliExitStatus> {
  return executeCommand(argv, { cwd, output, signal, services: COMPILER_SERVICES });
}
