import type { C64LayoutInterval } from "../layout/c64-layout.js";
import type { CompleteC64Layout } from "./acme-validate.js";

/** A layout interval whose bytes must be present in the PRG body. */
type LoadedInterval = C64LayoutInterval & { readonly bytes: readonly number[] };

/** Successful CBM PRG reconciliation or a closed validation failure. */
export type PrgVerificationResult =
  | { readonly kind: "complete"; readonly loadAddress: number; readonly body: Uint8Array }
  | { readonly kind: "error"; readonly diagnostic: string };

/** Return a safe immutable PRG validation failure. */
function failure(diagnostic: string): PrgVerificationResult {
  return Object.freeze({ kind: "error", diagnostic });
}

/** Return the loaded intervals in address order. */
function loadedIntervals(layout: CompleteC64Layout): readonly LoadedInterval[] {
  return layout.intervals.filter((interval): interval is LoadedInterval => interval.bytes !== null);
}

/**
 * Verify a CBM PRG header, complete load range, and every layout-owned data byte.
 *
 * Machine-code bytes are checked separately against ACME's report because the layout reserves
 * their addresses before assembly. All other bytes, including assets and explicit padding, are
 * compared directly with the immutable layout.
 *
 * @param layout Final address and data placement.
 * @param bytes Complete PRG file bytes.
 * @returns The verified body and load address, or a closed failure.
 * @example verifyPrg(layout, bytes).kind === "complete"
 */
export function verifyPrg(layout: CompleteC64Layout, bytes: Uint8Array): PrgVerificationResult {
  if (bytes.byteLength < 2) return failure("The CBM PRG is missing its two-byte load address");
  const loadAddress = bytes[0]! | (bytes[1]! << 8);
  if (loadAddress !== layout.loadRange.start) {
    return failure("The CBM PRG load address does not match the final layout");
  }

  const expectedBodyBytes = layout.loadRange.end - layout.loadRange.start + 1;
  if (bytes.byteLength !== expectedBodyBytes + 2) {
    return failure("The CBM PRG body length does not match the final load range");
  }
  const body = bytes.slice(2);
  const loaded = loadedIntervals(layout);
  let nextAddress = layout.loadRange.start;
  for (const interval of loaded) {
    if (
      interval.start !== nextAddress ||
      interval.bytes.length !== interval.end - interval.start + 1
    ) {
      return failure("The loaded layout intervals do not form one complete PRG body");
    }
    if (interval.kind !== "code") {
      const offset = interval.start - loadAddress;
      for (let index = 0; index < interval.bytes.length; index += 1) {
        if (body[offset + index] !== interval.bytes[index]) {
          return failure("A layout-owned data byte disagrees with the assembled PRG");
        }
      }
    }
    nextAddress = interval.end + 1;
  }
  if (nextAddress !== layout.loadRange.end + 1) {
    return failure("The loaded layout leaves an unowned gap in the PRG body");
  }
  return Object.freeze({ kind: "complete", loadAddress, body });
}
