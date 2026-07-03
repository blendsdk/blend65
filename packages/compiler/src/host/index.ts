/**
 * Public barrel for the compiler's disk-host module (RD-15 R12, AR-V9).
 *
 * Re-exports the {@link DiskCompilerHost} factory and its construction-options
 * type. Downstream consumers (the CLI, the facade) import from `@blend65/compiler`
 * rather than reaching into this file.
 */

export { createDiskCompilerHost, type DiskHostOptions } from "./disk-host.js";
