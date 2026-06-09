/**
 * Re-export shim — the 6502 opcode model now lives in `@blend65/core` (RD-10
 * D7/D8). This file preserves the historical `./opcode.js` import path used
 * across `instr/` so RD-07a/07b code and tests resolve unchanged **by value**.
 *
 * The definitions moved to `@blend65/core/instr-model/opcode.ts` (surfaced via
 * the `@blend65/core/platform` subpath) so the platform plugin interface, which
 * lives in core, can reference the model without a core→codegen dependency.
 */

export type { Opcode } from "@blend65/core/platform";
export { OPCODES, NMOS_OPCODES, W65C02_OPCODES } from "@blend65/core/platform";
