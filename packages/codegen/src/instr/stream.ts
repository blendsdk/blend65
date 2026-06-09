/**
 * Re-export shim — the instruction-stream model (`CpuVariant`, `AcmeDirective`,
 * `StreamEntry`, `InstrStream` + constructors/guards) now lives in
 * `@blend65/core` (RD-10 D7/D8). Preserves the historical `./stream.js` import
 * path used throughout `instr/` so RD-07a/07b code and tests resolve unchanged
 * **by value** — only the definition site moved.
 *
 * Definitions moved to `@blend65/core/instr-model/{cpu-variant,stream}.ts`
 * (surfaced via the `@blend65/core/platform` subpath) so the platform plugin
 * interface, which lives in core, can reference `StreamEntry`/`AcmeDirective`
 * without a core→codegen dependency.
 */

export type {
  CpuVariant,
  AcmeDirective,
  StreamEntry,
  InstrStream,
} from "@blend65/core/platform";
export { instr, label, directive, isInstr, isLabel, isDirective } from "@blend65/core/platform";
