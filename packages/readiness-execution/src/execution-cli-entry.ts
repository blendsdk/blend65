import { runReadinessExecutionCliV1 } from "./execution-readiness-cli.js";

process.exitCode = await runReadinessExecutionCliV1(process.argv.slice(2), {
  cwd: process.cwd(),
  writeOut: (text) => process.stdout.write(text),
  writeErr: (text) => process.stderr.write(text),
});
