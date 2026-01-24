/**
 * Command Types
 *
 * Shared type definitions for CLI commands.
 *
 * @module commands/types
 */

/**
 * Global options available to all commands
 */
export interface GlobalOptions {
  /** Path to blend65.json config file */
  project: string;

  /** Enable verbose output */
  verbose: boolean;
}