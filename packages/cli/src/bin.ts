#!/usr/bin/env node
import { runCli } from "./main.js";

const controller = new AbortController();

/** Convert either owned termination signal into service cancellation. */
function abortCommand(): void {
  controller.abort();
}

process.once("SIGINT", abortCommand);
process.once("SIGTERM", abortCommand);

try {
  process.exitCode = await runCli(
    process.argv.slice(2),
    {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    },
    process.cwd(),
    controller.signal,
  );
} catch {
  process.stderr.write("error[CLI_INTERNAL]: The command failed unexpectedly\n");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", abortCommand);
  process.removeListener("SIGTERM", abortCommand);
}
