/**
 * Public barrel for the Blend65 compiler-host abstraction.
 *
 * Re-exports the {@link CompilerHost} interface. Downstream packages import it
 * from `@blend65/core` (which re-exports this module) rather than reaching into
 * the file directly, mirroring the `report/` module precedent.
 */

export type { CompilerHost } from "./compiler-host.js";
export type { AssetReader, AssetReadResult } from "./asset-reader.js";
