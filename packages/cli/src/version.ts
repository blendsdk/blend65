/**
 * The `blendc` version string (AR-V15).
 *
 * Kept in its own module so `args.ts` (the yargs `.version()` source) and the
 * package barrel both reference one constant without an import cycle. Synced to
 * the package manifest.
 */
export const VERSION = "0.1.0";
