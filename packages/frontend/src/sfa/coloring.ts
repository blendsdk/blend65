/**
 * The SFA frame-coloring pass (RD-05 §4.4, R12/R16/R18, R21/R22; spec Ch 11 §3.4).
 *
 * Assigns each reachable function a byte offset within a single shared *frame
 * region* such that interfering functions never overlap, while non-interfering
 * functions may share the same bytes. Because the interference graph derived from
 * a call tree is **chordal**, greedy coloring in a fixed order is optimal — so we
 * process functions in a deterministic order (frame size descending, then name
 * ascending, R18) and place each in the lowest offset that clears its already-
 * placed interfering neighbors.
 *
 * Unlike classic graph coloring (one color per node), frames have *sizes*, so we
 * color **intervals**: each function occupies `[offset, offset + totalSize)`. The
 * resulting `frameRegionSize` is the peak simultaneous footprint (R21/R22) — the
 * maximum of `offset + size` over all functions — NOT the sum of all frame sizes.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20). Pure and
 * deterministic. See plans/rd-05-sfa-frame-planner/03-02-interference-and-coloring.md.
 */

import type { FunctionFrame, InterferenceGraph } from "@blend65/core";

/** The result of coloring: each function's frame offset and the total region size. */
export interface ColoringResult {
  /** Function name → assigned byte offset within the frame region. */
  readonly offsets: ReadonlyMap<string, number>;
  /** `max(offset + size)` over all functions, or 0 when empty (the peak, R21/R22). */
  readonly frameRegionSize: number;
}

/** A half-open `[start, end)` byte interval occupied by an already-placed frame. */
interface Interval {
  readonly start: number;
  readonly end: number;
}

/**
 * Finds the smallest non-negative offset at which an interval of `size` bytes
 * fits without overlapping any `occupied` interval.
 *
 * The occupied intervals are sorted by start; we walk the gaps from 0 upward and
 * place the frame in the first gap large enough, or after the last interval if no
 * interior gap fits. Deterministic given a fixed processing order.
 *
 * @param occupied Intervals already taken by interfering neighbors.
 * @param size The number of bytes the new frame needs.
 * @returns The smallest fitting offset.
 */
function smallestFittingOffset(occupied: readonly Interval[], size: number): number {
  // A zero-size frame fits anywhere; offset 0 keeps it out of the region size.
  if (size === 0) {
    return 0;
  }
  const sorted = [...occupied].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const iv of sorted) {
    // If the frame fits in the gap before this interval, place it here.
    if (iv.start - cursor >= size) {
      return cursor;
    }
    // Otherwise advance past this interval (intervals may overlap, so take max).
    cursor = Math.max(cursor, iv.end);
  }
  return cursor;
}

/**
 * Colors the frames against the interference graph (R12/R16/R18).
 *
 * Only functions present in `graph.nodes` are colored (unreachable functions were
 * already excluded when the graph was built). Functions absent from `frames` are
 * skipped defensively (treated as size 0).
 *
 * @param frames Computed frames, keyed by function name.
 * @param graph The interference graph over the reachable functions.
 * @returns The per-function offsets and the total frame-region size.
 */
export function colorFrames(
  frames: ReadonlyMap<string, FunctionFrame>,
  graph: InterferenceGraph,
): ColoringResult {
  /** The frame size for a node, defaulting to 0 if no frame was computed. */
  const sizeOf = (name: string): number => frames.get(name)?.totalSize ?? 0;

  // Step 1 — deterministic processing order: size DESC, then name ASC (R18).
  const order = [...graph.nodes].sort((a, b) => {
    const bySize = sizeOf(b) - sizeOf(a);
    return bySize !== 0 ? bySize : a < b ? -1 : a > b ? 1 : 0;
  });

  const offsets = new Map<string, number>();

  // Step 2/3 — greedy interval placement against already-placed neighbors.
  for (const name of order) {
    const occupied: Interval[] = [];
    for (const neighbor of graph.edges.get(name) ?? []) {
      const nOffset = offsets.get(neighbor);
      if (nOffset === undefined) {
        continue; // neighbor not placed yet — it will avoid us instead.
      }
      occupied.push({ start: nOffset, end: nOffset + sizeOf(neighbor) });
    }
    offsets.set(name, smallestFittingOffset(occupied, sizeOf(name)));
  }

  // Step 4 — frameRegionSize is the peak: max(offset + size), 0 if empty.
  let frameRegionSize = 0;
  for (const [name, offset] of offsets) {
    frameRegionSize = Math.max(frameRegionSize, offset + sizeOf(name));
  }

  return { offsets, frameRegionSize };
}
