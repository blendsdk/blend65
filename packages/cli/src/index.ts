/**
 * Public barrel for `@blend65/cli`.
 *
 * Exports the testable {@link runCli} entry point, the {@link CliIo} injection
 * surface, and the {@link VERSION} constant. The `blendc` executable lives in
 * `bin.ts` (the package `bin` target); everything else here is the programmatic
 * surface tests and embedders consume.
 */

export { runCli } from "./main.js";
export type { CliIo } from "./io.js";
export { VERSION } from "./version.js";
