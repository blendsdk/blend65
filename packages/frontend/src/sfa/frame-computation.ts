/**
 * The SFA frame-computation pass (spec Ch 11 §3.1/§3.3).
 *
 * Turns each {@link FunctionInfo} into a {@link FunctionFrame} by applying the
 * Ch 11 §3.3 type-size table: parameters are placed first, then locals, each in
 * declaration order, with a running byte offset and **no** alignment padding.
 * Struct/array parameters are passed by reference, so they occupy a 2-byte pointer
 * slot rather than their full size.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`. It is a pure function of its input (no I/O, no
 * mutation of the argument), so it is trivially testable and deterministic.
 */

import type { FunctionInfo, FrameVar, FunctionFrame, FrameSlot } from "@blend65/core";
import { byteSize } from "@blend65/core";

/**
 * Computes the byte size of one frame slot per the Ch 11 §3.3 table.
 *
 * Struct and array **parameters** are passed by reference and therefore occupy a
 * 2-byte pointer slot; every other slot (all locals, and scalar parameters) takes
 * its natural {@link byteSize}. `void`/`error` types yield 0 (error tolerance).
 *
 * @param v The frame variable (parameter or local) to size.
 * @param kind Whether `v` is a `"parameter"` or a `"local"`.
 * @returns The slot's byte size.
 */
export function slotSize(v: FrameVar, kind: "parameter" | "local"): number {
  // Struct/array parameters are by-reference: a 2-byte pointer, not the full size.
  if (kind === "parameter" && (v.type.kind === "struct" || v.type.kind === "array")) {
    return 2;
  }
  // Everything else takes its natural byte size (word/sword→2, struct→sizeof,
  // array→elem×N, byte/sbyte/boolean/enum→1, void/error→0).
  return byteSize(v.type);
}

/**
 * Computes the {@link FunctionFrame} for a single function.
 *
 * Slots are emitted parameters-first then locals, each in declaration order, with
 * a running offset (the sum of preceding slot sizes — no padding). The function's
 * always-live flags are carried onto the frame for the coloring pass. A function
 * with no parameters or locals yields an empty frame of size 0; `main()` is
 * handled identically.
 *
 * @param fn The function's SFA input record.
 * @returns The computed frame: ordered slots and total size.
 */
export function computeFrame(fn: FunctionInfo): FunctionFrame {
  const slots: FrameSlot[] = [];
  let offset = 0;

  // Parameters first, in declaration order.
  for (const p of fn.parameters) {
    const size = slotSize(p, "parameter");
    slots.push({ name: p.name, kind: "parameter", type: p.type, size, offset });
    offset += size;
  }
  // Then locals, in declaration order.
  for (const l of fn.locals) {
    const size = slotSize(l, "local");
    slots.push({ name: l.name, kind: "local", type: l.type, size, offset });
    offset += size;
  }

  return {
    functionName: fn.name,
    slots,
    totalSize: offset,
    isInterrupt: fn.isInterrupt,
    isEscaped: fn.isEscaped,
    isReachable: fn.isReachable,
  };
}

/**
 * Computes frames for every function, keyed by fully-qualified name.
 *
 * No filtering is applied here — reachability is handled later by the coloring
 * pass — so the returned map contains one entry per input function.
 *
 * @param fns The functions to compute frames for.
 * @returns A map from function name to its computed frame.
 */
export function computeFrames(fns: readonly FunctionInfo[]): Map<string, FunctionFrame> {
  const frames = new Map<string, FunctionFrame>();
  for (const fn of fns) {
    frames.set(fn.name, computeFrame(fn));
  }
  return frames;
}
