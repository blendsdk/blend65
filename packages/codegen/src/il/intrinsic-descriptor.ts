/**
 * The intrinsic descriptor carried by the IL `intrinsic` instruction.
 *
 * This module re-exports the canonical `IntrinsicDescriptor` type from
 * `@blend65/core`, whose `tier` is the `'T1'..'T4'` string union. The IL
 * `intrinsic` op's `descriptor` field carries the real descriptor, so
 * translate can dispatch on `tier`/`loweringStrategy`.
 */

export type { IntrinsicDescriptor } from "@blend65/core";
