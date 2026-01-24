/**
 * Exit Codes
 *
 * Standard exit codes for the Blend65 CLI.
 * Following common Unix conventions.
 *
 * @module utils/exit-codes
 */

/**
 * CLI exit codes
 *
 * | Code | Meaning |
 * |------|---------|
 * | 0 | Success |
 * | 1 | Compilation error (syntax, type, etc.) |
 * | 2 | Configuration error |
 * | 3 | File not found |
 * | 4 | Emulator error |
 * | 5 | Internal error |
 */
export const ExitCode = {
  /** Compilation succeeded */
  SUCCESS: 0,

  /** Compilation failed (syntax error, type error, etc.) */
  COMPILATION_ERROR: 1,

  /** Configuration error (invalid blend65.json, bad options) */
  CONFIG_ERROR: 2,

  /** Source file not found */
  FILE_NOT_FOUND: 3,

  /** Emulator error (failed to launch, crashed) */
  EMULATOR_ERROR: 4,

  /** Internal compiler error (unexpected exception) */
  INTERNAL_ERROR: 5,
} as const;

/** Exit code type */
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];