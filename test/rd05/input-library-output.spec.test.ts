import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryGlobalAddress,
  sourceLibraryProfiles,
} from "./source-library-fixture.js";

describe.each(sourceLibraryProfiles)("complete input library output on %s", (profile) => {
  it("bounds the ordinary dynamic caller by one complete equal-contract expert artifact", async () => {
    const source = await readFile(
      new URL("./fixtures/input-caller.blend", import.meta.url),
      "utf8",
    );
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);
    // Concrete fast artifact: emitted963, general suffix21, physical ZP14.
    // The latter includes disjoint sibling/acquisition lives and a dead-slot overlay.
    // General owners: platform state7, caller snapshot11/results2, marker1.
    // Existing ROM is not emitted; external5-byte qualification RAM is separate.
    // input-whole-fast.a contains complete placement and path derivations.
    expect(artifacts.prg.length - 2).toBeLessThanOrEqual(963);
    expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
    expect([...artifacts.prg.subarray(2, 14)]).toEqual([
      0x0b, 0x08, 0x0a, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
    ]);
    expect(artifacts.debug).toMatchObject({
      profileId: profile,
      cpuId: "nmos6510",
      optimization: "size",
      safety: { boundsCheck: false, divisionZeroCheck: false },
    });
    expect(artifacts.costs.mode).toBe("size");

    const saved = libraryGlobalAddress(
      artifacts,
      source,
      "let saved: InputSnapshot;",
      11,
      "src/game.blend",
    );
    const key = libraryGlobalAddress(
      artifacts,
      source,
      "let keyResult: InputState;",
      1,
      "src/game.blend",
    );
    const joystick = libraryGlobalAddress(
      artifacts,
      source,
      "let joystickResult: InputState;",
      1,
      "src/game.blend",
    );
    expect(key < saved || key >= saved + 11).toBe(true);
    expect(joystick < saved || joystick >= saved + 11).toBe(true);
    expect(joystick).not.toBe(key);

    const intervals = profileRecords(artifacts.memory.intervals);
    expect(intervals.length).toBeGreaterThan(0);
    const physical: { start: number; end: number; resource: string }[] = [];
    const imageEnd = 0x0801 + artifacts.prg.length - 2;
    for (const interval of intervals) {
      const { start, end, size, payloadBytes, paddingBytes, reservedBytes } = interval;
      if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        typeof size !== "number" ||
        typeof payloadBytes !== "number" ||
        typeof paddingBytes !== "number" ||
        typeof reservedBytes !== "number"
      )
        throw new TypeError("Complete physical interval arithmetic is required");
      for (const value of [start, end, size, payloadBytes, paddingBytes, reservedBytes]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(end - start).toBe(size);
      expect(payloadBytes + paddingBytes + reservedBytes).toBe(size);
      expect(end <= 0xc100 || start >= 0xc105).toBe(true);
      if (interval.resourceClass === "zeroPage") {
        expect(start).toBeGreaterThanOrEqual(2);
        expect(end).toBeLessThanOrEqual(0x90);
      } else {
        expect(interval.resourceClass).toBe("general");
        expect(start).toBeGreaterThanOrEqual(0x0801);
        expect(end).toBeLessThanOrEqual(0xd000);
        if (["bss", "global", "sfa", "scratch"].includes(String(interval.kind)))
          expect(start).toBeGreaterThanOrEqual(imageEnd);
      }
      physical.push({ start, end, resource: String(interval.resourceClass) });
    }
    // Count unique physical homes, not logical frame aliases twice. Closure
    // evidence owns the proof that overlapping function homes have disjoint lives.
    const owned = { general: 0, zeroPage: 0 };
    for (const resource of ["general", "zeroPage"] as const) {
      const ranges = physical
        .filter((entry) => entry.resource === resource)
        .sort((a, b) => a.start - b.start);
      let coveredEnd = -1;
      for (const range of ranges) {
        owned[resource] += Math.max(0, range.end - Math.max(range.start, coveredEnd));
        coveredEnd = Math.max(coveredEnd, range.end);
      }
    }
    expect(owned.general).toBeLessThanOrEqual(984);
    expect(owned.zeroPage).toBeLessThanOrEqual(14);
    expect(owned.general + owned.zeroPage).toBeLessThanOrEqual(998);
    expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifacts.memory.acmeReconciled).toBe(true);

    const totals = profileRecord(artifacts.costs.totals);
    const resources = profileRecords(totals.resources);
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.map((resource) => resource.id).sort()).toEqual(
      ["zeroPage", "residentRam", "hardwareStack", "scratch"].sort(),
    );
    for (const resource of resources) {
      const value = resource.value;
      if (typeof value !== "number") throw new TypeError("Missing executable resource cost");
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(resource.kind).toBe("standard");
      expect(resource.id).toBeOneOf(["zeroPage", "residentRam", "hardwareStack", "scratch"]);
      if (resource.id === "zeroPage") expect(value).toBeLessThanOrEqual(14);
      if (resource.id === "hardwareStack") expect(value).toBeLessThanOrEqual(10);
    }
    expect(Array.isArray(totals.pathCycles)).toBe(true);
    // CPU witness acceptance additionally needs the already-owned native
    // debugger route. Unknown external/ROM work is never a finite time total.
    // No scan-only budget is subtracted into an invented whole-package budget.
  }, 120_000);
});
