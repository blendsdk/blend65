/**
 * Public barrel for the Blend65 compiler-host abstraction (RD-15 R14).
 *
 * Re-exports the {@link CompilerHost} interface. Downstream packages import it
 * from `@blend65/core` (which re-exports this module) rather than reaching into
 * the file directly (AR-V9; mirrors the `report/` module precedent).
 */

export type { CompilerHost } from "./compiler-host.js";
