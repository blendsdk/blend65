#!/usr/bin/env node
/**
 * The `blendc` executable (RD-15 §4.3, AR-V13).
 *
 * Wires the real process surface into {@link runCli} and assigns the returned code
 * to `process.exitCode` — never `process.exit()`, so stdout/stderr flush before the
 * process ends (AR-V13). This is the ONLY compile-path-adjacent file that touches
 * `process.stdout`/`stderr`; `@blend65/cli` is exempt from the AC-18 no-print rule
 * (it is THE package that prints, R4).
 */

import { hideBin } from "yargs/helpers";
import { runCli } from "./main.js";
import type { CliIo } from "./io.js";

/** The production {@link CliIo} backed by the real Node process. */
const realIo: CliIo = {
  writeOut(text: string): void {
    process.stdout.write(text);
  },
  writeErr(text: string): void {
    process.stderr.write(text);
  },
  isTTY: process.stdout.isTTY === true,
  env: process.env,
  cwd: process.cwd(),
};

void runCli(hideBin(process.argv), realIo).then((code) => {
  process.exitCode = code;
});
