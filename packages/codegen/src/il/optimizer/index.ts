/**
 * Public barrel for the RD-06 IL optimizer pipeline (`il/optimizer/`).
 *
 * Re-exports the {@link ILPass} contract and the {@link optimizeIL} runner. v1
 * ships no concrete passes (D1); the real passes (constant folding, DCE,
 * strength reduction) are added here as they land.
 */

export type { ILPass } from "./pass.js";
export { optimizeIL } from "./optimize-il.js";
