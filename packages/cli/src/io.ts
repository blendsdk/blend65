/**
 * The injectable process surface for `blendc`.
 *
 * `runCli` takes a {@link CliIo} instead of touching `process` directly, so tests
 * capture stdout/stderr and pin `isTTY`/`env`/`cwd` (and inject fake build deps).
 * In its own module so `main`/`render`/`args` share it without an import cycle.
 */

import type { BuildDeps } from "@blend65/compiler";

/** The process I/O surface the CLI writes through (the test seam). */
export interface CliIo {
  /** Write to stdout (build summary / JSON report). */
  writeOut(text: string): void;
  /** Write to stderr (diagnostics / trailer / usage errors). */
  writeErr(text: string): void;
  /** Whether stdout is a TTY (drives default color). */
  isTTY: boolean;
  /** The process environment (checked for `NO_COLOR`). */
  env: Record<string, string | undefined>;
  /** The working directory (config discovery + relative-path base → `options.cwd`). */
  cwd: string;
  /** Optional build-deps override for tests; production uses the facade default. */
  buildDeps?: BuildDeps;
}
