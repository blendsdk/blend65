/**
 * Public barrel for the IL optimizer pipeline (`il/optimizer/`).
 *
 * Re-exports the {@link ILPass} contract and the {@link optimizeIL} runner. v1
 * ships no concrete passes; the real passes (constant folding, DCE,
 * strength reduction) are added here as they land.
 */

export type { ILPass } from "./pass.js";
export { optimizeIL } from "./optimize-il.js";
