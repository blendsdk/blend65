import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import { bindingLabel } from "../machine/lower-control.js";
import { callablePaths } from "../semantic/callable-paths.js";
import { finalPlacementProof } from "../semantic/final-placement-proof.js";
import type { FinalPlacementProof, StorageDescriptor } from "../semantic/final-placement-proof.js";
import type { PlacedRange } from "../semantic/raw-write-kills.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageClosureResult } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";

/** Complete layout of one representation, after its storage closed for the last time. */
type CompleteLayout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Function storage re-closed against the real free RAM of the representation under test. */
type ClosedStorage = Extract<StorageClosureResult, { readonly kind: "complete" }>;

/** Frame storage admitted into the proof, with the bytes each root actually owns. */
export interface FinalFrameStorage {
  /** Half-open absolute intervals keyed by source binding identity. */
  readonly ranges: ReadonlyMap<string, PlacedRange>;
  /** The same roots described so a lost proof can name where they were declared. */
  readonly descriptors: readonly StorageDescriptor[];
}

/** One admitted home, kept while the binding's remaining requests are still being read. */
interface FrameCandidate {
  /** Chosen first byte of the home. */
  readonly address: number;
  /** Width of the home, which must equal the declared type's own size. */
  readonly bytes: number;
  /** Declared type of the binding that owns the home. */
  readonly type: SemanticType;
  /** Declaration of that binding. */
  readonly declaration: SourceSpan;
}

/**
 * Join each local and parameter to the frame bytes its own representation gave it.
 *
 * Only storage a source binding names can be described here, and only when the
 * home really holds the value. A struct or array parameter is borrowed: its home
 * reserves the caller object's address, so it says nothing about where callable
 * bytes live, and comparing widths would not catch an aggregate that happens to
 * pack into the same two bytes an address needs. A binding whose requests resolved to more than one home — which is
 * what specializing a function across execution domains produces — cannot be
 * described by a single interval and is left out, as is one the allocator gave no
 * home at all. Both exclusions are ordinary outcomes rather than disagreements:
 * storage that is absent here simply keeps the proof it already had.
 * @param certificate Re-closed function storage belonging to the representation under test.
 * @returns Intervals and descriptors for every binding whose home describes it exactly.
 * @example projectFinalFrameRanges(shared.certificate)
 */
export function projectFinalFrameRanges(certificate: ClosedStorage): FinalFrameStorage {
  const homes = new Map(certificate.placement.homes.map((home) => [home.requestId, home] as const));
  const candidates = new Map<string, FrameCandidate>();
  const excluded = new Set<string>();
  for (const request of certificate.inventory.requests) {
    if (request.storageClass !== "local" && request.storageClass !== "parameter") continue;
    if (request.binding === null || request.type === null) continue;
    // A borrowed aggregate's home holds the caller object's address, never the
    // object, so no offset into it names a callable byte.
    if (
      request.storageClass === "parameter" &&
      (request.type.kind === "struct" || request.type.kind === "array")
    )
      continue;
    // Bytes that cannot hold a call target prove nothing and would only enlarge
    // the map every later consumer walks.
    if (callablePaths(request.type).length === 0) continue;
    const root = bindingIdentityKey(request.binding);
    const home = homes.get(request.id);
    const known = candidates.get(root);
    if (
      home === undefined ||
      (known !== undefined && (home.address !== known.address || home.bytes !== known.bytes))
    ) {
      excluded.add(root);
      continue;
    }
    if (known === undefined) {
      candidates.set(root, {
        address: home.address,
        bytes: home.bytes,
        type: request.type,
        declaration: request.binding.span,
      });
    }
  }
  const ranges = new Map<string, PlacedRange>();
  const descriptors: StorageDescriptor[] = [];
  for (const [root, candidate] of candidates) {
    if (excluded.has(root)) continue;
    if (candidate.bytes !== semanticTypeSize(candidate.type)) continue;
    ranges.set(
      root,
      Object.freeze({ start: candidate.address, end: candidate.address + candidate.bytes }),
    );
    descriptors.push({ root, type: candidate.type, declaration: candidate.declaration });
  }
  return { ranges, descriptors };
}

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
 * @param certificate Re-closed function storage of the same representation, whose homes decide
 * which frame bytes each local and parameter owns.
 * @returns Validity, the source errors that prevent publication, or a producer fault.
 * @example validateFinalCallableProof(checked.program, profile, shared.layout, shared.certificate)
 */
export function validateFinalCallableProof(
  program: WholeProgram,
  profile: TargetProfile,
  layout: CompleteLayout,
  certificate: ClosedStorage,
): FinalPlacementProof {
  const projection = projectFinalGlobalRanges(program, layout);
  if (projection.kind === "invariant") return projection;
  const frame = projectFinalFrameRanges(certificate);
  const ranges = new Map(projection.ranges);
  for (const [root, range] of frame.ranges) ranges.set(root, range);
  return finalPlacementProof(
    program,
    ranges,
    new Set(profile.interrupts?.sinks.map(({ capability }) => capability) ?? []),
    frame.descriptors,
  );
}
