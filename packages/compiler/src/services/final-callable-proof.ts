import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import { bindingLabel } from "../machine/lower-control.js";
import { finalPlacementProof } from "../semantic/final-placement-proof.js";
import type { FinalPlacementProof } from "../semantic/final-placement-proof.js";
import type { PlacedRange } from "../semantic/raw-write-kills.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { TargetProfile } from "../target/profile.js";

/** Complete layout of one representation, after its storage closed for the last time. */
type CompleteLayout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Absolute intervals of the materialized globals, or a producer disagreement. */
export type FinalGlobalRanges =
  | {
      /** Every materialized global was matched to exactly one placed interval. */
      readonly kind: "complete";
      /** Half-open absolute intervals keyed by source binding identity. */
      readonly ranges: ReadonlyMap<string, PlacedRange>;
    }
  | {
      /** Data lowering and layout disagree, which no source change can repair. */
      readonly kind: "invariant";
      /** Plain description of the disagreement for an internal failure. */
      readonly reason: string;
    };

/**
 * Join each source global to the bytes the selected layout actually gave it.
 *
 * Data lowering decides which globals are materialized at all, so a global its
 * output does not contain simply has no storage to write over. A global it does
 * contain must be placed exactly once at its declared size; anything else means
 * the two producers disagree and no interval may be assumed.
 * @param program Closed whole program whose globals are being placed.
 * @param layout Complete layout and the exact machine program it placed.
 * @returns Absolute half-open intervals, or the producer disagreement found.
 * @example projectFinalGlobalRanges(program, shared.layout)
 */
export function projectFinalGlobalRanges(
  program: WholeProgram,
  layout: CompleteLayout,
): FinalGlobalRanges {
  const materialized = new Set(layout.program.data.map(({ id }) => id));
  const wanted = new Set(
    program.semantic.globals.map((global) => bindingLabel("global", global.id)),
  );
  const placed = new Map<string, { readonly start: number; readonly end: number }>();
  for (const interval of layout.intervals) {
    if (!wanted.has(interval.id)) continue;
    if (placed.has(interval.id))
      return { kind: "invariant", reason: `Layout placed '${interval.id}' more than once` };
    placed.set(interval.id, { start: interval.start, end: interval.end });
  }
  const ranges = new Map<string, PlacedRange>();
  for (const global of program.semantic.globals) {
    const label = bindingLabel("global", global.id);
    // A global of no bytes occupies nothing, and layout places no interval for it.
    const size = semanticTypeSize(global.type);
    if (size === 0) continue;
    if (!materialized.has(label)) {
      if (placed.has(label))
        return {
          kind: "invariant",
          reason: `Global '${label}' is placed although it was never materialized`,
        };
      continue;
    }
    const interval = placed.get(label);
    if (interval === undefined)
      return { kind: "invariant", reason: `Materialized global '${label}' has no placed interval` };
    // Layout keeps an inclusive last address; the byte analysis is half-open.
    const start = interval.start;
    const end = interval.end + 1;
    if (end - start !== size)
      return {
        kind: "invariant",
        reason: `Global '${label}' occupies ${end - start} bytes but its type needs ${size}`,
      };
    ranges.set(bindingIdentityKey(global.id), Object.freeze({ start, end }));
  }
  return { kind: "complete", ranges: ranges };
}

/**
 * Prove that one representation's calls survive the addresses it actually chose.
 *
 * Checking happens per representation because each one may place its globals
 * differently; a result proved for another layout says nothing about this one.
 * @param program Closed whole program belonging to this representation.
 * @param profile Selected target profile, for its interrupt sink capabilities.
 * @param layout Complete layout and the machine program it placed.
 * @returns Validity, the source errors that prevent publication, or a producer fault.
 * @example validateFinalCallableProof(checked.program, checked.profile, shared.layout)
 */
export function validateFinalCallableProof(
  program: WholeProgram,
  profile: TargetProfile,
  layout: CompleteLayout,
): FinalPlacementProof {
  const projection = projectFinalGlobalRanges(program, layout);
  if (projection.kind === "invariant") return projection;
  return finalPlacementProof(
    program,
    projection.ranges,
    new Set(profile.interrupts?.sinks.map(({ capability }) => capability) ?? []),
  );
}
