/**
 * Public barrel for the NMOS 6502 timing table (`timing/`).
 *
 * Pure data + lookup: documented instruction cost (bytes, base cycles,
 * page-cross and branch-taken penalties) keyed by the instr-model opcode and
 * addressing-mode types. Surfaced to other packages through the
 * `@blend65/core/platform` subpath — the same barrel that carries the
 * opcode/mode types the table is keyed by.
 */

export type { InstrTiming, NmosOpcode } from "./nmos-table.js";
export { getTiming } from "./nmos-table.js";
