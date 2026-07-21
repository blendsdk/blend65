/**
 * Implementation tests for the shared bit helpers.
 *
 * `log2Exact` had no direct coverage while it was private to instruction
 * selection — it was reached only through the power-of-two multiply, whose own
 * tests exercise a handful of small byte values. Now that both the multiply and
 * the address-byte fold depend on it, and the two disagree about whether the
 * argument is masked to a byte, its whole range is pinned here.
 */

import { describe, expect, it } from "vitest";
import { log2Exact } from "./bits.js";

describe("log2Exact", () => {
  it("returns the exponent for every power of two a 16-bit divisor can be", () => {
    expect(log2Exact(1)).toBe(0);
    expect(log2Exact(2)).toBe(1);
    expect(log2Exact(64)).toBe(6);
    // Past a byte: the address-byte fold divides by up to 32768, and a caller
    // that masked to 8 bits first would get null for every one of these.
    expect(log2Exact(256)).toBe(8);
    expect(log2Exact(32768)).toBe(15);
  });

  it("rejects non-powers of two, zero and negatives", () => {
    expect(log2Exact(40)).toBeNull();
    expect(log2Exact(3)).toBeNull();
    // Zero would otherwise pass the `n & (n - 1)` test on its own, so the
    // lower bound is what keeps a divide-by-zero from folding.
    expect(log2Exact(0)).toBeNull();
    expect(log2Exact(-64)).toBeNull();
  });
});
