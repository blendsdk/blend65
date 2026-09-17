#!/usr/bin/env node
import { runCli } from "./main.js";

// Exit naturally so piped output can drain; unexpected failures never expose host stacks.
try {
  process.exitCode = await runCli(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
} catch {
  process.stderr.write("error: Project loading failed unexpectedly\n");
  process.exitCode = 1;
}
