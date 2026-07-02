/**
 * The intrinsic descriptor carried by the IL `intrinsic` instruction (RD-06 §4.3,
 * R26) — now the authoritative RD-17 type.
 *
 * RD-06 shipped a minimal structural placeholder (`{ name, tier?: number,
 * clobbers? }`) so the IL model was total before the taxonomy existed. RD-17
 * (§4.1, PF-010) supersedes it: this module re-exports the canonical
 * `IntrinsicDescriptor` from `@blend65/core`, whose `tier` is the `'T1'..'T4'`
 * string union. The IL `intrinsic` op's `descriptor` field carries the real
 * descriptor, so translate can dispatch on `tier`/`loweringStrategy`.
 */

export type { IntrinsicDescriptor } from "@blend65/core";
