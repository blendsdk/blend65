/**
 * Blend65 CLI Class
 *
 * Main CLI orchestrator using yargs for command parsing.
 *
 * **Commands:**
 * - `build` - Compile source files to assembly and binary
 * - `check` - Check syntax and types without generating output
 *
 * **Usage:**
 * ```typescript
 * const cli = new Blend65CLI();
 * const exitCode = await cli.run(['build', 'src/main.blend']);
 * ```
 *
 * @module cli
 */

import yargs from 'yargs';
import chalk from 'chalk';

import { buildCommand } from './commands/build.js';
import { checkCommand } from './commands/check.js';
import { ExitCode } from './utils/exit-codes.js';

/**
 * Main CLI class
 *
 * Orchestrates command parsing and execution using yargs.
 * Provides a clean API for programmatic CLI invocation.
 *
 * @example
 * ```typescript
 * import { Blend65CLI } from '@blend65/cli';
 *
 * const cli = new Blend65CLI();
 * const exitCode = await cli.run(process.argv.slice(2));
 * process.exit(exitCode);
 * ```
 */
export class Blend65CLI {
  /**
   * Run the CLI with given arguments
   *
   * Parses arguments using yargs and executes the appropriate command.
   * Returns an exit code indicating success or failure.
   *
   * @param args - Command-line arguments (without node and script name)
   * @returns Exit code (0 = success)
   */
  async run(args: string[]): Promise<number> {
    try {
      await yargs(args)
        .scriptName('blend65')
        .usage('$0 <command> [options]')

        // Version and help
        .version()
        .alias('version', 'V')
        .help('help')
        .alias('help', 'h')

        // Global options
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Path to blend65.json config file',
          default: 'blend65.json',
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Enable verbose output',
          default: false,
        })

        // Commands
        .command(buildCommand)
        .command(checkCommand)

        // Require a command
        .demandCommand(1, 'You must specify a command. Run "blend65 --help" for usage.')

        // Show help on error
        .showHelpOnFail(true)

        // Strict mode (fail on unknown options)
        .strict()

        // Handle errors gracefully
        .fail((msg, err, yargsInstance) => {
          if (err) {
            // Unexpected error
            console.error(chalk.red('Error:'), err.message);
            if (process.env.DEBUG) {
              console.error(err.stack);
            }
          } else if (msg) {
            // Yargs validation error
            console.error(chalk.red('Error:'), msg);
            console.log();
            yargsInstance.showHelp();
          }
          process.exitCode = ExitCode.CONFIG_ERROR;
        })

        // Parse and execute
        .parse();

      // Return the exit code set by command handlers
      return (typeof process.exitCode === 'number' ? process.exitCode : ExitCode.SUCCESS);
    } catch (error) {
      // Unexpected top-level error
      console.error(chalk.red('Unexpected error:'), error);
      return ExitCode.INTERNAL_ERROR;
    }
  }
}