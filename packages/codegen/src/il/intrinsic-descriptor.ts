/**
 * Minimal placeholder for the intrinsic descriptor referenced by the IL
 * `intrinsic` instruction (RD-06 §4.3, R26).
 *
 * The authoritative descriptor — clobber sets, tier classification, calling
 * convention, runtime-ABI details — is owned by RD-17 and does not exist yet.
 * To keep the IL model *complete* (D1: the full instruction set is built up
 * front), the `intrinsic` instruction references this structural placeholder.
 * RD-17 will supersede it **additively** (adding fields, not removing them), so
 * code written against this minimal shape stays valid.
 *
 * v1 lowering emits **no** `intrinsic` instructions — `poke`/`peek` lower to
 * `store`/`load` (R46) — so this type exists only so the union is total today.
 */

/**
 * A by-name handle to a compiler intrinsic (placeholder; RD-17 supersedes).
 *
 * @remarks Only `name` is required in v1. `tier` and `clobbers` are optional
 * forward-looking fields RD-17 will populate; they are declared now so the
 * field set only ever grows.
 */
export interface IntrinsicDescriptor {
  /** The intrinsic's canonical name (e.g. `"poke"`, `"peek"`). */
  readonly name: string;
  /** Optional tier/classification placeholder — RD-17 defines the taxonomy. */
  readonly tier?: number;
  /** Optional clobbered-register/zero-page hints — RD-17 defines the format. */
  readonly clobbers?: readonly string[];
}
