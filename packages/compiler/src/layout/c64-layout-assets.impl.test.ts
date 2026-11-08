import { describe, expect, it } from "vitest";
import type { TargetProfile } from "../target/profile.js";
import {
  freeSourceStart,
  satisfiesSourcePlacement,
  sourceDataStart,
} from "./c64-layout-placement.js";
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
