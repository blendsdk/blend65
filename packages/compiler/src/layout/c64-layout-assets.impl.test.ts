import { describe, expect, it } from "vitest";
import type { TargetProfile } from "../target/profile.js";
import {
  freeSourceStart,
  satisfiesSourcePlacement,
  sourceDataStart,
} from "./c64-layout-placement.js";
import { freeIntervalsInWindow } from "./c64-layout-objects.js";
import { selectTargetProfile } from "../target/profile.js";

/** Minimal profile for placement arithmetic. */
function profile(): TargetProfile {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Expected selected profile");
  return result.profile;
}

describe("layout asset placement internals", () => {
  // Alignment and no-cross windows move the cursor to the next legal start.
  it("should align and skip a crossing window", () => {
    expect(sourceDataStart(0x0801, 4, 64, undefined)).toBe(0x0840);
    expect(
      sourceDataStart(
        0x00f0,
        0x20,
        1,
        Object.freeze({ at: null, align: 1, noCross: 0x100, region: null }),
      ),
    ).toBe(0x0100);
  });

  // A fixed source address is preserved exactly.
  it("should preserve a fixed address", () => {
    expect(
      sourceDataStart(
        0x0801,
        4,
        1,
        Object.freeze({ at: 0x3000, align: 1, noCross: null, region: null }),
      ),
    ).toBe(0x3000);
  });

  // The first fit skips occupied intervals and reports null when no hole remains.
  it("should skip occupied intervals and fail closed", () => {
    const occupied = [{ start: 0x0840, end: 0x087f }];
    expect(freeSourceStart(0x0801, 4, 64, undefined, occupied, profile())).toBe(0x0880);
    expect(freeSourceStart(0x3fc0, 0x80, 64, undefined, [], profile())).toBe(0x3fc0);
  });

  // Free intervals are the exact complement of occupied ranges in one window.
  it("should partition a window around occupied ranges", () => {
    const free = freeIntervalsInWindow(0x100, 0x200, [
      { start: 0x120, end: 0x12f },
      { start: 0x180, end: 0x19f },
      { start: 0x040, end: 0x080 },
    ]);
    expect(free).toEqual([
      { start: 0x100, end: 0x120, size: 0x20 },
      { start: 0x130, end: 0x180, size: 0x50 },
      { start: 0x1a0, end: 0x200, size: 0x60 },
    ]);
  });

  // Overlapping occupied ranges merge instead of producing overlapping holes.
  it("should merge overlapping occupied ranges", () => {
    const free = freeIntervalsInWindow(0, 0x40, [
      { start: 0x10, end: 0x1f },
      { start: 0x18, end: 0x27 },
    ]);
    expect(free).toEqual([
      { start: 0, end: 0x10, size: 0x10 },
      { start: 0x28, end: 0x40, size: 0x18 },
    ]);
  });

  // Ranges crossing a window boundary are clipped rather than ignored.
  it("should clip occupied ranges at the window boundary", () => {
    const free = freeIntervalsInWindow(0x100, 0x200, [
      { start: 0x080, end: 0x10f },
      { start: 0x1f0, end: 0x280 },
    ]);
    expect(free).toEqual([{ start: 0x110, end: 0x1f0, size: 0xe0 }]);
  });

  // The selected bank-0 region is accepted only inside the bank.
  it("should accept bank 0 and reject another region", () => {
    const placement = Object.freeze({
      at: null,
      align: 1,
      noCross: null,
      region: "c64.vic.bank0",
    });
    expect(satisfiesSourcePlacement(0x2000, 4, placement, profile())).toBe(true);
    expect(
      satisfiesSourcePlacement(
        0x4000,
        4,
        Object.freeze({ ...placement, region: "c64.vic.bank1" }),
        profile(),
      ),
    ).toBe(false);
  });
});
