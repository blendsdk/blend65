/**
 * Re-export shim — the 6502 addressing-mode model now lives in `@blend65/core`.
 * Preserves the historical `./addressing-mode.js` import path so existing code
 * and tests resolve unchanged **by value**.
 *
 * Definitions moved to `@blend65/core/instr-model/addressing-mode.ts` (surfaced
 * via the `@blend65/core/platform` subpath).
 */

export type { AddressingMode } from "@blend65/core/platform";
export { ADDRESSING_MODES } from "@blend65/core/platform";
