/**
 * Blend65 CLI
 *
 * Command-line interface for the Blend65 compiler.
 *
 * **Commands:**
 * - `blend65 build` - Compile source files to .prg and .asm
 * - `blend65 check` - Check syntax and types without generating output
 * - `blend65 init` - Initialize a new Blend65 project
 * - `blend65 watch` - Watch files and rebuild on change
 *
 * **Usage:**
 * ```bash
 * blend65 build src/main.blend -o build/
 * blend65 check src/**\/*.blend
 * blend65 init my-game
 * ```
 *
 * @packageDocumentation
 * @module @blend65/cli
 */

import { Blend65CLI } from './cli.js';

// Re-export public API
export { Blend65CLI } from './cli.js';
export { ExitCode } from './utils/exit-codes.js';
export * from './commands/index.js';
export * from './output/index.js';

/**
 * Main entry point for the CLI
 *
 * Called from bin/blend65.js with command-line arguments.
 *
 * @param args - Command-line arguments (without node and script name)
 */
export async function main(args: string[]): Promise<void> {
  const cli = new Blend65CLI();
  const exitCode = await cli.run(args);
  process.exit(exitCode);
}